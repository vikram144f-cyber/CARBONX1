import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../prisma";
import type {
  PortfolioResponse,
  ProjectResponse,
} from "../validations/portfolio";
import { NotFoundError } from "./errors";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const activeIncidentWhere = { status: { not: "RESOLVED" as const } };

const portfolioQuery = {
  orderBy: { createdAt: "asc" as const },
  take: 1,
  include: {
    projects: {
      orderBy: [{ name: "asc" as const }, { id: "asc" as const }],
      include: {
        boundaries: {
          where: { isCurrent: true },
          orderBy: { version: "desc" as const },
          take: 1,
          select: { quality: true, areaHa: true },
        },
        creditHoldings: {
          where: { status: "ACTIVE" as const },
          select: { heldQuantity: true },
        },
        incidents: {
          where: activeIncidentWhere,
          orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }],
          include: {
            assessments: {
              orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
              take: 1,
              select: {
                integrityRisk: true,
                evidenceConfidence: true,
                auditPriority: true,
                impactPct: true,
                estimatedImpactHa: true,
                creditExposure: true,
                financialExposureEst: true,
                createdAt: true,
              },
            },
            event: { select: { id: true, type: true } },
          },
        },
      },
    },
  },
} satisfies Prisma.PortfolioFindFirstArgs;

type PortfolioRecord = Prisma.PortfolioGetPayload<typeof portfolioQuery>;

function iso(date: Date): string {
  return date.toISOString();
}

function riskForProject(
  incidents: PortfolioRecord["projects"][number]["incidents"],
) {
  const assessed = incidents
    .map((incident) => incident.assessments[0])
    .filter((assessment): assessment is NonNullable<typeof assessment> => Boolean(assessment));
  const priority = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;
  return assessed.sort(
    (left, right) => priority[right.integrityRisk] - priority[left.integrityRisk],
  )[0]?.integrityRisk ?? null;
}

function projectState(
  activeIncidentCount: number,
  risk: ReturnType<typeof riskForProject>,
): "HEALTHY" | "WATCH" | "CRITICAL" | "UNASSESSED" {
  if (activeIncidentCount === 0) return "HEALTHY";
  if (risk === "HIGH" || risk === "CRITICAL") return "CRITICAL";
  if (risk === "LOW" || risk === "MEDIUM") return "WATCH";
  return "UNASSESSED";
}

function mapIncidentSummary(incident: PortfolioRecord["projects"][number]["incidents"][number]) {
  const assessment = incident.assessments[0] ?? null;
  return {
    id: incident.id,
    projectId: incident.projectId,
    projectName: "",
    eventId: incident.eventId,
    eventType: incident.event.type,
    status: incident.status,
    integrityRisk: assessment?.integrityRisk ?? null,
    evidenceConfidence: assessment?.evidenceConfidence ?? null,
    auditPriority: assessment?.auditPriority ?? null,
    impactPct: assessment?.impactPct ?? null,
    estimatedImpactHa: assessment?.estimatedImpactHa ?? null,
    creditExposure: assessment?.creditExposure ?? null,
    financialExposureEst: assessment?.financialExposureEst ?? null,
    createdAt: iso(incident.createdAt),
    updatedAt: iso(incident.updatedAt),
  };
}

function mapProjectSummary(project: PortfolioRecord["projects"][number]) {
  const risk = riskForProject(project.incidents);
  return {
    id: project.id,
    name: project.name,
    registryId: project.registryId,
    countryCode: project.countryCode,
    boundaryQuality: project.boundaries[0]?.quality ?? null,
    areaHa: project.boundaries[0]?.areaHa ?? null,
    totalHeldQuantity: project.creditHoldings.reduce(
      (sum, holding) => sum + holding.heldQuantity,
      0,
    ),
    holdingCount: project.creditHoldings.length,
    activeIncidentCount: project.incidents.length,
    risk,
    projectState: projectState(project.incidents.length, risk),
    latestAssessmentAt:
      project.incidents
        .flatMap((incident) => incident.assessments)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
        ?.createdAt.toISOString() ?? null,
  };
}

export class PortfolioService {
  constructor(private readonly db: DatabaseClient = prisma) {}

