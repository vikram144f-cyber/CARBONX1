# CARBONX Technical Architecture

**Version:** 1.0 — Implementation-Ready Baseline
**Status:** Approved for Development
**Source of Truth:** `brainstorm-intent.md` + `prd.md`

---

## 1. Architecture Overview

CARBONX is a full-stack, monolithic Next.js application backed by a PostgreSQL database. It intentionally avoids microservices. The single Next.js process handles all frontend rendering, all API routes, all backend business logic, all background jobs, and all external service integrations. This maximizes developer velocity and minimizes operational complexity.

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER CLIENT                      │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  2D Enterprise UI   │  │  Optional 3D Investigation │ │
│  │  (React + Tailwind) │  │  (React Three Fiber/R3F)  │ │
│  └────────┬────────────┘  └──────────┬───────────────┘  │
└───────────┼───────────────────────────┼──────────────────┘
            │  HTTPS / tRPC or REST     │
┌───────────▼───────────────────────────▼──────────────────┐
│                   NEXT.JS APP SERVER                      │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Route Handlers  (app/api/**)                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │ │
│  │  │ Portfolio│ │ Events   │ │Incidents │ │ Audits │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │ │
│  │  │Assessments│ │  AI     │ │Blockchain│ │Evidence│  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Service Layer  (lib/services/**)                    │ │
│  │  GeospatialService │ RiskEngine │ AIService          │ │
│  │  BlockchainService │ IngestionService │ AuditService │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────┘
            │  Prisma Client
┌───────────▼──────────────────────────────────────────────┐
│                  POSTGRESQL DATABASE                      │
└──────────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                         │
│  NASA FIRMS API │ LLM API (Gemini/OpenAI) │ EVM Testnet  │
└──────────────────────────────────────────────────────────┘
```

**Layer responsibilities:**
- **Browser Client (2D):** All rendering, user interaction, form submission, and state display. No business logic, no raw calculations, no API keys.
- **Browser Client (3D):** R3F scene rendered in a separate canvas. Receives data props from React. Falls back gracefully if WebGL is unavailable.
- **Next.js API Routes:** Input validation (Zod), auth enforcement, delegation to service layer, unified response formatting.
- **Service Layer:** All domain logic — geospatial calculations, risk scoring, AI calls, blockchain calls. Never called directly from the browser.
- **Prisma Client:** All database access. Never raw SQL except where Prisma cannot express a needed query.
- **External Services:** NASA FIRMS (events), LLM API (interpretation), EVM Testnet (evidence anchoring). All called server-side only.

---

## 2. Technology Stack

| Category | Technology | Justification |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | Single deployment, co-located API routes, server components, edge-ready |
| **Language** | TypeScript (strict) | Eliminates runtime type errors; enforces shared contracts across layers |
| **Styling** | Tailwind CSS | Rapid, consistent, utility-first; no runtime CSS-in-JS overhead |
| **3D Rendering** | React Three Fiber + Three.js | Declarative R3F over Three.js; standard ecosystem for React 3D |
| **3D Helpers** | @react-three/drei | Orbit controls, loaders, helpers without boilerplate |
| **3D Transitions** | GSAP (GreenSock) | Industry-standard cinematic animation; timeline-based camera transitions |
| **Database** | PostgreSQL | Relational, strongly-typed, mature geospatial extension ecosystem |
| **ORM** | Prisma | Type-safe queries, migration management, schema-as-code |
| **Geospatial** | Turf.js | Pure-JS geospatial library; no native binaries; sufficient for polygon intersection |
| **AI Provider** | Google Gemini 1.5 Flash (or OpenAI GPT-4o) | Structured JSON output mode; reliable function calling |
| **Blockchain** | Solidity smart contract on Sepolia testnet | EVM-compatible; free testnet; widely understood |
| **Blockchain Client** | viem | Modern, TypeScript-native, tree-shakeable; preferred over ethers.js |
| **Authentication** | NextAuth.js (Auth.js) | First-class Next.js integration; supports database sessions |
| **API Validation** | Zod | Runtime schema validation at API boundary |
| **State Management** | React Server Components + TanStack Query | RSC for initial loads; TQ for client-side cache/invalidation |
| **Deployment** | Vercel (app) + Neon/Supabase (PostgreSQL) | Zero-config Next.js deployment; managed serverless PG |
| **Blockchain RPC** | Alchemy or Infura (Sepolia) | Free tier sufficient; reliable RPC provider |

**API key rule:** Every secret and API key lives in environment variables. No secret ever enters a client bundle or source code. All external calls originate server-side from route handlers or service functions.

---

## 3. Project Structure

```
carbonx/
├── docs/
│   ├── architecture.md          ← this file
│   ├── brainstorm-intent.md
│   └── prd.md
│
├── app/                         ← Next.js App Router root
│   ├── layout.tsx
│   ├── page.tsx                 ← Portfolio dashboard
│   ├── api/                     ← All API route handlers
│   │   ├── auth/[...nextauth]/
│   │   ├── portfolio/
│   │   ├── projects/
│   │   ├── events/
│   │   ├── incidents/
│   │   ├── assessments/
│   │   ├── evidence/
│   │   ├── ai/
│   │   ├── blockchain/
│   │   └── audits/
│   ├── portfolio/               ← Portfolio pages
│   ├── projects/[id]/           ← Project detail pages
│   ├── incidents/[id]/          ← Incident investigation pages
│   └── (auth)/                  ← Auth pages
│
├── components/                  ← Shared pure UI components
│   ├── ui/                      ← Base design system components
│   ├── maps/                    ← Leaflet/MapLibre 2D map components
│   ├── charts/                  ← Risk/confidence/exposure charts
│   └── layout/                  ← Navbar, sidebar, shell
│
├── features/                    ← Feature-specific component trees
│   ├── portfolio/
│   ├── incidents/
│   ├── evidence/
│   ├── risk/
│   ├── audit/
│   └── investigation-3d/        ← All 3D scene components
│
├── lib/                         ← Shared logic and utilities
│   ├── services/                ← Domain service layer (server-only)
│   │   ├── geospatial.ts        ← Turf.js wrapper
│   │   ├── risk-engine.ts       ← Deterministic scoring
│   │   ├── ai-service.ts        ← LLM integration
│   │   ├── blockchain.ts        ← viem + smart contract calls
│   │   ├── ingestion.ts         ← Event normalization pipeline
│   │   └── audit.ts             ← Audit workflow transitions
│   ├── validations/             ← Zod schemas
│   ├── types/                   ← Shared TypeScript types
│   ├── constants/               ← Risk thresholds, engine versions
│   └── utils/                   ← Pure utility functions
│
├── prisma/
│   ├── schema.prisma            ← Full data model definition
│   ├── migrations/              ← Append-only migration history
│   └── seed.ts                  ← Demo seed with real public data
│
├── contracts/
│   ├── CarbonXAnchor.sol        ← Evidence anchoring smart contract
│   ├── scripts/deploy.ts        ← Hardhat deployment script
│   └── test/                    ← Hardhat contract tests
│
├── public/
│   ├── models/                  ← GLTF/GLB terrain models
│   └── textures/                ← 3D environment textures
│
├── tests/
│   ├── unit/                    ← Jest unit tests
│   ├── api/                     ← API route integration tests
│   └── e2e/                     ← Playwright end-to-end tests
│
├── scripts/
│   └── replay-event.ts          ← CLI for injecting historical events
│
├── .env.example                 ← Variable names; no real values
├── hardhat.config.ts
├── next.config.ts
├── prisma/schema.prisma
└── package.json
```

**Developer ownership by folder:**
- `prisma/`, `lib/services/`, `app/api/` → Backend Developer
- `app/`, `components/`, `features/` (except 3D) → Frontend Developer
- `lib/services/ai-service.ts`, `lib/services/blockchain.ts`, `contracts/` → AI+Blockchain Developer
- `features/investigation-3d/`, `public/models/` → 3D Developer

---

## 4. Frontend Architecture

All frontend state for critical workflows originates from the database via API calls. No business-critical state is fabricated or computed in the browser.

### 4.1 Portfolio Dashboard (`/`)
- **Purpose:** High-level portfolio health view with active alerts.
- **Key components:** `PortfolioSummaryCard`, `ProjectList`, `ActiveIncidentBanner`, `RiskHeatIndicator`.
- **Data:** `GET /api/portfolio` → portfolios with aggregate risk status.
- **Loading/error:** Skeleton loaders; error banner with retry.

### 4.2 Project Detail View (`/projects/[id]`)
- **Purpose:** Single project details, credit holdings, boundary map, incident history.
- **Key components:** `ProjectHeader`, `BoundaryMap` (Leaflet), `CreditHoldingSummary`, `IncidentHistoryTimeline`.
- **Data:** `GET /api/projects/[id]` → project + boundary + holdings + incidents.

### 4.3 Incident Center (`/incidents/[id]`)
- **Purpose:** Primary investigation interface. Must support the full workflow without 3D.
- **Key components:** `ExecutiveSummaryPanel`, `EvidenceMap` (Leaflet overlay), `AssessmentDetails`, `ConfidenceIndicator`, `AIReportPanel`, `BlockchainAnchorStatus`, `AuditActionBar`.
- **Data:** `GET /api/incidents/[id]` → full incident with assessment + AI report + blockchain anchor + status history.
- **CTA:** "Open 3D Investigation" button that routes to or renders the 3D scene overlay (P1).

### 4.4 Risk Assessment View (panel within `/incidents/[id]`)
- **Purpose:** Display the deterministic risk calculation result with full provenance.
- **Key components:** `RiskConfidenceGauge`, `ExposureBreakdown`, `MethodologyVersion`, `UncertaintyDisclosure`.
- **Constraint:** All numbers originate from the backend `RiskAssessment` record. No client-side calculations.

### 4.5 Evidence Timeline (panel within `/incidents/[id]`)
- **Purpose:** Chronological record of all events, evidence records, and actions.
- **Key components:** `TimelineEntry`, `EvidenceSourceBadge`, `StatusTransitionMarker`.

### 4.6 Audit Workflow (`/incidents/[id]/audit`)
- **Purpose:** Human review interface for assigning, progressing, and resolving a case.
- **Key components:** `AuditStatusStepper`, `DispositionForm`, `NotesList`, `AddNoteForm`.
- **Data:** `GET /api/audits/[incidentId]` + `POST /api/audits/[id]/actions`.

### 4.7 Optional 3D Investigation Mode (P1)
- **Purpose:** Spatial storytelling and deeper evidence investigation.
- **Rendered by:** R3F scene mounted inside a full-screen canvas overlay.
- **Entry/exit:** Triggered from the Incident Center. Exits via an in-scene UI button or Escape key.
- **Data binding:** Scene receives incident data as React props. Backend call happens before mounting the 3D canvas.

---

## 5. 3D System Architecture (P1)

### 5.1 Design Principles
The 3D environment is optional, isolated from business logic, and can fail gracefully. It reads backend data through normal React props — it never calls APIs directly.

```
IncidentDetailPage (React)
  → fetches incident data via API
  → passes { project, incident, assessment, evidencePoints } as props
    → <Investigation3DOverlay> (conditionally rendered)
        → <Canvas> (R3F)
            → <TerrainScene>
            → <ProjectBoundaryMesh>
            → <AnomalyZoneMesh>
            → <EvidenceHotspots>
            → <CameraController>
            → <HTMLOverlayPortal> (R3F Html component)
```

### 5.2 Scene Architecture

```
<Canvas>
  ├── <Suspense fallback={<LoadingIndicator />}>
  │   ├── <TerrainScene />           — abstract stylized terrain (GLTF or procedural)
  │   ├── <VegetationLayer />        — instanced tree/plant meshes
  │   ├── <ProjectBoundaryMesh      — GeoJSON polygon → 3D extruded boundary
  │         geojson={project.boundary} />
  │   ├── <AnomalyZone              — heatmap/fire visualization mesh
  │         center={event.coordinates}
  │         estimatedRadiusKm={assessment.estimatedRadiusKm}
  │         confidence={assessment.evidenceConfidence} />
  │   ├── <EvidenceHotspots         — interactive markers
  │         points={evidencePoints} />
  │   └── <AtmosphereEffects />
  ├── <CameraController             — handles both free-roam and cinematic modes
  │     mode={cameraMode}           — 'freeroam' | 'cinematic'
  │     waypoints={WAYPOINTS} />
  └── <Html>                        — Drei HTML portal for UI overlays
        <InSceneHUD />
      </Html>
```

### 5.3 GeoJSON to 3D Coordinate Mapping
Project boundaries are stored as WGS84 GeoJSON. The 3D scene uses a local flat coordinate system (meters from center). The mapping function is:

```typescript
// lib/utils/geo-to-scene.ts
function geoToScene(lng: number, lat: number, origin: [number, number]): [number, number] {
  const METERS_PER_DEG_LAT = 111320;
  const x = (lng - origin[0]) * METERS_PER_DEG_LAT * Math.cos(origin[1] * Math.PI / 180);
  const z = (lat - origin[1]) * METERS_PER_DEG_LAT;
  return [x / SCENE_SCALE, z / SCENE_SCALE];
}
```

The scene scale constant is set per-project based on boundary extent so the entire project fits the viewing area.

### 5.4 Camera System
Two camera modes co-exist:

**Free-roam mode:**
- WASD movement on the XZ plane.
- Mouse look via pointer lock API.
- Movement clamped to a bounding box derived from the project boundary plus a buffer.
- `@react-three/drei/KeyboardControls` for input.

**Cinematic mode:**
- GSAP Timeline animates camera `position` and `lookAt` between pre-defined waypoints.
- Waypoints are defined per investigation state: `OVERVIEW`, `ANOMALY_FOCUS`, `EVIDENCE_FOCUS`, `EXIT`.
- User cannot interrupt cinematic transitions except via an explicit Escape/Skip button.
- On completion, mode automatically returns to `freeroam`.

**Transition triggers:**
| User action | Camera transition |
|---|---|
| "Open 3D" | OVERVIEW waypoint |
| Click evidence hotspot | EVIDENCE_FOCUS waypoint |
| Click "Anomaly" | ANOMALY_FOCUS waypoint |
| Click "Exit 3D" | EXIT → overlay unmounts |

### 5.5 Performance and Fallback
- The 3D canvas is dynamically imported with `next/dynamic` and `{ ssr: false }`.
- `<Suspense>` wraps the scene for asset loading.
- A WebGL capability check runs before mounting. If WebGL is unavailable, a static screenshot or 2D map is shown instead.
- Post-processing effects (bloom, depth-of-field) are disabled at runtime if `navigator.hardwareConcurrency <= 4`.

---

## 6. Database Architecture (Prisma + PostgreSQL)

### 6.1 Entity Relationship Overview

```
Organization
  └── User (many)
  └── Portfolio (many)
        └── CarbonProject (many)
              └── ProjectBoundary (versioned, many)
              └── CreditHolding (many)
              └── Incident (many)
                    └── EnvironmentalEvent (1)
                    └── EvidenceRecord (many)
                    └── RiskAssessment (versioned, many)
                          └── AIReport (1 per assessment)
                          └── BlockchainAnchor (many)
                    └── IncidentStatusHistory (many)
                    └── AuditCase (1)
                          └── AuditAction (many)
```

### 6.2 Schema

```prisma
// prisma/schema.prisma

model Organization {
  id         String      @id @default(cuid())
  name       String
  createdAt  DateTime    @default(now())
  users      User[]
  portfolios Portfolio[]
}

model User {
  id             String       @id @default(cuid())
  email          String       @unique
  name           String?
  role           UserRole     @default(ESG_OFFICER)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  auditActions   AuditAction[]
  createdAt      DateTime     @default(now())
}

enum UserRole {
  ESG_OFFICER
  INTERNAL_AUDITOR
  ADMINISTRATOR
}

model Portfolio {
  id             String        @id @default(cuid())
  name           String
  organizationId String
  organization   Organization  @relation(fields: [organizationId], references: [id])
  projects       CarbonProject[]
  createdAt      DateTime      @default(now())
}

model CarbonProject {
  id           String          @id @default(cuid())
  portfolioId  String
  portfolio    Portfolio        @relation(fields: [portfolioId], references: [id])
  name         String
  description  String?
  registryId   String?
  methodology  String?
  countryCode  String?
  centroidLng  Float
  centroidLat  Float
  boundaries   ProjectBoundary[]
  creditHoldings CreditHolding[]
  incidents    Incident[]
  createdAt    DateTime        @default(now())
}

model ProjectBoundary {
  id          String        @id @default(cuid())
  projectId   String
  project     CarbonProject @relation(fields: [projectId], references: [id])
  version     Int
  geojson     Json          // Full GeoJSON Feature or FeatureCollection
  source      String        // e.g., "verra-registry", "manual-import"
  sourceUrl   String?
  areaHa      Float?        // Pre-computed area in hectares
  quality     BoundaryQuality
  acquiredAt  DateTime
  createdAt   DateTime      @default(now())
  isCurrent   Boolean       @default(true)
  assessments RiskAssessment[]
}

enum BoundaryQuality {
  HIGH
  MEDIUM
  LOW
  UNKNOWN
}

model CreditHolding {
  id              String        @id @default(cuid())
  projectId       String
  project         CarbonProject @relation(fields: [projectId], references: [id])
  vintage         Int?
  serialRef       String?
  issuedQuantity  Float
  heldQuantity    Float
  status          HoldingStatus @default(ACTIVE)
  refValuePerUnit Float?
  refCurrency     String?       @default("USD")
  valuationBasis  String?       // "market", "book", "user-provided"
  acquiredAt      DateTime?
  createdAt       DateTime      @default(now())
}

enum HoldingStatus {
  ACTIVE
  RETIRED
  CANCELLED
  TRANSFERRED
}

model EnvironmentalEvent {
  id               String         @id @default(cuid())
  type             EventType      @default(WILDFIRE)
  sourceName       String         // e.g., "NASA FIRMS"
  sourceId         String?
  observedAt       DateTime?      // When the event occurred
  acquiredAt       DateTime       @default(now()) // When we ingested it
  geometry         Json           // GeoJSON geometry (Point or Polygon)
  geomType         String         // "Point" | "Polygon"
  sourceConfidence Float?         // 0–1 if provided by source
  sourceMetadata   Json?
  originType       EventOriginType @default(OBSERVED)
  rawPayload       Json?
  incidents        Incident[]
  evidenceRecords  EvidenceRecord[]
}

enum EventType {
  WILDFIRE
  DEFORESTATION
  FLOOD
  OTHER
}

enum EventOriginType {
  OBSERVED
  REPLAYED
  MODELED
  USER_REPORTED
}

model Incident {
  id             String         @id @default(cuid())
  projectId      String
  project        CarbonProject  @relation(fields: [projectId], references: [id])
  eventId        String
  event          EnvironmentalEvent @relation(fields: [eventId], references: [id])
  status         IncidentStatus @default(EVENT_DETECTED)
  statusHistory  IncidentStatusHistory[]
  evidenceRecords EvidenceRecord[]
  assessments    RiskAssessment[]
  auditCase      AuditCase?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

enum IncidentStatus {
  MONITORING
  EVENT_DETECTED
  UNDER_ASSESSMENT
  AUDIT_RECOMMENDED
  AUDIT_IN_PROGRESS
  INSUFFICIENT_EVIDENCE
  RESOLVED
  REOPENED
}

model IncidentStatusHistory {
  id          String         @id @default(cuid())
  incidentId  String
  incident    Incident       @relation(fields: [incidentId], references: [id])
  fromStatus  IncidentStatus?
  toStatus    IncidentStatus
  actor       String         // userId or "system"
  reason      String?
  evidenceRef String?
  createdAt   DateTime       @default(now())
}

model EvidenceRecord {
  id               String             @id @default(cuid())
  incidentId       String
  incident         Incident           @relation(fields: [incidentId], references: [id])
  eventId          String
  event            EnvironmentalEvent @relation(fields: [eventId], references: [id])
  label            EvidenceLabel
  geometryWkt      String?            // WKT for the specific evidence geometry
  sourceConfidence Float?
  notes            String?
  createdAt        DateTime           @default(now())
  assessmentInputs RiskAssessment[]   @relation("AssessmentEvidence")
  anchorRecords    BlockchainAnchor[]
}

enum EvidenceLabel {
  OBSERVED
  ESTIMATED
  MODELED
  INFERRED
}

model RiskAssessment {
  id                    String          @id @default(cuid())
  incidentId            String
  incident              Incident        @relation(fields: [incidentId], references: [id])
  boundaryId            String
  boundary              ProjectBoundary @relation(fields: [boundaryId], references: [id])
  engineVersion         String          // e.g., "geospatial-v1.0"
  methodologyVersion    String          // e.g., "risk-v1.0"
  inputEvidenceIds      String[]
  estimatedImpactHa     Float?
  impactPct             Float?          // 0–100
  creditExposure        Float?
  financialExposureEst  Float?
  financialCurrency     String?
  valuationBasis        String?
  integrityRisk         RiskLevel
  evidenceConfidence    ConfidenceLevel
  auditPriority         AuditPriorityLevel
  uncertaintyNotes      String?
  assumptions           Json?
  aiReport              AIReport?
  blockchainAnchors     BlockchainAnchor[]
  evidenceRecords       EvidenceRecord[] @relation("AssessmentEvidence")
  createdAt             DateTime        @default(now())
  supersededById        String?
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum ConfidenceLevel {
  LOW
  MEDIUM
  HIGH
}

enum AuditPriorityLevel {
  ROUTINE
  ELEVATED
  URGENT
}

model AIReport {
  id                  String         @id @default(cuid())
  assessmentId        String         @unique
  assessment          RiskAssessment @relation(fields: [assessmentId], references: [id])
  modelId             String         // e.g., "gemini-1.5-flash"
  promptVersion       String
  inputSchemaVersion  String
  outputSchemaVersion String
  facts               String
  estimatedImpacts    String
  uncertainties       String
  portfolioConsequences String
  recommendations     String
  rawResponse         Json?
  generatedAt         DateTime       @default(now())
  approvedForAudit    Boolean        @default(false)
  approvedByUserId    String?
}

model BlockchainAnchor {
  id              String          @id @default(cuid())
  assessmentId    String?
  assessment      RiskAssessment? @relation(fields: [assessmentId], references: [id])
  evidenceId      String?
  evidence        EvidenceRecord? @relation(fields: [evidenceId], references: [id])
  canonicalJson   Json
  hash            String          @unique
  network         String          // e.g., "sepolia"
  contractAddress String
  txHash          String?
  status          AnchorStatus    @default(PENDING)
  eventType       String          // e.g., "INCIDENT_DETECTED", "AUDIT_RECOMMENDED"
  confirmedAt     DateTime?
  failureReason   String?
  retryCount      Int             @default(0)
  createdAt       DateTime        @default(now())
}

enum AnchorStatus {
  PENDING
  SUBMITTED
  CONFIRMED
  FAILED
}

model AuditCase {
  id         String        @id @default(cuid())
  incidentId String        @unique
  incident   Incident      @relation(fields: [incidentId], references: [id])
  priority   AuditPriorityLevel
  assignedTo String?
  actions    AuditAction[]
  resolution String?
  resolvedAt DateTime?
  createdAt  DateTime      @default(now())
}

model AuditAction {
  id          String        @id @default(cuid())
  auditCaseId String
  auditCase   AuditCase     @relation(fields: [auditCaseId], references: [id])
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  actionType  AuditActionType
  notes       String?
  toStatus    IncidentStatus?
  createdAt   DateTime      @default(now())
}

enum AuditActionType {
  ASSIGNED
  NOTE_ADDED
  STATUS_CHANGED
  EVIDENCE_ATTACHED
  REPORT_APPROVED
  RESOLVED
}
```

---

## 7. Environmental Data Ingestion Pipeline

```
External Source (NASA FIRMS API)
  ↓
GET /api/events/ingest  [or scripts/replay-event.ts]
  ↓
IngestionService.normalize(rawPayload)
  → Validate required fields
  → Map to EnvironmentalEvent schema
  → Set originType = OBSERVED | REPLAYED
  → Detect duplicates (sourceId + sourceName + date)
  ↓
prisma.environmentalEvent.create(normalizedEvent)
  ↓
GeospatialService.findIntersectingProjects(event)
  → Load all active ProjectBoundary records for organization
  → For each boundary: turf.booleanIntersects(eventGeom, boundaryGeom)
  → Return list of { projectId, boundaryId }
  ↓
For each intersecting project:
  → prisma.incident.create({ eventId, projectId, status: EVENT_DETECTED })
  → incidentStatusHistory.create(...)
  → GeospatialService.calculateImpact(event, boundary)
  → RiskEngine.score(impactResult, creditHolding, eventMetadata)
  → prisma.riskAssessment.create(assessmentData)
  → incident.status → UNDER_ASSESSMENT
  ↓
AIService.generateReport(assessmentId)    [async, non-blocking]
  ↓
BlockchainService.anchor(assessmentId, 'INCIDENT_DETECTED')  [async, non-blocking]
```

**Duplicate detection:** An event with identical `(sourceName, sourceId, observedAt)` is flagged as a duplicate and not reprocessed. If `sourceId` is absent, a content hash of geometry + date is used.

**Failure isolation:** Each step after database persistence is independently fault-tolerant. AI failure logs an error and sets `aiReport = null`. Blockchain failure sets anchor to `PENDING` for retry.

---

## 8. Geospatial Analysis Architecture

All geospatial calculations run server-side in `lib/services/geospatial.ts`. The browser never receives or computes raw geospatial data.

### 8.1 Calculation Flow

```typescript
// lib/services/geospatial.ts

async function calculateImpact(event: EnvironmentalEvent, boundary: ProjectBoundary) {
  const eventGeom = event.geometry as GeoJSON.Geometry;
  const projectGeom = boundary.geojson as GeoJSON.Feature;

  // 1. Generate estimated impact zone
  let impactZone: GeoJSON.Feature;
  if (eventGeom.type === 'Point') {
    // Single detection point → buffer with documented radius
    // Radius is configurable via FIRMS_POINT_BUFFER_KM env var (default: 1km)
    const bufferKm = parseFloat(process.env.FIRMS_POINT_BUFFER_KM ?? '1');
    impactZone = turf.buffer(turf.feature(eventGeom), bufferKm, { units: 'kilometers' });
    // Label: ESTIMATED — derived from point detection, not observed polygon
  } else {
    impactZone = turf.feature(eventGeom);
    // Label: OBSERVED (within source limitations)
  }

  // 2. Intersect impact zone with project boundary
  const intersection = turf.intersect(
    turf.featureCollection([impactZone, projectGeom])
  );

  if (!intersection) {
    return { intersects: false, impactZone, impactHa: 0, impactPct: 0 };
  }

  // 3. Calculate areas
  const impactHa = turf.area(intersection) / 10000;
  const projectHa = boundary.areaHa ?? turf.area(projectGeom) / 10000;
  const impactPct = projectHa > 0 ? (impactHa / projectHa) * 100 : null;

  return { intersects: true, impactZone, intersection, impactHa, impactPct, projectHa };
}
```

### 8.2 Evidence Labels (enforced in all outputs)

| Scenario | Output Label |
|---|---|
| Source provides a polygon (e.g., burned-area polygon) | `OBSERVED` |
| Single point detection buffered by system | `ESTIMATED — Point detection buffered by {radius}km` |
| Model-derived extent | `MODELED` |
| Derived from indirect indicators | `INFERRED` |

This label must appear in the `EvidenceRecord.label` field and be displayed prominently in the UI.

### 8.3 Versioning
Every assessment records `engineVersion` (e.g., `"geospatial-v1.0"`) and `methodologyVersion`. Constants are defined in `lib/constants/engine-versions.ts`. When calculation logic changes, the version string increments. Old assessments remain linked to the version used at their creation time.

---

## 9. Risk Engine Architecture

`lib/services/risk-engine.ts` — Deterministic, testable, versioned. The AI layer never invokes or overrides these calculations.

### 9.1 Input Interface

```typescript
interface RiskEngineInput {
  impactHa: number;
  impactPct: number;              // 0–100
  projectHa: number;
  heldCredits: number;
  refValuePerUnit: number;
  refCurrency: string;
  sourceConfidence: number;       // 0–1, from source metadata
  boundaryQuality: BoundaryQuality;
  evidenceLabel: EvidenceLabel;
  dateFreshnessHours: number;     // Hours since observation
  hasCorroboration: boolean;
}
```

### 9.2 Calculations (Methodology v1.0)

```
Credit Exposure = heldCredits × (impactPct / 100)
Financial Exposure = creditExposure × refValuePerUnit

Integrity Risk:
  if impactPct >= 50 → CRITICAL
  else if impactPct >= 20 → HIGH
  else if impactPct >= 5 → MEDIUM
  else → LOW

Evidence Confidence (scored 0–100, then bucketed):
  baseScore = sourceConfidence × 40    (0–40 pts)
  + freshnessScore:
      if dateFreshnessHours <= 24 → 20 pts
      if <= 72 → 10 pts
      else → 0 pts
  + boundaryScore:
      HIGH → 20, MEDIUM → 10, LOW → 5, UNKNOWN → 0
  + corroborationBonus:
      hasCorroboration → 10 pts, else 0
  + evidenceLabelPenalty:
      OBSERVED → 0, ESTIMATED → -10, MODELED → -20, INFERRED → -30

  finalScore = max(0, min(100, totalScore))
  LOW: 0–40 | MEDIUM: 41–70 | HIGH: 71–100

Audit Priority:
  if integrityRisk ∈ [CRITICAL, HIGH] AND evidenceConfidence ∈ [MEDIUM, HIGH] → URGENT
  if integrityRisk ∈ [HIGH, MEDIUM] OR evidenceConfidence == LOW → ELEVATED
  else → ROUTINE
```

All thresholds are defined as named constants in `lib/constants/risk-thresholds.ts` and stored alongside the assessment.

---

## 10. AI Intelligence Architecture

AI is called server-side in `lib/services/ai-service.ts`. The browser never directly contacts the LLM API.

### 10.1 Pipeline

```
RiskAssessment (from DB)
  ↓
Build structured input payload (AIReportInput)
  ↓
Validate payload with Zod (inputSchema v1.0)
  ↓
Send to LLM API with structured output mode
  ↓
Receive response
  ↓
Validate response with Zod (outputSchema v1.0)
  ↓
Validate: numbers in AI response match assessment (±0.01 tolerance)
  ↓
prisma.aIReport.create(validatedReport)
```

### 10.2 Input Schema

```typescript
const AIReportInputSchema = z.object({
  schemaVersion: z.literal("ai-input-v1.0"),
  incident: z.object({ id: z.string(), projectName: z.string(), eventType: z.string() }),
  assessment: z.object({
    engineVersion: z.string(),
    methodologyVersion: z.string(),
    estimatedImpactHa: z.number().nullable(),
    impactPct: z.number().nullable(),
    projectHa: z.number().nullable(),
    creditExposure: z.number().nullable(),
    financialExposure: z.number().nullable(),
    financialCurrency: z.string(),
    integrityRisk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    evidenceConfidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    auditPriority: z.enum(["ROUTINE", "ELEVATED", "URGENT"]),
    uncertaintyNotes: z.string().nullable(),
    evidenceLabel: z.string(),
    sourceName: z.string(),
    observedAt: z.string().nullable(),
  }),
});
```

### 10.3 Output Schema (required AI sections)

```typescript
const AIReportOutputSchema = z.object({
  schemaVersion: z.literal("ai-output-v1.0"),
  facts: z.string().max(500),
  estimatedImpacts: z.string().max(500),
  uncertainties: z.string().max(500),
  portfolioConsequences: z.string().max(500),
  recommendations: z.string().max(500),
});
```

### 10.4 Prompt Architecture

```
SYSTEM: You are a carbon-credit risk analyst assistant. Interpret the structured 
assessment provided. Do not invent evidence, calculate values, or make legal decisions. 
Clearly distinguish observed facts from estimates. Use conditional language for 
uncertain findings. Output strict JSON matching the provided schema.

USER: [JSON.stringify(validatedInputPayload)]
```

### 10.5 Failure Handling

| Scenario | Behavior |
|---|---|
| LLM API timeout / 5xx | Retry once with exponential backoff; set AIReport = null if both fail |
| Schema validation fails | Log error; discard response; set AIReport = null |
| Numbers don't match assessment | Log inconsistency; human review flag; do not persist report |
| AI unavailable | Incident workflow continues; "Interpretation Unavailable" shown |

---

## 11. Blockchain Architecture

### 11.1 Smart Contract

```solidity
// contracts/CarbonXAnchor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CarbonXAnchor {
    event EvidenceAnchored(
        bytes32 indexed incidentId,
        bytes32 hash,
        string eventType,
        uint256 timestamp
    );

    function anchor(
        bytes32 incidentId,
        bytes32 evidenceHash,
        string calldata eventType
    ) external {
        emit EvidenceAnchored(incidentId, evidenceHash, eventType, block.timestamp);
    }
}
```

The contract emits a single event per anchor. It stores no persistent state on-chain (gas-minimal). The `txHash` returned from the transaction is stored in PostgreSQL and is the verification reference.

### 11.2 Canonical Evidence Package

Before hashing, the evidence package is deterministically serialized:

```typescript
// lib/services/blockchain.ts
function buildCanonicalRecord(assessment: RiskAssessment, eventType: string): object {
  return {
    schemaVersion: "anchor-v1.0",
    incidentId: assessment.incidentId,
    assessmentId: assessment.id,
    engineVersion: assessment.engineVersion,
    methodologyVersion: assessment.methodologyVersion,
    integrityRisk: assessment.integrityRisk,
    evidenceConfidence: assessment.evidenceConfidence,
    inputEvidenceIds: [...assessment.inputEvidenceIds].sort(),
    boundaryId: assessment.boundaryId,
    timestamp: assessment.createdAt.toISOString(),
    eventType,
  };
}

// Deterministic serialization: sorted keys, no whitespace
const canonicalJson = JSON.stringify(buildCanonicalRecord(assessment, eventType),
  Object.keys(buildCanonicalRecord(assessment, eventType)).sort()
);
const hash = keccak256(toBytes(canonicalJson));
```

### 11.3 Blockchain Failure Handling

```
anchor() call fails
  ↓
Set BlockchainAnchor.status = FAILED
Set BlockchainAnchor.failureReason = error.message
  ↓
Operational workflow continues unaffected
  ↓
Background retry job (max 3 attempts, exponential backoff)
  ↓
If still failing after 3 attempts → status = FAILED (manual retry available)
```

**What blockchain proves:** That a specific evidence package in a specific form was committed at a particular point in time.
**What blockchain does NOT prove:** That the environmental event itself occurred, that the damage was as estimated, or that credits are invalid.

### 11.4 Anchored Events

| Event | When Anchored |
|---|---|
| `INCIDENT_DETECTED` | After risk assessment creation |
| `AUDIT_RECOMMENDED` | On status transition to `AUDIT_RECOMMENDED` |
| `AUDIT_RESOLVED` | On incident resolution |

---

## 12. Backend/API Architecture

All route handlers follow this pattern:
1. Authenticate request (NextAuth session check).
2. Validate input with Zod schema.
3. Authorize: verify the requested resource belongs to the user's organization.
4. Delegate to the service layer.
5. Return a typed response.

### 12.1 API Route Map

```
POST /api/events/ingest              → IngestionService.ingest()
POST /api/events/replay              → IngestionService.replay(historicalEventId)

GET  /api/portfolio                  → portfolios for org
GET  /api/projects                   → projects for org
GET  /api/projects/[id]              → single project + boundary + holdings
POST /api/projects                   → create project
POST /api/projects/[id]/boundary     → upload/update GeoJSON boundary

GET  /api/incidents                  → all incidents for org
GET  /api/incidents/[id]             → full incident detail
PATCH /api/incidents/[id]/status     → transition status (human-triggered)

GET  /api/assessments/[incidentId]   → all assessments for incident
POST /api/assessments/[incidentId]/recalculate  → create new assessment version

GET  /api/evidence/[incidentId]      → evidence records for incident

GET  /api/ai/report/[assessmentId]   → fetch AI report
POST /api/ai/report/[assessmentId]/approve  → mark report approved for audit

GET  /api/blockchain/[assessmentId]  → anchor status
POST /api/blockchain/[assessmentId]/retry  → manual retry

GET  /api/audits/[incidentId]        → audit case detail
POST /api/audits/[incidentId]/actions → add audit action (note, status change)
```

### 12.2 Response Envelope

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };
```

---

## 13. Incident State Machine

```
                    ┌─────────────┐
                    │  MONITORING │◄──────────────────────┐
                    └──────┬──────┘                       │
                           │ [system: event intersects]   │
                    ┌──────▼──────────┐                   │
                    │ EVENT_DETECTED  │                   │
                    └──────┬──────────┘                   │
                           │ [system: assessment created]  │
               ┌───────────▼──────────────┐               │
               │     UNDER_ASSESSMENT     │               │
               └───────────┬──────────────┘               │
            ┌──────────────┴──────────────┐               │
            ▼                             ▼               │
┌──────────────────────┐    ┌────────────────────────┐    │
│  INSUFFICIENT_EVID.  │    │  AUDIT_RECOMMENDED     │    │
└──────────────────────┘    └────────────┬───────────┘    │
                                         │ [human]        │
                             ┌───────────▼──────────┐     │
                             │  AUDIT_IN_PROGRESS   │     │
                             └───────────┬──────────┘     │
                                         │ [human]        │
                             ┌───────────▼──────────┐     │
                             │      RESOLVED        │──┐  │
                             └──────────────────────┘  │  │
                                                        │  │
                             ┌──────────────────────┐  │  │
                             │      REOPENED        │◄─┘  │
                             └──────────┬───────────┘      │
                                        └──────────────────┘
                                        [system: UNDER_ASSESSMENT]
```

**Enforcement:** Every status transition goes through `AuditService.transition(incidentId, toStatus, actor)`. Disallowed transitions throw a typed `InvalidTransitionError`. The service also creates the `IncidentStatusHistory` record atomically.

**Blockchain-anchored transitions:** `EVENT_DETECTED → UNDER_ASSESSMENT`, `UNDER_ASSESSMENT → AUDIT_RECOMMENDED`, `AUDIT_IN_PROGRESS → RESOLVED`.

---

## 14. Security and Environment Variables

### 14.1 Auth
NextAuth.js with database sessions stored in PostgreSQL. JWT option is acceptable if session storage is impractical. Protected routes check `auth()` in server components or `getServerSession()` in route handlers.

### 14.2 Organization Isolation
Every database query includes an `organizationId` filter derived from the authenticated session. No cross-org data leaks are possible as long as Prisma queries include this filter. A shared middleware utility `assertOrgOwnership(resource, session)` enforces this consistently.

### 14.3 .env.example

```bash
# Application
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=

# AI
AI_PROVIDER=gemini               # or openai
GEMINI_API_KEY=
OPENAI_API_KEY=                  # if using OpenAI

# Blockchain
BLOCKCHAIN_RPC_URL=              # e.g., https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
BLOCKCHAIN_PRIVATE_KEY=          # wallet funding testnet transactions
SMART_CONTRACT_ADDRESS=

# Environmental Data
NASA_FIRMS_API_KEY=              # required for live ingestion
FIRMS_POINT_BUFFER_KM=1          # default buffer radius for point detections

# Geospatial
NEXT_PUBLIC_MAPBOX_TOKEN=        # only needed if Mapbox GL is used for 2D maps (optional)
```

**Rules:**
- No `NEXT_PUBLIC_` prefix on any secret. `NEXT_PUBLIC_MAPBOX_TOKEN` is the only public variable and contains no privileged access.
- `BLOCKCHAIN_PRIVATE_KEY` never leaves the server process.
- All external calls originate from `lib/services/**`. Route handlers delegate to services; they never directly call external APIs.

---

## 15. Error Handling and Failure Modes

| Failure | System Behavior |
|---|---|
| NASA FIRMS API unavailable | Log failure; surface "Live data unavailable"; allow historical replay |
| Invalid GeoJSON boundary | Reject on import with validation error; mark project as `BOUNDARY_MISSING` |
| Self-intersecting GeoJSON | Turf.js error caught; mark incident `INSUFFICIENT_EVIDENCE` |
| Event outside all project boundaries | Record no-intersection result; no incident created |
| Duplicate event detected | Skip processing; log as duplicate; return 200 with `{ duplicate: true }` |
| AI API timeout (retry exhausted) | Set `aiReport = null`; show "Interpretation Unavailable"; workflow continues |
| AI output fails schema validation | Discard; log; `aiReport = null`; do not surface corrupt output to user |
| Blockchain RPC failure | Set anchor `FAILED`; queue retry; incident workflow unaffected |
| Database connection failure | 503 response; no partial writes; Prisma transaction rollback |
| 3D WebGL unavailable | Show "3D unavailable on this device"; 2D interface remains fully functional |
| Missing credit holding | Show financial exposure as "Unavailable"; do not fabricate a value |
| Missing valuation data | Show financial exposure as "Pending — valuation not configured" |

**Principle:** The system always prefers "Unknown" or "Unavailable" over fabricated certainty.

---

## 16. Testing Strategy

### 16.1 Unit Tests (Jest) — `tests/unit/`
- `geospatial.test.ts` — point buffering, intersection, area, no-intersection, invalid GeoJSON
- `risk-engine.test.ts` — all score combinations, threshold edges, version pinning
- `ingestion.test.ts` — normalization, duplicate detection, missing field handling
- `blockchain.test.ts` — canonical serialization determinism, hash consistency
- `ai-service.test.ts` — schema validation, numeric consistency check, failure fallback

### 16.2 API Integration Tests (Jest + Supertest) — `tests/api/`
- Full incident pipeline: POST event → DB persisted → GET incident → assessment exists
- Status transition: valid and invalid transitions
- Audit action: note added → persists in history
- Auth: protected routes reject unauthenticated calls
- Org isolation: user from org A cannot access org B's incidents

### 16.3 Smart Contract Tests (Hardhat) — `contracts/test/`
- `anchor()` emits `EvidenceAnchored` with correct args
- Duplicate hash submission (not blocked by contract but logged in DB)

### 16.4 End-to-End Tests (Playwright) — `tests/e2e/`
- Critical path: seed DB → replay historical event → incident appears → review assessment → flag audit → audit resolved
- Verify no `setTimeout` or console mock calls in test run

---

## 17. Deployment Architecture

```
Developer Machine
  → git push → GitHub
  → PR opened → GitHub Actions
      ├── tsc --noEmit
      ├── eslint
      ├── jest (unit + API tests)
      └── prisma validate
  → Merge to main
  → Vercel automatic deployment
      ├── Environment variables from Vercel dashboard
      ├── prisma migrate deploy (runs on build)
      └── Next.js build
  → Neon/Supabase PostgreSQL (always-on)
  → Sepolia Testnet (contract pre-deployed, address in env)
```

**Database migrations:** Migration files live in `prisma/migrations/`. They are append-only. Never edit an existing migration. Breaking schema changes require a new migration.

**Smart contract:** Deployed once to Sepolia. Address stored in `SMART_CONTRACT_ADDRESS`. Redeployment only needed for contract logic changes.

---

## 18. Team Development Strategy

### 18.1 Ownership Boundaries

| Developer | Primary ownership |
|---|---|
| **A — Backend/Data** | `prisma/schema.prisma`, `lib/services/geospatial.ts`, `lib/services/risk-engine.ts`, `lib/services/ingestion.ts`, `app/api/**` |
| **B — Frontend/UX** | `app/` pages, `components/`, `features/` (non-3D), `lib/validations/` |
| **C — AI + Blockchain** | `lib/services/ai-service.ts`, `lib/services/blockchain.ts`, `contracts/` |
| **D — 3D World** | `features/investigation-3d/`, `public/models/`, `public/textures/` |

### 18.2 Branch Strategy
- `main` → always deployable, protected.
- Feature branches: `feat/[area]-[description]` (e.g., `feat/backend-geospatial-engine`).
- PRs require at minimum one review before merging.

### 18.3 API Contract Discipline
- All Zod schemas live in `lib/validations/`. Both route handlers (server) and TanStack Query fetchers (client) import from this shared location.
- A developer never changes a Zod schema without updating both sides.
- `prisma generate` is run after every schema change. The generated client is never committed to git.

### 18.4 Database Migration Rules
- Only Developer A creates migration files.
- Migrations are reviewed in PRs before merge.
- Never run `prisma migrate reset` on a shared environment.

---

## 19. Implementation Priorities

### P0 — Must Function (Core Pipeline)
1. Database schema migrations and seed data (real project boundaries + historical FIRMS event).
2. Event ingestion API + normalization + duplicate detection.
3. Geospatial intersection + impact calculation.
4. Risk engine scoring (all 6 concepts).
5. Incident lifecycle + status transitions + history.
6. AI interpretation (calling LLM with structured input/output).
7. Blockchain anchor (hash + testnet transaction + status tracking).
8. Portfolio dashboard (list projects, active incidents).
9. Incident detail page (2D map, assessment, evidence, timeline).
10. Audit action: flag/recommend + disposition.

### P0.5 — Presentation-Critical
1. Polished Tailwind UI with risk/confidence indicators, status badges, exposure cards.
2. 2D Leaflet map with project geofence, event location, estimated impact zone.
3. 3D investigation scene: terrain, geofence boundary, fire zone visualization.
4. Cinematic camera transitions: overview → project → anomaly → evidence hotspot → exit.
5. Limited WASD exploration within scene bounds.
6. Evidence hotspot interaction with UI overlay.

### P1 — Important Enhancements
- Historical scenario replay UI with source attribution disclosure.
- PDF/JSON incident report export.
- Additional event types (deforestation).
- AI report approval flow.

### P2 — Stretch / Post-MVP
- Multi-registry integration.
- Real-time event polling cadence configuration.
- Enterprise role management.
- Audit collaboration (external auditor invitation).

---

## 20. Final Architecture Decisions

| Decision | Chosen | Reason | Rejected Alternatives |
|---|---|---|---|
| Framework | Next.js 14 App Router | Unified full-stack, server components, edge-ready | Separate Express API + CRA |
| Database | PostgreSQL | Relational integrity, JSON support for GeoJSON, mature ecosystem | MongoDB (no relational integrity), SQLite (not production-grade) |
| ORM | Prisma | Type-safe, migration management, schema-as-code | TypeORM (less ergonomic TS), Drizzle (less mature migration story) |
| Backend architecture | Monolith (Next.js API Routes + Service Layer) | Sufficient for MVP; avoids microservice operational overhead | Microservices (over-engineered for this scope) |
| Geospatial library | Turf.js | Pure-JS, no native deps, sufficient for polygon intersection | PostGIS (more power but requires raw SQL + extension setup), Shapely (Python, wrong runtime) |
| AI provider | Gemini 1.5 Flash (default) | Structured JSON output mode; fast; cost-effective; Gemini API free tier | GPT-4o (more expensive); Anthropic Claude (no structured output mode on free tier) |
| Blockchain approach | Minimal event-emitting contract on Sepolia | Gas-minimal; easily verifiable; no state storage on-chain | Full on-chain state (expensive, unnecessary); IPFS (different trust model) |
| Blockchain client | viem | Modern TS-native, tree-shakeable, actively maintained | ethers.js v5 (older API, larger bundle) |
| 3D architecture | R3F + drei + GSAP | Declarative React integration; GSAP for timeline animations | Babylon.js (heavier, less React-native), PlayCanvas (game engine, overkill) |
| State management | RSC + TanStack Query | RSC for initial server data; TQ for client-side cache/mutations | Redux (overkill), Zustand (fine but TQ already handles server state) |
| Authentication | NextAuth.js | First-class Next.js support; database sessions; multiple providers | Custom JWT (more work), Clerk (additional cost) |
| Deployment | Vercel + Neon | Zero-config Next.js; serverless PostgreSQL with branching | AWS (more complex setup), Railway (fine alternative) |

---

**Internal Architecture Review Checklist:**

- [x] Every PRD P0 requirement has a technical home in the service layer and API routes.
- [x] Core workflow operates if AI fails — assessments and audit actions function without `AIReport`.
- [x] Core workflow operates if blockchain fails — anchor status is `FAILED`; incident workflow continues.
- [x] Core workflow operates if 3D fails — WebGL fallback returns to 2D; 3D is mounted independently.
- [x] API keys and secrets are all server-side environment variables; no `NEXT_PUBLIC_` exposure.
- [x] Developer A/B/C/D can work independently with shared Zod schemas as the API contract.
- [x] Architecture is Codex-implementable feature-by-feature; each service file is independently testable.
- [x] Deterministic calculations (risk engine, geospatial) are clearly separated from AI interpretation.
- [x] Observations, estimates, AI interpretation, and human decisions are distinct fields/statuses.
- [x] No microservices, no over-engineering; single Next.js process handles everything.
- [x] Every data value has a traceable origin (EXTERNAL_SOURCE / SYSTEM_CALCULATION / AI_GENERATION / HUMAN_ACTION / REPLAY).
- [x] No production feature depends on hardcoded frontend values.
- [x] NASA FIRMS is the exclusive real environmental event source; point detections are labeled ESTIMATED when buffered.
- [x] Satellite imagery is explicitly deferred to P1; no fake imagery results in P0.

---

## 21. External Data Sources and Ingestion Architecture

> **Cross-reference:** See `docs/data-sources.md` for the complete data source matrix and `docs/data-pipeline.md` for the full end-to-end pipeline. This section provides the implementation-level component specification.

### 21.1 FIRMSIngestionService

**File:** `lib/services/firms-ingestion.ts`  
**Owner:** Developer A  
**Purpose:** Provides all NASA FIRMS satellite fire/thermal detection data to CARBONX

#### API Access

```typescript
// lib/services/firms-ingestion.ts
const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area";

type FIRMSSource = "VIIRS_SNPP_NRT" | "VIIRS_NOAA20_NRT" | "MODIS_NRT";

interface FIRMSRecord {
  latitude: string;
  longitude: string;
  acq_date: string;       // "YYYY-MM-DD"
  acq_time: string;       // "HHMM"
  satellite: string;
  instrument: string;
  confidence: string;     // VIIRS: "n"|"l"|"h"; MODIS: "0"-"100"
  frp: string;            // Fire Radiative Power (MW)
  version: string;
  bright_t31?: string;
  bright_ti4?: string;
}

// Build the bbox from all org project boundary centroids + 2-degree padding
async function buildMonitoringBbox(orgId: string): Promise<string> {
  const centroids = await prisma.carbonProject.findMany({
    where: { portfolio: { organizationId: orgId } },
    select: { centroidLng: true, centroidLat: true }
  });
  const lngs = centroids.map(c => c.centroidLng);
  const lats = centroids.map(c => c.centroidLat);
  const minLng = Math.min(...lngs) - 2;
  const maxLng = Math.max(...lngs) + 2;
  const minLat = Math.min(...lats) - 2;
  const maxLat = Math.max(...lats) + 2;
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

async function fetchFIRMS(source: FIRMSSource, bbox: string, days: number): Promise<FIRMSRecord[]> {
  const url = `${FIRMS_BASE}/json/${env.NASA_FIRMS_MAP_KEY}/${source}/${bbox}/${days}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FIRMS API error: ${res.status}`);
  return res.json();
}
```

#### Normalization and Fingerprinting

```typescript
import { createHash } from "crypto";

function normalizeConfidence(record: FIRMSRecord): number {
  const c = record.confidence.toLowerCase();
  if (c === "n") return 0.3;
  if (c === "l") return 0.6;
  if (c === "h") return 0.9;
  const n = parseInt(c, 10);
  return isNaN(n) ? 0.5 : n / 100;
}

function buildFingerprint(record: FIRMSRecord): string {
  const key = `${record.latitude}|${record.longitude}|${record.acq_date}|${record.acq_time}|${record.instrument}`;
  return createHash("sha256").update(key).digest("hex");
}

function normalizeRecord(record: FIRMSRecord, source: FIRMSSource) {
  const lng = parseFloat(record.longitude);
  const lat = parseFloat(record.latitude);
  const observedAt = new Date(`${record.acq_date}T${record.acq_time.slice(0,2)}:${record.acq_time.slice(2)}:00Z`);
  return {
    type: "WILDFIRE" as const,
    sourceName: `NASA FIRMS ${source}`,
    geomType: "Point" as const,
    geometry: { type: "Point", coordinates: [lng, lat] },
    sourceConfidence: normalizeConfidence(record),
    sourceMetadata: {
      frp: parseFloat(record.frp),
      satellite: record.satellite,
      instrument: record.instrument,
      dataVersion: record.version,
    },
    observedAt,
    acquiredAt: new Date(),
    originType: "OBSERVED" as const,
    rawPayload: record,
    fingerprint: buildFingerprint(record),
    ingestorVersion: INGESTOR_VERSION,
    createdByType: "EXTERNAL_SOURCE" as const,
  };
}
```

#### What a FIRMS hotspot means vs. what CARBONX concludes

```
FIRMS RECORD:
  "Satellite instrument detected a thermal signature at (lat, lng) at (timestamp)
   with confidence (n/l/h) and fire radiative power (FRP) of X MW."
  → Stored as: EnvironmentalEvent (originType: OBSERVED, label: OBSERVED)

CARBONX ADDS:
  1-km buffer around point → estimated impact zone (label: ESTIMATED)
  Intersection with project boundary → overlap polygon (label: ESTIMATED)
  Area calculation → estimatedImpactHa (label: CALC)
  Risk scoring → integrityRisk (label: CALC)

CARBONX DOES NOT CLAIM:
  - That the entire area within the buffer is burned
  - That credits are invalidated
  - That the fire caused any permanent project loss
```

### 21.2 Project Boundary Import Service

**File:** `lib/services/boundary-import.ts`  
**Owner:** Developer A  
**Triggered by:** `POST /api/projects/[id]/boundary`

```typescript
interface BoundaryImportInput {
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection;
  boundarySource: string;             // e.g., "user-import", "global-forest-watch"
  boundarySourceUrl?: string;
  boundaryConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
}

async function importBoundary(projectId: string, input: BoundaryImportInput, actorId: string) {
  // 1. Validate geometry
  const area = turf.area(input.geojson);  // throws if invalid
  if (area <= 0) throw new Error("Boundary has no area");

  // 2. Convert to Feature if FeatureCollection (take first feature)
  const feature = input.geojson.type === "FeatureCollection"
    ? input.geojson.features[0]
    : input.geojson;

  // 3. Compute derived values
  const areaHa = area / 10000;
  const centroid = turf.centroid(feature);
  const [centroidLng, centroidLat] = centroid.geometry.coordinates;

  // 4. Version it
  const latest = await prisma.projectBoundary.findFirst({
    where: { projectId }, orderBy: { version: "desc" }
  });
  const version = latest ? latest.version + 1 : 1;

  return prisma.$transaction([
    // Deactivate old boundary
    prisma.projectBoundary.updateMany({
      where: { projectId, isCurrent: true },
      data: { isCurrent: false }
    }),
    // Create new boundary
    prisma.projectBoundary.create({
      data: {
        projectId, version,
        geojson: feature as any,
        areaHa,
        boundarySource: input.boundarySource,
        boundarySourceUrl: input.boundarySourceUrl,
        boundaryConfidence: input.boundaryConfidence,
        acquiredAt: new Date(),
        isCurrent: true,
        createdByType: "HUMAN_ACTION",
        createdById: actorId,
      }
    }),
    // Update project centroid
    prisma.carbonProject.update({
      where: { id: projectId },
      data: { centroidLng, centroidLat }
    }),
  ]);
}
```

### 21.3 Credit Holdings Import

**File:** `lib/services/credit-lot-import.ts`  
**Owner:** Developer A  
**Triggered by:** `POST /api/credit-lots/import` (CSV) or `POST /api/credit-lots` (single)

Credit lot data is **never sourced from a public API**. It is organization-entered. The schema preserves the valuation basis and currency to make financial exposure estimates reproducible.

```typescript
interface CreditLotInput {
  projectId: string;
  portfolioId: string;
  vintage: number;
  heldQuantity: number;
  acquiredQuantity: number;
  refValuePerUnit: number;
  refCurrency: string;           // ISO 4217
  valuationBasis: "market" | "book" | "user-provided";
  registrySerialRef?: string;
  acquisitionDate?: string;
}
```

### 21.4 Data Provenance Model

Every record in CARBONX that produces or derives a meaningful value carries provenance fields. This is enforced by the Prisma schema — fields are not nullable where provenance is required.

```prisma
// Applied to EnvironmentalEvent
model EnvironmentalEvent {
  // ...
  sourceName        String            // "NASA FIRMS VIIRS NRT"
  fingerprint       String   @unique  // SHA256 for deduplication
  originType        OriginType        // OBSERVED | REPLAYED | MODELED | USER_REPORTED
  sourceConfidence  Float?            // 0.0–1.0 from instrument
  sourceMetadata    Json              // frp, satellite, instrument, version
  rawPayload        Json              // full original record
  observedAt        DateTime          // when the satellite detected it
  acquiredAt        DateTime          // when CARBONX ingested it
  ingestorVersion   String            // FIRMSIngestionService version
  createdByType     CreatedByType     // EXTERNAL_SOURCE | REPLAY
}

enum OriginType { OBSERVED  REPLAYED  MODELED  USER_REPORTED }
enum CreatedByType { EXTERNAL_SOURCE  SYSTEM_CALCULATION  AI_GENERATION  HUMAN_ACTION  REPLAY }
```

### 21.5 MonitoringCheckpoint Model

```prisma
model MonitoringCheckpoint {
  id                String   @id @default(cuid())
  sourceName        String   @unique
  lastSuccessAt     DateTime
  lastAttemptAt     DateTime
  consecutiveFails  Int      @default(0)
  lastErrorMessage  String?
  updatedAt         DateTime @updatedAt
}
```

### 21.6 Satellite Imagery — Deferred (P1)

Satellite imagery analysis (Sentinel-2, Landsat) is explicitly **deferred to P1**. In P0:

- No imagery panels show data — they show "Satellite imagery not yet integrated"
- No NDVI, dNBR, or burn-scar computation occurs
- No fake or estimated imagery data is displayed

When P1 is implemented:

- **Recommended provider:** Microsoft Planetary Computer (free STAC API for Sentinel-2 and Landsat)
- **Access:** STAC search by bbox + date range → Cloud-Optimized GeoTIFF tile URL
- **Processing:** Server-side band math (NIR - RED) / (NIR + RED) for NDVI; requires compute budget
- **Storage:** Imagery tiles are not stored in PostgreSQL; URLs are stored in `EvidenceRecord.sourceUrl`
- **Evidence label:** `OBSERVED` for raw imagery; `CALC` for computed indices

### 21.7 Controlled Replay — Implementation Detail

**File:** `app/api/events/replay/route.ts` → delegates to `FIRMSIngestionService.replay()`

```typescript
// The replay endpoint reads a seed event and runs it through the real pipeline
async function replay(seedEventId: string, actor: string) {
  const seedEvent = await prisma.environmentalEvent.findUniqueOrThrow({
    where: { id: seedEventId }
  });

  // Create a replay copy — does NOT modify the seed
  const replayEvent = await prisma.environmentalEvent.create({
    data: {
      ...omit(seedEvent, ["id", "createdAt", "updatedAt"]),
      originType: "REPLAYED",
      acquiredAt: new Date(),
      createdByType: "REPLAY",
    }
  });

  // Pass through the REAL pipeline from Phase 3 onwards
  await GeospatialService.processEvent(replayEvent.id);
  // ... which calls RiskEngine, creates Incident, triggers AIService + BlockchainService
}
```

### 21.8 Updated Project Structure (Data Layer Additions)

```
lib/services/
  ├── geospatial.ts          ← Turf.js polygon intersection + area
  ├── risk-engine.ts         ← Deterministic scoring
  ├── ai-service.ts          ← LLM integration
  ├── blockchain.ts          ← viem + smart contract
  ├── firms-ingestion.ts     ← [NEW] NASA FIRMS API + normalization
  ├── boundary-import.ts     ← [NEW] GeoJSON boundary import + versioning
  ├── credit-lot-import.ts   ← [NEW] Credit holdings entry/import
  └── audit.ts               ← Audit workflow transitions

prisma/
  ├── schema.prisma           ← Updated with MonitoringCheckpoint, provenance fields
  └── seed.ts                 ← Real FIRMS observations + real project boundaries
```

### 21.9 Updated Environment Variables Reference

See `docs/environment.md` for the complete specification. Key additions for data sources:

```bash
NASA_FIRMS_MAP_KEY=           # Required. Free from NASA FIRMS registration.
FIRMS_SOURCES=VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT
FIRMS_POINT_BUFFER_KM=1.0    # Buffer radius for point detections (documented assumption)
MONITORING_INTERVAL_HOURS=6   # Polling cadence
```

### 21.10 No Dummy Data Rule — Enforcement

These patterns are **banned** from the CARBONX codebase:

```typescript
// ❌ BANNED
setTimeout(() => setStatus("EVENT_DETECTED"), 3000);
Math.random().toString(36).slice(2)  // as a "transaction hash"
const riskScore = 0.73;  // hardcoded
const affectedArea = "450 ha";  // hardcoded string
const txHash = "0xfake...";  // not from a real transaction

// ✅ REQUIRED
const incident = await fetch("/api/incidents/[id]");  // real backend
const assessment = await RiskEngine.score(realInputs);  // real calculation
const txHash = (await blockchainService.anchor(assessment)).txHash;  // real network
```

ESLint rules enforcing the no-dummy-data contract should be added as custom rules in `.eslintrc`. At minimum, a PR checklist item must confirm: "No hardcoded risk scores, exposure values, transaction hashes, or status changes in this diff."

