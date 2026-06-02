# ATOM Brain — API router

`POST /api/brain` is the single entrypoint every ATOM worker uses for inference.
Workers send `{ "task": "<task>", ... }`; the Brain owns model selection and
routes the request to the Akamai Blackwell **B200** inference plane, **Qdrant**
(vectors), or — for **Vibranium-tier** chat/reason/vision only — a frontier
fallback (Claude Opus / GPT-5.5).

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

\* Frontier fallback (Claude Opus / GPT-5.5) is gated to `tier: "vibranium"`
and only fires for the eligible tasks above. Set `frontier: true` to route
there directly, or it engages automatically if the B200 plane errors on a
Vibranium request. Choose the vendor with `frontier_vendor: "anthropic" | "openai"`.

## Model selectors

- **chat / reason** — `model: "qwen"` → Qwen 2.5 72B; otherwise Llama 3.3 70B.
- **tts** — `voice_model: "f5"` → F5-TTS, `"xtts"` → XTTS-v2; otherwise Kokoro-82M.

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

// TCPA hard-stop — enforce BEFORE connecting a call
const tcpa = await brain.tcpaCheck({ text: transcript });
if (tcpa.hardStop) abortDial();

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
| `AKAMAI_B200_BASE_URL` | Base URL of the Akamai Blackwell B200 inference plane (OpenAI-compatible `/v1/*`). |
| `AKAMAI_B200_API_KEY`  | Bearer key for the B200 plane. |
| `QDRANT_URL`           | Qdrant base URL for vector upsert/search. |
| `QDRANT_API_KEY`       | Qdrant API key (sent as `api-key`; optional for unauthenticated instances). |
| `ANTHROPIC_API_KEY`    | Claude Opus frontier fallback (Vibranium tier). |
| `OPENAI_API_KEY`       | GPT-5.5 frontier fallback (Vibranium tier). |

Set these in Vercel project env (and `.env` for local `vercel dev`). The B200
and Qdrant vars are required for self-hosted tasks; the frontier keys are only
needed if Vibranium-tier frontier routing is enabled.
