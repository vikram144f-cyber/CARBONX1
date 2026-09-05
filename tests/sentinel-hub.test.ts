import assert from "node:assert/strict";
import test from "node:test";

import { SentinelHubService } from "../lib/services/sentinel-hub";

test("satellite service returns unavailable instead of synthetic NDVI without credentials", async () => {
  const originalClientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const originalClientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
  delete process.env.SENTINEL_HUB_CLIENT_ID;
  delete process.env.SENTINEL_HUB_CLIENT_SECRET;

  try {
    const result = await new SentinelHubService().getNDVIForProject("project-test");
    assert.equal(result, null);
  } finally {
    if (originalClientId === undefined) delete process.env.SENTINEL_HUB_CLIENT_ID;
    else process.env.SENTINEL_HUB_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.SENTINEL_HUB_CLIENT_SECRET;
    else process.env.SENTINEL_HUB_CLIENT_SECRET = originalClientSecret;
  }
});
