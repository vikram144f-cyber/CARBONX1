import { errorResponse, successResponse } from "@/lib/api-response";
import { BoundaryImportService } from "@/lib/services/boundary-import";
import { ServiceError } from "@/lib/services/errors";
import { projectBoundaryImportRequestSchema } from "@/lib/validations/ingestion";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("invalid JSON body");
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    return errorResponse("INVALID_JSON", (error as Error).message, 400);
  }

  const parsed = projectBoundaryImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      JSON.stringify(parsed.error.flatten()),
      400,
    );
  }

  try {
    const result = await new BoundaryImportService().import(
      params.id,
      parsed.data,
    );
    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[BoundaryAPI] boundary import failed");
    return errorResponse("INTERNAL_ERROR", "Boundary import failed", 500);
  }
}
