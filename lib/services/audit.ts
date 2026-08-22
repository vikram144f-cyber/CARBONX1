import "server-only";

import {
  AnchorEventType,
  CreatedByType,
  IncidentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "../prisma";
import { blockchainService, type BlockchainService } from "./blockchain";
import { ServiceError } from "./errors";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const allowedTransitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  [IncidentStatus.MONITORING]: [IncidentStatus.EVENT_DETECTED],
  [IncidentStatus.EVENT_DETECTED]: [IncidentStatus.UNDER_ASSESSMENT],
  [IncidentStatus.UNDER_ASSESSMENT]: [
    IncidentStatus.AUDIT_RECOMMENDED,
    IncidentStatus.INSUFFICIENT_EVIDENCE,
  ],
  [IncidentStatus.AUDIT_RECOMMENDED]: [
    IncidentStatus.AUDIT_IN_PROGRESS,
    IncidentStatus.INSUFFICIENT_EVIDENCE,
  ],
  [IncidentStatus.AUDIT_IN_PROGRESS]: [
    IncidentStatus.RESOLVED,
    IncidentStatus.INSUFFICIENT_EVIDENCE,
  ],
  [IncidentStatus.INSUFFICIENT_EVIDENCE]: [],
  [IncidentStatus.RESOLVED]: [IncidentStatus.REOPENED],
  [IncidentStatus.REOPENED]: [IncidentStatus.UNDER_ASSESSMENT],
};

function isPrismaClient(db: DatabaseClient): db is PrismaClient {
  return "$transaction" in db;
}

function createdByTypeForActor(actor: string): CreatedByType {
  return actor.trim().toLowerCase().startsWith("system:")
    ? CreatedByType.SYSTEM_CALCULATION
    : CreatedByType.HUMAN_ACTION;
}

export class InvalidTransitionError extends ServiceError {
  constructor(fromStatus: IncidentStatus, toStatus: IncidentStatus) {
    super(
      `Invalid incident transition: ${fromStatus} -> ${toStatus}`,
      "INVALID_TRANSITION",
      409,
    );
  }
}

export type IncidentTransitionResult = {
  incidentId: string;
  fromStatus: IncidentStatus;
  toStatus: IncidentStatus;
  actor: string;
  createdByType: CreatedByType;
  historyId: string;
};

export type AuditFlagResult = IncidentTransitionResult & {
  idempotent: boolean;
};

export class AuditService {
  constructor(
    private readonly db: DatabaseClient = prisma,
    private readonly blockchain: Pick<
      BlockchainService,
      "anchorIncidentTransition"
    > = blockchainService,
  ) {}

  async createIncidentAtDetection(
    eventId: string,
    projectId: string,
  ): Promise<{ id: string; projectId: string; eventId: string; status: IncidentStatus }> {
    const work = (tx: Prisma.TransactionClient) =>
      this.createIncidentAtDetectionInTransaction(tx, eventId, projectId);

    if (isPrismaClient(this.db)) {
      return this.db.$transaction(work, {
        maxWait: 10_000,
        timeout: 30_000,
      });
    }
    return work(this.db);
  }

