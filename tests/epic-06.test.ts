import assert from "node:assert/strict";
import test from "node:test";

import {
  AnchorEventType,
  AnchorStatus,
  IncidentStatus,
} from "@prisma/client";

import { AuditService } from "../lib/services/audit";
import {
  BlockchainService,
  hashCanonicalEvidence,
  serializeCanonicalEvidence,
  type CanonicalAssessment,
} from "../lib/services/blockchain";

const assessment: CanonicalAssessment = {
  id: "assessment-1",
  incidentId: "incident-1",
  engineVersion: "geospatial-v1.0",
  methodologyVersion: "risk-v1.0",
  integrityRisk: "HIGH",
  evidenceConfidence: "MEDIUM",
  inputEvidenceIds: ["evidence-b", "evidence-a"],
  boundaryId: "boundary-1",
  createdAt: new Date("2026-08-23T00:00:00.000Z"),
};

test("canonical evidence serialization and hashes are deterministic", () => {
  const first = serializeCanonicalEvidence(
    assessment,
    AnchorEventType.UNDER_ASSESSMENT,
  );
  const second = serializeCanonicalEvidence(
    { ...assessment, inputEvidenceIds: ["evidence-a", "evidence-b"] },
    AnchorEventType.UNDER_ASSESSMENT,
  );
  assert.equal(first, second);
  assert.equal(
    hashCanonicalEvidence(assessment, AnchorEventType.UNDER_ASSESSMENT),
    hashCanonicalEvidence(assessment, AnchorEventType.UNDER_ASSESSMENT),
  );
  assert.match(first, /"eventType":"UNDER_ASSESSMENT"/);
});

test("only the exact supported anchor event types are accepted", () => {
  for (const eventType of [
    "UNDER_ASSESSMENT",
    "AUDIT_RECOMMENDED",
    "RESOLVED",
  ]) {
    assert.doesNotThrow(() =>
      hashCanonicalEvidence(assessment, eventType as AnchorEventType),
    );
  }
  assert.throws(() =>
    hashCanonicalEvidence(assessment, "INCIDENT_DETECTED" as AnchorEventType),
  );
});

function makeAnchorDb() {
  let record: any = null;
  let createCount = 0;
  const db = {
    blockchainAnchor: {
      findUnique: async () => record,
      create: async ({ data }: { data: any }) => {
        createCount += 1;
        record = {
          id: "anchor-1",
          ...data,
          txHash: null,
          confirmedAt: null,
          failureReason: data.failureReason ?? null,
        };
        return record;
      },
      update: async ({ data }: { data: any }) => {
        record = { ...record, ...data };
        return record;
      },
    },
  };
  return { db, getRecord: () => record, getCreateCount: () => createCount };
}

test("successful anchoring persists PENDING then CONFIRMED and duplicate calls are idempotent", async () => {
  const state = makeAnchorDb();
  const txHash = `0x${"1".repeat(64)}` as `0x${string}`; // deterministic test transport value only
  const service = new BlockchainService(state.db as never, {
    contractAddress: `0x${"2".repeat(40)}`,
    transport: {
      submit: async () => txHash,
      waitForConfirmation: async () => new Date("2026-08-23T00:01:00.000Z"),
    },
  });

  const first = await service.anchorAssessment(
    assessment,
    AnchorEventType.AUDIT_RECOMMENDED,
  );
  const second = await service.anchorAssessment(
    assessment,
    AnchorEventType.AUDIT_RECOMMENDED,
  );

  assert.equal(first.status, AnchorStatus.CONFIRMED);
  assert.equal(first.txHash, txHash);
  assert.equal(second.anchorId, first.anchorId);
  assert.equal(state.getCreateCount(), 1);
  assert.equal(state.getRecord().status, AnchorStatus.CONFIRMED);
});

test("submission failure is isolated and persisted as FAILED without a fabricated tx hash", async () => {
  const state = makeAnchorDb();
  const service = new BlockchainService(state.db as never, {
    contractAddress: `0x${"3".repeat(40)}`,
    transport: {
      submit: async () => {
        throw new Error("RPC unavailable");
      },
    },
  });

  const result = await service.anchorAssessment(
    assessment,
    AnchorEventType.RESOLVED,
  );
  assert.equal(result.status, AnchorStatus.FAILED);
  assert.equal(result.txHash, null);
  assert.equal(state.getRecord().status, AnchorStatus.FAILED);
  assert.match(state.getRecord().failureReason, /Blockchain submission failed/);
});

test("AuditService dispatches UNDER_ASSESSMENT to the blockchain seam after transition commit", async () => {
  let status: IncidentStatus = IncidentStatus.EVENT_DETECTED;
  let dispatched: { incidentId: string; eventType: string } | null = null;
  const tx = {
    incident: {
      findUnique: async () => ({ id: "incident-1", status }),
      updateMany: async ({ data }: { data: { status: IncidentStatus } }) => {
        status = data.status;
        return { count: 1 };
      },
    },
    incidentStatusHistory: {
      create: async () => ({ id: "history-1" }),
    },
  };
  const dispatcher = {
    anchorIncidentTransition: async (incidentId: string, eventType: string) => {
      dispatched = { incidentId, eventType };
      return null;
    },
  };

  await new AuditService(tx as never, dispatcher).transition(
    "incident-1",
    IncidentStatus.UNDER_ASSESSMENT,
    "system:geospatial",
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(dispatched, {
    incidentId: "incident-1",
    eventType: AnchorEventType.UNDER_ASSESSMENT,
  });
});
