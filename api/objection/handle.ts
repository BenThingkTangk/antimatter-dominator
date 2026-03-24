import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Antimatter AI Sales Dominator — a lethal sales AI. Products: 1) Antimatter AI Platform 2) ATOM Enterprise AI 3) Vidzee 4) Clinix Agent 5) Clinix AI 6) Red Team ATOM. Style: Direct, confident, data-driven. No fluff.`;

const PRODUCTS: Record<string, any> = {
  "antimatter-ai": { name: "Antimatter AI Platform", description: "Full-service AI development, product design, GTM.", valueProps: "20+ projects, 100% satisfaction, AI-native, 3-5x faster", competitiveEdge: "AI-native. Design + engineering + AI + GTM under one roof.", commonObjections: "in-house team, expensive, not ready, burned before" },
  "atom-enterprise": { name: "ATOM Enterprise AI", description: "Enterprise AI framework. Deploy VPC/on-prem/edge.", valueProps: "Own your AI, zero-training, no vendor lock-in, edge deployment", competitiveEdge: "Framework not tool. Hard isolation. Zero-training. Beats Kore.ai, Copilot Studio.", commonObjections: "own infrastructure, too complex, locked in, compliance" },
  "vidzee": { name: "Vidzee", description: "AI real estate videos in 5 min.", valueProps: "5-min videos, save $200-500/video, 12,400+ created", competitiveEdge: "Replaces $500 videographer with 5-minute AI.", commonObjections: "already have videographer, not professional, don't need video" },
  "clinix-agent": { name: "Clinix Agent", description: "AI billing/denial appeals for healthcare.", valueProps: "Stop denials, success-based pricing, real-time tracking", competitiveEdge: "Stedi rails + ML. Pay only on success.", commonObjections: "have billing team, HIPAA concerns, manageable denial rate" },
  "clinix-ai": { name: "Clinix AI", description: "AI SOAP notes, ICD-10/CPT coding.", valueProps: "Cut documentation 70%, reduce denials, save 2-3 hrs/day", competitiveEdge: "Clinical context understanding. Real-time coding + EHR.", commonObjections: "can't capture nuance, comfortable with workflow, accuracy concerns" },
  "red-team-atom": { name: "Red Team ATOM", description: "Autonomous quantum-ready red team range.", valueProps: "Only quantum-ready, real-time telemetry, MITRE ATLAS", competitiveEdge: "First quantum-ready red team. Continuous vs annual pen tests.", commonObjections: "quantum years away, do annual pen tests, too advanced" }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, objection, context } = req.body;
    const product = PRODUCTS[productSlug];
    if (!product) return res.status(404).json({ error: "Product not found" });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Handle this sales objection for ${product.name}:\n\nOBJECTION: "${objection}"\n\nProduct: ${product.name}\nDescription: ${product.description}\nValue Props: ${product.valueProps}\nCompetitive Edge: ${product.competitiveEdge}\n${context ? `Context: ${context}` : ""}\n\nRespond with:\n1. ACKNOWLEDGE — Validate the concern (1-2 sentences)\n2. REFRAME — Shift perspective to value (2-3 sentences with metrics)\n3. EVIDENCE — Concrete proof point or comparison\n4. REDIRECT — Question that advances the deal\n\nBe empathetic but decisive. Use data. End with a question.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    const ol = objection.toLowerCase();
    let category = "need";
    if (ol.includes("price") || ol.includes("cost") || ol.includes("expensive") || ol.includes("budget")) category = "price";
    else if (ol.includes("competitor") || ol.includes("already have") || ol.includes("using")) category = "competition";
    else if (ol.includes("time") || ol.includes("now") || ol.includes("later") || ol.includes("ready")) category = "timing";
    else if (ol.includes("boss") || ol.includes("decision") || ol.includes("approve")) category = "authority";
    else if (ol.includes("trust") || ol.includes("risk") || ol.includes("proven") || ol.includes("security")) category = "trust";

    const productId = Object.keys(PRODUCTS).indexOf(productSlug) + 1;
    res.json({ id: Date.now(), productId, objection, response: content, category, createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Objection error:", err);
    res.status(500).json({ error: err.message || "Failed to handle objection" });
  }
}
