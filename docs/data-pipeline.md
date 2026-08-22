# CARBONX — Data Pipeline

**Version:** 1.0  
**Status:** Architecture-approved  
**Updated:** 2026-08-22

This document defines the end-to-end data flow for CARBONX — from external observation to user-facing assessment. Every transformation step is named, located, and typed.

---

## 1. Pipeline Overview

```
╔══════════════════════════════════════════════════════════════════╗
║                     EXTERNAL DATA SOURCES                        ║
║  NASA FIRMS API          Carbon Registries     Organization Input ║
║  (VIIRS / MODIS)         (Verra, GFW, etc.)    (UI / CSV Import)  ║
╚══════════╤═══════════════════════════╤═══════════════╤═══════════╝
           │                           │               │
           ▼                           ▼               ▼
╔══════════════════════════════════════════════════════════════════╗
║                    INGESTION & NORMALIZATION                      ║
║  FIRMSIngestionService          BoundaryImportService            ║
║  EventNormalizer                CreditLotImportService           ║
╚══════════╤═══════════════════════════════════════════════════════╝
           │
           ▼
╔══════════════════════════════════════════════════════════════════╗
║                    POSTGRESQL — OPERATIONAL DATABASE             ║
║  EnvironmentalEvent  │  CarbonProject  │  ProjectBoundary        ║
║  CreditHolding       │  Portfolio      │  MonitoringCheckpoint   ║
╚══════════╤═══════════════════════════════════════════════════════╝
           │
           ▼
╔══════════════════════════════════════════════════════════════════╗
║                    GEOSPATIAL ANALYSIS                           ║
║  GeospatialService (Turf.js — server-side only)                  ║
║  Point-in-polygon  │  Buffer  │  Intersect  │  Area calculation  ║
╚══════════╤═══════════════════════════════════════════════════════╝
           │
           ▼
╔══════════════════════════════════════════════════════════════════╗
║                    RISK ENGINE                                    ║
║  RiskEngine (deterministic, versioned)                           ║
║  Physical Impact  │  Credit Exposure  │  Financial Exposure      ║
║  Integrity Risk   │  Evidence Confidence  │  Audit Priority      ║
╚══════════╤═══════════════════════════════════════════════════════╝
           │
           ├──────────────────────────────────────────────┐
           ▼                                              ▼
╔═══════════════════════════════╗            ╔══════════════════════╗
║  AI SERVICE (async)           ║            ║  BLOCKCHAIN (async)  ║
║  Gemini 1.5 Flash             ║            ║  Sepolia Testnet     ║
║  Structured input → narrative ║            ║  keccak256 hash      ║
║  AIReport stored in PostgreSQL║            ║  EvidenceAnchored    ║
╚═══════════════════════════════╝            ╚══════════════════════╝
           │                                              │
           └──────────────────────────────────────────────┘
           │
           ▼
╔══════════════════════════════════════════════════════════════════╗
║                    NEXT.JS API LAYER                             ║
║  Route handlers — auth, Zod validation, service delegation       ║
╚══════════╤═══════════════════════════════════════════════════════╝
           │
           ▼
╔══════════════════════════════════════════════════════════════════╗
║                    BROWSER CLIENT                                ║
║  2D Dashboard + Incident Workflow    │  Optional 3D Scene (R3F)  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Phase 1 — Environmental Event Ingestion

### 2.1 FIRMSIngestionService

**File:** `lib/services/firms-ingestion.ts`  
**Triggered by:** Scheduled job (every 6h default) or manual replay trigger  
**Origin class:** `EXTERNAL` (live) | `REPLAY` (historical)

```
SCHEDULED TRIGGER (cron / pg-boss)
  │
  ├─► READ MonitoringCheckpoint.lastSuccessAt
  │         (prevents re-fetching already-processed windows)
  │
  ├─► BUILD request: bbox from all active ProjectBoundary centroids + buffer
  │         bbox = [minLng, minLat, maxLng, maxLat]
  │         lookback = hours since last checkpoint (max 240h)
  │
  ├─► GET https://firms.modaps.eosdis.nasa.gov/api/area/json/{MAP_KEY}/VIIRS_SNPP_NRT/{bbox}/{days}
  │         ┌─ on HTTP 200: parse JSON array of hotspot records
  │         └─ on failure:  log error, increment failure counter, do NOT advance checkpoint
  │
  ├─► FOR EACH hotspot record:
  │     │
  │     ├─► NORMALIZE (EventNormalizer)
  │     │     latitude       → geometry.coordinates[1]
  │     │     longitude      → geometry.coordinates[0]
  │     │     acq_date + acq_time → observedAt (UTC DateTime)
  │     │     confidence     → sourceConfidence (VIIRS: n=0.3, l=0.6, h=0.9; MODIS: /100)
  │     │     frp             → sourceMetadata.frp
  │     │     satellite       → sourceMetadata.satellite
  │     │     instrument      → sourceMetadata.instrument
  │     │     version         → dataVersion
  │     │     full record     → rawPayload (preserved for audit)
  │     │     fingerprint     → SHA256(lat + lon + acq_date + acq_time + instrument)
  │     │
  │     ├─► DEDUPLICATE
  │     │     CHECK: EnvironmentalEvent WHERE fingerprint = computed_fingerprint
  │     │     IF exists → skip (log as duplicate)
  │     │     IF not exists → proceed
  │     │
  │     └─► PERSIST
  │           prisma.environmentalEvent.create({
  │             type: WILDFIRE,
  │             sourceName: "NASA FIRMS VIIRS NRT",
  │             geometry: { type: "Point", coordinates: [lng, lat] },
  │             geomType: "Point",
  │             sourceConfidence,
  │             sourceMetadata: { frp, satellite, instrument, version },
  │             observedAt,
  │             acquiredAt: now(),
  │             originType: OBSERVED,
  │             rawPayload,
  │             ingestorVersion: INGESTOR_VERSION,
  │             fingerprint,
  │             createdByType: EXTERNAL_SOURCE
  │           })
  │
  └─► ADVANCE MonitoringCheckpoint.lastSuccessAt = now()
        UPDATE failure counter to 0
