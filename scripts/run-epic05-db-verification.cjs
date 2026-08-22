const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "carbonx-epic05-db-"));

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
    "lib/services/ai-service.ts",
    "lib/services/incidents.ts",
    "lib/prisma.ts",
    "lib/validations/ai.ts",
    "lib/validations/incidents.ts",
    "--module", "commonjs", "--target", "es2022", "--outDir", outputDirectory,
    "--esModuleInterop", "--skipLibCheck", "--strict", "--moduleResolution", "node",
    "--types", "node", "--noEmitOnError",
  ], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeRunner() {
  const runnerPath = path.join(outputDirectory, "verify.cjs");
  fs.writeFileSync(runnerPath, String.raw`const assert = require("node:assert/strict");
const { PrismaClient, CreatedByType, IncidentStatus } = require("@prisma/client");
const { AIService } = require(${JSON.stringify(path.join(outputDirectory, "services", "ai-service.js"))});
const { IncidentService } = require(${JSON.stringify(path.join(outputDirectory, "services", "incidents.js"))});

const prisma = new PrismaClient();
const ids = {
  organization: "epic05_verify_org",
  portfolio: "epic05_verify_portfolio",
  project: "epic05_verify_project",
  boundary: "epic05_verify_boundary",
  holding: "epic05_verify_holding",
  event: "epic05_verify_event",
  incident: "epic05_verify_incident",
  evidence: "epic05_verify_evidence",
  assessment: "epic05_verify_assessment",
  failedAssessment: "epic05_verify_failed_assessment",
};

const validOutput = {
  schemaVersion: "ai-output-v1.0",
  facts: "The supplied event is linked to the project.",
  estimatedImpacts: "The impact is an estimated buffered-point proxy.",
  uncertainties: "The source does not establish exact burned area.",
  portfolioConsequences: "Review the deterministic assessment before action.",
  recommendations: "Continue human review using the evidence timeline.",
};

async function verify() {
  assert.ok(Number.isInteger(await prisma.organization.count()));
  console.log("PASS simple Prisma read");

  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: ids.organization, name: "Epic 05 verification fixture" } });
    await tx.portfolio.create({ data: { id: ids.portfolio, name: "Epic 05 verification portfolio", organizationId: ids.organization } });
    await tx.carbonProject.create({ data: { id: ids.project, portfolioId: ids.portfolio, name: "Epic 05 verification project", centroidLng: 0, centroidLat: 0 } });
    await tx.projectBoundary.create({ data: { id: ids.boundary, projectId: ids.project, version: 1, geojson: { type: "Polygon", coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] }, source: "Epic 05 verification fixture", quality: "HIGH", acquiredAt: new Date(), isCurrent: true, areaHa: 100 } });
    await tx.creditHolding.create({ data: { id: ids.holding, projectId: ids.project, issuedQuantity: 1000, heldQuantity: 1000, status: "ACTIVE", refValuePerUnit: 100, refCurrency: "USD", valuationBasis: "reference" } });
    await tx.environmentalEvent.create({ data: { id: ids.event, type: "WILDFIRE", sourceName: "EPIC05_TEST_FIXTURE", sourceId: ids.event, sourceInstrument: "TEST", observedAt: new Date("2026-08-23T00:00:00.000Z"), geometry: { type: "Point", coordinates: [0.5, 0.5] }, geomType: "Point", sourceConfidence: 0.8, sourceMetadata: { fixture: true }, dataVersion: "epic05-test-v1", originType: "OBSERVED", createdByType: "EXTERNAL_SOURCE", rawPayload: { fixture: true } } });
    await tx.incident.create({ data: { id: ids.incident, projectId: ids.project, eventId: ids.event, status: IncidentStatus.EVENT_DETECTED, statusHistory: { create: { fromStatus: null, toStatus: IncidentStatus.EVENT_DETECTED, actor: "system:test", createdByType: CreatedByType.SYSTEM_CALCULATION } } } });
    await tx.evidenceRecord.create({ data: { id: ids.evidence, incidentId: ids.incident, eventId: ids.event, label: "ESTIMATED", createdByType: CreatedByType.SYSTEM_CALCULATION, sourceConfidence: 0.8, notes: "fixture" } });
    await tx.riskAssessment.create({ data: { id: ids.assessment, incidentId: ids.incident, boundaryId: ids.boundary, engineVersion: "geospatial-v1.0", methodologyVersion: "risk-v1.0", inputEvidenceIds: [ids.evidence], assumptions: { projectAreaHa: 100, bufferKm: 1 }, triggeringActor: "system:test", createdByType: CreatedByType.SYSTEM_CALCULATION, estimatedImpactHa: 2.5, impactPct: 0.025, creditExposure: 25, financialExposureEst: 2500, financialCurrency: "USD", valuationBasis: "reference", integrityRisk: "LOW", evidenceConfidence: "MEDIUM", evidenceConfidenceScore: 60, auditPriority: "ROUTINE", uncertaintyNotes: "Buffered point estimate.", evidenceRecords: { connect: { id: ids.evidence } } } });

    const provider = { generate: async () => ({ text: JSON.stringify(validOutput), rawResponse: validOutput }) };
    const service = new AIService(tx, provider);
    const success = await service.generateForAssessment(ids.assessment);
    assert.equal(success.status, "PERSISTED");
    const report = await tx.aIReport.findUnique({ where: { assessmentId: ids.assessment } });
    assert.equal(report.createdByType, CreatedByType.AI_GENERATION);
    assert.equal(report.outputSchemaVersion, "ai-output-v1.0");
    console.log("PASS mocked AI report persistence with provenance and schema versions");

    const repeat = await service.generateForAssessment(ids.assessment);
    assert.equal(repeat.status, "PERSISTED");
    assert.equal(repeat.idempotent, true);
    console.log("PASS AI report idempotency");

    await tx.riskAssessment.create({ data: { id: ids.failedAssessment, incidentId: ids.incident, boundaryId: ids.boundary, engineVersion: "geospatial-v1.1", methodologyVersion: "risk-v1.0", inputEvidenceIds: [ids.evidence], assumptions: { projectAreaHa: 100 }, triggeringActor: "system:test", createdByType: CreatedByType.SYSTEM_CALCULATION, estimatedImpactHa: 2.5, impactPct: 0.025, creditExposure: 25, financialExposureEst: 2500, financialCurrency: "USD", valuationBasis: "reference", integrityRisk: "LOW", evidenceConfidence: "MEDIUM", evidenceConfidenceScore: 60, auditPriority: "ROUTINE", evidenceRecords: { connect: { id: ids.evidence } } } });
    const failed = await new AIService(tx, { generate: async () => ({ text: "not-json", rawResponse: null }) }).generateForAssessment(ids.failedAssessment);
    assert.equal(failed.status, "UNAVAILABLE");
    assert.equal(await tx.aIReport.count({ where: { assessmentId: ids.failedAssessment } }), 0);
    const incident = await tx.incident.findUnique({ where: { id: ids.incident }, select: { status: true } });
    assert.equal(incident.status, IncidentStatus.EVENT_DETECTED);
    console.log("PASS invalid AI response is non-blocking and leaves deterministic workflow available");

    const dto = await new IncidentService(tx).getById(ids.incident);
    assert.equal(dto.latestAssessment.aiReport, null);
    console.log("PASS incident DTO signals Interpretation Unavailable with null aiReport");
    throw new Error("EPIC05_VERIFICATION_ROLLBACK");
  }, { maxWait: 10000, timeout: 60000 });
}

(async () => {
  try {
    await verify();
    console.error("EPIC05_DB_VERIFICATION_FAIL verification transaction unexpectedly committed");
    process.exitCode = 1;
  } catch (error) {
    if (error instanceof Error && error.message === "EPIC05_VERIFICATION_ROLLBACK") {
      const fixture = await prisma.organization.findUnique({ where: { id: ids.organization } });
      assert.equal(fixture, null);
      console.log("PASS verification transaction rolled back all fixtures");
      console.log("EPIC05_DB_VERIFICATION_PASS");
    } else {
      console.error("EPIC05_DB_VERIFICATION_FAIL", error instanceof Error ? error.message : String(error));
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
