# Epic 01: Data Foundation

**Priority tier:** P0
**Owner:** Developer A
**Depends on:** none

## Goal
Establish the core Next.js application shell, PostgreSQL database connection, authentication, and the complete Prisma schema required to support real environmental data and credit portfolios.

## Definition of Done
- A Next.js 14+ application is running and connects to PostgreSQL.
- Prisma schema is fully defined with `CreditHolding` (not `CreditLot`), `ProjectBoundary` with correct provenance fields, `EnvironmentalEvent`, `RiskAssessment`, `AIReport`, `BlockchainAnchor`, and `Incident` models.
- Environment variables are validated at startup.
- NextAuth is configured for basic sessions.

---

## Story 01.1: Initialize Application and Environment Validation

**Owner:** Developer A
**Depends on:** none

**As a** system
**I want** to strictly validate all required environment variables at startup
**So that** missing API keys or database URLs cause immediate fail-fast behavior instead of subtle runtime errors.

### Acceptance Criteria
- [ ] Next.js 14+ App Router project is initialized.
- [ ] A Zod schema validates `DATABASE_URL`, `NEXTAUTH_SECRET`, `NASA_FIRMS_MAP_KEY`, and `BLOCKCHAIN_CONTRACT_ADDRESS` on startup.
- [ ] The app fails to boot if required secrets are missing.
- [ ] No secrets are exposed to the client bundle (no `NEXT_PUBLIC_` prefix for restricted keys).

### Technical notes
- PRD 3.1, Architecture Spine AD-3
- See `lib/env.ts` from `docs/environment.md`

---

## Story 01.2: Define Core Prisma Data Models

**Owner:** Developer A
**Depends on:** 01.1

**As a** system
**I want** a strongly-typed relational database schema
**So that** I can store organizations, portfolios, projects, and precise credit holdings without relying on fake frontend state.

### Acceptance Criteria
- [ ] Prisma schema defines `Organization`, `Portfolio`, `CarbonProject`, and `CreditHolding`.
- [ ] The `CreditHolding` model includes quantity, reference price, vintage, and registry reference.
- [ ] Prisma schema defines `ProjectBoundary` including `source`, `sourceUrl`, and `quality` provenance fields.
- [ ] Database is successfully migrated via `prisma migrate dev`.

### Technical notes
- PRD 3.1, Architecture Spine AD-20, AD-21

---

## Story 01.3: Define Incident and Evidence Data Models

**Owner:** Developer A
**Depends on:** 01.2

**As a** system
**I want** database models for events, assessments, AI reports, and blockchain anchors
**So that** every calculation and external observation maintains strict provenance and immutability.

### Acceptance Criteria
- [ ] Prisma schema defines `EnvironmentalEvent` with `createdByType` enum.
- [ ] Prisma schema defines `RiskAssessment` preserving inputs, estimates, and confidence scores.
- [ ] Prisma schema defines `Incident` and `IncidentStatusHistory` to track the state lifecycle.
- [ ] Prisma schema defines `AIReport` and `BlockchainAnchor` linked to the assessment.
- [ ] Prisma seed script provides at least 2 real carbon projects with boundaries (from public data like Global Forest Watch).

### Technical notes
- PRD 2.2, 5.6, Architecture Spine AD-22
