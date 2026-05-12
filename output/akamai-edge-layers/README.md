# ATOM Sales Dominator — Akamai EdgeWorker 6-Layer Stack

## Architecture Overview

```
Client Request
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│  Akamai Edge (api.atomsalesdominator.com)                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Layer 2 — Bot Defense & Rate Limiting              │    │
│  │  • Token-bucket per IP (60/min general,             │    │
│  │    10/min /signals, 5/min /pitch)                   │    │
│  │  • Suspicious UA blocking → 403                     │    │
│  │  • CAPTCHA fall-through for /pitch, /leadgen        │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │ (if allowed)                         │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Layer 5 — Geo / GDPR Routing                       │    │
│  │  • Reads PMUSER_GEO_COUNTRY                         │    │
│  │  • EU/EEA → eu-west origin                          │    │
│  │  • Attaches X-ATOM-Region, X-ATOM-GDPR-Region       │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Layer 1 — Smart Origin Router                      │    │
│  │  • GPU paths (/signals/*, /voice/*) → gpu-us-east   │    │
│  │  • Health failover candidate list                   │    │
│  │  • Default: us-east                                 │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Layer 3 — Session Affinity                         │    │
│  │  • Hash atom_session cookie / X-ATOM-Session header │    │
│  │  • FNV-1a → bucket → stable origin override         │    │
│  │  • Critical for ATOM Dial stateful voice calls      │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                      │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Layer 4 — Signal Streaming (SSE Proxy)             │    │
│  │  • responseProvider mode for /api/signals/*         │    │
│  │    and /api/atom-chat                               │    │
│  │  • Transfer-Encoding: chunked, never buffered        │    │
│  │  • Injects CORS + X-ATOM-Tenant                     │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │ (response path, inbound)             │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  Layer 6 — Cache Key Normalization                  │    │
│  │  • Strips _t, __cb from cache key                   │    │
│  │  • Tenant hash in key (per-tenant isolation)        │    │
│  │  • TTL ladder written to Cache-Control response hdr │    │
│  └────────────────────┬────────────────────────────────┘    │
└───────────────────────┼──────────────────────────────────────┘
                        │
           ┌────────────▼────────────┐
           │      Origin selection   │
           ├────────────────────────-┤
           │ us-east  192.155.92.4   │  ← GPU Linode (Blackwell RTX 6000)
           │ us-west                 │
           │ eu-west                 │
           │ gpu-us-east             │  ← AI signal workloads
           └─────────────────────────┘
```

## Layer Responsibilities

| # | Layer | File | Role |
|---|-------|------|------|
| 2 | Bot Defense | `layer2-bot-defense.ts` | Rate limit, UA block, CAPTCHA |
| 5 | Geo / GDPR | `layer5-geo-gdpr.ts` | Data residency, EU routing |
| 1 | Origin Router | `layer1-router.ts` | Latency-based origin, GPU routing |
| 3 | Session Affinity | `layer3-session-affinity.ts` | Sticky sessions for Dial |
| 4 | Signal Streaming | `layer4-signal-streaming.ts` | Unbuffered SSE proxy |
| 6 | Cache Key | `layer6-cache-key.ts` | Key normalisation, TTL ladder |

## TTL Ladder

| Path | TTL |
|------|-----|
| `/api/atom-chat` | 30 seconds |
| `/api/warbook/research` | 24 hours |
| `/api/market-intent/analyze` | 6 hours |
| `/api/atom-leadgen/*` | 5 minutes |
| `/api/signals/*` | no-cache (streaming) |
| default | no-cache |

## Swapping Origin Hostnames Before Activate

1. Open `src/layer1-router.ts`
2. Find the block beginning with `// Replace these four hostnames before deploying`
3. Update the four constants:
   ```typescript
   const ORIGIN_US_EAST  = "atom-api-us-east.atomsalesdominator.com";
   const ORIGIN_US_WEST  = "atom-api-us-west.atomsalesdominator.com";
   const ORIGIN_EU_WEST  = "atom-api-eu-west.atomsalesdominator.com";
   const ORIGIN_GPU_EAST = "atom-api-gpu-us-east.atomsalesdominator.com";
   ```
4. Ensure `src/layer3-session-affinity.ts` → `ORIGIN_POOL` array is updated to match.
5. Re-run build (`npm run build`) and redeploy.

## Deploy Command Sequence

```bash
# 1. Install dependencies
cd output/akamai-edge-layers
npm install

# 2. Type-check (no build artifacts, just validation)
npm run typecheck

# 3. Run smoke tests
npm test

# 4. Build + package + deploy to staging
export EDGEWORKER_ID=<your-edgeworker-id>
export AKAMAI_NETWORK=staging
bash deploy.sh staging

# 5. Verify activation
akamai edgeworkers list-revisions $EDGEWORKER_ID

# 6. Activate on production (when confident)
bash deploy.sh production
```

## Monitoring

```bash
# List all versions (revisions) for your EdgeWorker
akamai edgeworkers list-revisions $EDGEWORKER_ID

# View activation status across networks
akamai edgeworkers list-activations $EDGEWORKER_ID

# Tail enhanced debug logs (requires Enhanced Debug Token in request)
akamai edgeworkers get-trace-id $EDGEWORKER_ID

# DataStream 2: PMUSER_GDPR_LOG and PMUSER_ATOM_ORIGIN are tagged for streaming
# Enable in Akamai Control Center → DataStream → Add stream → pick PMUSER fields
```

## Environment Variables for deploy.sh

| Variable | Description |
|----------|-------------|
| `EDGEWORKER_ID` | Numeric ID from EdgeWorkers Management UI |
| `AKAMAI_NETWORK` | `staging` or `production` (default: staging) |
| `AKAMAI_EDGERC` | Path to .edgerc credentials file (default: `~/.edgerc`) |

## AI Services in Use

| Service | Usage | Path |
|---------|-------|------|
| Perplexity Sonar | Text streaming | `/api/signals/*`, `/api/atom-chat` |
| OpenAI | JSON generation | `/api/warbook/*`, `/api/market-intent/*` |
| Hume | Voice WSS | `/voice/*` (WSS via Twilio bridge) |
| Twilio | Call streams | `/voice/stream` (WSS→Linode 192.155.92.4) |
| Apollo | Enrichment | `/api/atom-leadgen/*` |
| PDL | Contacts | `/api/atom-leadgen/contacts` |

## Origin Infrastructure

- **GPU Linode** — ID 97453485, IP 192.155.92.4 (us-east), 2× RTX 6000 Blackwell  
- **Voice Bridge** — 192.155.92.4 (same Linode), Twilio call streams via WSS  
- **App** — Vercel at `atom-dominator-pro.vercel.app`  
- **Edge entry** — `api.atomsalesdominator.com` (Akamai property)
