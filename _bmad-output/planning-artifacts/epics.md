---
stepsCompleted: [1, 2]
inputDocuments: [
  "c:/Users/user/Desktop/VITSIH/docs/architecture.md",
  "c:/Users/user/Desktop/VITSIH/archi/ARCHITECTURE-SPINE.md",
  "c:/Users/user/Desktop/VITSIH/docs/data-sources.md",
  "c:/Users/user/Desktop/VITSIH/docs/data-pipeline.md",
  "c:/Users/user/Desktop/VITSIH/docs/environment.md",
  "c:/Users/user/Desktop/VITSIH/_bmad-output/brainstorming/brainstorm-sih-carbon-verification-2026-08-22/prd.md",
  "c:/Users/user/Desktop/VITSIH/_bmad-output/brainstorming/brainstorm-sih-carbon-verification-2026-08-22/brainstorm-intent.md"
]
---

# CARBONX - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for CARBONX, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories. This is the definitive, developer-ready execution blueprint for CARBONX, partitioned by owner to support parallel hackathon execution.

## Build Order & Parallel Execution

The epics are sequenced to allow a 4-person team (Developers A, B, C, D) to start in parallel on day one with minimal blocking:

1. **Developer A (Backend/Data)** starts immediately on **Epic 01 (Data Foundation)**. This establishes the Prisma schema and database which all other developers depend on.
2. **Developer B (Frontend/UX)** starts **Epic 07 (Portfolio 2D UI)** in parallel with Epic 01. Early work will use mocked API responses based on the agreed Zod schemas, swapping to real data once Epic 01 and 02 land.
3. **Developer C (AI + Blockchain)** starts **Epic 05 (AI Intelligence)** and **Epic 06 (Blockchain Anchoring)** service-layer code. They can build prompt templates, API integrations, and smart contracts against stubbed `RiskAssessment` objects in parallel, integrating fully once Epic 03 and 04 land.
4. **Developer D (3D)** performs prototyping and spikes on terrain and camera movement, but does **not** begin executing **Epic 09 (3D Investigation)** stories until Epics 01–04 are verified end-to-end, as per AD-18.

---

## Epic 01: Data Foundation

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** none

### Goal
Establish the core Next.js application shell, PostgreSQL database connection, authentication, and the complete Prisma schema required to support real environmental data and credit portfolios.

### Definition of Done
- A Next.js 14+ application is running and connects to PostgreSQL.
- Prisma schema is fully defined with `CreditHolding` (not `CreditLot`), `ProjectBoundary` with correct provenance fields, `EnvironmentalEvent`, `RiskAssessment`, `AIReport`, `BlockchainAnchor`, and `Incident` models.
- Environment variables are validated at startup.
- NextAuth is configured for basic sessions.

### Story 01.1: Initialize Application and Environment Validation

**Owner:** Developer A
**Depends on:** none

**As a** system
**I want** to strictly validate all required environment variables at startup
**So that** missing API keys or database URLs cause immediate fail-fast behavior instead of subtle runtime errors.

**Acceptance Criteria**
- [ ] Next.js 14+ App Router project is initialized.
- [ ] A Zod schema validates `DATABASE_URL`, `NEXTAUTH_SECRET`, `NASA_FIRMS_MAP_KEY`, and `BLOCKCHAIN_CONTRACT_ADDRESS` on startup.
- [ ] The app fails to boot if required secrets are missing.
- [ ] No secrets are exposed to the client bundle (no `NEXT_PUBLIC_` prefix for restricted keys).

**Technical notes**
- PRD 3.1, Architecture Spine AD-3
- See `lib/env.ts` from `docs/environment.md`

### Story 01.2: Define Core Prisma Data Models

**Owner:** Developer A
**Depends on:** 01.1

**As a** system
**I want** a strongly-typed relational database schema
**So that** I can store organizations, portfolios, projects, and precise credit holdings without relying on fake frontend state.

