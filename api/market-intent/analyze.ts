import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Antimatter AI Sales Dominator. Products: 1) Antimatter AI Platform (full-service AI dev, product design, healthcare, IoT, GTM) 2) ATOM Enterprise AI (enterprise AI framework, VPC/on-prem/edge, model-agnostic, Akamai edge) 3) Vidzee (AI real estate video) 4) Clinix Agent (AI billing/denial appeals) 5) Clinix AI (AI SOAP notes, ICD-10/CPT coding) 6) Red Team ATOM (quantum-ready red team, PQC, MITRE ATLAS). Style: Direct, data-driven, actionable.`;

const ALL_PRODUCTS = ["Antimatter AI Platform (platform)", "ATOM Enterprise AI (enterprise-ai)", "Vidzee (real-estate)", "Clinix Agent (healthcare)", "Clinix AI (healthcare)", "Red Team ATOM (cybersecurity)"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, industry, topic } = req.body;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Generate market intelligence for the Antimatter AI ecosystem.\n\n${productSlug && productSlug !== "all" ? `Focus Product: ${productSlug}` : "All products"}\n${industry ? `Target Industry: ${industry}` : ""}\n${topic ? `Topic Focus: ${topic}` : ""}\n\nAvailable Products: ${ALL_PRODUCTS.join(", ")}\n\nProvide:\n1. MARKET TRENDS — 3-4 trends creating demand (specific data points)\n2. BUYER SIGNALS — What indicates a company is ready to buy\n3. COMPETITIVE LANDSCAPE — How we win against alternatives\n4. TALK TRACKS — 2-3 conversation frameworks per relevant product\n5. URGENCY DRIVERS — Why prospects need to act NOW\n\nFormat as actionable intelligence for today. Include specific industries and scenarios.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    res.json({ id: Date.now(), title: `Market Intent: ${productSlug || "Full Ecosystem"} ${industry ? `— ${industry}` : ""}`, summary: content, relevantProducts: "[]", impactLevel: "high", source: "AI Analysis", category: "market-shift", createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Market intent error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze" });
  }
}
