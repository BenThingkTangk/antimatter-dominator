import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

async function getRAGContext(company: string, module: string): Promise<string> {
  if (!company || company.trim().length < 2) return "";
  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: company.trim(), module }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.context || "";
  } catch { return ""; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const {
    productSlug,
    product,
    pitchType,
    industry,
    persona,
    company,
    tone,
    customContext,
  } = req.body;

  const productName = product || productSlug || "";
  const target = company || productName || "";

  // Fetch RAG context in parallel
  const [targetCtx, productCtx] = await Promise.all([
    target ? getRAGContext(target, "pitch") : Promise.resolve(""),
    productName && productName !== target ? getRAGContext(productName, "pitch") : Promise.resolve(""),
  ]);

  const ragContext = [
    targetCtx ? `INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT INTELLIGENCE FOR "${productName}":\n${productCtx}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are the world's #1 B2B enterprise sales expert. Generate highly compelling, specific sales pitches for Antimatter AI products. You MUST respond with valid JSON only — no markdown, no preamble.

Antimatter AI Products:
- Antimatter AI Platform: Enterprise AI/ML platform for building and deploying custom AI models
- ATOM Enterprise AI: Secure VPC/on-prem/edge AI deployment for regulated industries  
- Vidzee: AI-powered real estate video marketing automation
- Clinix Agent: AI billing and revenue cycle management for healthcare
- Clinix AI: AI clinical documentation and scribe assistant for physicians
- Red Team ATOM: Quantum-resistant cryptography and post-quantum security platform`;

  const userPrompt = `Generate a ${pitchType || "cold call opening"} pitch${company ? ` for ${company}` : ""}${productName ? ` selling ${productName}` : ""}${industry ? ` in the ${industry} industry` : ""}${persona ? ` targeting ${persona}` : ""}${tone ? ` with a ${tone} tone` : ""}.

${customContext ? `ADDITIONAL CONTEXT: ${customContext}\n` : ""}
${ragContext ? `USE THIS INTELLIGENCE TO MAKE THE PITCH HIGHLY SPECIFIC:\n${ragContext}\n` : ""}

Return ONLY this JSON structure (no markdown):
{
  "mainPitch": "The complete pitch text with clear paragraph breaks. Should be compelling and specific. 150-250 words.",
  "powerPhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
  "alternatives": [
    { "type": "Direct Opener", "text": "30-word punchy opener variation 1" },
    { "type": "Question Hook", "text": "30-word question-based opener variation 2" },
    { "type": "Insight Lead", "text": "30-word insight-based opener variation 3" }
  ],
  "emotions": {
    "confidence": 85,
    "urgency": 70,
    "empathy": 60,
    "authority": 80,
    "enthusiasm": 75
  },
  "confidenceScore": 87,
  "confidenceReasoning": "One sentence explaining the confidence score",
  "detectedObjections": ["likely objection 1", "likely objection 2"],
  "suggestedFollowUp": "Specific follow-up question to ask after delivering this pitch",
  "category": "${pitchType || "cold-call"}",
  "product": "${productName}",
  "persona": "${persona || "Executive"}",
  "tone": "${tone || "Professional"}"
}`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: return raw as mainPitch
      parsed = {
        mainPitch: raw,
        powerPhrases: [],
        alternatives: [],
        emotions: { confidence: 75, urgency: 65, empathy: 60, authority: 70, enthusiasm: 70 },
        confidenceScore: 72,
        confidenceReasoning: "Generated from available context.",
        detectedObjections: [],
        suggestedFollowUp: "",
        category: pitchType || "cold-call",
        product: productName,
        persona: persona || "Executive",
        tone: tone || "Professional",
      };
    }

    // Also include legacy 'content' field for backward compatibility
    return res.json({
      ...parsed,
      content: parsed.mainPitch || raw,
      hasRagContext: ragContext.length > 50,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
