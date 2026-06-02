/**
 * ATOM Brain — typed worker SDK.
 *
 * Zero-dependency client (global fetch only) so the same helper works from
 * Vercel serverless routes, the React client, and Akamai EdgeWorkers. Every
 * worker calls the Brain through this client instead of hard-coding model ids
 * or vendor endpoints — model selection lives server-side in /api/brain.
 *
 * Usage:
 *   import { createBrainClient } from "@shared/atom-brain-client";
 *   const brain = createBrainClient({ baseUrl: process.env.ATOM_API_BASE });
 *   const { content } = await brain.chat({ messages: [{ role: "user", content: "hi" }] });
 *
 * Example payloads for every task live in docs/examples/brain/.
 */

export type BrainTask =
  | "chat" | "reason" | "asr" | "tts" | "embed"
  | "vector_upsert" | "vector_search" | "emotion" | "intent"
  | "tcpa_check" | "vision" | "pii_redact";

export type BrainTier = "vibranium" | (string & {});
export type FrontierVendor = "anthropic" | "openai";
export type RoutedTo = "b200" | "qdrant" | "frontier" | "frontier_fallback";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  /** string for text; OpenAI vision content blocks for the `vision` task. */
  content: string | Array<Record<string, unknown>>;
}

/** Fields shared by frontier-eligible tasks (chat/reason/vision). */
interface FrontierOpts {
  /** Only "vibranium" unlocks the frontier fallback. */
  tier?: BrainTier;
  /** Explicitly route to the frontier model (Vibranium tier only). */
  frontier?: boolean;
  frontier_vendor?: FrontierVendor;
}

export interface ChatRequest extends FrontierOpts {
  messages: ChatMessage[];
  /** "qwen" selects Qwen 2.5 72B; default is Llama 3.3 70B. */
  model?: "qwen" | "llama" | string;
  temperature?: number;
  max_tokens?: number;
}

export interface AsrRequest {
  audio_base64: string;
  language?: string;
  sample_rate?: number;
}

export interface TtsRequest {
  text: string;
  /** "f5" | "xtts"; default is Kokoro-82M. */
  voice_model?: "kokoro" | "f5" | "xtts" | string;
  voice?: string;
  speed?: number;
  format?: "mp3" | "wav" | "pcm" | string;
}

export interface EmbedRequest {
  input: string | string[];
}

export interface VectorPoint {
  id: string | number;
  /** Provide `vector` OR `text` (the Brain embeds text with BGE-M3). */
  vector?: number[];
  text?: string;
  payload?: Record<string, unknown>;
}

export interface VectorUpsertRequest {
  collection: string;
  points: VectorPoint[];
}

export interface VectorSearchRequest {
  collection: string;
  /** Provide `vector` OR `query` text (embedded with BGE-M3). */
  query?: string;
  vector?: number[];
  limit?: number;
  filter?: Record<string, unknown>;
}

export interface SpeechBrainRequest {
  audio_base64?: string;
  text?: string;
}

export interface TcpaCheckRequest {
  text: string;
  threshold?: number;
}

