# Epic 02: Ingestion Pipeline

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 01

## Goal
Reliably ingest real NASA FIRMS satellite data and project boundaries into the database, normalizing observations and ensuring no duplicate events are created.

## Definition of Done
- A background service can fetch NASA FIRMS data using the `NASA_FIRMS_MAP_KEY`.
- Point detections are normalized into `EnvironmentalEvent` records with `createdByType: EXTERNAL_SOURCE`.
- Duplicate detections are rejected via fingerprinting.
- A "Controlled Replay" API endpoint can process a historical seed event through the pipeline.
- Project boundaries can be imported via GeoJSON.

---

## Story 02.1: NASA FIRMS API Integration and Normalization

**Owner:** Developer A
**Depends on:** 01.3

**As a** system
**I want** to fetch and normalize thermal anomalies from the NASA FIRMS API
**So that** CARBONX is driven by real-world environmental observations rather than simulated events.

### Acceptance Criteria
- [ ] `FIRMSIngestionService` fetches JSON data from the FIRMS Area API using `NASA_FIRMS_MAP_KEY`.
- [ ] The bounding box used for the fetch is derived from active project centroids.
- [ ] Hotspots are normalized into `EnvironmentalEvent` objects with `originType: OBSERVED`.
- [ ] If the FIRMS API fails, the service logs the error and exits cleanly without crashing the application.

### Technical notes
- PRD 5.1, Architecture Spine AD-19

---

## Story 02.2: Event Deduplication and Continuous Monitoring Checkpoint

**Owner:** Developer A
**Depends on:** 02.1

**As a** system
**I want** to track ingestion cursors and deduplicate incoming events
**So that** the same fire observation does not create multiple incident records.

### Acceptance Criteria
- [ ] The ingestion job uses a `MonitoringCheckpoint` table to track the last successful fetch time.
- [ ] The checkpoint is only advanced if the ingestion run succeeds.
- [ ] Incoming events generate a SHA256 fingerprint (lat, lon, acq_date, acq_time, instrument).
- [ ] Events with existing fingerprints in the database are skipped.

### Technical notes
- Architecture Spine AD-25, PRD 3.1

---

## Story 02.3: Controlled Historical Replay

**Owner:** Developer A
**Depends on:** 02.1

**As a** Administrator
**I want** to trigger a replay of a known historical environmental event
**So that** I can demonstrate the platform's capabilities using real data without waiting for a live wildfire to occur.

### Acceptance Criteria
- [ ] A `POST /api/events/replay` endpoint takes a seed event ID.
- [ ] It creates a new `EnvironmentalEvent` copy labeled with `originType: REPLAYED` and `createdByType: REPLAY`.
- [ ] The duplicated event is immediately passed to the geospatial pipeline for processing.

### Technical notes
- PRD 5.1, Architecture Spine AD-24

---

## Story 02.4: GeoJSON Project Boundary Import

**Owner:** Developer A
**Depends on:** 01.2

**As a** Administrator
**I want** to import project geofences via GeoJSON
**So that** the system can accurately assess intersection with environmental events.

### Acceptance Criteria
- [ ] A `POST /api/projects/[id]/boundary` endpoint accepts valid GeoJSON.
- [ ] The GeoJSON is validated using Turf.js `area()` (rejecting invalid geometry).
- [ ] The import creates a new `ProjectBoundary` record, deactivating previous versions.
- [ ] The record successfully persists `source`, `sourceUrl`, and `quality` fields.

### Technical notes
- PRD 3.1, Architecture Spine AD-20
