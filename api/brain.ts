/**
 * ATOM Brain — central model-selection + worker-request router.
 *
 * One endpoint that every ATOM worker calls instead of talking to a model
 * vendor directly. The Brain decides which model serves a request and routes
 * it to the Akamai Blackwell B200 inference plane (self-hosted OSS models),
 * Qdrant (vectors), or — for Vibranium-tier chat/reasoning/vision only — a
 * frontier fallback (Claude Opus / GPT-5.5).
 *
 * Why a single dispatch endpoint (not one file per task):
 *   - Mirrors /api/rag.ts: keeps the serverless function count low and keeps
 *     all model-routing policy in one auditable place.
 *   - Workers send `{ task, ... }`; the Brain owns model choice so swapping a
 *     model is a one-line change here, not a redeploy of every worker.
 *
 * POST /api/brain   body: { task: BrainTask, tier?, ...task-specific fields }
 *   → task-specific JSON (see docs/examples/brain/*.json)
 *
 * Routing table (task → model → plane):
 *   chat / reason   → Llama 3.3 70B (default) | Qwen 2.5 72B → B200
 *                     ↳ Vibranium tier may fall back to Claude Opus / GPT-5.5
 *   asr             → Parakeet TDT 1.1B                       → B200
 *   tts             → Kokoro-82M (default) | F5-TTS | XTTS-v2 → B200
 *   embed           → BGE-M3                                  → B200
 *   vector_upsert   → Qdrant
 *   vector_search   → BGE-M3 (query embed) + Qdrant
 *   emotion / intent→ SpeechBrain                             → B200
 *   tcpa_check      → DistilBERT (hard-stop classifier)       → B200
 *   vision          → Qwen 2.5-VL 72B                         → B200
 *                     ↳ Vibranium tier may fall back to Claude Opus / GPT-5.5
 *   pii_redact      → Presidio + NER                          → B200
 *
 * Env (see docs/examples/brain/README.md for the full list, including the
 * optional AKAMAI_B200_ROUTE_* / AKAMAI_B200_MODEL_* / BRAIN_FRONTIER_MODEL_*
 * overrides that let routes and model ids be set per environment):
 *   AKAMAI_B200_BASE_URL, AKAMAI_B200_API_KEY,
 *   QDRANT_URL, QDRANT_API_KEY,
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
/** env override with a default, trimmed the same way as every other secret. */
const envOr = (key: string, fallback: string) => clean(process.env[key]) || fallback;

const AKAMAI_B200_BASE_URL = clean(process.env.AKAMAI_B200_BASE_URL);
const AKAMAI_B200_API_KEY  = clean(process.env.AKAMAI_B200_API_KEY);
const QDRANT_URL           = clean(process.env.QDRANT_URL);
const QDRANT_API_KEY       = clean(process.env.QDRANT_API_KEY);
const ANTHROPIC_API_KEY    = clean(process.env.ANTHROPIC_API_KEY);
const OPENAI_API_KEY       = clean(process.env.OPENAI_API_KEY);

// ─── B200 plane routes ──────────────────────────────────────────────────────────
// The exact path suffixes the Blackwell plane serves each capability under,
// appended to `${AKAMAI_B200_BASE_URL}/v1/`. Chat/embeddings use the standard
// OpenAI-compatible names; the audio/classifier/redact routes are deployment
// -specific, so every one is env-overridable. Centralized here so a route
// change is a single edit (and documented in docs/examples/brain/README.md)
// rather than a string buried in a handler.
const B200_ROUTES = {
  chat:     envOr("AKAMAI_B200_ROUTE_CHAT",     "chat/completions"),
  asr:      envOr("AKAMAI_B200_ROUTE_ASR",      "audio/transcriptions"),
  tts:      envOr("AKAMAI_B200_ROUTE_TTS",      "audio/speech"),
  embed:    envOr("AKAMAI_B200_ROUTE_EMBED",    "embeddings"),
  classify_audio: envOr("AKAMAI_B200_ROUTE_CLASSIFY_AUDIO", "audio/classify"),
  classify_text:  envOr("AKAMAI_B200_ROUTE_CLASSIFY_TEXT",  "text/classify"),
  redact:   envOr("AKAMAI_B200_ROUTE_REDACT",   "text/redact"),
} as const;

