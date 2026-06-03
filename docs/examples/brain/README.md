# ATOM Brain — API router

`POST /api/brain` is the single entrypoint every ATOM worker uses for inference.
Workers send `{ "task": "<task>", ... }`; the Brain owns model selection and
routes the request to the Akamai Blackwell **B200** inference plane, **Qdrant**
(vectors), or — for **Vibranium-tier** chat/reason/vision only — a frontier
fallback (Claude Opus / GPT-5).

`GET /api/brain` returns a no-secret health/introspection payload — which planes
are configured, the frontier-eligible tasks, and the **active** model ids and
B200 route table (after any env overrides). Use it to verify a deployment
without invoking a model:

```bash
curl -s "$ATOM_API_BASE/api/brain" | jq
```

Source: [`api/brain.ts`](../../../api/brain.ts) · Typed client:
[`shared/atom-brain-client.ts`](../../../shared/atom-brain-client.ts)

## Routing table

| `task`          | Model                                   | Plane    | Frontier fallback*       |
| --------------- | --------------------------------------- | -------- | ------------------------ |
| `chat`          | Llama 3.3 70B (default) / Qwen 2.5 72B  | B200     | yes                      |
| `reason`        | Llama 3.3 70B (default) / Qwen 2.5 72B  | B200     | yes                      |
| `asr`           | Parakeet TDT 1.1B                       | B200     | no                       |
| `tts`           | Kokoro-82M (default) / F5-TTS / XTTS-v2 | B200     | no                       |
| `embed`         | BGE-M3                                  | B200     | no                       |
| `vector_upsert` | BGE-M3 (for raw text) + Qdrant          | Qdrant   | no                       |
| `vector_search` | BGE-M3 (query embed) + Qdrant           | Qdrant   | no                       |
| `emotion`       | SpeechBrain                             | B200     | no                       |
| `intent`        | SpeechBrain                             | B200     | no                       |
| `tcpa_check`    | DistilBERT (hard-stop classifier)       | B200     | no                       |
| `vision`        | Qwen 2.5-VL 72B                         | B200     | yes                      |
| `pii_redact`    | Presidio + NER                          | B200     | no                       |

\* Frontier fallback (Claude Opus / GPT-5) is gated to `tier: "vibranium"`
and only fires for the eligible tasks above. Lower tiers and non-eligible tasks
can never reach a frontier vendor, regardless of body flags. Set `frontier: true`
to route there directly, or it engages automatically if the B200 plane errors on
a Vibranium request. Choose the vendor with `frontier_vendor: "anthropic" | "openai"`
(chat/reason only — `vision` always uses OpenAI, since the Anthropic vision API
expects a different image content-block shape than the OpenAI `image_url` blocks
workers send).

## Model selectors

- **chat / reason** — `model: "qwen"` → Qwen 2.5 72B; otherwise Llama 3.3 70B.
- **tts** — `voice_model: "f5"` → F5-TTS, `"xtts"` → XTTS-v2; otherwise Kokoro-82M.
- **emotion / intent** — modality-aware: an `audio_base64` input is sent to the B200
  audio classifier; a text-only input (no audio) is sent to the text classifier. The
  response echoes which path ran via `modality: "audio" | "text"`. (Audio wins if both
  are present.)

## Compliance: `tcpa_check` fails closed

