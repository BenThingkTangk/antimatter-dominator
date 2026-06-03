/**
 * ATOM Researcher Pro / Sonar — shared deep-research engine.
 *
 * This module is the single source of truth for the Vibranium-tier research
 * worker. It is consumed by:
 *   - api/atom-researcher.ts        (Vercel serverless function — production)
 *   - server/routes.ts              (Express route — local dev)
 *
 * It calls Perplexity Sonar server-side ONLY using PERPLEXITY_API_KEY and
 * returns a structured, citation-backed executive dossier. No secret ever
 * reaches the client.
 */

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

export const PERPLEXITY_API_KEY = clean(process.env.PERPLEXITY_API_KEY);
const PERPLEXITY_MODEL_RESEARCH = clean(process.env.PERPLEXITY_MODEL_RESEARCH);
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export type ResearchMode =
  | "fast_scan"
  | "pro_dossier"
  | "deep_research"
  | "vibranium_war_room";

export interface ResearchRequest {
  companyName?: string;
  domain?: string;
  contactName?: string;
  contactTitle?: string;
  linkedinUrl?: string;
  salesObjective?: string;
  offering?: string;
  competitor?: string;
  notes?: string;
  mode?: ResearchMode;
}

export interface SourceMapEntry {
  index: number;
  url: string;
  title: string;
  domain: string;
  /** 0–100 heuristic credibility score. */
  quality: number;
  tier: "primary" | "credible" | "secondary";
}

export interface Dossier {
  company: string;
  mode: ResearchMode;
  confidence: number; // 0–100
  confidenceLabel: "High" | "Moderate" | "Low";
  sourceThin: boolean;
  executiveBrief: string;
  sections: { id: string; title: string; markdown: string }[];
  buyingSignals: {
    category: string;
    detected: boolean;
    detail: string;
  }[];
  sourceMap: SourceMapEntry[];
  generatedAt: string;
}

// ── The ATOM Researcher Pro system prompt (verbatim per build brief) ─────────
export const ATOM_RESEARCHER_SYSTEM_PROMPT = `You are ATOM Researcher Pro / Sonar, a Vibranium-tier deep research intelligence agent inside the ATOM platform.

Your job is to create source-backed, sales-actionable, executive-grade research dossiers.

You must:
1. Research the target through multiple angles.
2. Prefer official company sources, credible news, filings, job postings, leadership pages, reputable databases, and recent web signals.
3. Cite sources inline for factual claims.
4. Separate verified facts from analysis.
5. Flag uncertainty.
6. Never invent facts.
7. Prioritize recent information.
8. Generate practical sales strategy, not generic summaries.
9. Build a dossier that a founder, CRO, AE, SDR, partner lead, or investor could use immediately before a call.
10. Include source URLs in a structured source map.

Your research dimensions:
- Company identity and positioning
- Products/services
- Industry and ICP
- Recent news
- Leadership and decision makers
- Funding, growth, hiring, expansion, partnerships, acquisitions, launches
- Technology signals
- Pain points and likely business priorities
- Competitive environment
- Buying triggers
- Strategic relevance to the user's offering
- Best call angle
- Discovery questions
- Objections and counters
- Outreach hooks
- Confidence level

Output must be structured, concise, factual, and actionable.

FORMATTING RULES:
- Respond in GitHub-flavored Markdown.
- Use these EXACT level-2 headings in this EXACT order, each with the leading number:
  ## 1. Executive Brief
  ## 2. Company Snapshot
  ## 3. Recent Developments
  ## 4. Buying Signals
  ## 5. Pain Points
  ## 6. Contact / Persona Brief
  ## 7. Competitive Context
  ## 8. Strategic Fit
  ## 9. Call Strategy
  ## 10. Outreach Angles
  ## 11. Confidence + Gaps
  ## 12. Source Map
- Cite factual claims inline using bracket notation like [1], [2] that map to the numbered Source Map.
- In "Buying Signals", explicitly label each of these categories as DETECTED or NOT DETECTED with a one-line justification: Funding, Hiring, Expansion, Product launch, Compliance pressure, Tech migration, Competitor weakness, Leadership change, Customer pain, Market event.
- In "Confidence + Gaps", begin with a line "Confidence: NN%" where NN is your overall 0-100 confidence, then list what is VERIFIED vs INFERRED and any gaps.
- In "Source Map", list every source as a numbered markdown list item with a clickable URL and a 3-6 word description of what it supports.
- If sources are thin or the target could not be confidently identified, say so plainly. NEVER fabricate URLs, figures, names, or quotes.`;

