/**
 * ATOM Chat — floating in-app assistant powered by Perplexity Sonar.
 *
 * POST /api/atom-chat
 *   body: {
 *     message: string,
 *     context?: "general" | "warbook" | "market" | "objection" | "pitch" | "leadgen",
 *     history?: { role: "user" | "assistant", content: string }[],
 *     companyName?: string,    // hint for context-specific routing
 *     productName?: string,    // hint for context-specific routing
 *   }
 *
 *   returns: { content: string, citations: Array<{title, url}>, usage }
 *
 * Why Perplexity Sonar:
 *   - Live web grounding with citations (no stale answer)
 *   - Streaming-fast (sub-second first token on `sonar` and `sonar-pro`)
 *   - Far cheaper + faster than running our own RAG for in-app Q&A
 *
 * The endpoint also routes specific contexts to Sonar's domain-filtered
 * search so e.g. /warbook context filters to news/research domains.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

const PERPLEXITY_API_KEY = clean(process.env.PERPLEXITY_API_KEY);
const OPENAI_API_KEY     = clean(process.env.OPENAI_API_KEY);
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Inline embed() helper ────────────────────────────────────────────────────
// Vercel's serverless function bundler doesn't reliably ship sibling helper
// files referenced via relative imports (it traces node_modules deps but not
// arbitrary local paths). We inline the embed helper here — mirrored exactly
// in /api/embeddings.ts — so this function is self-contained.
const PPLX_MODEL   = "pplx-embed-v1-0.6b";    // 1024d, INT8
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

async function embed(input: string): Promise<{ embeddings: number[][]; model: string; dim: number }> {
  const inputs = [input];
  for (const fn of [embedPplx, embedOpenAI]) {
    try { return await fn(inputs); }
    catch (e: any) { console.warn(`[atom-chat embed] ${fn.name} failed:`, e?.message); }
  }
  throw new Error("All embedding providers failed");
}

// ─── Semantic memory ops ─────────────────────────────────────────────────────
// We embed every user message + assistant reply and store them in Supabase
// pgvector. Before each new reply, we retrieve the top-N most similar past
// exchanges (across the whole tenant by default) and prepend them as system
// context. This makes ATOM Chat feel like Cursor for sales — it remembers
// every product, prospect, and pitch the user has discussed.

async function recallSimilar(opts: {
  queryEmbedding: number[];
  tenantSlug?: string | null;
  sessionId?: string | null;
  matchCount?: number;
}): Promise<Array<{ role: string; content: string; similarity: number }>> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_chat_memory`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query_embedding: opts.queryEmbedding,
        match_count: opts.matchCount ?? 6,
        // Don't filter by session_id — we want cross-session recall.
        // Tenant filter scopes to this customer's history.
        match_session_id: null,
        match_tenant_slug: opts.tenantSlug || null,
        // Threshold tuned to 0.40 for INT8-quantized 1024d vectors. Keeps
        // recall sensitive enough to surface related conversations without
        // matching every loosely-similar past turn.
        match_threshold: 0.40,
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return [];
    const rows: any = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function persistTurn(opts: {
  tenantSlug?: string | null;
  sessionId: string;
  context: string;
  role: "user" | "assistant";
  content: string;
  embedding: number[];
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/chat_memory`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        tenant_slug: opts.tenantSlug || null,
        session_id: opts.sessionId,
        context: opts.context,
        role: opts.role,
        content: opts.content,
        embedding: opts.embedding,
      }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Best-effort — chat replies should never block on memory persistence.
  }
}

// System prompts per context. These set the assistant's "personality" for
// different surfaces of the app. ATOM Chat is the cross-cutting helper.
const SYSTEM_PROMPTS: Record<string, string> = {
  general: `You are ATOM Chat — the in-app assistant for the ATOM Sales Dominator platform.
You help reps and operators understand the product, its modules (Pitch, Objection Handler,
Market Intent, Prospect, Lead Gen, Campaign, WarBook, War Room), and how to get the most out
of each. You also help craft sales messages, research prospects, and explain platform features.
Be brisk, concrete, and useful. Cite sources when you make a factual claim. NEVER reveal
that you are an AI; you are "ATOM Chat".`,

  warbook: `You are ATOM Chat in WarBook context. Your job is deep company intelligence:
funding, leadership, recent news, tech stack signals, competitive positioning, vulnerabilities,
buying triggers. Cite primary sources (the company's own site, SEC filings, press releases,
trade press) when possible. Be ruthlessly specific — no generic "they're growing fast" filler.`,

  market: `You are ATOM Chat in Market Intent context. Surface live signals: hiring patterns,
funding rounds, product launches, regulatory shifts, M&A activity, security incidents, exec
turnover. Always link a signal to a buying motion ("therefore they need X now"). Cite primary
sources.`,

  objection: `You are ATOM Chat in Objection Handler context. Help craft counter-objections
that are specific, evidence-backed, and human. Reference the prospect's stated concern,
acknowledge it, then reframe. Avoid generic closer-speak.`,

  pitch: `You are ATOM Chat in Pitch context. Help write specific, jargon-free, outcome-led
pitches. Always anchor on a concrete pain and a quantified outcome. Avoid hype words.`,

  leadgen: `You are ATOM Chat in Lead Gen context. Help diagnose call performance, suggest
opener tweaks, summarize transcripts, and surface buying signals. Be terse and actionable.`,
};

function pickModel(context: string): string {
  // Sonar Pro for deeper context surfaces (warbook, market) where citations + reasoning matter.
  // Sonar (cheap + fast) for the general/in-app helper where speed is king.
  if (context === "warbook" || context === "market") return "sonar-pro";
  return "sonar";
}

function pickDomainFilter(context: string): string[] | undefined {
  if (context === "warbook" || context === "market") {
    return ["sec.gov", "techcrunch.com", "bloomberg.com", "reuters.com",
      "wsj.com", "ft.com", "linkedin.com", "crunchbase.com", "gartner.com",
      "forbes.com", "businessinsider.com"];
  }
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!PERPLEXITY_API_KEY) {
    return res.status(500).json({ error: "PERPLEXITY_API_KEY not configured" });
  }

  const {
    message,
    context = "general",
    history = [],
    companyName,
    productName,
    sessionId: incomingSessionId,
    tenantSlug: incomingTenantSlug,
  } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message required" });
  }

  // Stable per-browser session id so all turns thread together.
  const sessionId = (incomingSessionId && String(incomingSessionId)) ||
    `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tenantSlug = incomingTenantSlug ? String(incomingTenantSlug) : null;

  // ─── Embed user message + recall similar past turns ─────────────────────────
  // The chat_memory.embedding column is vector(1024) so we only persist
  // matching-dim embeddings. Perplexity pplx-embed-v1 = 1024d → fits.
  // OpenAI text-embedding-3-small = 1536d → doesn't fit; we still use it for
  // the immediate reply context, but skip persisting until we migrate columns.
  let userEmbedding: number[] | null = null;
  let userEmbeddingFitsMemory = false;
  let recalled: Array<{ role: string; content: string; similarity: number }> = [];
  try {
    const e = await embed(message);
    if (e.embeddings.length > 0) {
      userEmbedding = e.embeddings[0];
      userEmbeddingFitsMemory = userEmbedding.length === 1024;
      if (userEmbeddingFitsMemory) {
        recalled = await recallSimilar({
          queryEmbedding: userEmbedding,
          tenantSlug,
          matchCount: 5,
        });
      }
    }
  } catch (e: any) {
    console.warn("[atom-chat] embed failed:", e?.message);
  }

  const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;
  const model = pickModel(context);
  const domainFilter = pickDomainFilter(context);

  // Inject the company/product hints into the system prompt so the model
  // already has the right entity in memory before the user asks.
  const hints: string[] = [];
  if (companyName) hints.push(`Active company context: ${companyName}.`);
  if (productName) hints.push(`Active product context: ${productName}.`);
  const fullSystem = hints.length
    ? `${systemPrompt}\n\n${hints.join(" ")}`
    : systemPrompt;

  // Inject recalled memories as a single system supplement — keeps the
  // user-visible UX clean while giving the model durable context.
  const memoryBlock = recalled.length > 0
    ? `\n\nRELEVANT PAST EXCHANGES (from this user's prior sessions, most similar first):\n` +
      recalled.map((r, i) =>
        `[${i + 1}] (${r.role}, similarity ${r.similarity.toFixed(2)}) ${r.content.slice(0, 240)}`
      ).join("\n")
    : "";

  const messages = [
    { role: "system", content: fullSystem + memoryBlock },
    ...history.slice(-6).map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    })),
    { role: "user", content: message },
  ];

  try {
    const t0 = Date.now();
    const body: any = {
      model,
      messages,
      // Real-time first; recency >= "month" lets the assistant include
      // last-30-day news, which is usually what a sales op cares about.
      search_recency_filter: context === "warbook" || context === "market" ? "month" : undefined,
      search_context_size: context === "warbook" || context === "market" ? "high" : "low",
      temperature: 0.4,
      max_tokens: 800,
      return_citations: true,
    };
    if (domainFilter) body.search_domain_filter = domainFilter;

    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res.status(502).json({
        error: "perplexity_error",
        status: r.status,
        detail: errText.slice(0, 400),
      });
    }

    const data: any = await r.json();
    const content: string = data?.choices?.[0]?.message?.content || "";
    const rawCitations: string[] = data?.citations || [];

    // Normalize citations into { title, url }. Perplexity returns URLs as a
    // flat array; we infer title from hostname for now.
    const citations = rawCitations.map((url: string, i: number) => {
      try {
        const u = new URL(url);
        return { title: u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname.slice(0, 40) : ""), url };
      } catch {
        return { title: `Source ${i + 1}`, url };
      }
    });

    // Persist this turn to memory (fire-and-forget) only if dimensions match.
    if (userEmbedding && userEmbeddingFitsMemory) {
      void persistTurn({
        tenantSlug, sessionId, context,
        role: "user", content: message, embedding: userEmbedding,
      });
    }
    if (content) {
      try {
        const replyEmbed = await embed(content.slice(0, 4000));
        const v = replyEmbed.embeddings[0];
        if (v && v.length === 1024) {
          void persistTurn({
            tenantSlug, sessionId, context,
            role: "assistant", content, embedding: v,
          });
        }
      } catch (e: any) {
        console.warn("[atom-chat] reply embed failed:", e?.message);
      }
    }

    return res.status(200).json({
      content,
      citations,
      model,
      sessionId,                                 // surfaced for client to thread
      memoryUsed: recalled.length,               // surfaced so UI can show "recalled N past"
      latency_ms: Date.now() - t0,
      usage: data?.usage || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "atom_chat_failed" });
  }
}
