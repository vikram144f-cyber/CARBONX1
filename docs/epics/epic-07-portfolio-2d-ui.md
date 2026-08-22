# Epic 07: Portfolio 2D UI

**Priority tier:** P0
**Owner:** Developer B
**Depends on:** Epic 01 (for API contracts)

## Goal
Deliver the premium, functional 2D web interface allowing organizations to view their carbon portfolios, project details, and investigate active incidents.

## Definition of Done
- A styled layout exists using the specified deep environmental/dark visual identity.
- Portfolio dashboard displays active alerts and risk summaries.
- Incident view displays the risk assessment, timeline, AI report, and blockchain anchor status.
- The interface does not confuse physical impact with financial exposure.

---

## Story 07.1: UI Shell and Visual Identity

**Owner:** Developer B
**Depends on:** none

**As a** ESG Officer
**I want** a coherent, premium application interface
**So that** the tool feels like a credible environmental intelligence system.

### Acceptance Criteria
- [x] Implement a Next.js App Router layout with navigation.
- [x] Apply a dark/environmental base visual identity using Tailwind CSS (no generic SaaS look, no crypto aesthetics).
- [x] Define semantic color utility classes: Green (healthy), Amber (caution), Red (critical anomaly), and Blue/Neutral (information).
- [x] Component styles are consistent and avoid "meaningless cards" and excessive glassmorphism.

### Technical notes
- PRD 7.0, Architecture Spine AD-2

---

## Story 07.2: Portfolio Dashboard

**Owner:** Developer B
**Depends on:** 07.1

**As a** ESG Officer
**I want** a portfolio overview
**So that** I can see if any of my projects have active environmental alerts.

### Acceptance Criteria
- [x] The dashboard consumes `GET /api/portfolio` (can be mocked initially using Zod schema).
- [x] Displays a summary of total credit holdings and active incidents.
- [x] Lists projects, visually distinguishing those with healthy status from those with anomalies (Amber/Red).
- [x] Provides clear navigation to project details and active incidents.

### Technical notes
- PRD 5.5

---

## Story 07.3: Incident Investigation View

**Owner:** Developer B
**Depends on:** 07.1

**As a** Internal Auditor
**I want** to see all evidence and assessments for a specific incident
**So that** I can understand the risk before making an audit decision.

### Acceptance Criteria
- [x] The incident page consumes `GET /api/incidents/[id]`.
- [ ] Visually separates `Physical Impact`, `Credit Exposure`, `Financial Exposure`, `Integrity Risk`, and `Evidence Confidence`.
- [ ] Clearly labels buffered estimates as `ESTIMATED`.
- [ ] Renders the AI Report narrative, handling the `null` (Interpretation Unavailable) fallback gracefully.
- [ ] Displays the evidence timeline and blockchain anchor `txHash` (or PENDING/FAILED status).

### Technical notes
- PRD 5.5, PRD 10.0, Architecture Spine AD-22