// ── Mode → model + search strategy ───────────────────────────────────────────
// Configurable strategy. PERPLEXITY_MODEL_RESEARCH overrides the model for the
// two deep tiers if set; otherwise we fall back to the best safe defaults.
interface ModeStrategy {
  model: string;
  searchContextSize: "low" | "medium" | "high";
  recency?: "day" | "week" | "month" | "year";
  maxTokens: number;
  temperature: number;
  label: string;
}

export function strategyForMode(mode: ResearchMode): ModeStrategy {
  const deepModel = PERPLEXITY_MODEL_RESEARCH || "sonar-pro";
  switch (mode) {
    case "fast_scan":
      return { model: "sonar", searchContextSize: "low", recency: "month", maxTokens: 2200, temperature: 0.2, label: "Fast Scan" };
    case "deep_research":
      return { model: deepModel, searchContextSize: "high", recency: "month", maxTokens: 4200, temperature: 0.25, label: "Deep Research" };
    case "vibranium_war_room":
      return { model: deepModel, searchContextSize: "high", recency: "week", maxTokens: 5000, temperature: 0.3, label: "Vibranium War Room" };
    case "pro_dossier":
    default:
      return { model: deepModel, searchContextSize: "high", recency: "month", maxTokens: 3400, temperature: 0.25, label: "Pro Dossier" };
  }
}

const RESEARCH_DOMAIN_FILTER = [
  "sec.gov", "linkedin.com", "crunchbase.com", "techcrunch.com",
  "bloomberg.com", "reuters.com", "wsj.com", "ft.com", "gartner.com",
  "forbes.com", "businessinsider.com", "g2.com", "pitchbook.com",
  "prnewswire.com", "businesswire.com", "glassdoor.com",
];

export function buildUserPrompt(req: ResearchRequest): string {
  const lines: string[] = [];
  lines.push("Build a Vibranium-tier deep-research sales dossier on the following target.");
  lines.push("");
  lines.push("=== TARGET ===");
  if (req.companyName) lines.push(`Company: ${req.companyName}`);
  if (req.domain) lines.push(`Domain / website: ${req.domain}`);
  if (req.contactName) lines.push(`Contact name: ${req.contactName}`);
  if (req.contactTitle) lines.push(`Contact title: ${req.contactTitle}`);
  if (req.linkedinUrl) lines.push(`Contact LinkedIn: ${req.linkedinUrl}`);
  lines.push("");
  lines.push("=== SELLER CONTEXT ===");
  if (req.offering) lines.push(`We are selling / offering: ${req.offering}`);
  if (req.salesObjective) lines.push(`Sales objective for this engagement: ${req.salesObjective}`);
  if (req.competitor) lines.push(`Competitor / strategic angle to account for: ${req.competitor}`);
  if (req.notes) lines.push(`Additional notes / context from the rep: ${req.notes}`);
  lines.push("");
  lines.push(
    "Produce all 12 sections in the exact required format. Tie every recommendation back to the seller context above. " +
    "Prioritise the most recent, verifiable information. Where you cannot verify something, mark it INFERRED and lower your confidence accordingly."
  );
  return lines.join("\n");
}

// ── Source-quality heuristic ─────────────────────────────────────────────────
const PRIMARY_DOMAINS = ["sec.gov", "investor.", "ir.", "/investor", "annualreport"];
const CREDIBLE_DOMAINS = [
  "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "crunchbase.com",
  "pitchbook.com", "gartner.com", "forrester.com", "techcrunch.com",
  "forbes.com", "prnewswire.com", "businesswire.com", "linkedin.com",
  "g2.com", "glassdoor.com",
];

