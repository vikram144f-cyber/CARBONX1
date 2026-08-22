---
status: final
updated: 2026-08-22
project: CARBONX
altitude: feature
source: brainstorm-intent.md + prd.md + docs/architecture.md review
---

# CARBONX — Architecture Spine

## Paradigm

**Layered monolith.** Next.js App Router is the single process. Three distinct layers never cross each other's boundary: the **Route Layer** (HTTP in/out, auth, Zod validation), the **Service Layer** (all domain logic), and the **Data Layer** (Prisma + PostgreSQL). External services (LLM, blockchain RPC, NASA FIRMS) are called exclusively from the Service Layer. The browser calls only the Route Layer.

```
Browser (React / R3F)
  └── Route Layer  app/api/**            (auth, Zod, delegation only)
        └── Service Layer  lib/services/** (all domain logic)
              └── Data Layer  Prisma + PostgreSQL
                    └── External  LLM API | Blockchain RPC | NASA FIRMS
```

---

## Inherited Invariants

None — this is the root spine.

---

## Architecture Decisions

### AD-1 Layered Monolith
**Binds:** module coupling
**Prevents:** route handlers with embedded SQL or business logic; service files calling route utilities
**Rule:** Route handlers authenticate, validate with Zod, delegate to one service call, and return a typed envelope. No DB access, no external calls, no calculations in route handlers.

---

### AD-2 Technology Lock
**Binds:** all technology choices
**Prevents:** stack fragmentation; introducing alternatives without a new AD
**Rule:** Locked stack — Next.js 14+ App Router · TypeScript strict · Tailwind CSS · PostgreSQL · Prisma · Turf.js (server-only) · viem · NextAuth.js (database sessions) · TanStack Query + RSC · Vercel + Neon · React Three Fiber + drei + GSAP. No substitution without a superseding AD.

---

### AD-3 Secret Isolation
**Binds:** secret and credential handling
**Prevents:** credential exposure in client bundles or source code
**Rule:** Every API key and secret lives in a server-side environment variable. No `NEXT_PUBLIC_` variable may carry a privileged credential. All external service calls originate from `lib/services/**` only.

---

### AD-4 Single Source of Truth
**Binds:** state ownership
**Prevents:** blockchain-as-DB misuse; frontend fabricating authoritative state
**Rule:** PostgreSQL is the sole operational system of record. Blockchain stores only cryptographic commitments to evidence packages — it holds no application state. All UI state is derived from the database via API.

---

### AD-5 Calculation Authority — Risk Engine Separation
**Binds:** who may produce numeric outputs
**Prevents:** AI computing, inventing, or overriding physical-impact, exposure, or risk values
**Rule:** `lib/services/geospatial.ts` (Turf.js) and `lib/services/risk-engine.ts` are the exclusive sources of numeric calculations. The AI service receives only a validated, structured JSON payload of those outputs and returns narrative text. No numeric value in an AI report may differ from the assessment record it was generated from.

---

### AD-6 Evidence Label Contract
**Binds:** evidence integrity across all outputs
**Prevents:** presenting estimates as confirmed damage
**Rule:** Every `EvidenceRecord` carries exactly one label: `OBSERVED | ESTIMATED | MODELED | INFERRED`. A point-detection buffered by the system is always `ESTIMATED`. This label must appear in the stored record, the API response, and the UI display. No code path may omit or silently downgrade it.

---

### AD-7 Incident State Machine Enforcement
**Binds:** incident status integrity
**Prevents:** illegal status bypasses; automatic credit invalidation
**Rule:** All incident status writes go through `AuditService.transition(incidentId, toStatus, actor)`. Disallowed transitions throw `InvalidTransitionError`. No route handler or React component may write `IncidentStatus` directly. The status `CREDIT_INVALIDATED` does not exist and must never be created.

Allowed transitions:

