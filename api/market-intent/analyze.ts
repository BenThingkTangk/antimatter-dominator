import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

async function getRAGContext(query: string, module: string): Promise<string> {
  if (!query || query.trim().length < 2) return "";
  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: query.trim(), module }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.context || "";
  } catch { return ""; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      productSlug,
      industry,
      region,
      analysisType,
      customQuery,
      timeHorizon,
      topic,
    } = req.body;

    // Fetch RAG context if industry or product specified
    const ragTarget = industry || productSlug || "";
    const ragCtx = ragTarget ? await getRAGContext(ragTarget, "market-intent") : "";

    const systemPrompt = `You are the Antimatter AI Sales Intelligence Engine. Generate deep, actionable market intelligence for enterprise sales teams. You MUST respond with valid JSON only — no markdown, no preamble.

Antimatter AI Products:
- Antimatter AI Platform: Enterprise AI/ML platform
- ATOM Enterprise AI: Secure VPC/on-prem/edge AI deployment
- Vidzee: AI real estate video marketing
- Clinix Agent: AI healthcare billing/RCM
- Clinix AI: AI clinical documentation
- Red Team ATOM: Quantum-resistant cryptography`;

    const userPrompt = `Generate comprehensive market intelligence report:
${productSlug && productSlug !== "all" ? `PRODUCT FOCUS: ${productSlug}` : "ALL PRODUCTS"}
${industry ? `INDUSTRY: ${industry}` : ""}
${region ? `REGION: ${region}` : ""}
${analysisType ? `ANALYSIS TYPE: ${analysisType}` : ""}
${timeHorizon ? `TIME HORIZON: ${timeHorizon}` : "90 days"}
${topic ? `TOPIC: ${topic}` : ""}
${customQuery ? `CUSTOM QUERY: ${customQuery}` : ""}
${ragCtx ? `BACKGROUND INTELLIGENCE:\n${ragCtx}\n` : ""}

Return ONLY this JSON structure (no markdown):
{
  "title": "Compelling report title (10-12 words)",
  "summary": "Executive summary paragraph. 3-4 sentences. High-level findings.",
  "marketSentiment": {
    "score": 72,
    "label": "Moderately Bullish",
    "direction": "bullish|bearish|neutral",
    "reasoning": "One sentence explaining the sentiment score."
  },
  "keySignals": [
    {
      "title": "Signal title (5-8 words)",
      "description": "2-sentence description of what this signal means for sales.",
      "urgency": "critical|high|medium|low",
      "impact": "high|medium|low",
      "category": "technology|regulatory|competitive|economic|behavioral"
    },
    {
      "title": "Signal title",
      "description": "Description.",
      "urgency": "high",
      "impact": "high",
      "category": "regulatory"
    },
    {
      "title": "Signal title",
      "description": "Description.",
      "urgency": "medium",
      "impact": "medium",
      "category": "competitive"
    },
    {
      "title": "Signal title",
      "description": "Description.",
      "urgency": "low",
      "impact": "medium",
      "category": "behavioral"
    }
  ],
  "competitiveMoves": [
    { "competitor": "Competitor name", "move": "What they did (1 sentence)", "threat": "high|medium|low", "opportunity": "How this creates an opening for Antimatter AI (1 sentence)" },
    { "competitor": "Competitor name", "move": "What they did", "threat": "medium", "opportunity": "Opening for us." },
    { "competitor": "Competitor name", "move": "What they did", "threat": "low", "opportunity": "Opening for us." }
  ],
  "opportunities": [
    { "rank": 1, "title": "Opportunity title", "description": "2-sentence opportunity description.", "score": 92, "effort": "low|medium|high", "timeframe": "0-30 days|30-90 days|90+ days" },
    { "rank": 2, "title": "Opportunity title", "description": "Description.", "score": 78, "effort": "medium", "timeframe": "30-90 days" },
    { "rank": 3, "title": "Opportunity title", "description": "Description.", "score": 65, "effort": "high", "timeframe": "90+ days" }
  ],
  "actionItems": [
    { "priority": 1, "action": "Specific action for sales team", "owner": "AE|SDR|CSM|Leadership", "deadline": "This week|This month|This quarter" },
    { "priority": 2, "action": "Specific action", "owner": "SDR", "deadline": "This week" },
    { "priority": 3, "action": "Specific action", "owner": "AE", "deadline": "This month" },
    { "priority": 4, "action": "Specific action", "owner": "Leadership", "deadline": "This quarter" }
  ],
  "talkingPoints": [
    "Compelling talking point 1 for sales conversations",
    "Compelling talking point 2",
    "Compelling talking point 3"
  ],
  "impactLevel": "high|medium|low",
  "category": "market-shift|technology|regulatory|competitive",
  "relevantProducts": "${productSlug && productSlug !== "all" ? productSlug : "all"}"
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.65,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        title: `Market Intent: ${productSlug || "Full Ecosystem"} ${industry ? `— ${industry}` : ""}`,
        summary: raw,
        marketSentiment: { score: 60, label: "Neutral", direction: "neutral", reasoning: "Analysis complete." },
        keySignals: [],
        competitiveMoves: [],
        opportunities: [],
        actionItems: [],
        talkingPoints: [],
        impactLevel: "medium",
        category: "market-shift",
        relevantProducts: productSlug || "all",
      };
    }

    // Legacy compatibility
    return res.json({
      ...parsed,
      id: Date.now(),
      // Legacy fields
      title: parsed.title || `Market Intent: ${productSlug || "Full Ecosystem"}`,
      summary: parsed.summary || raw,
      relevantProducts: parsed.relevantProducts || "[]",
      impactLevel: parsed.impactLevel || "high",
      source: "AI Analysis",
      category: parsed.category || "market-shift",
      createdAt: new Date().toISOString(),
      hasRagContext: ragCtx.length > 50,
    });
  } catch (err: any) {
    console.error("Market intent error:", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
}
