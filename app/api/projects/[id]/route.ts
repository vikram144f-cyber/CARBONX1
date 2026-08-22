import { errorResponse, successResponse } from "@/lib/api-response";
import { PortfolioService } from "@/lib/services/portfolio";
import { NotFoundError } from "@/lib/services/errors";
import {
  projectIdParamSchema,
  projectResponseSchema,
} from "@/lib/validations/portfolio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsedParams = projectIdParamSchema.safeParse(params);
  if (!parsedParams.success) return errorResponse("VALIDATION_ERROR", "Invalid project id", 400);

  try {
    const data = projectResponseSchema.parse(
      await new PortfolioService().getProject(parsedParams.data.id),
    );
    return successResponse(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[ProjectAPI] project read failed", {
      projectId: parsedParams.data.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("INTERNAL_ERROR", "Project could not be loaded", 500);
  }
}
