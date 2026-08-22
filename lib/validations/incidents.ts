import { z } from "zod";

const jsonValueSchema: z.ZodType<unknown> = z.unknown();

export const incidentIdParamSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

const statusHistorySchema = z.object({
  id: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  actor: z.string(),
  createdByType: z.string(),
  reason: z.string().nullable(),
  evidenceRef: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const evidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdByType: z.string(),
  sourceConfidence: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

const aiReportSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  promptVersion: z.string(),
  inputSchemaVersion: z.string(),
  outputSchemaVersion: z.string(),
  facts: z.string(),
  estimatedImpacts: z.string(),
  uncertainties: z.string(),
  portfolioConsequences: z.string(),
  recommendations: z.string(),
  createdByType: z.string(),
  generatedAt: z.string().datetime(),
});

const anchorSchema = z.object({
  id: z.string(),
  eventType: z.enum(["UNDER_ASSESSMENT", "AUDIT_RECOMMENDED", "RESOLVED"]),
  status: z.enum(["PENDING", "SUBMITTED", "CONFIRMED", "FAILED"]),
  txHash: z.string().nullable(),
  network: z.string(),
  contractAddress: z.string(),
  confirmedAt: z.string().datetime().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  sourceName: z.string(),
  sourceId: z.string().nullable(),
  sourceInstrument: z.string().nullable(),
  observedAt: z.string().datetime().nullable(),
  acquiredAt: z.string().datetime(),
  geometry: jsonValueSchema,
  geomType: z.string(),
  sourceConfidence: z.number().nullable(),
  sourceMetadata: jsonValueSchema.nullable(),
  dataVersion: z.string().nullable(),
  originType: z.string(),
  createdByType: z.string(),
});

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  registryId: z.string().nullable(),
  countryCode: z.string().nullable(),
  centroidLng: z.number().nullable().optional(),
  centroidLat: z.number().nullable().optional(),
  currentBoundary: z
    .object({
      id: z.string(),
      version: z.number().int(),
      geojson: jsonValueSchema,
      source: z.string(),
      sourceUrl: z.string().url().nullable(),
      quality: z.string(),
      verifiedAt: dateTime.nullable(),
      areaHa: z.number().nullable(),
      isCurrent: z.boolean(),
    })
    .nullable()
    .optional(),
});

const assessmentSchema = z.object({
  id: z.string(),
  boundaryId: z.string(),
  engineVersion: z.string(),
  methodologyVersion: z.string(),
  inputEvidenceIds: z.array(z.string()),
  assumptions: jsonValueSchema.nullable(),
  triggeringActor: z.string(),
  createdByType: z.string(),
  estimatedImpactHa: z.number().nullable(),
  impactPct: z.number().nullable(),
  creditExposure: z.number().nullable(),
  financialExposureEst: z.number().nullable(),
  financialCurrency: z.string().nullable(),
  valuationBasis: z.string().nullable(),
  integrityRisk: z.string(),
  evidenceConfidence: z.string(),
  evidenceConfidenceScore: z.number().nullable(),
  auditPriority: z.string(),
  uncertaintyNotes: z.string().nullable(),
  supersededById: z.string().nullable(),
  createdAt: z.string().datetime(),
  aiReport: aiReportSchema.nullable(),
  evidence: z.array(evidenceSchema),
});

export const incidentResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  eventId: z.string(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  project: projectSchema,
  event: eventSchema,
  latestAssessment: assessmentSchema.nullable(),
  evidence: z.array(evidenceSchema),
  anchors: z.array(anchorSchema),
  statusHistory: z.array(statusHistorySchema),
});

export type IncidentResponse = z.infer<typeof incidentResponseSchema>;
