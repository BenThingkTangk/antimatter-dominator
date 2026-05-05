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
const ANTHROPIC_API_KEY  = clean(process.env.ANTHROPIC_API_KEY) || clean(process.env.OPENAI_API_KEY);

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

  const { message, context = "general", history = [], companyName, productName } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message required" });
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

  const messages = [
    { role: "system", content: fullSystem },
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

    return res.status(200).json({
      content,
      citations,
      model,
      latency_ms: Date.now() - t0,
      usage: data?.usage || null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "atom_chat_failed" });
  }
}
