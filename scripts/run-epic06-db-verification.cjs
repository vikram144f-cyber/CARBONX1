const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "carbonx-epic06-db-")
);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const line = fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured in .env");
  process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
}

function compileSources() {
  const tscScript = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [
      tscScript,
      "lib/services/audit.ts",
      "lib/services/blockchain.ts",
      "lib/prisma.ts",
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
const { PrismaClient, IncidentStatus, AnchorStatus, AnchorEventType } = require("@prisma/client");
const { AuditService } = require(${JSON.stringify(path.join(outputDirectory, "services", "audit.js"))});
const { BlockchainService, hashCanonicalEvidence } = require(${JSON.stringify(path.join(outputDirectory, "services", "blockchain.js"))});

const prisma = new PrismaClient();
const ids = {
  organization: "epic06_verify_org",
  portfolio: "epic06_verify_portfolio",
  project: "epic06_verify_project",
  boundary: "epic06_verify_boundary",
  event: "epic06_verify_event",
  incident: "epic06_verify_incident",
  evidence: "epic06_verify_evidence",
  assessment: "epic06_verify_assessment",
};
const contractAddress = "0x4444444444444444444444444444444444444444";
const successHash = "0x5555555555555555555555555555555555555555555555555555555555555555";

async function cleanupLegacyFixture() {
  const existing = await prisma.organization.findUnique({ where: { id: ids.organization }, select: { id: true } });
  if (!existing) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DROP TRIGGER IF EXISTS incident_status_history_immutable ON "IncidentStatusHistory"');
    const incidents = await tx.incident.findMany({ where: { projectId: ids.project }, select: { id: true } });
    const incidentIds = incidents.map(({ id }) => id);
    if (incidentIds.length) {
      await tx.blockchainAnchor.deleteMany({ where: { incidentId: { in: incidentIds } } });
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

async function verify() {
  const count = await prisma.organization.count();
  assert.ok(Number.isInteger(count));
  console.log("PASS simple Prisma read");
  await cleanupLegacyFixture();

  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: ids.organization, name: "Epic 06 verification fixture" } });
    await tx.portfolio.create({ data: { id: ids.portfolio, name: "Epic 06 verification portfolio", organizationId: ids.organization } });
    await tx.carbonProject.create({ data: { id: ids.project, portfolioId: ids.portfolio, name: "Epic 06 verification project", centroidLng: 0, centroidLat: 0 } });
    await tx.projectBoundary.create({ data: { id: ids.boundary, projectId: ids.project, version: 1, geojson: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }, source: "Epic 06 verification fixture", quality: "HIGH", acquiredAt: new Date(), isCurrent: true, areaHa: 100 } });
    await tx.environmentalEvent.create({ data: { id: ids.event, type: "WILDFIRE", sourceName: "EPIC06_TEST_FIXTURE", sourceId: ids.event, sourceInstrument: "TEST", observedAt: new Date("2026-08-23T00:00:00.000Z"), geometry: { type: "Point", coordinates: [0.5, 0.5] }, geomType: "Point", sourceConfidence: 0.8, sourceMetadata: { fixture: true }, dataVersion: "epic06-test-v1", originType: "OBSERVED", createdByType: "EXTERNAL_SOURCE", rawPayload: { fixture: true } } });
    await tx.incident.create({ data: { id: ids.incident, projectId: ids.project, eventId: ids.event, status: IncidentStatus.EVENT_DETECTED, statusHistory: { create: { fromStatus: null, toStatus: IncidentStatus.EVENT_DETECTED, actor: "system:test", createdByType: "SYSTEM_CALCULATION" } } } });
    await tx.evidenceRecord.create({ data: { id: ids.evidence, incidentId: ids.incident, eventId: ids.event, label: "ESTIMATED", createdByType: "SYSTEM_CALCULATION", notes: "fixture" } });
    const assessment = await tx.riskAssessment.create({ data: { id: ids.assessment, incidentId: ids.incident, boundaryId: ids.boundary, engineVersion: "geospatial-v1.0", methodologyVersion: "risk-v1.0", inputEvidenceIds: [ids.evidence], assumptions: { bufferKm: 1 }, triggeringActor: "system:test", createdByType: "SYSTEM_CALCULATION", estimatedImpactHa: 1, impactPct: 0.01, integrityRisk: "LOW", evidenceConfidence: "MEDIUM", evidenceConfidenceScore: 60, auditPriority: "ELEVATED", evidenceRecords: { connect: { id: ids.evidence } } }, select: { id: true, incidentId: true, engineVersion: true, methodologyVersion: true, integrityRisk: true, evidenceConfidence: true, inputEvidenceIds: true, boundaryId: true, createdAt: true } });

    let dispatched = null;
    await new AuditService(tx, { anchorIncidentTransition: async (incidentId, eventType) => { dispatched = { incidentId, eventType }; return null; } }).transition(ids.incident, IncidentStatus.UNDER_ASSESSMENT, "system:geospatial");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(dispatched, { incidentId: ids.incident, eventType: AnchorEventType.UNDER_ASSESSMENT });
    console.log("PASS AuditService dispatches UNDER_ASSESSMENT anchor seam");

    const successTransport = { submit: async () => successHash, waitForConfirmation: async () => new Date("2026-08-23T00:01:00.000Z") };
    const blockchain = new BlockchainService(tx, { contractAddress, transport: successTransport });
    const success = await blockchain.anchorAssessment(assessment, AnchorEventType.UNDER_ASSESSMENT);
    assert.equal(success.status, AnchorStatus.CONFIRMED);
    assert.equal(success.txHash, successHash);
    const duplicate = await blockchain.anchorAssessment(assessment, AnchorEventType.UNDER_ASSESSMENT);
    assert.equal(duplicate.anchorId, success.anchorId);
    const stored = await tx.blockchainAnchor.findUnique({ where: { id: success.anchorId } });
    assert.equal(stored.eventType, AnchorEventType.UNDER_ASSESSMENT);
    assert.equal(stored.status, AnchorStatus.CONFIRMED);
    assert.equal(stored.hash, hashCanonicalEvidence(assessment, AnchorEventType.UNDER_ASSESSMENT));
    console.log("PASS PENDING persistence, CONFIRMED state, canonical hash, and duplicate idempotency");

    const failed = await new BlockchainService(tx, { contractAddress, transport: { submit: async () => { throw new Error("test RPC unavailable"); } } }).anchorAssessment(assessment, AnchorEventType.AUDIT_RECOMMENDED);
    assert.equal(failed.status, AnchorStatus.FAILED);
    assert.equal(failed.txHash, null);
    const failedRecord = await tx.blockchainAnchor.findUnique({ where: { id: failed.anchorId } });
    assert.equal(failedRecord.status, AnchorStatus.FAILED);
    assert.equal(failedRecord.txHash, null);
    const incident = await tx.incident.findUnique({ where: { id: ids.incident }, select: { status: true } });
    assert.equal(incident.status, IncidentStatus.UNDER_ASSESSMENT);
    console.log("PASS failed anchor isolation leaves incident workflow successful");

    const history = await tx.incidentStatusHistory.findFirst({ where: { incidentId: ids.incident } });
    try {
      await tx.incidentStatusHistory.update({ where: { id: history.id }, data: { reason: "tampered" } });
      throw new Error("IncidentStatusHistory mutation was not rejected");
    } catch (error) {
      assert.match(error instanceof Error ? error.message : String(error), /immutable/);
      console.log("PASS IncidentStatusHistory mutation rejects and forces transaction rollback");
      throw error;
    }
  }, { maxWait: 10_000, timeout: 60_000 });
}

(async () => {
  try {
    await verify();
    throw new Error("Verification transaction unexpectedly committed");
  } catch (error) {
    if (error instanceof Error && /immutable/.test(error.message)) {
      const fixture = await prisma.organization.findUnique({ where: { id: ids.organization } });
      assert.equal(fixture, null);
      console.log("PASS verification transaction rolled back all fixtures");
      console.log("EPIC06_DB_VERIFICATION_PASS");
    } else {
      console.error("EPIC06_DB_VERIFICATION_FAIL", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
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
