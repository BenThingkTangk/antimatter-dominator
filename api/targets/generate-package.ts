/**
 * ATOM Target Intelligence Engine — Package Generator
 * Generates the full 5-section Operator Intel Package for an HVT target
 * via 5 parallel Perplexity Sonar calls.
 *
 * POST /api/targets/generate-package
 * Body: { company: string, website?: string, industry?: string, product?: string }
 *
 * Returns: { marketIntent, pitch, objections, warbook, prospects, sources }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

interface GenerateRequest {
  company: string;
  website?: string;
  industry?: string;
  product?: string;
}

async function sonar(messages: any[], model = "sonar-pro", maxTokens = 1500): Promise<{ content: string; sources: string[] }> {
  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      return_citations: true,
    }),
    signal: AbortSignal.timeout(50000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const sources: string[] = (data.citations || []).filter(Boolean);
  return { content, sources };
}

const SECTION_PROMPTS = {
  market_intent: (co: string, product?: string) => `Research ${co} for Market Intent. Identify buying triggers, active initiatives, budget cycles, pain points, and recent signals (funding, leadership changes, tech adoption, hiring) that make ${product || "enterprise solutions"} relevant NOW. Output 3-5 paragraphs with specific dated evidence.`,

  pitch: (co: string, product?: string) => `Craft a precision pitch for ${co}. Based on their current strategic priorities, org structure, and recent moves, write a 3-paragraph cold outreach pitch selling ${product || "an enterprise solution"}. Open with a hyper-specific observation about ${co}, connect it to a pain point, propose a measurable outcome. NO generic fluff. Reference real company details.`,

  objections: (co: string, product?: string) => `Research ${co} and predict the 5 most likely sales objections ${co} executives will raise when pitched ${product || "an enterprise solution"}. For each: state the objection, explain why THIS company will raise it (based on their specific situation), and give a battle-tested counter-response. Format as 5 numbered Objection / Why / Counter blocks.`,

  warbook: (co: string) => `Build a WarBook intelligence dossier on ${co}. Include: (1) Company overview and strategy, (2) Key executives by name and title — especially CEO, CRO, CFO, CTO, CIO, (3) Recent news, funding, leadership changes in last 90 days, (4) Known tech stack and vendors, (5) Main competitors and market position, (6) Public pain points or challenges. Output in clear sections with headers.`,

  prospects: (co: string) => `Identify the top 8 decision-maker prospects at ${co} who would buy enterprise software. For each: Name, Title, Role in decision (Economic Buyer / Technical Gatekeeper / Champion / Blocker / Influencer), and WHY they matter for this deal. Include LinkedIn URLs if known. Focus on C-suite, VPs, and Directors.`,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!PERPLEXITY_API_KEY) return res.status(500).json({ error: "PERPLEXITY_API_KEY not configured" });

  const { company, website, industry, product }: GenerateRequest = req.body || {};
  if (!company) return res.status(400).json({ error: "company required" });

  const systemPrompt = `You are the ATOM Target Intelligence Engine. You produce elite-grade, sourced, fact-based sales intelligence. No fluff, no filler, no hallucinations. Cite sources via [1], [2] inline. Always include specific names, dates, numbers.`;

  const build = (sectionPrompt: string) => [
    { role: "system", content: systemPrompt },
    { role: "user", content: sectionPrompt },
  ];

  try {
    // Run 5 parallel Sonar calls — each will fit in Vercel's 60s timeout
    const results = await Promise.allSettled([
      sonar(build(SECTION_PROMPTS.market_intent(company, product)), "sonar-pro", 1500),
      sonar(build(SECTION_PROMPTS.pitch(company, product)), "sonar-pro", 1200),
      sonar(build(SECTION_PROMPTS.objections(company, product)), "sonar-pro", 1500),
      sonar(build(SECTION_PROMPTS.warbook(company)), "sonar-pro", 2000),
      sonar(build(SECTION_PROMPTS.prospects(company)), "sonar-pro", 1500),
    ]);

    const [marketIntent, pitch, objections, warbook, prospects] = results;
    const sectionResult = (r: PromiseSettledResult<{ content: string; sources: string[] }>) =>
      r.status === "fulfilled"
        ? { status: "ready" as const, content: r.value.content, sources: r.value.sources }
        : { status: "failed" as const, content: "", sources: [], error: (r.reason as Error)?.message };

    const sections = {
      market_intent: sectionResult(marketIntent),
      pitch: sectionResult(pitch),
      objections: sectionResult(objections),
      warbook: sectionResult(warbook),
      prospects: sectionResult(prospects),
    };

    const allSources = Array.from(new Set(
      Object.values(sections).flatMap(s => s.sources || [])
    ));

    const failedCount = Object.values(sections).filter(s => s.status === "failed").length;
    const overallStatus =
      failedCount === 0 ? "ready" :
      failedCount === 5 ? "failed" : "degraded";

    return res.json({
      company,
      sections,
      allSources,
      overallStatus,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Target package generation failed" });
  }
}
