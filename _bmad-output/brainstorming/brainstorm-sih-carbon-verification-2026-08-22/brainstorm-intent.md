# CARBONX: Product Intent Document

## 1. Product Vision
CARBONX is an auditable carbon-credit incident-response and risk intelligence platform for organizations holding carbon credit portfolios. The core problem it solves is the gap between an environmental incident occurring and an organization understanding the exposure, evidence, and next actions. It helps organizations move efficiently from **DETECTION → ASSESSMENT → INVESTIGATION → HUMAN ACTION → DOCUMENTED RESOLUTION**. CARBONX provides verification support, evidence preparation, and risk intelligence, but it does NOT replace official carbon registries, accredited auditors, or formal verification authorities.

## 2. Core Value Proposition
CARBONX connects physical environmental events to carbon credit portfolio risk through a continuous environmental risk monitoring layer. It provides immediate, evidence-backed clarity on the integrity of a carbon asset in the face of dynamic environmental threats.

## 3. Product Differentiation
The carbon monitoring space is established. CARBONX differentiates itself by focusing specifically on the incident-to-action workflow for credit holders. It is not just asking "Is this project good?"; it provides a platform to answer: "An event just occurred. What does this mean for my held assets, what is the evidence, and what should happen next?"

## 4. Risk, Exposure, and Evidence Model
The system explicitly distinguishes the severity of an event from the certainty of the evidence. **"Risk tells us how serious or concerning an incident may be. Evidence confidence tells us how strongly the available evidence supports that assessment."**

1.  **Physical Impact:** The estimated area, severity, or extent of environmental change affecting the project.
2.  **Credit Exposure:** The estimated number or proportion of held carbon credits associated with the affected project area or relevant credit holdings.
3.  **Financial Exposure:** The estimated financial value associated with potentially affected carbon credits.
4.  **Integrity Risk:** An assessment of how seriously the environmental event may threaten the environmental claim, permanence assumptions, or expected integrity of the carbon asset.
5.  **Evidence Confidence:** A measure of how strongly the available evidence supports the assessment.
6.  **Audit Priority:** The recommended urgency for human review based on risk, exposure, and evidence confidence.

*Important:* A severe environmental event does not automatically mean all credits are affected. High physical impact does not automatically equal high financial exposure. High risk does not automatically mean high evidence confidence. A detected event does not automatically invalidate carbon credits. Low evidence confidence does not mean that the event did not occur.

## 5. Confidence, Uncertainty, and Provenance
CARBONX will never present important estimates as unexplained absolute facts. Major assessments should conceptually include:
*   Estimated impact
*   Evidence confidence
*   Evidence timestamp & source
*   Data recency
*   Project boundary source
*   Calculation or methodology version
*   Key uncertainties and limitations (e.g., cloud cover, missing/delayed imagery, limited spatial resolution, incomplete boundaries, conflicting sources, lack of ground confirmation).

The product must clearly distinguish between observed evidence, estimated impact, deterministic calculation, AI interpretation, and human decision.

## 6. Evidence Quality Model
An Evidence Quality / Evidence Confidence concept exists separate from risk. At the product level, evidence confidence may consider: source reliability, observation recency, spatial resolution, project boundary quality, corroboration from multiple sources, and completeness of evidence.

## 7. Incident Status Model
CARBONX uses a clear status model to avoid premature conclusions (like "Invalid" or "Fraud" unless formally determined by external audit):
*   **MONITORING:** No material incident currently identified.
*   **EVENT DETECTED:** An environmental anomaly has been identified but has not yet been fully assessed.
*   **UNDER ASSESSMENT:** Evidence, geospatial relationships, and potential exposure are being analyzed.
*   **AUDIT RECOMMENDED:** Available evidence and risk assessment indicate that human review should be prioritized.
*   **AUDIT IN PROGRESS:** A formal human review process has begun.
*   **RESOLVED:** The incident has been closed with a documented human decision.
*   **INSUFFICIENT EVIDENCE:** Available information cannot currently support a sufficiently reliable conclusion.

## 8. Incident Response Workflow
CARBONX supports a complete incident-to-action workflow, tracking the incident from detection to resolution. Conceptually, this includes: incident detection, assessment, risk/confidence evaluation, human assignment, review priority, investigation notes and comments, evidence review, attaching supporting documents, audit recommendation and tracking, final human disposition, documented rationale, and incident reporting. Tracked outcomes (e.g., No action required, Further verification required, Audit escalated, Internally quarantined, Replaced, Retired) are not executed automatically by CARBONX without appropriate human authorization.

