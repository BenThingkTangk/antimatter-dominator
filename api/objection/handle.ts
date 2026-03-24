import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProductBySlug } from "../_lib/products";
import { anthropic, SYSTEM_PROMPT } from "../_lib/anthropic";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { productSlug, objection, context } = req.body;
    const product = getProductBySlug(productSlug);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Handle this sales objection for ${product.name}:

OBJECTION: "${objection}"

Product: ${product.name}
Description: ${product.description}
Value Props: ${product.valueProps}
Competitive Edge: ${product.competitiveEdge}
Common Objections: ${product.commonObjections}
${context ? `Context: ${context}` : ""}

Respond with:
1. ACKNOWLEDGE — Validate the concern (1-2 sentences)
2. REFRAME — Shift perspective to value (2-3 sentences with specific metrics/data)
3. EVIDENCE — Concrete proof point, case study, or comparison
4. REDIRECT — Transition question that moves toward next step

Be empathetic but decisive. Use data and specifics, not vague promises. End with a question that advances the deal.`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    const objectionLower = objection.toLowerCase();
    let category = "need";
    if (objectionLower.includes("price") || objectionLower.includes("cost") || objectionLower.includes("expensive") || objectionLower.includes("budget")) category = "price";
    else if (objectionLower.includes("competitor") || objectionLower.includes("already have") || objectionLower.includes("using")) category = "competition";
    else if (objectionLower.includes("time") || objectionLower.includes("now") || objectionLower.includes("later") || objectionLower.includes("ready")) category = "timing";
    else if (objectionLower.includes("boss") || objectionLower.includes("decision") || objectionLower.includes("authority") || objectionLower.includes("approve")) category = "authority";
    else if (objectionLower.includes("trust") || objectionLower.includes("risk") || objectionLower.includes("proven") || objectionLower.includes("security")) category = "trust";

    res.json({
      id: Date.now(),
      productId: product.id,
      objection,
      response: content,
      category,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Objection handling error:", err);
    res.status(500).json({ error: err.message || "Failed to handle objection" });
  }
}