function scoreSource(url: string, index: number): SourceMapEntry {
  let domain = "";
  let title = `Source ${index}`;
  try {
    const u = new URL(url);
    domain = u.hostname.replace(/^www\./, "");
    title = domain + (u.pathname !== "/" ? u.pathname.slice(0, 48) : "");
  } catch {
    domain = "unknown";
  }
  const lower = url.toLowerCase();
  let tier: SourceMapEntry["tier"] = "secondary";
  let quality = 45;
  if (PRIMARY_DOMAINS.some((d) => lower.includes(d)) || domain.endsWith(".gov")) {
    tier = "primary";
    quality = 95;
  } else if (CREDIBLE_DOMAINS.some((d) => domain.includes(d))) {
    tier = "credible";
    quality = 78;
  } else if (lower.startsWith("https://")) {
    quality = 55;
  }
  // Official company domain (matches target) would be primary — handled by caller.
  return { index, url, title, domain, quality, tier };
}

const SIGNAL_CATEGORIES = [
  "Funding", "Hiring", "Expansion", "Product launch", "Compliance pressure",
  "Tech migration", "Competitor weakness", "Leadership change", "Customer pain", "Market event",
];

/** Parse the model's Markdown into the structured Dossier shape. */
export function parseDossier(
  markdown: string,
  citations: string[],
  req: ResearchRequest,
  mode: ResearchMode,
): Dossier {
  const company = req.companyName || req.domain || "Target";

  // Split on level-2 headings "## N. Title".
  const sectionRegex = /^##\s+\d+\.\s+(.+)$/gm;
  const sections: { id: string; title: string; markdown: string }[] = [];
  const matches: { title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(markdown)) !== null) {
    matches.push({ title: m[1].trim(), start: m.index, end: -1 });
  }
  for (let i = 0; i < matches.length; i++) {
    const startBody = markdown.indexOf("\n", matches[i].start) + 1;
    const end = i + 1 < matches.length ? matches[i + 1].start : markdown.length;
    const body = markdown.slice(startBody, end).trim();
    sections.push({
      id: matches[i].title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      title: matches[i].title,
      markdown: body,
    });
  }

  const findSection = (kw: string) =>
    sections.find((s) => s.title.toLowerCase().includes(kw));

  const execSection = findSection("executive");
  const executiveBrief = execSection?.markdown || markdown.slice(0, 600);

  // Confidence: prefer the model's "Confidence: NN%" line, else derive from sources.
  let confidence = 0;
  const confSection = findSection("confidence");
  const confMatch = (confSection?.markdown || markdown).match(/confidence\s*[:=]?\s*(\d{1,3})\s*%/i);
  if (confMatch) confidence = Math.min(100, parseInt(confMatch[1], 10));

  // Buying signals — read DETECTED / NOT DETECTED labels from the signals section.
  const signalsBody = findSection("buying signal")?.markdown || "";
  const buyingSignals = SIGNAL_CATEGORIES.map((category) => {
    const re = new RegExp(`${category.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^\\n]*`, "i");
    const line = signalsBody.match(re)?.[0] || "";
    const detected = /detected/i.test(line) && !/not\s+detected/i.test(line);
    const detail = line.replace(new RegExp(`^[^A-Za-z0-9]*${category}[^A-Za-z0-9]*`, "i"), "").trim();
    return { category, detected, detail: detail || (line ? line.trim() : "No clear signal in current sources.") };
  });

  // Source map. Prefer Perplexity citations array; fall back to URLs in markdown.
  const urls = citations.length
    ? citations
    : Array.from(new Set((markdown.match(/https?:\/\/[^\s)\]]+/g) || [])));
  const targetDomain = (req.domain || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const sourceMap: SourceMapEntry[] = urls.map((url, i) => {
    const entry = scoreSource(url, i + 1);
    if (targetDomain && entry.domain.includes(targetDomain)) {
      entry.tier = "primary";
      entry.quality = Math.max(entry.quality, 90);
    }
    return entry;
  });

  const sourceThin = sourceMap.length < 3;
  if (!confidence) {
    // Derive a confidence floor from source count + quality when model omitted it.
    const avgQ = sourceMap.length ? sourceMap.reduce((a, s) => a + s.quality, 0) / sourceMap.length : 30;
    confidence = Math.round(Math.min(85, (sourceMap.length >= 6 ? 70 : sourceMap.length * 11) * 0.6 + avgQ * 0.4));
  }
  if (sourceThin) confidence = Math.min(confidence, 55);

  const confidenceLabel: Dossier["confidenceLabel"] =
    confidence >= 75 ? "High" : confidence >= 50 ? "Moderate" : "Low";

  return {
    company,
    mode,
    confidence,
    confidenceLabel,
    sourceThin,
    executiveBrief,
    sections,
    buyingSignals,
    sourceMap,
    generatedAt: new Date().toISOString(),
  };
}

