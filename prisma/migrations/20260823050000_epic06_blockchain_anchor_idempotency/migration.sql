-- Epic 06: one operational anchor per assessment and supported event type.
CREATE UNIQUE INDEX "BlockchainAnchor_assessmentId_eventType_key"
ON "BlockchainAnchor"("assessmentId", "eventType");