```
MONITORING        → EVENT_DETECTED         [system]
EVENT_DETECTED    → UNDER_ASSESSMENT       [system]
UNDER_ASSESSMENT  → AUDIT_RECOMMENDED      [system or human]
UNDER_ASSESSMENT  → INSUFFICIENT_EVIDENCE  [system or human]
AUDIT_RECOMMENDED → AUDIT_IN_PROGRESS      [human]
AUDIT_RECOMMENDED → INSUFFICIENT_EVIDENCE  [human]
AUDIT_IN_PROGRESS → RESOLVED               [human]
AUDIT_IN_PROGRESS → INSUFFICIENT_EVIDENCE  [human]
RESOLVED          → REOPENED               [human]
REOPENED          → UNDER_ASSESSMENT       [system]
```

**MONITORING semantics:** `MONITORING` is a derived portfolio-display state meaning "no active Incident exists for this project." It is never written as an `IncidentStatus` row in `IncidentStatusHistory`. An `Incident` record is created only when an environmental event intersects a project boundary.

---

### AD-8 Assessment Immutability and Reproducibility
**Binds:** historical auditability
**Prevents:** silent recalculation; data loss under methodology changes
**Rule:** `RiskAssessment` records are append-only. A correction creates a new record with `supersededById` referencing the previous one. Every assessment stores: `engineVersion`, `methodologyVersion`, `boundaryId`, `inputEvidenceIds[]`, `assumptions` JSON, triggering actor, and creation timestamp. Given identical inputs and versions, the deterministic engine must reproduce identical outputs.

---

### AD-9 Blockchain Failure Isolation
**Binds:** operational resilience
**Prevents:** blockchain outage halting audit work
**Rule:** A blockchain anchor failure (PENDING or FAILED) must never block or rollback an incident workflow step. The synchronous pipeline completes; anchoring is fire-and-forget. Retry: max 3 attempts, exponential backoff, via the mechanism in AD-12.

Anchored transitions: `EVENT_DETECTED→UNDER_ASSESSMENT` · `UNDER_ASSESSMENT→AUDIT_RECOMMENDED` · `AUDIT_IN_PROGRESS→RESOLVED`

**What blockchain proves:** A specific evidence package existed in a specific form at a specific time.
**What blockchain does NOT prove:** That the environmental event occurred, that damage is confirmed, or that credits are invalid.

---

### AD-10 AI Failure Isolation
**Binds:** operational resilience
**Prevents:** AI outage blocking human review
**Rule:** An `AIReport` generation failure sets the report reference to null. The incident detail view renders "Interpretation Unavailable." All deterministic assessment data and all audit actions remain fully available and operable.

---

### AD-11 3D Scene Independence
**Binds:** 3D isolation from business logic
**Prevents:** 3D failure blocking P0 workflow; API calls from inside the canvas
**Rule:** The R3F scene is dynamically imported (`next/dynamic`, `ssr: false`) and conditionally rendered as a full-screen overlay. It receives all data as props from the parent React page — it never calls any API directly. A WebGL-unavailable device receives a 2D map fallback. The complete P0 incident workflow must be achievable without mounting the 3D scene.

---

### AD-12 Async Work Mechanism
**Binds:** how AI and blockchain calls are dispatched
**Prevents:** `setTimeout` fake async; route handler timeouts; orphaned background work
**Rule:** After the synchronous assessment is persisted to the database, AI generation and blockchain anchoring are dispatched via `Promise.allSettled([aiService.generate(), blockchainService.anchor()])` — fire-and-forget, rejections caught and logged. Production retry jobs use either Next.js `waitUntil` (edge runtime) or `pg-boss` (PostgreSQL-backed queue). Confirm which is available on the chosen Vercel tier before implementing (open question OQ-1).

---

### AD-13 Coordinate System Contract
**Binds:** geospatial correctness
**Prevents:** incorrect intersection results from pre-projected coordinates or wrong API call
**Rule:** Environmental event geometries and project boundaries are stored and processed in WGS84 GeoJSON. Turf.js receives raw GeoJSON — never pre-projected coordinates. The correct Turf.js v6 intersection call is `turf.intersect(poly1, poly2)` — not a FeatureCollection form. The 3D scene uses a local flat projection computed at runtime from the project centroid (`lib/utils/geo-to-scene.ts`).