// Best-effort durable persistence. No-op unless Supabase is configured, and
// never blocks or fails the research response (history also lives client-side).
async function persistDossier(researchId: string, req: ResearchRequest, dossier: Dossier, rawMarkdown: string, model: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/atom_research_dossiers`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify({
        research_id: researchId,
        company: dossier.company,
        domain: req.domain || null,
        contact_name: req.contactName || null,
        contact_title: req.contactTitle || null,
        mode: dossier.mode,
        confidence: dossier.confidence,
        source_count: dossier.sourceMap.length,
        model,
        dossier,
        raw_markdown: rawMarkdown,
        request: req,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // swallow — persistence is best-effort
  }
}

export interface RunResult {
  ok: boolean;
  researchId?: string;
  mode?: ResearchMode;
  dossier?: Dossier;
  rawMarkdown?: string;
  model?: string;
  latencyMs?: number;
  error?: string;
  details?: string;
}

/**
 * Run the deep-research pipeline. Throws nothing — always returns a RunResult.
 * Caller is responsible for the missing-key configuration state (checked via
 * PERPLEXITY_API_KEY) BEFORE calling this so it can return the polished message.
 */
export async function runResearch(req: ResearchRequest): Promise<RunResult> {
  const mode: ResearchMode = req.mode || "pro_dossier";
  const researchId = `atomr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  if (!req.companyName && !req.domain) {
    return { ok: false, error: "missing_target", details: "companyName or domain is required." };
  }
  if (!PERPLEXITY_API_KEY) {
    return { ok: false, error: "perplexity_not_configured", details: "PERPLEXITY_API_KEY is not configured." };
  }

  const strat = strategyForMode(mode);
  const body: any = {
    model: strat.model,
    messages: [
      { role: "system", content: ATOM_RESEARCHER_SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(req) },
    ],
    temperature: strat.temperature,
    max_tokens: strat.maxTokens,
    return_citations: true,
    search_recency_filter: strat.recency,
    web_search_options: { search_context_size: strat.searchContextSize },
    search_domain_filter: RESEARCH_DOMAIN_FILTER,
  };

  const t0 = Date.now();
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(mode === "fast_scan" ? 45_000 : 110_000),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return {
        ok: false,
        researchId,
        mode,
        error: "perplexity_error",
        details: `Perplexity returned ${r.status}: ${detail.slice(0, 400)}`,
      };
    }

    const data: any = await r.json();
    const rawMarkdown: string = data?.choices?.[0]?.message?.content || "";
    if (!rawMarkdown.trim()) {
      return { ok: false, researchId, mode, error: "empty_response", details: "Perplexity returned an empty dossier body." };
    }
    const citations: string[] = Array.isArray(data?.citations)
      ? data.citations.filter((c: any) => typeof c === "string")
      : [];

    const dossier = parseDossier(rawMarkdown, citations, req, mode);

    void persistDossier(researchId, req, dossier, rawMarkdown, strat.model);

    return {
      ok: true,
      researchId,
      mode,
      dossier,
      rawMarkdown,
      model: strat.model,
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || /aborted|timeout/i.test(err?.message || "");
    return {
      ok: false,
      researchId,
      mode,
      error: isAbort ? "timeout" : "research_failed",
      details: err?.message || "Unknown error during research run.",
    };
  }
}
