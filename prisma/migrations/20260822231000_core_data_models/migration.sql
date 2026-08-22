-- CreateEnum
CREATE TYPE "BoundaryQuality" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HoldingStatus" AS ENUM ('ACTIVE', 'RETIRED', 'CANCELLED', 'TRANSFERRED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarbonProject" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registryId" TEXT,
    "methodology" TEXT,
    "countryCode" TEXT,
    "centroidLng" DOUBLE PRECISION NOT NULL,
    "centroidLat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarbonProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBoundary" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "geojson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "quality" "BoundaryQuality" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "areaHa" DOUBLE PRECISION,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBoundary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditHolding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vintage" INTEGER,
    "registrySerialRef" TEXT,
    "issuedQuantity" DOUBLE PRECISION NOT NULL,
    "heldQuantity" DOUBLE PRECISION NOT NULL,
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "refValuePerUnit" DOUBLE PRECISION NOT NULL,
    "refCurrency" TEXT NOT NULL DEFAULT 'USD',
    "valuationBasis" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Portfolio_organizationId_idx" ON "Portfolio"("organizationId");

-- CreateIndex
CREATE INDEX "CarbonProject_portfolioId_idx" ON "CarbonProject"("portfolioId");

-- CreateIndex
CREATE INDEX "ProjectBoundary_projectId_isCurrent_idx" ON "ProjectBoundary"("projectId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBoundary_projectId_version_key" ON "ProjectBoundary"("projectId", "version");

-- CreateIndex
CREATE INDEX "CreditHolding_projectId_idx" ON "CreditHolding"("projectId");

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbonProject" ADD CONSTRAINT "CarbonProject_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBoundary" ADD CONSTRAINT "ProjectBoundary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHolding" ADD CONSTRAINT "CreditHolding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CarbonProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
