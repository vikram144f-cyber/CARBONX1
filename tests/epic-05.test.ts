import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_SYSTEM_PROMPT,
  AIService,
  type AIProvider,
  buildAIReportInput,
} from "../lib/services/ai-service";
import {
  AI_INPUT_SCHEMA_VERSION,
  AI_OUTPUT_SCHEMA_VERSION,
  aiReportInputSchema,
  aiReportOutputSchema,
} from "../lib/validations/ai";

function assessmentRecord() {
  return {
    id: "assessment-1",
    engineVersion: "geospatial-v1.0",
    methodologyVersion: "risk-v1.0",
    inputEvidenceIds: ["evidence-1"],
    assumptions: { projectAreaHa: 100, bufferKm: 1 },
    triggeringActor: "system:geospatial",
    createdByType: "SYSTEM_CALCULATION",
    estimatedImpactHa: 2.5,
    impactPct: 0.025,
    creditExposure: 25,
    financialExposureEst: 2500,
    financialCurrency: "USD",
    valuationBasis: "reference",
    integrityRisk: "LOW",
    evidenceConfidence: "MEDIUM",
    evidenceConfidenceScore: 60,
    auditPriority: "ROUTINE",
    uncertaintyNotes: "Buffered FIRMS point is an estimate.",
    supersededById: null,
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    incident: {
      id: "incident-1",
      projectId: "project-1",
      eventId: "event-1",
      project: {
        id: "project-1",
        name: "Public Forest Project",
        creditHoldings: [
          {
            id: "holding-1",
            heldQuantity: 1000,
            refValuePerUnit: 100,
            refCurrency: "USD",
            valuationBasis: "reference",
            status: "ACTIVE",
          },
        ],
      },
      event: {
        id: "event-1",
        type: "WILDFIRE",
        sourceName: "NASA FIRMS",
        sourceId: "firms-1",
        sourceInstrument: "VIIRS",
        observedAt: new Date("2026-08-22T00:00:00.000Z"),
        acquiredAt: new Date("2026-08-22T01:00:00.000Z"),
        sourceConfidence: 0.9,
        dataVersion: "firms-v1",
        originType: "OBSERVED",
        createdByType: "EXTERNAL_SOURCE",
      },
    },
    evidenceRecords: [
      {
        id: "evidence-1",
        label: "ESTIMATED",
        createdByType: "SYSTEM_CALCULATION",
        sourceConfidence: 0.9,
        notes: "Buffered point estimate",
      },
    ],
  } as unknown as Parameters<typeof buildAIReportInput>[0];
}

function validOutput() {
  return {
    schemaVersion: AI_OUTPUT_SCHEMA_VERSION,
    facts: "The supplied event is linked to the project.",
    estimatedImpacts: "The impact is an estimated buffered-point proxy.",
    uncertainties: "The source does not establish exact burned area.",
    portfolioConsequences: "Review the deterministic assessment before action.",
    recommendations: "Continue human review using the evidence timeline.",
  };
}

class MockProvider implements AIProvider {
  public input: unknown;
  public prompt = "";

  constructor(private readonly response: AIProvider["generate"] extends (...args: never[]) => infer R ? Awaited<R> : never) {}

  async generate(input: Parameters<AIProvider["generate"]>[0], prompt: string) {
    this.input = input;
    this.prompt = prompt;
    return this.response;
  }
}

function fakeDb(record: ReturnType<typeof assessmentRecord>) {
  let report: { id: string } | null = null;
  return {
    aIReport: {
      findUnique: async () => report,
      create: async () => {
        report = { id: "ai-report-1" };
        return report;
      },
    },
    riskAssessment: {
      findUnique: async () => record,
    },
    getReport: () => report,
  };
}

test("maps deterministic assessment, event, holdings, and evidence without geometry", () => {
  const input = buildAIReportInput(assessmentRecord());
  assert.equal(input.schemaVersion, AI_INPUT_SCHEMA_VERSION);
  assert.equal(input.assessment.projectHa, 100);
  assert.equal(input.event.sourceName, "NASA FIRMS");
  assert.equal(input.holdings[0]?.heldQuantity, 1000);
  assert.equal("geometry" in input, false);
  assert.equal(aiReportInputSchema.safeParse({ ...input, geometry: {} }).success, false);
});

test("system prompt forbids invention, calculations, geometry, legal conclusions, and invalidation", () => {
  assert.match(AI_SYSTEM_PROMPT, /Do not invent/i);
  assert.match(AI_SYSTEM_PROMPT, /geometry/i);
  assert.match(AI_SYSTEM_PROMPT, /Do not calculate/i);
  assert.match(AI_SYSTEM_PROMPT, /legal conclusions/i);
  assert.match(AI_SYSTEM_PROMPT, /invalidate/i);
  assert.match(AI_SYSTEM_PROMPT, /portfolioConsequences/);
});

test("output schema is strict and versioned", () => {
  assert.deepEqual(aiReportOutputSchema.parse(validOutput()), validOutput());
  assert.equal(
    aiReportOutputSchema.safeParse({ ...validOutput(), extra: "nope" }).success,
    false,
  );
  assert.equal(
    aiReportOutputSchema.safeParse({ ...validOutput(), schemaVersion: "wrong" }).success,
    false,
  );
});

test("valid provider output is persisted and repeated generation is idempotent", async () => {
  const db = fakeDb(assessmentRecord());
  const provider = new MockProvider({ text: JSON.stringify(validOutput()), rawResponse: validOutput() });
  const service = new AIService(db as never, provider);

  const first = await service.generateForAssessment("assessment-1");
  const second = await service.generateForAssessment("assessment-1");

  assert.deepEqual(first, {
    status: "PERSISTED",
    assessmentId: "assessment-1",
    reportId: "ai-report-1",
    idempotent: false,
  });
  assert.deepEqual(second, {
    status: "PERSISTED",
    assessmentId: "assessment-1",
    reportId: "ai-report-1",
    idempotent: true,
  });
  assert.equal((provider.input as { assessment: { engineVersion: string } }).assessment.engineVersion, "geospatial-v1.0");
  assert.equal(db.getReport()?.id, "ai-report-1");
});

test("numeric claims that are not deterministic inputs are rejected", async () => {
  const db = fakeDb(assessmentRecord());
  const output = { ...validOutput(), facts: "The assessment contains 9999 credits." };
  const provider = new MockProvider({ text: JSON.stringify(output), rawResponse: output });
  const result = await new AIService(db as never, provider).generateForAssessment("assessment-1");
  assert.equal(result.status, "UNAVAILABLE");
  assert.match(result.reason, /numeric consistency/i);
  assert.equal(db.getReport(), null);
});

test("timeout, 5xx-like provider failure, invalid JSON, and schema failure are non-blocking", async () => {
  const cases: AIProvider[] = [
    { generate: async () => { throw new Error("Gemini request timed out"); } },
    { generate: async () => { throw new Error("Gemini request failed with HTTP 503"); } },
    { generate: async () => ({ text: "not-json", rawResponse: null }) },
    { generate: async () => ({ text: JSON.stringify({ schemaVersion: AI_OUTPUT_SCHEMA_VERSION }), rawResponse: null }) },
  ];

  for (const provider of cases) {
    const result = await new AIService(fakeDb(assessmentRecord()) as never, provider).generateForAssessment("assessment-1");
    assert.equal(result.status, "UNAVAILABLE");
  }
});
