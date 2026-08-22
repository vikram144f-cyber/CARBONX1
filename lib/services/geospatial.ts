import "server-only";

import {
  AnchorEventType,
  BoundaryQuality,
  CreatedByType,
  EvidenceLabel,
  EventOriginType,
  IncidentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { area, buffer, intersect, point } from "@turf/turf";
import type { Feature, MultiPolygon, Point, Polygon } from "geojson";

import { prisma } from "../prisma";
import { AuditService } from "./audit";
import { aiService, type AIService } from "./ai-service";
import { blockchainService, type BlockchainService } from "./blockchain";
import {
  assignAuditPriority,
  aggregateExposure,
  calculateFreshnessHours,
  classifyIntegrityRisk,
  GEOSPATIAL_ENGINE_VERSION,
  RISK_METHODOLOGY_VERSION,
  scoreEvidenceConfidence,
} from "./risk-engine";

type BoundaryFeature = Feature<Polygon | MultiPolygon>;
type PointFeature = Feature<Point>;

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function isPrismaClient(db: DatabaseClient): db is PrismaClient {
  return "$transaction" in db;
}

export type GeospatialAssessmentSummary = {
  assessmentId: string;
  incidentId: string;
  projectId: string;
  boundaryId: string;
  overlapHa: number;
  impactPct: number;
  integrityRisk: string;
  evidenceConfidence: string;
  auditPriority: string;
  idempotent: boolean;
};

export type GeospatialProcessingResult =
  | {
      status: "COMPLETED";
      eventId: string;
      bufferKm: number;
      assessments: GeospatialAssessmentSummary[];
      skippedBoundaries: number;
      lifecycleHandoff: "EPIC_04_ACTIVE";
    }
  | {
      status: "NO_OVERLAP";
      eventId: string;
      bufferKm: number;
      assessments: [];
      skippedBoundaries: number;
      lifecycleHandoff: "EPIC_04_ACTIVE";
    }
  | {
      status: "INVALID_EVENT_GEOMETRY";
      eventId: string;
      bufferKm: number;
      assessments: [];
      skippedBoundaries: number;
      lifecycleHandoff: "EPIC_04_ACTIVE";
    }
  | {
      status: "FAILED";
      eventId: string;
      bufferKm: number;
      reason: string;
    };

type OverlapInput = {
  boundaryId: string;
  projectId: string;
  projectAreaHa: number;
  overlapHa: number;
  impactPct: number;
  boundaryQuality: BoundaryQuality;
  holdings: Array<{
    id: string;
    heldQuantity: number;
    refValuePerUnit: number;
    refCurrency: string;
    valuationBasis: string;
  }>;
  intersection: unknown;
};

function bufferRadiusKm(): number {
  const configured = Number(process.env.FIRMS_POINT_BUFFER_KM);
  return Number.isFinite(configured) && configured > 0 ? configured : 1;
}

function asPointFeature(value: Prisma.JsonValue): PointFeature | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (
    candidate.type !== "Point" ||
    !Array.isArray(candidate.coordinates) ||
    candidate.coordinates.length < 2 ||
    !candidate.coordinates.every(
      (coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  ) {
    return null;
  }
  const [lng, lat] = candidate.coordinates;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return point([lng, lat]) as unknown as PointFeature;
}

function asBoundaryFeature(value: Prisma.JsonValue): BoundaryFeature | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as {
    type?: unknown;
    geometry?: { type?: unknown; coordinates?: unknown } | null;
    coordinates?: unknown;
  };
  const geometry = candidate.type === "Feature" ? candidate.geometry : candidate;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
    return null;
  }
  return {
    type: "Feature",
    properties: null,
    geometry: geometry as Polygon | MultiPolygon,
  };
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function calculateBufferedOverlap(
  eventPoint: PointFeature,
  boundaryFeature: BoundaryFeature,
  bufferKm: number,
): { overlapHa: number; intersection: unknown } | null {
  const bufferedPoint = buffer(eventPoint, bufferKm, { units: "kilometers" });
  if (!bufferedPoint) return null;
  const intersection = intersect(bufferedPoint, boundaryFeature);
  if (!intersection) return null;
  const overlapHa = area(intersection) / 10_000;
  return Number.isFinite(overlapHa) && overlapHa > 0
    ? { overlapHa, intersection }
    : null;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "geospatial processing failed";
}

export class GeospatialRiskService {
  constructor(
    private readonly db: DatabaseClient = prisma,
    private readonly clock: () => Date = () => new Date(),
    private readonly blockchain: Pick<
      BlockchainService,
      "anchorIncidentTransition"
    > = blockchainService,
    private readonly ai: Pick<AIService, "generateForAssessment"> = aiService,
  ) {}

  async processEvent(eventId: string): Promise<GeospatialProcessingResult> {
    const bufferKm = bufferRadiusKm();
    try {
      const event = await this.db.environmentalEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) {
        return {
          status: "FAILED",
          eventId,
          bufferKm,
          reason: "Environmental event not found",
        };
      }

      const eventPoint = asPointFeature(event.geometry);
      if (!eventPoint) {
        return {
          status: "INVALID_EVENT_GEOMETRY",
          eventId,
          bufferKm,
          assessments: [],
          skippedBoundaries: 0,
          lifecycleHandoff: "EPIC_04_ACTIVE",
        };
      }

      const boundaries = await this.db.projectBoundary.findMany({
        where: { isCurrent: true },
        include: {
          project: {
            include: {
              creditHoldings: {
                where: { status: "ACTIVE" },
                select: {
                  id: true,
                  heldQuantity: true,
                  refValuePerUnit: true,
                  refCurrency: true,
                  valuationBasis: true,
                },
              },
            },
          },
        },
      });

      const overlaps: OverlapInput[] = [];
      let skippedBoundaries = 0;

      // There is intentionally no unbuffered point-in-polygon pre-filter.
      // Evaluating every current boundary cannot create a false negative for
      // an edge overlap within the configured FIRMS point buffer.
      for (const boundary of boundaries) {
        const boundaryFeature = asBoundaryFeature(boundary.geojson);
        if (!boundaryFeature) {
          skippedBoundaries += 1;
          continue;
        }

        const projectAreaHa = boundary.areaHa ?? area(boundaryFeature) / 10_000;
        if (!Number.isFinite(projectAreaHa) || projectAreaHa <= 0) {
          skippedBoundaries += 1;
          continue;
        }

        const overlap = calculateBufferedOverlap(
          eventPoint,
          boundaryFeature,
          bufferKm,
        );
        if (!overlap) continue;

        overlaps.push({
          boundaryId: boundary.id,
          projectId: boundary.projectId,
          projectAreaHa,
          overlapHa: overlap.overlapHa,
          impactPct: overlap.overlapHa / projectAreaHa,
          boundaryQuality: boundary.quality,
          holdings: boundary.project.creditHoldings,
          intersection: overlap.intersection,
        });
      }

      if (overlaps.length === 0) {
        return {
          status: "NO_OVERLAP",
          eventId,
          bufferKm,
          assessments: [],
          skippedBoundaries,
          lifecycleHandoff: "EPIC_04_ACTIVE",
        };
      }

      const persisted = await this.persistAssessments(
        event,
        overlaps,
        bufferKm,
      );
      this.dispatchAIReports(persisted);
      this.dispatchBlockchainAnchors(persisted);
      return {
        status: "COMPLETED",
        eventId,
        bufferKm,
        assessments: persisted,
        skippedBoundaries,
        lifecycleHandoff: "EPIC_04_ACTIVE",
      };
    } catch (error) {
      const reason = safeErrorMessage(error);
      console.error("[Geospatial] processing failed", { eventId, reason });
      return { status: "FAILED", eventId, bufferKm, reason };
    }
  }

  private dispatchBlockchainAnchors(
    assessments: GeospatialAssessmentSummary[],
  ): void {
    if (this.db !== prisma) return;
    for (const assessment of assessments) {
      void this.blockchain
        .anchorIncidentTransition(
          assessment.incidentId,
          AnchorEventType.UNDER_ASSESSMENT,
        )
        .catch(() => {
          console.error("[Geospatial] blockchain anchor dispatch failed");
        });
    }
  }

  private dispatchAIReports(assessments: GeospatialAssessmentSummary[]): void {
    if (this.db !== prisma) return;
    for (const assessment of assessments) {
      void this.ai.generateForAssessment(assessment.assessmentId).catch(() => {
        console.error("[Geospatial] AI report dispatch failed");
      });
    }
  }

  private async persistAssessments(
    event: {
      id: string;
      observedAt: Date | null;
      sourceConfidence: number | null;
      originType: EventOriginType;
    },
    overlaps: OverlapInput[],
    bufferKm: number,
  ): Promise<GeospatialAssessmentSummary[]> {
    const now = this.clock();
    const freshnessHours = calculateFreshnessHours(event.observedAt, now);
    const work = async (tx: Prisma.TransactionClient) => {
      const audit = new AuditService(tx);
      const results: GeospatialAssessmentSummary[] = [];
      for (const overlap of overlaps) {
        const overlapConfidence = scoreEvidenceConfidence({
          sourceConfidence: event.sourceConfidence,
          freshnessHours,
          boundaryQuality: overlap.boundaryQuality,
          evidenceLabel: EvidenceLabel.ESTIMATED,
        });
        const integrityRisk = classifyIntegrityRisk(overlap.impactPct);
        const auditPriority = assignAuditPriority(
          integrityRisk,
          overlapConfidence.level,
        );
        const exposure = aggregateExposure(overlap.holdings, overlap.impactPct);
        const incident = await audit.createIncidentAtDetectionInTransaction(
          tx,
          event.id,
          overlap.projectId,
        );
        const existing = await tx.riskAssessment.findFirst({
          where: {
            incidentId: incident.id,
            boundaryId: overlap.boundaryId,
            engineVersion: GEOSPATIAL_ENGINE_VERSION,
            methodologyVersion: RISK_METHODOLOGY_VERSION,
          },
          select: {
            id: true,
            incidentId: true,
            boundaryId: true,
            impactPct: true,
            estimatedImpactHa: true,
            integrityRisk: true,
            evidenceConfidence: true,
            auditPriority: true,
          },
        });

        if (existing) {
          if (incident.status === IncidentStatus.EVENT_DETECTED) {
            await audit.transition(
              incident.id,
              IncidentStatus.UNDER_ASSESSMENT,
              "system:geospatial",
            );
          }
          results.push({
            assessmentId: existing.id,
            incidentId: existing.incidentId,
            projectId: overlap.projectId,
            boundaryId: existing.boundaryId,
            overlapHa: existing.estimatedImpactHa ?? overlap.overlapHa,
            impactPct: existing.impactPct ?? overlap.impactPct,
            integrityRisk: existing.integrityRisk,
            evidenceConfidence: existing.evidenceConfidence,
            auditPriority: existing.auditPriority,
            idempotent: true,
          });
          continue;
        }

        const evidence = await tx.evidenceRecord.create({
          data: {
            incidentId: incident.id,
            eventId: event.id,
            label: EvidenceLabel.ESTIMATED,
            createdByType: CreatedByType.SYSTEM_CALCULATION,
            sourceConfidence: event.sourceConfidence,
            notes:
              "Estimated impact zone derived from a FIRMS thermal anomaly point buffer; this is not a burned-area measurement.",
          },
          select: { id: true },
        });
        const assessment = await tx.riskAssessment.create({
          data: {
            incidentId: incident.id,
            boundaryId: overlap.boundaryId,
            engineVersion: GEOSPATIAL_ENGINE_VERSION,
            methodologyVersion: RISK_METHODOLOGY_VERSION,
            inputEvidenceIds: [evidence.id],
            assumptions: jsonValue({
              bufferKm,
              sourceConfidence: event.sourceConfidence,
              freshnessHours,
              boundaryQuality: overlap.boundaryQuality,
              projectAreaHa: overlap.projectAreaHa,
              impactPctUnit: "fraction",
              evidenceLabel: EvidenceLabel.ESTIMATED,
              eventOriginType: event.originType,
              holdingSnapshot: overlap.holdings,
              derivedFrom: "FIRMS_POINT_BUFFER",
            }),
            triggeringActor: "system:geospatial",
            createdByType: CreatedByType.SYSTEM_CALCULATION,
            estimatedImpactHa: overlap.overlapHa,
            impactPct: overlap.impactPct,
            creditExposure: exposure.creditExposure,
            financialExposureEst: exposure.financialExposureEst,
            financialCurrency: exposure.financialCurrency,
            valuationBasis: exposure.valuationBasis,
            integrityRisk,
            evidenceConfidence: overlapConfidence.level,
            evidenceConfidenceScore: overlapConfidence.score,
            auditPriority,
            uncertaintyNotes:
              "FIRMS provides a satellite thermal anomaly point. The buffered overlap is an ESTIMATED geographic proxy and must not be presented as exact burned area.",
            evidenceRecords: { connect: { id: evidence.id } },
          },
          select: {
            id: true,
            incidentId: true,
            boundaryId: true,
            impactPct: true,
            estimatedImpactHa: true,
            integrityRisk: true,
            evidenceConfidence: true,
            auditPriority: true,
          },
        });
        if (incident.status === IncidentStatus.EVENT_DETECTED) {
          await audit.transition(
            incident.id,
            IncidentStatus.UNDER_ASSESSMENT,
            "system:geospatial",
          );
        }
        results.push({
          assessmentId: assessment.id,
          incidentId: assessment.incidentId,
          projectId: overlap.projectId,
          boundaryId: assessment.boundaryId,
          overlapHa: assessment.estimatedImpactHa ?? overlap.overlapHa,
          impactPct: assessment.impactPct ?? overlap.impactPct,
          integrityRisk: assessment.integrityRisk,
          evidenceConfidence: assessment.evidenceConfidence,
          auditPriority: assessment.auditPriority,
          idempotent: false,
        });
      }
      return results;
    };

    if (isPrismaClient(this.db)) {
      return this.db.$transaction(work, { maxWait: 10_000, timeout: 30_000 });
    }
    return work(this.db);
  }

}
