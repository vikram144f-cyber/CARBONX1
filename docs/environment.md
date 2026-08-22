# CARBONX — Environment Variables and Security Boundaries

**Version:** 1.0  
**Status:** Architecture-approved  
**Updated:** 2026-08-22

This document defines all environment variables required by CARBONX, their purpose, which services require them, and the security rules governing their use.

---

## 1. Security Rules (Invariant)

These rules are non-negotiable and enforced by the Architecture Spine (AD-3):

1. **No secret ever appears in source code.** Every key and credential is an environment variable.
2. **No `NEXT_PUBLIC_` variable carries a privileged credential.** `NEXT_PUBLIC_` variables are embedded in the client bundle at build time and are visible to anyone who inspects the page.
3. **All external service calls originate from `lib/services/**` only.** Route handlers delegate to service functions; they never call external APIs directly.
4. **Secrets are validated at startup.** The application fails fast with a clear error if a required variable is missing.
5. **`BLOCKCHAIN_PRIVATE_KEY` never logs.** The application must never print, log, or expose this value even in error messages.

---

## 2. Environment Variable Reference

### 2.1 Application Core

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `DATABASE_URL` | ✅ P0 | Prisma | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/carbonx?sslmode=require`) |
| `NEXTAUTH_SECRET` | ✅ P0 | NextAuth.js | 32+ byte random secret for session signing. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ P0 | NextAuth.js | Full canonical URL of the deployment (e.g., `https://carbonx.vercel.app`) |
| `NODE_ENV` | Auto | Next.js | Set automatically by Vercel; do not override |

### 2.2 NASA FIRMS (Environmental Data)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `NASA_FIRMS_MAP_KEY` | ✅ P0 | `FIRMSIngestionService` | API key from NASA FIRMS registration. Free at [firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov/api/) |
| `FIRMS_SOURCES` | Optional | `FIRMSIngestionService` | Comma-separated instrument sources. Default: `VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT` |
| `FIRMS_POINT_BUFFER_KM` | Optional | `GeospatialService` | Buffer radius in km for point detections. Default: `1.0`. Must be documented in all assessments using it |
| `MONITORING_INTERVAL_HOURS` | Optional | Scheduler | How often to poll FIRMS for new data. Default: `6`. Minimum: `1` |

### 2.3 AI Provider

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `AI_PROVIDER` | Optional | `AIService` | Which LLM to use. Values: `gemini` (default) or `openai` |
| `GEMINI_API_KEY` | ✅ P0 (if `AI_PROVIDER=gemini`) | `AIService` | Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) |
| `OPENAI_API_KEY` | ✅ P0 (if `AI_PROVIDER=openai`) | `AIService` | OpenAI API key. Only needed if switching providers |
| `AI_MODEL_ID` | Optional | `AIService` | Override model. Default: `gemini-1.5-flash` |
| `AI_INPUT_SCHEMA_VERSION` | Optional | `AIService` | Input schema version. Default: `ai-input-v1.0` |
| `AI_OUTPUT_SCHEMA_VERSION` | Optional | `AIService` | Output schema version. Default: `ai-output-v1.0` |

### 2.4 Blockchain (Evidence Anchoring)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `BLOCKCHAIN_RPC_URL` | ✅ P0 | `BlockchainService` | Sepolia RPC endpoint. Example: `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `BLOCKCHAIN_PRIVATE_KEY` | ✅ P0 | `BlockchainService` | Private key of the wallet that pays for anchor transactions. **NEVER LOG THIS VALUE.** Fund with Sepolia ETH from a faucet |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | ✅ P0 | `BlockchainService` | Deployed address of `CarbonXAnchor.sol` on Sepolia |
| `BLOCKCHAIN_NETWORK` | Optional | `BlockchainService` | Network name for display. Default: `sepolia` |
| `BLOCKCHAIN_CONFIRMATIONS` | Optional | `BlockchainService` | Blocks to wait before marking anchor CONFIRMED. Default: `1` |

### 2.5 Satellite Imagery (P1 only — not required for P0)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `PLANETARY_COMPUTER_KEY` | ❌ P1 | `SatelliteService` (P1) | Microsoft Planetary Computer API subscription key. Free tier available |
| `SENTINEL_HUB_CLIENT_ID` | ❌ P1 stretch | `SatelliteService` (P1) | Sentinel Hub OAuth client ID |
| `SENTINEL_HUB_CLIENT_SECRET` | ❌ P1 stretch | `SatelliteService` (P1) | Sentinel Hub OAuth client secret |

### 2.6 Optional Map Tiles

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ❌ Optional | Leaflet/MapLibre (2D maps) | Mapbox public token for enhanced basemap tiles. The only `NEXT_PUBLIC_` variable. Does NOT grant any server-side privileges. OpenStreetMap tiles work without this |

### 2.7 Queue / Background Jobs

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `QUEUE_DRIVER` | Optional | Scheduler | Which async job mechanism to use. Values: `pgboss` or `vercel-edge`. Default: `pgboss` |
| `PGBOSS_SCHEMA` | Optional | pg-boss | PostgreSQL schema name for pg-boss tables. Default: `pgboss` |

### 2.8 Observability (Optional)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `LOG_LEVEL` | Optional | Logger | Logging verbosity. Values: `debug`, `info`, `warn`, `error`. Default: `info` |
| `SENTRY_DSN` | ❌ Optional | Error tracking | Sentry DSN for error monitoring |

---

## 3. .env.example

