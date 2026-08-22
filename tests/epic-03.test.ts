import assert from "node:assert/strict";
import test from "node:test";

import {
  BoundaryQuality,
  ConfidenceLevel,
  EvidenceLabel,
  RiskLevel,
} from "@prisma/client";
import { point, polygon } from "@turf/turf";

import {
  calculateBufferedOverlap,
  GeospatialRiskService,
} from "../lib/services/geospatial";
import {
  aggregateExposure,
  assignAuditPriority,
  calculateFreshnessHours,
  classifyIntegrityRisk,
  scoreEvidenceConfidence,
} from "../lib/services/risk-engine";
import { Epic03GeospatialProcessorSeam } from "../lib/services/event-processing";

const square = polygon([
  [
    [-0.01, -0.01],
    [-0.01, 0.01],
    [0.01, 0.01],
    [0.01, -0.01],
    [-0.01, -0.01],
  ],
]);

test("buffered overlap handles no overlap, edge overlap, and inside overlap", () => {
  const outside = calculateBufferedOverlap(point([1, 1]), square, 1);
  const edge = calculateBufferedOverlap(point([0.018, 0]), square, 1);
  const inside = calculateBufferedOverlap(point([0, 0]), square, 1);

  assert.equal(outside, null);
  assert.ok(edge && edge.overlapHa > 0);
  assert.ok(inside && inside.overlapHa > edge.overlapHa);
});

test("buffered overlap area is deterministic", () => {
  const first = calculateBufferedOverlap(point([0.018, 0]), square, 1);
  const second = calculateBufferedOverlap(point([0.018, 0]), square, 1);
  assert.ok(first && second);
  assert.equal(first.overlapHa, second.overlapHa);
});

test("risk thresholds map at every boundary", () => {
  assert.equal(classifyIntegrityRisk(0.049999), RiskLevel.LOW);
  assert.equal(classifyIntegrityRisk(0.05), RiskLevel.MEDIUM);
  assert.equal(classifyIntegrityRisk(0.199999), RiskLevel.MEDIUM);
  assert.equal(classifyIntegrityRisk(0.2), RiskLevel.HIGH);
  assert.equal(classifyIntegrityRisk(0.499999), RiskLevel.HIGH);
  assert.equal(classifyIntegrityRisk(0.5), RiskLevel.CRITICAL);
});

test("multiple holdings aggregate exposure without inventing missing holdings", () => {
  const result = aggregateExposure(
    [
      {
        heldQuantity: 100,
        refValuePerUnit: 12,
        refCurrency: "USD",
        valuationBasis: "book",
      },
      {
        heldQuantity: 50,
        refValuePerUnit: 20,
        refCurrency: "USD",
        valuationBasis: "book",
      },
    ],
    0.1,
  );
  assert.equal(result.heldQuantity, 150);
  assert.equal(result.creditExposure, 15);
  assert.equal(result.financialExposureEst, 220);
  assert.deepEqual(aggregateExposure([], 0.1), {
    heldQuantity: null,
    creditExposure: null,
    financialExposureEst: null,
    financialCurrency: null,
    valuationBasis: null,
  });
});

test("confidence scoring handles missing source confidence and maps all levels", () => {
  const low = scoreEvidenceConfidence({
    sourceConfidence: null,
    freshnessHours: null,
    boundaryQuality: BoundaryQuality.UNKNOWN,
    evidenceLabel: EvidenceLabel.ESTIMATED,
  });
  const medium = scoreEvidenceConfidence({
    sourceConfidence: 0.8,
    freshnessHours: 48,
    boundaryQuality: BoundaryQuality.MEDIUM,
    evidenceLabel: EvidenceLabel.ESTIMATED,
  });
  const high = scoreEvidenceConfidence({
    sourceConfidence: 1,
    freshnessHours: 1,
    boundaryQuality: BoundaryQuality.HIGH,
    evidenceLabel: EvidenceLabel.OBSERVED,
  });
  assert.equal(low.level, ConfidenceLevel.LOW);
  assert.equal(medium.level, ConfidenceLevel.MEDIUM);
  assert.equal(high.level, ConfidenceLevel.HIGH);
});

