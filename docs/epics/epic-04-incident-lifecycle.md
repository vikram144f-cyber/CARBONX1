# Epic 04: Incident Lifecycle

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** Epic 03

## Goal
Manage the creation, state transitions, and persistent timeline of an active environmental incident resulting from a risk assessment.

## Definition of Done
- Geospatial overlaps automatically create an `Incident`.
- Incident status transitions are recorded immutably in an `IncidentStatusHistory` timeline.
- API endpoints expose the full incident timeline and current status.

---

## Story 04.1: Automated Incident Creation

**Owner:** Developer A
**Depends on:** 03.3

**As a** system
**I want** to create an incident when an intersection is detected
**So that** the event can be tracked through a resolution workflow.

### Acceptance Criteria
- [x] When a geospatial intersection is first detected (before risk scoring), create the `Incident` at status `EVENT_DETECTED`.
- [x] Create an `IncidentStatusHistory` entry transitioning from `null` to `EVENT_DETECTED` with `createdByType: SYSTEM_CALCULATION`.
- [x] Once the `RiskAssessment` is created, transition the incident from `EVENT_DETECTED` to `UNDER_ASSESSMENT` via `AuditService.transition()`, creating a second `IncidentStatusHistory` entry.
- [ ] The blockchain anchor for `EVENT_DETECTED→UNDER_ASSESSMENT` (per AD-9) is triggered at this point.

### Technical notes
- PRD 2.3, 4.0, Architecture Spine AD-22

---

## Story 04.2: Timeline Persistence and API

**Owner:** Developer A
**Depends on:** 04.1

**As a** frontend client
**I want** an API to retrieve an incident and its full history
**So that** I can render the evidence timeline for the user.

### Acceptance Criteria
- [x] A `GET /api/incidents/[id]` route is implemented.
- [x] The response includes the `Incident`, the latest `RiskAssessment`, linked `EnvironmentalEvent` details, and the ordered `IncidentStatusHistory` array.
- [x] The API response is validated and typed using Zod.
- [x] Raw Prisma models are mapped to response DTOs, not leaked directly.

### Technical notes
- PRD 5.5, Architecture Spine AD-1