**Acceptance Criteria**
- [ ] Prisma schema defines `Organization`, `Portfolio`, `CarbonProject`, and `CreditHolding`.
- [ ] The `CreditHolding` model includes quantity, reference price, vintage, and registry reference.
- [ ] Prisma schema defines `ProjectBoundary` including `source`, `sourceUrl`, and `quality` provenance fields.
- [ ] Database is successfully migrated via `prisma migrate dev`.

**Technical notes**
- PRD 3.1, Architecture Spine AD-20, AD-21

### Story 01.3: Define Incident and Evidence Data Models

**Owner:** Developer A
**Depends on:** 01.2

**As a** system
**I want** database models for events, assessments, AI reports, and blockchain anchors
**So that** every calculation and external observation maintains strict provenance and immutability.

**Acceptance Criteria**
- [ ] Prisma schema defines `EnvironmentalEvent` with `createdByType` enum.
- [ ] Prisma schema defines `RiskAssessment` preserving inputs, estimates, and confidence scores.
- [ ] Prisma schema defines `Incident` and `IncidentStatusHistory` to track the state lifecycle.
- [ ] Prisma schema defines `AIReport` and `BlockchainAnchor` linked to the assessment.
- [ ] Prisma seed script provides at least 2 real carbon projects with boundaries (from public data like Global Forest Watch).

**Technical notes**
- PRD 2.2, 5.6, Architecture Spine AD-22

---

## Epic 02: Ingestion Pipeline

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 01

### Goal
Reliably ingest real NASA FIRMS satellite data and project boundaries into the database, normalizing observations and ensuring no duplicate events are created.

### Definition of Done
- A background service can fetch NASA FIRMS data using the `NASA_FIRMS_MAP_KEY`.
- Point detections are normalized into `EnvironmentalEvent` records with `createdByType: EXTERNAL_SOURCE`.
- Duplicate detections are rejected via fingerprinting.
- A "Controlled Replay" API endpoint can process a historical seed event through the pipeline.
- Project boundaries can be imported via GeoJSON.

### Story 02.1: NASA FIRMS API Integration and Normalization

**Owner:** Developer A
**Depends on:** 01.3

**As a** system
**I want** to fetch and normalize thermal anomalies from the NASA FIRMS API
**So that** CARBONX is driven by real-world environmental observations rather than simulated events.

**Acceptance Criteria**
- [ ] `FIRMSIngestionService` fetches JSON data from the FIRMS Area API using `NASA_FIRMS_MAP_KEY`.
- [ ] The bounding box used for the fetch is derived from active project centroids.
- [ ] Hotspots are normalized into `EnvironmentalEvent` objects with `originType: OBSERVED`.
- [ ] If the FIRMS API fails, the service logs the error and exits cleanly without crashing the application.

**Technical notes**
- PRD 5.1, Architecture Spine AD-19

### Story 02.2: Event Deduplication and Continuous Monitoring Checkpoint

**Owner:** Developer A
**Depends on:** 02.1

**As a** system
**I want** to track ingestion cursors and deduplicate incoming events
**So that** the same fire observation does not create multiple incident records.

**Acceptance Criteria**
- [ ] The ingestion job uses a `MonitoringCheckpoint` table to track the last successful fetch time.
- [ ] The checkpoint is only advanced if the ingestion run succeeds.
- [ ] Incoming events generate a SHA256 fingerprint (lat, lon, acq_date, acq_time, instrument).
- [ ] Events with existing fingerprints in the database are skipped.

**Technical notes**
- Architecture Spine AD-25, PRD 3.1

### Story 02.3: Controlled Historical Replay

**Owner:** Developer A
**Depends on:** 02.1

**As a** Administrator
**I want** to trigger a replay of a known historical environmental event
**So that** I can demonstrate the platform's capabilities using real data without waiting for a live wildfire to occur.

**Acceptance Criteria**
- [ ] A `POST /api/events/replay` endpoint takes a seed event ID.
- [ ] It creates a new `EnvironmentalEvent` copy labeled with `originType: REPLAYED` and `createdByType: REPLAY`.
- [ ] The duplicated event is immediately passed to the geospatial pipeline for processing.

