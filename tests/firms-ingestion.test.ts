import assert from "node:assert/strict";
import test from "node:test";

import { FIRMSIngestionService } from "../lib/services/firms-ingestion";

test("FIRMS ingestion reports unavailable without a NASA key and makes no network call", async () => {
  const originalKey = process.env.NASA_FIRMS_MAP_KEY;
  delete process.env.NASA_FIRMS_MAP_KEY;
  let networkCalled = false;

  try {
    const result = await new FIRMSIngestionService(
      {} as never,
      async () => {
        networkCalled = true;
        throw new Error("network should not be called");
      },
    ).ingest();

    assert.deepEqual(result, {
      status: "FAILED",
      reason: "NASA FIRMS integration is not configured",
      rejected: 0,
    });
    assert.equal(networkCalled, false);
  } finally {
    if (originalKey === undefined) delete process.env.NASA_FIRMS_MAP_KEY;
    else process.env.NASA_FIRMS_MAP_KEY = originalKey;
  }
});
