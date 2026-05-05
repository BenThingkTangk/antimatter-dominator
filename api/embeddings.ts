/**
 * /api/embeddings — single proxy for vector work.
 *
 * Routes to Perplexity Embeddings (`pplx-embed-v1-0.6b`, 1024d, INT8) by default.
 * Falls back to OpenAI `text-embedding-3-small` (1536d) if Perplexity errors so
 * we never block a user-facing operation on a single vendor.
 *
 * POST /api/embeddings  { input: string | string[], model?: "openai" }
 *   → { embeddings: number[][], model, dim, latency_ms, cached }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

const PERPLEXITY_API_KEY = clean(process.env.PERPLEXITY_API_KEY);
const OPENAI_API_KEY     = clean(process.env.OPENAI_API_KEY);

const PPLX_MODEL   = "pplx-embed-v1-0.6b";
const OPENAI_MODEL = "text-embedding-3-small";

function decodePplxEmbedding(raw: any): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string") return [];
  const buf = Buffer.from(raw, "base64");
  const out: number[] = new Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const u = buf[i];
    out[i] = (u < 128 ? u : u - 256) / 127;
  }
  return out;
}

async function embedPplx(inputs: string[]) {
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY missing");
  const r = await fetch("https://api.perplexity.ai/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: PPLX_MODEL, input: inputs }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`pplx ${r.status}: ${t.slice(0, 200)}`);
  }
  const d: any = await r.json();
  const embeddings: number[][] = (d?.data || []).map((row: any) => decodePplxEmbedding(row.embedding));
  if (!embeddings.length) throw new Error("pplx returned no embeddings");
  return { embeddings, model: PPLX_MODEL, dim: embeddings[0].length };
}

async function embedOpenAI(inputs: string[]) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: OPENAI_MODEL, input: inputs }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`openai ${r.status}: ${t.slice(0, 200)}`);
  }
  const d: any = await r.json();
  const embeddings: number[][] = (d?.data || []).map((row: any) => row.embedding);
  if (!embeddings.length) throw new Error("openai returned no embeddings");
  return { embeddings, model: OPENAI_MODEL, dim: embeddings[0].length };
}

async function embedCore(inputs: string[], preferOpenAI = false) {
  const order = preferOpenAI ? [embedOpenAI, embedPplx] : [embedPplx, embedOpenAI];
  for (const fn of order) {
    try { return await fn(inputs); }
    catch (e: any) { console.warn(`[embed] ${fn.name} failed:`, e?.message); }
  }
  throw new Error("All embedding providers failed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { input, model } = req.body || {};
  if (!input) return res.status(400).json({ error: "input required" });
  const inputs: string[] = Array.isArray(input) ? input : [input];
  if (inputs.length > 100) return res.status(400).json({ error: "max 100 inputs per call" });
  for (const i of inputs) {
    if (typeof i !== "string") return res.status(400).json({ error: "all inputs must be strings" });
    if (i.length > 32000) return res.status(400).json({ error: "input too long" });
  }

  try {
    const t0 = Date.now();
    const result = await embedCore(inputs, model === "openai");
    return res.status(200).json({ ...result, latency_ms: Date.now() - t0, cached: false });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "embeddings_failed" });
  }
}
