import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry, productFocus } = req.body;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are a B2B prospect research AI. Return ONLY a valid JSON array. No markdown, no explanation, no code blocks. Just the raw JSON array.",
      messages: [{ role: "user", content: `Generate 6 prospect companies${industry && industry !== "All Industries" ? ` in ${industry}` : ""}${productFocus && productFocus !== "all" ? ` for ${productFocus}` : " for Antimatter AI ecosystem (AI dev, enterprise AI deployment, real estate video, healthcare billing, clinical documentation, quantum security)"}. JSON array format: [{"companyName":"string","industry":"string","score":number 0-100,"reason":"why they need us (1 sentence)","matchedProducts":["slug"],"signals":["signal"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]. Use slugs: antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom. Return ONLY the JSON array.` }]
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
    console.error("Prospect error:", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
}