```

### 2.2 MonitoringCheckpoint table

```prisma
model MonitoringCheckpoint {
  id              String   @id @default(cuid())
  sourceName      String   @unique  // e.g., "NASA_FIRMS_VIIRS_NRT"
  lastSuccessAt   DateTime
  lastAttemptAt   DateTime
  consecutiveFails Int     @default(0)
  lastErrorMessage String?
  updatedAt       DateTime @updatedAt
}
```

---

## 3. Phase 2 — Project Boundary Import

**File:** `lib/services/boundary-import.ts`  
**Triggered by:** `POST /api/projects/[id]/boundary`

```
USER UPLOADS GeoJSON (via multipart form or JSON body)
  │
  ├─► VALIDATE
  │     turf.area(geojson)  — fails if self-intersecting or invalid
  │     Zod schema validation of GeoJSON structure
  │
  ├─► COMPUTE
  │     areaHa = turf.area(geojson) / 10000
  │     centroid = turf.centroid(geojson)  → stored on CarbonProject
  │
  ├─► VERSION
  │     SELECT MAX(version) WHERE projectId = id
  │     newVersion = maxVersion + 1 (or 1 if first import)
  │     SET isCurrent = false on all previous ProjectBoundary records for this project
  │
  └─► PERSIST
        prisma.projectBoundary.create({
          projectId,
          version: newVersion,
          geojson,
          areaHa,
          source: userProvided.source or "user-import",
          sourceUrl: userProvided.sourceUrl or null,
          boundaryConfidence: userProvided.quality or UNKNOWN,
          acquiredAt: now(),
          isCurrent: true,
          createdByType: HUMAN_ACTION
        })