---

### AD-14 Canonical Hash Determinism
**Binds:** blockchain evidence integrity
**Prevents:** non-deterministic hashes that break independent verification
**Rule:** The evidence package is serialized as `JSON.stringify(obj, topLevelKeysSorted)` where array values are pre-sorted before serialization. The hash is `keccak256(toBytes(canonicalJsonString))` via viem. Schema version: `anchor-v1.0`. The canonical record must include: `schemaVersion`, `incidentId`, `assessmentId`, `engineVersion`, `methodologyVersion`, `integrityRisk`, `evidenceConfidence`, `inputEvidenceIds` (sorted), `boundaryId`, `timestamp`, `eventType`.

---

### AD-15 Zod Schema Authority
**Binds:** API contract between client and server
**Prevents:** client-server type drift; duplicated schema definitions
**Rule:** All request/response Zod schemas live in `lib/validations/`. Route handlers (server) and TanStack Query fetchers (client) import exclusively from this location. A schema change must update both consumers atomically in the same PR.

---

### AD-16 Developer Ownership Partitions
**Binds:** team boundaries and migration discipline
**Prevents:** migration conflicts; ownership ambiguity; merge-blocking changes
**Rule:**

| Owner | Primary files |
|---|---|
| **A — Backend/Data** | `prisma/`, `lib/services/geospatial.ts`, `risk-engine.ts`, `ingestion.ts`, `audit.ts`, `app/api/**` |
| **B — Frontend/UX** | `app/` pages, `components/`, `features/` (non-3D), `lib/validations/` |
| **C — AI + Blockchain** | `lib/services/ai-service.ts`, `blockchain.ts`, `contracts/` |
| **D — 3D** | `features/investigation-3d/`, `public/models/`, `public/textures/` |

DB migrations: created by A only, reviewed in PR before merge. `prisma generate` runs after every schema change; generated client is not committed to git.

---

### AD-17 MONITORING Status Semantics
**Binds:** status model accuracy
**Prevents:** unreachable status; phantom Incident records at project creation
**Rule:** `MONITORING` is a derived display state — "no active Incident for this project." It is never persisted as an `IncidentStatus` row. Incident records are created only when an environmental event intersects a project boundary. Portfolio dashboards derive "Monitoring" by the absence of an active Incident, not by reading a status field.

---

### AD-18 Build Priority Alignment
**Binds:** build sequencing across developer tracks
**Prevents:** 3D work blocking P0 pipeline delivery
**Rule:** P0 = complete backend pipeline (ingest → geospatial → risk → incident → AI → blockchain → 2D audit workflow). P0.5 = polished 2D UI, Leaflet map with geofence/impact overlays, risk/confidence indicators, audit workflow UI. P1 = optional 3D investigation scene. 3D work (Developer D) begins only after the P0 pipeline is verified end-to-end by Developer A.

---

## Data Shape (Seed)

> Seed values: true at cold-start, owned by the codebase once implemented. These are not spine constraints.

| Entity | Notes |
|---|---|
| `Organization` | Top-level tenant; all queries include `organizationId` filter |
| `Portfolio` | Groups projects under an org |
| `CarbonProject` | Stores centroid lng/lat for 3D scene origin computation |
| `ProjectBoundary` | Versioned WGS84 GeoJSON; `isCurrent` boolean; `quality` enum |
| `CreditHolding` | `heldQuantity`, `refValuePerUnit`, `valuationBasis` required for exposure calculation |
| `EnvironmentalEvent` | `observedAt` (when event occurred) distinct from `acquiredAt` (when ingested); `originType` enum |
| `EvidenceRecord` | `label` enum enforced (AD-6) |
| `RiskAssessment` | Append-only; `supersededById` chain (AD-8) |
| `AIReport` | 1:1 with `RiskAssessment`; `approvedForAudit` boolean |
| `BlockchainAnchor` | Status enum: `PENDING / SUBMITTED / CONFIRMED / FAILED` |
| `Incident` | Parent container; status written only via `AuditService` (AD-7) |
| `IncidentStatusHistory` | Append-only ledger; every transition recorded |
| `AuditCase` | 1:1 with Incident; human workflow tracking |