```bash
# ============================================================
# CARBONX — Environment Variables
# Copy to .env.local for local development
# Never commit .env.local or any file with real secrets
# ============================================================

# ── APPLICATION ─────────────────────────────────────────────
DATABASE_URL=postgresql://carbonx:password@localhost:5432/carbonx
NEXTAUTH_SECRET=your-32-byte-random-secret-here
NEXTAUTH_URL=http://localhost:3000

# ── NASA FIRMS — Environmental Event Data ───────────────────
# Free registration: https://firms.modaps.eosdis.nasa.gov/api/
NASA_FIRMS_MAP_KEY=your-firms-map-key-here
FIRMS_SOURCES=VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT
FIRMS_POINT_BUFFER_KM=1.0
MONITORING_INTERVAL_HOURS=6

# ── AI PROVIDER ─────────────────────────────────────────────
# Values: gemini (default) | openai
AI_PROVIDER=gemini
# Get key: https://aistudio.google.com/
GEMINI_API_KEY=your-gemini-api-key-here
# OPENAI_API_KEY=your-openai-api-key-here  # Only if AI_PROVIDER=openai

# ── BLOCKCHAIN — Evidence Anchoring (Sepolia Testnet) ────────
# Get RPC URL from Alchemy: https://dashboard.alchemy.com/
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-alchemy-key
# WARNING: Never log, print, or share this key. Fund with Sepolia ETH from a faucet.
BLOCKCHAIN_PRIVATE_KEY=0xyour-sepolia-wallet-private-key
BLOCKCHAIN_CONTRACT_ADDRESS=0xyour-deployed-contract-address
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_CONFIRMATIONS=1

# ── MAP TILES (Optional) ─────────────────────────────────────
# OpenStreetMap works without this. Only add if using Mapbox basemaps.
# NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-public-token

# ── SATELLITE IMAGERY (P1 — Not required for P0) ─────────────
# PLANETARY_COMPUTER_KEY=your-planetary-computer-key
# SENTINEL_HUB_CLIENT_ID=your-sentinel-hub-client-id
# SENTINEL_HUB_CLIENT_SECRET=your-sentinel-hub-client-secret

# ── QUEUE DRIVER ─────────────────────────────────────────────
# Values: pgboss (default) | vercel-edge
QUEUE_DRIVER=pgboss

# ── OBSERVABILITY ────────────────────────────────────────────
LOG_LEVEL=info
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

---

## 4. Startup Validation

The application validates required environment variables at startup before accepting any requests. Missing required variables cause the application to exit with a clear error.

**File:** `lib/env.ts`

```typescript
// lib/env.ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  NASA_FIRMS_MAP_KEY: z.string().min(1),
  AI_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  BLOCKCHAIN_RPC_URL: z.string().url(),
  BLOCKCHAIN_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  FIRMS_POINT_BUFFER_KM: z.coerce.number().positive().default(1.0),
  MONITORING_INTERVAL_HOURS: z.coerce.number().min(1).default(6),
}).refine(
  (env) => env.AI_PROVIDER !== "gemini" || !!env.GEMINI_API_KEY,
  { message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini" }
).refine(
  (env) => env.AI_PROVIDER !== "openai" || !!env.OPENAI_API_KEY,
  { message: "OPENAI_API_KEY is required when AI_PROVIDER=openai" }
);

export const env = envSchema.parse(process.env);
```

This file is imported at the top of every service file. If a variable is missing, the parse throws immediately during module load, not during a user request.

---

## 5. External Service Registration Checklist

Before deployment, the following external service accounts must be created:

| Service | Registration URL | Key variable | Notes |
|---|---|---|---|
| NASA FIRMS | https://firms.modaps.eosdis.nasa.gov/api/ | `NASA_FIRMS_MAP_KEY` | Free; instant |
| Google AI Studio | https://aistudio.google.com/ | `GEMINI_API_KEY` | Free tier; rate limits apply |
| Alchemy (Sepolia RPC) | https://dashboard.alchemy.com/ | In `BLOCKCHAIN_RPC_URL` | Free tier sufficient |
| Ethereum Sepolia wallet | Generate with `cast wallet new` (Foundry) or MetaMask | `BLOCKCHAIN_PRIVATE_KEY` | Fund from a Sepolia faucet |
| Neon / Supabase | https://neon.tech or https://supabase.com | In `DATABASE_URL` | Free tier; Prisma pooling required |
| Vercel | https://vercel.com | (Deployment platform) | Connect GitHub repository |

---

## 6. Vercel Environment Variable Configuration

In the Vercel dashboard, environment variables must be set per environment:

| Environment | Notes |
|---|---|
| Production | Live values; `NEXTAUTH_URL` = production domain |
| Preview | Staging values; separate Neon branch; separate Sepolia wallet |
| Development | Local `.env.local` file; not set in Vercel |

**Database branching:** Neon supports database branching. The `preview` environment should use a separate Neon branch to prevent preview deployments from contaminating production data.

---

## 7. Secret Rotation Procedure

If any secret is compromised:

1. **`BLOCKCHAIN_PRIVATE_KEY`:** Generate a new wallet. Deploy new Sepolia ETH to the new wallet. Update Vercel env var. Update `BLOCKCHAIN_CONTRACT_ADDRESS` if redeployment is needed. Old transaction hashes remain valid (they are on-chain).
2. **`NASA_FIRMS_MAP_KEY`:** Regenerate in FIRMS dashboard. Update Vercel env var. No data loss.
3. **`GEMINI_API_KEY`:** Revoke in Google AI Studio. Generate new key. Update Vercel env var.
4. **`NEXTAUTH_SECRET`:** Changing this invalidates all existing sessions. Users will be logged out. Update Vercel env var and redeploy.
5. **`DATABASE_URL`:** If credentials are rotated, update Neon/Supabase credentials and update Vercel env var. Prisma connection pool will reconnect.

---

*No real secrets appear in this document or in any committed file. All values above are placeholders. The `.env.example` file is safe to commit.*