```

---

## 4. Phase 3 — Geospatial Analysis

**File:** `lib/services/geospatial.ts`  
**Triggered by:** After each new `EnvironmentalEvent` is persisted  
**All calculations server-side; Turf.js never imported in client bundle**

```
NEW EnvironmentalEvent persisted
  │
  ├─► LOAD active ProjectBoundary records for organization
  │     SELECT * FROM ProjectBoundary WHERE isCurrent = true
  │       AND project.portfolio.organizationId = session.organizationId
  │
  ├─► FOR EACH active boundary:
  │     │
  │     ├─► STEP 1: Rough bbox pre-filter (buffer-aware)
  │     │     bufferKm = FIRMS_POINT_BUFFER_KM (env var, default: 1.0)
  │     │     paddedBbox = boundary.bbox padded by bufferKm in all directions
  │     │     turf.booleanPointInPolygon(eventPoint, paddedBbox)
  │     │     IF false → skip (fast path; safe, cannot produce false negatives)
  │     │
  │     ├─► STEP 2: Buffer event point
  │     │     bufferKm = FIRMS_POINT_BUFFER_KM (env var, default: 1.0)
  │     │     eventBuffer = turf.buffer(eventPoint, bufferKm, { units: "kilometers" })
  │     │     LABEL: ESTIMATED (documented assumption: 1km proxy for unresolved point)
  │     │
  │     ├─► STEP 3: Polygon intersection
  │     │     intersection = turf.intersect(eventBuffer, boundaryPolygon)
  │     │     IF intersection == null → no overlap → skip project
  │     │
  │     ├─► STEP 4: Area calculation
  │     │     impactHa = turf.area(intersection) / 10000
  │     │     projectHa = boundary.areaHa (pre-computed at import)
  │     │     impactPct = (impactHa / projectHa) × 100
  │     │
  │     └─► RESULT: { intersects: true, impactHa, impactPct, intersection, eventBuffer }
  │
  └─► FOR EACH intersecting project:
        └─► Phase 4: Incident + Assessment pipeline
```

### 4.1 What Turf.js is actually calculating

| Operation | Turf.js function | What it determines |
|---|---|---|
| Point inside project bbox | `turf.booleanPointInPolygon()` | Fast pre-filter |
| Event impact zone | `turf.buffer(point, radiusKm)` | Estimated affected area proxy (ESTIMATED) |
| Overlap with boundary | `turf.intersect(poly1, poly2)` | Whether event zone overlaps project |
| Overlapping area | `turf.area(intersectionPolygon)` | Estimated hectares of overlap |
| Percentage affected | Division | `(overlapHa / projectHa) × 100` |

> **None of these operations claim to measure actual fire damage.** They estimate the geographic relationship between a thermal detection and a project boundary using documented assumptions.

---

## 5. Phase 4 — Risk Assessment

> **Ordering note:** By this point, the `Incident` record already exists at status `EVENT_DETECTED` (created in Phase 5, triggered by a successful geospatial intersection in Phase 3). This phase creates the `RiskAssessment` and passes its `incidentId` reference. Once this `RiskAssessment` is persisted, Phase 5 transitions the incident from `EVENT_DETECTED` to `UNDER_ASSESSMENT`.

**File:** `lib/services/risk-engine.ts`  
**Triggered by:** After geospatial analysis returns intersection  
**Origin class:** `CALC`

```
GeospatialResult + CreditHolding + EventMetadata
  │
  ├─► CREDIT EXPOSURE
  │     creditExposure = heldQuantity × (impactPct / 100)
  │
  ├─► FINANCIAL EXPOSURE
  │     financialExposure = creditExposure × refValuePerUnit
  │     LABEL: ESTIMATED (reference price, not market price)
  │
  ├─► INTEGRITY RISK (enum)
  │     impactPct >= 50% → CRITICAL
  │     impactPct >= 20% → HIGH
  │     impactPct >= 5%  → MEDIUM
  │     impactPct < 5%   → LOW
  │
  ├─► EVIDENCE CONFIDENCE (score 0–100 → enum)
  │     baseScore        = sourceConfidence × 40     (0–40 pts, from FIRMS)
  │     freshnessScore   = dateFreshnessHours ≤ 24h → 20pts
  │                                               ≤ 72h → 10pts
  │                                               >72h  → 0pts
  │     boundaryScore    = HIGH→20, MEDIUM→10, LOW→5, UNKNOWN→0
  │     corroboration    = hasCorroboration → +10pts
  │     labelPenalty     = OBSERVED→0, ESTIMATED→-10, MODELED→-20, INFERRED→-30
  │     final = max(0, min(100, sum))
  │     LOW: 0–40 | MEDIUM: 41–70 | HIGH: 71–100
  │
  ├─► AUDIT PRIORITY (enum)
  │     [CRITICAL|HIGH] + [MEDIUM|HIGH] confidence → URGENT
  │     [HIGH|MEDIUM] OR LOW confidence            → ELEVATED
  │     else                                       → ROUTINE
  │
  └─► PERSIST RiskAssessment
        {
          incidentId,
          boundaryId,
          engineVersion: GEOSPATIAL_ENGINE_VERSION,  // from lib/constants
          methodologyVersion: RISK_ENGINE_VERSION,
          inputEvidenceIds: [evidenceRecord.id],
          estimatedImpactHa, impactPct, projectHa,
          creditExposure, financialExposureEst,
          financialCurrency, valuationBasis,
          integrityRisk, evidenceConfidence, auditPriority,
          uncertaintyNotes: buildUncertaintyNotes(inputs),
          assumptions: { bufferKm, sourceConfidence, dateFreshnessHours, ... },
          createdByType: SYSTEM_CALCULATION
        }
