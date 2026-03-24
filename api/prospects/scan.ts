import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProducts } from "../_lib/products";
import { anthropic, SYSTEM_PROMPT } from "../_lib/anthropic";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { industry, productFocus } = req.body;
    const allProducts = getProducts();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `You are the Antimatter AI Prospect Engine. Generate a list of 8 high-value prospect companies that NEED our ecosystem.

${industry && industry !== "All Industries" ? `Focus Industry: ${industry}` : "Scan all industries"}
${productFocus && productFocus !== "all" ? `Product Focus: ${productFocus}` : "All products"}

Products Available:
${allProducts.map((p) => `- ${p.name} (${p.slug}): ${p.tagline} — ${p.targetMarket}`).join("\n")}

For each prospect, provide a JSON array with objects containing:
- companyName: Real company name
- industry: Their industry
- score: 0-100 prospect score (based on fit, urgency, budget likelihood)
- reason: Specific reason why they need Antimatter (2-3 sentences with specifics)
- matchedProducts: Array of product slugs that fit them
- signals: Array of 2-3 market signals driving urgency
- companySize: "enterprise", "mid-market", or "smb"
- urgency: "critical", "high", "medium", or "low"

IMPORTANT: Return ONLY the JSON array, no markdown formatting, no code blocks. Just raw JSON.
Focus on companies that have public signals of need: regulatory pressure, digital transformation initiatives, cybersecurity incidents, healthcare compliance deadlines, real estate market dynamics, or AI adoption mandates.`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    let prospectsList: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      prospectsList = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        prospectsList = JSON.parse(match[0]);
      }
    }

    const savedProspects = prospectsList.map((p: any, i: number) => ({
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

    res.json(savedProspects);
  } catch (err: any) {
    console.error("Prospect scan error:", err);
    res.status(500).json({ error: err.message || "Failed to scan prospects" });
  }
}
