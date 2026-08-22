import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../prisma";
import {
  AI_INPUT_SCHEMA_VERSION,
  AI_OUTPUT_SCHEMA_VERSION,
  aiReportInputSchema,
  aiReportOutputSchema,
  type AIReportInput,
  type AIReportOutput,
} from "../validations/ai";

export const AI_PROMPT_VERSION = "ai-system-v1.0";

export const AI_SYSTEM_PROMPT = [
  "You are a carbon-credit risk analyst assistant.",
  "Interpret only the validated structured JSON supplied by the user.",
  "Do not invent or infer evidence, observations, geometry, coordinates, holdings, prices, or facts not present in the JSON.",
  "Do not calculate, recalculate, override, or contradict impact, exposure, confidence, or risk values.",
  "Clearly distinguish observed facts from estimated or modeled impacts and state uncertainties.",
  "Do not make legal conclusions and do not declare, invalidate, cancel, or recommend invalidating carbon credits.",
  `Return strict JSON matching the ${AI_OUTPUT_SCHEMA_VERSION} schema with exactly these fields: schemaVersion, facts, estimatedImpacts, uncertainties, portfolioConsequences, recommendations.`,
  "Keep each narrative field at or below 500 characters.",
].join(" ");

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type AssessmentRecord = Prisma.RiskAssessmentGetPayload<{
  include: {
    incident: {
      include: {
        project: {
          include: {
            creditHoldings: true;
          };
        };
        event: true;
      };
    };
    evidenceRecords: true;
  };
}>;

const assessmentQuery = {
  include: {
    incident: {
      include: {
        project: {
          include: {
            creditHoldings: true,
          },
        },
        event: true,
      },
    },
    evidenceRecords: true,
  },
} satisfies Prisma.RiskAssessmentDefaultArgs;

export type AIProviderResponse = {
  text: string;
  rawResponse: unknown;
};

export interface AIProvider {
  generate(
    input: AIReportInput,
    systemPrompt: string,
  ): Promise<AIProviderResponse>;
}

export type AIReportResult =
  | {
      status: "PERSISTED";
      assessmentId: string;
      reportId: string;
      idempotent: boolean;
    }
  | {
      status: "UNAVAILABLE";
      assessmentId: string;
      reason: string;
    };

export class GeminiProvider implements AIProvider {
  async generate(
    input: AIReportInput,
    systemPrompt: string,
  ): Promise<AIProviderResponse> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("Gemini API key is not configured");

