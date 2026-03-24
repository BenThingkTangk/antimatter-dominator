import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Antimatter AI Sales Dominator. You create devastating sales pitches. Be direct, confident, data-driven. Use specific numbers. No fluff. Every word closes deals.`;

const PRODUCTS: Record<string, any> = {
  "antimatter-ai": { name: "Antimatter AI Platform", desc: "Full-service AI dev, product design, healthcare apps, IoT, GTM strategy. 20+ projects, 100% satisfaction, 3-5x faster time-to-market.", edge: "AI-native from day one. Design + engineering + AI + GTM under one roof." },
  "atom-enterprise": { name: "ATOM Enterprise AI", desc: "Enterprise AI framework. Deploy voice/search/workflow agents in VPC, on-prem, or edge. Zero-training guarantee, full IP ownership, Akamai+Linode edge.", edge: "Framework not tool. Hard isolation. Zero-training. Beats Kore.ai, Copilot Studio." },
  "vidzee": { name: "Vidzee", desc: "AI listing photos to cinematic real estate videos in 5 min. Save $200-500/video. 12,400+ videos by 2,800+ agents.", edge: "Replaces $500 videographer with 5-minute AI." },
  "clinix-agent": { name: "Clinix Agent", desc: "AI billing/denial appeals for healthcare. Success-based pricing 0.6-1.2% paid claims.", edge: "Stedi rails + ML signals. Pay only on success." },
  "clinix-ai": { name: "Clinix AI", desc: "AI SOAP notes, ICD-10/CPT/DSM-5-TR coding. Cut documentation 70%. Save 2-3 hrs/day.", edge: "Clinical context understanding. Real-time coding + EHR integration." },
  "red-team-atom": { name: "Red Team ATOM", desc: "Autonomous quantum-ready red team range. PQC engine, MITRE ATLAS heatmapping.", edge: "First quantum-ready red team. Continuous simulation vs annual pen tests." }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, pitchType, targetPersona, customContext } = req.body;
    const p = PRODUCTS[productSlug];
    if (!p) return res.status(404).json({ error: "Product not found" });

    const labels: Record<string, string> = { elevator: "30-second elevator pitch", email: "cold outreach email", "cold-call": "cold call script", "demo-intro": "demo intro hook", "executive-brief": "C-suite executive brief" };

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: `Generate a ${labels[pitchType] || pitchType} for ${p.name}. Product: ${p.desc} Edge: ${p.edge} Persona: ${targetPersona}${customContext ? ` Context: ${customContext}` : ""}. Be specific with metrics, address pain points, include CTA.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    const productId = Object.keys(PRODUCTS).indexOf(productSlug) + 1;
    res.json({ id: Date.now(), productId, pitchType, targetPersona, content, createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Pitch error:", err);
    res.status(500).json({ error: err.message || "Failed to generate pitch" });
  }
}
