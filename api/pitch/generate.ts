import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProductBySlug } from "../_lib/products";
import { anthropic, SYSTEM_PROMPT } from "../_lib/anthropic";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { productSlug, pitchType, targetPersona, customContext } = req.body;
    const product = getProductBySlug(productSlug);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const pitchTypeLabels: Record<string, string> = {
      elevator: "30-second elevator pitch",
      email: "cold outreach email",
      "cold-call": "cold call opening script",
      "demo-intro": "demo introduction and hook",
      "executive-brief": "executive briefing for C-suite",
    };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a ${pitchTypeLabels[pitchType] || pitchType} for ${product.name}.

Product: ${product.name}
Description: ${product.description}
Target Market: ${product.targetMarket}
Key Features: ${product.keyFeatures}
Value Props: ${product.valueProps}
Competitive Edge: ${product.competitiveEdge}

Target Persona: ${targetPersona}
${customContext ? `Additional Context: ${customContext}` : ""}

Requirements:
- Be specific with metrics, numbers, and outcomes
- Address the persona's pain points directly
- Include a strong call to action
- Make it conversational but authoritative
- Keep it concise and impactful`,
        },
      ],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";

    res.json({
      id: Date.now(),
      productId: product.id,
      pitchType,
      targetPersona,
      content,
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Pitch generation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate pitch" });
  }
}
