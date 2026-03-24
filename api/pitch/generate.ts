import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Antimatter AI Sales Dominator — a lethal, hyper-intelligent sales AI. Products: 1) Antimatter AI Platform (antimatterai.com) — full-service AI dev, product design, healthcare apps, IoT, GTM. 2) ATOM Enterprise AI (antimatterai.com/enterprise-ai) — enterprise AI framework, deploy VPC/on-prem/edge, model-agnostic, full IP ownership, Akamai+Linode edge. 3) Vidzee — AI real estate video in 5 min. 4) Clinix Agent — AI billing/denial appeals for healthcare. 5) Clinix AI — AI SOAP notes, ICD-10/CPT coding. 6) Red Team ATOM — autonomous quantum-ready red team, PQC, MITRE ATLAS. Style: Direct, confident, data-driven. Specific numbers. No fluff.`;

const PRODUCTS: Record<string, any> = {
  "antimatter-ai": { name: "Antimatter AI Platform", description: "Full-service AI development, product design, and GTM strategy platform.", targetMarket: "Enterprise organizations, SaaS companies, startups", keyFeatures: "Product design, full-stack dev, AI development, GTM strategy, healthcare apps, IoT", valueProps: "20+ projects, 100% satisfaction, AI-native, 3-5x faster time-to-market", competitiveEdge: "AI-native from day one. Design + engineering + AI + GTM under one roof." },
  "atom-enterprise": { name: "ATOM Enterprise AI", description: "Enterprise AI deployment framework. Deploy voice, search, workflow agents in VPC/on-prem/edge.", targetMarket: "CIOs, CTOs at regulated enterprises, defense, government, Fortune 500", keyFeatures: "Deploy anywhere, SSO+RBAC, audit logs, zero-training, composable agents, model-agnostic, Akamai edge", valueProps: "Own your AI, zero-training guarantee, no vendor lock-in, edge deployment", competitiveEdge: "Framework not tool. Hard isolation. Zero-training. Full IP ownership. Beats Kore.ai, Intercom Fin, Copilot Studio." },
  "vidzee": { name: "Vidzee", description: "AI listing photos to cinematic real estate videos in 5 minutes.", targetMarket: "Real estate agents, brokerages", keyFeatures: "AI storyboarding, Kling AI video, dual-format export, 3 style packs", valueProps: "5-min videos, save $200-$500/video, 12,400+ videos created", competitiveEdge: "Replaces $500 videographer cost with 5-minute AI." },
  "clinix-agent": { name: "Clinix Agent", description: "AI-powered insurance denial appeals and billing automation.", targetMarket: "Healthcare providers, hospitals, billing teams", keyFeatures: "Eligibility guardrails, clean claim engine, appeal intelligence, HIPAA security", valueProps: "Stop denials before they start, success-based pricing, real-time tracking", competitiveEdge: "Stedi rails + ML signals. Pay only on success." },
  "clinix-ai": { name: "Clinix AI", description: "AI clinical documentation, SOAP notes, ICD-10/CPT/DSM-5-TR coding.", targetMarket: "Healthcare providers, clinicians", keyFeatures: "SOAP automation, ICD-10/CPT/DSM-5-TR coding, EHR integration", valueProps: "Cut documentation 70%, reduce denials, save 2-3 hrs/day", competitiveEdge: "Understands clinical context. Real-time coding integrated with EHR." },
  "red-team-atom": { name: "Red Team ATOM", description: "Autonomous quantum-ready red team range with PQC engine.", targetMarket: "CISOs, security teams, defense contractors, government", keyFeatures: "PQC engine, AI/quantum telemetry, MITRE ATLAS heatmap, continuous simulation", valueProps: "Only quantum-ready red team, real-time telemetry, MITRE ATLAS mapping", competitiveEdge: "First autonomous quantum-ready red team. Continuous simulation vs annual pen tests." }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { productSlug, pitchType, targetPersona, customContext } = req.body;
    const product = PRODUCTS[productSlug];
    if (!product) return res.status(404).json({ error: "Product not found" });

    const pitchLabels: Record<string, string> = { elevator: "30-second elevator pitch", email: "cold outreach email", "cold-call": "cold call opening script", "demo-intro": "demo introduction and hook", "executive-brief": "executive briefing for C-suite" };

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Generate a ${pitchLabels[pitchType] || pitchType} for ${product.name}.\n\nProduct: ${product.name}\nDescription: ${product.description}\nTarget Market: ${product.targetMarket}\nKey Features: ${product.keyFeatures}\nValue Props: ${product.valueProps}\nCompetitive Edge: ${product.competitiveEdge}\n\nTarget Persona: ${targetPersona}\n${customContext ? `Additional Context: ${customContext}` : ""}\n\nRequirements: Be specific with metrics. Address pain points directly. Include strong CTA. Concise and impactful.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    const productId = Object.keys(PRODUCTS).indexOf(productSlug) + 1;
    res.json({ id: Date.now(), productId, pitchType, targetPersona, content, createdAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("Pitch error:", err);
    res.status(500).json({ error: err.message || "Failed to generate pitch" });
  }
}
