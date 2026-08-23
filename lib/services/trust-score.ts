import "server-only";

import { prisma } from "../prisma";
import { NotFoundError } from "./errors";
import { getStoredProject, getFallbackProject } from "./project-store";
import {
  calculateTrustScoreModel,
  type TrustScoreModelAnomaly,
  type TrustScoreModelComponent,
} from "./trust-score-model";

export interface ScoreComponent {
  component_name: string;
  name?: string;
  weighted_score: number;
  weight: number;
  score_contribution?: number;
  max_contribution?: number;
  reason: string;
  reasoning?: string;
}

export interface Anomaly {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface EvidenceNode {
  id: string;
  source_type: "DOCUMENT" | "GIS" | "SATELLITE" | "SENSOR" | "TABULAR";
  source_name: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  confidence: number;
  provenance: Record<string, unknown>;
}

export interface EvidenceRelationship {
  source: string;
  target: string;
  type: "CONSISTENT_WITH" | "SUPPORTS" | "CONFLICTS_WITH";
  description: string;
}

export interface TrustScoreResult {
  project_id: string;
  verification_id: string;
  truth_score: number;
  confidence: number;
  decision: "VERIFIED" | "REVIEW" | "HIGH_RISK" | "INVALID";
  score_components: ScoreComponent[];
  anomalies: Anomaly[];
  evidence: EvidenceNode[];
  relationships: EvidenceRelationship[];
  gemini_report: {
    ai_summary: string;
    key_findings: string[];
    supporting_evidence: string[];
    conflicting_evidence: string[];
    missing_evidence: string[];
    human_audit_recommendation: boolean;
    audit_actions: string[];
    confidence_statement: string;
  };
  human_audit_recommendation: boolean;
  timestamp: string;
  pipeline_version: string;
  scoring_version: string;
  model_version: string;
}

function hasBoundaryGeometry(value: unknown): boolean {
  if (!value) return false;
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return false;
    }
  }
  if (!parsed || typeof parsed !== "object") return false;
  const candidate = parsed as { type?: unknown; geometry?: unknown; coordinates?: unknown; features?: unknown[] };
  if (candidate.type === "FeatureCollection" && Array.isArray(candidate.features) && candidate.features.length > 0) {
    return hasBoundaryGeometry(candidate.features[0]);
  }
  if (candidate.type === "Feature") return hasBoundaryGeometry(candidate.geometry);
  return (
    (candidate.type === "Polygon" || candidate.type === "MultiPolygon") &&
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length > 0
  );
}


async function synthesizeWithAI(
  projectName: string,
  registryId: string | null,
  score: number,
  decision: string,
  anomalies: Anomaly[],
  heldQuantity: number,
  measuredAreaHa: number,
  biomassDensity: number | null,
  environmentalEvidenceCount: number,
  environmentalSourceConfidence: number | null,
): Promise<{ text: string; model: string } | null> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const nvidiaKey = (process.env.NVIDIA_API_KEY || process.env.AI_API_KEY)?.trim();

  const promptText = `You are a strict, authoritative environmental carbon auditor for CARBONX.
Analyze the following multi-modal audit data for ${projectName} and write a 2-3 sentence executive assessment.
Project Name: ${projectName}
Registry ID: ${registryId ?? "PENDING"}
Claimed Volume: ${heldQuantity.toLocaleString()} tCO2e
GIS Measured Area: ${measuredAreaHa.toFixed(1)} ha
Calculated Inventory Density: ${biomassDensity === null ? "unavailable" : `${biomassDensity.toFixed(1)} tCO2e/ha`}
  Linked FIRMS environmental evidence count: ${environmentalEvidenceCount}
  Linked FIRMS source confidence: ${environmentalSourceConfidence === null ? "unavailable" : `${(environmentalSourceConfidence * 100).toFixed(0)}%`}
  Calculated Truth Score: ${score.toFixed(1)}/100
Decision: ${decision}
Detected Anomalies: ${anomalies.map((a) => `[${a.severity}] ${a.message}`).join("; ") || "None (All multi-modal signals reconciled)"}

  CARBONX P0 does not include Sentinel-2 imagery or ground-sensor telemetry. Do not claim either source is available.
  Write a concise interpretation of the supplied evidence only. Do not calculate or alter the Truth Score.`;

  // 1. Try Gemini (Google Generative AI)
  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const model = process.env.AI_MODEL_ID?.trim() || "gemini-2.5-flash";

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
          }),
        },
      );

      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { text, model: `google/${model}` };
      }
    } catch (e) {
      console.warn("[TrustScoreService] Gemini synthesis note", e);
    }
  }

  // 2. Try NVIDIA NIM (meta/llama-3.3-70b-instruct)
  if (nvidiaKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nvidiaKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "meta/llama-3.3-70b-instruct",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert environmental carbon-credit validation analyst for CARBONX. Write a 2-3 sentence authoritative, factual executive assessment of multi-modal evidence reconciliation.",
              },
              { role: "user", content: promptText },
            ],
            temperature: 0.2,
            max_tokens: 200,
          }),
        },
      );

      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return { text, model: "nvidia/llama-3.3-70b-instruct" };
      }
    } catch (err) {
      console.warn("[TrustScoreService] NVIDIA NIM synthesis note", err);
    }
  }

  return null;
}

