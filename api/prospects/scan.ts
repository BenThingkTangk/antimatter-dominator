import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Antimatter AI Sales Dominator. Products: 1) Antimatter AI Platform (antimatter-ai) — full-service AI dev 2) ATOM Enterprise AI (atom-enterprise) — enterprise AI framework 3) Vidzee (vidzee) — AI real estate video 4) Clinix Agent (clinix-agent) — AI billing 5) Clinix AI (clinix-ai) — AI documentation 6) Red Team ATOM (red-team-atom) — quantum red team. Style: Direct, data-driven.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry, productFocus } = req.body;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Generate 8 high-value prospect companies that NEED our ecosystem.\n\n${industry && industry !== "All Industries" ? `Focus Industry: ${industry}` : "Scan all industries"}\n${productFocus && productFocus !== "all" ? `Product Focus: ${productFocus}` : "All products"}\n\nFor each, provide a JSON array with objects:\n- companyName: Real company name\n- industry: Their industry\n- score: 0-100 prospect score\n- reason: Why they need Antimatter (2-3 sentences)\n- matchedProducts: Array of product slugs (antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom)\n- signals: Array of 2-3 market signals\n- companySize: "enterprise", "mid-market", or "smb"\n- urgency: "critical", "high", "medium", or "low"\n\nIMPORTANT: Return ONLY the JSON array. No markdown, no code blocks. Raw JSON only.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    let prospectsList: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      prospectsList = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) prospectsList = JSON.parse(match[0]);
    }

    const results = prospectsList.map((p: any, i: number) => ({
      id: Date.now() + i,
      companyName: p.companyName || "Unknown",
      industry: p.industry || "Technology",
      score: Number(p.score) || 50,
      reason: p.reason || "",
      matchedProducts: JSON.stringify(p.matchedProducts || []),
      signals: JSON.stringify(p.signals || []),
      companySize: p.companySize || "mid-market",
      urgency: p.urgency || "medium",
      lastUpdated: new Date().toISOString(),
      status: "new",
    }));

    res.json(results);
  } catch (err: any) {
    console.error("Prospect scan error:", err);
    res.status(500).json({ error: err.message || "Failed to scan" });
  }
}
