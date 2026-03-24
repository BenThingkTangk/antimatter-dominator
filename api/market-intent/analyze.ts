import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are the Antimatter AI Sales Dominator. Generate actionable market intelligence. Products: Antimatter AI Platform, ATOM Enterprise AI (VPC/on-prem/edge deployment), Vidzee (real estate video), Clinix Agent (billing), Clinix AI (documentation), Red Team ATOM (quantum security). Be direct, data-driven, specific.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, industry, topic } = req.body;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: `Market intel${productSlug && productSlug !== "all" ? ` for ${productSlug}` : ""}${industry ? `, industry: ${industry}` : ""}${topic ? `, topic: ${topic}` : ""}. Provide: 1) 3 MARKET TRENDS with data 2) BUYER SIGNALS 3) COMPETITIVE POSITIONING 4) 2 TALK TRACKS 5) URGENCY DRIVERS. Be specific and actionable.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    res.json({ id: Date.now(), title: `Market Intent: ${productSlug || "Full Ecosystem"} ${industry ? `— ${industry}` : ""}`, summary: content, relevantProducts: "[]", impactLevel: "high", source: "AI Analysis", category: "market-shift", createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Market error:", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
}
