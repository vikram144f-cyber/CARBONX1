import "server-only";

export interface SentinelNDVIResult {
  projectId?: string;
  source: "SENTINEL_2_L2A";
  ndviMean: number;
  ndviMedian: number | null;
  ndviMin: number | null;
  ndviMax: number | null;
  cloudCoveragePct: number | null;
  canopyHealth: "OPTIMAL" | "MODERATE" | "STRESSED" | "DEGRADED";
  acquiredAt: string;
  resolutionMeters: number;
  provider: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export class SentinelHubService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;

  constructor() {
    this.clientId = process.env.SENTINEL_HUB_CLIENT_ID?.trim();
    this.clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET?.trim();
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) {
      return null;
    }

    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
      return cachedToken.token;
    }

    try {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const res = await fetch(
        "https://services.sentinel-hub.com/oauth/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        },
      );

      if (!res.ok) {
        console.warn(`[SentinelHub] OAuth token request failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };

      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      return cachedToken.token;
    } catch (e) {
      console.warn("[SentinelHub] Token fetch error", e);
      return null;
    }
  }

  async getNDVIForProject(
    projectId: string,
    bbox: [number, number, number, number] = [76.12, 11.68, 76.14, 11.70],
  ): Promise<SentinelNDVIResult | null> {
    const token = await this.getAccessToken();

    if (!token) return null;

    try {
        const evalscript = `
          //VERSION=3
          function setup() {
            return {
              input: [{ bands: ["B04", "B08", "dataMask"] }],
              output: { bands: 1, sampleType: "FLOAT32" }
            };
          }
          function evaluatePixel(sample) {
            let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
            return [ndvi];
          }
        `;

        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const requestBody = {
          input: {
            bounds: {
              bbox,
              properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
            },
            data: [
              {
                type: "sentinel-2-l2a",
                dataFilter: {
                  timeRange: {
                    from: thirtyDaysAgo.toISOString(),
                    to: now.toISOString(),
                  },
                  maxCloudCoverage: 20,
                },
              },
            ],
          },
          aggregation: {
            timeRange: {
              from: thirtyDaysAgo.toISOString(),
              to: now.toISOString(),
            },
            aggregationInterval: { of: "P30D" },
            evalscript,
          },
        };

        const res = await fetch(
          "https://services.sentinel-hub.com/api/v1/statistics",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (res.ok) {
          const stats = (await res.json()) as {
            data?: Array<{
              outputs?: {
                default?: {
                  bands?: {
                    B0?: { stats?: { mean?: number; min?: number; max?: number; stDev?: number } };
                  };
                };
              };
            }>;
          };

          const bandStats = stats.data?.[0]?.outputs?.default?.bands?.B0?.stats;
          const meanVal = bandStats?.mean;
          if (typeof meanVal !== "number" || !Number.isFinite(meanVal)) return null;

          return {
            projectId,
            source: "SENTINEL_2_L2A",
            ndviMean: parseFloat(meanVal.toFixed(3)),
            ndviMedian: null,
            ndviMin: typeof bandStats?.min === "number" ? bandStats.min : null,
            ndviMax: typeof bandStats?.max === "number" ? bandStats.max : null,
            cloudCoveragePct: null,
            canopyHealth: meanVal >= 0.6 ? "OPTIMAL" : meanVal >= 0.45 ? "MODERATE" : "STRESSED",
            acquiredAt: new Date().toISOString(),
            resolutionMeters: 10,
            provider: "Sentinel Hub / ESA Copernicus",
          };
        }
        console.warn(`[SentinelHub] Statistical query failed with HTTP ${res.status}`);
      } catch (e) {
        console.warn("[SentinelHub] Statistical query failed", e);
      }
    return null;
  }
}

export const sentinelHubService = new SentinelHubService();
