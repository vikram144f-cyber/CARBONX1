import "server-only";

import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { projectIdParamSchema } from "@/lib/validations/portfolio";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[id]/events
 *
 * Returns EnvironmentalEvent records that fall within the bounding box of the
 * project's current boundary, for use as map overlays.
 *
 * Only returns Point geometry events (FIRMS hotspots). Never returns raw
 * NASA API keys. All coordinates are server-resolved.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsedParams = projectIdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid project id", 400);
  }

  try {
    const projectId = parsedParams.data.id;

    // Fetch the project centroid to derive a bounding-box for event lookup.
    const project = await prisma.carbonProject.findUnique({
      where: { id: projectId },
      select: {
        centroidLng: true,
        centroidLat: true,
        boundaries: {
          where: { isCurrent: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { geojson: true, areaHa: true },
        },
      },
    });

    if (!project) {
      return errorResponse("NOT_FOUND", "Project not found", 404);
    }

    // Derive a simple bounding-box from the centroid + generous padding (2°)
    // so we capture any FIRMS events nearby the project.
    const PADDING_DEG = 2;
    const minLng = project.centroidLng - PADDING_DEG;
    const maxLng = project.centroidLng + PADDING_DEG;
    const minLat = project.centroidLat - PADDING_DEG;
    const maxLat = project.centroidLat + PADDING_DEG;

    // Fetch all FIRMS Point events whose coordinates fall within the bbox.
    // geomType is stored as "Point" for FIRMS observations.
    const events = await prisma.environmentalEvent.findMany({
      where: { geomType: "Point" },
      select: {
        id: true,
        type: true,
        sourceName: true,
        sourceInstrument: true,
        observedAt: true,
        acquiredAt: true,
        geometry: true,
        sourceConfidence: true,
        originType: true,
      },
      orderBy: { observedAt: "desc" },
      take: 500,
    });

    // Filter in-process: only include events whose Point coordinates fall
    // within the bounding box. This is safe because we never unbuffer — we
    // return all points in the bbox for overlay display.
    const filtered = events.filter((event) => {
      const geom = event.geometry as {
        type?: string;
        coordinates?: number[];
      } | null;
      if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates))
        return false;
      const [lng, lat] = geom.coordinates;
      if (typeof lng !== "number" || typeof lat !== "number") return false;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });

    const payload = filtered.map((event) => {
      const geom = event.geometry as { coordinates: number[] };
      return {
        id: event.id,
        type: event.type,
        sourceName: event.sourceName,
        sourceInstrument: event.sourceInstrument,
        observedAt: event.observedAt?.toISOString() ?? null,
        acquiredAt: event.acquiredAt.toISOString(),
        longitude: geom.coordinates[0],
        latitude: geom.coordinates[1],
        sourceConfidence: event.sourceConfidence,
        originType: event.originType,
      };
    });

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error("[ProjectEventsAPI] failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("INTERNAL_ERROR", "Project events could not be loaded", 500);
  }
}
