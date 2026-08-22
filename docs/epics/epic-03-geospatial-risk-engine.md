# Epic 03: Geospatial Risk Engine

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 02

## Goal
Deterministically calculate spatial intersections between environmental events and project boundaries to produce physical impact, credit exposure, and integrity risk scores.

## Definition of Done
- Turf.js calculates intersection areas on the server side.
- The system correctly buffers FIRMS points before intersection.
- Risk scoring rules map the physical impact to financial exposure and qualitative risk levels.
- The resulting `RiskAssessment` records are saved with full methodology versioning.

---

## Story 03.1: Point Buffering and Polygon Intersection

**Owner:** Developer A
**Depends on:** 02.4

**As a** system
**I want** to intersect environmental events with project boundaries
**So that** I can identify which projects are potentially affected.

### Acceptance Criteria
- [ ] A new `EnvironmentalEvent` triggers a geospatial intersection check against all active `ProjectBoundary` geometries.
- [ ] The boundary-intersection candidate check must account for the FIRMS point-detection buffer radius (`FIRMS_POINT_BUFFER_KM`) before filtering candidates — either by padding the bounding-box pre-filter by the buffer radius, or by treating the pre-filter as a pure optimization that cannot produce false negatives.
- [ ] The FIRMS point is buffered using Turf.js `buffer()` to create an estimated impact polygon.
- [ ] Turf.js `intersect()` calculates the overlap between the event buffer and the project boundary.
- [ ] The resulting intersection area is computed in hectares using Turf.js `area()`.

### Technical notes
- PRD 5.2, Architecture Spine AD-19
- **CRITICAL**: Do NOT filter candidate projects using a simple point-in-polygon check against the unbuffered FIRMS point, as that will miss boundary edges falling within the buffer radius.

---

## Story 03.2: Exposure and Risk Scoring

**Owner:** Developer A
**Depends on:** 03.1

**As a** system
**I want** to calculate exposure and integrity risk from the intersection data
**So that** organizations understand the severity of the incident.

### Acceptance Criteria
- [ ] Calculate `impactPct` (impact hectares / project hectares).
- [ ] Query the `CreditHolding` table to calculate `creditExposure` (heldQuantity * impactPct).
- [ ] Calculate `financialExposureEst` (creditExposure * refValuePerUnit).
- [ ] Assign an `integrityRisk` enum based on `impactPct` thresholds (e.g., <5% LOW, >=5% MEDIUM, >=20% HIGH, >=50% CRITICAL).
- [ ] Values derived from buffered points are explicitly tagged/labeled as `ESTIMATED` in the data model.

### Technical notes
- PRD 2.1, 5.2, Architecture Spine AD-21

---

## Story 03.3: Evidence Confidence Scoring

**Owner:** Developer A
**Depends on:** 03.2

**As a** system
**I want** to calculate an Evidence Confidence score
**So that** organizations know how reliable the warning is.

### Acceptance Criteria
- [ ] Calculate a composite `evidenceConfidence` score factoring in the FIRMS `sourceConfidence`, event freshness (time since observation), and boundary quality.
- [ ] Map the numeric score to a qualitative Enum (LOW, MEDIUM, HIGH).
- [ ] Assign an `auditPriority` enum (ROUTINE, ELEVATED, URGENT) based on the matrix of `integrityRisk` and `evidenceConfidence`.
- [ ] Save all calculated fields into a `RiskAssessment` record linked to the event and boundary.
- [ ] The `RiskAssessment` record must include `engineVersion` and `methodologyVersion` and `createdByType: SYSTEM_CALCULATION`.

### Technical notes
- PRD 2.2, Architecture Spine AD-22