---

## API Response Envelope (Seed)

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

All route handlers return this shape. Raw Prisma objects are never returned directly.

---

## Operational Envelope

| Concern | Decision |
|---|---|
| Environments | `development` (local) → `staging` (Vercel preview + Neon branch) → `production` (Vercel main + Neon primary) |
| Migrations | Append-only. `prisma migrate deploy` on Vercel build. Never edit existing migration files. |
| Smart contract | Deployed once to Sepolia; address in `SMART_CONTRACT_ADDRESS`. Redeploy only on logic change. |
| Secrets | Managed in Vercel dashboard per environment. `BLOCKCHAIN_PRIVATE_KEY` never leaves server runtime. |

---

## Architecture Decisions — Data Sources and Pipeline

### AD-19 NASA FIRMS as Primary Environmental Event Source
**Binds:** what triggers the environmental event pipeline
**Prevents:** fake or hardcoded fire detection events; claiming scientific fire mapping from point data
**Rule:** NASA FIRMS (VIIRS and/or MODIS instruments) is the exclusive real-time and historical source for environmental event data in P0. All other fire/anomaly data is either REPLAY or explicitly marked as an extension. `FIRMSIngestionService` (`lib/services/firms-ingestion.ts`) handles all FIRMS access server-side via `NASA_FIRMS_MAP_KEY`. FIRMS point detections are labeled as satellite thermal anomalies — never as confirmed burned-area measurements.

---

