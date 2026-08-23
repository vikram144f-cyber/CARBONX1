import {
  portfolioResponseSchema,
  type PortfolioResponse,
} from "../validations/portfolio";

let inFlightPortfolioRequest: Promise<PortfolioResponse> | null = null;

export function fetchPortfolioData(): Promise<PortfolioResponse> {
  if (inFlightPortfolioRequest) return inFlightPortfolioRequest;

  inFlightPortfolioRequest = fetch("/api/portfolio", { cache: "no-store" })
    .then(async (response) => {
      const envelope: unknown = await response.json();
      const body = envelope as { success?: unknown; data?: unknown };
      if (!response.ok || body.success !== true) {
        throw new Error("Live portfolio data could not be loaded.");
      }
      return portfolioResponseSchema.parse(body.data);
    })
    .finally(() => {
      inFlightPortfolioRequest = null;
    });

  return inFlightPortfolioRequest;
}
