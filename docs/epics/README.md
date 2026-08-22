# CARBONX Epics

This directory contains the definitive, developer-ready execution blueprint for CARBONX, partitioned by owner to support parallel hackathon execution.

## Build Order & Parallel Execution

The epics are sequenced to allow a 4-person team (Developers A, B, C, D) to start in parallel on day one with minimal blocking:

1. **Developer A (Backend/Data)** starts immediately on **Epic 01 (Data Foundation)**. This establishes the Prisma schema and database which all other developers depend on.
2. **Developer B (Frontend/UX)** starts **Epic 07 (Portfolio 2D UI)** in parallel with Epic 01. Early work will use mocked API responses based on the agreed Zod schemas, swapping to real data once Epic 01 and 02 land.
3. **Developer C (AI + Blockchain)** starts **Epic 05 (AI Intelligence)** and **Epic 06 (Blockchain Anchoring)** service-layer code. They can build prompt templates, API integrations, and smart contracts against stubbed `RiskAssessment` objects in parallel, integrating fully once Epic 03 and 04 land.
4. **Developer D (3D)** performs prototyping and spikes on terrain and camera movement, but does **not** begin executing **Epic 09 (3D Investigation)** stories until Epics 01–04 are verified end-to-end, as per AD-18.

## Epic Index

| Epic | Tier | Owner | Goal |
|---|---|---|---|
| [Epic 01: Data Foundation](./epic-01-data-foundation.md) | P0 | Developer A | Establish the core PostgreSQL database, Prisma schema, and base environment. |
| [Epic 02: Ingestion Pipeline](./epic-02-ingestion-pipeline.md) | P0 | Developer A | Ingest, normalize, and deduplicate real NASA FIRMS data and project boundaries. |
| [Epic 03: Geospatial Risk Engine](./epic-03-geospatial-risk-engine.md) | P0 | Developer A | Deterministically calculate spatial overlaps, exposure, and risk scores using Turf.js. |
| [Epic 04: Incident Lifecycle](./epic-04-incident-lifecycle.md) | P0 | Developer A | Manage the state transitions and evidence timeline of an active environmental incident. |
| [Epic 05: AI Intelligence](./epic-05-ai-intelligence.md) | P0 | Developer C | Generate human-readable incident explanations from structured risk assessments using an LLM. |
| [Epic 06: Blockchain Anchoring](./epic-06-blockchain-anchoring.md) | P0 | Developer C | Commit tamper-evident hashes of canonical evidence packages to the Sepolia testnet. |
| [Epic 07: Portfolio 2D UI](./epic-07-portfolio-2d-ui.md) | P0 | Developer B | Build the premium, functional 2D dashboard for monitoring portfolios and investigating incidents. |
| [Epic 08: Audit Workflow](./epic-08-audit-workflow.md) | P0 | Developer B | Enable human review actions, timeline interaction, and audit flagging within the UI. |
| [Epic 09: 3D Investigation](./epic-09-3d-investigation.md) | P1 | Developer D | Deliver a guided cinematic story and interactive free-roam 3D sandbox for incident exploration. |

## Coverage Check

All P0 and P0.5 acceptance criteria from the PRD are mapped to stories across Epics 01-08.
- 5.1 Real Data Ingestion & Demo Replay -> Epic 02
- 5.2 Deterministic Geospatial Analysis -> Epic 03
- 5.3 AI Risk Intelligence -> Epic 05
- 5.4 Blockchain Evidence Anchoring -> Epic 06
- 5.5 2D User Interface & Investigation -> Epic 07 & 08
- 5.6 Reproducibility & Versioning -> Epic 01 & 04
- Graceful degradation constraints -> Epic 05, 06, 09