**Technical notes**
- PRD 5.1, Architecture Spine AD-24

### Story 02.4: GeoJSON Project Boundary Import

**Owner:** Developer A
**Depends on:** 01.2

**As a** Administrator
**I want** to import project geofences via GeoJSON
**So that** the system can accurately assess intersection with environmental events.

**Acceptance Criteria**
- [ ] A `POST /api/projects/[id]/boundary` endpoint accepts valid GeoJSON.
- [ ] The GeoJSON is validated using Turf.js `area()` (rejecting invalid geometry).
- [ ] The import creates a new `ProjectBoundary` record, deactivating previous versions.
- [ ] The record successfully persists `source`, `sourceUrl`, and `quality` fields.

**Technical notes**
- PRD 3.1, Architecture Spine AD-20

---

## Epic 03: Geospatial Risk Engine

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 02

### Goal
Deterministically calculate spatial intersections between environmental events and project boundaries to produce physical impact, credit exposure, and integrity risk scores.

### Definition of Done
- Turf.js calculates intersection areas on the server side.
- The system correctly buffers FIRMS points before intersection.
- Risk scoring rules map the physical impact to financial exposure and qualitative risk levels.
- The resulting `RiskAssessment` records are saved with full methodology versioning.

### Story 03.1: Point Buffering and Polygon Intersection

**Owner:** Developer A
**Depends on:** 02.4

**As a** system
**I want** to intersect environmental events with project boundaries
**So that** I can identify which projects are potentially affected.

**Acceptance Criteria**
- [ ] A new `EnvironmentalEvent` triggers a geospatial intersection check against all active `ProjectBoundary` geometries.
- [ ] The boundary-intersection candidate check must account for the FIRMS point-detection buffer radius (`FIRMS_POINT_BUFFER_KM`) before filtering candidates — either by padding the bounding-box pre-filter by the buffer radius, or by treating the pre-filter as a pure optimization that cannot produce false negatives.
- [ ] The FIRMS point is buffered using Turf.js `buffer()` to create an estimated impact polygon.
- [ ] Turf.js `intersect()` calculates the overlap between the event buffer and the project boundary.
- [ ] The resulting intersection area is computed in hectares using Turf.js `area()`.

**Technical notes**
- PRD 5.2, Architecture Spine AD-19
- **CRITICAL**: Do NOT filter candidate projects using a simple point-in-polygon check against the unbuffered FIRMS point, as that will miss boundary edges falling within the buffer radius.

### Story 03.2: Exposure and Risk Scoring

**Owner:** Developer A
**Depends on:** 03.1

**As a** system
**I want** to calculate exposure and integrity risk from the intersection data
**So that** organizations understand the severity of the incident.

**Acceptance Criteria**
- [ ] Calculate `impactPct` (impact hectares / project hectares).
- [ ] Query the `CreditHolding` table to calculate `creditExposure` (heldQuantity * impactPct).
- [ ] Calculate `financialExposureEst` (creditExposure * refValuePerUnit).
- [ ] Assign an `integrityRisk` enum based on `impactPct` thresholds (e.g., <5% LOW, >=5% MEDIUM, >=20% HIGH, >=50% CRITICAL).
- [ ] Values derived from buffered points are explicitly tagged/labeled as `ESTIMATED` in the data model.

**Technical notes**
- PRD 2.1, 5.2, Architecture Spine AD-21

### Story 03.3: Evidence Confidence Scoring

**Owner:** Developer A
**Depends on:** 03.2

**As a** system
**I want** to calculate an Evidence Confidence score
**So that** organizations know how reliable the warning is.

