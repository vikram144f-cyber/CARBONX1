-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WILDFIRE', 'DEFORESTATION', 'FLOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "EventOriginType" AS ENUM ('OBSERVED', 'REPLAYED', 'MODELED', 'USER_REPORTED');

-- CreateEnum
CREATE TYPE "CreatedByType" AS ENUM ('EXTERNAL_SOURCE', 'SYSTEM_CALCULATION', 'AI_GENERATION', 'HUMAN_ACTION', 'REPLAY');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('MONITORING', 'EVENT_DETECTED', 'UNDER_ASSESSMENT', 'AUDIT_RECOMMENDED', 'AUDIT_IN_PROGRESS', 'INSUFFICIENT_EVIDENCE', 'RESOLVED', 'REOPENED');

-- CreateEnum
CREATE TYPE "EvidenceLabel" AS ENUM ('OBSERVED', 'ESTIMATED', 'MODELED', 'INFERRED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AuditPriorityLevel" AS ENUM ('ROUTINE', 'ELEVATED', 'URGENT');

-- CreateEnum
CREATE TYPE "AnchorStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnchorEventType" AS ENUM ('UNDER_ASSESSMENT', 'AUDIT_RECOMMENDED', 'RESOLVED');

-- CreateTable
CREATE TABLE "EnvironmentalEvent" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL DEFAULT 'WILDFIRE',
    "sourceName" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceInstrument" TEXT,
    "fingerprint" TEXT,
    "observedAt" TIMESTAMP(3),
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geometry" JSONB NOT NULL,
    "geomType" TEXT NOT NULL,
    "sourceConfidence" DOUBLE PRECISION,
    "sourceMetadata" JSONB,
    "originType" "EventOriginType" NOT NULL DEFAULT 'OBSERVED',
    "createdByType" "CreatedByType" NOT NULL,
    "rawPayload" JSONB,

    CONSTRAINT "EnvironmentalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'EVENT_DETECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentStatusHistory" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fromStatus" "IncidentStatus",
    "toStatus" "IncidentStatus" NOT NULL,
    "actor" TEXT NOT NULL,
    "createdByType" "CreatedByType" NOT NULL,
    "reason" TEXT,
    "evidenceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" "EvidenceLabel" NOT NULL,
    "createdByType" "CreatedByType" NOT NULL,
    "geometryWkt" TEXT,
    "sourceConfidence" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "boundaryId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "inputEvidenceIds" TEXT[],
    "assumptions" JSONB,
    "triggeringActor" TEXT NOT NULL,
    "createdByType" "CreatedByType" NOT NULL DEFAULT 'SYSTEM_CALCULATION',
    "estimatedImpactHa" DOUBLE PRECISION,
    "impactPct" DOUBLE PRECISION,
    "creditExposure" DOUBLE PRECISION,
    "financialExposureEst" DOUBLE PRECISION,
    "financialCurrency" TEXT,
    "valuationBasis" TEXT,
    "integrityRisk" "RiskLevel" NOT NULL,
    "evidenceConfidence" "ConfidenceLevel" NOT NULL,
    "evidenceConfidenceScore" DOUBLE PRECISION,
    "auditPriority" "AuditPriorityLevel" NOT NULL,
    "uncertaintyNotes" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReport" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSchemaVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "estimatedImpacts" TEXT NOT NULL,
    "uncertainties" TEXT NOT NULL,
    "portfolioConsequences" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "rawResponse" JSONB,
    "createdByType" "CreatedByType" NOT NULL DEFAULT 'AI_GENERATION',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedForAudit" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,

    CONSTRAINT "AIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainAnchor" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "evidenceId" TEXT,
    "canonicalJson" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "AnchorStatus" NOT NULL DEFAULT 'PENDING',
    "eventType" "AnchorEventType" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdByType" "CreatedByType" NOT NULL DEFAULT 'SYSTEM_CALCULATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssessmentEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalEvent_fingerprint_key" ON "EnvironmentalEvent"("fingerprint");

-- CreateIndex
CREATE INDEX "EnvironmentalEvent_observedAt_idx" ON "EnvironmentalEvent"("observedAt");

-- CreateIndex
CREATE INDEX "EnvironmentalEvent_sourceName_acquiredAt_idx" ON "EnvironmentalEvent"("sourceName", "acquiredAt");

-- CreateIndex
CREATE INDEX "Incident_eventId_idx" ON "Incident"("eventId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_projectId_eventId_key" ON "Incident"("projectId", "eventId");

-- CreateIndex
CREATE INDEX "IncidentStatusHistory_incidentId_createdAt_idx" ON "IncidentStatusHistory"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_incidentId_createdAt_idx" ON "EvidenceRecord"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceRecord_eventId_idx" ON "EvidenceRecord"("eventId");

-- CreateIndex
CREATE INDEX "RiskAssessment_incidentId_createdAt_idx" ON "RiskAssessment"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "RiskAssessment_boundaryId_idx" ON "RiskAssessment"("boundaryId");

-- CreateIndex
CREATE INDEX "RiskAssessment_engineVersion_methodologyVersion_idx" ON "RiskAssessment"("engineVersion", "methodologyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AIReport_assessmentId_key" ON "AIReport"("assessmentId");

-- CreateIndex
CREATE INDEX "AIReport_createdAt_idx" ON "AIReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAnchor_hash_key" ON "BlockchainAnchor"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAnchor_txHash_key" ON "BlockchainAnchor"("txHash");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_incidentId_status_idx" ON "BlockchainAnchor"("incidentId", "status");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_assessmentId_idx" ON "BlockchainAnchor"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "_AssessmentEvidence_AB_unique" ON "_AssessmentEvidence"("A", "B");

-- CreateIndex
CREATE INDEX "_AssessmentEvidence_B_index" ON "_AssessmentEvidence"("B");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EnvironmentalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentStatusHistory" ADD CONSTRAINT "IncidentStatusHistory_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EnvironmentalEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_boundaryId_fkey" FOREIGN KEY ("boundaryId") REFERENCES "ProjectBoundary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReport" ADD CONSTRAINT "AIReport_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainAnchor" ADD CONSTRAINT "BlockchainAnchor_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainAnchor" ADD CONSTRAINT "BlockchainAnchor_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "RiskAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainAnchor" ADD CONSTRAINT "BlockchainAnchor_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssessmentEvidence" ADD CONSTRAINT "_AssessmentEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssessmentEvidence" ADD CONSTRAINT "_AssessmentEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

