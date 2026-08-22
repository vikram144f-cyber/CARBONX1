import assert from "node:assert/strict";
import test from "node:test";

import { incidentResponseSchema } from "../lib/validations/incidents";
import {
  calculateSceneBounds,
  clampScenePosition,
  projectBoundaryToScene,
} from "../lib/utils/geo-to-scene";
import {
  advanceInvestigationMode,
  findInvestigationHotspot,
} from "../features/investigation-3d/interaction-state";
import { mapIncidentToSceneState } from "../features/investigation-3d/scene-state";
import { isWebGLAvailable } from "../features/investigation-3d/webgl";

const fixture = (withAssessment = true) => incidentResponseSchema.parse({
  id: "incident-3d",
  projectId: "project-3d",
  eventId: "event-3d",
  status: "UNDER_ASSESSMENT",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:01:00.000Z",
  project: {
    id: "project-3d",
    name: "Verified Forest Project",
    registryId: "VCS-3D",
    countryCode: "BR",
    centroidLng: -60,
    centroidLat: -3,
    currentBoundary: {
      id: "boundary-3d",
      version: 2,
      geojson: {
        type: "Polygon",
        coordinates: [[[-60.01, -3.01], [-59.99, -3.01], [-59.99, -2.99], [-60.01, -2.99], [-60.01, -3.01]]],
      },
      source: "Public registry boundary",
      sourceUrl: "https://example.test/project-boundary",
      quality: "HIGH",
      verifiedAt: "2026-08-22T00:00:00.000Z",
      areaHa: 100,
      isCurrent: true,
    },
  },
  event: {
    id: "event-3d",
    type: "WILDFIRE",
    sourceName: "NASA FIRMS",
    sourceId: "firms-3d",
    sourceInstrument: "VIIRS",
    observedAt: "2026-08-22T12:00:00.000Z",
    acquiredAt: "2026-08-22T12:10:00.000Z",
    geometry: { type: "Point", coordinates: [-60, -3] },
    geomType: "Point",
    sourceConfidence: 0.82,
    sourceMetadata: null,
    dataVersion: "v1",
    originType: "OBSERVED",
    createdByType: "EXTERNAL_SOURCE",
  },
  latestAssessment: withAssessment ? {
    id: "assessment-3d",
    boundaryId: "boundary-3d",
    engineVersion: "geospatial-v1",
    methodologyVersion: "risk-v1",
    inputEvidenceIds: ["evidence-3d"],
    assumptions: { bufferKm: 1 },
    triggeringActor: "system:geospatial",
    createdByType: "SYSTEM_CALCULATION",
    estimatedImpactHa: 2.4,
    impactPct: 0.024,
    creditExposure: null,
    financialExposureEst: null,
    financialCurrency: null,
    valuationBasis: null,
    integrityRisk: "LOW",
    evidenceConfidence: "HIGH",
    evidenceConfidenceScore: 82,
    auditPriority: "ROUTINE",
    uncertaintyNotes: "Buffered point estimate.",
    supersededById: null,
    createdAt: "2026-08-23T00:01:00.000Z",
    aiReport: null,
    evidence: [{
      id: "evidence-3d",
      label: "ESTIMATED",
      createdByType: "SYSTEM_CALCULATION",
      sourceConfidence: 0.82,
      notes: "Buffered FIRMS point estimate.",
      createdAt: "2026-08-23T00:01:00.000Z",
    }],
  } : null,
  evidence: [],
  anchors: [],
  statusHistory: [],
});

test("WebGL detection supports graceful fallback decisions", () => {
  assert.equal(isWebGLAvailable(() => ({ getContext: () => null })), false);
  assert.equal(isWebGLAvailable(() => ({ getContext: (kind) => kind === "webgl" ? {} : null })), true);
  assert.equal(isWebGLAvailable(() => { throw new Error("context denied"); }), false);
});

test("scene-state mapping preserves real boundary, event, risk, and provenance", () => {
  const state = mapIncidentToSceneState(fixture());
  assert.equal(state.project.boundary?.id, "boundary-3d");
  assert.deepEqual(state.project.centroid, [-60, -3]);
  assert.deepEqual(state.event.coordinate, [-60, -3]);
  assert.equal(state.assessment?.estimatedImpactHa, 2.4);
  assert.equal(state.assessment?.evidenceLabel, "ESTIMATED");
  assert.equal(state.anomalyVisible, true);
  assert.deepEqual(state.hotspots.map((hotspot) => hotspot.kind), ["OBSERVED", "RISK", "EVIDENCE"]);
});

test("scene never fabricates an anomaly when deterministic impact is absent", () => {
  const state = mapIncidentToSceneState(fixture(false));
  assert.equal(state.anomalyVisible, false);
  assert.equal(state.assessment, null);
  assert.deepEqual(state.hotspots.map((hotspot) => hotspot.kind), ["OBSERVED"]);
});

test("cinematic flow skips or completes into bounded exploration", () => {
  assert.equal(advanceInvestigationMode("cinematic", "skip"), "explore");
  assert.equal(advanceInvestigationMode("cinematic", "complete"), "explore");
  assert.equal(advanceInvestigationMode("explore", "complete"), "explore");
  const bounds = calculateSceneBounds([[[-3, -2], [4, -2], [4, 5]]]);
  assert.deepEqual(clampScenePosition([-99, 99, 99], bounds), [bounds.minX, 18, bounds.maxZ]);
});

test("boundary projection and hotspot selection remain deterministic", () => {
  const state = mapIncidentToSceneState(fixture());
  const rings = projectBoundaryToScene(state.project.boundary?.geojson, state.project.centroid);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 5);
  const selected = findInvestigationHotspot(state.hotspots, "risk-assessment-3d");
  assert.equal(selected?.kind, "RISK");
  assert.equal(findInvestigationHotspot(state.hotspots, "missing"), null);
});
