import { errorResponse, successResponse } from "@/lib/api-response";
import { IngestionService } from "@/lib/services/ingestion";
import { ServiceError } from "@/lib/services/errors";
import { replayEventRequestSchema } from "@/lib/validations/ingestion";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON", 400);
  }

  const parsed = replayEventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      JSON.stringify(parsed.error.flatten()),
      400,
    );
  }

  try {
    const result = await new IngestionService().replay(parsed.data.seedEventId);
    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[ReplayAPI] replay failed");
    return errorResponse("INTERNAL_ERROR", "Event replay failed", 500);
  }
}
