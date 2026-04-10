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

  const { selectedProduct, objectionText, context, selectedCategory, company } = req.body;
  const target = company || selectedProduct || "";

  // Fetch RAG context for both company and product
  const [targetCtx, productCtx] = await Promise.all([
    target ? getRAGContext(target, "objections") : Promise.resolve(""),
    selectedProduct && selectedProduct !== target ? getRAGContext(selectedProduct, "objections") : Promise.resolve(""),
  ]);

  const ragContext = [
    targetCtx ? `OBJECTION INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT OBJECTION PLAYBOOK FOR "${selectedProduct}":\n${productCtx}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an elite sales trainer. Generate specific, data-backed objection responses grounded in real company intelligence." },
          { role: "user", content: `Handle this sales objection:

OBJECTION: "${objectionText}"
${selectedCategory ? `CATEGORY: ${selectedCategory}` : ""}
${context ? `CONTEXT: ${context}` : ""}
${target ? `COMPANY/PRODUCT: ${target}` : ""}

${ragContext ? `INTELLIGENCE TO USE:\n${ragContext}\n` : ""}

Respond with:
**ACKNOWLEDGE** (1 sentence validating their specific concern)
**REFRAME** (2 sentences using specific data/evidence from the intelligence to shift perspective)  
**PROVE** (one specific proof point — stat, case study, or competitive fact from the intelligence)
**CLOSE** (one question that moves the conversation forward)

Be highly specific. Reference REAL details from the intelligence. Avoid generic sales language.` },
        ],
        temperature: 0.4,
      }),
    });
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Return both 'response' (for existing frontend) and 'content' (for RAG-aware components)
    return res.json({ response: content, content, hasRagContext: ragContext.length > 50 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
