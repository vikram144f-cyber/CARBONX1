import "server-only";

import {
  CreatedByType,
  EventOriginType,
  EventType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { environmentalEventProcessor } from "./event-processing";
import { parseFirmsCsv } from "./firms-csv";

const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
const CHECKPOINT_SOURCE = `NASA_FIRMS_${FIRMS_SOURCE}`;
const FIRMS_ENDPOINT =
  "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const MAX_LOOKBACK_DAYS = 5;
const MAX_LOOKBACK_HOURS = MAX_LOOKBACK_DAYS * 24;
const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_BBOX_PADDING_KM = 1;

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const scalar = z.union([z.string(), z.number()]).nullable().optional();
const firmsHotspotSchema = z
  .object({
    latitude: z.union([z.string(), z.number()]),
    longitude: z.union([z.string(), z.number()]),
    acq_date: z.string(),
    acq_time: z.union([z.string(), z.number()]),
    instrument: z.string().trim().min(1),
    satellite: scalar,
    confidence: scalar,
    frp: scalar,
    version: scalar,
    daynight: scalar,
    scan: scalar,
    track: scalar,
    bright_ti4: scalar,
    bright_ti5: scalar,
  })
  .passthrough();

type FirmsHotspot = z.infer<typeof firmsHotspotSchema>;

export type ProjectCentroid = {
  centroidLng: number;
  centroidLat: number;
};

export type FirmsBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type IngestionResult =
  | {
      status: "COMPLETED";
      fetched: number;
      normalized: number;
      inserted: number;
      skippedDuplicates: number;
      rejected: number;
      bbox: FirmsBbox;
      checkpoint: Date;
    }
  | { status: "SKIPPED"; reason: "NO_ACTIVE_PROJECTS" }
  | { status: "FAILED"; reason: string; rejected: number };

function finiteCoordinate(value: string | number, name: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${name} is not numeric`);
  }
  return numberValue;
}

function readScalar(value: string | number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value).trim();
}

function parseObservedAt(dateValue: string, timeValue: string | number): Date {
  const date = dateValue.trim();
  const time = String(timeValue).trim().padStart(6, "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{6}$/.test(time)) {
    throw new Error("invalid FIRMS acquisition date or time");
  }

  const observedAt = new Date(
    `${date}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`,
  );
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error("invalid FIRMS acquisition timestamp");
  }
  return observedAt;
}

function confidenceScore(
  value: string | number | null | undefined,
  instrument: string,
): number | null {
  const normalized = readScalar(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "l") return 0.3;
  if (normalized === "n") return 0.6;
  if (normalized === "h") return 0.9;

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  if (instrument.toUpperCase().includes("MODIS")) return numeric / 100;
  return numeric > 1 ? numeric / 100 : numeric;
}

function readPaddingKm(): number {
  const configured = Number(process.env.FIRMS_POINT_BUFFER_KM);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_BBOX_PADDING_KM;
}

export function deriveFirmsBbox(
  projects: ProjectCentroid[],
  paddingKm = readPaddingKm(),
): FirmsBbox | null {
  if (projects.length === 0) return null;

  const validProjects = projects.filter(
    (project) =>
      Number.isFinite(project.centroidLng) &&
      Number.isFinite(project.centroidLat) &&
      project.centroidLng >= -180 &&
      project.centroidLng <= 180 &&
      project.centroidLat >= -90 &&
      project.centroidLat <= 90,
  );
  if (validProjects.length === 0) return null;

  const minLat = Math.min(...validProjects.map((project) => project.centroidLat));
  const maxLat = Math.max(...validProjects.map((project) => project.centroidLat));
  const minLng = Math.min(...validProjects.map((project) => project.centroidLng));
  const maxLng = Math.max(...validProjects.map((project) => project.centroidLng));
  const midpointLat = (minLat + maxLat) / 2;
  const latitudePadding = paddingKm / 111.32;
  const longitudePadding =
    paddingKm / (111.32 * Math.max(Math.cos((midpointLat * Math.PI) / 180), 0.01));

  return {
    minLng: Math.max(-180, minLng - longitudePadding),
    minLat: Math.max(-90, minLat - latitudePadding),
    maxLng: Math.min(180, maxLng + longitudePadding),
    maxLat: Math.min(90, maxLat + latitudePadding),
  };
}

export function buildFirmsFingerprint(record: {
  latitude: string | number;
  longitude: string | number;
  acq_date: string;
  acq_time: string | number;
  instrument: string;
}): string {
  const input = [
    String(record.latitude).trim(),
    String(record.longitude).trim(),
    record.acq_date.trim(),
    String(record.acq_time).trim(),
    record.instrument.trim(),
  ].join("");
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeHotspot(
  raw: unknown,
  acquiredAt: Date,
): Prisma.EnvironmentalEventCreateManyInput {
  const parsed = firmsHotspotSchema.parse(raw);
  const latitude = finiteCoordinate(parsed.latitude, "latitude");
  const longitude = finiteCoordinate(parsed.longitude, "longitude");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("FIRMS coordinates are outside WGS84 bounds");
  }

  const observedAt = parseObservedAt(parsed.acq_date, parsed.acq_time);
  const fingerprint = buildFirmsFingerprint(parsed);
  const sourceMetadata = Object.fromEntries(
    Object.entries({
      frp: readScalar(parsed.frp),
      satellite: readScalar(parsed.satellite),
      instrument: parsed.instrument,
      version: readScalar(parsed.version),
      daynight: readScalar(parsed.daynight),
      scan: readScalar(parsed.scan),
      track: readScalar(parsed.track),
      bright_ti4: readScalar(parsed.bright_ti4),
      bright_ti5: readScalar(parsed.bright_ti5),
    }).filter(([, value]) => value !== null),
  );

  return {
    type: EventType.WILDFIRE,
    sourceName: `NASA FIRMS ${FIRMS_SOURCE}`,
    sourceId: fingerprint,
    sourceInstrument: parsed.instrument,
    fingerprint,
    observedAt,
    acquiredAt,
    geometry: toJsonValue({
      type: "Point",
      coordinates: [longitude, latitude],
    }),
    geomType: "Point",
    sourceConfidence: confidenceScore(parsed.confidence, parsed.instrument),
    sourceMetadata: toJsonValue(sourceMetadata),
    dataVersion: readScalar(parsed.version),
    originType: EventOriginType.OBSERVED,
    createdByType: CreatedByType.EXTERNAL_SOURCE,
    rawPayload: toJsonValue(raw),
  };
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown FIRMS error";
  return message.replaceAll(env.NASA_FIRMS_MAP_KEY, "[REDACTED]");
}

export class FIRMSIngestionService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly fetcher: Fetcher = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async ingest(): Promise<IngestionResult> {
    let rejected = 0;
    const attemptedAt = this.clock();

    try {
      const projects = await this.db.carbonProject.findMany({
        where: { boundaries: { some: { isCurrent: true } } },
        select: { centroidLng: true, centroidLat: true },
      });
      const bbox = deriveFirmsBbox(projects);
      if (!bbox) {
        return { status: "SKIPPED", reason: "NO_ACTIVE_PROJECTS" };
      }

      const checkpoint = await this.db.monitoringCheckpoint.upsert({
        where: { sourceName: CHECKPOINT_SOURCE },
        create: {
          sourceName: CHECKPOINT_SOURCE,
          lastAttemptAt: attemptedAt,
        },
        update: { lastAttemptAt: attemptedAt },
      });
      const days = this.lookbackDays(checkpoint.lastSuccessAt, attemptedAt);
      const bboxParam = [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
        .map((value) => value.toFixed(6))
        .join(",");
      const url = `${FIRMS_ENDPOINT}/${encodeURIComponent(env.NASA_FIRMS_MAP_KEY)}/${FIRMS_SOURCE}/${bboxParam}/${days}`;

      const response = await this.fetcher(url, {
        headers: { accept: "text/csv" },
      });
      if (!response.ok) {
        throw new Error(`FIRMS API returned HTTP ${response.status}`);
      }

      const csvPayload = await response.text();
      const payload = parseFirmsCsv(csvPayload);

      const rows: Prisma.EnvironmentalEventCreateManyInput[] = [];
      for (const raw of payload) {
        try {
          rows.push(normalizeHotspot(raw, attemptedAt));
        } catch {
          rejected += 1;
        }
      }

      const persisted = await this.db.$transaction(async (tx) => {
        const fingerprints = rows
          .map((row) => row.fingerprint)
          .filter((fingerprint): fingerprint is string => Boolean(fingerprint));
        const existing = fingerprints.length
          ? await tx.environmentalEvent.findMany({
              where: { fingerprint: { in: fingerprints } },
              select: { fingerprint: true },
            })
          : [];
        const existingFingerprints = new Set(
          existing.map((event) => event.fingerprint),
        );
        const candidates = rows.filter(
          (row) => row.fingerprint && !existingFingerprints.has(row.fingerprint),
        );
        const createResult = candidates.length
          ? await tx.environmentalEvent.createMany({
              data: candidates,
              skipDuplicates: true,
            })
          : { count: 0 };
        const updatedCheckpoint = await tx.monitoringCheckpoint.update({
          where: { sourceName: CHECKPOINT_SOURCE },
          data: {
            lastSuccessAt: attemptedAt,
            lastAttemptAt: attemptedAt,
            consecutiveFails: 0,
            lastErrorMessage: null,
          },
        });
        const persistedEvents = fingerprints.length
          ? await tx.environmentalEvent.findMany({
              where: { fingerprint: { in: fingerprints } },
              select: { id: true },
            })
          : [];

        return {
          inserted: createResult.count,
          skippedDuplicates: rows.length - createResult.count,
          checkpoint: updatedCheckpoint.lastSuccessAt ?? attemptedAt,
          eventIds: persistedEvents.map((event) => event.id),
        };
      });

      for (const eventId of persisted.eventIds) {
        try {
          await environmentalEventProcessor.process(eventId);
        } catch (error) {
          console.error("[FIRMS] event processing handoff failed", {
            eventId,
            reason: safeErrorMessage(error),
          });
        }
      }

      return {
        status: "COMPLETED",
        fetched: payload.length,
        normalized: rows.length,
        inserted: persisted.inserted,
        skippedDuplicates: persisted.skippedDuplicates,
        rejected,
        bbox,
        checkpoint: persisted.checkpoint,
      };
    } catch (error) {
      const message = safeErrorMessage(error);
      console.error("[FIRMS] ingestion failed", { reason: message });
      try {
        const failedCheckpoint = await this.db.monitoringCheckpoint.upsert({
          where: { sourceName: CHECKPOINT_SOURCE },
          create: {
            sourceName: CHECKPOINT_SOURCE,
            lastAttemptAt: attemptedAt,
            consecutiveFails: 1,
            lastErrorMessage: message,
          },
          update: {
            lastAttemptAt: attemptedAt,
            consecutiveFails: { increment: 1 },
            lastErrorMessage: message,
          },
        });
        if (failedCheckpoint.consecutiveFails >= 3) {
          console.warn("[FIRMS] ingestion has failed three or more times", {
            consecutiveFails: failedCheckpoint.consecutiveFails,
          });
        }
      } catch (checkpointError) {
        console.error("[FIRMS] unable to record failed checkpoint", {
          reason: safeErrorMessage(checkpointError),
        });
      }
      return { status: "FAILED", reason: message, rejected };
    }
  }

  private lookbackDays(lastSuccessAt: Date | null, now: Date): number {
    if (!lastSuccessAt) return 1;
    const elapsedHours = Math.max(
      1,
      (now.getTime() - lastSuccessAt.getTime()) / (60 * 60 * 1000),
    );
    const boundedHours = Math.min(MAX_LOOKBACK_HOURS, elapsedHours);
    return Math.max(1, Math.min(MAX_LOOKBACK_DAYS, Math.ceil(boundedHours / 24)));
  }
}

export { CHECKPOINT_SOURCE, FIRMS_SOURCE, normalizeHotspot };