  async createIncidentAtDetectionInTransaction(
    tx: Prisma.TransactionClient,
    eventId: string,
    projectId: string,
  ) {
    return tx.incident.upsert({
      where: { projectId_eventId: { projectId, eventId } },
      update: {},
      create: {
        projectId,
        eventId,
        status: IncidentStatus.EVENT_DETECTED,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: IncidentStatus.EVENT_DETECTED,
            actor: "system:geospatial",
            createdByType: CreatedByType.SYSTEM_CALCULATION,
            reason: "Environmental event intersected the current project boundary",
          },
        },
      },
      select: { id: true, projectId: true, eventId: true, status: true },
    });
  }

  async transition(
    incidentId: string,
    toStatus: IncidentStatus,
    actor: string,
  ): Promise<IncidentTransitionResult> {
    const normalizedActor = actor.trim();
    if (!normalizedActor) {
      throw new ServiceError("Transition actor is required", "INVALID_ACTOR", 400);
    }

    const work = (tx: Prisma.TransactionClient) =>
      this.transitionInTransaction(tx, incidentId, toStatus, normalizedActor);

    const result = isPrismaClient(this.db)
      ? await this.db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      })
      : await work(this.db);

    this.dispatchBlockchainAnchor(result);
    return result;
  }

  async flagForAudit(
    incidentId: string,
    actor: string,
  ): Promise<AuditFlagResult> {
    const normalizedActor = actor.trim();
    if (!normalizedActor || normalizedActor.toLowerCase().startsWith("system:")) {
      throw new ServiceError(
        "A human actor is required for an audit flag",
        "INVALID_ACTOR",
        400,
      );
    }

    const work = async (tx: Prisma.TransactionClient): Promise<AuditFlagResult> => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { id: true, status: true },
      });
      if (!incident) {
        throw new ServiceError("Incident not found", "NOT_FOUND", 404);
      }

      if (incident.status === IncidentStatus.AUDIT_RECOMMENDED) {
        const history = await tx.incidentStatusHistory.findFirst({
          where: {
            incidentId,
            toStatus: IncidentStatus.AUDIT_RECOMMENDED,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, fromStatus: true, toStatus: true, actor: true, createdByType: true },
        });
        if (!history) {
          throw new ServiceError(
            "Audit recommendation history is missing",
            "INCONSISTENT_STATE",
            409,
          );
        }
        return {
          incidentId,
          fromStatus: history.fromStatus ?? IncidentStatus.UNDER_ASSESSMENT,
          toStatus: history.toStatus,
          actor: history.actor,
          createdByType: history.createdByType,
          historyId: history.id,
          idempotent: true,
        };
      }

      const result = await this.transitionInTransaction(
        tx,
        incidentId,
        IncidentStatus.AUDIT_RECOMMENDED,
        normalizedActor,
      );
      return { ...result, idempotent: false };
    };

    const result = isPrismaClient(this.db)
      ? await this.db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      })
      : await work(this.db);

    if (!result.idempotent) this.dispatchBlockchainAnchor(result);
    return result;
  }

  private dispatchBlockchainAnchor(result: IncidentTransitionResult): void {
    if (this.db !== prisma && this.blockchain === blockchainService) return;
    const eventType =
      result.toStatus === IncidentStatus.UNDER_ASSESSMENT
        ? AnchorEventType.UNDER_ASSESSMENT
        : result.toStatus === IncidentStatus.AUDIT_RECOMMENDED
          ? AnchorEventType.AUDIT_RECOMMENDED
          : result.toStatus === IncidentStatus.RESOLVED
            ? AnchorEventType.RESOLVED
            : null;
    if (!eventType) return;

    void this.blockchain
      .anchorIncidentTransition(result.incidentId, eventType)
      .catch(() => {
        console.error("[Audit] blockchain anchor dispatch failed");
      });
  }

  async transitionInTransaction(
    tx: Prisma.TransactionClient,
    incidentId: string,
    toStatus: IncidentStatus,
    actor: string,
  ): Promise<IncidentTransitionResult> {
    const incident = await tx.incident.findUnique({
      where: { id: incidentId },
      select: { id: true, status: true },
    });
    if (!incident) {
      throw new ServiceError("Incident not found", "NOT_FOUND", 404);
    }

    const permitted = allowedTransitions[incident.status].includes(toStatus);
    if (!permitted) {
      throw new InvalidTransitionError(incident.status, toStatus);
    }

    const updated = await tx.incident.updateMany({
      where: { id: incident.id, status: incident.status },
      data: { status: toStatus },
    });
    if (updated.count !== 1) {
      throw new ServiceError(
        "Incident changed before the transition could be committed",
        "TRANSITION_CONFLICT",
        409,
      );
    }

    const history = await tx.incidentStatusHistory.create({
      data: {
        incidentId: incident.id,
        fromStatus: incident.status,
        toStatus,
        actor,
        createdByType: createdByTypeForActor(actor),
      },
      select: { id: true },
    });

    return {
      incidentId: incident.id,
      fromStatus: incident.status,
      toStatus,
      actor,
      createdByType: createdByTypeForActor(actor),
      historyId: history.id,
    };
  }
}

export function isAllowedIncidentTransition(
  fromStatus: IncidentStatus,
  toStatus: IncidentStatus,
): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}
