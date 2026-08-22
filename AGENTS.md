# AGENTS.md — CARBONX

You are implementing CARBONX, a full-stack carbon-credit incident intelligence platform.

Before writing code in any session, read docs/architecture-spine.md in full.
It is the binding source of truth for this project.

docs/architecture.md, docs/data-sources.md, docs/data-pipeline.md,
docs/environment.md, and docs/epics/ are implementation references.
Where a reference document disagrees with docs/architecture-spine.md,
the Architecture Spine wins.

## Non-negotiable architecture rules

- Architecture follows a layered monolith:

  Route Layer:
  app/api/**

  ↓

  Service Layer:
  lib/services/**

  ↓

  Data Layer:
  Prisma + PostgreSQL

- Route handlers must:
  1. authenticate where required,
  2. validate input with Zod,
  3. delegate to a service,
  4. return the typed API response envelope.

- Route handlers must NOT contain:
  - business logic
  - database access
  - external API calls
  - risk calculations
  - geospatial calculations

- All external service calls must originate from lib/services/** only.

This includes:
- NASA FIRMS
- AI providers
- blockchain RPC providers

The browser must never directly call these services.

## Technology lock

Use only the technology choices defined in AD-2 of
docs/architecture-spine.md.

Do not introduce alternative frameworks, databases, ORMs,
state-management systems, blockchain libraries, or geospatial libraries
without an explicit Architecture Decision allowing it.

## Security rules

- All secrets must remain server-side.
- No privileged credential may use NEXT_PUBLIC_.
- Secrets must never be hardcoded in source code.
- Environment variables must follow the canonical names defined in
  docs/architecture-spine.md.

Canonical examples include:

NASA_FIRMS_MAP_KEY

BLOCKCHAIN_CONTRACT_ADDRESS

Do not introduce:

NASA_FIRMS_API_KEY

SMART_CONTRACT_ADDRESS

unless the Architecture Spine explicitly changes these decisions.

## Data and domain rules

Canonical entity names:

CreditHolding

Never use:

CreditLot

Canonical ProjectBoundary provenance fields:

source
sourceUrl
quality
verifiedAt

Do not introduce alternate names such as:

boundarySource
boundarySourceUrl
boundaryConfidence

unless superseded by the Architecture Spine.

## Geospatial rule

FIRMS point detections must account for the configured
FIRMS_POINT_BUFFER_KM before any candidate boundary filtering can
exclude a project.

A bounding-box optimization must be buffer-aware and must never create
false negatives by filtering against the raw unbuffered event point.

## Incident lifecycle rules

Incident status may only change through:

AuditService.transition(incidentId, toStatus, actor)

No route handler or React component may directly write IncidentStatus.

Incident lifecycle rules:

- An Incident is created at EVENT_DETECTED.
- Once a RiskAssessment exists, it transitions to UNDER_ASSESSMENT.
- MONITORING is a derived portfolio display state and is not persisted
  as an IncidentStatus history row.
- CREDIT_INVALIDATED must never be created.

Follow the complete allowed transition graph defined in AD-7.

## Risk assessment rules

RiskAssessment records are append-only.

Never silently update or overwrite an existing assessment.

Corrections create a new assessment linked using supersededById.

Identical inputs, engine versions, and methodology versions must produce
identical deterministic outputs.

Numeric calculations belong only to the deterministic services defined
by the Architecture Spine.

AI must never invent, override, or calculate risk, exposure, or physical
impact values.

## Evidence rules

Every EvidenceRecord must carry exactly one evidence label:

OBSERVED
ESTIMATED
MODELED
INFERRED

The evidence label must be preserved in:

- storage
- API responses
- UI output

A buffered FIRMS point detection is ESTIMATED.

## Blockchain rules

Blockchain is not the operational database.

PostgreSQL is the system of record.

Blockchain only stores cryptographic commitments to canonical evidence
packages.

Blockchain failure must never block or rollback the incident workflow.

Canonical blockchain eventType literals are exactly:

UNDER_ASSESSMENT
AUDIT_RECOMMENDED
RESOLVED

Do not introduce alternative eventType strings.

Do not use:

- Math.random() for transaction hashes
- fake blockchain confirmations
- hardcoded hashes
- frontend-only blockchain state changes

## AI rules

AI failure must never block the core incident workflow.

If AI generation fails:

- deterministic assessment data remains available
- audit actions remain available
- the AI interpretation is represented as unavailable

AI receives validated structured assessment data and returns
interpretation, not authoritative calculations.

## 3D rules

The 3D investigation experience is independent from the P0 workflow.

- R3F scenes receive data as props.
- R3F scenes must not directly call APIs.
- 3D is dynamically imported with SSR disabled.
- WebGL failure must fall back to a functional 2D experience.
- The complete P0 workflow must work without the 3D scene.

Do not allow 3D implementation to block the core application.

## API contract rules

All request and response Zod schemas live in:

lib/validations/

Client and server must use the shared schemas.

All route handlers return the canonical API envelope.

Raw Prisma objects must never be returned directly.

## How to work

- Implement exactly one story at a time.
- Read the relevant epic/story file completely before implementation.
- Implement only what the story requires.
- Do not automatically implement adjacent or future stories.
- Do not add features outside the story's acceptance criteria.
- Do not silently make new architectural decisions.
- If a contradiction exists between source documents:
  - Architecture Spine wins.
  - If the contradiction is not resolved by the Architecture Spine or
    this AGENTS.md, stop and report it clearly.

Before marking a story complete:

1. Re-read every acceptance criterion.
2. Verify every criterion individually.
3. Run relevant validation commands available in the repository.
4. Report files changed.
5. Report any incomplete or blocked requirement honestly.
6. Do not proceed to another story automatically.
