import { errorResponse, successResponse } from "@/lib/api-response";
import { AuditService } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/errors";
import {
  auditActionRequestSchema,
  auditActionResponseSchema,
} from "@/lib/validations/audit";
import { incidentIdParamSchema } from "@/lib/validations/incidents";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { incidentId: string } },
) {
  const parsedParams = incidentIdParamSchema.safeParse({ id: params.incidentId });
  if (!parsedParams.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid incident id", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Request body must be valid JSON", 400);
  }
  const parsedBody = auditActionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid audit action", 400);
  }

  if (parsedBody.data.actor.toLowerCase().startsWith("system:")) {
    return errorResponse("INVALID_ACTOR", "Audit flags require a human actor", 400);
  }

  try {
    const transition = await new AuditService().flagForAudit(
      parsedParams.data.id,
      parsedBody.data.actor,
    );
    const response = auditActionResponseSchema.parse({
      action: parsedBody.data.action,
      ...transition,
    });
    return successResponse(response);
  } catch (error) {
    if (error instanceof ServiceError) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error("[AuditAPI] audit flag failed", {
      incidentId: parsedParams.data.id,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("INTERNAL_ERROR", "Audit flag could not be recorded", 500);
  }
}
