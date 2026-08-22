import { z } from "zod";

const riskLevel = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const dateTime = z.string().datetime();

const projectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  registryId: z.string().nullable(),
  countryCode: z.string().nullable(),
  boundaryQuality: z.string().nullable(),
  areaHa: z.number().nullable(),
  totalHeldQuantity: z.number(),
  holdingCount: z.number().int().nonnegative(),
  activeIncidentCount: z.number().int().nonnegative(),
  risk: riskLevel.nullable(),
  projectState: z.enum(["HEALTHY", "WATCH", "CRITICAL", "UNASSESSED"]),
  latestAssessmentAt: dateTime.nullable(),
});

const incidentSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  eventId: z.string(),
  eventType: z.string(),
  status: z.string(),
  integrityRisk: riskLevel.nullable(),
  evidenceConfidence: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  auditPriority: z.enum(["ROUTINE", "ELEVATED", "URGENT"]).nullable(),
  impactPct: z.number().nullable(),
  estimatedImpactHa: z.number().nullable(),
  creditExposure: z.number().nullable(),
  financialExposureEst: z.number().nullable(),
  createdAt: dateTime,
  updatedAt: dateTime,
});

export const portfolioResponseSchema = z.object({
  portfolio: z
    .object({
      id: z.string(),
      name: z.string(),
      organizationId: z.string(),
    })
    .nullable(),
  summary: z.object({
    totalProjects: z.number().int().nonnegative(),
    totalHeldQuantity: z.number(),
    holdingCount: z.number().int().nonnegative(),
    activeIncidents: z.number().int().nonnegative(),
    totalCreditExposure: z.number(),
    totalFinancialExposureEst: z.number(),
  }),
  riskDistribution: z.object({
    LOW: z.number().int().nonnegative(),
    MEDIUM: z.number().int().nonnegative(),
    HIGH: z.number().int().nonnegative(),
    CRITICAL: z.number().int().nonnegative(),
    UNASSESSED: z.number().int().nonnegative(),
  }),
  projects: z.array(projectSummarySchema),
  activeIncidents: z.array(incidentSummarySchema),
});

const boundarySchema = z.object({
  id: z.string(),
  version: z.number().int(),
  source: z.string(),
  sourceUrl: z.string().url().nullable(),
  quality: z.string(),
  verifiedAt: dateTime.nullable(),
  areaHa: z.number().nullable(),
  isCurrent: z.boolean(),
});

const holdingSchema = z.object({
  id: z.string(),
  vintage: z.number().int().nullable(),
  registrySerialRef: z.string().nullable(),
  issuedQuantity: z.number(),
  heldQuantity: z.number(),
  status: z.string(),
  refValuePerUnit: z.number(),
  refCurrency: z.string(),
  valuationBasis: z.string(),
});

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  registryId: z.string().nullable(),
  methodology: z.string().nullable(),
  countryCode: z.string().nullable(),
  centroidLng: z.number(),
  centroidLat: z.number(),
  boundaries: z.array(boundarySchema),
  holdingSummary: z.object({
    heldQuantity: z.number(),
    referenceValue: z.number(),
    holdingCount: z.number().int().nonnegative(),
  }),
  holdings: z.array(holdingSchema),
  incidents: z.array(incidentSummarySchema),
});

export const projectIdParamSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

export type PortfolioResponse = z.infer<typeof portfolioResponseSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
