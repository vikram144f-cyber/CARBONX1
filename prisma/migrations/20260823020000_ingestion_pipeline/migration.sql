-- Epic 02: FIRMS ingestion cursor and source data versioning.
ALTER TABLE "EnvironmentalEvent"
ADD COLUMN "dataVersion" TEXT;

CREATE TABLE "MonitoringCheckpoint" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "consecutiveFails" INTEGER NOT NULL DEFAULT 0,
    "lastErrorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonitoringCheckpoint_sourceName_key"
ON "MonitoringCheckpoint"("sourceName");
