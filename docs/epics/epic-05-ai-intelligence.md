# Epic 05: AI Intelligence

**Priority tier:** P0
**Owner:** Developer C
**Depends on:** Epic 03 (for RiskAssessment schema)

## Goal
Generate human-readable explanations of structured deterministic risk assessments using an LLM, without hallucinating numbers or making legal decisions.

## Definition of Done
- A background process triggers after RiskAssessment creation to request an AI report.
- The LLM returns a strictly typed JSON response containing facts, uncertainties, and recommendations.
- The workflow degrades gracefully, continuing if the AI fails.

---

## Story 05.1: Structured Prompt Generation

**Owner:** Developer C
**Depends on:** Epic 03

**As a** system
**I want** to construct a deterministic JSON payload from the Risk Assessment
**So that** the LLM only operates on factual, calculated data.

### Acceptance Criteria
- [ ] Create an `AIReportInput` Zod schema to shape the data sent to the LLM.
- [ ] Map the `RiskAssessment`, `EnvironmentalEvent`, and `CreditHolding` data into this strictly typed JSON structure.
- [ ] Write a system prompt enforcing that the AI must only interpret the provided JSON, must not invent evidence, and must output structured JSON matching the required schema.

### Technical notes
- PRD 5.3, Architecture Spine AD-5

---

## Story 05.2: LLM Integration and Parsing

**Owner:** Developer C
**Depends on:** 05.1

**As a** system
**I want** to call the Gemini API and persist the response
**So that** human users get an easy-to-understand explanation of the incident.

### Acceptance Criteria
- [ ] Implement `AIService` to call the Gemini 1.5 Flash API (or OpenAI fallback) using `GEMINI_API_KEY`.
- [ ] Validate the LLM's JSON response against an `AIReportOutput` Zod schema containing `facts`, `estimatedImpacts`, `uncertainties`, `portfolioConsequences`, and `recommendations`.
- [ ] Check the AI output to ensure any numbers mentioned match the structured input numbers.
- [ ] Save the valid response to the `AIReport` table linked to the `RiskAssessment` with `createdByType: AI_GENERATION`.

### Technical notes
- PRD 5.3, Architecture Spine AD-5, AD-22

---

## Story 05.3: Graceful AI Degradation

**Owner:** Developer C
**Depends on:** 05.2

**As a** system
**I want** to handle LLM timeouts or schema validation failures gracefully
**So that** an AI outage does not break the incident investigation workflow.

### Acceptance Criteria
- [ ] If the LLM API times out, returns a 5xx error, or fails Zod schema validation, the `AIService` catches the error.
- [ ] The `AIReport` field on the incident remains `null` or is flagged as unavailable.
- [ ] The incident workflow continues unabated; it does not block the user from viewing the incident or taking audit action.
- [ ] When `AIReport` is null, the API signals the frontend to render an "Interpretation Unavailable" fallback state.

### Technical notes
- PRD 5.3, PRD 10.0 (Failures)