**Acceptance Criteria**
- [ ] Calculate a composite `evidenceConfidence` score factoring in the FIRMS `sourceConfidence`, event freshness (time since observation), and boundary quality.
- [ ] Map the numeric score to a qualitative Enum (LOW, MEDIUM, HIGH).
- [ ] Assign an `auditPriority` enum (ROUTINE, ELEVATED, URGENT) based on the matrix of `integrityRisk` and `evidenceConfidence`.
- [ ] Save all calculated fields into a `RiskAssessment` record linked to the event and boundary.
- [ ] The `RiskAssessment` record must include `engineVersion` and `methodologyVersion` and `createdByType: SYSTEM_CALCULATION`.

**Technical notes**
- PRD 2.2, Architecture Spine AD-22

---

## Epic 04: Incident Lifecycle

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 03

### Goal
Manage the creation, state transitions, and persistent timeline of an active environmental incident resulting from a risk assessment.

### Definition of Done
- Geospatial overlaps automatically create an `Incident`.
- Incident status transitions are recorded immutably in an `IncidentStatusHistory` timeline.
- API endpoints expose the full incident timeline and current status.

### Story 04.1: Automated Incident Creation

**Owner:** Developer A
**Depends on:** 03.3

**As a** system
**I want** to create an incident when an intersection is detected
**So that** the event can be tracked through a resolution workflow.

**Acceptance Criteria**
- [ ] When a geospatial intersection is first detected (before risk scoring), create the `Incident` at status `EVENT_DETECTED`.
- [ ] Create an `IncidentStatusHistory` entry transitioning from `null` to `EVENT_DETECTED` with `createdByType: SYSTEM_CALCULATION`.
- [ ] Once the `RiskAssessment` is created, transition the incident from `EVENT_DETECTED` to `UNDER_ASSESSMENT` via `AuditService.transition()`, creating a second `IncidentStatusHistory` entry.
- [ ] The blockchain anchor for `EVENT_DETECTED→UNDER_ASSESSMENT` (per AD-9) is triggered at this point.

**Technical notes**
- PRD 2.3, 4.0, Architecture Spine AD-22

### Story 04.2: Timeline Persistence and API

**Owner:** Developer A
**Depends on:** 04.1

**As a** frontend client
**I want** an API to retrieve an incident and its full history
**So that** I can render the evidence timeline for the user.

**Acceptance Criteria**
- [ ] A `GET /api/incidents/[id]` route is implemented.
- [ ] The response includes the `Incident`, the latest `RiskAssessment`, linked `EnvironmentalEvent` details, and the ordered `IncidentStatusHistory` array.
- [ ] The API response is validated and typed using Zod.
- [ ] Raw Prisma models are mapped to response DTOs, not leaked directly.

**Technical notes**
- PRD 5.5, Architecture Spine AD-1

---

## Epic 05: AI Intelligence

**Priority tier:** P0
**Owner:** Developer C
**Depends on:** Epic 03 (for RiskAssessment schema)

### Goal
Generate human-readable explanations of structured deterministic risk assessments using an LLM, without hallucinating numbers or making legal decisions.

### Definition of Done
- A background process triggers after RiskAssessment creation to request an AI report.
- The LLM returns a strictly typed JSON response containing facts, uncertainties, and recommendations.
- The workflow degrades gracefully, continuing if the AI fails.

### Story 05.1: Structured Prompt Generation

**Owner:** Developer C
**Depends on:** Epic 03

**As a** system
**I want** to construct a deterministic JSON payload from the Risk Assessment
**So that** the LLM only operates on factual, calculated data.

**Acceptance Criteria**
- [ ] Create an `AIReportInput` Zod schema to shape the data sent to the LLM.
- [ ] Map the `RiskAssessment`, `EnvironmentalEvent`, and `CreditHolding` data into this strictly typed JSON structure.
- [ ] Write a system prompt enforcing that the AI must only interpret the provided JSON, must not invent evidence, and must output structured JSON matching the required schema.

**Technical notes**
- PRD 5.3, Architecture Spine AD-5

### Story 05.2: LLM Integration and Parsing

**Owner:** Developer C
**Depends on:** 05.1

