import { errorResponse, successResponse } from "@/lib/api-response";
import { PortfolioService } from "@/lib/services/portfolio";
import { portfolioResponseSchema } from "@/lib/validations/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = portfolioResponseSchema.parse(await new PortfolioService().getPortfolio());
    return successResponse(data);
  } catch (error) {
    console.error("[PortfolioAPI] portfolio read failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return errorResponse("INTERNAL_ERROR", "Portfolio could not be loaded", 500);
  }
}
