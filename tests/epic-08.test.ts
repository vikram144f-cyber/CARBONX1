import assert from "node:assert/strict";
import test from "node:test";

import { AnchorEventType, CreatedByType, IncidentStatus } from "@prisma/client";

import { AuditService, InvalidTransitionError } from "../lib/services/audit";
import {
  auditActionRequestSchema,
  auditActionResponseSchema,
} from "../lib/validations/audit";

function fakeAuditDb(initialStatus: IncidentStatus = IncidentStatus.UNDER_ASSESSMENT, failHistory = false) {
  let status = initialStatus;
  const history: Array<{
    id: string;
    incidentId: string;
    fromStatus: IncidentStatus | null;
    toStatus: IncidentStatus;
    actor: string;
    createdByType: CreatedByType;
    createdAt: Date;
  }> = [{
    id: "history-detected",
    incidentId: "incident-1",
    fromStatus: IncidentStatus.EVENT_DETECTED,
    toStatus: initialStatus,
    actor: "system:geospatial",
    createdByType: CreatedByType.SYSTEM_CALCULATION,
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
  }];
  let nextHistory = 1;

  const tx = {
    incident: {
      findUnique: async () => ({ id: "incident-1", status }),
      updateMany: async ({ where, data }: { where: { status: IncidentStatus }; data: { status: IncidentStatus } }) => {
        if (where.status !== status) return { count: 0 };
        status = data.status;
        return { count: 1 };
      },
    },
    incidentStatusHistory: {
      findFirst: async () => history.filter((entry) => entry.toStatus === IncidentStatus.AUDIT_RECOMMENDED).at(-1) ?? null,
      create: async ({ data }: { data: Omit<(typeof history)[number], "id" | "createdAt"> }) => {
        if (failHistory) throw new Error("history write failed");
        const entry = { ...data, id: `history-${nextHistory++}`, createdAt: new Date() };
        history.push(entry);
        return { id: entry.id };
      },
    },
    getStatus: () => status,
    getHistory: () => [...history],
    restore: (snapshot: { status: IncidentStatus; history: typeof history }) => {
      status = snapshot.status;
      history.splice(0, history.length, ...snapshot.history);
    },
  };
  return tx;
}

test("audit action request and response are strict and human-provenanced", () => {
  assert.deepEqual(auditActionRequestSchema.parse({ action: "FLAG_FOR_AUDIT" }), {
    action: "FLAG_FOR_AUDIT",
    actor: "human:command-mode",
  });
  assert.equal(auditActionRequestSchema.safeParse({ action: "FLAG_FOR_AUDIT", actor: "system:job" }).success, true);
  assert.deepEqual(
    auditActionResponseSchema.parse({
      action: "FLAG_FOR_AUDIT",
      incidentId: "incident-1",
      fromStatus: "UNDER_ASSESSMENT",
      toStatus: "AUDIT_RECOMMENDED",
      actor: "human:auditor",
      createdByType: "HUMAN_ACTION",
      historyId: "history-1",
      idempotent: false,
    }).createdByType,
    "HUMAN_ACTION",
  );
});

test("flagForAudit transitions once, records HUMAN_ACTION, and is idempotent on duplicate clicks", async () => {
  const db = fakeAuditDb();
  const anchorEvents: AnchorEventType[] = [];
  const audit = new AuditService(db as never, {
    anchorIncidentTransition: async (_incidentId, eventType) => {
      anchorEvents.push(eventType);
      return null;
    },
  });

  const first = await audit.flagForAudit("incident-1", "human:auditor");
  const second = await audit.flagForAudit("incident-1", "human:auditor");

  assert.equal(first.toStatus, IncidentStatus.AUDIT_RECOMMENDED);
  assert.equal(first.createdByType, CreatedByType.HUMAN_ACTION);
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(db.getStatus(), IncidentStatus.AUDIT_RECOMMENDED);
  assert.equal(db.getHistory().length, 2);
  assert.deepEqual(anchorEvents, [AnchorEventType.AUDIT_RECOMMENDED]);
});

test("invalid transitions and system actors are rejected without mutation", async () => {
  const invalidDb = fakeAuditDb(IncidentStatus.EVENT_DETECTED);
  const audit = new AuditService(invalidDb as never, {
    anchorIncidentTransition: async () => null,
  });
  await assert.rejects(
    () => audit.flagForAudit("incident-1", "human:auditor"),
    InvalidTransitionError,
  );
  await assert.rejects(() => audit.flagForAudit("incident-1", "system:job"), /human actor/i);
  assert.equal(invalidDb.getStatus(), IncidentStatus.EVENT_DETECTED);
  assert.equal(invalidDb.getHistory().length, 1);
});

test("history failure is isolated by the transaction boundary and blockchain failure does not reject the action", async () => {
  const failingDb = fakeAuditDb(IncidentStatus.UNDER_ASSESSMENT, true);
  const transactionalDb = {
    ...failingDb,
    $transaction: async (work: (tx: typeof failingDb) => Promise<unknown>) => {
      const snapshot = { status: failingDb.getStatus(), history: failingDb.getHistory() };
      try {
        return await work(failingDb);
      } catch (error) {
        failingDb.restore(snapshot);
        throw error;
      }
    },
  };
  const failingAudit = new AuditService(transactionalDb as never, {
    anchorIncidentTransition: async () => { throw new Error("RPC unavailable"); },
  });
  await assert.rejects(() => failingAudit.flagForAudit("incident-1", "human:auditor"), /history write failed/);
  assert.equal(failingDb.getStatus(), IncidentStatus.UNDER_ASSESSMENT);
  assert.equal(failingDb.getHistory().length, 1);

  const db = fakeAuditDb();
  const audit = new AuditService(db as never, {
    anchorIncidentTransition: async () => { throw new Error("RPC unavailable"); },
  });
  const result = await audit.flagForAudit("incident-1", "human:auditor");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(result.toStatus, IncidentStatus.AUDIT_RECOMMENDED);
  assert.equal(db.getStatus(), IncidentStatus.AUDIT_RECOMMENDED);
});
