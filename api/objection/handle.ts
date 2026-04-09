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
    selectedProduct,
    objection,
    objectionText,
    context,
    company,
  } = req.body;

  const productName = selectedProduct || productSlug || "";
  const objText = objection || objectionText || "";
  const target = company || productName || "";

  // Fetch RAG context
  const [targetCtx, productCtx] = await Promise.all([
    target ? getRAGContext(target, "objections") : Promise.resolve(""),
    productName && productName !== target ? getRAGContext(productName, "objections") : Promise.resolve(""),
  ]);

  const ragContext = [
    targetCtx ? `OBJECTION INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT OBJECTION PLAYBOOK FOR "${productName}":\n${productCtx}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are an elite enterprise sales trainer and deal-closer. Handle sales objections with precision and empathy. You MUST respond with valid JSON only — no markdown, no preamble.

Antimatter AI Products:
- Antimatter AI Platform: Enterprise AI/ML platform for building and deploying custom AI models
- ATOM Enterprise AI: Secure VPC/on-prem/edge AI deployment for regulated industries
- Vidzee: AI-powered real estate video marketing automation
- Clinix Agent: AI billing and revenue cycle management for healthcare
- Clinix AI: AI clinical documentation and scribe assistant for physicians
- Red Team ATOM: Quantum-resistant cryptography and post-quantum security platform`;

  const userPrompt = `Handle this sales objection:

OBJECTION: "${objText}"
${context ? `CONTEXT: ${context}` : ""}
${productName ? `PRODUCT: ${productName}` : ""}

${ragContext ? `INTELLIGENCE TO USE:\n${ragContext}\n` : ""}

Analyze the objection and return ONLY this JSON structure (no markdown):
{
  "primaryResponse": "The main counter-argument response. 3-4 sentences. Acknowledge, reframe with data, prove with specifics, close with question. Make it conversational and specific.",
  "detectedCategory": "price|timing|competition|authority|need|trust",
  "categoryConfidence": 92,
  "sentiment": {
    "hostility": 35,
    "curiosity": 65,
    "buyingSignalStrength": 58,
    "recommendedTone": "Empathetic|Direct|Educational|Reassuring"
  },
  "strategies": [
    {
      "type": "Acknowledge & Redirect",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    },
    {
      "type": "Reframe",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    },
    {
      "type": "Social Proof",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    }
  ],
  "followUpQuestions": [
    "Follow-up question 1 to keep conversation going?",
    "Follow-up question 2 to uncover more?",
    "Follow-up question 3 to advance the sale?"
  ],
  "urgencyLevel": "low|medium|high",
  "closingProbability": 62,
  "keyInsight": "One sentence insight about the hidden concern behind this objection."
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
        temperature: 0.4,
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
        primaryResponse: raw,
        detectedCategory: "general",
        categoryConfidence: 70,
        sentiment: { hostility: 40, curiosity: 60, buyingSignalStrength: 50, recommendedTone: "Empathetic" },
        strategies: [],
        followUpQuestions: [],
        urgencyLevel: "medium",
        closingProbability: 50,
        keyInsight: "Review the objection context for deeper insights.",
      };
    }

    // Legacy compatibility fields
    return res.json({
      ...parsed,
      response: parsed.primaryResponse || raw,
      content: parsed.primaryResponse || raw,
      category: parsed.detectedCategory || "general",
      hasRagContext: ragContext.length > 50,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