    const model = process.env.AI_MODEL_ID?.trim() || "gemini-1.5-flash";
    const timeoutMs = 10_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: "user",
                parts: [{ text: JSON.stringify(input) }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed with HTTP ${response.status}`);
      }

      const rawResponse: unknown = await response.json();
      const text = extractGeminiText(rawResponse);
      return { text, rawResponse };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Gemini request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractGeminiText(rawResponse: unknown): string {
  if (!rawResponse || typeof rawResponse !== "object") {
    throw new Error("Gemini response was not an object");
  }
  const candidate = rawResponse as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const text = candidate.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Gemini response did not contain report content");
  }
  return text;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    JSON.stringify(value);
    return value as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function buildAIReportInput(record: AssessmentRecord): AIReportInput {
  const { incident } = record;
  const { project, event } = incident;
  const evidenceLabel = record.evidenceRecords[0]?.label ?? "ESTIMATED";
  const input = {
    schemaVersion: AI_INPUT_SCHEMA_VERSION,
    incident: {
      id: incident.id,
      projectId: incident.projectId,
      projectName: project.name,
      eventId: incident.eventId,
      eventType: event.type,
    },
    event: {
      id: event.id,
      type: event.type,
      sourceName: event.sourceName,
      sourceId: event.sourceId,
      sourceInstrument: event.sourceInstrument,
      observedAt: iso(event.observedAt),
      acquiredAt: event.acquiredAt.toISOString(),
      sourceConfidence: event.sourceConfidence,
      dataVersion: event.dataVersion,
      originType: event.originType,
      createdByType: event.createdByType,
    },
    assessment: {
      id: record.id,
      engineVersion: record.engineVersion,
      methodologyVersion: record.methodologyVersion,
      estimatedImpactHa: record.estimatedImpactHa,
      impactPct: record.impactPct,
      projectHa: record.assumptions && typeof record.assumptions === "object" && !Array.isArray(record.assumptions)
        ? typeof (record.assumptions as { projectAreaHa?: unknown }).projectAreaHa === "number"
          ? (record.assumptions as { projectAreaHa: number }).projectAreaHa
          : null
        : null,
      creditExposure: record.creditExposure,
      financialExposure: record.financialExposureEst,
      financialCurrency: record.financialCurrency,
      integrityRisk: record.integrityRisk,
      evidenceConfidence: record.evidenceConfidence,
      evidenceConfidenceScore: record.evidenceConfidenceScore,
      auditPriority: record.auditPriority,
      uncertaintyNotes: record.uncertaintyNotes,
      evidenceLabel,
      sourceName: event.sourceName,
      observedAt: iso(event.observedAt),
      createdByType: record.createdByType,
    },
    holdings: project.creditHoldings.map((holding) => ({
      id: holding.id,
      heldQuantity: holding.heldQuantity,
      refValuePerUnit: holding.refValuePerUnit,
      refCurrency: holding.refCurrency,
      valuationBasis: holding.valuationBasis,
      status: holding.status,
    })),
    evidence: record.evidenceRecords.map((evidence) => ({
      id: evidence.id,
      label: evidence.label,
      createdByType: evidence.createdByType,
      sourceConfidence: evidence.sourceConfidence,
      notes: evidence.notes,
    })),
  };

  return aiReportInputSchema.parse(input);
}

function extractNumericClaims(output: AIReportOutput): number[] {
  const text = [
    output.facts,
    output.estimatedImpacts,
    output.uncertainties,
    output.portfolioConsequences,
    output.recommendations,
  ].join(" ");
  const matches = text.match(/(?<![A-Za-z0-9_])[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?/g) ?? [];
  return matches.map((match) => Number(match.replace(/,/g, "").replace(/%$/, "")));
}

function authoritativeNumbers(input: AIReportInput): number[] {
  const values: number[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(input);
  return values;
}

export function assertNumericClaimsMatch(
  output: AIReportOutput,
  input: AIReportInput,
): void {
  const allowed = authoritativeNumbers(input);
  const claims = extractNumericClaims(output);
  for (const claim of claims) {
    const rawMatch = allowed.some((value) => Math.abs(value - claim) <= 0.01);
    const percentageMatch = allowed.some(
      (value) => Math.abs(value - claim / 100) <= 0.01,
    );
    if (!rawMatch && !percentageMatch) {
      throw new Error("AI output contains a numeric claim not present in the assessment");
    }
  }
}

function parseProviderOutput(text: string): AIReportOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI response was not valid JSON");
  }
  return aiReportOutputSchema.parse(parsed);
}

function safeFailureReason(error: unknown): string {
  if (error instanceof z.ZodError) return "AI response failed schema validation";
  if (error instanceof Error && error.message.includes("numeric claim")) {
    return "AI response failed numeric consistency validation";
  }
  if (error instanceof Error && error.message.includes("timed out")) {
    return "AI provider timed out";
  }
  if (error instanceof Error && error.message.includes("HTTP")) {
    return "AI provider request failed";
  }
  if (error instanceof Error && error.message.includes("not configured")) {
    return "AI provider is not configured";
  }
  return "AI report unavailable";
}

export class AIService {
  private readonly provider: AIProvider;
  private readonly modelId: string;
  private readonly promptVersion: string;
  private readonly clock: () => Date;

  constructor(
    private readonly db: DatabaseClient = prisma,
    provider?: AIProvider,
    options?: {
      modelId?: string;
      promptVersion?: string;
      clock?: () => Date;
    },
  ) {
    this.provider = provider ?? new GeminiProvider();
    this.modelId = options?.modelId ?? process.env.AI_MODEL_ID?.trim() ?? "gemini-1.5-flash";
    this.promptVersion = options?.promptVersion ?? AI_PROMPT_VERSION;
    this.clock = options?.clock ?? (() => new Date());
  }

  async generateForAssessment(assessmentId: string): Promise<AIReportResult> {
    try {
      const existing = await this.db.aIReport.findUnique({
        where: { assessmentId },
        select: { id: true },
      });
      if (existing) {
        return { status: "PERSISTED", assessmentId, reportId: existing.id, idempotent: true };
      }

      const record = await this.db.riskAssessment.findUnique({
        where: { id: assessmentId },
        ...assessmentQuery,
      });
      if (!record) {
        return { status: "UNAVAILABLE", assessmentId, reason: "Assessment not found" };
      }

      const input = buildAIReportInput(record);
      const providerResponse = await this.provider.generate(input, AI_SYSTEM_PROMPT);
      const output = parseProviderOutput(providerResponse.text);
      assertNumericClaimsMatch(output, input);

      const report = await this.db.aIReport.create({
        data: {
          assessmentId,
          modelId: this.modelId,
          promptVersion: this.promptVersion,
          inputSchemaVersion: AI_INPUT_SCHEMA_VERSION,
          outputSchemaVersion: AI_OUTPUT_SCHEMA_VERSION,
          facts: output.facts,
          estimatedImpacts: output.estimatedImpacts,
          uncertainties: output.uncertainties,
          portfolioConsequences: output.portfolioConsequences,
          recommendations: output.recommendations,
          rawResponse: jsonValue(providerResponse.rawResponse),
          createdByType: "AI_GENERATION",
          generatedAt: this.clock(),
        },
        select: { id: true },
      });

      return { status: "PERSISTED", assessmentId, reportId: report.id, idempotent: false };
    } catch (error) {
      const reason = safeFailureReason(error);
      console.error("[AI] report unavailable", { assessmentId, reason });
      return { status: "UNAVAILABLE", assessmentId, reason };
    }
  }
}

export const aiService = new AIService();
