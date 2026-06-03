/**
 * Embedding provider for ATOM Support RAG.
 *
 * Target model: BGE-M3 (1024-dim) per spec. We support a pluggable provider:
 *   EMBEDDING_PROVIDER = bge | openai | pplx   (default: bge if BGE_EMBED_URL set)
 *   EMBEDDING_MODEL    = BGE-M3 (default)
 *
 * BGE-M3 is served via a self-hosted endpoint (BGE_EMBED_URL) that accepts
 * {input: string[]} and returns {embeddings: number[][]} — same contract as the
 * atom-rag microservice. If no BGE endpoint is configured we fall back to
 * OpenAI / Perplexity so local dev + Vercel still function (clearly logged).
 *
 * All vectors are normalized to 1024 dims (pad/truncate) so they match the
 * support_chunks.embedding vector(1024) column and match_support_chunks RPC.
 */
const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

const EMBEDDING_PROVIDER = clean(process.env.EMBEDDING_PROVIDER).toLowerCase();
const EMBEDDING_MODEL = clean(process.env.EMBEDDING_MODEL) || "BGE-M3";
const BGE_EMBED_URL = clean(process.env.BGE_EMBED_URL) || clean(process.env.RAG_URL);
const BGE_EMBED_API_KEY = clean(process.env.BGE_EMBED_API_KEY);
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);
const PERPLEXITY_API_KEY = clean(process.env.PERPLEXITY_API_KEY);

export const EMBED_DIM = 1024;

export interface EmbedResult {
  embeddings: number[][];
  model: string;
  dim: number;
  provider: string;
  mocked: boolean;
}

/** Force a vector to exactly EMBED_DIM (pad with 0, truncate if longer). */
function fit(vec: number[]): number[] {
  if (vec.length === EMBED_DIM) return vec;
  if (vec.length > EMBED_DIM) return vec.slice(0, EMBED_DIM);
  return vec.concat(new Array(EMBED_DIM - vec.length).fill(0));
}

async function embedBge(inputs: string[]): Promise<EmbedResult> {
  if (!BGE_EMBED_URL) throw new Error("BGE_EMBED_URL not configured");
  const r = await fetch(`${BGE_EMBED_URL.replace(/\/$/, "")}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(BGE_EMBED_API_KEY ? { Authorization: `Bearer ${BGE_EMBED_API_KEY}` } : {}),
    },
    body: JSON.stringify({ input: inputs, model: EMBEDDING_MODEL }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`bge ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  const d: any = await r.json();
  const raw: number[][] = d?.embeddings || d?.data?.map((x: any) => x.embedding) || [];
  if (!raw.length) throw new Error("bge returned no embeddings");
  return { embeddings: raw.map(fit), model: EMBEDDING_MODEL, dim: EMBED_DIM, provider: "bge", mocked: false };
}

async function embedOpenAI(inputs: string[]): Promise<EmbedResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: inputs }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  const d: any = await r.json();
  const raw: number[][] = (d?.data || []).map((row: any) => row.embedding);
  if (!raw.length) throw new Error("openai returned no embeddings");
  return { embeddings: raw.map(fit), model: "text-embedding-3-small", dim: EMBED_DIM, provider: "openai", mocked: false };
}

/**
 * Deterministic local-mock embedding so the pipeline is testable without any
 * provider/network. Hashes tokens into a fixed-dim bag-of-words vector and
 * L2-normalizes. NOT for production retrieval quality — clearly marked mocked.
 */
export function embedMock(inputs: string[]): EmbedResult {
  const embeddings = inputs.map((text) => {
    const v = new Array(EMBED_DIM).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
    for (const tok of tokens) {
      let h = 2166136261;
      for (let i = 0; i < tok.length; i++) {
        h ^= tok.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const idx = Math.abs(h) % EMBED_DIM;
      v[idx] += 1;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  });
  return { embeddings, model: "mock-bow-1024", dim: EMBED_DIM, provider: "mock", mocked: true };
}

export function embeddingProviderStatus(): { provider: string; live: boolean } {
  if (BGE_EMBED_URL && (EMBEDDING_PROVIDER === "bge" || !EMBEDDING_PROVIDER)) return { provider: "bge", live: true };
  if (OPENAI_API_KEY) return { provider: "openai", live: true };
  if (PERPLEXITY_API_KEY) return { provider: "pplx", live: true };
  return { provider: "mock", live: false };
}

export async function embed(inputs: string[]): Promise<EmbedResult> {
  if (!inputs.length) return { embeddings: [], model: EMBEDDING_MODEL, dim: EMBED_DIM, provider: "none", mocked: false };

  // Honor an explicit provider choice first, then fall back through the chain.
  const chain: Array<() => Promise<EmbedResult>> = [];
  if (EMBEDDING_PROVIDER === "bge" || (!EMBEDDING_PROVIDER && BGE_EMBED_URL)) chain.push(() => embedBge(inputs));
  if (EMBEDDING_PROVIDER === "openai" || !EMBEDDING_PROVIDER) chain.push(() => embedOpenAI(inputs));
  if (!chain.length) {
    chain.push(() => embedBge(inputs));
    chain.push(() => embedOpenAI(inputs));
  }

  for (const fn of chain) {
    try {
      return await fn();
    } catch (e: any) {
      console.warn(`[support embed] provider failed: ${e?.message}`);
    }
  }
  // Last resort so dev / CI never hard-fails. Clearly mocked.
  console.warn("[support embed] all providers failed — using deterministic mock embeddings");
  return embedMock(inputs);
}
