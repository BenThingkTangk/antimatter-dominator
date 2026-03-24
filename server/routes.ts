import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import Anthropic from "@anthropic-ai/sdk";
import {
  pitchRequestSchema,
  objectionRequestSchema,
  marketIntentRequestSchema,
  prospectScanRequestSchema,
} from "@shared/schema";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are the Antimatter AI Sales Dominator — a lethal, hyper-intelligent sales AI for the Antimatter ecosystem. You know every product inside and out. You speak with authority, confidence, and killer instinct. Your job is to arm sales reps with devastating pitches, bulletproof objection responses, and market intelligence that closes deals.

Products in the ecosystem:
1. Antimatter AI Platform (antimatterai.com) — Full-service AI development, product design, GTM strategy
2. Vidzee (vidzee.vercel.app) — AI listing photos to cinematic real estate videos in 5 min
3. Clinix Agent (clinixagent.com) — AI-powered insurance denial appeals and billing automation for healthcare
4. Clinix AI (tryclinixai.com) — AI clinical documentation, SOAP notes, ICD-10/CPT coding automation
5. Red Team ATOM (red-team-atom.vercel.app) — Autonomous quantum-ready red team range, PQC engine, MITRE ATLAS

Style: Direct, confident, data-driven. Use specific numbers and metrics. No fluff. Every word should move toward closing the deal.`;

export async function registerRoutes(server: Server, app: Express) {
  // ===== PRODUCTS =====
  app.get("/api/products", (_req, res) => {
    const prods = storage.getProducts();
    res.json(prods);
  });

  app.get("/api/products/:slug", (req, res) => {
    const product = storage.getProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  });

  // ===== PITCH GENERATOR (AI) =====
  app.post("/api/pitch/generate", async (req, res) => {
    try {
      const data = pitchRequestSchema.parse(req.body);
      const product = storage.getProductBySlug(data.productSlug);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const pitchTypeLabels: Record<string, string> = {
        "elevator": "30-second elevator pitch",
        "email": "cold outreach email",
        "cold-call": "cold call opening script",
        "demo-intro": "demo introduction and hook",
        "executive-brief": "executive briefing for C-suite"
      };

      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Generate a ${pitchTypeLabels[data.pitchType] || data.pitchType} for ${product.name}.

Product: ${product.name}
Description: ${product.description}
Target Market: ${product.targetMarket}
Key Features: ${product.keyFeatures}
Value Props: ${product.valueProps}
Competitive Edge: ${product.competitiveEdge}

Target Persona: ${data.targetPersona}
${data.customContext ? `Additional Context: ${data.customContext}` : ""}

Requirements:
- Be specific with metrics, numbers, and outcomes
- Address the persona's pain points directly
- Include a strong call to action
- Make it conversational but authoritative
- Keep it concise and impactful`
        }]
      });

      const content = message.content[0].type === "text" ? message.content[0].text : "";

      const pitch = storage.createPitch({
        productId: product.id,
        pitchType: data.pitchType,
        targetPersona: data.targetPersona,
        content,
        createdAt: new Date().toISOString(),
      });

      res.json(pitch);
    } catch (err: any) {
      console.error("Pitch generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate pitch" });
    }
  });

  // Get pitch history
  app.get("/api/pitches", (req, res) => {
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    res.json(storage.getPitches(productId));
  });

  // ===== OBJECTION HANDLER (AI) =====
  app.post("/api/objection/handle", async (req, res) => {
    try {
      const data = objectionRequestSchema.parse(req.body);
      const product = storage.getProductBySlug(data.productSlug);
      if (!product) return res.status(404).json({ error: "Product not found" });

      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Handle this sales objection for ${product.name}:

OBJECTION: "${data.objection}"

Product: ${product.name}
Description: ${product.description}
Value Props: ${product.valueProps}
Competitive Edge: ${product.competitiveEdge}
Common Objections: ${product.commonObjections}
${data.context ? `Context: ${data.context}` : ""}

Respond with:
1. ACKNOWLEDGE — Validate the concern (1-2 sentences)
2. REFRAME — Shift perspective to value (2-3 sentences with specific metrics/data)
3. EVIDENCE — Concrete proof point, case study, or comparison
4. REDIRECT — Transition question that moves toward next step

Be empathetic but decisive. Use data and specifics, not vague promises. End with a question that advances the deal.`
        }]
      });

      const content = message.content[0].type === "text" ? message.content[0].text : "";

      // Detect category
      const objectionLower = data.objection.toLowerCase();
      let category = "need";
      if (objectionLower.includes("price") || objectionLower.includes("cost") || objectionLower.includes("expensive") || objectionLower.includes("budget")) category = "price";
      else if (objectionLower.includes("competitor") || objectionLower.includes("already have") || objectionLower.includes("using")) category = "competition";
      else if (objectionLower.includes("time") || objectionLower.includes("now") || objectionLower.includes("later") || objectionLower.includes("ready")) category = "timing";
      else if (objectionLower.includes("boss") || objectionLower.includes("decision") || objectionLower.includes("authority") || objectionLower.includes("approve")) category = "authority";
      else if (objectionLower.includes("trust") || objectionLower.includes("risk") || objectionLower.includes("proven") || objectionLower.includes("security")) category = "trust";

      const objection = storage.createObjection({
        productId: product.id,
        objection: data.objection,
        response: content,
        category,
        createdAt: new Date().toISOString(),
      });

      res.json(objection);
    } catch (err: any) {
      console.error("Objection handling error:", err);
      res.status(500).json({ error: err.message || "Failed to handle objection" });
    }
  });

  // Get objection history
  app.get("/api/objections", (req, res) => {
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    res.json(storage.getObjections(productId));
  });

  // ===== MARKET INTENT (AI) =====
  app.post("/api/market-intent/analyze", async (req, res) => {
    try {
      const data = marketIntentRequestSchema.parse(req.body);

      const product = data.productSlug ? storage.getProductBySlug(data.productSlug) : null;
      const allProducts = storage.getProducts();

      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Generate market intelligence and intent analysis for the Antimatter AI ecosystem.

${product ? `Focus Product: ${product.name} — ${product.description}` : "All products in the ecosystem"}
${data.industry ? `Target Industry: ${data.industry}` : ""}
${data.topic ? `Topic Focus: ${data.topic}` : ""}

Available Products: ${allProducts.map(p => `${p.name} (${p.category})`).join(", ")}

Provide a comprehensive market intent analysis with:

1. MARKET TRENDS — 3-4 current trends creating demand for these solutions (be specific with data points)
2. BUYER SIGNALS — What signals indicate a company is ready to buy (budget, org changes, compliance deadlines, tech stack issues)
3. COMPETITIVE LANDSCAPE — How we win against alternatives (specific differentiators)
4. TALK TRACKS — 2-3 conversation frameworks for each relevant product that leverage current market dynamics
5. URGENCY DRIVERS — Why prospects need to act NOW (regulations, competitive pressure, market shifts)

Format this as actionable intelligence a sales rep can use TODAY. Include specific industries, company types, and scenarios.`
        }]
      });

      const content = message.content[0].type === "text" ? message.content[0].text : "";

      const intel = storage.createMarketIntel({
        title: `Market Intent: ${product?.name || "Full Ecosystem"} ${data.industry ? `— ${data.industry}` : ""}`,
        summary: content,
        relevantProducts: JSON.stringify(product ? [product.slug] : allProducts.map(p => p.slug)),
        impactLevel: "high",
        source: "AI Analysis",
        category: "market-shift",
        createdAt: new Date().toISOString(),
      });

      res.json(intel);
    } catch (err: any) {
      console.error("Market intent error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze market intent" });
    }
  });

  app.get("/api/market-intel", (_req, res) => {
    res.json(storage.getMarketIntel());
  });

  // ===== PROSPECT ENGINE (AI) =====
  app.post("/api/prospects/scan", async (req, res) => {
    try {
      const data = prospectScanRequestSchema.parse(req.body);
      const allProducts = storage.getProducts();

      const message = await anthropic.messages.create({
        model: "claude_sonnet_4_6",
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `You are the Antimatter AI Prospect Engine. Generate a list of 8 high-value prospect companies that NEED our ecosystem.

${data.industry ? `Focus Industry: ${data.industry}` : "Scan all industries"}
${data.productFocus ? `Product Focus: ${data.productFocus}` : "All products"}

Products Available:
${allProducts.map(p => `- ${p.name} (${p.slug}): ${p.tagline} — ${p.targetMarket}`).join("\n")}

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
Focus on companies that have public signals of need: regulatory pressure, digital transformation initiatives, cybersecurity incidents, healthcare compliance deadlines, real estate market dynamics, or AI adoption mandates.`
        }]
      });

      const content = message.content[0].type === "text" ? message.content[0].text : "";

      // Parse the JSON response
      let prospectsList: any[] = [];
      try {
        // Clean the response - remove any markdown formatting
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        prospectsList = JSON.parse(cleaned);
      } catch {
        // If parsing fails, try to extract JSON from the response
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          prospectsList = JSON.parse(match[0]);
        }
      }

      const savedProspects = [];
      for (const p of prospectsList) {
        try {
          const prospect = storage.createProspect({
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
          });
          savedProspects.push(prospect);
        } catch (e) {
          console.error("Failed to save prospect:", e);
        }
      }

      res.json(savedProspects);
    } catch (err: any) {
      console.error("Prospect scan error:", err);
      res.status(500).json({ error: err.message || "Failed to scan prospects" });
    }
  });

  app.get("/api/prospects", (_req, res) => {
    res.json(storage.getProspects());
  });

  app.patch("/api/prospects/:id/status", (req, res) => {
    const { status } = req.body;
    const prospect = storage.updateProspectStatus(Number(req.params.id), status);
    if (!prospect) return res.status(404).json({ error: "Prospect not found" });
    res.json(prospect);
  });
}
