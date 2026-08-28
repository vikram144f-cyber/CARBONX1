const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "carbonx-epic03-db-")
);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(root, ".env");
  const line = fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured in .env");
  process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
}

function compileSources() {
  const tscScript = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const sources = [
    "lib/services/geospatial.ts",
    "lib/services/risk-engine.ts",
    "lib/services/event-processing.ts",
    "lib/prisma.ts",
    "lib/turf.d.ts",
  ];
  const result = spawnSync(
    process.execPath,
    [
      tscScript,
      ...sources,
      "--module",
      "commonjs",
      "--target",
      "es2022",
      "--outDir",
      outputDirectory,
      "--esModuleInterop",
      "--skipLibCheck",
      "--strict",
      "--moduleResolution",
      "node",
      "--types",
      "node",
      "--noEmitOnError",
    ],
    { cwd: root, stdio: "inherit" }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeRunner() {
  const runnerPath = path.join(outputDirectory, "verify.cjs");
  fs.writeFileSync(
    runnerPath,
    String.raw`const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { point, polygon, area } = require("@turf/turf");
const { GeospatialRiskService } = require(${JSON.stringify(
      path.join(outputDirectory, "services", "geospatial.js")
    )});

process.env.FIRMS_POINT_BUFFER_KM = process.env.FIRMS_POINT_BUFFER_KM || "1";
const prisma = new PrismaClient();
const ids = {
  organization: "epic03_verify_org",
  portfolio: "epic03_verify_portfolio",
  project: "epic03_verify_project",
  noHoldingsProject: "epic03_verify_no_holdings_project",
  badProject: "epic03_verify_bad_project",
  zeroProject: "epic03_verify_zero_project",
  boundary: "epic03_verify_boundary",
  noHoldingsBoundary: "epic03_verify_no_holdings_boundary",
  badBoundary: "epic03_verify_bad_boundary",
  zeroBoundary: "epic03_verify_zero_boundary",
  holdingOne: "epic03_verify_holding_one",
  holdingTwo: "epic03_verify_holding_two",
  outsideEvent: "epic03_verify_outside_event",
  edgeEvent: "epic03_verify_edge_event",
  insideEvent: "epic03_verify_inside_event",
  noHoldingsEvent: "epic03_verify_no_holdings_event",
  invalidEvent: "epic03_verify_invalid_event",
};
const projectIds = [
  ids.project,
  ids.noHoldingsProject,
  ids.badProject,
  ids.zeroProject,
];
const eventIds = [
  ids.outsideEvent,
  ids.edgeEvent,
  ids.insideEvent,
  ids.noHoldingsEvent,
  ids.invalidEvent,
];

const squareAt = (lng, lat, halfSize = 0.01) => polygon([[
  [lng - halfSize, lat - halfSize],
  [lng - halfSize, lat + halfSize],
  [lng + halfSize, lat + halfSize],
  [lng + halfSize, lat - halfSize],
  [lng - halfSize, lat - halfSize],
]]).geometry;

async function cleanup() {
  const incidents = await prisma.incident.findMany({
    where: { projectId: { in: projectIds } },
    select: { id: true },
  });
  const incidentIds = incidents.map(({ id }) => id);
  if (incidentIds.length) {
    await prisma.aIReport.deleteMany({ where: { assessment: { incidentId: { in: incidentIds } } } });
    await prisma.blockchainAnchor.deleteMany({ where: { incidentId: { in: incidentIds } } });
    await prisma.riskAssessment.deleteMany({ where: { incidentId: { in: incidentIds } } });
    await prisma.evidenceRecord.deleteMany({ where: { incidentId: { in: incidentIds } } });
    await prisma.incidentStatusHistory.deleteMany({ where: { incidentId: { in: incidentIds } } });
    await prisma.incident.deleteMany({ where: { id: { in: incidentIds } } });
  }
  await prisma.environmentalEvent.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.creditHolding.deleteMany({ where: { id: { in: [ids.holdingOne, ids.holdingTwo] } } });
  await prisma.projectBoundary.deleteMany({ where: { id: { in: [ids.boundary, ids.noHoldingsBoundary, ids.badBoundary, ids.zeroBoundary] } } });
  await prisma.carbonProject.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.portfolio.deleteMany({ where: { id: ids.portfolio } });
  await prisma.organization.deleteMany({ where: { id: ids.organization } });
}

async function main() {
  const readCount = await prisma.organization.count();
  assert.ok(Number.isInteger(readCount), "simple Prisma read returned a count");
  console.log("PASS simple Prisma read");

  const seeded = await prisma.carbonProject.findMany({
    where: { id: { in: ["project_vcs2386", "project_vcs2547"] } },
    include: { boundaries: { where: { isCurrent: true } } },
  });
  assert.equal(seeded.length, 2, "both seeded projects exist");
  assert.ok(seeded.every((project) => project.boundaries.length > 0), "seeded projects have current boundaries");
  console.log("PASS seeded public projects and current boundaries");

  const configuredBufferKm = Number(process.env.FIRMS_POINT_BUFFER_KM);
  assert.ok(Number.isFinite(configuredBufferKm) && configuredBufferKm > 0, "FIRMS_POINT_BUFFER_KM is valid");
  console.log("PASS FIRMS_POINT_BUFFER_KM configuration");

  await cleanup();
  await prisma.organization.create({ data: { id: ids.organization, name: "Epic 03 verification fixture" } });
  await prisma.portfolio.create({ data: { id: ids.portfolio, name: "Epic 03 verification portfolio", organizationId: ids.organization } });
  await prisma.carbonProject.createMany({
    data: [
      { id: ids.project, portfolioId: ids.portfolio, name: "Epic 03 fixture project", centroidLng: 0, centroidLat: 0 },
      { id: ids.noHoldingsProject, portfolioId: ids.portfolio, name: "Epic 03 no holdings fixture", centroidLng: 1, centroidLat: 1 },
      { id: ids.badProject, portfolioId: ids.portfolio, name: "Epic 03 malformed boundary fixture", centroidLng: 2, centroidLat: 2 },
      { id: ids.zeroProject, portfolioId: ids.portfolio, name: "Epic 03 zero area fixture", centroidLng: 3, centroidLat: 3 },
    ],
  });
  const coreGeometry = squareAt(0, 0);
  await prisma.projectBoundary.createMany({
    data: [
      { id: ids.boundary, projectId: ids.project, version: 1, geojson: coreGeometry, source: "Epic 03 verification fixture", quality: "HIGH", acquiredAt: new Date(), isCurrent: true, areaHa: 100 },
      { id: ids.noHoldingsBoundary, projectId: ids.noHoldingsProject, version: 1, geojson: squareAt(1, 1), source: "Epic 03 verification fixture", quality: "MEDIUM", acquiredAt: new Date(), isCurrent: true, areaHa: 100 },
      { id: ids.badBoundary, projectId: ids.badProject, version: 1, geojson: { type: "LineString", coordinates: [] }, source: "Epic 03 verification fixture", quality: "UNKNOWN", acquiredAt: new Date(), isCurrent: true, areaHa: 100 },
      { id: ids.zeroBoundary, projectId: ids.zeroProject, version: 1, geojson: squareAt(3, 3), source: "Epic 03 verification fixture", quality: "LOW", acquiredAt: new Date(), isCurrent: true, areaHa: 0 },
    ],
  });
  await prisma.creditHolding.createMany({
    data: [
      { id: ids.holdingOne, projectId: ids.project, heldQuantity: 100, issuedQuantity: 100, refValuePerUnit: 10, refCurrency: "USD", valuationBasis: "epic03-test", status: "ACTIVE" },
      { id: ids.holdingTwo, projectId: ids.project, heldQuantity: 50, issuedQuantity: 50, refValuePerUnit: 20, refCurrency: "USD", valuationBasis: "epic03-test", status: "ACTIVE" },
    ],
  });
  const eventData = (id, geometry) => ({
    id,
    type: "WILDFIRE",
    sourceName: "EPIC03_TEST_FIXTURE",
    sourceId: id,
    sourceInstrument: "TEST",
    observedAt: new Date("2026-08-23T00:00:00.000Z"),
    geometry,
    geomType: geometry.type,
    sourceConfidence: 0.8,
    sourceMetadata: { fixture: true },
    dataVersion: "epic03-test-v1",
    originType: "OBSERVED",
    createdByType: "EXTERNAL_SOURCE",
    rawPayload: { fixture: true },
  });
  await prisma.environmentalEvent.createMany({
    data: [
      eventData(ids.outsideEvent, point([5, 5]).geometry),
      eventData(ids.edgeEvent, point([0.018, 0]).geometry),
      eventData(ids.insideEvent, point([0, 0]).geometry),
      eventData(ids.noHoldingsEvent, point([1, 1]).geometry),
      eventData(ids.invalidEvent, { type: "Polygon", coordinates: [] }),
    ],
  });

  const service = new GeospatialRiskService();
  const outside = await service.processEvent(ids.outsideEvent);
  assert.equal(outside.status, "NO_OVERLAP");
  console.log("PASS event far outside buffer has no assessment");

  const edge = await service.processEvent(ids.edgeEvent);
  assert.equal(edge.status, "COMPLETED");
  assert.equal(edge.assessments.length, 1);
  const edgeAssessment = edge.assessments[0];
  assert.ok(edgeAssessment.overlapHa > 0);
  assert.ok(Math.abs(edgeAssessment.impactPct - edgeAssessment.overlapHa / 100) < 1e-12);
  assert.equal(edgeAssessment.idempotent, false);
  console.log("PASS edge overlap is detected and impactPct is deterministic");

  const edgeRepeat = await service.processEvent(ids.edgeEvent);
  assert.equal(edgeRepeat.status, "COMPLETED");
  assert.equal(edgeRepeat.assessments[0].assessmentId, edgeAssessment.assessmentId);
  assert.equal(edgeRepeat.assessments[0].idempotent, true);
  console.log("PASS repeated processing is idempotent");

  const inside = await service.processEvent(ids.insideEvent);
  assert.equal(inside.status, "COMPLETED");
  assert.ok(inside.assessments[0].overlapHa > 0);
  const expectedImpactPct = inside.assessments[0].impactPct;
  const persisted = await prisma.riskAssessment.findUnique({
    where: { id: inside.assessments[0].assessmentId },
    include: { evidenceRecords: true, incident: { include: { statusHistory: true } } },
  });
  assert.ok(persisted);
  assert.equal(persisted.createdByType, "SYSTEM_CALCULATION");
  assert.equal(persisted.engineVersion, "geospatial-v1.0");
  assert.equal(persisted.methodologyVersion, "risk-v1.0");
  assert.equal(persisted.evidenceRecords[0].label, "ESTIMATED");
  assert.equal(persisted.evidenceRecords[0].createdByType, "SYSTEM_CALCULATION");
  assert.equal(persisted.incident.status, "EVENT_DETECTED");
  assert.equal(persisted.incident.statusHistory.length, 1);
  assert.equal(persisted.incident.statusHistory[0].toStatus, "EVENT_DETECTED");
  assert.ok(Math.abs(persisted.creditExposure - 150 * expectedImpactPct) < 1e-9);
  assert.ok(Math.abs(persisted.financialExposureEst - (100 * expectedImpactPct * 10 + 50 * expectedImpactPct * 20)) < 1e-9);
  console.log("PASS inside overlap, aggregate exposure, provenance, and Epic 04 handoff state");

  const noHoldings = await service.processEvent(ids.noHoldingsEvent);
  assert.equal(noHoldings.status, "COMPLETED");
  const noHoldingsAssessment = await prisma.riskAssessment.findUnique({ where: { id: noHoldings.assessments[0].assessmentId } });
  assert.ok(noHoldingsAssessment);
  assert.equal(noHoldingsAssessment.creditExposure, null);
  assert.equal(noHoldingsAssessment.financialExposureEst, null);
  console.log("PASS missing holdings do not invent exposure");

  const invalid = await service.processEvent(ids.invalidEvent);
  assert.equal(invalid.status, "INVALID_EVENT_GEOMETRY");
  const malformedBoundaryEvent = await service.processEvent(ids.noHoldingsEvent);
  assert.equal(malformedBoundaryEvent.status, "COMPLETED");
  assert.ok(malformedBoundaryEvent.skippedBoundaries >= 2);
  console.log("PASS invalid event, malformed boundary, and zero-area boundary are handled safely");

  const assessmentCount = await prisma.riskAssessment.count({ where: { incident: { projectId: { in: projectIds } } } });
  assert.equal(assessmentCount, 3);
  console.log("PASS database assessment count is consistent after repeat processing");
}

(async () => {
  try {
    await main();
    console.log("EPIC03_DB_VERIFICATION_PASS");
  } catch (error) {
    console.error("EPIC03_DB_VERIFICATION_FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      console.error("EPIC03_DB_CLEANUP_FAIL", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }
})();
`,
    "utf8"
  );
  return runnerPath;
}

try {
  loadDatabaseUrl();
  compileSources();
  const runnerPath = writeRunner();
  const result = spawnSync(
    process.execPath,
    ["--conditions=react-server", runnerPath],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_PATH: path.join(root, "node_modules"),
        NODE_ENV: "development",
      },
    }
  );
  process.exit(result.status ?? 1);
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}
