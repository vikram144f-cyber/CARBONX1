import { z } from "zod";

export const AI_INPUT_SCHEMA_VERSION = "ai-input-v1.0" as const;
export const AI_OUTPUT_SCHEMA_VERSION = "ai-output-v1.0" as const;

const finiteNumber = z.number().finite();

export const aiReportInputSchema = z
  .object({
    schemaVersion: z.literal(AI_INPUT_SCHEMA_VERSION),
    incident: z
      .object({
        id: z.string(),
        projectId: z.string(),
        projectName: z.string(),
        eventId: z.string(),
        eventType: z.string(),
      })
      .strict(),
    event: z
      .object({
        id: z.string(),
        type: z.string(),
        sourceName: z.string(),
        sourceId: z.string().nullable(),
        sourceInstrument: z.string().nullable(),
        observedAt: z.string().datetime().nullable(),
        acquiredAt: z.string().datetime(),
        sourceConfidence: finiteNumber.nullable(),
        dataVersion: z.string().nullable(),
        originType: z.string(),
        createdByType: z.string(),
      })
      .strict(),
    assessment: z
      .object({
        id: z.string(),
        engineVersion: z.string(),
        methodologyVersion: z.string(),
        estimatedImpactHa: finiteNumber.nullable(),
        impactPct: finiteNumber.nullable(),
        projectHa: finiteNumber.nullable(),
        creditExposure: finiteNumber.nullable(),
        financialExposure: finiteNumber.nullable(),
        financialCurrency: z.string().nullable(),
        integrityRisk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        evidenceConfidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
        evidenceConfidenceScore: finiteNumber.nullable(),
        auditPriority: z.enum(["ROUTINE", "ELEVATED", "URGENT"]),
        uncertaintyNotes: z.string().nullable(),
        evidenceLabel: z.enum(["OBSERVED", "ESTIMATED", "MODELED", "INFERRED"]),
        sourceName: z.string(),
        observedAt: z.string().datetime().nullable(),
        createdByType: z.string(),
      })
      .strict(),
    holdings: z
      .array(
        z
          .object({
            id: z.string(),
            heldQuantity: finiteNumber,
            refValuePerUnit: finiteNumber,
            refCurrency: z.string(),
            valuationBasis: z.string(),
            status: z.string(),
          })
          .strict(),
      )
      .max(1000),
    evidence: z
      .array(
        z
          .object({
            id: z.string(),
            label: z.enum(["OBSERVED", "ESTIMATED", "MODELED", "INFERRED"]),
            createdByType: z.string(),
            sourceConfidence: finiteNumber.nullable(),
            notes: z.string().nullable(),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();

export type AIReportInput = z.infer<typeof aiReportInputSchema>;

export const aiReportOutputSchema = z
  .object({
    schemaVersion: z.literal(AI_OUTPUT_SCHEMA_VERSION),
    facts: z.string().max(500),
    estimatedImpacts: z.string().max(500),
    uncertainties: z.string().max(500),
    portfolioConsequences: z.string().max(500),
    recommendations: z.string().max(500),
  })
  .strict();

export type AIReportOutput = z.infer<typeof aiReportOutputSchema>;
