import "server-only";

import { errorResponse, successResponse } from "@/lib/api-response";
import { sentinelHubService } from "@/lib/services/sentinel-hub";
import { projectIdParamSchema } from "@/lib/validations/portfolio";
import { prisma } from "@/lib/prisma";
import { getStoredProject, getFallbackProject } from "@/lib/services/project-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsed = projectIdParamSchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid project ID", 400);
  }

  try {
    let project: any = null;
    try {
      project = await prisma.carbonProject.findUnique({
        where: { id: parsed.data.id },
        select: { centroidLng: true, centroidLat: true },
      });
    } catch {
      // safe fallback
    }

    if (!project) {
      project = getStoredProject(parsed.data.id) ?? getFallbackProject(parsed.data.id);
    }

    const lng = project?.centroidLng ?? 76.132;
    const lat = project?.centroidLat ?? 11.685;
    const bbox: [number, number, number, number] = [
      lng - 0.02,
      lat - 0.02,
      lng + 0.02,
      lat + 0.02,
    ];

    const result = await sentinelHubService.getNDVIForProject(
      parsed.data.id,
      bbox,
    );

    if (!result) {
      return errorResponse(
        "SATELLITE_UNAVAILABLE",
        "Sentinel-2 imagery is not configured or could not be retrieved. P0 scoring uses GIS and NASA FIRMS evidence instead.",
        503,
      );
    }

    return successResponse(result);
  } catch (error) {
    console.error("[SatelliteAPI] NDVI retrieval error", error);
    return errorResponse("INTERNAL_ERROR", "Satellite NDVI calculation failed", 500);
  }
}