### AD-20 Project Boundary Data Strategy
**Binds:** how project geographic boundaries enter the system
**Prevents:** claiming boundaries come from a fully automated public API (they don't); leaving boundary source undocumented
**Rule:** P0 supports two boundary entry paths: (a) manual GeoJSON upload via `POST /api/projects/[id]/boundary` and (b) pre-seeded public boundaries for known demo projects. Every `ProjectBoundary` record stores `boundarySource`, `boundarySourceUrl`, `boundaryConfidence` (HIGH/MEDIUM/LOW/UNKNOWN), and `verifiedAt`. No boundary is used in geospatial analysis without these provenance fields populated. Boundaries are validated with Turf.js on import.

---

### AD-21 Credit Holdings are Organization-Private — No Public API
**Binds:** how credit holding data enters the system
**Prevents:** assuming a public API can reveal what a private organization owns; hardcoding credit quantities
**Rule:** `CreditLot` records (quantity, reference price, vintage, registry reference) are entered by the organization via UI form or CSV import. No external API is queried for holdings. All exposure calculations (`creditExposure`, `financialExposureEst`) query these database records at runtime.

---

### AD-22 Data Provenance is Mandatory on All Records
**Binds:** every EnvironmentalEvent, EvidenceRecord, RiskAssessment, AIReport, and AuditAction
**Prevents:** displaying values whose origin cannot be traced; mixing observation, calculation, and AI interpretation
**Rule:** Every record carries a `createdByType` field: `EXTERNAL_SOURCE | SYSTEM_CALCULATION | AI_GENERATION | HUMAN_ACTION | REPLAY`. Records derived from external data also carry: `sourceName`, `sourceId` (or fingerprint), `observedAt`, `acquiredAt`, `dataVersion`, and `rawPayload`. Records from calculation carry `engineVersion` and `methodologyVersion`. The origin chain must be traceable from any displayed value back to its source.

---

### AD-23 Satellite Imagery is P1 — Not a P0 Dependency
**Binds:** what evidence types are available in P0
**Prevents:** claiming satellite imagery analysis when it is not implemented; faking NDVI or burn-scar results
**Rule:** P0 does not integrate satellite imagery processing. FIRMS point detections + Turf.js geometry are the only environmental evidence in P0. Satellite imagery panels in the UI (P1) are labeled "Not yet available" until integrated. When implemented (P1), imagery is stored as an `EvidenceRecord` with `label: OBSERVED` and full source provenance. NDVI and burn-scar analysis are P1 stretch / P2.

---

### AD-24 Controlled Replay — Real Pipeline, Disclosed Origin
**Binds:** how historical scenario demonstrations work
**Prevents:** `setTimeout` fake state changes; frontend-only status mutations; presenting historical events as live detections
**Rule:** Historical demonstration scenarios feed real seeded `EnvironmentalEvent` records (pre-populated from actual past FIRMS observations) through the genuine ingestion → geospatial → risk → AI → blockchain pipeline. Replayed events set `originType: REPLAYED` on all created records. This label is surfaced in the evidence timeline UI. No demo scenario may bypass the backend pipeline.

---

### AD-25 Continuous Monitoring — Cursor-Based, Configurable, Fail-Safe
**Binds:** how and when new FIRMS data is fetched
**Prevents:** vague "real-time" claims without a defined mechanism; duplicate event creation; monitoring failures silently blocking ingestion
**Rule:** A scheduled job polls the FIRMS API at a configurable interval (`MONITORING_INTERVAL_HOURS`, default 6h). It uses a `MonitoringCheckpoint` table to track the last successful ingestion timestamp (cursor-based). Deduplication uses a content fingerprint `SHA256(lat + lon + acq_date + acq_time + instrument)`. A failed run does not advance the checkpoint (so the next run retries). After 3 consecutive failures, an operator alert is logged. The monitoring mechanism (`pg-boss` or `waitUntil`) is the same as AD-12.

---

## Deferred

Real decisions left to implementation-level ownership:

- `pg-boss` vs `waitUntil` for retry/scheduling jobs — depends on Vercel plan tier (OQ-1).
- Full Prisma schema field list — owned by Developer A; see `docs/architecture.md` for the full seed schema.
- Leaflet vs MapLibre GL for 2D map — Developer B's choice; either fits AD-2.
- 3D terrain: GLTF vs procedural mesh — Developer D's choice; no spine constraint.
- AI system prompt exact wording — Developer C's choice; constrained by AD-5 and the Zod output schema.
- `FIRMS_POINT_BUFFER_KM` default value — env var; 1km is the starting assumption; must be documented in all assessments.
- Satellite imagery provider selection (Planetary Computer vs Sentinel Hub) — P1; deferred until P0 pipeline is complete.

---

## Open Questions

| ID | Question | Blocks |
|---|---|---|
| OQ-1 | Is `waitUntil` available on the team's Vercel plan tier, or is `pg-boss` required? | AD-12, AD-25 implementation |
| OQ-2 | Funded Alchemy/Infura account vs public Sepolia RPC? Public RPCs have rate limits that may affect anchor retry reliability. | AD-9 retry reliability |
| OQ-3 | Which 2–3 real carbon projects will be pre-seeded with real boundaries for demo? Boundaries must be publicly available (e.g., from Global Forest Watch). | AD-20, demo replay (AD-24) |

---

## Assumptions

- Turf.js v6 is the pinned version. The `turf.intersect(poly1, poly2)` API is used. Verify version on `npm install` — v7 may change signatures.
- NASA FIRMS Area API is freely accessible with a registered MAP_KEY at demo-ingestion scale. Rate limits are not a concern at the polling cadence defined.
- Neon or Supabase free tier supports Prisma's connection-pooling mode required by Vercel serverless functions.
- Carbon project boundaries for the demo seed exist publicly (e.g., via Global Forest Watch) for at least 2 projects. If not, manual GeoJSON creation from known project coordinates is acceptable.
- The `FIRMS_POINT_BUFFER_KM=1.0` default is a conservative proxy. It must be disclosed in every assessment using it as an assumption, not a measurement.
