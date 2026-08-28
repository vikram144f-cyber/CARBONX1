# CARBONX — Environment Variables and Security Boundaries

**Version:** 1.0  
**Status:** Architecture-approved  
**Updated:** 2026-08-22

This document describes the environment variables used by the current implementation. The committed `.env.example` is the canonical starter file.

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
| `DATABASE_URL` | Yes | Prisma | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/carbonx?sslmode=require`) |
| `NEXTAUTH_SECRET` | Yes | Application configuration | Random secret with at least 32 characters. |
| `NODE_ENV` | Auto | Next.js | Set automatically by the execution environment; do not override. |

### 2.2 NASA FIRMS (Environmental Data)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `NASA_FIRMS_MAP_KEY` | Optional | `FIRMSIngestionService` | 32-character API key from NASA FIRMS registration. Without it, refresh returns an explicit unavailable result and makes no network request. |
| `FIRMS_POINT_BUFFER_KM` | Optional | `GeospatialService` | Buffer radius in km for point detections. Default: `1.0`. Must be documented in all assessments using it |
| `MONITORING_INTERVAL_HOURS` | Optional | Scheduler | How often to poll FIRMS for new data. Default: `6`. Minimum: `1` |

### 2.3 AI Provider

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `NVIDIA_API_KEY` or `AI_API_KEY` | Optional | `AIService` | Selects the NVIDIA provider when configured. |
| `GEMINI_API_KEY` | Optional | `AIService` | Used by the Gemini provider when NVIDIA credentials are absent. |
| `AI_MODEL_ID` | Optional | `AIService` | Optional model override. |

### 2.4 Blockchain (Evidence Anchoring)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `BLOCKCHAIN_RPC_URL` | Optional | `BlockchainService` | EVM RPC endpoint used for anchoring. |
| `BLOCKCHAIN_PRIVATE_KEY` | Optional | `BlockchainService` | Server-side signer key for anchoring. **NEVER LOG THIS VALUE.** |
| `BLOCKCHAIN_CONTRACT_ADDRESS` | Optional | `BlockchainService` | Deployed address of `CarbonXAnchor.sol`; anchoring remains unavailable until configured. |
| `BLOCKCHAIN_NETWORK` | Optional | `BlockchainService` | Network name for display. Default: `sepolia` |
| `BLOCKCHAIN_CONFIRMATIONS` | Optional | `BlockchainService` | Blocks to wait before marking anchor CONFIRMED. Default: `1` |

### 2.5 Satellite Imagery (P1 only — not required for P0)

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `SENTINEL_HUB_CLIENT_ID` | Optional P1 | `SentinelHubService` | Sentinel Hub OAuth client ID. |
| `SENTINEL_HUB_CLIENT_SECRET` | Optional P1 | `SentinelHubService` | Sentinel Hub OAuth client secret. |

---

## 3. Local configuration

Use the committed `.env.example` as the canonical starter file. The effective local setup is:

```bash
# ============================================================
# CARBONX — Environment Variables
# Copy to .env.local for local development
# Never commit .env.local or any file with real secrets
# ============================================================

# ── APPLICATION ─────────────────────────────────────────────
DATABASE_URL=postgresql://carbonx:carbonx@localhost:5432/carbonx
NEXTAUTH_SECRET=change-this-local-secret-to-at-least-32-characters

# ── NASA FIRMS — Environmental Event Data ───────────────────
# Optional: NASA_FIRMS_MAP_KEY=your-32-character-nasa-firms-map-key
FIRMS_POINT_BUFFER_KM=1.0
MONITORING_INTERVAL_HOURS=6

# ── AI PROVIDER ─────────────────────────────────────────────
# Optional: GEMINI_API_KEY=your-gemini-api-key
# Optional: NVIDIA_API_KEY=your-nvidia-api-key
# Optional: AI_MODEL_ID=provider-model-id

# ── BLOCKCHAIN — Evidence Anchoring (Sepolia Testnet) ────────
# Optional: BLOCKCHAIN_RPC_URL=https://your-sepolia-rpc.example
# Optional: BLOCKCHAIN_PRIVATE_KEY=0xyour-64-hex-character-private-key
# Optional: BLOCKCHAIN_CONTRACT_ADDRESS=0xyour-40-hex-character-contract-address
BLOCKCHAIN_NETWORK=sepolia
BLOCKCHAIN_CONFIRMATIONS=1


# ── SATELLITE IMAGERY (P1 — Not required for P0) ─────────────
# SENTINEL_HUB_CLIENT_ID=your-sentinel-hub-client-id
# SENTINEL_HUB_CLIENT_SECRET=your-sentinel-hub-client-secret

# Optional: ADMIN_REFRESH_TOKEN=local-admin-token
```

---

## 4. Startup validation

The server validates the required core variables before serving requests:

- `DATABASE_URL` must be a valid URL.
- `NEXTAUTH_SECRET` must contain at least 32 characters.
- `NASA_FIRMS_MAP_KEY` is optional, but must be a 32-character key when supplied.
- `BLOCKCHAIN_CONTRACT_ADDRESS` is optional, but must be a valid EVM address when supplied.

Blank optional values are treated as absent. Invalid supplied values fail fast with a clear configuration error. Missing optional integration credentials do not create synthetic evidence: FIRMS refresh, satellite analysis, AI interpretation, and blockchain anchoring report their unavailable or failed state while the deterministic workflow remains available.

The implementation is in `lib/env.ts` and the optional-provider behavior is covered by deterministic tests.

---

## 5. External Service Registration Checklist

Before enabling an external integration, configure only the service account required for that capability:

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
| Production | Set `DATABASE_URL` and `NEXTAUTH_SECRET`; add optional integration values only for enabled capabilities. |
| Preview | Use an isolated PostgreSQL database and separate optional integration credentials. |
| Development | Use `.env.local` or the provided Docker Compose PostgreSQL service. |

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
