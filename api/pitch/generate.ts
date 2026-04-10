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

  const { product, pitchType, industry, persona, company } = req.body;
  const target = company || product || "";

  // Fetch RAG context for both target and product in parallel
  const [targetCtx, productCtx] = await Promise.all([
    target ? getRAGContext(target, "pitch") : Promise.resolve(""),
    product && product !== target ? getRAGContext(product, "pitch") : Promise.resolve(""),
  ]);

  const ragContext = [
    targetCtx ? `INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT INTELLIGENCE FOR "${product}":\n${productCtx}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are the world's #1 B2B enterprise sales rep. Generate specific, compelling pitches grounded in real company intelligence." },
          { role: "user", content: `Generate a ${pitchType || "discovery"} pitch${company ? ` for ${company}` : ""}${product ? ` selling ${product}` : ""}${industry && industry !== "All Industries" ? ` in the ${industry} industry` : ""}${persona ? ` targeting ${persona}` : ""}.

${ragContext ? `USE THIS INTELLIGENCE TO MAKE THE PITCH HIGHLY SPECIFIC:\n${ragContext}\n` : ""}

Structure the pitch with clear sections:
**OPENER** (10 seconds, creates curiosity and gets attention)
**VALUE PITCH** (30 seconds, addresses specific pain points from the intelligence above)
**PROOF POINT** (specific stat, case study, or differentiation relevant to their situation)
**CALL TO ACTION** (specific ask for next step)

Make it conversational, human, and reference SPECIFIC details from the intelligence. No generic phrases.` },
        ],
        temperature: 0.5,
      }),
    });
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    return res.json({ content, hasRagContext: ragContext.length > 50 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
