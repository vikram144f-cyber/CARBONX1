import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../prisma";
import type { IncidentResponse } from "../validations/incidents";
import { NotFoundError } from "./errors";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const incidentQuery = {
  include: {
    project: {
      select: {
        id: true,
        name: true,
        registryId: true,
        countryCode: true,
        centroidLng: true,
        centroidLat: true,
        boundaries: {
          where: { isCurrent: true },
          orderBy: [{ version: "desc" as const }, { createdAt: "desc" as const }],
          take: 1,
          select: {
            id: true,
            version: true,
            geojson: true,
            source: true,
            sourceUrl: true,
            quality: true,
            verifiedAt: true,
            areaHa: true,
            isCurrent: true,
          },
        },
      },
    },
    event: {
      select: {
        id: true,
        type: true,
        sourceName: true,
        sourceId: true,
        sourceInstrument: true,
        observedAt: true,
        acquiredAt: true,
        geometry: true,
        geomType: true,
        sourceConfidence: true,
        sourceMetadata: true,
        dataVersion: true,
        originType: true,
        createdByType: true,
      },
    },
    statusHistory: {
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    },
    evidenceRecords: {
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
      select: {
        id: true,
        label: true,
        createdByType: true,
        sourceConfidence: true,
        notes: true,
        createdAt: true,
      },
    },
    anchors: {
      orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
      select: {
        id: true,
        eventType: true,
        status: true,
        txHash: true,
        network: true,
        contractAddress: true,
        confirmedAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    assessments: {
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
      take: 1,
      include: {
        aiReport: {
          select: {
            id: true,
            modelId: true,
            promptVersion: true,
            inputSchemaVersion: true,
            outputSchemaVersion: true,
            facts: true,
            estimatedImpacts: true,
            uncertainties: true,
            portfolioConsequences: true,
            recommendations: true,
            createdByType: true,
            generatedAt: true,
          },
        },
        evidenceRecords: {
          orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
          select: {
            id: true,
            label: true,
            createdByType: true,
            sourceConfidence: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    },
  },
} satisfies Prisma.IncidentDefaultArgs;

type IncidentRecord = Prisma.IncidentGetPayload<typeof incidentQuery>;

function iso(date: Date): string {
  return date.toISOString();
}

function mapEvidence(record: IncidentRecord["evidenceRecords"][number]) {
  return {
    id: record.id,
    label: record.label,
    createdByType: record.createdByType,
    sourceConfidence: record.sourceConfidence,
    notes: record.notes,
    createdAt: iso(record.createdAt),
  };
}

export function mapIncidentToResponse(
  incident: IncidentRecord,
): IncidentResponse {
  const latestAssessment = incident.assessments[0] ?? null;

  return {
    id: incident.id,
    projectId: incident.projectId,
    eventId: incident.eventId,
    status: incident.status,
    createdAt: iso(incident.createdAt),
    updatedAt: iso(incident.updatedAt),
    project: {
      id: incident.project.id,
      name: incident.project.name,
      registryId: incident.project.registryId,
      countryCode: incident.project.countryCode,
      centroidLng: incident.project.centroidLng,
      centroidLat: incident.project.centroidLat,
      currentBoundary: incident.project.boundaries?.[0]
        ? {
            ...incident.project.boundaries[0],
            verifiedAt: incident.project.boundaries[0].verifiedAt
              ? iso(incident.project.boundaries[0].verifiedAt)
              : null,
          }
        : null,
    },
    event: {
      ...incident.event,
      observedAt: incident.event.observedAt
        ? iso(incident.event.observedAt)
        : null,
      acquiredAt: iso(incident.event.acquiredAt),
    },
    latestAssessment: latestAssessment
      ? {
          id: latestAssessment.id,
          boundaryId: latestAssessment.boundaryId,
          engineVersion: latestAssessment.engineVersion,
          methodologyVersion: latestAssessment.methodologyVersion,
          inputEvidenceIds: latestAssessment.inputEvidenceIds,
          assumptions: latestAssessment.assumptions,
          triggeringActor: latestAssessment.triggeringActor,
          createdByType: latestAssessment.createdByType,
          estimatedImpactHa: latestAssessment.estimatedImpactHa,
          impactPct: latestAssessment.impactPct,
          creditExposure: latestAssessment.creditExposure,
          financialExposureEst: latestAssessment.financialExposureEst,
          financialCurrency: latestAssessment.financialCurrency,
          valuationBasis: latestAssessment.valuationBasis,
          integrityRisk: latestAssessment.integrityRisk,
          evidenceConfidence: latestAssessment.evidenceConfidence,
          evidenceConfidenceScore: latestAssessment.evidenceConfidenceScore,
          auditPriority: latestAssessment.auditPriority,
          uncertaintyNotes: latestAssessment.uncertaintyNotes,
          supersededById: latestAssessment.supersededById,
          createdAt: iso(latestAssessment.createdAt),
          aiReport: latestAssessment.aiReport
            ? {
                id: latestAssessment.aiReport.id,
                modelId: latestAssessment.aiReport.modelId,
                promptVersion: latestAssessment.aiReport.promptVersion,
                inputSchemaVersion: latestAssessment.aiReport.inputSchemaVersion,
                outputSchemaVersion: latestAssessment.aiReport.outputSchemaVersion,
                facts: latestAssessment.aiReport.facts,
                estimatedImpacts: latestAssessment.aiReport.estimatedImpacts,
                uncertainties: latestAssessment.aiReport.uncertainties,
                portfolioConsequences: latestAssessment.aiReport.portfolioConsequences,
                recommendations: latestAssessment.aiReport.recommendations,
                createdByType: latestAssessment.aiReport.createdByType,
                generatedAt: iso(latestAssessment.aiReport.generatedAt),
              }
            : null,
          evidence: latestAssessment.evidenceRecords.map(mapEvidence),
        }
      : null,
    evidence: incident.evidenceRecords.map(mapEvidence),
    anchors: (incident.anchors ?? []).map((anchor) => ({
      id: anchor.id,
      eventType: anchor.eventType,
      status: anchor.status,
      txHash: anchor.txHash,
      network: anchor.network,
      contractAddress: anchor.contractAddress,
      confirmedAt: anchor.confirmedAt ? iso(anchor.confirmedAt) : null,
      failureReason: anchor.failureReason,
      createdAt: iso(anchor.createdAt),
      updatedAt: iso(anchor.updatedAt),
    })),
    statusHistory: incident.statusHistory.map((history) => ({
      id: history.id,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      actor: history.actor,
      createdByType: history.createdByType,
      reason: history.reason,
      evidenceRef: history.evidenceRef,
      createdAt: iso(history.createdAt),
    })),
  };
}

export class IncidentService {
  constructor(private readonly db: DatabaseClient = prisma) {}

  async getById(incidentId: string): Promise<IncidentResponse> {
    const incident = await this.db.incident.findUnique({
      where: { id: incidentId },
      ...incidentQuery,
    });
    if (!incident) throw new NotFoundError("Incident not found");
    return mapIncidentToResponse(incident);
  }
}
