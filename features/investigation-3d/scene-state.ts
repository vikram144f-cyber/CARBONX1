import type { IncidentResponse } from "../../lib/validations/incidents";

export type SceneHotspotKind = "OBSERVED" | "RISK" | "EVIDENCE";

export type InvestigationHotspot = {
  id: string;
  kind: SceneHotspotKind;
  title: string;
  detail: string;
  evidenceLabel: string;
  coordinate: [number, number] | null;
};

export type InvestigationSceneState = {
  project: {
    id: string;
    name: string;
    centroid: [number, number];
    boundary: {
      id: string;
      version: number;
      geojson: unknown;
      source: string;
      sourceUrl: string | null;
      quality: string;
      verifiedAt: string | null;
    } | null;
  };
  event: {
    id: string;
    type: string;
    sourceName: string;
    originType: string;
    observedAt: string | null;
    coordinate: [number, number] | null;
  };
  assessment: {
    id: string;
    integrityRisk: string;
    evidenceConfidence: string;
    auditPriority: string;
    impactPct: number | null;
    estimatedImpactHa: number | null;
    evidenceLabel: string;
  } | null;
  anomalyVisible: boolean;
  hotspots: InvestigationHotspot[];
};

function coordinateFromGeometry(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as {
    type?: unknown;
    geometry?: unknown;
    coordinates?: unknown;
  };
  if (candidate.type === "Feature") return coordinateFromGeometry(candidate.geometry);
  if (
    candidate.type !== "Point" ||
    !Array.isArray(candidate.coordinates) ||
    candidate.coordinates.length < 2 ||
    typeof candidate.coordinates[0] !== "number" ||
    typeof candidate.coordinates[1] !== "number"
  ) {
    return null;
  }
  return [candidate.coordinates[0], candidate.coordinates[1]];
}

export function mapIncidentToSceneState(data: IncidentResponse): InvestigationSceneState {
  const assessment = data.latestAssessment;
  const eventCoordinate = coordinateFromGeometry(data.event.geometry);
  const boundary = data.project.currentBoundary ?? null;
  const centroid: [number, number] = [
    data.project.centroidLng ?? 0,
    data.project.centroidLat ?? 0,
  ];
  const evidenceLabel = assessment?.evidence[0]?.label ?? "OBSERVED";
  const hotspots: InvestigationHotspot[] = [
    {
      id: `event-${data.event.id}`,
      kind: "OBSERVED",
      title: "Satellite observation",
      detail: `${data.event.type} reported by ${data.event.sourceName}. ${data.event.originType} source provenance is preserved.`,
      evidenceLabel: data.event.originType === "REPLAYED" ? "REPLAYED" : "OBSERVED",
      coordinate: eventCoordinate,
    },
  ];

  if (assessment) {
    hotspots.push({
      id: `risk-${assessment.id}`,
      kind: "RISK",
      title: "Deterministic risk assessment",
      detail: `${assessment.integrityRisk} integrity risk · ${assessment.auditPriority} audit priority · ${assessment.estimatedImpactHa === null ? "impact unavailable" : `${assessment.estimatedImpactHa.toFixed(2)} ha estimated overlap`}.`,
      evidenceLabel,
      coordinate: eventCoordinate,
    });
    for (const evidence of assessment.evidence) {
      hotspots.push({
        id: `evidence-${evidence.id}`,
        kind: "EVIDENCE",
        title: `${evidence.label} evidence record`,
        detail: evidence.notes ?? "Evidence record attached to the deterministic assessment.",
        evidenceLabel: evidence.label,
        coordinate: eventCoordinate,
      });
    }
  }

  return {
    project: {
      id: data.project.id,
      name: data.project.name,
      centroid,
      boundary: boundary
        ? {
            id: boundary.id,
            version: boundary.version,
            geojson: boundary.geojson,
            source: boundary.source,
            sourceUrl: boundary.sourceUrl,
            quality: boundary.quality,
            verifiedAt: boundary.verifiedAt,
          }
        : null,
    },
    event: {
      id: data.event.id,
      type: data.event.type,
      sourceName: data.event.sourceName,
      originType: data.event.originType,
      observedAt: data.event.observedAt,
      coordinate: eventCoordinate,
    },
    assessment: assessment
      ? {
          id: assessment.id,
          integrityRisk: assessment.integrityRisk,
          evidenceConfidence: assessment.evidenceConfidence,
          auditPriority: assessment.auditPriority,
          impactPct: assessment.impactPct,
          estimatedImpactHa: assessment.estimatedImpactHa,
          evidenceLabel,
        }
      : null,
    anomalyVisible: Boolean(assessment?.estimatedImpactHa && assessment.estimatedImpactHa > 0),
    hotspots,
  };
}