// ─── Model registry ───────────────────────────────────────────────────────────
// Logical model names → the model id the B200 plane serves them under. Keeping
// the mapping here means a worker never hard-codes a model id; every id is
// env-overridable so a model swap needs no redeploy of this file.
const B200_MODELS = {
  chat_llama:   envOr("AKAMAI_B200_MODEL_CHAT_LLAMA", "llama-3.3-70b-instruct"),
  chat_qwen:    envOr("AKAMAI_B200_MODEL_CHAT_QWEN",  "qwen-2.5-72b-instruct"),
  asr:          envOr("AKAMAI_B200_MODEL_ASR",        "parakeet-tdt-1.1b"),
  tts_kokoro:   envOr("AKAMAI_B200_MODEL_TTS_KOKORO", "kokoro-82m"),
  tts_f5:       envOr("AKAMAI_B200_MODEL_TTS_F5",     "f5-tts"),
  tts_xtts:     envOr("AKAMAI_B200_MODEL_TTS_XTTS",   "xtts-v2"),
  embed:        envOr("AKAMAI_B200_MODEL_EMBED",      "bge-m3"),
  emotion:      envOr("AKAMAI_B200_MODEL_EMOTION",    "speechbrain-emotion"),
  intent:       envOr("AKAMAI_B200_MODEL_INTENT",     "speechbrain-intent"),
  tcpa:         envOr("AKAMAI_B200_MODEL_TCPA",       "distilbert-tcpa"),
  vision:       envOr("AKAMAI_B200_MODEL_VISION",     "qwen-2.5-vl-72b-instruct"),
  pii:          envOr("AKAMAI_B200_MODEL_PII",        "presidio-ner"),
} as const;

// Frontier fallback model ids (Vibranium tier only). NOTE: gpt-5.5 is NOT a
// confirmed model name — api/atom-leadgen/call.ts documents that the platform
// only whitelists gpt-5 / gpt-5-mini / gpt-4.1 / gpt-4o (verified May 2026).
// We default OpenAI to "gpt-5" to match that reality and leave both ids
// env-overridable so the frontier model can be set per environment.
const FRONTIER_MODELS = {
  anthropic: envOr("BRAIN_FRONTIER_MODEL_ANTHROPIC", "claude-opus-4-7"),
  openai:    envOr("BRAIN_FRONTIER_MODEL_OPENAI",    "gpt-5"),
} as const;

const EMBED_DIM = Number(clean(process.env.AKAMAI_B200_EMBED_DIM)) || 1024; // BGE-M3

// Tasks eligible for frontier fallback (Vibranium tier only).
const FRONTIER_ELIGIBLE = new Set<BrainTask>(["chat", "reason", "vision"]);

// Single gate for the frontier (Claude Opus / GPT-5) fallback. Frontier is
// permitted ONLY when the tier is exactly "vibranium" AND the task is one of
// the eligible tasks above. Everything else (lower tiers, non-eligible tasks)
// can never reach a frontier vendor, regardless of body flags.
function frontierGate(task: BrainTask, tier: unknown) {
  return String(tier || "").toLowerCase() === "vibranium" && FRONTIER_ELIGIBLE.has(task);
}

type BrainTask =
  | "chat" | "reason" | "asr" | "tts" | "embed"
  | "vector_upsert" | "vector_search" | "emotion" | "intent"
  | "tcpa_check" | "vision" | "pii_redact";

class BrainError extends Error {
  constructor(public status: number, message: string, public detail?: string) {
    super(message);
  }
}

