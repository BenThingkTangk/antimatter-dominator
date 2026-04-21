/**
 * ATOM Target Intelligence Engine — Daily Brief Generator
 * Generates one morning Operator Intel brief for a single target via Perplexity Sonar.
 *
 * POST /api/targets/daily-brief
 * Body: { company: string, product?: string }
 *
 * Returns: { briefDate, summary, overnightTriggers, whyNow, pitchAngle, recommendedAction, dailySignalScore, signals, sources }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

const SIGNAL_WEIGHTS: Record<string, number> = {
  funding: 4, new_c_suite: 3, leadership: 3, hiring_surge: 3, job_post_matching: 3,
  job_posting: 2, competitor_mention: 2, product_launch: 2, earnings: 2,
  tech_change: 2, contract_win: 2, news: 1, conference: 1,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!PERPLEXITY_API_KEY) return res.status(500).json({ error: "PERPLEXITY_API_KEY not configured" });

  const { company, product } = req.body || {};
  if (!company) return res.status(400).json({ error: "company required" });

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are the ATOM Target Intelligence Engine — Von Clausewitz Daily Brief module. You produce elite-grade morning intelligence for a sales rep. Output VALID JSON only, no markdown.`;

  const userPrompt = `Research ${company} as of ${today}. Identify signals from the LAST 7 DAYS making them likely to buy ${product || "enterprise software"} now.

Output this exact JSON structure:
{
  "summary": "<3-sentence executive summary of ${company}'s current state>",
  "overnightTriggers": [
    "<specific dated event 1>",
    "<specific dated event 2>"
  ],
  "whyNow": "<2-sentence explanation of why ${company} is in-market RIGHT NOW>",
  "pitchAngle": "<2-sentence recommended pitch angle based on today's intel>",
  "recommendedAction": "<specific action the rep should take today (call X person / send Y email / reference Z news)>",
  "signals": [
    {
      "type": "<funding|new_c_suite|leadership|hiring_surge|job_posting|competitor_mention|product_launch|earnings|tech_change|contract_win|news|conference|job_post_matching>",
      "description": "<exact signal description>",
      "impactScore": <1-10>,
      "source": "<source name>",
      "date": "<YYYY-MM-DD>"
    }
  ],
  "dailySignalScore": <0-10 overall hotness>
}

Include sources as [1], [2] inline in summary/whyNow fields. If no strong signals, return signals: [] and dailySignalScore: 0-3.`;

  try {
    const sonarRes = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        return_citations: true,
        response_format: { type: "json_schema", json_schema: {
          name: "daily_brief",
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              overnightTriggers: { type: "array", items: { type: "string" } },
              whyNow: { type: "string" },
              pitchAngle: { type: "string" },
              recommendedAction: { type: "string" },
              signals: { type: "array", items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  description: { type: "string" },
                  impactScore: { type: "number" },
                  source: { type: "string" },
                  date: { type: "string" },
                },
                required: ["type", "description", "impactScore"],
              }},
              dailySignalScore: { type: "number" },
            },
            required: ["summary", "overnightTriggers", "whyNow", "pitchAngle", "recommendedAction", "signals", "dailySignalScore"],
          },
        }},
      }),
      signal: AbortSignal.timeout(50000),
    });

    if (!sonarRes.ok) {
      const errText = await sonarRes.text().catch(() => "");
      throw new Error(`Perplexity ${sonarRes.status}: ${errText.slice(0, 200)}`);
    }

    const data = await sonarRes.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    const sources: string[] = (data.citations || []).filter(Boolean);

    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      // Fallback: try to extract JSON from text
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    // Recompute daily signal score from weighted signals for consistency
    let computedScore = 0;
    if (Array.isArray(parsed.signals)) {
      const raw = parsed.signals.reduce((sum: number, s: any) => {
        const weight = SIGNAL_WEIGHTS[s.type] || 1;
        const impact = (s.impactScore || 5) / 10;
        return sum + weight * impact;
      }, 0);
      computedScore = Math.min(10, Math.round(raw * 10) / 10);
    }

    return res.json({
      briefDate: today,
      summary: parsed.summary || "No fresh intelligence detected.",
      overnightTriggers: parsed.overnightTriggers || [],
      whyNow: parsed.whyNow || "",
      pitchAngle: parsed.pitchAngle || "",
      recommendedAction: parsed.recommendedAction || "",
      signals: parsed.signals || [],
      dailySignalScore: Math.max(parsed.dailySignalScore || 0, computedScore),
      sources,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Daily brief generation failed" });
  }
}