**As a** system
**I want** to call the Gemini API and persist the response
**So that** human users get an easy-to-understand explanation of the incident.

**Acceptance Criteria**
- [ ] Implement `AIService` to call the Gemini 1.5 Flash API (or OpenAI fallback) using `GEMINI_API_KEY`.
- [ ] Validate the LLM's JSON response against an `AIReportOutput` Zod schema containing `facts`, `estimatedImpacts`, `uncertainties`, `portfolioConsequences`, and `recommendations`.
- [ ] Check the AI output to ensure any numbers mentioned match the structured input numbers.
- [ ] Save the valid response to the `AIReport` table linked to the `RiskAssessment` with `createdByType: AI_GENERATION`.

**Technical notes**
- PRD 5.3, Architecture Spine AD-5, AD-22

### Story 05.3: Graceful AI Degradation

**Owner:** Developer C
**Depends on:** 05.2

**As a** system
**I want** to handle LLM timeouts or schema validation failures gracefully
**So that** an AI outage does not break the incident investigation workflow.

**Acceptance Criteria**
- [ ] If the LLM API times out, returns a 5xx error, or fails Zod schema validation, the `AIService` catches the error.
- [ ] The `AIReport` field on the incident remains `null` or is flagged as unavailable.
- [ ] The incident workflow continues unabated; it does not block the user from viewing the incident or taking audit action.
- [ ] When `AIReport` is null, the API signals the frontend to render an "Interpretation Unavailable" fallback state.

**Technical notes**
- PRD 5.3, PRD 10.0 (Failures)

---

## Epic 06: Blockchain Anchoring

**Priority tier:** P0
**Owner:** Developer C
**Depends on:** Epic 03

### Goal
Anchor a cryptographic hash of the canonical evidence package to the Sepolia testnet to provide tamper-evident proof of the assessment state at critical incident lifecycle points.

### Definition of Done
- A smart contract is deployed to the Sepolia testnet.
- The backend deterministically hashes a JSON evidence package.
- The hash is sent to the blockchain, and the transaction hash is stored in PostgreSQL.
- The system gracefully handles blockchain failures without blocking the core workflow.

### Story 06.1: Smart Contract Deployment

**Owner:** Developer C
**Depends on:** none

**As a** system
**I want** a smart contract on the Sepolia testnet
**So that** I have a permanent ledger to anchor evidence hashes.

**Acceptance Criteria**
- [ ] Write a simple Solidity contract `CarbonXAnchor` that accepts an incident ID, a bytes32 hash, and an event type string.
- [ ] Deploy the contract to Sepolia.
- [ ] Provide the contract address to be used as the `BLOCKCHAIN_CONTRACT_ADDRESS` environment variable.

**Technical notes**
- PRD 5.4, Architecture Spine AD-8

### Story 06.2: Canonical Evidence Hashing

**Owner:** Developer C
**Depends on:** Epic 03

**As a** system
**I want** to deterministically serialize and hash an evidence package
**So that** the hash remains perfectly reproducible by third-party auditors.

**Acceptance Criteria**
- [ ] Build a canonical JSON object from the `RiskAssessment` and `Incident` state.
- [ ] Ensure serialization is deterministic (e.g., using `JSON.stringify` with sorted keys).
- [ ] Calculate the `keccak256` hash of the serialized string using `viem`.
- [ ] The supported anchor event types must use the exact string literals: `"UNDER_ASSESSMENT"`, `"AUDIT_RECOMMENDED"`, and `"RESOLVED"`.

**Technical notes**
- PRD 5.4, Architecture Spine AD-14

### Story 06.3: Non-Blocking Anchor Execution

**Owner:** Developer C
**Depends on:** 06.1, 06.2

**As a** system
**I want** to submit the hash to the blockchain asynchronously
**So that** RPC delays or failures do not block the user workflow.

