import "server-only";

import { env } from "@/lib/env";
import { errorResponse, successResponse } from "@/lib/api-response";
import { FIRMSIngestionService } from "@/lib/services/firms-ingestion";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/refresh
 *
 * Dev/demo-only server action that:
 * 1. Verifies the Authorization header matches ADMIN_REFRESH_TOKEN.
 * 2. Calls FIRMSIngestionService.ingest() to fetch real NASA FIRMS observations
 *    for all seeded project centroids, persist them, and hand off to the
 *    Epic 03 geospatial/risk engine and Epic 04 incident lifecycle.
 * 3. Returns ingestion stats without printing the NASA key.
 *
 * Never calls any external service from the browser.
 * Never fabricates events.
 */
export async function POST(request: Request) {
  // Token guard — server-side only, never NEXT_PUBLIC_
  const authHeader = request.headers.get("authorization");
  const expectedToken = env.ADMIN_REFRESH_TOKEN;

  if (!expectedToken) {
    return errorResponse(
      "CONFIG_ERROR",
      "ADMIN_REFRESH_TOKEN is not configured on this server",
      503,
    );
  }

  const providedToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!providedToken || providedToken !== expectedToken) {
    return errorResponse("UNAUTHORIZED", "Invalid or missing refresh token", 401);
  }

  try {
    console.log("[AdminRefresh] Starting FIRMS ingestion pipeline");

    const svc = new FIRMSIngestionService();
    const result = await svc.ingest();

    console.log("[AdminRefresh] Ingestion complete", {
      status: result.status,
      ...(result.status === "COMPLETED"
        ? {
            fetched: result.fetched,
            inserted: result.inserted,
            skipped: result.skippedDuplicates,
            rejected: result.rejected,
          }
        : result.status === "FAILED"
          ? { reason: "[REDACTED from logs]" }
          : {}),
    });

    return successResponse(result);
  } catch (error) {
    console.error("[AdminRefresh] Unhandled error during ingestion", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("INTERNAL_ERROR", "Ingestion pipeline failed", 500);
  }
}
