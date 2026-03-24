import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Antimatter AI Sales Dominator. Destroy objections with confidence. Use: ACKNOWLEDGE (1-2 sentences), REFRAME (2 sentences with metrics), EVIDENCE (proof point), REDIRECT (question that advances deal). Be empathetic but decisive.`;

const PRODUCTS: Record<string, any> = {
  "antimatter-ai": { name: "Antimatter AI Platform", desc: "Full-service AI dev. 20+ projects, 100% satisfaction, 3-5x faster.", edge: "AI-native. Design+engineering+AI+GTM under one roof." },
  "atom-enterprise": { name: "ATOM Enterprise AI", desc: "Enterprise AI framework. VPC/on-prem/edge. Zero-training, full IP ownership.", edge: "Hard isolation. No vendor lock-in. Beats Kore.ai, Copilot Studio." },
  "vidzee": { name: "Vidzee", desc: "AI real estate videos in 5 min. Save $200-500/video. 12,400+ videos.", edge: "Replaces $500 videographer." },
  "clinix-agent": { name: "Clinix Agent", desc: "AI billing/denial appeals. Success-based pricing.", edge: "Stedi rails + ML. Pay only on success." },
  "clinix-ai": { name: "Clinix AI", desc: "AI SOAP notes, ICD-10/CPT coding. Cut docs 70%.", edge: "Real-time coding + EHR integration." },
  "red-team-atom": { name: "Red Team ATOM", desc: "Quantum-ready red team. PQC engine, MITRE ATLAS.", edge: "First quantum-ready. Continuous vs annual pen tests." }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, objection, context } = req.body;
    const p = PRODUCTS[productSlug];
    if (!p) return res.status(404).json({ error: "Product not found" });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: `Objection for ${p.name}: "${objection}". Product: ${p.desc} Edge: ${p.edge}${context ? ` Context: ${context}` : ""}` }]
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
    res.status(500).json({ error: err.message || "Failed" });
  }
}
