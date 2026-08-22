import "server-only";

import { BoundaryQuality, Prisma, PrismaClient } from "@prisma/client";
import booleanValid from "@turf/boolean-valid";
import { area, centroid } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";

import { prisma } from "@/lib/prisma";
import type { ProjectBoundaryImportRequest } from "@/lib/validations/ingestion";
import { InvalidInputError, NotFoundError } from "./errors";

type BoundaryFeature = Feature<Polygon | MultiPolygon>;

export type BoundaryImportResult = {
  id: string;
  projectId: string;
  version: number;
  areaHa: number;
  source: string;
  sourceUrl: string | null;
  quality: BoundaryQuality;
  isCurrent: true;
  centroid: { lng: number; lat: number };
};

function asFeature(
  input: ProjectBoundaryImportRequest["geojson"],
): BoundaryFeature {
  if (input.type === "Feature") {
    return input as unknown as BoundaryFeature;
  }

  return {
    type: "Feature",
    properties: null,
    geometry: input as unknown as Polygon | MultiPolygon,
  };
}

function validateAndMeasure(input: ProjectBoundaryImportRequest["geojson"]) {
  const feature = asFeature(input);

  let valid = false;
  try {
    valid = booleanValid(feature);
  } catch {
    valid = false;
  }

  if (!valid) {
    throw new InvalidInputError("GeoJSON boundary geometry is invalid");
  }

  const areaM2 = area(feature);
  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    throw new InvalidInputError("GeoJSON boundary must have positive area");
  }

  const center = centroid(feature).geometry.coordinates;
  return {
    feature,
    areaHa: areaM2 / 10_000,
    centroid: { lng: center[0], lat: center[1] },
  };
}

export class BoundaryImportService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async import(
    projectId: string,
    input: ProjectBoundaryImportRequest,
  ): Promise<BoundaryImportResult> {
    const measured = validateAndMeasure(input.geojson);
    const now = new Date();

    return this.db.$transaction(async (tx) => {
      const project = await tx.carbonProject.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) {
        throw new NotFoundError("Carbon project not found");
      }

      const latest = await tx.projectBoundary.findFirst({
        where: { projectId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;

      await tx.projectBoundary.updateMany({
        where: { projectId, isCurrent: true },
        data: { isCurrent: false },
      });

      const boundary = await tx.projectBoundary.create({
        data: {
          projectId,
          version,
          geojson: measured.feature as unknown as Prisma.InputJsonValue,
          source: input.source,
          sourceUrl: input.sourceUrl ?? null,
          quality: input.quality as BoundaryQuality,
          verifiedAt: null,
          areaHa: measured.areaHa,
          acquiredAt: now,
          isCurrent: true,
        },
      });

      await tx.carbonProject.update({
        where: { id: projectId },
        data: {
          centroidLng: measured.centroid.lng,
          centroidLat: measured.centroid.lat,
        },
      });

      return {
        id: boundary.id,
        projectId: boundary.projectId,
        version: boundary.version,
        areaHa: boundary.areaHa ?? measured.areaHa,
        source: boundary.source,
        sourceUrl: boundary.sourceUrl,
        quality: boundary.quality,
        isCurrent: true,
        centroid: measured.centroid,
      };
    });
  }
}
