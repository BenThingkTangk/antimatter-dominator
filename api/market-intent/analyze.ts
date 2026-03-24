import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProducts, getProductBySlug } from "../_lib/products";
import { anthropic, SYSTEM_PROMPT } from "../_lib/anthropic";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { productSlug, industry, topic } = req.body;
    const product = productSlug && productSlug !== "all" ? getProductBySlug(productSlug) : null;
    const allProducts = getProducts();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate market intelligence and intent analysis for the Antimatter AI ecosystem.

${product ? `Focus Product: ${product.name} — ${product.description}` : "All products in the ecosystem"}
${industry ? `Target Industry: ${industry}` : ""}
${topic ? `Topic Focus: ${topic}` : ""}

Available Products: ${allProducts.map((p) => `${p.name} (${p.category})`).join(", ")}

Provide a comprehensive market intent analysis with:

1. MARKET TRENDS — 3-4 current trends creating demand for these solutions (be specific with data points)
2. BUYER SIGNALS — What signals indicate a company is ready to buy (budget, org changes, compliance deadlines, tech stack issues)
3. COMPETITIVE LANDSCAPE — How we win against alternatives (specific differentiators)
4. TALK TRACKS — 2-3 conversation frameworks for each relevant product that leverage current market dynamics
5. URGENCY DRIVERS — Why prospects need to act NOW (regulations, competitive pressure, market shifts)

Format this as actionable intelligence a sales rep can use TODAY. Include specific industries, company types, and scenarios.`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    res.json({
      id: Date.now(),
      title: `Market Intent: ${product?.name || "Full Ecosystem"} ${industry ? `— ${industry}` : ""}`,
      summary: content,
      relevantProducts: JSON.stringify(product ? [product.slug] : allProducts.map((p) => p.slug)),
      impactLevel: "high",
      source: "AI Analysis",
      category: "market-shift",
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Market intent error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze market intent" });
  }
}