```

---

## 6. Phase 5 — Incident Lifecycle

**File:** `lib/services/audit.ts`  
**Origin class:** `CALC` (system transitions) | `ORG_DATA` (human transitions)

```
For each project intersected:

  CREATE Incident {
    projectId, eventId, status: EVENT_DETECTED,
    createdByType: SYSTEM_CALCULATION
  }

  CREATE IncidentStatusHistory {
    fromStatus: null, toStatus: EVENT_DETECTED,
    actor: "system", createdByType: SYSTEM_CALCULATION
  }

  ── RiskAssessment created (Phase 4) ──►

  TRANSITION Incident.status → UNDER_ASSESSMENT
  CREATE IncidentStatusHistory { fromStatus: EVENT_DETECTED, toStatus: UNDER_ASSESSMENT }

  ── AI Report generated (Phase 6, async) ──►
  ── Blockchain anchored (Phase 7, async) ──►

  USER ACTION: Flag for Audit
  ──►  TRANSITION Incident.status → AUDIT_RECOMMENDED
       CREATE IncidentStatusHistory { actor: userId, createdByType: HUMAN_ACTION }
       TRIGGER: BlockchainService.anchor(assessment, "AUDIT_RECOMMENDED")

  USER ACTION: Begin Audit
  ──►  TRANSITION Incident.status → AUDIT_IN_PROGRESS
       CREATE AuditCase { incidentId, priority: assessment.auditPriority }

  USER ACTION: Resolve
  ──►  TRANSITION Incident.status → RESOLVED
       UPDATE AuditCase { resolution, resolvedAt }
       TRIGGER: BlockchainService.anchor(assessment, "RESOLVED")