test("audit priority matrix is deterministic", () => {
  assert.equal(
    assignAuditPriority(RiskLevel.CRITICAL, ConfidenceLevel.HIGH),
    "URGENT",
  );
  assert.equal(
    assignAuditPriority(RiskLevel.HIGH, ConfidenceLevel.LOW),
    "ELEVATED",
  );
  assert.equal(
    assignAuditPriority(RiskLevel.LOW, ConfidenceLevel.LOW),
    "ELEVATED",
  );
  assert.equal(
    assignAuditPriority(RiskLevel.LOW, ConfidenceLevel.HIGH),
    "ROUTINE",
  );
});

test("freshness and zero-area inputs are safe", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(calculateFreshnessHours(null, now), null);
  assert.equal(
    calculateFreshnessHours(new Date("2025-12-31T00:00:00Z"), now),
    24,
  );
  assert.equal(calculateBufferedOverlap(point([0, 0]), square, 0), null);
});

test("replay uses the Epic 03 processing seam", async () => {
  let processedEventId = "";
  const seam = new Epic03GeospatialProcessorSeam({
    processEvent: async (eventId) => {
      processedEventId = eventId;
      return {
        status: "NO_OVERLAP",
        eventId,
        bufferKm: 1,
        assessments: [],
        skippedBoundaries: 0,
        lifecycleHandoff: "EPIC_04_ACTIVE",
      };
    },
  });
  const result = await seam.process("replayed-event");
  assert.equal(processedEventId, "replayed-event");
  assert.equal(result.status, "NO_OVERLAP");
});

test("repeat processing returns the existing assessment idempotently", async () => {
  let incident: { id: string; status: string } | null = null;
  let historyCount = 0;
  let assessment: {
    id: string;
    incidentId: string;
    boundaryId: string;
    impactPct: number;
    estimatedImpactHa: number;
    integrityRisk: RiskLevel;
    evidenceConfidence: ConfidenceLevel;
    auditPriority: string;
  } | null = null;
  const fakeDb = {
    environmentalEvent: {
      findUnique: async () => ({
        id: "event-1",
        geometry: { type: "Point", coordinates: [0, 0] },
        observedAt: new Date("2026-01-01T00:00:00Z"),
        sourceConfidence: 0.8,
        originType: "OBSERVED",
      }),
    },
    projectBoundary: {
      findMany: async () => [
        {
          id: "boundary-1",
          projectId: "project-1",
          geojson: square,
          areaHa: 10,
          quality: BoundaryQuality.HIGH,
          project: { creditHoldings: [] },
        },
      ],
    },
    $transaction: async (callback: (transaction: any) => Promise<unknown>) =>
      callback({
        incident: {
          findUnique: async () => incident,
          upsert: async () => {
            if (incident) return incident;
            incident = { id: "incident-1", status: "EVENT_DETECTED" };
            historyCount += 1;
            return incident;
          },
          updateMany: async ({ data }: { data: { status: string } }) => {
            if (incident) incident.status = data.status;
            return { count: 1 };
          },
        },
        incidentStatusHistory: {
          create: async () => {
            historyCount += 1;
            return { id: `history-${historyCount}` };
          },
        },
        riskAssessment: {
          findFirst: async () => assessment,
          create: async () => {
            assessment = {
              id: "assessment-1",
              incidentId: "incident-1",
              boundaryId: "boundary-1",
              impactPct: 0.1,
              estimatedImpactHa: 1,
              integrityRisk: RiskLevel.MEDIUM,
              evidenceConfidence: ConfidenceLevel.MEDIUM,
              auditPriority: "ELEVATED",
            };
            return assessment;
          },
        },
        evidenceRecord: { create: async () => ({ id: "evidence-1" }) },
      }),
  };
  const service = new GeospatialRiskService(fakeDb as never, () => new Date("2026-01-02T00:00:00Z"));

  const first = await service.processEvent("event-1");
  const second = await service.processEvent("event-1");
  assert.equal(first.status, "COMPLETED");
  assert.equal(second.status, "COMPLETED");
  if (first.status === "COMPLETED" && second.status === "COMPLETED") {
    assert.equal(first.assessments[0].idempotent, false);
    assert.equal(second.assessments[0].idempotent, true);
    assert.equal((incident as { status: string } | null)?.status, "UNDER_ASSESSMENT");
    assert.equal(historyCount, 2);
  }
});
