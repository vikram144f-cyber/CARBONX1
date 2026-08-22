-- Epic 03: prevent duplicate deterministic assessments for the same
-- incident, boundary, engine, and methodology versions.
CREATE UNIQUE INDEX "RiskAssessment_incidentId_boundaryId_engineVersion_methodologyVersion_key"
ON "RiskAssessment"("incidentId", "boundaryId", "engineVersion", "methodologyVersion");
