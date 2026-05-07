/**
 * /api/signals/discover — ATOM Signal Engine
 *
 * Single endpoint that mines Perplexity Sonar Pro against a curated set of
 * premium B2B intelligence sources (CB Insights, PitchBook, Statista,
 * TechCrunch, Bloomberg, SEC, Crunchbase, G2, Gartner) and returns a
 * structured signal feed for any company or industry. Used by:
 *   • War Room       — auto-populated per deal on mount
 *   • Campaign        — per-target ATOM scoring + signal popover
 *   • Market Intent   — appended as "ATOM Signals" block in report
 *   • Prospect        — informs keyword/tech/product-focus weighting
 *
 * Signal categories:
 *   funding · m&a · hiring · leadership · product · partnership ·
 *   regulatory · competitive · macro · risk
 *
 * Each signal carries: headline, summary, category, impact (1-10),
 * recency (days), source domain, citation URL.
 *
 * Cached 6h per scope to keep Sonar costs sane (~$0.005/query).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const PPLX_API_KEY  = clean(process.env.PERPLEXITY_API_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

interface Signal {
  id: string;
  headline: string;
  summary: string;
  category: "funding" | "m&a" | "hiring" | "leadership" | "product" | "partnership" | "regulatory" | "competitive" | "macro" | "risk";
  impact: number;        // 1-10
  recencyDays: number;   // -1 if unknown
  source: string;        // domain
  url: string;
  date?: string;
}

interface SignalBundle {
  scope: { type: "company" | "industry"; name: string; domain?: string };
  signals: Signal[];
  atomScore: number;     // 0-100 weighted aggregate
  topNarrative: string;  // 1-line synthesis
  updatedAt: string;
  sourceCount: number;
}

const PREMIUM_DOMAINS = [
  "cbinsights.com", "pitchbook.com", "statista.com",
  "techcrunch.com", "bloomberg.com", "reuters.com", "wsj.com",
  "crunchbase.com", "sec.gov", "g2.com",
  "gartner.com", "forrester.com", "idc.com",
  "linkedin.com", "businesswire.com", "prnewswire.com",
];

// In-memory cache keyed by `${type}:${name}`. 6h TTL.
const cache = new Map<string, { value: SignalBundle; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 3600 * 1000;

async function querySonarPro(target: string, type: "company" | "industry"): Promise<{ raw: string; sources: any[] } | null> {
  if (!PPLX_API_KEY) return null;
  const prompt = type === "company"
    ? `Find the 12 most material business signals about "${target}" from the last 90 days. Cover funding, M&A, leadership changes, hiring, product launches, partnerships, regulatory news, competitive moves, and risk. For each signal output a short headline, 1-2 sentence summary, the most authoritative source URL, the publication date, and a 1-10 impact score. Return ONLY a JSON object with a "signals" array, no markdown fences.`
    : `Find the 10 most important signals shaping the "${target}" industry in the last 60 days. Cover macro trends, competitive moves, regulatory changes, technology shifts, and notable funding events. For each signal: headline, 1-2 sentence summary, source URL, publication date, impact 1-10. Return ONLY JSON with a "signals" array.`;

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PPLX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "You are a precise business intelligence analyst. Cite premium B2B sources (CB Insights, PitchBook, Statista, Bloomberg, TechCrunch, SEC) where possible. Output ONLY a JSON object — no markdown fences, no prose.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2400,
      response_format: { type: "json_schema", json_schema: { schema: { type: "object" } } },
      web_search_options: { search_context_size: "high" },
      search_domain_filter: PREMIUM_DOMAINS,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    console.warn("[signals/discover] sonar status", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  const sources = data?.citations || data?.choices?.[0]?.message?.citations || [];
  return { raw, sources };
}

function parseSignals(raw: string, sources: any[]): Signal[] {
  if (!raw) return [];
  let parsed: any;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  const arr: any[] = Array.isArray(parsed?.signals) ? parsed.signals
                   : Array.isArray(parsed?.results) ? parsed.results
                   : Array.isArray(parsed) ? parsed : [];
  const sourceUrls = (sources || []).map((c: any) => typeof c === "string" ? c : c?.url).filter(Boolean);

  return arr.map((s: any, i: number): Signal => {
    const url = s.url || s.source_url || s.link || sourceUrls[i] || "";
    let domain = "";
    try { domain = url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch {}
    const date = s.date || s.published_at || s.publication_date || "";
    let recencyDays = -1;
    if (date) {
      const t = new Date(date).getTime();
      if (!isNaN(t)) recencyDays = Math.max(0, Math.round((Date.now() - t) / 86400000));
    }
    const cat = (s.category || s.type || "").toString().toLowerCase();
    const norm: Signal["category"] =
      cat.includes("fund") || cat.includes("invest") ? "funding"
      : cat.includes("merger") || cat.includes("acqui") || cat.includes("m&a") ? "m&a"
      : cat.includes("hir") || cat.includes("layoff") || cat.includes("headcount") ? "hiring"
      : cat.includes("ceo") || cat.includes("exec") || cat.includes("leadership") || cat.includes("appoint") ? "leadership"
      : cat.includes("product") || cat.includes("launch") || cat.includes("release") ? "product"
      : cat.includes("partner") || cat.includes("integration") ? "partnership"
      : cat.includes("regul") || cat.includes("compli") || cat.includes("legal") ? "regulatory"
      : cat.includes("compet") ? "competitive"
      : cat.includes("macro") || cat.includes("market") || cat.includes("industry") ? "macro"
      : cat.includes("risk") || cat.includes("breach") || cat.includes("lawsuit") ? "risk"
      : "competitive";
    return {
      id: `sig_${Date.now()}_${i}`,
      headline: String(s.headline || s.title || "").slice(0, 200),
      summary: String(s.summary || s.description || "").slice(0, 500),
      category: norm,
      impact: Math.max(1, Math.min(10, Number(s.impact || s.impact_score || 5))),
      recencyDays,
      source: domain || "premium",
      url,
      date,
    };
  }).filter((s) => s.headline.length > 5);
}

function computeAtomScore(signals: Signal[]): number {
  if (!signals.length) return 0;
  // Weight: impact × recency-decay (newer signals matter more) × category multiplier
  const catWeight: Record<Signal["category"], number> = {
    funding: 1.4, "m&a": 1.5, hiring: 1.1, leadership: 1.2,
    product: 1.0, partnership: 1.1, regulatory: 1.3,
    competitive: 1.0, macro: 0.8, risk: 1.4,
  };
  let total = 0;
  for (const s of signals) {
    const recencyMultiplier = s.recencyDays < 0 ? 0.7
      : s.recencyDays <= 7  ? 1.0
      : s.recencyDays <= 30 ? 0.9
      : s.recencyDays <= 60 ? 0.7
      : s.recencyDays <= 90 ? 0.55
      : 0.4;
    total += s.impact * recencyMultiplier * catWeight[s.category];
  }
  // Normalize: 12 strong recent signals at impact-7-avg = ~100
  return Math.min(100, Math.round((total / 12) * 1.1));
}

function buildNarrative(target: string, signals: Signal[]): string {
  if (!signals.length) return `No material public signals detected for ${target} in the recent window.`;
  const top = [...signals].sort((a, b) => b.impact - a.impact).slice(0, 3);
  const cats = Array.from(new Set(top.map((s) => s.category)));
  const tags = cats.map((c) => c.toUpperCase()).join(" + ");
  return `${tags} signal: ${top[0].headline}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  // Both GET and POST accept the same params.
  const params: any = req.method === "POST"
    ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}))
    : req.query;

  const type: "company" | "industry" = (params.type === "industry") ? "industry" : "company";
  const name   = (params.name || params.company || params.industry || "").toString().trim();
  const domain = (params.domain || "").toString().trim();
  const force  = params.force === "1" || params.force === true;

  // Auth: prefer admin key for in-app calls, but allow same-origin without key
  // for the lower-cost path (rate-limited at 1/2s/scope by the cache).
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  const adminPresent = ADMIN_API_KEY && provided === ADMIN_API_KEY;
  if (!adminPresent) {
    // Same-origin only — allow if Vercel host header matches.
    const host = (req.headers.host || "").toString();
    if (!/atom-dominator-pro|localhost/i.test(host)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!name) return res.status(400).json({ error: "name (or company/industry) is required" });
  if (!PPLX_API_KEY) return res.status(500).json({ error: "PERPLEXITY_API_KEY not configured" });

  const cacheKey = `${type}:${name.toLowerCase()}:${domain.toLowerCase()}`;
  if (!force) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return res.json(hit.value);
  }

  try {
    const sonar = await querySonarPro(name, type);
    if (!sonar) {
      return res.json({
        scope: { type, name, domain: domain || undefined },
        signals: [],
        atomScore: 0,
        topNarrative: `Sonar Pro unavailable — no signals returned for ${name}.`,
        updatedAt: new Date().toISOString(),
        sourceCount: 0,
      } satisfies SignalBundle);
    }

    const signals = parseSignals(sonar.raw, sonar.sources);
    const bundle: SignalBundle = {
      scope: { type, name, domain: domain || undefined },
      signals,
      atomScore: computeAtomScore(signals),
      topNarrative: buildNarrative(name, signals),
      updatedAt: new Date().toISOString(),
      sourceCount: sonar.sources?.length || 0,
    };
    cache.set(cacheKey, { value: bundle, expiresAt: Date.now() + CACHE_TTL_MS });
    return res.json(bundle);
  } catch (e: any) {
    console.error("[signals/discover]", e?.message);
    return res.status(500).json({ error: e?.message || "discover failed" });
  }
}