**Acceptance Criteria**
- [ ] Create a `BlockchainAnchor` record in PostgreSQL with status `PENDING`.
- [ ] Submit the transaction to Sepolia using `viem` and the server-side wallet.
- [ ] On success, update the record with the `txHash` and status `SUBMITTED`/`CONFIRMED`.
- [ ] If the RPC fails or times out, update the status to `FAILED`.
- [ ] Crucially, if the anchor fails, the incident state transition itself still succeeds and the workflow continues gracefully.

**Technical notes**
- PRD 5.4, 10.0, Architecture Spine AD-9

---

## Epic 07: Portfolio 2D UI

**Priority tier:** P0
**Owner:** Developer B
**Depends on:** Epic 01 (for API contracts)

### Goal
Deliver the premium, functional 2D web interface allowing organizations to view their carbon portfolios, project details, and investigate active incidents.

### Definition of Done
- A styled layout exists using the specified deep environmental/dark visual identity.
- Portfolio dashboard displays active alerts and risk summaries.
- Incident view displays the risk assessment, timeline, AI report, and blockchain anchor status.
- The interface does not confuse physical impact with financial exposure.

### Story 07.1: UI Shell and Visual Identity

**Owner:** Developer B
**Depends on:** none

**As a** ESG Officer
**I want** a coherent, premium application interface
**So that** the tool feels like a credible environmental intelligence system.

**Acceptance Criteria**
- [ ] Implement a Next.js App Router layout with navigation.
- [ ] Apply a dark/environmental base visual identity using Tailwind CSS (no generic SaaS look, no crypto aesthetics).
- [ ] Define semantic color utility classes: Green (healthy), Amber (caution), Red (critical anomaly), and Blue/Neutral (information).
- [ ] Component styles are consistent and avoid "meaningless cards" and excessive glassmorphism.

**Technical notes**
- PRD 7.0, Architecture Spine AD-2

### Story 07.2: Portfolio Dashboard

**Owner:** Developer B
**Depends on:** 07.1

**As a** ESG Officer
**I want** a portfolio overview
**So that** I can see if any of my projects have active environmental alerts.

**Acceptance Criteria**
- [ ] The dashboard consumes `GET /api/portfolio` (can be mocked initially using Zod schema).
- [ ] Displays a summary of total credit holdings and active incidents.
- [ ] Lists projects, visually distinguishing those with healthy status from those with anomalies (Amber/Red).
- [ ] Provides clear navigation to project details and active incidents.

**Technical notes**
- PRD 5.5

### Story 07.3: Incident Investigation View

**Owner:** Developer B
**Depends on:** 07.1

**As a** Internal Auditor
**I want** to see all evidence and assessments for a specific incident
**So that** I can understand the risk before making an audit decision.

**Acceptance Criteria**
- [ ] The incident page consumes `GET /api/incidents/[id]`.
- [ ] Visually separates `Physical Impact`, `Credit Exposure`, `Financial Exposure`, `Integrity Risk`, and `Evidence Confidence`.
- [ ] Clearly labels buffered estimates as `ESTIMATED`.
- [ ] Renders the AI Report narrative, handling the `null` (Interpretation Unavailable) fallback gracefully.
- [ ] Displays the evidence timeline and blockchain anchor `txHash` (or PENDING/FAILED status).

**Technical notes**
- PRD 5.5, PRD 10.0, Architecture Spine AD-22

---

## Epic 08: Audit Workflow

**Priority tier:** P0
**Owner:** Developer B
**Depends on:** Epic 07, Epic 04

### Goal
Enable humans to make and record critical audit decisions regarding an incident, proving that CARBONX is a decision-support tool rather than an automatic credit-invalidation system.

### Definition of Done
- A user can click "Flag for Audit" on an incident.
- The UI triggers an API call that updates the incident status and creates a timeline entry.
- The state transition triggers a new blockchain anchor.

### Story 08.1: Human Audit Actions

**Owner:** Developer B
**Depends on:** 07.3

**As a** Internal Auditor
**I want** to flag a concerning incident for formal review
**So that** my organization can take action on the exposed credits.

