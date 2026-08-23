import "server-only";

import { errorResponse, successResponse } from "@/lib/api-response";
import { TrustScoreService } from "@/lib/services/trust-score";
import { NotFoundError } from "@/lib/services/errors";
import { projectIdParamSchema } from "@/lib/validations/portfolio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsedParams = projectIdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid project id", 400);
  }

  try {
    const result = await new TrustScoreService().getTrustScore(
      parsedParams.data.id,
    );
    return successResponse(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[TrustScoreAPI] score calculation failed", {
      projectId: parsedParams.data.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse(
      "INTERNAL_ERROR",
      "Trust score could not be calculated",
      500,
    );
  }
}
