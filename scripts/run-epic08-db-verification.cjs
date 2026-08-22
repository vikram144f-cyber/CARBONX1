const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "carbonx-epic08-db-"));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const line = fs.readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL is not configured in .env");
  process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
}

function compileSources() {
  const result = spawnSync(process.execPath, [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "lib/services/audit.ts",
    "lib/services/blockchain.ts",
    "lib/prisma.ts",
    "--module", "commonjs", "--target", "es2022", "--outDir", outputDirectory,
    "--esModuleInterop", "--skipLibCheck", "--strict", "--moduleResolution", "node",
    "--types", "node", "--noEmitOnError",
  ], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeRunner() {
  const runnerPath = path.join(outputDirectory, "verify.cjs");
  fs.writeFileSync(runnerPath, String.raw`const assert = require("node:assert/strict");
const { PrismaClient, AnchorEventType, AnchorStatus, CreatedByType, IncidentStatus } = require("@prisma/client");
const { AuditService } = require(${JSON.stringify(path.join(outputDirectory, "services", "audit.js"))});
const { BlockchainService } = require(${JSON.stringify(path.join(outputDirectory, "services", "blockchain.js"))});

const prisma = new PrismaClient();
const suffix = Date.now().toString();
const ids = {
  organization: "epic08_verify_org_" + suffix,
  portfolio: "epic08_verify_portfolio_" + suffix,
  project: "epic08_verify_project_" + suffix,
  boundary: "epic08_verify_boundary_" + suffix,
  event: "epic08_verify_event_" + suffix,
  invalidEvent: "epic08_verify_invalid_event_" + suffix,
  incident: "epic08_verify_incident_" + suffix,
  evidence: "epic08_verify_evidence_" + suffix,
  assessment: "epic08_verify_assessment_" + suffix,
  invalidIncident: "epic08_verify_invalid_incident_" + suffix,
  invalidHistory: "epic08_verify_invalid_history_" + suffix,
};

async function verify() {
  assert.ok(Number.isInteger(await prisma.organization.count()));
  console.log("PASS simple Prisma read");

  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: ids.organization, name: "Epic 08 verification fixture" } });
    await tx.portfolio.create({ data: { id: ids.portfolio, name: "Epic 08 verification portfolio", organizationId: ids.organization } });
    await tx.carbonProject.create({ data: { id: ids.project, portfolioId: ids.portfolio, name: "Epic 08 verification project", centroidLng: 0, centroidLat: 0 } });
    await tx.projectBoundary.create({ data: { id: ids.boundary, projectId: ids.project, version: 1, geojson: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }, source: "Epic 08 verification fixture", quality: "HIGH", acquiredAt: new Date(), isCurrent: true, areaHa: 100 } });
    await tx.environmentalEvent.create({ data: { id: ids.event, type: "WILDFIRE", sourceName: "EPIC08_TEST_FIXTURE", sourceId: ids.event, sourceInstrument: "TEST", observedAt: new Date("2026-08-23T00:00:00.000Z"), geometry: { type: "Point", coordinates: [0.5, 0.5] }, geomType: "Point", sourceConfidence: 0.8, sourceMetadata: { fixture: true }, dataVersion: "epic08-test-v1", originType: "OBSERVED", createdByType: "EXTERNAL_SOURCE", rawPayload: { fixture: true } } });
    await tx.incident.create({ data: { id: ids.incident, projectId: ids.project, eventId: ids.event, status: IncidentStatus.UNDER_ASSESSMENT, statusHistory: { create: [{ fromStatus: IncidentStatus.EVENT_DETECTED, toStatus: IncidentStatus.UNDER_ASSESSMENT, actor: "system:geospatial", createdByType: CreatedByType.SYSTEM_CALCULATION }] } } });
    await tx.evidenceRecord.create({ data: { id: ids.evidence, incidentId: ids.incident, eventId: ids.event, label: "ESTIMATED", createdByType: CreatedByType.SYSTEM_CALCULATION, sourceConfidence: 0.8, notes: "fixture" } });
    await tx.riskAssessment.create({ data: { id: ids.assessment, incidentId: ids.incident, boundaryId: ids.boundary, engineVersion: "geospatial-v1.0", methodologyVersion: "risk-v1.0", inputEvidenceIds: [ids.evidence], assumptions: { projectAreaHa: 100, bufferKm: 1 }, triggeringActor: "system:geospatial", createdByType: CreatedByType.SYSTEM_CALCULATION, estimatedImpactHa: 2.5, impactPct: 0.025, creditExposure: 25, financialExposureEst: 2500, financialCurrency: "USD", valuationBasis: "reference", integrityRisk: "LOW", evidenceConfidence: "MEDIUM", evidenceConfidenceScore: 60, auditPriority: "ROUTINE", evidenceRecords: { connect: { id: ids.evidence } } } });

    let dispatched = null;
    const audit = new AuditService(tx, {
      anchorIncidentTransition: async (incidentId, eventType) => {
        dispatched = { incidentId, eventType };
        throw new Error("test RPC unavailable");
      },
    });
    const result = await audit.flagForAudit(ids.incident, "human:epic08-verifier");
    assert.equal(result.toStatus, IncidentStatus.AUDIT_RECOMMENDED);
    assert.equal(result.createdByType, CreatedByType.HUMAN_ACTION);
    assert.equal(result.idempotent, false);
    assert.deepEqual(dispatched, { incidentId: ids.incident, eventType: AnchorEventType.AUDIT_RECOMMENDED });
    const afterFlag = await tx.incident.findUnique({ where: { id: ids.incident }, select: { status: true } });
    assert.equal(afterFlag.status, IncidentStatus.AUDIT_RECOMMENDED);
    const history = await tx.incidentStatusHistory.findMany({ where: { incidentId: ids.incident }, orderBy: { createdAt: "asc" } });
    assert.equal(history.length, 2);
    assert.equal(history[1].toStatus, IncidentStatus.AUDIT_RECOMMENDED);
    assert.equal(history[1].createdByType, CreatedByType.HUMAN_ACTION);
    console.log("PASS real status transition, immutable HUMAN_ACTION history, and exact blockchain dispatch event");

    const duplicate = await audit.flagForAudit(ids.incident, "human:epic08-verifier");
    assert.equal(duplicate.idempotent, true);
    assert.equal((await tx.incidentStatusHistory.count({ where: { incidentId: ids.incident } })), 2);
    console.log("PASS duplicate action is idempotent with no duplicate history entry");

    const failedAnchor = await new BlockchainService(tx, {
      contractAddress: "0x4444444444444444444444444444444444444444",
      transport: { submit: async () => { throw new Error("test RPC unavailable"); } },
    }).anchorIncidentTransition(ids.incident, AnchorEventType.AUDIT_RECOMMENDED);
    assert.equal(failedAnchor.status, AnchorStatus.FAILED);
    assert.equal(failedAnchor.txHash, null);
    const storedAnchor = await tx.blockchainAnchor.findUnique({ where: { id: failedAnchor.anchorId } });
    assert.equal(storedAnchor.eventType, AnchorEventType.AUDIT_RECOMMENDED);
    assert.equal(storedAnchor.status, AnchorStatus.FAILED);
    assert.equal(storedAnchor.txHash, null);
    const stillRecommended = await tx.incident.findUnique({ where: { id: ids.incident }, select: { status: true } });
    assert.equal(stillRecommended.status, IncidentStatus.AUDIT_RECOMMENDED);
    console.log("PASS failed anchor persistence does not block or roll back human audit transition");

    await tx.environmentalEvent.create({ data: { id: ids.invalidEvent, type: "WILDFIRE", sourceName: "EPIC08_TEST_FIXTURE", sourceId: ids.invalidEvent, sourceInstrument: "TEST", observedAt: new Date("2026-08-23T00:00:00.000Z"), geometry: { type: "Point", coordinates: [0.5, 0.5] }, geomType: "Point", sourceConfidence: 0.8, sourceMetadata: { fixture: true }, dataVersion: "epic08-test-v1", originType: "OBSERVED", createdByType: "EXTERNAL_SOURCE", rawPayload: { fixture: true } } });
    await tx.incident.create({ data: { id: ids.invalidIncident, projectId: ids.project, eventId: ids.invalidEvent, status: IncidentStatus.EVENT_DETECTED, statusHistory: { create: { id: ids.invalidHistory, fromStatus: null, toStatus: IncidentStatus.EVENT_DETECTED, actor: "system:geospatial", createdByType: CreatedByType.SYSTEM_CALCULATION } } } });
    await assert.rejects(() => audit.flagForAudit(ids.invalidIncident, "human:epic08-verifier"), /Invalid incident transition/);
    const invalid = await tx.incident.findUnique({ where: { id: ids.invalidIncident }, select: { status: true } });
    assert.equal(invalid.status, IncidentStatus.EVENT_DETECTED);
    console.log("PASS invalid transition leaves incident unchanged");

    throw new Error("EPIC08_VERIFICATION_ROLLBACK");
  }, { maxWait: 10000, timeout: 60000 });
}

(async () => {
  try {
    await verify();
    console.error("EPIC08_DB_VERIFICATION_FAIL verification transaction unexpectedly committed");
    process.exitCode = 1;
  } catch (error) {
    if (error instanceof Error && error.message === "EPIC08_VERIFICATION_ROLLBACK") {
      const fixture = await prisma.organization.findUnique({ where: { id: ids.organization } });
      assert.equal(fixture, null);
      console.log("PASS verification transaction rolled back all fixtures");
      console.log("EPIC08_DB_VERIFICATION_PASS");
    } else {
      console.error("EPIC08_DB_VERIFICATION_FAIL", error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
})();
`, "utf8");
  return runnerPath;
}

try {
  loadDatabaseUrl();
  compileSources();
  const result = spawnSync(process.execPath, ["--conditions=react-server", writeRunner()], { cwd: root, stdio: "inherit", env: { ...process.env, NODE_PATH: path.join(root, "node_modules"), NODE_ENV: "development" } });
  process.exit(result.status ?? 1);
} finally {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}
