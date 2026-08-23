import assert from "node:assert/strict";
import test from "node:test";

import { parseFirmsCsv } from "../lib/services/firms-csv";

test("NASA FIRMS CSV parses required observations and preserves optional metadata", () => {
  const records = parseFirmsCsv(
    "latitude,longitude,acq_date,acq_time,instrument,confidence,frp\r\n" +
      "45.3921,22.8212,2025-01-02,034512,VIIRS,high,12.4\r\n",
  );
  assert.deepEqual(records, [{
    latitude: "45.3921",
    longitude: "22.8212",
    acq_date: "2025-01-02",
    acq_time: "034512",
    instrument: "VIIRS",
    confidence: "high",
    frp: "12.4",
  }]);
});

test("NASA FIRMS CSV supports quoted commas and rejects malformed rows", () => {
  assert.equal(parseFirmsCsv('latitude,longitude,acq_date,acq_time,instrument\n1,2,2025-01-01,1,"VIIRS, SNPP"')[0].instrument, "VIIRS, SNPP");
  assert.throws(
    () => parseFirmsCsv("latitude,longitude,acq_date,acq_time,instrument\n1,2,2025-01-01"),
    /row does not match/,
  );
});
