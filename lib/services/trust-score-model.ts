export type TrustBoundaryQuality = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" | string;

export interface TrustScoreModelInput {
  boundaryPresent: boolean;
  boundaryHasGeometry: boolean;
  boundaryQuality: TrustBoundaryQuality | null;
  boundaryVerifiedAt: Date | string | null;
  boundaryAcquiredAt: Date | string | null;
  areaHa: number | null;
  heldQuantity: number;
  registryId: string | null;
  methodology: string | null;
  description: string | null;
  environmentalEvidenceCount: number;
  environmentalSourceConfidence: number | null;
  environmentalObservedAt: Date | string | null;
  hasHighRiskIncident: boolean;
  referenceAt?: Date;
}

export interface TrustScoreModelComponent {
  component_name: string;
  name: string;
  weighted_score: number;
  weight: number;
  score_contribution: number;
  max_contribution: number;
  reason: string;
  reasoning: string;
}

export interface TrustScoreModelAnomaly {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface TrustScoreModelResult {
  truthScore: number;
  confidence: number;
  components: TrustScoreModelComponent[];
  anomalies: TrustScoreModelAnomaly[];
  measuredAreaHa: number;
  totalCredits: number;
  biomassDensity: number | null;
  environmentalSourceConfidence: number | null;
  environmentalEvidenceCount: number;
}

const MAX = {
  geographic: 15,
  carbon: 30,
  documents: 15,
  environmental: 20,
  telemetry: 10,
  temporal: 10,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteOrZero(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

function isValidDate(value: Date | string | null): value is Date | string {
  return value !== null && !Number.isNaN(new Date(value).getTime());
}

function hasPendingRegistry(registryId: string | null): boolean {
  return !registryId || /^(?:VCS-)?(?:PENDING|TEMP)/i.test(registryId);
}

function component(
  componentName: string,
  name: string,
  score: number,
  weight: number,
  reason: string,
): TrustScoreModelComponent {
  const rounded = round(clamp(score, 0, weight));
  return {
    component_name: componentName,
    name,
    weighted_score: rounded,
    weight,
    score_contribution: rounded,
    max_contribution: weight,
    reason,
    reasoning: reason,
  };
}

export function calculateTrustScoreModel(
  input: TrustScoreModelInput,
): TrustScoreModelResult {
  const measuredAreaHa = round(Math.max(0, finiteOrZero(input.areaHa)), 2);
  const totalCredits = round(Math.max(0, finiteOrZero(input.heldQuantity)), 2);
  const biomassDensity =
    measuredAreaHa > 0 && totalCredits > 0
      ? round(totalCredits / measuredAreaHa, 2)
      : null;
  const anomalies: TrustScoreModelAnomaly[] = [];

  const qualityScore: Record<string, number> = {
    HIGH: MAX.geographic,
    MEDIUM: 11,
    LOW: 7,
    UNKNOWN: 4,
  };
  let geographicScore = input.boundaryPresent
    ? qualityScore[input.boundaryQuality ?? "UNKNOWN"] ?? qualityScore.UNKNOWN
    : 0;
  let geographicReason = input.boundaryPresent
    ? `Boundary provenance is ${input.boundaryQuality ?? "UNKNOWN"}; score uses the stored boundary quality.`
    : "No project boundary is registered.";
  if (!input.boundaryPresent || !input.boundaryHasGeometry) {
    geographicScore = Math.min(geographicScore, 4);
    geographicReason = "Boundary geometry is unavailable; no spatial verification is claimed.";
    anomalies.push({
      type: "APPROXIMATE_GEOMETRY",
      severity: "HIGH",
      message: "A complete project boundary geometry is not available for verification.",
    });
  }

  let carbonScore = 0;
  let carbonReason = "No held quantity or positive project area is available to compare.";
  if (biomassDensity !== null) {
    // This is a consistency score, not a biomass measurement. It rewards a
    // claim near the reference midpoint and penalizes divergence.
    const referenceDensity = 100;
    carbonScore = MAX.carbon * clamp(
      1 - Math.abs(biomassDensity - referenceDensity) / 200,
      0,
      1,
    );
    carbonReason = `Held inventory implies ${biomassDensity.toFixed(1)} tCO2e/ha across ${measuredAreaHa.toFixed(2)} ha; this is a deterministic consistency comparison, not a biomass measurement.`;
    if (biomassDensity > 350) {
      anomalies.push({
        type: "EXCESSIVE_CARBON_DENSITY",
        severity: "CRITICAL",
        message: `Held inventory implies ${biomassDensity.toFixed(1)} tCO2e/ha, substantially above the deterministic reference range.`,
      });
    } else if (biomassDensity > 180) {
      anomalies.push({
        type: "ELEVATED_CARBON_DENSITY",
        severity: "MEDIUM",
        message: `Held inventory implies ${biomassDensity.toFixed(1)} tCO2e/ha and merits human review.`,
      });
    } else if (biomassDensity < 15) {
      anomalies.push({
        type: "LOW_CARBON_DENSITY",
        severity: "LOW",
        message: `Held inventory implies ${biomassDensity.toFixed(1)} tCO2e/ha; the claim is low relative to the deterministic reference midpoint.`,
      });
    }
  }

  let documentsScore = 0;
  const documentParts: string[] = [];
  if (!hasPendingRegistry(input.registryId)) {
    documentsScore += 8;
    documentParts.push("registry reference");
  } else {
    documentsScore += input.registryId ? 2 : 0;
    anomalies.push({
      type: "REGISTRY_PENDING",
      severity: "MEDIUM",
      message: "A verified registry identifier is not available.",
    });
  }
  if (input.methodology?.trim()) {
    documentsScore += 4;
    documentParts.push("methodology");
  }
  if (input.description?.trim()) {
    documentsScore += 3;
    documentParts.push("project description");
  }
  const documentsReason = documentParts.length
    ? `Stored project documentation includes ${documentParts.join(", ")}.`
    : "No project documentation fields are available.";

  let environmentalScore = 0;
  let environmentalReason = "No FIRMS or other environmental event is linked to this project.";
  if (input.environmentalEvidenceCount > 0) {
    const sourceConfidence = clamp(
      input.environmentalSourceConfidence ?? 0,
      0,
      1,
    );
    environmentalScore = MAX.environmental * sourceConfidence;
    environmentalReason = `FIRMS evidence count ${input.environmentalEvidenceCount}; source confidence ${Math.round(sourceConfidence * 100)}%.`;
  } else {
    anomalies.push({
      type: "MISSING_ENVIRONMENTAL_EVIDENCE",
      severity: "LOW",
      message: "No environmental event is linked, so no satellite-derived evidence is claimed.",
    });
  }
  if (input.hasHighRiskIncident) {
    environmentalScore = Math.min(environmentalScore, 8);
    anomalies.push({
      type: "THERMAL_HOTSPOT_OVERLAP",
      severity: "HIGH",
      message: "A linked incident has a high or critical deterministic risk assessment.",
    });
  }

  // CARBONX P0 does not store ground sensor telemetry. Keeping this at zero
  // prevents an unavailable source from being presented as observed evidence.
  const telemetryScore = 0;
  const telemetryReason = "No P0 ground-sensor telemetry is stored; this component is not claimed as observed.";

  let temporalScore = 2;
  let temporalReason = "No verified boundary or event timestamp is available.";
  const timestamp = input.boundaryVerifiedAt ?? input.environmentalObservedAt;
  if (isValidDate(timestamp)) {
    const ageDays = Math.max(
      0,
      (input.referenceAt ?? new Date()).getTime() - new Date(timestamp).getTime(),
    ) / (24 * 60 * 60 * 1000);
    temporalScore = 10 * clamp(1 - ageDays / 730, 0.2, 1);
    temporalReason = `The latest stored provenance timestamp is ${Math.round(ageDays)} days old.`;
  } else if (isValidDate(input.boundaryAcquiredAt)) {
    temporalScore = 5;
    temporalReason = "Boundary acquisition is recorded, but verification time is not.";
  }

  const components = [
    component("GEOGRAPHIC_CONSISTENCY", "Geographic Consistency", geographicScore, MAX.geographic, geographicReason),
    component("CARBON_CONSISTENCY", "Carbon Consistency", carbonScore, MAX.carbon, carbonReason),
    component("DOCUMENT_COMPLETENESS", "Document Completeness", documentsScore, MAX.documents, documentsReason),
    component("ENVIRONMENTAL_EVIDENCE", "Environmental Evidence Consistency", environmentalScore, MAX.environmental, environmentalReason),
    component("SENSOR_CONSISTENCY", "Sensor Telemetry Availability", telemetryScore, MAX.telemetry, telemetryReason),
    component("TEMPORAL_CONSISTENCY", "Temporal Consistency", temporalScore, MAX.temporal, temporalReason),
  ];
  const truthScore = round(
    components.reduce((sum, current) => sum + current.weighted_score, 0),
  );

  // Confidence measures coverage of evidence that CARBONX actually has. The
  // unavailable P0 sensor component is intentionally excluded from the
  // denominator instead of being treated as successful evidence.
  const confidence = round(
    (geographicScore + documentsScore + environmentalScore + temporalScore) /
      (MAX.geographic + MAX.documents + MAX.environmental + MAX.temporal),
    2,
  );

  return {
    truthScore,
    confidence: clamp(confidence, 0, 1),
    components,
    anomalies,
    measuredAreaHa,
    totalCredits,
    biomassDensity,
    environmentalSourceConfidence: input.environmentalSourceConfidence,
    environmentalEvidenceCount: input.environmentalEvidenceCount,
  };
}
