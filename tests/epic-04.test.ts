import assert from "node:assert/strict";
import test from "node:test";

import { IncidentStatus } from "@prisma/client";

import {
  AuditService,
  InvalidTransitionError,
  isAllowedIncidentTransition,
} from "../lib/services/audit";
import { mapIncidentToResponse } from "../lib/services/incidents";
import { incidentResponseSchema } from "../lib/validations/incidents";

test("AuditService allows only the deterministic incident transition graph", () => {
  assert.equal(
    isAllowedIncidentTransition(
      IncidentStatus.EVENT_DETECTED,
      IncidentStatus.UNDER_ASSESSMENT,
    ),
    true,
  );
  assert.equal(
    isAllowedIncidentTransition(
      IncidentStatus.UNDER_ASSESSMENT,
      IncidentStatus.RESOLVED,
    ),
    false,
  );
  assert.equal(
    isAllowedIncidentTransition(
      IncidentStatus.RESOLVED,
      IncidentStatus.REOPENED,
    ),
    true,
  );
});

test("incident creation is deduplicated and records one immutable initial history entry", async () => {
  let incident: { id: string; projectId: string; eventId: string; status: IncidentStatus } | null = null;
  let historyCount = 0;
  const tx = {
    incident: {
      upsert: async () => {
        if (incident) return incident;
        incident = {
          id: "incident-1",
          projectId: "project-1",
          eventId: "event-1",
          status: IncidentStatus.EVENT_DETECTED,
        };
        historyCount += 1;
        return incident;
      },
    },
    incidentStatusHistory: { create: async () => ({ id: `history-${historyCount + 1}` }) },
  };
  const audit = new AuditService(tx as never);

  const first = await audit.createIncidentAtDetectionInTransaction(
    tx as never,
    "event-1",
    "project-1",
  );
  const second = await audit.createIncidentAtDetectionInTransaction(
    tx as never,
    "event-1",
    "project-1",
  );

  assert.equal(first.id, second.id);
  assert.equal(historyCount, 1);
});

test("AuditService records valid transitions and rejects invalid ones", async () => {
  let status: IncidentStatus = IncidentStatus.EVENT_DETECTED;
  let historyCount = 0;
  const tx = {
    incident: {
      findUnique: async () => ({ id: "incident-1", status }),
      updateMany: async ({ data }: { data: { status: IncidentStatus } }) => {
        status = data.status;
        return { count: 1 };
      },
    },
    incidentStatusHistory: {
      create: async () => {
        historyCount += 1;
        return { id: `history-${historyCount}` };
      },
    },
  };
  const audit = new AuditService(tx as never);

  const transition = await audit.transition(
    "incident-1",
    IncidentStatus.UNDER_ASSESSMENT,
    "system:geospatial",
  );
  assert.equal(transition.fromStatus, IncidentStatus.EVENT_DETECTED);
  assert.equal(transition.createdByType, "SYSTEM_CALCULATION");
  assert.equal(status, IncidentStatus.UNDER_ASSESSMENT);
  assert.equal(historyCount, 1);

  await assert.rejects(
    audit.transition("incident-1", IncidentStatus.RESOLVED, "user:test"),
    InvalidTransitionError,
  );
  assert.equal(status, IncidentStatus.UNDER_ASSESSMENT);
  assert.equal(historyCount, 1);
});

test("failed history write rolls back the status update through the transaction boundary", async () => {
  let status: IncidentStatus = IncidentStatus.EVENT_DETECTED;
  const database = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const before = status;
      try {
        return await callback({
          incident: {
            findUnique: async () => ({ id: "incident-1", status }),
            updateMany: async ({ data }: { data: { status: IncidentStatus } }) => {
              status = data.status;
              return { count: 1 };
            },
          },
          incidentStatusHistory: {
            create: async () => {
              throw new Error("history write failed");
            },
          },
        });
      } catch (error) {
        status = before;
        throw error;
      }
    },
  };

  await assert.rejects(
    new AuditService(database as never).transition(
      "incident-1",
      IncidentStatus.UNDER_ASSESSMENT,
      "system:geospatial",
    ),
    /history write failed/,
  );
  assert.equal(status, IncidentStatus.EVENT_DETECTED);
});