```

---

## 7. Phase 6 — AI Interpretation (Async)

**File:** `lib/services/ai-service.ts`  
**Triggered:** `Promise.allSettled()` after RiskAssessment persistence (non-blocking)  
**External dependency:** Gemini 1.5 Flash API

```
RiskAssessment (from DB, via assessmentId)
  │
  ├─► BUILD AIReportInput (Zod-validated, schema version: ai-input-v1.0)
  │     {
  │       schemaVersion: "ai-input-v1.0",
  │       incident: { id, projectName, eventType },
  │       assessment: {
  │         engineVersion, methodologyVersion,
  │         estimatedImpactHa, impactPct, projectHa,
  │         creditExposure, financialExposure, financialCurrency,
  │         integrityRisk, evidenceConfidence, auditPriority,
  │         uncertaintyNotes, evidenceLabel, sourceName, observedAt
  │       }
  │     }
  │
  ├─► SYSTEM PROMPT (invariant)
  │     "You are a carbon-credit risk analyst assistant. Interpret the structured
  │      assessment provided. Do not invent evidence, calculate values, or make
  │      legal decisions. Clearly distinguish observed facts from estimates.
  │      Use conditional language for uncertain findings.
  │      Output strict JSON matching the provided schema."
  │
  ├─► CALL Gemini API (server-side, API key from env GEMINI_API_KEY)
  │     model: gemini-1.5-flash
  │     generationConfig: { responseMimeType: "application/json" }
  │
  ├─► VALIDATE response with Zod (schema: ai-output-v1.0)
  │     { facts, estimatedImpacts, uncertainties, portfolioConsequences, recommendations }
  │
  ├─► NUMERIC CONSISTENCY CHECK
  │     Any number mentioned in AI output must not contradict assessment numbers ±0.01
  │     IF check fails → discard response, set AIReport = null, flag for review
  │
  ├─► PERSIST AIReport
  │     {
  │       assessmentId, modelId: "gemini-1.5-flash",
  │       promptVersion, inputSchemaVersion, outputSchemaVersion,
  │       facts, estimatedImpacts, uncertainties,
  │       portfolioConsequences, recommendations,
  │       rawResponse, generatedAt: now(),
  │       createdByType: AI_GENERATION
  │     }
  │
  └─► ON FAILURE (timeout / schema fail / API error)
        Set AIReport = null on assessment
        Log error with assessmentId
        Workflow continues unaffected
        UI renders: "AI Interpretation Unavailable"
```

---

## 8. Phase 7 — Blockchain Anchoring (Async)

**File:** `lib/services/blockchain.ts`  
**Triggered:** `Promise.allSettled()` after RiskAssessment persistence (non-blocking)  
**Also triggered:** On human-initiated status transitions (AUDIT_RECOMMENDED, RESOLVED)

```
RiskAssessment + eventType
  │
  ├─► BUILD canonical evidence package
  │     {
  │       schemaVersion: "anchor-v1.0",
  │       incidentId, assessmentId,
  │       engineVersion, methodologyVersion,
  │       integrityRisk, evidenceConfidence,
  │       inputEvidenceIds: [...sorted],
  │       boundaryId, timestamp: createdAt.toISOString(),
  │       eventType
  │     }
  │
  ├─► SERIALIZE deterministically
  │     sortedKeys = Object.keys(record).sort()
  │     canonicalJson = JSON.stringify(record, sortedKeys)
  │     ── sortedKeys ensures key order is fixed regardless of object construction order ──
  │
  ├─► HASH
  │     hash = keccak256(toBytes(canonicalJson))  // via viem
  │
  ├─► CREATE BlockchainAnchor record (PENDING)
  │     { assessmentId, canonicalJson, hash, network: "sepolia",
  │       contractAddress: BLOCKCHAIN_CONTRACT_ADDRESS,
  │       status: PENDING, eventType, createdAt: now() }
  │
  ├─► SUBMIT transaction to Sepolia
  │     walletClient.writeContract({
  │       address: BLOCKCHAIN_CONTRACT_ADDRESS,
  │       abi: CarbonXAnchorABI,
  │       functionName: "anchor",
  │       args: [bytes32(incidentId), hash, eventType]
  │     })
  │
  ├─► ON SUCCESS
  │     UPDATE BlockchainAnchor {
  │       txHash: receipt.transactionHash,
  │       status: SUBMITTED,
  │       blockNumber: receipt.blockNumber
  │     }
  │     WATCH for confirmation (1 block minimum)
  │     ON CONFIRMED → status: CONFIRMED, confirmedAt: now()
  │
  └─► ON FAILURE
        UPDATE BlockchainAnchor { status: FAILED, failureReason: error.message }
        SCHEDULE retry: retryCount + 1, exponential backoff
        MAX 3 retries → status: FAILED (manual retry available via API)
        Incident workflow continues — anchor failure is non-blocking