// ─── B200 plane transport ──────────────────────────────────────────────────────
// The Blackwell plane exposes an OpenAI-compatible surface for chat/embeddings
// plus task-specific routes for audio/vision/classifier models. We post to
// `${BASE}/v1/<path>` with a bearer key and a generous timeout (voice + 72B
// models are not instant). `model` is always set explicitly by the Brain.
async function b200<T = any>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  if (!AKAMAI_B200_BASE_URL) throw new BrainError(500, "B200 plane not configured: set AKAMAI_B200_BASE_URL");
  if (!AKAMAI_B200_API_KEY)  throw new BrainError(500, "B200 plane not configured: set AKAMAI_B200_API_KEY");
  const url = `${AKAMAI_B200_BASE_URL.replace(/\/$/, "")}/v1/${path.replace(/^\//, "")}`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AKAMAI_B200_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    const reason = e?.name === "TimeoutError" ? `timed out after ${timeoutMs}ms` : (e?.message || "network error");
    throw new BrainError(504, `b200 ${path} unreachable`, reason);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new BrainError(502, `b200 ${path} returned ${r.status}`, t.slice(0, 400));
  }
  return r.json() as Promise<T>;
}

// ─── Qdrant transport ──────────────────────────────────────────────────────────
async function qdrant<T = any>(path: string, body: unknown, method = "PUT"): Promise<T> {
  if (!QDRANT_URL) throw new BrainError(500, "vector store not configured: set QDRANT_URL");
  let r: Response;
  try {
    r = await fetch(`${QDRANT_URL.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e: any) {
    const reason = e?.name === "TimeoutError" ? "timed out after 20000ms" : (e?.message || "network error");
    throw new BrainError(504, `qdrant ${path} unreachable`, reason);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new BrainError(502, `qdrant ${path} returned ${r.status}`, t.slice(0, 400));
  }
  return r.json() as Promise<T>;
}

// ─── Chat / reasoning ───────────────────────────────────────────────────────────
// model selector: explicit body.model wins; "qwen" → Qwen, else Llama default.
function pickChatModel(model?: string): string {
  if (model === "qwen" || model === B200_MODELS.chat_qwen) return B200_MODELS.chat_qwen;
  return B200_MODELS.chat_llama;
}

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

async function runChat(body: any, task: "chat" | "reason") {
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) throw new BrainError(400, "messages[] required");

  // Frontier fallback: Vibranium tier only, and only when explicitly requested
  // (body.frontier) or the B200 plane fails. Reasoning leans a little hotter.
  const frontierAllowed = frontierGate(task, body.tier);
  const wantFrontier = frontierAllowed && body.frontier === true;

  const temperature = typeof body.temperature === "number"
    ? body.temperature
    : task === "reason" ? 0.2 : 0.5;
  const max_tokens = typeof body.max_tokens === "number" ? body.max_tokens : 1024;

  if (wantFrontier) {
    const out = await runFrontierChat(messages, temperature, max_tokens, body.frontier_vendor);
    return { ...out, task, routed: "frontier" as const };
  }

  try {
    const model = pickChatModel(body.model);
    const data = await b200<any>(B200_ROUTES.chat, { model, messages, temperature, max_tokens });
    return {
      task,
      routed: "b200" as const,
      model,
      content: data?.choices?.[0]?.message?.content ?? "",
      usage: data?.usage ?? null,
    };
  } catch (e) {
    // Vibranium tier degrades to frontier on B200 failure; others surface it.
    if (frontierAllowed) {
      const out = await runFrontierChat(messages, temperature, max_tokens, body.frontier_vendor);
      return { ...out, task, routed: "frontier_fallback" as const };
    }
    throw e;
  }
}

async function runFrontierChat(
  messages: ChatMessage[],
  temperature: number,
  max_tokens: number,
  vendor?: string,
) {
  const useOpenAI = vendor === "openai" || (!ANTHROPIC_API_KEY && !!OPENAI_API_KEY);

  if (useOpenAI) {
    if (!OPENAI_API_KEY) throw new BrainError(500, "OPENAI_API_KEY not configured");
    const data = await openAIChat(messages, temperature, max_tokens);
    return {
      model: FRONTIER_MODELS.openai,
      content: data?.choices?.[0]?.message?.content ?? "",
      usage: data?.usage ?? null,
    };
  }

  if (!ANTHROPIC_API_KEY) throw new BrainError(500, "ANTHROPIC_API_KEY not configured");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FRONTIER_MODELS.anthropic,
      system: system || undefined,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new BrainError(502, `anthropic ${r.status}`, t.slice(0, 400));
  }
  const data: any = await r.json();
  return {
    model: FRONTIER_MODELS.anthropic,
    content: Array.isArray(data?.content)
      ? data.content.map((b: any) => b?.text || "").join("")
      : "",
    usage: data?.usage ?? null,
  };
}

async function openAIChat(messages: ChatMessage[], temperature: number, max_tokens: number) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: FRONTIER_MODELS.openai, messages, temperature, max_tokens }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new BrainError(502, `openai ${r.status}`, t.slice(0, 400));
  }
  return r.json() as Promise<any>;
}

// ─── ASR (Parakeet) ─────────────────────────────────────────────────────────────
async function runAsr(body: any) {
  const audio = body.audio_base64 || body.audio;
  if (!audio) throw new BrainError(400, "audio_base64 required");
  const data = await b200<any>(B200_ROUTES.asr, {
    model: B200_MODELS.asr,
    audio_base64: audio,
    language: body.language || "en",
    sample_rate: body.sample_rate,
  });
  return { task: "asr", routed: "b200", model: B200_MODELS.asr, text: data?.text ?? "", segments: data?.segments ?? [] };
}

// ─── TTS (Kokoro / F5 / XTTS) ────────────────────────────────────────────────────
function pickTtsModel(voiceModel?: string): string {
  if (voiceModel === "f5" || voiceModel === B200_MODELS.tts_f5) return B200_MODELS.tts_f5;
  if (voiceModel === "xtts" || voiceModel === B200_MODELS.tts_xtts) return B200_MODELS.tts_xtts;
  return B200_MODELS.tts_kokoro;
}

async function runTts(body: any) {
  const text = body.text;
  if (!text || typeof text !== "string") throw new BrainError(400, "text required");
  const model = pickTtsModel(body.voice_model);
  const data = await b200<any>(B200_ROUTES.tts, {
    model,
    input: text,
    voice: body.voice,
    speed: body.speed,
    format: body.format || "mp3",
  });
  return {
    task: "tts",
    routed: "b200",
    model,
    audio_base64: data?.audio_base64 ?? data?.audio ?? "",
    format: data?.format || body.format || "mp3",
  };
}

// ─── Embeddings (BGE-M3) ──────────────────────────────────────────────────────────
async function embedTexts(inputs: string[]): Promise<number[][]> {
  const data = await b200<any>(B200_ROUTES.embed, { model: B200_MODELS.embed, input: inputs }, 20_000);
  const embeddings: number[][] = (data?.data || []).map((row: any) => row.embedding);
  if (!embeddings.length) throw new BrainError(502, "b200 returned no embeddings");
  return embeddings;
}

async function runEmbed(body: any) {
  const input = body.input;
  if (!input) throw new BrainError(400, "input required");
  const inputs: string[] = Array.isArray(input) ? input : [input];
  if (inputs.length > 100) throw new BrainError(400, "max 100 inputs per call");
  for (const s of inputs) {
    if (typeof s !== "string") throw new BrainError(400, "all inputs must be strings");
  }
  const embeddings = await embedTexts(inputs);
  return { task: "embed", routed: "b200", model: B200_MODELS.embed, embeddings, dim: embeddings[0]?.length ?? EMBED_DIM };
}

// ─── Vectors (Qdrant) ──────────────────────────────────────────────────────────────
async function runVectorUpsert(body: any) {
  const collection = body.collection;
  if (!collection) throw new BrainError(400, "collection required");
  const points = Array.isArray(body.points) ? body.points : null;
  if (!points || !points.length) throw new BrainError(400, "points[] required");

  // Allow callers to upsert raw text and let the Brain embed it (one round trip).
  const needsEmbed = points.some((p: any) => p.text && !p.vector);
  if (needsEmbed) {
    const texts = points.map((p: any) => p.text ?? "");
    const vectors = await embedTexts(texts);
    points.forEach((p: any, i: number) => { if (!p.vector) p.vector = vectors[i]; });
  }

  const data = await qdrant<any>(
    `/collections/${encodeURIComponent(collection)}/points?wait=true`,
    { points: points.map((p: any) => ({ id: p.id, vector: p.vector, payload: p.payload ?? {} })) },
    "PUT",
  );
  return { task: "vector_upsert", routed: "qdrant", collection, upserted: points.length, result: data?.result ?? data };
}

async function runVectorSearch(body: any) {
  const collection = body.collection;
  if (!collection) throw new BrainError(400, "collection required");
  let vector: number[] | undefined = body.vector;
  if (!vector) {
    if (!body.query || typeof body.query !== "string") {
      throw new BrainError(400, "query (text) or vector required");
    }
    vector = (await embedTexts([body.query]))[0];
  }
  const data = await qdrant<any>(
    `/collections/${encodeURIComponent(collection)}/points/search`,
    { vector, limit: body.limit ?? 8, filter: body.filter, with_payload: true },
    "POST",
  );
  return { task: "vector_search", routed: "qdrant", collection, results: data?.result ?? [] };
}

// ─── Emotion / Intent (SpeechBrain) ───────────────────────────────────────────────
// Modality-aware: audio inputs go to the B200 audio classifier; text-only
// inputs go to the text classifier. (The shipped intent.json example is
// text-only, so it must hit the text route, not audio.) Audio wins when both
// are present.
async function runSpeechBrain(body: any, task: "emotion" | "intent") {
  const audio = body.audio_base64 || body.audio;
  const text = body.text;
  if (!audio && !text) throw new BrainError(400, "audio_base64 or text required");
  const model = task === "emotion" ? B200_MODELS.emotion : B200_MODELS.intent;
  const route = audio ? B200_ROUTES.classify_audio : B200_ROUTES.classify_text;
  const data = audio
    ? await b200<any>(route, { model, task, audio_base64: audio, text })
    : await b200<any>(route, { model, task, text });
  return { task, routed: "b200", model, modality: audio ? "audio" : "text", label: data?.label ?? null, scores: data?.scores ?? {} };
}

// ─── TCPA hard-stop (DistilBERT) ────────────────────────────────────────────────
// Returns a hard-stop decision the dialer enforces BEFORE connecting. This
// guardrail FAILS CLOSED: a classifier outage must not let a risky call through.
// On any classifier/transport error we return a normal 200 with hardStop:true
// and degraded:true, so the decision does not depend on every caller handling a
// 5xx. A missing `text` is still a 400 (caller bug, not an outage).
async function runTcpaCheck(body: any) {
  const text = body.text;
  if (!text || typeof text !== "string") throw new BrainError(400, "text required");
  try {
    const data = await b200<any>(B200_ROUTES.classify_text, { model: B200_MODELS.tcpa, text });
    const label = String(data?.label ?? "").toLowerCase();
    const score = typeof data?.score === "number" ? data.score : 0;
    // "stop" / "dnc" / "revoke" labels above threshold → hard stop.
    const hardStop = /stop|dnc|revoke|opt[_-]?out/.test(label) && score >= (body.threshold ?? 0.5);
    return { task: "tcpa_check", routed: "b200", model: B200_MODELS.tcpa, hardStop, degraded: false, label, score };
  } catch (e) {
    const detail = e instanceof BrainError
      ? `${e.message}${e.detail ? `: ${e.detail}` : ""}`
      : (e as any)?.message || "classifier unavailable";
    // Fail closed: block the call and tell the caller why.
    return { task: "tcpa_check", routed: "b200", model: B200_MODELS.tcpa, hardStop: true, degraded: true, label: "", score: 0, detail };
  }
}

// ─── Vision (Qwen 2.5-VL) ─────────────────────────────────────────────────────────
async function runVision(body: any) {
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages) throw new BrainError(400, "messages[] required (OpenAI vision format)");

  // Vision frontier always uses the OpenAI vendor: Anthropic expects a
  // different image content-block shape than the OpenAI `image_url` blocks
  // workers send, so frontier_vendor is intentionally ignored for vision.
  const frontierAllowed = frontierGate("vision", body.tier);
  const max_tokens = typeof body.max_tokens === "number" ? body.max_tokens : 1024;

  if (frontierAllowed && body.frontier === true) {
    const data = await openAIChat(messages, body.temperature ?? 0.3, max_tokens);
    return { task: "vision", routed: "frontier", model: FRONTIER_MODELS.openai, content: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? null };
  }

  try {
    const data = await b200<any>(B200_ROUTES.chat, {
      model: B200_MODELS.vision,
      messages,
      temperature: body.temperature ?? 0.3,
      max_tokens,
    });
    return { task: "vision", routed: "b200", model: B200_MODELS.vision, content: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? null };
  } catch (e) {
    if (frontierAllowed) {
      const data = await openAIChat(messages, body.temperature ?? 0.3, max_tokens);
      return { task: "vision", routed: "frontier_fallback", model: FRONTIER_MODELS.openai, content: data?.choices?.[0]?.message?.content ?? "", usage: data?.usage ?? null };
    }
    throw e;
  }
}

// ─── PII redaction (Presidio + NER) ────────────────────────────────────────────────
async function runPiiRedact(body: any) {
  const text = body.text;
  if (!text || typeof text !== "string") throw new BrainError(400, "text required");
  const data = await b200<any>(B200_ROUTES.redact, {
    model: B200_MODELS.pii,
    text,
    entities: body.entities,
    anonymize: body.anonymize !== false,
  });
  return {
    task: "pii_redact",
    routed: "b200",
    model: B200_MODELS.pii,
    redacted: data?.redacted ?? data?.text ?? "",
    entities: data?.entities ?? [],
  };
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();

  // GET → config/health introspection (no secrets, no model calls). Lets ops
  // verify which planes are wired up and the active routing table per env.
  if (req.method === "GET") {
    return res.status(200).json({
      service: "atom-brain",
      tasks: ["chat", "reason", "asr", "tts", "embed", "vector_upsert", "vector_search", "emotion", "intent", "tcpa_check", "vision", "pii_redact"],
      planes: {
        b200: Boolean(AKAMAI_B200_BASE_URL && AKAMAI_B200_API_KEY),
        qdrant: Boolean(QDRANT_URL),
        frontier_anthropic: Boolean(ANTHROPIC_API_KEY),
        frontier_openai: Boolean(OPENAI_API_KEY),
      },
      frontier_eligible_tasks: Array.from(FRONTIER_ELIGIBLE),
      models: B200_MODELS,
      frontier_models: FRONTIER_MODELS,
      b200_routes: B200_ROUTES,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const task = body.task as BrainTask;
  if (!task) return res.status(400).json({ error: "task required" });

  const t0 = Date.now();
  try {
    let out: any;
    switch (task) {
      case "chat":
      case "reason":        out = await runChat(body, task); break;
      case "asr":           out = await runAsr(body); break;
      case "tts":           out = await runTts(body); break;
      case "embed":         out = await runEmbed(body); break;
      case "vector_upsert": out = await runVectorUpsert(body); break;
      case "vector_search": out = await runVectorSearch(body); break;
      case "emotion":
      case "intent":        out = await runSpeechBrain(body, task); break;
      case "tcpa_check":    out = await runTcpaCheck(body); break;
      case "vision":        out = await runVision(body); break;
      case "pii_redact":    out = await runPiiRedact(body); break;
      default:
        return res.status(400).json({
          error: `Unknown task: ${task}. Use: chat|reason|asr|tts|embed|vector_upsert|vector_search|emotion|intent|tcpa_check|vision|pii_redact`,
        });
    }
    return res.status(200).json({ ...out, latency_ms: Date.now() - t0 });
  } catch (e) {
    if (e instanceof BrainError) {
      return res.status(e.status).json({ error: e.message, detail: e.detail, latency_ms: Date.now() - t0 });
    }
    return res.status(500).json({ error: (e as any)?.message || "brain_failed", latency_ms: Date.now() - t0 });
  }
}