export interface VisionRequest extends FrontierOpts {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface PiiRedactRequest {
  text: string;
  entities?: string[];
  anonymize?: boolean;
}

// ─── Responses ────────────────────────────────────────────────────────────────
interface BrainBase { latency_ms: number }
export interface ChatResponse extends BrainBase {
  task: "chat" | "reason";
  routed: RoutedTo;
  model: string;
  content: string;
  usage: unknown;
}
export interface AsrResponse extends BrainBase {
  task: "asr"; routed: "b200"; model: string; text: string;
  segments: Array<{ start: number; end: number; text: string }>;
}
export interface TtsResponse extends BrainBase {
  task: "tts"; routed: "b200"; model: string; audio_base64: string; format: string;
}
export interface EmbedResponse extends BrainBase {
  task: "embed"; routed: "b200"; model: string; embeddings: number[][]; dim: number;
}
export interface VectorUpsertResponse extends BrainBase {
  task: "vector_upsert"; routed: "qdrant"; collection: string; upserted: number; result: unknown;
}
export interface VectorSearchResponse extends BrainBase {
  task: "vector_search"; routed: "qdrant"; collection: string;
  results: Array<{ id: string | number; score: number; payload: Record<string, unknown> }>;
}
export interface SpeechBrainResponse extends BrainBase {
  task: "emotion" | "intent"; routed: "b200"; model: string;
  label: string | null; scores: Record<string, number>;
}
export interface TcpaCheckResponse extends BrainBase {
  task: "tcpa_check"; routed: "b200"; model: string;
  hardStop: boolean; label: string; score: number;
}
export interface VisionResponse extends BrainBase {
  task: "vision"; routed: RoutedTo; model: string; content: string; usage: unknown;
}
export interface PiiRedactResponse extends BrainBase {
  task: "pii_redact"; routed: "b200"; model: string;
  redacted: string; entities: Array<{ type: string; start: number; end: number }>;
}

export interface BrainClientOptions {
  /** Origin that serves /api/brain. Defaults to same-origin (""). */
  baseUrl?: string;
  /** Override the path if the route is mounted elsewhere. */
  path?: string;
  /** Extra headers (e.g. auth) sent with every request. */
  headers?: Record<string, string>;
  /** Per-request abort timeout in ms (default 65000). */
  timeoutMs?: number;
  /** Injectable fetch for non-standard runtimes/tests. */
  fetchImpl?: typeof fetch;
}

export class BrainRequestError extends Error {
  constructor(public status: number, message: string, public detail?: string) {
    super(message);
    this.name = "BrainRequestError";
  }
}

export function createBrainClient(opts: BrainClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? "").replace(/\/$/, "");
  const path = opts.path ?? "/api/brain";
  const url = `${baseUrl}${path}`;
  const timeoutMs = opts.timeoutMs ?? 65_000;
  const doFetch = opts.fetchImpl ?? fetch;

  async function call<T>(task: BrainTask, payload: Record<string, unknown>): Promise<T> {
    const r = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: JSON.stringify({ task, ...payload }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new BrainRequestError(r.status, data?.error || `brain ${r.status}`, data?.detail);
    }
    return data as T;
  }

  return {
    /** Llama 3.3 70B / Qwen 2.5 72B chat. Vibranium tier may use frontier. */
    chat: (req: ChatRequest) => call<ChatResponse>("chat", req as any),
    /** Same routing as chat, lower default temperature for reasoning. */
    reason: (req: ChatRequest) => call<ChatResponse>("reason", req as any),
    /** Parakeet TDT 1.1B speech-to-text. */
    asr: (req: AsrRequest) => call<AsrResponse>("asr", req as any),
    /** Kokoro-82M / F5-TTS / XTTS-v2 text-to-speech. */
    tts: (req: TtsRequest) => call<TtsResponse>("tts", req as any),
    /** BGE-M3 embeddings. */
    embed: (req: EmbedRequest) => call<EmbedResponse>("embed", req as any),
    /** Upsert points into a Qdrant collection (embeds raw text via BGE-M3). */
    vectorUpsert: (req: VectorUpsertRequest) => call<VectorUpsertResponse>("vector_upsert", req as any),
    /** Vector search over Qdrant (embeds query text via BGE-M3). */
    vectorSearch: (req: VectorSearchRequest) => call<VectorSearchResponse>("vector_search", req as any),
    /** SpeechBrain emotion classification. */
    emotion: (req: SpeechBrainRequest) => call<SpeechBrainResponse>("emotion", req as any),
    /** SpeechBrain intent classification. */
    intent: (req: SpeechBrainRequest) => call<SpeechBrainResponse>("intent", req as any),
    /** DistilBERT TCPA hard-stop classifier — enforce BEFORE dialing. */
    tcpaCheck: (req: TcpaCheckRequest) => call<TcpaCheckResponse>("tcpa_check", req as any),
    /** Qwen 2.5-VL 72B vision. Vibranium tier may use frontier. */
    vision: (req: VisionRequest) => call<VisionResponse>("vision", req as any),
    /** Presidio + NER PII redaction. */
    piiRedact: (req: PiiRedactRequest) => call<PiiRedactResponse>("pii_redact", req as any),
  };
}

export type BrainClient = ReturnType<typeof createBrainClient>;