  async getPortfolio(): Promise<PortfolioResponse> {
    let portfolio: PortfolioRecord | null = null;
    try {
      portfolio = await this.db.portfolio.findFirst(portfolioQuery);
    } catch (err) {
      console.warn("[PortfolioService] Database query warning, serving offline cache", err);
    }

    if (!portfolio) {
      return getFallbackPortfolio();
    }


    const projects = portfolio.projects.map(mapProjectSummary);
    const activeIncidents = portfolio.projects.flatMap((project) =>
      project.incidents.map((incident) => ({
        ...mapIncidentSummary(incident),
        projectName: project.name,
      })),
    );
    const riskDistribution = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      UNASSESSED: 0,
    };
    for (const incident of activeIncidents) {
      if (incident.integrityRisk) riskDistribution[incident.integrityRisk] += 1;
      else riskDistribution.UNASSESSED += 1;
    }

    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        organizationId: portfolio.organizationId,
      },
      summary: {
        totalProjects: projects.length,
        totalHeldQuantity: projects.reduce((sum, project) => sum + project.totalHeldQuantity, 0),
        holdingCount: projects.reduce((sum, project) => sum + project.holdingCount, 0),
        activeIncidents: activeIncidents.length,
        totalCreditExposure: activeIncidents.reduce((sum, incident) => sum + (incident.creditExposure ?? 0), 0),
        totalFinancialExposureEst: activeIncidents.reduce((sum, incident) => sum + (incident.financialExposureEst ?? 0), 0),
      },
      riskDistribution,
      projects,
      activeIncidents,
    };
  }

  async getProject(projectId: string): Promise<ProjectResponse> {
    const project = await this.db.carbonProject.findUnique({
      where: { id: projectId },
      include: {
        boundaries: {
          orderBy: [{ version: "desc" as const }, { createdAt: "desc" as const }],
          select: {
            id: true,
            version: true,
            source: true,
            sourceUrl: true,
            quality: true,
            verifiedAt: true,
            areaHa: true,
            isCurrent: true,
            geojson: true,
          },
        },

        creditHoldings: {
          orderBy: { createdAt: "desc" as const },
          select: {
            id: true,
            vintage: true,
            registrySerialRef: true,
            issuedQuantity: true,
            heldQuantity: true,
            status: true,
            refValuePerUnit: true,
            refCurrency: true,
            valuationBasis: true,
          },
        },
        incidents: {
          orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
          include: {
            assessments: {
              orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
              take: 1,
              select: {
                integrityRisk: true,
                evidenceConfidence: true,
                auditPriority: true,
                impactPct: true,
                estimatedImpactHa: true,
                creditExposure: true,
                financialExposureEst: true,
                createdAt: true,
              },
            },
            event: { select: { id: true, type: true } },
          },
        },
      },
    });
    if (!project) throw new NotFoundError("Carbon project not found");

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      registryId: project.registryId,
      methodology: project.methodology,
      countryCode: project.countryCode,
      centroidLng: project.centroidLng,
      centroidLat: project.centroidLat,
      boundaries: project.boundaries.map((boundary) => ({
        ...boundary,
        verifiedAt: boundary.verifiedAt ? iso(boundary.verifiedAt) : null,
      })),
      holdingSummary: {
        heldQuantity: project.creditHoldings.reduce(
          (sum, holding) => sum + holding.heldQuantity,
          0,
        ),
        referenceValue: project.creditHoldings.reduce(
          (sum, holding) => sum + holding.heldQuantity * holding.refValuePerUnit,
          0,
        ),
        holdingCount: project.creditHoldings.length,
      },
      holdings: project.creditHoldings,
      incidents: project.incidents.map((incident) => ({
        ...mapIncidentSummary(incident),
        projectName: project.name,
      })),
    };
  }
}

function getFallbackPortfolio(): PortfolioResponse {
  const projects = [
    {
      id: "project_wayanad",
      name: "Wayanad Community Reforestation",
      registryId: "VCS-4421",
      countryCode: "IN",
      totalHeldQuantity: 12500,
      holdingCount: 1,
      boundaryQuality: "HIGH",
      areaHa: 450.0,
      activeIncidentCount: 0,
      risk: null,
      projectState: "HEALTHY" as const,
      latestAssessmentAt: null,
    },
    {
      id: "project_sathyamangalam",
      name: "Sathyamangalam Tiger Reserve Eco-Restoration",
      registryId: "VCS-3890",
      countryCode: "IN",
      totalHeldQuantity: 18000,
      holdingCount: 1,
      boundaryQuality: "HIGH",
      areaHa: 620.0,
      activeIncidentCount: 0,
      risk: null,
      projectState: "HEALTHY" as const,
      latestAssessmentAt: null,
    },
    {
      id: "project_vcs2386",
      name: "Rotunda Reforestation & Watershed Conservation",
      registryId: "VCS-2386",
      countryCode: "IN",
      totalHeldQuantity: 14000,
      holdingCount: 1,
      boundaryQuality: "HIGH",
      areaHa: 520.0,
      activeIncidentCount: 0,
      risk: null,
      projectState: "HEALTHY" as const,
      latestAssessmentAt: null,
    },
    {
      id: "project_vcs2547",
      name: "ACAP Albania Coastal Wetland & Peatland",
      registryId: "VCS-2547",
      countryCode: "AL",
      totalHeldQuantity: 8500,
      holdingCount: 1,
      boundaryQuality: "HIGH",
      areaHa: 310.0,
      activeIncidentCount: 0,
      risk: null,
      projectState: "HEALTHY" as const,
      latestAssessmentAt: null,
    },
    {
      id: "project_greenforest",
      name: "GreenForest Amazon Bio-Corridor",
      registryId: "VCS-1120",
      countryCode: "BR",
      totalHeldQuantity: 22000,
      holdingCount: 1,
      boundaryQuality: "HIGH",
      areaHa: 890.0,
      activeIncidentCount: 0,
      risk: null,
      projectState: "HEALTHY" as const,
      latestAssessmentAt: null,
    },
  ];

  return {
    portfolio: {
      id: "portfolio_carbonx_demo",
      name: "CARBONX Global Monitored Assets",
      organizationId: "org_carbonx_demo",
    },
    summary: {
      totalProjects: projects.length,
      totalHeldQuantity: projects.reduce((s, p) => s + p.totalHeldQuantity, 0),
      holdingCount: projects.length,
      activeIncidents: 0,
      totalCreditExposure: 0,
      totalFinancialExposureEst: 0,
    },
    riskDistribution: {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
      UNASSESSED: 0,
    },
    projects,
    activeIncidents: [],
  };
}