## 9. Reproducibility and Versioning Principle
Assessments must remain reproducible and historically traceable. A historical assessment should associate the evidence available at that time, source references, the project boundary version, the assessment methodology version, and the resulting risk/confidence assessment. 

## 10. Failure and Data-Limitation Principles
CARBONX must gracefully handle missing data (e.g., unavailable satellite feeds, conflicting sources, incomplete boundaries, outdated imagery). The platform communicates these limitations to the user rather than silently generating misleading conclusions.

## 11. Core User Experience: Enterprise Workflow and Optional 3D
The immersive 3D environment is a signature feature, but it is **NOT required** to complete the normal investigation workflow. 

**The normal operational enterprise workflow:**
Alert → Executive Summary → 2D Evidence Review → Map / Geospatial Review → Timeline and Assessment → **Optional 3D Investigation** → Human Decision / Audit Workflow.

**The Optional 3D Investigation:** A deeper spatial investigation mode serving as a visual storytelling and executive presentation experience. It features limited WASD movement, mouse navigation, bounded exploration, cinematic transitions, environmental terrain, project boundaries, anomaly zones, evidence hotspots, and areas of uncertainty. It enhances investigation but is not a game, and is not required for operational use.

## 12. AI Role
**AI remains an intelligence and explainability layer.**
*   **AI may:** Generate human-readable incident summaries, explain structured evidence/risk/exposure/confidence, surface key uncertainties, explain why an assessment was generated, summarize timelines, and suggest possible next actions.
*   **AI must NOT:** Invent evidence/calculations, perform authoritative geospatial calculations, override deterministic calculations, hide uncertainty, present estimates as confirmed facts, automatically invalidate credits, or make final legal/verification decisions. AI must distinguish facts, estimates, and recommendations.

## 13. Blockchain Role
**Blockchain provides an independently verifiable, tamper-evident commitment to critical evidence and workflow events.** It is NOT the main database; the relational database remains the operational system of record.
*   **Anchored Evidence:** May include incident identifiers, evidence references, timestamps, data provenance metadata, assessment version, methodology version, status transition, and a cryptographic hash.
*   **Constraint:** Blockchain does not prove the underlying environmental event itself is true; it proves a particular evidence package existed in a particular form at a particular time.

## 14. End-to-End Workflow
*   Environmental Data
*   ↓ Event Detection
*   ↓ Project and Geospatial Relationship Analysis
*   ↓ Physical Impact Estimation
*   ↓ Credit Exposure Assessment
*   ↓ Financial Exposure Estimation
*   ↓ Integrity Risk Assessment + Evidence Confidence Assessment
*   ↓ Incident Status: **EVENT DETECTED**
*   ↓ **UNDER ASSESSMENT**
*   ↓ Executive Summary
*   ↓ 2D Evidence Map and Timeline
*   ↓ AI-Assisted Evidence Interpretation
*   ↓ **Optional Immersive 3D Investigation**
*   ↓ Human Review
*   ↓ **AUDIT RECOMMENDED** or **INSUFFICIENT EVIDENCE**
*   ↓ **AUDIT IN PROGRESS**
*   ↓ Documented Human Resolution (Blockchain anchors critical transitions where appropriate)

## 15. Final Product Definition
CARBONX is an auditable carbon-credit incident-response and risk intelligence platform for organizations holding carbon credit portfolios. It connects environmental events to potential carbon asset exposure through geospatial analysis, deterministic assessment, evidence confidence evaluation, AI-assisted interpretation, and human decision workflows. 

The standard operational workflow is based on dashboards, maps, timelines, evidence records, and incident management. The immersive 3D environment is an optional investigation layer that helps users spatially understand project boundaries, anomaly zones, evidence hotspots, and uncertainty. Blockchain provides tamper-evident anchoring of critical evidence and workflow events. 

CARBONX does not automatically invalidate carbon credits or replace official auditors and registries. Its purpose is to help organizations detect incidents, quantify potential exposure, understand the available evidence and uncertainty, preserve an auditable record, and initiate appropriate human action.
