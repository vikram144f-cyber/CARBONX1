# Epic 08: Audit Workflow

**Priority tier:** P0
**Owner:** Developer B
**Depends on:** Epic 07, Epic 04

## Goal
Enable humans to make and record critical audit decisions regarding an incident, proving that CARBONX is a decision-support tool rather than an automatic credit-invalidation system.

## Definition of Done
- A user can click "Flag for Audit" on an incident.
- The UI triggers an API call that updates the incident status and creates a timeline entry.
- The state transition triggers a new blockchain anchor.

---

## Story 08.1: Human Audit Actions

**Owner:** Developer B
**Depends on:** 07.3

**As a** Internal Auditor
**I want** to flag a concerning incident for formal review
**So that** my organization can take action on the exposed credits.

### Acceptance Criteria
- [x] The Incident Investigation View includes a clear "Flag for Audit" action button.
- [x] Clicking the button calls a `POST` API route to update the incident.
- [x] The button shows a purposeful loading micro-interaction while processing.
- [ ] On success, the UI reflects the new `AUDIT_RECOMMENDED` status.
- [ ] A new entry appears in the incident timeline indicating the human action.
- [x] The backend triggers a blockchain anchor for the `"AUDIT_RECOMMENDED"` event type.

### Technical notes
- PRD 5.5, Architecture Spine AD-22