```

---

## 9. Phase 8 — Historical Event Replay Pipeline

**File:** `lib/services/firms-ingestion.ts` (replay mode)  
**Triggered by:** `POST /api/events/replay` (authenticated, organization-scoped)

```
USER selects historical scenario from UI
  │
  ├─► LOOKUP stored seed EnvironmentalEvent (originType: OBSERVED, pre-seeded)
  │     SELECT * FROM EnvironmentalEvent WHERE id = scenarioEventId
  │
  ├─► CREATE replay copy
  │     { ...event, originType: REPLAYED, acquiredAt: now(), id: newCuid() }
  │     (The original seed event is NOT modified)
  │
  └─► PASS through normal pipeline from Phase 3 onwards
        GeospatialService → RiskEngine → Incident → AI → Blockchain
        All records created are real; marked with originType: REPLAYED
        Frontend receives results from real backend API (no fake state)
```

> The replay UI discloses `originType: REPLAYED` in the evidence timeline entry. Judges can see this is a replayed historical event, not a live detection.

---

## 10. Phase 9 — Frontend Data Delivery

```
Browser (React + TanStack Query)
  │
  ├─► GET /api/portfolio
  │     └── Returns: portfolios + projects + activeIncidentCount + maxRiskLevel
  │
  ├─► GET /api/incidents/[id]
  │     └── Returns: incident + latestAssessment + aiReport + blockchainAnchor + statusHistory
  │
  ├─► GET /api/projects/[id]
  │     └── Returns: project + currentBoundary + creditLots + incidentHistory
  │
  ├─► GET /api/projects/visual-states  (3D scene only)
  │     └── Returns: ProjectVisualState[] for all org projects
  │
  └─► POST /api/audits/[incidentId]/actions
        └── Human audit action → AuditService.transition() → IncidentStatusHistory
```

Every response is typed via Zod schemas from `lib/validations/`. No raw Prisma objects are returned.

---

## 11. Continuous Monitoring Architecture

```
CRON SCHEDULE (configurable, default: every 6 hours)
  │
  ├─► READ MonitoringCheckpoint (lastSuccessAt, consecutiveFails)
  │
  ├─► IF consecutiveFails >= 3 → ALERT (log, optional webhook)
  │
  ├─► COMPUTE observation window
  │     windowStart = lastSuccessAt
  │     windowEnd = now()
  │     Convert to FIRMS API lookback in days (max 10 for NRT)
  │
  ├─► CALL FIRMSIngestionService.ingest(window, sources, bbox)
  │     (Phase 2 above)
  │
  ├─► ON SUCCESS
  │     UPDATE MonitoringCheckpoint.lastSuccessAt = now()
  │     UPDATE MonitoringCheckpoint.consecutiveFails = 0
  │
  └─► ON FAILURE
        DO NOT update lastSuccessAt (preserves re-fetch on next run)
        INCREMENT consecutiveFails
        LOG error with timestamp and reason
```

### Cadence environment variable

```bash
MONITORING_INTERVAL_HOURS=6   # How often to poll FIRMS; minimum 1 (NRT latency ~3h)
```

---

## 12. Data Lineage Summary

For any displayed CARBONX value, the following chain is traceable:

```
Display value
  └── API response field
        └── Prisma query result
              └── Database record
                    ├── createdByType  (EXTERNAL_SOURCE | SYSTEM_CALCULATION | AI_GENERATION | HUMAN_ACTION | REPLAY)
                    ├── engineVersion / methodologyVersion (if CALC)
                    ├── sourceName / sourceId / rawPayload (if EXTERNAL)
                    ├── assessmentId (if AI_GENERATION)
                    └── userId / auditCaseId (if HUMAN_ACTION)
```

A judge or auditor can follow this chain backward from any displayed number to its origin, methodology, and input data.

---

*All pipeline stages are defined as independently testable service functions. See `docs/data-sources.md` for the authoritative data source matrix and `docs/environment.md` for required environment variables.*
