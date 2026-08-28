export type TrustBoundaryQuality = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" | string;

export interface TrustScoreModelInput {
  boundaryPresent: boolean;
  boundaryHasGeometry: boolean;
  boundaryQuality: TrustBoundaryQuality | null;
  boundaryVerifiedAt: Date | string | null;
  boundaryAcquiredAt: Date | string | null;
  areaHa: number | null;
  claimedAreaHa?: number | null;
  hasPddFile?: boolean;
  pddFileName?: string | null;
  geojsonFileName?: string | null;
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

  let spatialMultiplier = 1.0;
  let carbonMultiplier = 1.0;
  let envMultiplier = 1.0;
  let scoreCap = 100;

  // ==========================================
  // 1. GEOGRAPHIC CONSISTENCY (15 Max)
  // ==========================================
  const qualityScore: Record<string, number> = {
    HIGH: MAX.geographic,
    MEDIUM: 12.0,
    LOW: 6.0,
    UNKNOWN: 3.0,
  };
  let geographicScore = input.boundaryPresent
    ? qualityScore[input.boundaryQuality ?? "UNKNOWN"] ?? qualityScore.UNKNOWN
    : 0;
  let geographicReason = input.boundaryPresent
    ? `Boundary provenance is ${input.boundaryQuality ?? "HIGH"}; measured area is ${measuredAreaHa.toFixed(1)} ha.`
    : "No project boundary is registered.";

  if (input.claimedAreaHa && input.claimedAreaHa > 0 && measuredAreaHa > 0) {
    const mismatchPct =
      (Math.abs(measuredAreaHa - input.claimedAreaHa) /
        Math.max(measuredAreaHa, input.claimedAreaHa)) *
      100;
    if (mismatchPct > 15) {
      geographicScore = Math.max(2.0, geographicScore * (1 - mismatchPct / 100));
      geographicReason = `Area discrepancy: claimed ${input.claimedAreaHa.toFixed(1)} ha diverges by ${mismatchPct.toFixed(1)}% from calculated GIS polygon (${measuredAreaHa.toFixed(1)} ha).`;
      
      const isCriticalMismatch = mismatchPct > 35;
      anomalies.push({
        type: "AREA_MISMATCH_DISCREPANCY",
        severity: isCriticalMismatch ? "CRITICAL" : "HIGH",
        message: `Claimed project area (${input.claimedAreaHa.toFixed(1)} ha) deviates by ${mismatchPct.toFixed(1)}% from measured GIS polygon boundary (${measuredAreaHa.toFixed(1)} ha).`,
      });

      if (isCriticalMismatch) {
        spatialMultiplier = Math.min(spatialMultiplier, 0.5);
        scoreCap = Math.min(scoreCap, 50);
      }
    }
  }

  // CRITICAL GATING: Missing or unverified geometry cannot support spatial attribution.
  if (!input.boundaryPresent || !input.boundaryHasGeometry) {
    geographicScore = 4.0;
    geographicReason = "Boundary geometry is missing or unverified. No spatial attribution possible.";
    anomalies.push({
      type: "APPROXIMATE_GEOMETRY",
      severity: "CRITICAL",
      message: "A complete GIS polygon boundary is missing. Carbon claims cannot be verified against physical land mass.",
    });

    // Severe gating penalty for missing or unverified geometry.
    spatialMultiplier = 0.32;
    scoreCap = 28.0;
  }

  // ==========================================
  // 2. CARBON CONSISTENCY (30 Max)
  // ==========================================
  let carbonScore = 22.0;
  let carbonReason = "No held quantity or positive project area is available to compare.";
  if (biomassDensity !== null) {
    // Normal biological density is around 50 - 150 tCO2e/ha
    const referenceDensity = 100;
    const deviation = Math.abs(biomassDensity - referenceDensity);
    carbonScore = MAX.carbon * clamp(1 - deviation / 250, 0.1, 1.0);
    carbonReason = `Calculated biomass density of ${biomassDensity.toFixed(1)} tCO2e/ha (${totalCredits.toLocaleString()} tCO2e across ${measuredAreaHa.toFixed(1)} ha) is consistent with biological baseline.`;

    if (biomassDensity > 350) {
      carbonScore = 4.0;
      carbonReason = `Excessive biomass claim: ${biomassDensity.toFixed(1)} tCO2e/ha exceeds biological capacity limits.`;
      anomalies.push({
        type: "EXCESSIVE_CARBON_DENSITY",
        severity: "CRITICAL",
        message: `Held inventory implies ${biomassDensity.toFixed(1)} tCO2e/ha, exceeding biological sequestration thresholds by >250%.`,
      });
      carbonMultiplier = 0.45;
      scoreCap = Math.min(scoreCap, 45);
    } else if (biomassDensity > 180) {
      anomalies.push({
        type: "ELEVATED_CARBON_DENSITY",
        severity: "MEDIUM",
        message: `Held inventory implies elevated density (${biomassDensity.toFixed(1)} tCO2e/ha) and merits human review.`,
      });
      carbonScore = Math.min(carbonScore, 20);
    }
  } else {
    carbonScore = 0.0;
    carbonMultiplier = 0.6;
    scoreCap = Math.min(scoreCap, 50);
  }

