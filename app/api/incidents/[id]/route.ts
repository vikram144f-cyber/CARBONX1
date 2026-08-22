import { errorResponse, successResponse } from "@/lib/api-response";
import { IncidentService } from "@/lib/services/incidents";
import { NotFoundError } from "@/lib/services/errors";
import {
  incidentIdParamSchema,
  incidentResponseSchema,
} from "@/lib/validations/incidents";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const parsedParams = incidentIdParamSchema.safeParse(params);
  if (!parsedParams.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid incident id", 400);
  }

  try {
    const response = await new IncidentService().getById(parsedParams.data.id);
    const validated = incidentResponseSchema.parse(response);
    return successResponse(validated);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[IncidentAPI] incident read failed");
    return errorResponse("INTERNAL_ERROR", "Incident could not be loaded", 500);
  }
}