`tcpa_check` is a hard-stop guardrail the dialer must enforce **before** connecting a
call. It **fails closed**: if the classifier is unreachable or errors, the endpoint
still returns HTTP `200` with `hardStop: true`, `degraded: true`, and a `detail`
string explaining why — so a caller that swallows a 5xx can never connect a call that
should have been blocked. A missing/invalid `text` is still a `400` validation error
(that's a caller bug, not an outage). On a healthy classifier the response carries
`degraded: false` with the real `label`/`score`.

## Example payloads

One file per task in this folder:

| File | Task |
| ---- | ---- |
| `chat.json` | `chat` (B200 default) |
| `chat_frontier_vibranium.json` | `chat` via frontier (Vibranium) |
| `reason.json` | `reason` |
| `asr.json` | `asr` |
| `tts.json` | `tts` |
| `embed.json` | `embed` |
| `vector_upsert.json` | `vector_upsert` |
| `vector_search.json` | `vector_search` |
| `emotion.json` | `emotion` |
| `intent.json` | `intent` |
| `tcpa_check.json` | `tcpa_check` |
| `vision.json` | `vision` |
| `pii_redact.json` | `pii_redact` |

Try one with curl:

```bash
curl -sX POST "$ATOM_API_BASE/api/brain" \
  -H 'Content-Type: application/json' \
  --data @docs/examples/brain/chat.json
```

## Typed worker SDK

```ts
import { createBrainClient } from "@shared/atom-brain-client";

const brain = createBrainClient({ baseUrl: process.env.ATOM_API_BASE });

// Chat (Llama 3.3 70B on B200)
const { content } = await brain.chat({
  messages: [{ role: "user", content: "Draft a CFO opener." }],
});

// TCPA hard-stop — enforce BEFORE connecting a call. Fails closed: a
// classifier outage returns hardStop:true + degraded:true (not a throw).
const tcpa = await brain.tcpaCheck({ text: transcript });
if (tcpa.hardStop) abortDial();          // blocks even when tcpa.degraded === true

// Vector search (BGE-M3 query embed + Qdrant)
const { results } = await brain.vectorSearch({
  collection: "atom_prospects",
  query: "fintech hiring RevOps",
});
```

The client is dependency-free (global `fetch`) so it runs from Vercel
serverless routes, the React client, and Akamai EdgeWorkers alike.

## Required environment variables

| Variable | Purpose |
| -------- | ------- |
| `AKAMAI_B200_BASE_URL` | **Required.** Base URL of the Akamai Blackwell B200 inference plane / ΔTOM Blackwell Gateway (OpenAI-compatible `/v1/*`). Point it straight at the gateway, e.g. `http://<gateway-host>:8443`. |
| `AKAMAI_B200_API_KEY`  | **Optional.** Bearer key for the B200 plane, sent as `Authorization: Bearer …` **only when set**. The live Blackwell gateway publishes no auth scheme, so leave this unset for unauthenticated gateways; set it (recommended) when the gateway/proxy enforces auth. Do not set a placeholder value — an empty/unset key simply omits the header. |
| `QDRANT_URL`           | Qdrant base URL for vector upsert/search. |
| `QDRANT_API_KEY`       | Qdrant API key (sent as `api-key`; optional for unauthenticated instances). |
| `ANTHROPIC_API_KEY`    | Claude Opus frontier fallback (Vibranium tier). |
| `OPENAI_API_KEY`       | GPT-5 frontier fallback (Vibranium tier). |

Set these in Vercel project env (and `.env` for local `vercel dev`).
`AKAMAI_B200_BASE_URL` is required for self-hosted tasks; `AKAMAI_B200_API_KEY`
is optional and only needed when the gateway enforces auth. The Qdrant vars are
required for vector tasks, and the frontier keys are only needed if
Vibranium-tier frontier routing is enabled. `GET /api/brain` reports `b200: true`
once the base URL is set, and `b200_auth: true` when a bearer key is also configured.

## Optional overrides (routes, models, dims)

Defaults are documented in `api/brain.ts`. The B200 route suffixes and every
model id are env-overridable so a route/model swap needs no code change — the
live values are visible via `GET /api/brain`. Set only the ones you need.

> **Model-id caveat:** the OpenAI frontier default is **`gpt-5`**, not `gpt-5.5`.
> Per `api/atom-leadgen/call.ts` (verified May 2026) the platform whitelists
> `gpt-5` / `gpt-5-mini` / `gpt-4.1` / `gpt-4o`; `gpt-5.5` is not yet accepted.
> Override `BRAIN_FRONTIER_MODEL_OPENAI` if your account whitelists another id.
>
> **Route defaults track the live gateway:** the `AKAMAI_B200_ROUTE_*` defaults
> below match the ΔTOM Blackwell Gateway OpenAPI (v1.0.0), so pointing
> `AKAMAI_B200_BASE_URL` at the gateway needs **no** route overrides. Override a
> suffix only for a plane that exposes a different shape. Note emotion + intent
> share one `emotion-intent` route, while the TCPA hard-stop has its own
> `compliance/stop-classify` route.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `AKAMAI_B200_ROUTE_CHAT` | `chat/completions` | Chat/reason/vision completions route (`/v1/chat/completions`). |
| `AKAMAI_B200_ROUTE_ASR` | `asr` | ASR (Parakeet) route (`/v1/asr`). |
| `AKAMAI_B200_ROUTE_TTS` | `tts` | TTS (Kokoro/F5/XTTS) route (`/v1/tts`). |
| `AKAMAI_B200_ROUTE_EMBED` | `embeddings` | Embeddings (BGE-M3) route (`/v1/embeddings`). |
| `AKAMAI_B200_ROUTE_EMOTION_INTENT` | `emotion-intent` | Emotion/intent (SpeechBrain) route (`/v1/emotion-intent`). |
| `AKAMAI_B200_ROUTE_TCPA` | `compliance/stop-classify` | TCPA hard-stop (DistilBERT) route (`/v1/compliance/stop-classify`). |
| `AKAMAI_B200_ROUTE_REDACT` | `redact` | PII redaction (Presidio) route (`/v1/redact`). |
| `AKAMAI_B200_MODEL_CHAT_LLAMA` | `llama-3.3-70b-instruct` | Default chat/reason model id. |
| `AKAMAI_B200_MODEL_CHAT_QWEN` | `qwen-2.5-72b-instruct` | `model: "qwen"` model id. |
| `AKAMAI_B200_MODEL_ASR` | `parakeet-tdt-1.1b` | ASR model id. |
| `AKAMAI_B200_MODEL_TTS_KOKORO` / `_TTS_F5` / `_TTS_XTTS` | `kokoro-82m` / `f5-tts` / `xtts-v2` | TTS model ids. |
| `AKAMAI_B200_MODEL_EMBED` | `bge-m3` | Embedding model id. |
| `AKAMAI_B200_MODEL_EMOTION` / `_INTENT` | `speechbrain-emotion` / `speechbrain-intent` | SpeechBrain model ids. |
| `AKAMAI_B200_MODEL_TCPA` | `distilbert-tcpa` | TCPA classifier model id. |
| `AKAMAI_B200_MODEL_VISION` | `qwen-2.5-vl-72b-instruct` | Vision model id. |
| `AKAMAI_B200_MODEL_PII` | `presidio-ner` | PII redaction model id. |
| `AKAMAI_B200_EMBED_DIM` | `1024` | Reported embedding dimension (BGE-M3). |
| `BRAIN_FRONTIER_MODEL_ANTHROPIC` | `claude-opus-4-7` | Anthropic frontier model id. |
| `BRAIN_FRONTIER_MODEL_OPENAI` | `gpt-5` | OpenAI frontier model id. |