  // ==========================================
  // 3. DOCUMENT COMPLETENESS (15 Max)
  // ==========================================
  const documentParts: string[] = [];
  if (!hasPendingRegistry(input.registryId)) documentParts.push("registry reference");
  if (input.methodology?.trim()) documentParts.push("methodology");
  if (input.description?.trim()) documentParts.push("project description");
  if (input.hasPddFile || input.pddFileName?.trim()) documentParts.push("PDD file");
  const documentsScore = round((documentParts.length / 4) * MAX.documents);
  const documentsReason = documentParts.length > 0
    ? `Stored project documentation includes ${documentParts.join(", ")}.`
    : "No project documentation fields are available for verification.";

  // ==========================================
  // 4. ENVIRONMENTAL EVIDENCE CONSISTENCY (20 Max)
  // ==========================================
  let environmentalScore = 0.0;
  let environmentalReason = "No NASA FIRMS event evidence is linked to this project.";

  if (input.hasHighRiskIncident) {
    environmentalScore = 0.0;
    environmentalReason = "Active NASA FIRMS thermal hotspot and high-risk fire incident detected within project boundary.";
    anomalies.push({
      type: "THERMAL_HOTSPOT_OVERLAP",
      severity: "CRITICAL",
      message: "Active NASA FIRMS thermal hotspot observed within project perimeter.",
    });
    envMultiplier = 0.7;
    scoreCap = Math.min(scoreCap, 60);
  } else if (input.environmentalEvidenceCount > 0) {
    const sourceConfidence = clamp(
      input.environmentalSourceConfidence ?? 0.8,
      0,
      1,
    );
    environmentalScore = MAX.environmental * sourceConfidence;
    environmentalReason = `FIRMS monitoring active (${input.environmentalEvidenceCount} observations, ${Math.round(sourceConfidence * 100)}% confidence).`;
  } else {
    anomalies.push({
      type: "MISSING_ENVIRONMENTAL_EVIDENCE",
      severity: "MEDIUM",
      message: "No NASA FIRMS event evidence is linked to the project assessment.",
    });
  }

  // ==========================================
  // 5. SENSOR TELEMETRY AVAILABILITY (10 Max)
  // ==========================================
  // Sentinel-2 imagery and ground-sensor telemetry are P1 work, not P0 evidence.
  // Do not award a score for a data source that has not been ingested.
  const telemetryScore = 0.0;
  const telemetryReason = "No ground-sensor telemetry is available; this source is not part of the P0 assessment pipeline.";

  // ==========================================
  // 6. TEMPORAL CONSISTENCY (10 Max)
  // ==========================================
  let temporalScore = 7.0;
  let temporalReason = "Observation vintages and historical baseline registries align.";
  const timestamp = input.boundaryVerifiedAt ?? input.boundaryAcquiredAt ?? input.environmentalObservedAt;
  if (isValidDate(timestamp)) {
    const ageDays = Math.max(
      0,
      ((input.referenceAt ?? new Date()).getTime() - new Date(timestamp).getTime()),
    ) / (24 * 60 * 60 * 1000);
    temporalScore = 10 * clamp(1 - ageDays / 730, 0.4, 1);
    temporalReason = `The latest stored provenance timestamp is ${Math.round(ageDays)} days old.`;
  }

  const components = [
    component("GEOGRAPHIC_CONSISTENCY", "Geographic Consistency", geographicScore, MAX.geographic, geographicReason),
    component("CARBON_CONSISTENCY", "Carbon Consistency", carbonScore, MAX.carbon, carbonReason),
    component("DOCUMENT_COMPLETENESS", "Document Completeness", documentsScore, MAX.documents, documentsReason),
    component("ENVIRONMENTAL_EVIDENCE", "Environmental Evidence Consistency", environmentalScore, MAX.environmental, environmentalReason),
    component("SENSOR_CONSISTENCY", "Sensor Telemetry Availability", telemetryScore, MAX.telemetry, telemetryReason),
    component("TEMPORAL_CONSISTENCY", "Temporal Consistency", temporalScore, MAX.temporal, temporalReason),
  ];

  // Raw unweighted sum
  const rawSum = components.reduce((sum, current) => sum + current.weighted_score, 0);

  // Multi-modal gating calculation
  let truthScore: number;
  if (!input.boundaryPresent || !input.boundaryHasGeometry) {
    truthScore = 28.0;
  } else {
    truthScore = round(clamp(rawSum * spatialMultiplier * carbonMultiplier * envMultiplier, 0, scoreCap));
  }


  return {
    truthScore,
    confidence: input.boundaryHasGeometry
      ? input.environmentalEvidenceCount > 0 ? 0.95 : 0.75
      : 0.4,
    components,
    anomalies,
    measuredAreaHa,
    totalCredits,
    biomassDensity,
    environmentalSourceConfidence: input.environmentalSourceConfidence,
    environmentalEvidenceCount: input.environmentalEvidenceCount,
  };
}
