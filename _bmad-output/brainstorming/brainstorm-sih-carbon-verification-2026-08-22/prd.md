# CARBONX: Product Requirements Document (PRD)

## 1. Product Overview & Positioning

**What exactly are we building?**
CARBONX is a full-stack carbon credit incident intelligence and audit-readiness platform. It is NOT a platform that automatically invalidates carbon credits, a 3D game, or a crypto marketplace. It is a decision-support and evidence-preparation tool that provides continuous asset monitoring, deterministic exposure analysis, risk intelligence, and a tamper-evident evidence history.

**Who uses it?**
Corporate ESG Teams, Sustainability Managers, and Internal Auditors who manage or assess carbon credit portfolios.

**What exact problem does it solve?**
Organizations hold carbon credits backed by physical environmental projects. If a physical event (like a wildfire) occurs, holders cannot immediately determine which projects are affected, the extent of the physical impact, their potential credit and financial exposure, or the reliability of the evidence. CARBONX bridges this gap by moving organizations efficiently from detection to documented resolution.

---

## 2. Core Concepts & Models

### 2.1. Risk, Exposure, and Evidence Model
The system strictly distinguishes between severity (Risk) and certainty (Confidence). High risk does not mean high confidence, and a severe event may have low portfolio exposure.
*   **Physical Impact:** Estimated area or severity of environmental impact inside or near a project boundary.
*   **Credit Exposure:** The quantity or proportion of carbon credits associated with the affected project or relevant credit lot.
*   **Financial Exposure:** Estimated monetary value associated with potentially affected credits.
*   **Integrity Risk:** The estimated likelihood or severity that the incident could materially undermine the environmental claim represented by the held credits.
*   **Evidence Confidence:** How strongly the available evidence supports the assessment.
*   **Audit Priority:** How urgently the incident should be reviewed by a human.

### 2.2. Evidence Confidence, Uncertainty, and Provenance
Every major assessment must contain provenance and uncertainty information. The interface must communicate: *Risk = how concerning the incident may be; Confidence = how strongly the evidence supports that conclusion.*
Required fields for assessments include:
*   Evidence source & Data acquisition timestamp
*   Spatial resolution (where applicable) & Boundary quality
*   Calculation/engine version & Methodology version
*   Key uncertainty explanation (e.g., cloud cover, incomplete boundaries, lack of ground confirmation).
*Estimates must never be presented as final scientific or legal conclusions.*

### 2.3. Incident Status Model
CARBONX never automatically transitions to "credit invalidated".
*   **Monitoring:** No material incident currently identified.
*   **Event Detected:** An environmental anomaly has been identified but not yet fully assessed.
*   **Under Assessment:** Evidence, geospatial relationships, and potential exposure are being analyzed (System/Backend triggered).
*   **Audit Recommended:** Available evidence and risk assessment indicate human review should be prioritized (System or Human triggered).
*   **Audit In Progress:** A formal human review process has begun (Human triggered).
*   **Resolved:** The incident has been closed with a documented human decision (Human triggered).
*   **Insufficient Evidence:** Available information cannot support a sufficiently reliable conclusion.

---

## 3. Scope and Priority Structure

### 3.1. P0 — Core Working MVP (Hackathon Scope)
A complete, end-to-end working full-stack product prioritizing:
*   Portfolio/project storage in a real relational database.
*   Real project geographic boundary data (GeoJSON).
*   One supported environmental incident type (Wildfire).
*   Real environmental event ingestion OR controlled replay through the genuine backend pipeline.
*   Real deterministic geospatial analysis (affected area, credit exposure, financial exposure).
*   Integrity/Risk and Evidence Confidence scoring.
*   Incident lifecycle management.
*   AI-generated explanation based exclusively on structured backend results.
*   Blockchain evidence anchoring for critical transitions.
*   Functional 2D investigation interface allowing human audit flagging.
*   Full persistence of state changes (Reproducibility & Versioning).

### 3.2. P1 — Stretch Goals
*   Optional immersive 3D investigation environment
.
*   More environmental event types (e.g., deforestation).
*   Advanced AI reporting features or chat-based Q&A against the evidence package.
*   More sophisticated blockchain integrations (e.g., smart contracts for automated registry updates).

### 3.3. P2 — Future / Post-Hackathon
*   Full enterprise multi-role permission systems.
*   Large-scale document management & collaboration.
*   Multi-registry API integrations.
*   Advanced portfolio analytics.

---

## 4. End-to-End Operational Workflow (P0)
1. **Alert generated** (New event ingested or replayed).
2. **Incident created** (Status: Event Detected).
3. **Evidence analyzed** (Backend intersection with geofences).
4. **Assessment generated** (Deterministic impact calculated; Status: Under Assessment).
5. **AI Interpretation** (AI generates structured explanation).
6. **Blockchain Anchor** (Evidence package hashed and anchored).
7. **User reviews assessment** (2D Interface: Map, Timeline, Summaries).
8. **User flags/recommends audit** (Status: Audit Recommended).
9. **Audit status recorded** (Human disposition entered; Status: Resolved).
*All evidence, methodology versions, and decisions remain persistently linked in the timeline.*

---

## 5. P0 Functional Requirements & Acceptance Criteria