**Acceptance Criteria**
- [ ] The Incident Investigation View includes a clear "Flag for Audit" action button.
- [ ] Clicking the button calls a `POST` API route to update the incident.
- [ ] The button shows a purposeful loading micro-interaction while processing.
- [ ] On success, the UI reflects the new `AUDIT_RECOMMENDED` status.
- [ ] A new entry appears in the incident timeline indicating the human action.
- [ ] The backend triggers a blockchain anchor for the `"AUDIT_RECOMMENDED"` event type.

**Technical notes**
- PRD 5.5, Architecture Spine AD-22

---

## Epic 09: 3D Investigation

**Priority tier:** P1
**Owner:** Developer D
**Depends on:** Epic 01, Epic 02, Epic 03, Epic 04

### Goal
Provide a premium, Bruno Simon-inspired interactive 3D sandbox for investigating environmental incidents, combining a guided cinematic onboarding sequence with a free-roam exploration mode.

### Definition of Done
- A React Three Fiber (R3F) canvas renders stylized terrain and project boundaries.
- The 3D scene receives its visual state entirely from backend API data (no fabricated anomalies).
- A cinematic camera sequence introduces the incident before yielding to user control.
- Free-roam mode supports WASD and mouse look constrained to the project bounds.
- **Crucially, the core P0 workflow functions flawlessly without this epic being complete.**

### Story 09.1: 3D Scene Integration and Fallback

**Owner:** Developer D
**Depends on:** 07.3

**As a** user
**I want** to launch a 3D investigation from the 2D UI
**So that** I can explore the incident spatially.

**Acceptance Criteria**
- [ ] The "Investigate in 3D" button mounts a separate R3F canvas overlay.
- [ ] If WebGL is unavailable or fails to initialize, the application degrades gracefully to the 2D view without crashing.
- [ ] The 3D scene loads real `ProjectBoundary` GeoJSON and incident data from the API to dictate its visual state (e.g., rendering smoke only if an active anomaly exists).

**Technical notes**
- PRD 3.2 (P1), PRD 10.0 (Failures)
- Architecture Spine AD-11 (3D Independence)

### Story 09.2: Cinematic Guided Sequence

**Owner:** Developer D
**Depends on:** 09.1

**As a** new user
**I want** a guided cinematic introduction to the 3D world
**So that** I understand the context and controls before exploring manually.

**Acceptance Criteria**
- [ ] Upon entering the 3D scene, a pre-programmed camera sequence (using GSAP or equivalent) flies over the terrain.
- [ ] UI overlays introduce the project, the anomaly, and teach WASD/mouse controls.
- [ ] The cinematic sequence is skippable by the user.

**Technical notes**
- Architecture Spine AD-11, PRD 7.0

### Story 09.3: Free-Roam Investigation Sandbox

**Owner:** Developer D
**Depends on:** 09.2

**As a** user
**I want** to freely explore the 3D terrain
**So that** I can inspect evidence hotspots from different angles.

**Acceptance Criteria**
- [ ] After the cinematic sequence ends, control seamlessly transitions to the user.
- [ ] WASD movement and mouse look (with pointer lock) allow exploration.
- [ ] Movement is constrained by a bounding box or collision system so the user cannot wander infinitely into empty space.
- [ ] The user can click or interact with specific evidence hotspots to open contextual UI panels.

**Technical notes**
- Architecture Spine AD-11, PRD 7.0

---

## Coverage Check

All P0 and P0.5 acceptance criteria from the PRD are mapped to stories across Epics 01-08:
- 5.1 Real Data Ingestion & Demo Replay -> Epic 02
- 5.2 Deterministic Geospatial Analysis -> Epic 03
- 5.3 AI Risk Intelligence -> Epic 05
- 5.4 Blockchain Evidence Anchoring -> Epic 06
- 5.5 2D User Interface & Investigation -> Epic 07 & 08
- 5.6 Reproducibility & Versioning -> Epic 01 & 04
- Graceful degradation constraints -> Epic 05, 06, 09