test("incident DTO preserves project/event context, provenance, latest assessment, evidence, and ordered history", () => {
  const dto = mapIncidentToResponse({
    id: "incident-1",
    projectId: "project-1",
    eventId: "event-1",
    status: IncidentStatus.UNDER_ASSESSMENT,
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    updatedAt: new Date("2026-08-23T01:00:00.000Z"),
    project: {
      id: "project-1",
      name: "Project",
      registryId: "REG-1",
      countryCode: "AU",
    },
    event: {
      id: "event-1",
      type: "WILDFIRE",
      sourceName: "NASA FIRMS",
      sourceId: "source-1",
      sourceInstrument: "VIIRS",
      observedAt: new Date("2026-08-22T23:00:00.000Z"),
      acquiredAt: new Date("2026-08-23T00:00:00.000Z"),
      geometry: { type: "Point", coordinates: [151, -33] },
      geomType: "Point",
      sourceConfidence: 0.9,
      sourceMetadata: { instrument: "VIIRS" },
      dataVersion: "v1",
      originType: "OBSERVED",
      createdByType: "EXTERNAL_SOURCE",
    },
    statusHistory: [
      {
        id: "history-1",
        fromStatus: null,
        toStatus: IncidentStatus.EVENT_DETECTED,
        actor: "system:geospatial",
        createdByType: "SYSTEM_CALCULATION",
        reason: "detected",
        evidenceRef: null,
        createdAt: new Date("2026-08-23T00:00:01.000Z"),
      },
      {
        id: "history-2",
        fromStatus: IncidentStatus.EVENT_DETECTED,
        toStatus: IncidentStatus.UNDER_ASSESSMENT,
        actor: "system:geospatial",
        createdByType: "SYSTEM_CALCULATION",
        reason: null,
        evidenceRef: null,
        createdAt: new Date("2026-08-23T00:00:02.000Z"),
      },
    ],
    evidenceRecords: [
      {
        id: "evidence-1",
        label: "ESTIMATED",
        createdByType: "SYSTEM_CALCULATION",
        sourceConfidence: 0.9,
        notes: "buffered FIRMS point",
        createdAt: new Date("2026-08-23T00:00:01.000Z"),
      },
    ],
    assessments: [
      {
        id: "assessment-1",
        boundaryId: "boundary-1",
        engineVersion: "geospatial-v1.0",
        methodologyVersion: "risk-v1.0",
        inputEvidenceIds: ["evidence-1"],
        assumptions: { bufferKm: 1 },
        triggeringActor: "system:geospatial",
        createdByType: "SYSTEM_CALCULATION",
        estimatedImpactHa: 1,
        impactPct: 0.1,
        creditExposure: 10,
        financialExposureEst: 100,
        financialCurrency: "USD",
        valuationBasis: "test",
        integrityRisk: "MEDIUM",
        evidenceConfidence: "MEDIUM",
        evidenceConfidenceScore: 60,
        auditPriority: "ELEVATED",
        uncertaintyNotes: "estimated",
        supersededById: null,
        createdAt: new Date("2026-08-23T00:00:03.000Z"),
        evidenceRecords: [
          {
            id: "evidence-1",
            label: "ESTIMATED",
            createdByType: "SYSTEM_CALCULATION",
            sourceConfidence: 0.9,
            notes: "buffered FIRMS point",
            createdAt: new Date("2026-08-23T00:00:01.000Z"),
          },
        ],
      },
    ],
  } as never);

  const parsed = incidentResponseSchema.parse(dto);
  assert.equal(parsed.latestAssessment?.engineVersion, "geospatial-v1.0");
  assert.equal(parsed.event.originType, "OBSERVED");
  assert.equal(parsed.evidence[0].label, "ESTIMATED");
  assert.deepEqual(
    parsed.statusHistory.map((entry) => entry.toStatus),
    ["EVENT_DETECTED", "UNDER_ASSESSMENT"],
  );
});
