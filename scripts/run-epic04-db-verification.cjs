const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "carbonx-epic04-db-")
);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const line = fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured in .env");
  process.env.DATABASE_URL = line
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^"|"$/g, "");
}

function compileSources() {
  const tscScript = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const sources = [
    "lib/services/audit.ts",
    "lib/services/geospatial.ts",
    "lib/services/incidents.ts",
    "lib/services/risk-engine.ts",
    "lib/prisma.ts",
    "lib/turf.d.ts",
    "lib/validations/incidents.ts",
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
const { PrismaClient, IncidentStatus } = require("@prisma/client");
const { point, polygon } = require("@turf/turf");
const { AuditService, InvalidTransitionError } = require(${JSON.stringify(
      path.join(outputDirectory, "services", "audit.js")
    )});
const { GeospatialRiskService } = require(${JSON.stringify(
      path.join(outputDirectory, "services", "geospatial.js")
    )});
const { IncidentService } = require(${JSON.stringify(
      path.join(outputDirectory, "services", "incidents.js")
    )});
const { incidentResponseSchema } = require(${JSON.stringify(
      path.join(outputDirectory, "validations", "incidents.js")
    )});

process.env.FIRMS_POINT_BUFFER_KM = process.env.FIRMS_POINT_BUFFER_KM || "1";
const prisma = new PrismaClient();
const ids = {
  organization: "epic04_verify_org",
  portfolio: "epic04_verify_portfolio",
  project: "epic04_verify_project",
  boundary: "epic04_verify_boundary",
  event: "epic04_verify_event",
};

function squareAt(lng, lat, halfSize = 0.01) {
  return polygon([[
    [lng - halfSize, lat - halfSize],
    [lng - halfSize, lat + halfSize],
    [lng + halfSize, lat + halfSize],
    [lng + halfSize, lat - halfSize],
    [lng - halfSize, lat - halfSize],
  ]]).geometry;
}

async function cleanupLegacyFixture() {
  const existing = await prisma.organization.findUnique({ where: { id: ids.organization }, select: { id: true } });
  if (!existing) return;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DROP TRIGGER IF EXISTS incident_status_history_immutable ON "IncidentStatusHistory"');
    const incidents = await tx.incident.findMany({ where: { projectId: ids.project }, select: { id: true } });
    const incidentIds = incidents.map(({ id }) => id);
    if (incidentIds.length) {
      await tx.riskAssessment.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await tx.evidenceRecord.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await tx.incidentStatusHistory.deleteMany({ where: { incidentId: { in: incidentIds } } });
      await tx.incident.deleteMany({ where: { id: { in: incidentIds } } });
    }
    await tx.environmentalEvent.deleteMany({ where: { id: ids.event } });
    await tx.projectBoundary.deleteMany({ where: { id: ids.boundary } });
    await tx.carbonProject.deleteMany({ where: { id: ids.project } });
    await tx.portfolio.deleteMany({ where: { id: ids.portfolio } });
    await tx.organization.deleteMany({ where: { id: ids.organization } });
    await tx.$executeRawUnsafe('CREATE TRIGGER incident_status_history_immutable BEFORE UPDATE OR DELETE ON "IncidentStatusHistory" FOR EACH ROW EXECUTE FUNCTION prevent_incident_status_history_mutation()');
  }, { maxWait: 10_000, timeout: 30_000 });
}

