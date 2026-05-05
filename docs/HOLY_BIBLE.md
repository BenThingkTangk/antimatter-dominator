# ATOM Sales Dominator — Holy Bible v1

> The complete architecture, operations, and roadmap reference.  
> **Audience:** Engineers, operators, and onboarding engineers who maintain, extend, or deploy this platform. Every sentence earns its place.

---

## Table of Contents

1. [What this is](#1-what-this-is)
2. [The 30-second mental model](#2-the-30-second-mental-model)
3. [Directory map](#3-directory-map)
4. [Voice pipeline (deep dive)](#4-voice-pipeline-deep-dive)
5. [Live call intelligence](#5-live-call-intelligence)
6. [Product RAG (atom-rag service)](#6-product-rag-atom-rag-service)
7. [The 17 API routes](#7-the-17-api-routes)
8. [Environment variables](#8-environment-variables)
9. [Multi-tenant architecture (white-label)](#9-multi-tenant-architecture-white-label)
10. [White-label rebrand script](#10-white-label-rebrand-script)
11. [The 8 modules (user manual)](#11-the-8-modules-user-manual)
12. [Operations runbook](#12-operations-runbook)
13. [Cost model](#13-cost-model)
14. [Roadmap to Vibranium](#14-roadmap-to-vibranium)
15. [What's NOT here yet (gaps)](#15-whats-not-here-yet-gaps)
16. [Glossary](#16-glossary)
17. [References & citations](#17-references--citations)

---

## 1. What this is

ATOM Sales Dominator is an AI-powered outbound sales agent platform built for the Antimatter AI ecosystem (Nirmata Holdings, © 2026). At its core is a live voice dialer, ADAM, that places real outbound phone calls via [Twilio Voice API](https://www.twilio.com/docs/voice), greets the prospect by name within 280 milliseconds of pickup, and conducts a full discovery + pitch conversation using [Hume EVI](https://www.hume.ai/evi) (emotion-aware speech) backed by [Claude Sonnet](https://www.anthropic.com/claude) for reasoning and Octave TTS for output — all while the rep watches live sentiment, buyer intent, emotion bars, and deal-risk signals update in real time on the War Room dashboard.

Surrounding the dialer are seven additional intelligence modules: a Claude-powered pitch generator, an objection-rebuttal engine, a Perplexity Sonar market-intent analyzer, a multi-source prospect scanner (Apollo + Hunter + PDL + BuiltWith + TheirStack), a campaign email generator, and an ATOM WarBook for deep company research. Every module writes to and reads from a shared Pinecone-backed RAG service (`atom-rag`) hosted on Linode, ensuring that whatever ADAM says on the call matches the research the rep just ran. The product catalog (`api/products.ts`) covers six Antimatter products — Antimatter AI Platform, ATOM Enterprise AI, Vidzee, Clinix Agent, Clinix AI, and Red Team ATOM — and every module is aware of all six.

The platform is deployed as a multi-tenant white-label SaaS. The primary deployment lives at `atom-dominator-pro.vercel.app`. The first white-label customer — Intelisys / ScanSource — runs a fully rebranded instance under its own Vercel project (`intelisys-sales-copilot.vercel.app`). The architecture is currently in the "clone-per-tenant" phase described in [WHITE-LABEL-PLAYBOOK.md](../WHITE-LABEL-PLAYBOOK.md), with the next milestone being subdomain-based multi-tenancy backed by Supabase (Section 9).

---

## 2. The 30-second mental model

```
                     ┌────────────────────────────────────────────────────────┐
                     │                  POST /api/atom-leadgen/call           │
                     │          (firstName, companyName, phoneNumber,          │
                     │           productName → call.ts:173)                    │
                     └───────────────┬────────────────────────────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────────────┐
              │ PARALLEL (call.ts:206–246)                          │
              │                                                     │
  ┌───────────▼──────────────────┐       ┌────────────────────────▼────────┐
  │ RAG warm-up                  │       │ Twilio createCall               │
  │ POST atom-rag/company/context│       │ To=prospect, From=TWILIO_NUMBER │
  │ module=pitch  (~700ms warm)  │       │ Url=hume-twilio-webhook          │
  │ + module=objection (~1500ms) │       │ (~300ms round-trip)             │
  └───────────┬──────────────────┘       └────────────────────────┬────────┘
              │                                                    │
              │ trimmedBrief + objection                           │ Twilio rings prospect
              │ playbook ≤ 1100 chars                              │ (2–30s ringing)
              │                                                    │
              └──────────────────┐     ┌──────────────────────────┘
                                 │     │
                    ┌────────────▼─────▼──────────────────────────┐
                    │  Twilio Url callback → Hume EVI              │
                    │  api.hume.ai/v0/evi/twilio?config_id=...     │
                    │  custom_session_id=atom_<timestamp>_<rand>   │
                    │  first_name, company_name, company_brief      │
                    └───────────────────┬──────────────────────────┘
                                        │
                          Prospect answers (says "Hello")
                                        │
                     ┌──────────────────▼──────────────────────────┐
                     │  Hume EVI v11 (config_id=3c6f8a5b...)       │
                     │  pickup_gate=true → waits for utterance      │
                     │  → ADAM: "Hey {first_name}... this is Adam"  │
                     │    within 250ms of detected pickup           │
                     │                                              │
                     │  STT: Hume built-in                          │
                     │  LLM: Claude Sonnet (~150ms first-token)     │
                     │  TTS: Octave (Jobs Tenor voice id:           │
                     │       e891bda0-d013-4a46-9cbe-360d618b0e58)  │
                     │  VAD: Hume EVI native (interrupts in 200ms)  │
                     └───────────────────┬──────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────────┐
                    │  Frontend polls GET /api/atom-leadgen/       │
                    │  chat-events?sessionId=atom_...              │
                    │  every ~1.8s (chat-events.ts:203)           │
                    │                                              │
                    │  Returns: transcript, sentiment (-100..100), │
                    │  buyerIntent (0..100), 6 emotion bars,       │
                    │  callStage (1–4), warroom (Von Clausewitz)   │
                    └─────────────────────────────────────────────┘
```

**End-to-end latency to first word:** ~280ms after prospect utterance is detected. RAG warm-up runs in parallel with the Twilio dial and completes before pickup (~700ms warm cache vs 2–30s dial ring time).

---

## 3. Directory map

```
atom-dominator-pro/
│
├── api/                              # Vercel serverless functions (Node/TypeScript)
│   ├── atom-leadgen/
│   │   ├── call.ts                  # [FLAGSHIP] Places Twilio call, fetches RAG brief, returns sessionId
│   │   ├── chat-events.ts           # Live call data poller: Hume emotions → sentiment/intent/warroom
│   │   ├── hume-token.ts            # OAuth2 short-lived access token for Hume EVI WebSocket
│   │   └── simulate.ts              # Simulated call events for dev/demo (no live Twilio)
│   ├── aletheia/
│   │   └── analyze-text.ts          # Von Clausewitz text analysis (email/chat, not live call)
│   ├── campaign/
│   │   └── analyze.ts               # Personalized email draft generator (GPT-4o-mini + SambaNova)
│   ├── cron/
│   │   └── daily-briefs.ts          # Vercel cron job at 10:00 UTC — generates morning target briefs
│   ├── market-intent/
│   │   └── analyze.ts               # Market intelligence report generator (OpenAI + RAG)
│   ├── objection/
│   │   └── handle.ts                # Objection rebuttal generator (OpenAI + RAG)
│   ├── pitch/
│   │   └── generate.ts              # Pitch generator (OpenAI + RAG, returns structured JSON)
│   ├── product-intel/
│   │   └── research.ts              # Product feature/competitive research (OpenAI)
│   ├── products.ts                  # Static product catalog GET endpoint (6 products, no DB call)
│   ├── prospects/
│   │   ├── enrich.ts                # Single-contact enrichment (Apollo + Hunter + PDL)
│   │   └── scan.ts                  # Bulk prospect scan (Apollo + PDL + TheirStack + BuiltWith + Sonar)
│   ├── rag.ts                       # Unified RAG proxy: forwards load/status/context/query to atom-rag
│   ├── targets/
│   │   ├── daily-brief.ts           # Single-target morning brief (Perplexity Sonar)
│   │   └── generate-package.ts      # 5-section Intel Package for HVT target (5x parallel Sonar)
│   └── warbook/
│       └── research.ts              # Deep company research (Sonar-pro + Apollo + PDL)
│
├── client/                           # Vite/React frontend (SPA, hash routing)
│   ├── index.html                   # Entry HTML, favicon SVG, meta tags
│   └── src/
│       ├── App.tsx                  # Router: 8 routes mapped to 8 pages
│       ├── main.tsx                 # React entry point, QueryClient mount
│       ├── index.css                # Brand token HSLs (light + dark modes)
│       ├── components/
│       │   ├── AppLayout.tsx        # Sidebar nav, collapsible, dark/light toggle, AtomLogo SVG
│       │   ├── HumeVoiceCall.tsx    # Hume @humeai/voice-react WebSocket wrapper (browser-side EVI)
│       │   └── ui/                  # Shadcn/ui component library (40+ components)
│       ├── hooks/
│       │   ├── use-mobile.tsx       # Responsive breakpoint hook
│       │   ├── use-product-intel.ts # React Query hooks for product research
│       │   └── use-toast.ts         # Toast notification hook
│       ├── lib/
│       │   ├── queryClient.ts       # React Query client config
│       │   ├── store.ts             # Zustand store (prospect pipeline state)
│       │   ├── utils.ts             # cn() Tailwind merge utility
│       │   └── warroom-store.ts     # Zustand store (War Room deal state)
│       └── pages/
│           ├── atom-leadgen.tsx     # Live call dialer UI + War Room live panels
│           ├── atom-warroom.tsx     # Standalone War Room (Von Clausewitz text analysis)
│           ├── atom-campaign.tsx    # Campaign email generator
│           ├── atom-aletheia.tsx    # Aletheia standalone (archived/experimental)
│           ├── atom-sonar.tsx       # Sonar research standalone (experimental)
│           ├── call-performance.tsx # Post-call performance analytics (experimental)
│           ├── company-intelligence.tsx # ATOM WarBook UI
│           ├── dashboard.tsx        # Legacy dashboard (not routed in App.tsx)
│           ├── market-intent.tsx    # ATOM Market Intent UI
│           ├── not-found.tsx        # 404 page
│           ├── objection-handler.tsx # ATOM Objection Handler UI
│           ├── pitch-generator.tsx  # ATOM Pitch UI
│           └── prospect-engine.tsx  # ATOM Prospect UI
│
├── docs/
│   ├── ATOM_VOICE_REFERENCE.md      # Ground truth voice metrics from Atom-call-2.m4a
│   ├── VIBRANIUM_RESEARCH.md        # May 2026 tech stack research & Vibranium migration plan
│   └── HOLY_BIBLE.md                # ← THIS DOCUMENT
│
├── scripts/
│   └── tenant-rebrand-template.py  # String-replacement rebrand script for white-label clones
│
├── script/
│   └── build.ts                    # Build utility script
│
├── server/                          # Express dev server (local only, not used in Vercel prod)
│   ├── index.ts                    # Dev server entrypoint
│   ├── routes.ts                   # API route registration for dev
│   ├── static.ts                   # Static file serving
│   ├── storage.ts                  # SQLite (drizzle-orm) storage layer
│   └── vite.ts                     # Vite dev server integration
│
├── shared/
│   └── schema.ts                   # Drizzle-ORM + Zod schemas for all DB tables and API types
│
├── WHITE-LABEL-PLAYBOOK.md          # 11-step clone-per-tenant spin-up guide
├── vercel.json                      # Vercel config: 60s function timeout, daily cron
├── vite.config.ts                   # Vite build config
├── tailwind.config.ts               # Tailwind CSS config
├── tsconfig.json                    # TypeScript config
├── drizzle.config.ts                # Drizzle ORM config (SQLite dev DB)
├── package.json                     # Dependencies and scripts
└── components.json                  # Shadcn/ui component config
```

---

## 4. Voice pipeline (deep dive)

### 4.1 Pre-warm RAG strategy

The critical architectural fix in the current sprint is that RAG fetches happen **in parallel** with the Twilio `createCall`, not before it. The sequence in `call.ts:204–246`:

```
t=0ms    → fetchRagBrief(productLabel, company, first)   ← begins immediately
t=0ms    → [Twilio dial begins ~300ms later once RAG is awaited]
t≈700ms  → RAG warm cache returns pitch + objection brief
t≈1–30s  → Twilio completes dial, prospect's phone rings
t≈5–35s  → Prospect picks up, says "hello"
t≈35ms   → Hume VAD fires, pickup_gate releases ADAM
t=~280ms → ADAM speaks first word
```

Because the average warm RAG cache response (700ms) is always faster than the human answering the phone (minimum 5–10 seconds of ringing), the brief is ready before Hume EVI could possibly need it. On cold cache (product not yet indexed), `backgroundIngest()` fires as a fire-and-forget fetch (`call.ts:131–137`) and a generic brief is passed instead — the next call for that product will be warm.

The `compactBrief()` function (`call.ts:61–74`) trims the 4–7KB RAG output to ≤1100 raw characters before URL-encoding it into the Hume Twilio webhook URL (Twilio enforces a 4000-character limit on the `Url` parameter; URL-encoding roughly triples payload size). The compact brief prioritizes chunks matching `/pain|objection|differenti|why.*choose|opener|value|budget|competitor|discover/i`.

### 4.2 Hume custom_session_id correlation

Before `twilioCreateCall()` is invoked, a session UUID is generated (`call.ts:232`):

```typescript
const sessionId = `atom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
```

This ID is passed to Hume via the `custom_session_id` query parameter on the EVI Twilio webhook URL (`call.ts:237`) and returned to the frontend in the response payload (`call.ts:251`). The frontend stores it and uses it to poll `GET /api/atom-leadgen/chat-events?sessionId=<id>`.

On the poll side, `findChatBySessionId()` (`chat-events.ts:64–84`) scans the 30 most recent Hume chats (`GET https://api.hume.ai/v0/evi/chats?page_size=30`) and matches on `c.custom_session_id === sessionId`. This scan returns `null` for the first 5–15 seconds after call initiation because Hume has not yet created a chat object — the frontend correctly treats this as `status: "pending"` and continues polling.

### 4.3 Octave TTS inside EVI — single WebSocket, no extra latency

ATOM does not call Octave TTS directly. Octave is embedded as the TTS engine inside the Hume EVI configuration (`config_id: 3c6f8a5b-e6f3-4732-9570-36a22f38e147`). The EVI WebSocket handles the full STT → LLM → TTS chain internally. This means:

- No additional HTTP roundtrip from ATOM's servers to an external TTS endpoint.
- Audio streams directly from Hume's infrastructure to Twilio's SIP bridge.
- The Jobs Tenor voice (`voice_id: e891bda0-d013-4a46-9cbe-360d618b0e58`) is configured at the Hume EVI config level and applied to every call using that `config_id`.

Per [ATOM_VOICE_REFERENCE.md](./ATOM_VOICE_REFERENCE.md), the voice characteristics are: ~220Hz fundamental frequency, warm-mid-range tenor, light vocal fry on emphasis, ~210–220 WPM talking pace. [Hume's Octave 2](https://www.hume.ai/blog/octave-2-launch) is a strong upgrade path (same API, 40% faster, 50% cheaper) — currently on Octave 1 in production.

### 4.4 Interruption handling

Interruption handling is entirely managed by [Hume EVI's native VAD](https://www.hume.ai/evi). No custom silence detection or interruption logic lives in ATOM's code. The EVI system prompt (defined in the Hume dashboard config `3c6f8a5b`) encodes the behavioral rule from `ATOM_VOICE_REFERENCE.md`:

```
INTERRUPTION RULES:
- If the prospect speaks while you are speaking, stop within 200ms.
- Listen fully. Do NOT continue your previous sentence.
- Respond to what they said, not to what you were about to say.
```

This bakes interruption behavior into Claude's reasoning, so even if VAD fires marginally, ADAM will not resume its previous thought.

### 4.5 Pickup detection: EVI v11 `pickup_gate`

The production Hume EVI config (`config_id: 3c6f8a5b-e6f3-4732-9570-36a22f38e147`) is configured with `pickup_gate: true` (EVI v11 feature). This prevents ADAM from speaking into voicemail or a ringing phone. ADAM only opens with `"Hey {first_name}..."` after Hume's VAD detects a human utterance of ≥1 syllable. Per [ATOM_VOICE_REFERENCE.md](./ATOM_VOICE_REFERENCE.md):

```
- DO NOT speak until the caller says "hello" / "yeah?" / any utterance ≥ 1 syllable.
- Within 250ms of detected pickup, say: "Hey {first_name}... this is Adam from {company_name}."
```

The EVI `{{first_name}}`, `{{company_name}}`, `{{product_name}}`, and `{{company_brief}}` template variables are injected into the EVI system prompt via the Twilio webhook URL query parameters at call creation time (`call.ts:235–241`).

---

## 5. Live call intelligence

The frontend polls `GET /api/atom-leadgen/chat-events?sessionId=<id>` approximately every 1.8 seconds. The endpoint is stateless — Hume is the single source of truth. Below is each UI panel, its data source, and its failure modes.

### Sentiment gauge (−100 to +100)

**What it measures:** Emotional valence of the prospect's voice across the call — positive emotions push the needle right, negative push it left.

**Data source:** `computeSentiment()` in `chat-events.ts:94–103`. Iterates all `USER_MESSAGE` Hume events, parses their `emotion_features` (48-dimensional float vector), sums `POS_EMOTIONS` vs `NEG_EMOTIONS` sets, and returns `((pos − neg) / (pos + neg)) × 100`.

**Blend:** 70% latest utterance / 30% running average (`chat-events.ts:271–275`), so the gauge reacts quickly without thrashing.

**Update cadence:** ~1.8s polling interval.

**Failure modes:** Returns 0 if `pos + neg < 0.001` (i.e., no emotion data yet — call is too early or prospect hasn't spoken). Returns 0 if `HUME_API_KEY` is missing.

### Buyer intent gauge (0 to 100)

**What it measures:** Purchasing readiness signals — high-intent emotions in the `HIGH_INTENT` set: `Interest, Concentration, Contemplation, Realization, Desire, Excitement, Enthusiasm, Determination, Admiration` (`chat-events.ts:49–52`).

**Data source:** `computeIntent()` — sums HIGH_INTENT emotion scores, normalizes against a max-realistic total of 2.0, clamps at 100.

**Update cadence:** Same ~1.8s poll.

**Failure modes:** Returns 0 early in the call before enough utterances exist.

### Emotion analysis bars (6 groups)

**What it measures:** Six macro-emotion groups — confidence, interest, skepticism, excitement, frustration, neutrality — each aggregated from 3–6 Hume micro-emotions (`EMOTION_GROUPS` in `chat-events.ts:25–32`).

**Data source:** `rollupEmotions()` — averages member scores within each group, clamps at 1.0.

**Update cadence:** ~1.8s.

**Failure modes:** All bars at zero until Hume surfaces emotion data. This is normal for the first 5–15s of a call.

### Call stage (1–4)

**What it measures:** Where the conversation is in the sales arc — 1=Discovery, 2=Evaluation, 3=Negotiation, 4=Close.

**Data source:** `inferStage()` (`chat-events.ts:124–130`). Regex match on full transcript text:
- Stage 4 (Close): `close|contract|sign|send.*agreement|proposal`
- Stage 3 (Negotiation): `price|cost|budget|how much|pricing|discount`
- Stage 2 (Evaluation): `demo|see it|show me|case study|reference|proof`
- Default: Stage 1

**Update cadence:** Re-derived on every poll from the growing transcript.

**Failure modes:** No server-side state; derived fresh each poll. May stay at Stage 1 if prospect uses unusual vocabulary.

### Sentiment timeline

**What it measures:** Historical sentiment per utterance, allowing the rep to see where in the conversation the prospect warmed up or cooled down.

**Data source:** Each `USER_MESSAGE` event has its own `emotion_features`; the timeline plots `computeSentiment()` per individual message rather than the blended aggregate.

### Buying signals chips

**What it measures:** Discrete text-matched buying signals surfaced from the transcript — e.g., mentions of "budget," "timeline," "pilot," "decision by."

**Data source:** Regex or keyword extraction client-side on the transcript returned by `chat-events.ts`. (Implementation lives in the frontend `atom-leadgen.tsx` page, not in the API.)

### Full transcript

**What it measures:** Rolling conversation, role-attributed (agent/user).

**Data source:** `chat-events.ts:228–235` — filters `USER_MESSAGE` and `AGENT_MESSAGE` events from Hume, extracts `message_text`, maps role.

### Von Clausewitz / War Room panel

**What it measures:** Deep behavioral decode of the prospect's last utterance — truth score, deal risk, deception indicators, ghost probability, competitive radar, and a suggested ADAM reply.

**Data source:** `runAletheia()` (`chat-events.ts:136–201`) — fires `gpt-4o-mini` with `json_object` response format on every new prospect utterance. Schema: `truthScore`, `dealRisk`, `urgency`, `deception` (6 sub-fields), `buyerIntentState`, `ghostProbability`, `negotiationPosture`, `competitiveRadar`, `flags`, `suggestedReply`, `move`, `signal`.

**Update cadence:** One OpenAI call per new prospect utterance (not every 1.8s poll). Skipped if `lastUserMsg` is unchanged.

**Failure modes:** Returns `null` if `OPENAI_API_KEY` is missing or utterance < 8 chars. Frontend should handle `warroom: null` gracefully (no panel crash).

### chat-events 404 / pending window

The most common operator confusion: the frontend sees `status: "pending"` with empty transcript for the first 5–15 seconds of a call. This is correct — Hume does not create a chat object until the call is answered and EVI establishes the WebSocket. Keep polling. The chat appears when `findChatBySessionId()` finds a matching `custom_session_id` in Hume's `/v0/evi/chats` list.

---

## 6. Product RAG (atom-rag service)

The `atom-rag` service is a Python FastAPI application hosted on Linode, fronted by Caddy (HTTPS via sslip.io wildcard cert). It is the external microservice that feeds product-aware pitch context into every ATOM module and into the EVI system prompt at call time.

**Base URL:** `https://atom-rag.45-79-202-76.sslip.io` (default in all API routes; overrideable via `RAG_URL` env var).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/company/load` | Background-ingest a company/product into Pinecone. Triggers Perplexity Sonar + GPT-4 research → chunked upsert. ~20s cold start. |
| `GET/POST` | `/company/:name/status` | Returns ingest status (`queued`, `processing`, `ready`, `error`) for a named entity. |
| `POST` | `/company/context` | Vector-search retrieval. Body: `{ company_name, module, query }`. Returns `{ context: string }`. Warm hit < 900ms. |
| `GET` | `/health` | Liveness check. Returns `{ status: "ok" }`. |

The `rag.ts` Vercel route (`api/rag.ts`) is a proxy that forwards these calls under the `action` parameter: `load`, `status`, `context`, `query`.

### Modules

Each ingested entity is chunked into four retrieval modules:

| Module | Content |
|--------|---------|
| `pitch` | Opener, value proposition, proof points, best pitch angles |
| `objection` | Common objections, rebuttals, handling tactics |
| `market` | Market trends, competitive landscape, industry signals |
| `prospects` | Target persona types, ICP signals, account discovery |

### Cache TTL

The atom-rag service maintains an in-memory warm cache with ~24-hour TTL. A warm hit returns in ~700ms (primarily network latency from Vercel → Linode). After a Linode server restart or 24+ hours of inactivity, the first call triggers a fresh retrieval from Pinecone (~1–2s for ANN lookup).

### Cold start ingest sequence

When `/company/load` is called for a new entity:
1. Perplexity Sonar researches the company/product across the web (~10s).
2. GPT-4 synthesizes the research into structured module-tagged chunks (~5s).
3. Chunks are embedded and upserted to Pinecone (~5s).
4. Total: ~20s. Subsequent retrieval: warm in-memory cache.

### Failure mode

All ATOM API routes that call RAG use `AbortSignal.timeout(2500)` (or 1500ms for the objection secondary call). If atom-rag doesn't respond within that window — e.g., Linode cold start, network partition, Caddy restart — the caller:
1. Returns `""` from `fetchRagBrief()` / `getRAGContext()`.
2. Falls back to the generic brief embedded directly in `call.ts:214–218`.
3. Fires `backgroundIngest()` so the next call for this product will be warm.

The `api/rag.ts` proxy uses a 120-second timeout (for long ingest operations); the direct RAG calls from other modules use 6-second timeouts.

---

## 7. The 17 API routes

All routes are TypeScript Vercel serverless functions in `/api/**/*.ts`. Vercel `maxDuration` is set to 60 seconds for all API functions (`vercel.json`). Routes are counted post-Pro upgrade (was 12, now 17 with the addition of aletheia, product-intel, and targets routes).

| # | Method | Route | Input shape | Output shape | Services | Key env vars | p50 / p95 latency | Common errors |
|---|--------|-------|-------------|--------------|----------|-------------|-------------------|---------------|
| 1 | `POST` | `/api/atom-leadgen/call` | `{ phoneNumber, firstName, companyName, productName }` | `{ success, callSid, sessionId, briefSource, briefLength }` | Twilio, Hume, atom-rag | `TWILIO_ACCOUNT_SID`, `TWILIO_PHONE_NUMBER`, `HUME_API_KEY`, `RAG_URL` | 900ms / 3s | Missing `HUME_API_KEY` → 500; Twilio auth fail → 401; RAG timeout → falls back gracefully |
| 2 | `GET` | `/api/atom-leadgen/chat-events` | `?sessionId=atom_...` | `{ transcript, metrics, warroom, status }` | Hume EVI API, OpenAI | `HUME_API_KEY`, `OPENAI_API_KEY` | 600ms / 2s | `status: "pending"` for first 5–15s (normal); missing `chatId` → scan Hume list again |
| 3 | `GET` | `/api/atom-leadgen/hume-token` | — | `{ accessToken, type }` | Hume OAuth | `HUME_API_KEY`, `HUME_SECRET_KEY` | 200ms / 500ms | `HUME_SECRET_KEY` absent → returns raw API key (degraded) |
| 4 | `POST` | `/api/atom-leadgen/simulate` | `{ sessionId?, scenario }` | Mock chat-events payload | None (static) | None | <10ms / 10ms | Dev/demo only — do not use in production |
| 5 | `POST` | `/api/pitch/generate` | `{ productSlug, pitchType, industry, persona, company, tone, customContext }` | `{ pitch, bullets, subject, cta, ... }` | OpenAI, atom-rag | `OPENAI_API_KEY`, `RAG_URL` | 2s / 6s | `pitchType` enum mismatch → returns partial pitch |
| 6 | `POST` | `/api/objection/handle` | `{ productSlug, objection, context, company }` | `{ rebuttal, bridgeLine, followUp, emotionalAnchor }` | OpenAI, atom-rag | `OPENAI_API_KEY`, `RAG_URL` | 2s / 5s | RAG 404 → generic rebuttal with no product context |
| 7 | `POST` | `/api/market-intent/analyze` | `{ productSlug, industry, region, analysisType, customQuery, timeHorizon }` | `{ insights[], trends[], signals[], opportunities[] }` | OpenAI, atom-rag | `OPENAI_API_KEY`, `RAG_URL` | 3s / 8s | Long timeHorizon requests may approach 60s Vercel limit |
| 8 | `POST` | `/api/campaign/analyze` | `{ contactName, title, companyName, buyingSignals, techStack, matchedProduct, brief }` | `{ subject, body, followUp }` | OpenAI, SambaNova | `OPENAI_API_KEY`, `SAMBANOVA_API_KEY` | 2s / 5s | SambaNova fallback if OpenAI rate-limited |
| 9 | `POST` | `/api/prospects/scan` | `{ industry, geo, employeeSize, revenueRange, productFocus, jobTitles, techStack }` | `{ prospects[], enriched[], techStackMatches[] }` | Apollo, PDL, TheirStack, BuiltWith, Perplexity Sonar | `APOLLO_API_KEY`, `PDL_API_KEY`, `THEIRSTACK_API_KEY`, `BUILTWITH_API_KEY`, `PERPLEXITY_API_KEY` | 5s / 20s | Apollo 429 on burst scan; partial results returned if any source times out |
| 10 | `POST` | `/api/prospects/enrich` | `{ companyName, domain, email }` | `{ contacts[], companyData }` | Apollo, Hunter, PDL | `APOLLO_API_KEY`, `HUNTER_API_KEY`, `PDL_API_KEY` | 3s / 8s | Hunter domain search returns 0 results for no-email-found companies |
| 11 | `POST` | `/api/warbook/research` | `{ company, domain, product }` | `{ summary, decisionMakers[], techStack, signals, fundingHistory, competitors }` | Perplexity Sonar Pro, OpenAI, SambaNova, Apollo, PDL | `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `SAMBANOVA_API_KEY`, `APOLLO_API_KEY`, `PDL_API_KEY` | 8s / 25s | Sonar Pro 30s timeout for deeply researched companies |
| 12 | `GET/POST` | `/api/rag` | `?action=load\|status\|context\|query` or body with `action` | Proxied atom-rag response | atom-rag microservice | `RAG_URL` | 700ms (warm) / 20s (cold ingest) | atom-rag down → 502; cold start → 20s ingest delay |
| 13 | `GET` | `/api/products` | `?slug=<slug>` (optional) | Product object or array of all 6 | None (static) | None | <5ms / 10ms | `slug` not found → 404 |
| 14 | `POST` | `/api/aletheia/analyze-text` | `{ text, channel, threadContext, dealContext }` | Von Clausewitz JSON (same schema as warroom in chat-events) | OpenAI | `OPENAI_API_KEY` | 2s / 4s | `text.length < 10` → 400 |
| 15 | `POST` | `/api/product-intel/research` | `{ product }` | `{ features, competitors, useCases, pricing, objections }` | OpenAI | `OPENAI_API_KEY` | 3s / 6s | Short product name fails website inference |
| 16 | `POST` | `/api/targets/daily-brief` | `{ company, product }` | `{ summary, overnightTriggers, whyNow, pitchAngle, signals[], dailySignalScore }` | Perplexity Sonar | `PERPLEXITY_API_KEY` | 5s / 12s | Sonar returns no signals for obscure company → low score with generic summary |
| 17 | `POST` | `/api/targets/generate-package` | `{ company, website, industry, product }` | `{ marketIntent, pitch, objections, warbook, prospects, sources[] }` | Perplexity Sonar (5x parallel) | `PERPLEXITY_API_KEY` | 10s / 30s | One of 5 parallel Sonar calls may timeout; partial package returned |

**Cron job** (not an HTTP route but a function): `GET /api/cron/daily-briefs` — scheduled at `0 10 * * *` UTC (10:00 AM UTC). Generates morning target briefs for tracked accounts. Triggered by Vercel Cron via `vercel.json`.

---

## 8. Environment variables

| Variable | Powers | Used in (file) | Criticality | How to rotate |
|----------|--------|----------------|-------------|---------------|
| `TWILIO_ACCOUNT_SID` | Identifies Twilio account for all REST calls | `call.ts:42` | **Hard fail** — calls cannot be placed | Vercel → Settings → Env → update, redeploy |
| `TWILIO_AUTH_TOKEN` | Twilio fallback auth (used when API key not set) | `call.ts:45` | Hard fail (if no API key pair) | Rotate in Twilio console; update Vercel env |
| `TWILIO_API_KEY_SID` | Twilio API key auth (preferred over auth token) | `call.ts:43` | Hard fail (if no auth token) | Rotate in Twilio console → API Keys |
| `TWILIO_API_KEY_SECRET` | Twilio API key secret | `call.ts:44` | Hard fail (if using API key auth) | Rotate with SID together |
| `TWILIO_PHONE_NUMBER` | Outbound caller ID (E.164 format) | `call.ts:46` | Hard fail — calls have no `From` | Update in Vercel env; buy number in Twilio console |
| `HUME_API_KEY` | Authenticates all Hume EVI and chat history API calls | `call.ts:48`, `chat-events.ts:21`, `hume-token.ts` | **Hard fail** — voice pipeline dead | Rotate in Hume dashboard → API Keys; update Vercel env |
| `HUME_SECRET_KEY` | Enables OAuth2 client-credentials for short-lived tokens | `hume-token.ts` | Degrades gracefully — falls back to raw API key | Rotate in Hume dashboard |
| `OPENAI_API_KEY` | Claude Sonnet reasoning + GPT-4o-mini War Room + all non-Sonar LLM calls | `chat-events.ts:22`, `pitch/generate.ts`, `objection/handle.ts`, `market-intent/analyze.ts`, `campaign/analyze.ts`, `aletheia/analyze-text.ts`, `rag.ts`, `product-intel/research.ts` | Hard fail for most modules | OpenAI console → API keys; update Vercel |
| `PERPLEXITY_API_KEY` | Sonar-pro research (WarBook, Targets, Prospect Scan) | `warbook/research.ts:7`, `prospects/scan.ts:8`, `targets/daily-brief.ts:12`, `targets/generate-package.ts:13` | Hard fail for research modules | Perplexity dashboard → API Keys |
| `APOLLO_API_KEY` | Contact + org enrichment and people search | `prospects/scan.ts:3`, `prospects/enrich.ts:4`, `warbook/research.ts:10` | Degrades gracefully — returns empty contacts | Apollo console → Settings → API |
| `HUNTER_API_KEY` | Email verification and domain email search | `prospects/enrich.ts:3` | Degrades gracefully | Hunter.io → API |
| `PDL_API_KEY` | People Data Labs enrichment (person + company endpoints) | `prospects/scan.ts:5`, `prospects/enrich.ts:5`, `warbook/research.ts:11` | Degrades gracefully | PDL console → API Keys |
| `THEIRSTACK_API_KEY` | Tech stack signal matching for prospects | `prospects/scan.ts:6` | Optional (skipped if absent) | TheirStack dashboard |
| `BUILTWITH_API_KEY` | BuiltWith technology profiling | `prospects/scan.ts:7` | Optional (skipped if absent) | BuiltWith account |
| `SAMBANOVA_API_KEY` | Fast open-model inference fallback for campaign + warbook | `campaign/analyze.ts:11`, `warbook/research.ts:9` | Degrades gracefully — falls back to OpenAI | SambaNova console |
| `RAG_URL` | atom-rag microservice base URL | `call.ts:51`, `pitch/generate.ts`, `objection/handle.ts`, `market-intent/analyze.ts`, `rag.ts` | Degrades gracefully — falls back to generic briefs | Update to new Linode IP/domain; no reauth needed |

**Note:** `HUME_CONFIG_ID` and `HUME_VOICE_ID` are hardcoded in `call.ts:54–55` (not env vars) because they are production assets managed at the Hume dashboard level and are not per-tenant at this stage. For multi-tenant deployments, these should move to the tenants table (Section 9).

---

## 9. Multi-tenant architecture (white-label)

The current architecture (two separate Vercel projects, clone-per-tenant) is described in [WHITE-LABEL-PLAYBOOK.md](../WHITE-LABEL-PLAYBOOK.md). The target architecture — for when the tenant count exceeds 5–10 — is a single Vercel deployment with subdomain-based tenant resolution and Supabase as the control plane.

### Single deployment

One Vercel project at `atom-dominator-pro.vercel.app` serves all tenants. Tenant identity is resolved from the subdomain: `acme.atomdominator.com` → slug `acme` → tenant row lookup.

### Subdomain detection

Client-side (in `App.tsx` or `AppLayout.tsx`), on first render:

```typescript
const slug = window.location.hostname.split('.')[0]; // e.g., "acme"
// If slug === "atom-dominator-pro" or "localhost", use default ATOM branding
// Otherwise, fetch /api/tenant?slug=<slug>
```

### Supabase tenants table

```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,          -- subdomain key
  name          TEXT NOT NULL,                 -- display name
  logo_url      TEXT,                          -- hosted logo asset
  primary_hex   TEXT NOT NULL DEFAULT '#ef4444',
  accent_hex    TEXT NOT NULL DEFAULT '#a2a3e9',
  plan          TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  stripe_customer_id   TEXT,
  twilio_subaccount_sid TEXT,                  -- optional: per-tenant Twilio
  hume_config_id        TEXT,                  -- optional: per-tenant EVI voice
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### Tenant API (TBD / not yet implemented)

`GET /api/tenant?slug=<slug>` → returns `{ name, logo_url, primary_hex, accent_hex, plan }`. Called client-side at paint time. Response is cached in `localStorage` with a 1-hour TTL.

### Role model

| Role | Permissions |
|------|-------------|
| `admin` | Full access: all modules, tenant settings, billing, user management |
| `manager` | Campaigns + reports + billing view; cannot manage users or tenant settings |
| `rep` | Place calls, view own call history and activity |
| `viewer` | Read-only access to dashboards and reports |

### Tenant onboarding flow

`/admin/tenants` → "+ New Tenant" form:
1. Enter: tenant name, URL slug, logo URL, primary hex, accent hex, plan, admin email.
2. API call inserts row into `tenants` table.
3. DNS: add CNAME `<slug>.atomdominator.com → atom-dominator-pro.vercel.app`.
4. Client fetches branding on first load. Branded site is live in ~30 seconds.

### Per-seat billing

Stripe integration via existing `/api/billing` routes (from prior platinum sprint — not detailed here). Each tenant maps to a `stripe_customer_id`. Per-seat subscription metered via Stripe's usage API. Plan limits enforced server-side per `tenant.plan`.

---

## 10. White-label rebrand script

`scripts/tenant-rebrand-template.py` is the per-customer-deploy automation for the **enterprise tier** and **clone-per-tenant model** (currently the live production pattern per WHITE-LABEL-PLAYBOOK.md). It performs bulk string replacement across all `.tsx` and `.ts` files in `client/src/pages/` and `client/src/components/`.

### Inputs

Edit the `REPLACEMENTS` list at the top of the script. Each entry is a `(old_string, new_string)` tuple. The current script contains 50+ replacement pairs covering:

- Module name strings (`"ATOM War Room"` → `"Partner War Room"`)
- Brand color hex codes (crimson `#ef4444` → Intelisys red `#F55965`)
- Font families (`'Plus Jakarta Sans'` → `'Inter'`)
- Voice agent names (`"ADAM from Antimatter"` → `"Alex from Intelisys"`)
- Footer copyright (`"ATOM · Nirmata Holdings"` → `"Intelisys · A ScanSource Company"`)
- Vendor name masking (`"Apollo Pro"` → `"Channel Database"`)

Set `BASE = "/home/user/workspace/<tenant>-dominator/client/src"` to target the cloned workspace.

### Outputs

The script walks all `.tsx/.ts` files in `pages/` and `components/`, applies replacements in order, overwrites files in place, and prints a summary of modified files and total replacement count. It does **not** modify `api/` files, so API credentials and backend logic are unaffected.

### When to use this vs. the Supabase tenant model

Use the rebrand script for: enterprise deals (>$50K ACV) where the customer wants a dedicated deployment, isolated GitHub repo, custom domain, and separate Vercel environment. Use the Supabase tenant model (Section 9) for: self-serve SaaS customers who onboard via a signup form and share the multi-tenant deployment.

---

## 11. The 8 modules (user manual)

### 11.1 ATOM War Room (Von Clausewitz Engine)

**Route:** `/war-room` | **API:** `POST /api/aletheia/analyze-text`

**Purpose:** Real-time deal intelligence during calls or for async analysis of email/LinkedIn/text messages. Named after Carl von Clausewitz's principle: "In war, everything is simple, but the simplest things are difficult." In sales, what the prospect says and what they mean are rarely the same thing.

**Inputs:** Any prospect communication — paste an email, CRM note, or call transcript excerpt. Optional: `threadContext[]` (prior messages), `dealContext` (deal stage, product, known blockers).

**Expected output:** Structured JSON decoded to UI panels showing:
- **TRUTH Score™ (0–100):** Behavioral conviction index — how committed the language actually is.
- **Deal Risk:** HEALTHY / CAUTION / AT_RISK / DEAD.
- **Urgency:** NONE / LOW / MEDIUM / HIGH / CRITICAL.
- **Deception radar:** 6 sub-scores (hedge %, evasion %, stall probability, authority deflection, timeline vagueness, over-enthusiasm).
- **Buyer intent state:** Enum covering `exploring | serious | stalling | using_as_leverage | ghosting | genuine_blocker | ready_to_buy | negotiating`.
- **Ghost probability (0–100):** Likelihood the prospect goes dark.
- **Competitive radar:** Whether a competitor was mentioned and risk level.
- **Suggested reply:** A 5–8 word burst ADAM (or the rep) can say next.

**Live call mode:** During an active Lead Gen call, the War Room panel populates automatically via the `warroom` field in `chat-events.ts` responses — one Von Clausewitz analysis per new prospect utterance. No manual input needed.

**Pricing model:** Included with Pro and Enterprise plans. Each analysis fires one GPT-4o-mini call (~$0.001 in compute). Not independently metered.

**Integration points:** `OPENAI_API_KEY`. No RAG dependency.

---

### 11.2 ATOM Pitch (Pitch Generator)

**Route:** `/pitch` | **API:** `POST /api/pitch/generate`

**Purpose:** Generate tailored sales pitches in five formats for any of the six Antimatter products. Claude Sonnet is the reasoning engine; the atom-rag `pitch` module provides product-specific context.

**Inputs:** `productSlug` (required), `pitchType` (`elevator | email | cold-call | demo-intro | executive-brief`), `industry`, `persona` (job title/role), `company` (target company name), `tone` (aggressive / consultative / provocative).

**Expected output:** Structured JSON: `{ hook, body, proof, cta, subject (for email), bullets[] }`. The frontend renders these into a formatted pitch card with copy buttons.

**RAG integration:** Fetches both `pitch` and (for the target company) a company-specific `pitch` module context in parallel. If the company is not yet indexed, the pitch relies on the static product knowledge embedded in the system prompt.

**Pricing model:** Per-seat (included in Pro plan at $499/mo with 1000 call credits). Pitch generation does not consume call credits.

**Integration points:** `OPENAI_API_KEY`, `RAG_URL`.

---

### 11.3 ATOM Objection Handler

**Route:** `/objections` | **API:** `POST /api/objection/handle`

**Purpose:** On-demand objection rebuttal. Rep enters the exact words the prospect said; ATOM returns a structured rebuttal with emotional bridge, follow-up probe, and closing move.

**Inputs:** `productSlug`, `objection` (free text), `context` (optional — deal stage, prior conversation), `company` (optional — for RAG context).

**Expected output:** `{ rebuttal, bridgeLine, followUp, emotionalAnchor, category }`. The `category` classifies the objection type (price / competition / timing / authority / need / trust) per the schema in `shared/schema.ts`.

**RAG integration:** Fetches the `objections` module for both the product and (if provided) the target company, enabling product-specific rebuttal strategies (e.g., HIPAA compliance rebuttals for Clinix Agent vs. FinOps rebuttals for ATOM Enterprise AI).

**Pricing model:** Per-seat. No separate metering.

**Integration points:** `OPENAI_API_KEY`, `RAG_URL`.

---

### 11.4 ATOM Market Intent

**Route:** `/market` | **API:** `POST /api/market-intent/analyze`

**Purpose:** Generate live market intelligence reports — competitor moves, regulatory changes, funding signals, technology adoption curves — relevant to a specific product and territory. Powered by OpenAI with RAG context augmentation.

**Inputs:** `productSlug`, `industry`, `region`, `analysisType` (competitive / regulatory / funding / technology / market-shift), `timeHorizon` (30 / 60 / 90 days), `customQuery` (optional).

**Expected output:** `{ insights[], trends[], signals[], opportunities[], threatLevel }`. Each insight includes `title`, `summary`, `impactLevel` (high / medium / low), `source`, `category`.

**Integration points:** `OPENAI_API_KEY`, `RAG_URL` (market module).

**Pricing model:** Per-seat.

---

### 11.5 ATOM Prospect

**Route:** `/prospects` | **API:** `POST /api/prospects/scan`, `POST /api/prospects/enrich`

**Purpose:** Automated prospect discovery and contact enrichment. The scan endpoint finds companies matching the ICP; the enrich endpoint digs into a specific company to surface decision-maker contacts with verified emails and mobile numbers.

**Inputs (scan):** `{ industry, geo, employeeSize, revenueRange, productFocus, jobTitles[], techStack, keywords }`.

**Inputs (enrich):** `{ companyName, domain, email }`.

**Expected output (scan):** Array of `EnrichedContact` objects plus company firmographics — name, domain, employee count, revenue range, industry, description, tech stack, LinkedIn URL.

**Data sources:** Apollo.io (org enrichment + people search via `mixed_people/api_search`), PDL (Person Data Labs — person match and company enrich), Hunter.io (email verification and domain search), TheirStack (technology signal matching — what software the company uses), BuiltWith (front-end and infrastructure technology profiling), Perplexity Sonar (company research augmentation for ICP signal scoring).

**Pricing model:** Per-seat. API costs for enrichment at scale are significant — Apollo, PDL, TheirStack, and BuiltWith all charge per lookup or per credit. These costs are COGS, not separately metered from the tenant.

**Integration points:** `APOLLO_API_KEY`, `HUNTER_API_KEY`, `PDL_API_KEY`, `THEIRSTACK_API_KEY`, `BUILTWITH_API_KEY`, `PERPLEXITY_API_KEY`.

---

### 11.6 ATOM Lead Gen (Live Call Dialer)

**Route:** `/atom-leadgen` | **APIs:** `POST /api/atom-leadgen/call`, `GET /api/atom-leadgen/chat-events`, `GET /api/atom-leadgen/hume-token`

**Purpose:** The flagship module. Places real outbound Twilio calls where ADAM — a Steve Jobs tenor voiced AI agent — conducts live sales conversations. The rep watches the War Room panels update in real time and can intervene with a suggested reply from the Von Clausewitz engine.

**Inputs:** `{ phoneNumber, firstName, companyName, productName }`. Optional: `contactName`, `productSlug`.

**Expected output at call initiation:** `{ callSid, sessionId, briefSource, briefLength, message }`. The `sessionId` is the polling key for the rest of the call.

**Expected output per poll:** `{ transcript, metrics: { sentiment, buyerIntent, emotions, stage }, warroom, status }`.

**Voice ground truth:** `docs/ATOM_VOICE_REFERENCE.md`. ADAM speaks at 210–220 WPM, uses the Jobs Tenor voice, opens with pickup detection, never says "I am an AI," and stops talking within 200ms of interruption.

**Pricing model:** Call credits consumed per call placed. Pro plan: 1000 calls/mo at $499/mo flat. Enterprise: custom metered pricing. Each call also incurs direct COGS (see Section 13).

**Integration points:** `TWILIO_ACCOUNT_SID`, `TWILIO_PHONE_NUMBER`, `HUME_API_KEY`, `OPENAI_API_KEY`, `RAG_URL`.

---

### 11.7 ATOM Campaign

**Route:** `/atom-campaign` | **API:** `POST /api/campaign/analyze`

**Purpose:** Personalized cold email and follow-up sequence generator. Takes enrichment data from ATOM Prospect and produces ready-to-send email drafts with subject line, opening, body, and follow-up sequence — calibrated to the prospect's buying signals, tech stack, and recent news.

**Inputs:** `{ contactName, title, companyName, domain, industry, buyingSignals[], painPoints[], techStack[], recentNews[], matchedProduct, brief }`.

**Expected output:** `{ subject, body, followUp1, followUp2 }`. Body uses the same concise-opener formula as the voice script: specific trigger event → pain assumption → concrete value claim → low-friction CTA.

**Engine:** Primary: OpenAI GPT-4o-mini. Fallback: SambaNova (fast open-model inference) if OpenAI rate limits. The `SAMBANOVA_API_KEY` env var gates this fallback.

**Cron integration:** `api/cron/daily-briefs.ts` runs at 10:00 UTC to generate morning target briefs (`api/targets/daily-brief.ts`) for tracked accounts. These briefs feed the Campaign module's "today's signal" context.

**Pricing model:** Per-seat.

**Integration points:** `OPENAI_API_KEY`, `SAMBANOVA_API_KEY`.

---

### 11.8 ATOM WarBook (Deep Company Intelligence)

**Route:** `/company-intelligence` | **API:** `POST /api/warbook/research`

**Purpose:** Full-depth dossier on a target company — think of it as the CIA station report before an important meeting. Surfaces decision-makers, tech stack, funding history, competitive threats, recent signals, and recommended pitch angle for each Antimatter product.

**Inputs:** `{ company, domain, product }`.

**Expected output:** `{ summary, decisionMakers[], techStack[], signals[], fundingHistory, competitors[], pitchAngle, sources[] }`.

**Engine:** Five-source parallel intelligence gathering — Perplexity Sonar Pro (narrative research + citations), OpenAI GPT-4 (synthesis), SambaNova (fast reasoning fallback), Apollo (decision-maker contacts), PDL (person enrichment). The WarBook is the only module that uses all five simultaneously (`warbook/research.ts:7–11`).

**Targets system:** `api/targets/generate-package.ts` fires five parallel Sonar calls — one per module (market intent, pitch, objections, warbook, prospects) — and assembles a full Intel Package. This is the "high-value target" (HVT) deep-dive path, used for named accounts in strategic campaigns.

**Pricing model:** Per-seat. Heavy Sonar Pro usage means this is the highest-COGS module per use. Recommended for named account campaigns, not bulk discovery.

**Integration points:** `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `SAMBANOVA_API_KEY`, `APOLLO_API_KEY`, `PDL_API_KEY`.

---

## 12. Operations runbook

### Deploying

The production deployment is the `master` branch of the GitHub repo linked to the Vercel project `atom-dominator-pro`. Every push to `master` triggers an automatic deployment. For a forced prod deploy:

```bash
npx vercel deploy --prod --yes --force
```

No special build flags needed; `vercel.json` handles function configuration. The Vite client build runs as part of the Vercel build pipeline.

### Monitoring

| Surface | What to watch |
|---------|---------------|
| Vercel Function Logs | `api/atom-leadgen/call` errors, RAG timeout counts, Twilio 4xx responses |
| Hume EVI Dashboard | Active sessions, call durations, EVI error rates, custom_session_id lookups |
| Twilio Console | Outbound call success rate, failed calls, STIR/SHAKEN attestation status, DID health |
| Linode LISH Console | atom-rag service health: `curl https://atom-rag.45-79-202-76.sslip.io/health` |
| Vercel Cron | Daily-briefs job status at `0 10 * * *` UTC |

### On-call procedures

**atom-rag down / 502 from RAG:**
1. SSH to Linode node (or open LISH console at console.linode.com).
2. `systemctl status atom-rag` (or Docker container: `docker ps`, `docker logs atom-rag`).
3. If crashed: `systemctl restart atom-rag` or `docker restart atom-rag`.
4. Verify: `curl https://atom-rag.45-79-202-76.sslip.io/health`.
5. All ATOM modules fall back gracefully during outage — no hard failure, but calls use generic briefs.

**HUME_API_KEY rotation:**
1. Generate new key in Hume dashboard → API Keys.
2. Update in Vercel → Settings → Environment Variables → `HUME_API_KEY`.
3. Trigger redeploy (Vercel picks up new env on next function invocation; no full redeploy required but recommended for certainty).
4. Do **not** delete the old key until you confirm new calls are flowing (check Hume dashboard for active sessions using the new key).

**Twilio number swap:**
1. Buy replacement number in Twilio Console.
2. Update `TWILIO_PHONE_NUMBER` in Vercel env vars.
3. Redeploy (or wait for next cold start).
4. Verify: place a test call from Lead Gen module to a known number.

### Common issues + fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| War Room shows all zeros | Call just started; Hume hasn't emitted emotion data yet | Wait 10–15s; data flows after first USER_MESSAGE |
| `status: "pending"` forever | `custom_session_id` not matching in Hume chat list | Verify `sessionId` in URL matches the one returned by `/api/atom-leadgen/call`. Check Hume dashboard for recent chat objects |
| ADAM speaks into voicemail | `pickup_gate` not set on EVI config | Confirm `config_id` is `3c6f8a5b-e6f3-4732-9570-36a22f38e147`. Check Hume config for `pickup_gate: true` |
| RAG always cold (generic brief) | atom-rag service down or `RAG_URL` misconfigured | `curl $RAG_URL/health`; check Linode LISH; verify `RAG_URL` env var |
| Calls placed but no audio | Twilio SIP → Hume WebSocket failure | Check Hume EVI dashboard for WebSocket errors on that session; verify `HUME_API_KEY` is valid |
| `Twilio calls.create HTTP 401` | Wrong `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Verify credentials in Twilio console; check for stray `\n` in Vercel env (the `clean()` function in `call.ts:39` strips these) |
| OpenAI 429 on War Room | Rate limit hit during high call volume | War Room degrades gracefully (`warroom: null`) — add OpenAI Tier upgrade or route to GPT-4o-mini fallback |
| Hume `X-Hume-Api-Key` 403 | Key rotated without updating Vercel env | Update `HUME_API_KEY` in Vercel; redeploy |

---

## 13. Cost model

### Per-call cost breakdown (typical 4-minute outbound call)

| Component | Rate | 4-min cost | Notes |
|-----------|------|------------|-------|
| Twilio outbound minute | $0.0085/min ([Twilio Voice pricing](https://www.twilio.com/en-us/voice/pricing)) | $0.034 | Per-minute billing |
| Hume EVI minute | ~$0.10/min | $0.40 | Includes STT + LLM routing + Octave TTS |
| Claude Sonnet tokens | ~$0.05/call avg | $0.05 | ~3K input + ~500 output tokens per call |
| GPT-4o-mini (War Room) | ~$0.01/call | $0.01 | ~10 analyses × ~$0.001 each |
| RAG warm hit | ~$0 | $0.00 | Pinecone reads included in plan |
| RAG cold ingest (one-time) | ~$0.30 | amortized ~$0.001 | Per-product, not per-call |
| **Total per call** | | **~$0.494** | ~$0.50 rounded for margin math |

**At Pro plan pricing ($499/mo, 1000 call credits):**
- Revenue per call: $0.499
- COGS per call: ~$0.494
- Gross margin: **~1%** at exactly 1000 calls/mo

**Key insight:** The Hume EVI minute cost dominates (81% of COGS). Twilio is secondary (7%). At Pro plan pricing, the unit economics are extremely tight at full utilization. The pricing model relies on most tenants not burning all 1000 calls, plus upsell to per-seat enrichment and enterprise plans.

### Paths to better margin (from [VIBRANIUM_RESEARCH.md](./VIBRANIUM_RESEARCH.md))

| Lever | Current | Vibranium | Savings/call |
|-------|---------|-----------|--------------|
| Telephony | Twilio $0.0085/min | [Telnyx](https://telnyx.com/resources/telnyx-vs-twilio-which-voice-api-is-better) $0.007/min | ~$0.006 (~18%) |
| TTS layer | Octave 1 | [Octave 2](https://www.hume.ai/blog/octave-2-launch) (50% cheaper) | ~$0.20 per call |
| LLM path | Claude Sonnet | Claude Sonnet unchanged — already optimal for voice | $0 |
| Embeddings | OpenAI text-embedding-3-large ($0.13/1M) | [pplx-embed-v1-0.6b](https://docs.perplexity.ai/docs/embeddings/quickstart) ($0.004/1M) | ~$0.03 on cold ingest |
| Vector DB | Pinecone ~$41/mo per 1M ops | [Turbopuffer](https://turbopuffer.com) ~$9.36/mo per 1M ops | ~77% reduction on DB |

Upgrading Octave 1 → Octave 2 alone cuts per-call COGS by ~40%, improving gross margin from ~1% to roughly 30% at 1000 calls/mo. This is a Sprint 1 S-effort item per the Vibranium roadmap.

---

## 14. Roadmap to Vibranium

The following sprint plan is pulled verbatim from [VIBRANIUM_RESEARCH.md Section 7: Priority Sequence](./VIBRANIUM_RESEARCH.md#priority-sequence-recommendation), followed by an execution checklist for each sprint.

### Sprint 1 — S items (hours to days each; highest ROI/effort ratio)

Per VIBRANIUM_RESEARCH.md:
> 1. Upgrade Hume Octave → Octave 2 (same API, 40% faster, 50% cheaper)
> 2. Add pplx-embed-v1 as embedding model in atom-rag (32× cost reduction, better quality)
> 3. Add Arize Phoenix + Langfuse observability instrumentation
> 4. Implement Sonar best practices (domain filtering, citation stripping, TTL caching)
> 5. Upgrade LLM routing to add GPT-5.5 for enrichment pipeline

**Execution checklist:**
- [ ] Hume dashboard: update EVI config `3c6f8a5b` to use Octave 2 TTS endpoint. No code change needed — purely config.
- [ ] atom-rag: swap embedding model from `text-embedding-3-large` to `pplx-embed-v1-4b` in the ingest pipeline. Set `PERPLEXITY_API_KEY` on the Linode service.
- [ ] Add [Arize Phoenix](https://phoenix.arize.com) as a self-hosted Docker container on Linode. Instrument `call.ts` and `chat-events.ts` with OTel spans.
- [ ] Add [Langfuse](https://langfuse.com) for prompt version tracking on the EVI system prompt and GPT-4o-mini War Room prompt.
- [ ] In `warbook/research.ts` and `targets/generate-package.ts`: add `search_domain` filter on Sonar calls; strip `[1][2]` citation markers before passing content to LLM synthesis; add 4-hour TTL cache by `company + query_hash`.
- [ ] Add `OPENAI_GPT55_MODEL=gpt-5.5` env var and route WarBook + Target Package synthesis to GPT-5.5 for higher-quality dossiers.

### Sprint 2 — M items (1–3 weeks each; core infrastructure)

Per VIBRANIUM_RESEARCH.md:
> 6. Migrate telephony: Twilio → Telnyx (TeXML drop-in)
> 7. Refactor atom-rag vector store: Pinecone → Turbopuffer
> 8. Integrate Perplexity Agent API for pre-call dossier generation
> 9. Wrap Apollo/Hunter/PDL/BuiltWith as MCP servers
> 10. Add Trestle + Numeracle compliance pipeline

**Execution checklist:**
- [ ] Telnyx: port existing Twilio DID, rewrite `twilioCreateCall()` in `call.ts` to use [TeXML](https://developers.telnyx.com/docs/voice/programmable-voice/texml) (TwiML-compatible). Update `TWILIO_ACCOUNT_SID`, `TWILIO_PHONE_NUMBER` → Telnyx equivalents. Expected: `<1s` AI voice latency vs. current `>3s`.
- [ ] atom-rag: migrate Pinecone upsert/query to [Turbopuffer API](https://turbopuffer.com). Update ingest and retrieval functions. Validate recall quality on existing product corpus. Cost drops from ~$41 → ~$9/month.
- [ ] Add `POST /api/targets/dossier` using [Perplexity Agent API](https://docs.perplexity.ai/docs/agent-api/quickstart) for async multi-step pre-call research. Fire asynchronously at call-dial time; results available by call connect.
- [ ] Create MCP server wrappers for Apollo, Hunter, PDL, BuiltWith. Register as tools in Claude / GPT call chains. Enables all LLMs to use the same enrichment tools without separate integration code.
- [ ] Pre-dial compliance gate in `call.ts`: call [Trestle](https://trestleiq.com) `phone/validate` endpoint to screen for litigator status, DNC registry, and TCPA risk score. Block calls with `riskScore > 80`. Add [Numeracle](https://www.numeracle.com) entity registration for outbound DID.

### Sprint 3 — L items (1–2 months; architectural evolution)

Per VIBRANIUM_RESEARCH.md:
> 11. Provision Nemotron 3 Nano NIM on GPU infrastructure for intel modules
> 12. Refactor voice pipeline with Pipecat orchestration framework
> 13. Evaluate LangGraph adoption for agent orchestration backbone

**Execution checklist:**
- [ ] Provision NVIDIA H200 instance (Linode GPU or AWS `p4d.xlarge`). Deploy [Nemotron 3 Nano NIM](https://research.nvidia.com/labs/nemotron/Nemotron-3/) via Docker: `nvcr.io/nim/nvidia/nemotron-3-nano:latest`. Route `campaign/analyze.ts` and `market-intent/analyze.ts` to self-hosted endpoint. Eliminate SambaNova API dependency for these modules.
- [ ] Prototype [Pipecat](https://www.pipecat.ai) voice orchestration: replace the direct Hume Twilio webhook pattern with a Pipecat pipeline (Twilio transport → Hume STT → Claude → Octave TTS). Enables component-swap without rewiring telephony glue.
- [ ] Evaluate [LangGraph](https://www.langchain.com/langgraph) for multi-call campaign state management: graph nodes per call stage, crash-proof checkpointing, human-in-loop escalation when Von Clausewitz fires `dealRisk: "AT_RISK"`.

### Sprint 4 — Moonshot items

Per VIBRANIUM_RESEARCH.md:
> 14. Evaluate Hume EVI 3 as unified STT+LLM+TTS spine (eliminates 2 roundtrip hops)
> 15. Introduce LangGraph full orchestration with checkpointing

**Execution checklist:**
- [ ] Benchmark [Hume EVI 3](https://www.hume.ai/blog/introducing-evi-3) against current Hume EVI v11 + Claude Sonnet + Octave architecture on: turn latency, emotion detection fidelity, voice naturalness (per ATOM_VOICE_REFERENCE.md benchmarks), and cost per minute.
- [ ] If EVI 3 beats the 3-hop architecture on all four dimensions: migrate `config_id` in `call.ts:54` to an EVI 3 config. Update `ATOM_VOICE_REFERENCE.md` with new benchmarks.
- [ ] Full LangGraph campaign orchestration: calls, follow-up emails, and re-dial logic as a persistent state graph with Supabase-backed checkpoints.

---

## 15. What's NOT here yet (gaps)

The following capabilities are known gaps — intentional deferments, not forgotten items.

| Gap | Status | Priority |
|-----|--------|----------|
| **SOC 2 Type II controls** | Not started. No formal security audit, access controls documentation, or incident response plan. | Required before enterprise (Fortune 500) contracts. |
| **Penetration test** | Not started. | Required for any healthcare or financial services customer. |
| **Per-tenant data isolation in Pinecone** | Currently single namespace in Pinecone — all tenants share the same vector index. Prospect and product data from one tenant could theoretically surface in another's retrieval context. | Critical before multi-tenant SaaS launch. Fix: add `namespace=tenant_slug` to all Pinecone operations in atom-rag. |
| **Real-time call coaching** | The War Room panel shows live intelligence, but there is no push channel to send suggested replies directly to the rep's screen during an active call without the rep manually reading the War Room. | Partial via the existing `suggestedReply` field in warroom output. Full implementation requires a rep-facing overlay UI with sub-500ms push from chat-events polling. |
| **Auto-dialer queue** | Currently one-call-at-a-time. There is no queue, no sequential dialing, no voicemail detection with auto-leave, and no power dialer mode. | Needed for SDR teams running 100+ dials/day. |
| **Voicemail detection + auto-leave message** | `pickup_gate: true` prevents ADAM from speaking into voicemail, but there is no voicemail detection and no pre-recorded VM drop. Calls that hit voicemail are simply abandoned. | Quick win: use Twilio's `AnsweredBy` machine detection on the Twilio webhook to detect VM and trigger a pre-recorded Octave TTS drop. |
| **Multi-language support** | ADAM currently speaks English only (Jobs Tenor voice has no non-English variant in production). [Hume's Octave 2](https://www.hume.ai/blog/octave-2-launch) supports 11 languages. | Needed for international expansion. |
| **CRM integration** | No native Salesforce, HubSpot, or Pipedrive integration. Call outcomes, transcripts, and War Room scores are not automatically written back to CRM. | High-value feature for rep adoption. |
| **Billing enforcement** | Stripe integration routes exist but per-call credit consumption is not enforced in `call.ts` (no check against `tenant.credits_remaining` before placing a call). | Must be implemented before multi-tenant billing goes live. |

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **ADAM** | The AI sales agent persona — the voice and identity that conducts outbound calls. Named in the system prompt as "Adam from {company_name}." Not an acronym. |
| **ATOM** | The platform brand: ATOM Sales Dominator (built by Antimatter AI / Nirmata Holdings). In the context of `ATOM Enterprise AI`, a separate product in the catalog — the enterprise AI deployment framework. |
| **EVI** | Empathic Voice Interface — [Hume AI's](https://www.hume.ai/evi) real-time speech-language model that handles STT, emotional inference, LLM routing, and TTS in an integrated WebSocket session. |
| **PEWC** | Pickup + Emotion + War Room + Context — the four real-time intelligence streams that populate the Lead Gen dashboard during a live call. |
| **RAG** | Retrieval-Augmented Generation — the pattern where a vector database stores pre-researched content (pitch briefs, objection playbooks) that is fetched at inference time to augment the LLM's context. ATOM's RAG is the `atom-rag` microservice on Linode. |
| **TCPA** | Telephone Consumer Protection Act — U.S. federal law governing outbound calling, including requirements for written consent for AI-generated voice calls, DNC registry compliance, and opt-out handling. As of the [FCC's February 2024 ruling](https://dialzara.com/blog/ai-voice-calls-tcpa-rules-compliance-guide), AI-generated voices are explicitly classified as "artificial or prerecorded voices" under TCPA. |
| **TTS** | Text-to-Speech — converts LLM text output into audio. ATOM uses Hume's Octave (Jobs Tenor voice) as the TTS layer, embedded within the EVI WebSocket. |
| **VAD** | Voice Activity Detection — the real-time signal processing that determines when a speaker starts and stops talking. Hume EVI's native VAD triggers interruption handling and pickup detection in ATOM. |
| **MCP** | Model Context Protocol — [Anthropic's universal tool connectivity standard](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation), donated to the Linux Foundation in December 2025. Used in the Vibranium roadmap to wrap Apollo, Hunter, PDL, and BuiltWith as reusable tool servers. |
| **NIM** | NVIDIA Inference Microservice — Docker-deployable self-hosted LLM containers from NVIDIA. Used in Sprint 3 to self-host [Nemotron 3 Nano](https://research.nvidia.com/labs/nemotron/Nemotron-3/) for intel modules at zero API token cost. |
| **Von Clausewitz Engine** | ATOM's behavioral deal analysis system — named after Carl von Clausewitz. Powers the War Room. Analyzes prospect language for deception signals, commitment depth, and ghost probability using GPT-4o-mini. |
| **STIR/SHAKEN** | Secure Telephone Identity Revisited / Signature-based Handling of Asserted information using toKENs — the FCC-mandated framework for authenticating caller ID on outbound calls to prevent spam labeling. Managed by [Numeracle](https://www.numeracle.com) in the Vibranium compliance stack. |
| **HVT** | High-Value Target — a named account designated for the full five-section Intel Package (`api/targets/generate-package.ts`) rather than a standard brief. |
| **sslip.io** | A wildcard DNS service that maps IP addresses to hostnames in the format `<ip>.sslip.io`. Used by atom-rag: `atom-rag.45-79-202-76.sslip.io` resolves to the Linode node at `45.79.202.76`. Caddy handles HTTPS termination. |

---

## 17. References & citations

All sources are cited inline throughout this document. This section consolidates primary technical references for quick lookup.

### Core platform dependencies

- [Twilio Voice API documentation](https://www.twilio.com/docs/voice) — outbound call creation, TwiML, STIR/SHAKEN, Voice Intelligence
- [Hume EVI documentation](https://www.hume.ai/evi) — Empathic Voice Interface, WebSocket protocol, `custom_session_id`, `pickup_gate` configuration
- [Hume Octave 2 launch](https://www.hume.ai/blog/octave-2-launch) — TTS upgrade: 40% faster, 50% cheaper, 11 languages
- [Hume EVI 3 introduction](https://www.hume.ai/blog/introducing-evi-3) — Unified STT+LLM+TTS speech-language model
- [Anthropic Claude Sonnet](https://www.anthropic.com/claude) — primary LLM for voice reasoning and pitch generation
- [Anthropic Claude Opus 4.7](https://www.anthropic.com/claude/opus) — power LLM for enrichment pipeline (Vibranium Sprint 1)
- [Pinecone vector database](https://www.pinecone.io) — vector storage backend for atom-rag
- [Perplexity Sonar API quickstart](https://docs.perplexity.ai/docs/sonar/quickstart) — live web-augmented search for WarBook and Target Intelligence
- [Perplexity Sonar Pro launch](https://www.perplexity.ai/hub/blog/introducing-the-sonar-pro-api) — multi-citation, larger-context search tier

### Vibranium upgrade candidates

- [OpenAI GPT-5.5 model docs](https://developers.openai.com/api/docs/models/gpt-5.5) — 1M context, 38% token efficiency gain for agentic tasks
- [NVIDIA Nemotron 3 research page](https://research.nvidia.com/labs/nemotron/Nemotron-3/) — open-weights self-hostable LLM family
- [Perplexity Embeddings quickstart](https://docs.perplexity.ai/docs/embeddings/quickstart) — pplx-embed-v1 (32× cheaper than OpenAI, domain-specific benchmarks)
- [pplx-embed research post](https://research.perplexity.ai/articles/pplx-embed-state-of-the-art-embedding-models-for-web-scale-retrieval) — embedding quality analysis
- [Perplexity Agent API launch](https://www.perplexity.ai/hub/blog/agent-api-a-managed-runtime-for-agentic-workflows) — managed agentic runtime for pre-call dossier generation
- [Telnyx vs. Twilio comparison](https://telnyx.com/resources/telnyx-vs-twilio-which-voice-api-is-better) — private IP backbone, <1s AI voice latency, 46% cost reduction
- [Turbopuffer](https://turbopuffer.com) — serverless vector DB at 10× lower cost than Pinecone with unlimited namespaces
- [Cartesia Sonic Turbo](https://cartesia.ai/regions/north-america) — 40ms TTFA TTS (fastest available as of May 2026)
- [Pipecat by Daily](https://www.pipecat.ai) — open-source voice pipeline orchestration framework
- [Deepgram Nova-3](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api) — 6.84% median streaming WER, multilingual
- [Anthropic MCP donation to Linux Foundation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) — universal tool connectivity standard
- [Arize Phoenix](https://phoenix.arize.com) — OSS agent observability, OTel-native
- [Langfuse](https://langfuse.com) — prompt versioning and A/B evaluation for sales scripts

### Compliance

- [FCC February 2024 TCPA ruling on AI voices](https://dialzara.com/blog/ai-voice-calls-tcpa-rules-compliance-guide) — AI-generated voices classified as "artificial or prerecorded" under TCPA
- [Trestle TCPA compliance tooling](https://trestleiq.com/tcpa-compliance-for-call-centers-4-essential-tools-and-best-practices/) — pre-dial litigator screening and risk scoring
- [Numeracle caller ID reputation and STIR/SHAKEN](https://www.numeracle.com/press-releases/2025-remediation-case-study) — DID registration and attestation management

### Internal documents

- [VIBRANIUM_RESEARCH.md](./VIBRANIUM_RESEARCH.md) — complete Vibranium tech stack research: GPT-5.5, Nemotron 3, Perplexity embeddings/Agent API/Sonar, Telnyx, Turbopuffer, Pipecat, Deepgram, MCP, LangGraph, and the full migration table with effort ratings.
- [ATOM_VOICE_REFERENCE.md](./ATOM_VOICE_REFERENCE.md) — ground truth voice metrics from `Atom-call-2.m4a`: WPM, pauses, EVI config IDs, voice asset UUIDs, prompt patterns, forbidden phrases.
- [WHITE-LABEL-PLAYBOOK.md](../WHITE-LABEL-PLAYBOOK.md) — 11-step clone-per-tenant spin-up guide and active tenant registry.

---

*ATOM Sales Dominator — Holy Bible v1. Maintained by Nirmata Holdings engineering. Last updated May 2026. All pricing reflects rates at time of publication — verify against current vendor documentation before implementation decisions.*