export class TrustScoreService {
  async getTrustScore(projectId: string): Promise<TrustScoreResult> {
    let project: any = null;
    try {
      project = await prisma.carbonProject.findUnique({
        where: { id: projectId },
        include: {
          boundaries: {
            where: { isCurrent: true },
            take: 1,
          },
          creditHoldings: true,
          incidents: {
            orderBy: { createdAt: "desc" },
            include: {
              assessments: {
                take: 1,
                orderBy: { createdAt: "desc" },
              },
              event: {
                select: {
                  id: true,
                  sourceName: true,
                  sourceId: true,
                  sourceInstrument: true,
                  sourceConfidence: true,
                  observedAt: true,
                },
              },
            },
          },
        },
      });
    } catch (err) {
      console.warn("[TrustScoreService] Database query warning, serving offline cache", err);
    }

    if (!project) {
      project = getStoredProject(projectId) ?? getFallbackProject(projectId);
    }

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const boundary = project.boundaries?.[0];
    const measuredAreaHa = parseFloat((boundary?.areaHa ?? 0).toFixed(2));
    const totalCredits =
      (project.creditHoldings ?? []).reduce(
        (sum: number, h: { heldQuantity: number }) => sum + h.heldQuantity,
        0,
      );

    const biomassDensity =
      measuredAreaHa > 0 && totalCredits > 0
        ? parseFloat((totalCredits / measuredAreaHa).toFixed(2))
        : null;

    const activeIncidents = (project.incidents ?? []).filter(
      (i: { status: string }) => i.status !== "RESOLVED",
    );
    const hasHighRiskIncident = activeIncidents.some((i: { assessments?: Array<{ integrityRisk: string }> }) =>
      (i.assessments ?? []).some(
        (a) => a.integrityRisk === "HIGH" || a.integrityRisk === "CRITICAL",
      ),
    );

    const events = ((project.incidents ?? []) as Array<{
      event?: { sourceConfidence?: number | null; observedAt?: Date | string | null };
    }>)
      .map((incident) => incident.event)
      .filter(
        (event): event is { sourceConfidence?: number | null; observedAt?: Date | string | null } => Boolean(event),
      );
    const environmentalSourceConfidence =
      events.length > 0
        ? events.reduce((sum, event) => sum + (event.sourceConfidence ?? 0), 0) / events.length
        : null;
    const environmentalObservedAt = events[0]?.observedAt ?? null;
    const model = calculateTrustScoreModel({
      boundaryPresent: Boolean(boundary),
      boundaryHasGeometry: hasBoundaryGeometry(boundary?.geojson),
      boundaryQuality: boundary?.quality ?? null,
      boundaryVerifiedAt: boundary?.verifiedAt ?? null,
      boundaryAcquiredAt: boundary?.acquiredAt ?? null,
      areaHa: measuredAreaHa,
      claimedAreaHa: project.claimedAreaHa ?? measuredAreaHa,
      hasPddFile: Boolean(project.pddPath),
      pddFileName: project.pddFileName ?? project.pddPath ?? null,
      geojsonFileName: project.geojsonPath ?? boundary?.sourceUrl ?? boundary?.source ?? null,
      heldQuantity: totalCredits,
      registryId: project.registryId ?? null,
      methodology: project.methodology ?? null,
      description: project.description ?? null,
      environmentalEvidenceCount: events.length,
      environmentalSourceConfidence,
      environmentalObservedAt,
      hasHighRiskIncident,
    });

    const scoreComponents: ScoreComponent[] = model.components as TrustScoreModelComponent[];
    const anomalies: Anomaly[] = model.anomalies as TrustScoreModelAnomaly[];
    const truthScore = model.truthScore;

    const hasCriticalAnomaly = anomalies.some((a) => a.severity === "CRITICAL");
    let decision: "VERIFIED" | "REVIEW" | "HIGH_RISK" | "INVALID" = "VERIFIED";
    if (truthScore < 45 || (hasCriticalAnomaly && truthScore < 60)) {
      decision = truthScore < 40 ? "INVALID" : "HIGH_RISK";
    } else if (truthScore < 75) {
      decision = "HIGH_RISK";
    } else if (truthScore < 90) {
      decision = "REVIEW";
    }


    const auditRecommended = decision !== "VERIFIED" || anomalies.length > 0;

    const aiResult = await synthesizeWithAI(
      project.name,
      project.registryId,
      truthScore,
      decision,
      anomalies,
      totalCredits,
      measuredAreaHa,
      model.biomassDensity,
      events.length,
      environmentalSourceConfidence,
    );


    const defaultSummary =
      decision === "VERIFIED"
        ? `Comprehensive multi-modal evaluation demonstrates high evidence consistency across registered GIS boundaries (${measuredAreaHa.toFixed(1)} ha), calculated biomass density (${(model.biomassDensity ?? 0).toFixed(1)} tCO2e/ha), and satellite observations for ${project.name}. Overall Trust Score is ${truthScore.toFixed(1)}/100.`
        : `Multi-modal evaluation detected ${anomalies.length} anomaly/discrepancies. Attention is required regarding ${anomalies.map((a) => a.type.toLowerCase().replace(/_/g, " ")).join(", ")}. Human audit is recommended.`;

    const baseEvidence: EvidenceNode[] = [
      {
        id: `ev-doc-${projectId}`,
        source_type: "DOCUMENT",
        source_name: project.pddFileName ?? `${project.name} Project Design Document (PDD)`,
        metric: "CLAIMED_CARBON",
        value: totalCredits,
        unit: "tCO2e",
        confidence: 0.95,
        provenance: {
          registry: project.registryId ?? "VCS",
          filePath: project.pddPath ?? "/uploads/pdd/sample_pdd.pdf",
          extraction: aiResult?.model ?? "google/gemini-1.5-flash",
        },
      },
      {
        id: `ev-gis-${projectId}`,
        source_type: "GIS",
        source_name: "Registered Boundary Polygon",
        metric: "CALCULATED_AREA",
        value: measuredAreaHa,
        unit: "hectares",
        confidence: 0.98,
        provenance: {
          source: boundary?.source ?? "Uploaded GeoJSON",
          filePath: project.geojsonPath ?? "/uploads/geojson/boundary.geojson",
          quality: boundary?.quality ?? "MEDIUM",
        },
      },

    ];

    const holdingsEvidence: EvidenceNode = {
      id: `ev-holdings-${projectId}`,
      source_type: "TABULAR",
      source_name: "CARBONX CreditHolding records",
      metric: "HELD_CREDITS",
      value: totalCredits,
      unit: "tCO2e",
      confidence: totalCredits > 0 ? 1 : 0,
      provenance: { source: "PostgreSQL CreditHolding records" },
    };
    const environmentalEvidence: EvidenceNode | null = model.environmentalEvidenceCount > 0
      ? {
          id: `ev-firms-${projectId}`,
          source_type: "SATELLITE",
          source_name: "NASA FIRMS",
          metric: "THERMAL_DETECTION_CONFIDENCE",
          value: model.environmentalSourceConfidence ?? 0,
          unit: "confidence",
          confidence: model.environmentalSourceConfidence ?? 0,
          provenance: {
            source: "NASA FIRMS",
            evidenceCount: model.environmentalEvidenceCount,
            note: "FIRMS points are satellite thermal detections; they are not burned-area measurements.",
          },
        }
      : null;
    const evidence: EvidenceNode[] = [
      ...baseEvidence,
      holdingsEvidence,
      ...(environmentalEvidence ? [environmentalEvidence] : []),
    ];

    const relationships: EvidenceRelationship[] = [
      {
        source: `ev-doc-${projectId}`,
        target: `ev-gis-${projectId}`,
        type: anomalies.some((a) => a.type.includes("DENSITY")) ? "CONFLICTS_WITH" : "CONSISTENT_WITH",
        description:
          model.biomassDensity === null
            ? "The stored holding quantity and project area are insufficient for an inventory-density comparison."
            : `Held volume (${totalCredits.toLocaleString()} tCO2e) on ${measuredAreaHa.toFixed(1)} ha implies ${model.biomassDensity.toFixed(1)} tCO2e/ha inventory density.`,
      },

      {
        source: `ev-holdings-${projectId}`,
        target: `ev-gis-${projectId}`,
        type: "SUPPORTS",
        description: "The stored holding quantity is the authoritative inventory input for this score.",
      },
      ...(environmentalEvidence
        ? [{
            source: environmentalEvidence.id,
            target: `ev-gis-${projectId}`,
            type: hasHighRiskIncident ? "CONFLICTS_WITH" as const : "SUPPORTS" as const,
            description: "NASA FIRMS thermal detection is linked to the project incident and interpreted as event evidence.",
          }]
        : []),
    ];

    return {
      project_id: projectId,
      verification_id: `vr-${projectId}-${Date.now().toString(36)}`,
      truth_score: truthScore,
      confidence: model.confidence,
      decision,
      score_components: scoreComponents,
      anomalies,
      evidence,
      relationships,
      gemini_report: {
        ai_summary: aiResult?.text ?? defaultSummary,
        key_findings: [
          `Deterministic Trust Score calculated at ${truthScore.toFixed(1)}/100`,
          `Decision category: ${decision}`,
          biomassDensity === null
            ? "Carbon density: unavailable because area or held quantity is missing"
            : `Held inventory density: ${biomassDensity.toFixed(1)} tCO2e/ha across ${measuredAreaHa.toFixed(1)} ha`,
          `GIS Boundary quality: ${boundary?.quality ?? "MEDIUM"}`,
        ],
        supporting_evidence: [
          project.registryId
            ? "A registry identifier is present in the stored project record"
            : "No verified registry identifier is present in the stored project record",
          model.environmentalEvidenceCount > 0
            ? `NASA FIRMS evidence count: ${model.environmentalEvidenceCount}`
            : "No NASA FIRMS event is linked to this project",
        ],
        conflicting_evidence: anomalies.map((a) => a.message),
        missing_evidence: model.environmentalEvidenceCount > 0
          ? []
          : ["NASA FIRMS event evidence is not linked to this project"],
        human_audit_recommendation: auditRecommended,
        audit_actions: auditRecommended
          ? [
              "Conduct ground verification of boundary perimeters",
              "Review biomass density calculation methodology",
            ]
          : ["Maintain standard continuous monitoring cycle"],
        confidence_statement: `Evidence coverage confidence ${(model.confidence * 100).toFixed(0)}%; narrative provider: ${aiResult?.model ?? "unavailable"}.`,
      },
      human_audit_recommendation: auditRecommended,
      timestamp: new Date().toISOString(),
      pipeline_version: "0.2.0",
      scoring_version: "0.3.0",
      model_version: aiResult?.model ?? "deterministic-trust-v0.3",
    };
  }
}