async function verifyInsideTransaction() {
  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: ids.organization, name: "Epic 04 verification fixture" } });
    await tx.portfolio.create({ data: { id: ids.portfolio, name: "Epic 04 verification portfolio", organizationId: ids.organization } });
    await tx.carbonProject.create({ data: { id: ids.project, portfolioId: ids.portfolio, name: "Epic 04 verification project", centroidLng: 0, centroidLat: 0 } });
    await tx.projectBoundary.create({ data: { id: ids.boundary, projectId: ids.project, version: 1, geojson: squareAt(0, 0), source: "Epic 04 verification fixture", quality: "HIGH", acquiredAt: new Date(), isCurrent: true, areaHa: 100 } });
    await tx.environmentalEvent.create({ data: { id: ids.event, type: "WILDFIRE", sourceName: "EPIC04_TEST_FIXTURE", sourceId: ids.event, sourceInstrument: "TEST", observedAt: new Date("2026-08-23T00:00:00.000Z"), geometry: point([0, 0]).geometry, geomType: "Point", sourceConfidence: 0.8, sourceMetadata: { fixture: true }, dataVersion: "epic04-test-v1", originType: "OBSERVED", createdByType: "EXTERNAL_SOURCE", rawPayload: { fixture: true } } });

    const geospatial = new GeospatialRiskService(tx);
    const first = await geospatial.processEvent(ids.event);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.assessments.length, 1);
    const incidentId = first.assessments[0].incidentId;
    const second = await geospatial.processEvent(ids.event);
    assert.equal(second.status, "COMPLETED");
    assert.equal(second.assessments[0].assessmentId, first.assessments[0].assessmentId);
    assert.equal(second.assessments[0].idempotent, true);
    console.log("PASS Epic 03 overlap handoff creates one incident and is idempotent");

    const incident = await tx.incident.findUnique({ where: { id: incidentId }, include: { statusHistory: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
    assert.ok(incident);
    assert.equal(incident.status, IncidentStatus.UNDER_ASSESSMENT);
    assert.equal(incident.statusHistory.length, 2);
    assert.equal(incident.statusHistory[0].fromStatus, null);
    assert.equal(incident.statusHistory[0].toStatus, IncidentStatus.EVENT_DETECTED);
    assert.equal(incident.statusHistory[1].fromStatus, IncidentStatus.EVENT_DETECTED);
    assert.equal(incident.statusHistory[1].toStatus, IncidentStatus.UNDER_ASSESSMENT);
    assert.equal(incident.statusHistory[0].createdByType, "SYSTEM_CALCULATION");
    console.log("PASS EVENT_DETECTED and UNDER_ASSESSMENT history entries");

    const invalidBefore = await tx.incidentStatusHistory.count({ where: { incidentId } });
    await assert.rejects(new AuditService(tx).transition(incidentId, IncidentStatus.RESOLVED, "user:test"), InvalidTransitionError);
    const invalidAfter = await tx.incidentStatusHistory.count({ where: { incidentId } });
    const unchanged = await tx.incident.findUnique({ where: { id: incidentId }, select: { status: true } });
    assert.equal(invalidAfter, invalidBefore);
    assert.equal(unchanged.status, IncidentStatus.UNDER_ASSESSMENT);
    console.log("PASS invalid transition is rejected without writes");

    const audit = new AuditService(tx);
    await audit.transition(incidentId, IncidentStatus.AUDIT_RECOMMENDED, "user:test");
    await audit.transition(incidentId, IncidentStatus.AUDIT_IN_PROGRESS, "user:test");
    await audit.transition(incidentId, IncidentStatus.RESOLVED, "user:test");
    await audit.transition(incidentId, IncidentStatus.REOPENED, "user:test");
    await audit.transition(incidentId, IncidentStatus.UNDER_ASSESSMENT, "system:reopen");
    const finalIncident = await tx.incident.findUnique({ where: { id: incidentId }, include: { statusHistory: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
    assert.equal(finalIncident.status, IncidentStatus.UNDER_ASSESSMENT);
    assert.equal(finalIncident.statusHistory.length, 7);
    console.log("PASS all valid lifecycle transitions and ordered timeline");

    const dto = await new IncidentService(tx).getById(incidentId);
    const parsed = incidentResponseSchema.parse(dto);
    assert.equal(parsed.id, incidentId);
    assert.equal(parsed.project.id, ids.project);
    assert.equal(parsed.event.id, ids.event);
    assert.equal(parsed.latestAssessment?.createdByType, "SYSTEM_CALCULATION");
    assert.equal(parsed.evidence[0].label, "ESTIMATED");
    assert.deepEqual(parsed.statusHistory.map((entry) => entry.toStatus), ["EVENT_DETECTED", "UNDER_ASSESSMENT", "AUDIT_RECOMMENDED", "AUDIT_IN_PROGRESS", "RESOLVED", "REOPENED", "UNDER_ASSESSMENT"]);
    console.log("PASS incident DTO and response schema include context, assessment, provenance, and timeline");

    const historyId = finalIncident.statusHistory[0].id;
    await assert.rejects(tx.incidentStatusHistory.update({ where: { id: historyId }, data: { reason: "tampered" } }), /immutable/);
    console.log("PASS IncidentStatusHistory rejects mutation at the database boundary");
  }, { maxWait: 10_000, timeout: 60_000 }).catch((error) => {
    if (error instanceof Error && /immutable/.test(error.message)) return;
    throw error;
  });
}

(async () => {
  try {
    const organizationCount = await prisma.organization.count();
    assert.ok(Number.isInteger(organizationCount));
    console.log("PASS simple Prisma read");
    await cleanupLegacyFixture();
    await verifyInsideTransaction();
    console.log("PASS transaction rolled back all verification fixtures");
    console.log("EPIC04_DB_VERIFICATION_PASS");
  } catch (error) {
    console.error("EPIC04_DB_VERIFICATION_FAIL", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
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
  const result = spawnSync(process.execPath, ["--conditions=react-server", runnerPath], { cwd: root, stdio: "inherit", env: { ...process.env, NODE_PATH: path.join(root, "node_modules"), NODE_ENV: "development" } });
  process.exit(result.status ?? 1);
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}
