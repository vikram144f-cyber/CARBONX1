import assert from "node:assert/strict";
import test from "node:test";

import { calculateTrustScoreModel } from "../lib/services/trust-score-model";

const referenceAt = new Date("2026-08-23T00:00:00.000Z");

function input(overrides: Partial<Parameters<typeof calculateTrustScoreModel>[0]> = {}) {
  return {
    boundaryPresent: true,
    boundaryHasGeometry: true,
    boundaryQuality: "HIGH" as const,
    boundaryVerifiedAt: "2026-08-01T00:00:00.000Z",
    boundaryAcquiredAt: "2026-07-01T00:00:00.000Z",
    areaHa: 100,
    heldQuantity: 10000,
    registryId: "VCS-1000",
    methodology: "AR-ACM0003",
    description: "Public project record",
    environmentalEvidenceCount: 0,
    environmentalSourceConfidence: null,
    environmentalObservedAt: null,
    hasHighRiskIncident: false,
    referenceAt,
    ...overrides,
  };
}

test("trust score changes when deterministic project inputs change", () => {
  const balanced = calculateTrustScoreModel(input({ heldQuantity: 10000 }));
  const lowerClaim = calculateTrustScoreModel(input({ heldQuantity: 1000 }));
  const higherClaim = calculateTrustScoreModel(input({ heldQuantity: 40000 }));

  assert.notEqual(balanced.truthScore, lowerClaim.truthScore);
  assert.notEqual(balanced.truthScore, higherClaim.truthScore);
  assert.notEqual(
    balanced.components.find((item) => item.component_name === "CARBON_CONSISTENCY")?.weighted_score,
    lowerClaim.components.find((item) => item.component_name === "CARBON_CONSISTENCY")?.weighted_score,
  );
});

test("identical inputs are reproducible and do not depend on the project id", () => {
  const first = calculateTrustScoreModel(input());
  const second = calculateTrustScoreModel(input());

  assert.deepEqual(first, second);
});

test("missing geometry, inventory, and environmental evidence are not scored as successful evidence", () => {
  const result = calculateTrustScoreModel(
    input({
      boundaryHasGeometry: false,
      areaHa: 0,
      heldQuantity: 0,
      environmentalEvidenceCount: 0,
    }),
  );

  assert.equal(
    result.components.find((item) => item.component_name === "GEOGRAPHIC_CONSISTENCY")?.weighted_score,
    4,
  );
  assert.equal(
    result.components.find((item) => item.component_name === "CARBON_CONSISTENCY")?.weighted_score,
    0,
  );
  assert.equal(
    result.components.find((item) => item.component_name === "ENVIRONMENTAL_EVIDENCE")?.weighted_score,
    0,
  );
  assert.ok(result.anomalies.some((item) => item.type === "APPROXIMATE_GEOMETRY"));
  assert.ok(result.anomalies.some((item) => item.type === "MISSING_ENVIRONMENTAL_EVIDENCE"));
});

test("FIRMS confidence contributes only when linked evidence exists", () => {
  const withoutEvent = calculateTrustScoreModel(input());
  const withEvent = calculateTrustScoreModel(
    input({
      environmentalEvidenceCount: 1,
      environmentalSourceConfidence: 0.8,
      environmentalObservedAt: "2026-08-22T00:00:00.000Z",
    }),
  );

  assert.equal(
    withoutEvent.components.find((item) => item.component_name === "ENVIRONMENTAL_EVIDENCE")?.weighted_score,
    0,
  );
  assert.equal(
    withEvent.components.find((item) => item.component_name === "ENVIRONMENTAL_EVIDENCE")?.weighted_score,
    16,
  );
  assert.ok(withEvent.confidence > withoutEvent.confidence);
});