### 5.1. Real Data Ingestion & Demo Replay
**What real data enters?** Real project geofences, real or historical satellite event data (e.g., NASA FIRMS coordinates).
*   **Requirement:** The system must process real environmental events through the backend. Demo scenarios must use a "Run Historical Scenario" control that feeds real historical data into the genuine backend pipeline.
*   **Acceptance Criteria (AC):** A historical wildfire event can be selected. The event routes through the real API/backend. No `setTimeout` fake logic or frontend-only state changes are used.

### 5.2. Deterministic Geospatial Analysis & Calculations
**What is deterministic?** Intersection math, impacted area, credit ratio exposure, and financial exposure.
*   **Requirement:** The backend uses tools like Turf.js to compute spatial intersections.
*   **AC:** The system identifies affected projects using real GeoJSON. It calculates the Estimated Physical Impact (sq km/hectares) deterministically and stores the result in the database. 

### 5.3. AI Risk Intelligence
**What does AI actually do?** It generates human-readable summaries, explains structured evidence, highlights uncertainties, and suggests next steps. It NEVER invents facts, calculates exposure, or makes legal decisions.
*   **Requirement:** AI strictly consumes a JSON payload of deterministic results and outputs structured narrative blocks.
*   **AC:** The AI explanation is generated from the structured assessment. It clearly separates Facts from Uncertainties.

### 5.4. Blockchain Evidence Anchoring
**What does blockchain actually do?** It is a tamper-evident anchoring layer proving an evidence package existed at a specific time. It is NOT the primary database.
*   **Requirement:** The system generates a canonical JSON record of the incident state, creates a cryptographic hash, and anchors it to a testnet.
*   **AC:** The evidence package receives a cryptographic hash. A blockchain anchor attempt is recorded with a transaction status (e.g., TxHash) stored in the relational database.

### 5.5. 2D User Interface & Investigation
*   **Requirement:** The UI must provide a complete enterprise workflow (Dashboards, 2D Maps, Evidence Timelines, AI Reports, Action buttons).
*   **AC:** The user can view an alert, read the AI summary, inspect the 2D map, and click "Flag for Audit". The action creates a persistent status history entry in the database. The workflow is fully completable without 3D.

### 5.6. Reproducibility & Versioning
*   **Requirement:** Every generated assessment must be immutable and reproducible.
*   **AC:** An assessment record links explicitly to the Evidence IDs, Project Boundary version, Calculation Engine version, and AI output version used at the time of creation.

---

## 6. P1 Functional Requirements

### 6.1. Optional Immersive 3D Investigation
*   **Requirement:** An optional layer to visualize terrain, geofences, evidence hotspots, and spatial context (React Three Fiber). It enhances storytelling but is not required for business-critical operations.
*   **AC:** User can click "View in 3D" from the 2D dashboard. The scene features bounded exploration (limited WASD/mouse look), cinematic camera transitions, and visualizes actual backend data (hotspots mapping to event coordinates). It is not an unrestricted open-world game.

---

## 7. Minimum Conceptual Data Model
To guide the Architecture phase without over-engineering:
*   **Organization:** Top-level tenant.
*   **Portfolio:** Group of Carbon Projects.
*   **Carbon Project:** Metadata and reference to boundaries.
*   **Project Boundary:** Versioned GeoJSON data.
*   **Credit Holding:** The credits owned by the Organization for a Project.
*   **Environmental Event:** Raw ingested event data (e.g., FIRMS fire point).
*   **Evidence Record:** Derived provenance data linking an Event to a Project.
*   **Risk Assessment:** Versioned, deterministic calculation results (Exposure, Area).
*   **AI Report:** Stored text generation from the LLM.
*   **Blockchain Anchor:** Hash, TxID, and status.
*   **Incident:** The parent container for an ongoing issue.
*   **Incident Status History:** Ledger of state changes.
*   **Audit Case:** Human workflow tracking.

---

## 8. Failure Handling Requirements
**What happens when services fail?**
*   **Blockchain Failure:** Must NOT break the operational workflow. If RPC fails, the Anchor remains in "Pending" or "Failed" state in the DB, and the user can still proceed with the audit.
*   **AI Failure:** Deterministic calculations and raw evidence are still displayed to the user. The AI section shows "Interpretation Unavailable".
*   **Missing/Invalid Data:** If a project lacks a valid boundary, geospatial analysis aborts gracefully, flagging the incident as "Insufficient Evidence".

---

## 9. Testing & Architecture Readiness
**How is the system technically testable?**
*   Backend API routes can be hit with cURL/Postman using historical event JSON to verify deterministic geofence intersection and database persistence.
*   The DB schema fully supports tracking the lifecycle independent of the UI.

**How do we demonstrate it without fake data?**
*   By seeding the database with real public project boundaries and executing a controlled "Replay Historical Event" which feeds real coordinates (e.g., a past California wildfire) into the actual backend ingestion API.

**How can the Architecture document map this?**
*   The Architecture must define: The Database Schema (mapping Section 7), The Geospatial Engine (mapping 5.2), The AI Prompt pipeline (mapping 5.3), The Blockchain Smart Contract/RPC setup (mapping 5.4), and the API routes connecting the Next.js frontend to the backend processing.
