<div align="center">

# CARBONX

### Carbon-credit incident intelligence for evidence-led review

**GIS boundaries · NASA FIRMS thermal detections · deterministic risk scoring · audit workflows**

</div>

CARBONX is a Next.js application for examining whether an environmental event intersects a carbon project and what that could mean for the project’s recorded inventory. It keeps the authoritative calculations on the server: Turf.js handles the geometry, the risk engine derives exposure, PostgreSQL stores the evidence trail, and AI is optional narrative interpretation rather than a source of truth.

## What it does

```text
project boundary + credit holdings
              │
              ▼
     NASA FIRMS event ingestion
              │
              ▼
  buffer-aware GIS intersection
              │
              ▼
 deterministic impact / exposure / risk assessment
              │
              ├── incident state machine + audit history
              ├── optional structured AI interpretation
              └── optional blockchain evidence commitment
```

The application includes a dark 2D investigation interface, Leaflet-based map views, an evidence graph, and an optional R3F investigation experience. The 3D layer is independent from the core workflow and has a functional non-WebGL path.

## Engineering boundaries

| Concern | Implementation |
| --- | --- |
| Application | Next.js 14 App Router, TypeScript, Tailwind CSS |
| System of record | PostgreSQL through Prisma |
| Geospatial calculation | Turf.js on the server; WGS84 GeoJSON inputs |
| Environmental source | NASA FIRMS thermal anomaly point detections |
| Risk calculation | Deterministic impact, credit exposure, financial exposure, and integrity-risk services |
| AI | Optional server-side Gemini or NVIDIA provider; structured output is validated and numeric claims are checked |
| Evidence anchoring | Optional viem integration with the CARBONX Solidity contract on Sepolia |
| Interface | React, Leaflet, React Three Fiber, drei, and GSAP |

## Evidence model

CARBONX deliberately distinguishes what is observed from what is calculated:

- A FIRMS hotspot is an observed satellite thermal detection at a point, not a measurement of burned area.
- Buffering that point and intersecting it with a project boundary produces an estimated geographic proxy.
- Impact, credit exposure, and financial exposure are deterministic calculations from stored inputs.
- AI can explain the structured assessment, but it cannot change its numbers or make a legal decision.
- Blockchain is an optional integrity commitment; PostgreSQL remains the operational source of truth.
- Sentinel-2 imagery and ground-sensor telemetry are not part of the P0 scoring pipeline. The optional satellite route returns an unavailable response when imagery credentials or data are not available.

## Run locally

Requirements: Node.js 18+, a PostgreSQL database, and npm.

```bash
npm ci
copy .env.example .env.local
npm run prisma:generate
npm run prisma:validate
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

`DATABASE_URL`, `NEXTAUTH_SECRET`, `NASA_FIRMS_MAP_KEY`, and `BLOCKCHAIN_CONTRACT_ADDRESS` are validated at startup. Use real local/deployment values in `.env.local`; never commit that file. AI and blockchain network calls are optional at runtime, but the application will preserve the deterministic assessment if either integration is unavailable.

For a persistent local database, apply the checked-in migrations and seed data with:

```bash
npm run prisma:migrate
npm run prisma:seed
```

The in-memory fallback is useful for read-only exploration when database reads fail, but it is not a substitute for PostgreSQL in a deployed environment.

## Verification and tests

The repository keeps the deterministic service tests lightweight: they do not download models or call external AI, blockchain, NASA, or satellite services.

```bash
npm test
npm run typecheck
npm run lint
npm run prisma:validate
npm run build
```

The test suite covers the geospatial buffer/intersection path, exposure and confidence calculations, incident transitions, AI schema and failure isolation, canonical evidence hashing, 3D fallback state, FIRMS parsing, and trust-score behavior.

## Project map

```text
app/api/                 route layer: validation, delegation, typed envelopes
lib/services/            domain logic and external-service adapters
lib/validations/         shared request/response schemas
prisma/                  schema and append-only migrations
components/              2D application interface
features/investigation-3d/  independent 3D investigation experience
tests/                   deterministic service and state tests
docs/                    architecture, data lineage, and epic decisions
```

## Status

The P0 workflow is implemented as a layered monolith with deterministic geospatial and risk services, incident/audit state transitions, structured AI degradation, and optional evidence anchoring. Satellite imagery analysis remains an explicitly deferred P1 capability.

<div align="center">

`CARBONX / evidence first / calculations reproducible`

</div>
