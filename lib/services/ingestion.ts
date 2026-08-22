import "server-only";

import {
  CreatedByType,
  EventOriginType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  environmentalEventProcessor,
  type EnvironmentalEventProcessor,
} from "./event-processing";
import { InvalidInputError, NotFoundError } from "./errors";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type ReplayResult = {
  event: {
    id: string;
    sourceId: string | null;
    originType: EventOriginType;
    createdByType: CreatedByType;
    observedAt: Date | null;
    acquiredAt: Date;
  };
  geospatialHandoff: Awaited<
    ReturnType<EnvironmentalEventProcessor["process"]>
  >;
};

export class IngestionService {
  constructor(
    private readonly db: DatabaseClient = prisma,
    private readonly eventProcessor: EnvironmentalEventProcessor =
      environmentalEventProcessor,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async replay(seedEventId: string): Promise<ReplayResult> {
    const seed = await this.db.environmentalEvent.findUnique({
      where: { id: seedEventId },
    });

    if (!seed) {
      throw new NotFoundError("Seed environmental event not found");
    }
    if (seed.originType !== EventOriginType.OBSERVED) {
      throw new InvalidInputError(
        "Only an observed environmental event can be replayed",
      );
    }

    const replayed = await this.db.environmentalEvent.create({
      data: {
        type: seed.type,
        sourceName: seed.sourceName,
        sourceId: seed.id,
        sourceInstrument: seed.sourceInstrument,
        fingerprint: null,
        observedAt: seed.observedAt,
        acquiredAt: this.clock(),
        geometry: seed.geometry as Prisma.InputJsonValue,
        geomType: seed.geomType,
        sourceConfidence: seed.sourceConfidence,
        sourceMetadata: seed.sourceMetadata as Prisma.InputJsonValue,
        dataVersion: seed.dataVersion,
        originType: EventOriginType.REPLAYED,
        createdByType: CreatedByType.REPLAY,
        rawPayload: seed.rawPayload as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        sourceId: true,
        originType: true,
        createdByType: true,
        observedAt: true,
        acquiredAt: true,
      },
    });

    const geospatialHandoff = await this.eventProcessor.process(replayed.id);
    return { event: replayed, geospatialHandoff };
  }
}
