import "server-only";

import {
  AuditPriorityLevel,
  BoundaryQuality,
  ConfidenceLevel,
  EvidenceLabel,
  RiskLevel,
} from "@prisma/client";

export const GEOSPATIAL_ENGINE_VERSION = "geospatial-v1.0";
export const RISK_METHODOLOGY_VERSION = "risk-v1.0";

export type HoldingInput = {
  heldQuantity: number;
  refValuePerUnit: number;
  refCurrency: string;
  valuationBasis: string;
};

export type ExposureResult = {
  heldQuantity: number | null;
  creditExposure: number | null;
  financialExposureEst: number | null;
  financialCurrency: string | null;
  valuationBasis: string | null;
};

export type ConfidenceResult = {
  score: number;
  level: ConfidenceLevel;
};

export function classifyIntegrityRisk(impactPct: number): RiskLevel {
  if (impactPct >= 0.5) return RiskLevel.CRITICAL;
  if (impactPct >= 0.2) return RiskLevel.HIGH;
  if (impactPct >= 0.05) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

export function aggregateExposure(
  holdings: HoldingInput[],
  impactPct: number,
): ExposureResult {
  if (holdings.length === 0) {
    return {
      heldQuantity: null,
      creditExposure: null,
      financialExposureEst: null,
      financialCurrency: null,
      valuationBasis: null,
    };
  }

  const heldQuantity = holdings.reduce(
    (total, holding) => total + holding.heldQuantity,
    0,
  );
  const creditExposure = heldQuantity * impactPct;
  const financialExposureEst = holdings.reduce(
    (total, holding) =>
      total + holding.heldQuantity * impactPct * holding.refValuePerUnit,
    0,
  );
  const currencies = new Set(holdings.map((holding) => holding.refCurrency));
  const valuationBases = new Set(
    holdings.map((holding) => holding.valuationBasis),
  );

  return {
    heldQuantity,
    creditExposure,
    financialExposureEst,
    financialCurrency:
      currencies.size === 1 ? Array.from(currencies)[0] : null,
    valuationBasis:
      valuationBases.size === 1 ? Array.from(valuationBases)[0] : null,
  };
}

export function scoreEvidenceConfidence(input: {
  sourceConfidence: number | null | undefined;
  freshnessHours: number | null | undefined;
  boundaryQuality: BoundaryQuality;
  evidenceLabel: EvidenceLabel;
}): ConfidenceResult {
  const sourceConfidence = Number.isFinite(input.sourceConfidence)
    ? Math.max(0, Math.min(1, input.sourceConfidence ?? 0))
    : 0;
  const freshnessHours = Number.isFinite(input.freshnessHours)
    ? Math.max(0, input.freshnessHours ?? 0)
    : Number.POSITIVE_INFINITY;

  const freshnessScore =
    freshnessHours <= 24 ? 20 : freshnessHours <= 72 ? 10 : 0;
  const boundaryScore = {
    [BoundaryQuality.HIGH]: 20,
    [BoundaryQuality.MEDIUM]: 10,
    [BoundaryQuality.LOW]: 5,
    [BoundaryQuality.UNKNOWN]: 0,
  }[input.boundaryQuality];
  const labelPenalty = {
    [EvidenceLabel.OBSERVED]: 0,
    [EvidenceLabel.ESTIMATED]: -10,
    [EvidenceLabel.MODELED]: -20,
    [EvidenceLabel.INFERRED]: -30,
  }[input.evidenceLabel];
  const score = Math.max(
    0,
    Math.min(100, sourceConfidence * 40 + freshnessScore + boundaryScore + labelPenalty),
  );

  return {
    score,
    level:
      score <= 40
        ? ConfidenceLevel.LOW
        : score <= 70
          ? ConfidenceLevel.MEDIUM
          : ConfidenceLevel.HIGH,
  };
}

export function assignAuditPriority(
  integrityRisk: RiskLevel,
  evidenceConfidence: ConfidenceLevel,
): AuditPriorityLevel {
  const urgentRisk =
    integrityRisk === RiskLevel.CRITICAL || integrityRisk === RiskLevel.HIGH;
  const sufficientConfidence =
    evidenceConfidence === ConfidenceLevel.MEDIUM ||
    evidenceConfidence === ConfidenceLevel.HIGH;
  if (urgentRisk && sufficientConfidence) return AuditPriorityLevel.URGENT;

  if (
    urgentRisk ||
    integrityRisk === RiskLevel.MEDIUM ||
    evidenceConfidence === ConfidenceLevel.LOW
  ) {
    return AuditPriorityLevel.ELEVATED;
  }

  return AuditPriorityLevel.ROUTINE;
}

export function calculateFreshnessHours(
  observedAt: Date | null,
  now: Date,
): number | null {
  if (!observedAt) return null;
  return Math.max(0, (now.getTime() - observedAt.getTime()) / 3_600_000);
}
