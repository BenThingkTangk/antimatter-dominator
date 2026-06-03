import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import Anthropic from "@anthropic-ai/sdk";
import {
  pitchRequestSchema,
  objectionRequestSchema,
  marketIntentRequestSchema,
  prospectScanRequestSchema,
  createCampaignSchema,
  importAccountsSchema,
  enrichRequestSchema,
  pushRequestSchema,
} from "@shared/schema";
import { scorePublic, scoreAtom, tierOf, HEALTHCARE_HIPAA_TEMPLATE } from "./scoring/engine";
import { registerContentRoutes } from "./content/routes";
import {
  runResearch,
  PERPLEXITY_API_KEY as RESEARCHER_PPLX_KEY,
  type ResearchRequest,
  type ResearchMode,
} from "../api/_lib/atom-researcher";

const anthropic = new Anthropic();

const RESEARCH_MODES: ResearchMode[] = [
  "fast_scan", "pro_dossier", "deep_research", "vibranium_war_room",
];

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

  // ===== ATOM RESEARCHER PRO / SONAR (Vibranium deep research) =====
  // Dev-mode mirror of api/atom-researcher.ts (the Vercel function). Both call
  // the same shared engine in api/_lib/atom-researcher.ts so behaviour is
  // identical in local dev and on Vercel.
  app.post("/api/atom-researcher", async (req, res) => {
    if (!RESEARCHER_PPLX_KEY) {
      return res.status(503).json({
        ok: false,
        error: "perplexity_not_configured",
        details: "PERPLEXITY_API_KEY is not configured. Add it to your server environment to activate live Sonar research.",
      });
    }
    const b = (req.body || {}) as Record<string, unknown>;
    const mode = RESEARCH_MODES.includes(b.mode as ResearchMode)
      ? (b.mode as ResearchMode)
      : "pro_dossier";
    const researchReq: ResearchRequest = {
      companyName: typeof b.companyName === "string" ? b.companyName.trim() : undefined,
      domain: typeof b.domain === "string" ? b.domain.trim() : undefined,
      contactName: typeof b.contactName === "string" ? b.contactName.trim() : undefined,
      contactTitle: typeof b.contactTitle === "string" ? b.contactTitle.trim() : undefined,
      linkedinUrl: typeof b.linkedinUrl === "string" ? b.linkedinUrl.trim() : undefined,
      salesObjective: typeof b.salesObjective === "string" ? b.salesObjective.trim() : undefined,
      offering: typeof b.offering === "string" ? b.offering.trim() : undefined,
      competitor: typeof b.competitor === "string" ? b.competitor.trim() : undefined,
      notes: typeof b.notes === "string" ? b.notes.trim() : undefined,
      mode,
    };
    if (!researchReq.companyName && !researchReq.domain) {
      return res.status(400).json({
        ok: false,
        error: "missing_target",
        details: "A companyName or domain is required to run ATOM research.",
      });
    }
    try {
      const result = await runResearch(researchReq);
      if (!result.ok) {
        const status = result.error === "timeout" ? 504 : 502;
        return res.status(status).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        error: "research_failed",
        details: err?.message || "Unexpected error during ATOM research.",
      });
    }
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

  // ===== ΔTOM CAMPAIGNS — Bulk Import + Score + Enrich =====
  app.get("/api/campaigns", (_req, res) => {
    const list = storage.getCampaigns().map((c) => ({
      ...c,
      counts: storage.countCampaignAccountsByStatus(c.id),
    }));
    res.json(list);
  });

  app.get("/api/campaigns/:id", (req, res) => {
    const c = storage.getCampaignById(Number(req.params.id));
    if (!c) return res.status(404).json({ error: "Campaign not found" });
    res.json({ ...c, counts: storage.countCampaignAccountsByStatus(c.id) });
  });

  app.post("/api/campaigns", (req, res) => {
    try {
      const parsed = createCampaignSchema.parse(req.body);
      const now = new Date().toISOString();
      const c = storage.createCampaign({ ...parsed, status: "draft", totalAccounts: 0, scoredAccounts: 0, enrichedAccounts: 0, createdAt: now, updatedAt: now });
      res.json(c);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/campaigns/:id", (req, res) => {
    storage.deleteCampaign(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/campaigns/:id/import", (req, res) => {
    try {
      const id = Number(req.params.id);
      const campaign = storage.getCampaignById(id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      const parsed = importAccountsSchema.parse(req.body);
      const now = new Date().toISOString();
      const rows = parsed.accounts.map((a) => ({
        campaignId: id,
        accountName: a.accountName,
        domain: a.domain ?? null,
        state: a.state ?? null,
        subVertical: a.subVertical ?? null,
        revenue: typeof a.revenue === "number" ? a.revenue : null,
        akafit: a.akafit ?? null,
        walletGrade: a.walletGrade ?? null,
        extraTagsJson: a.extraTags ? JSON.stringify(a.extraTags) : null,
        enrichStatus: "pending" as const,
        createdAt: now,
      }));
      const inserted = storage.bulkInsertCampaignAccounts(rows as any);
      const counts = storage.countCampaignAccountsByStatus(id);
      storage.updateCampaign(id, { totalAccounts: counts.total, updatedAt: now });
      res.json({ inserted, total: counts.total });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/campaigns/:id/score-public", (req, res) => {
    try {
      const id = Number(req.params.id);
      const campaign = storage.getCampaignById(id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      const tpl = HEALTHCARE_HIPAA_TEMPLATE; // template-aware lookup can be added once more templates exist
      const accts = storage.getCampaignAccounts(id, { limit: 10000 });
      const updates = accts.map((a) => {
        const targetLists = a.extraTagsJson ? (() => { try { const t = JSON.parse(a.extraTagsJson!); return t.target_lists || t.Target_Lists || ""; } catch { return ""; } })() : "";
        const breakdown = scorePublic({
          account: a.accountName,
          sub_vertical: a.subVertical,
          wallet_grade: a.walletGrade,
          akafit: a.akafit,
          revenue: a.revenue,
          target_lists: targetLists,
        }, tpl);
        const finalScore = breakdown.publicSubtotal; // ATOM score adds later
        return {
          id: a.id,
          scoreRegulatory: breakdown.regulatory,
          scoreAccountFit: breakdown.accountFit,
          scoreListDensity: breakdown.listDensity,
          scoreSegmentation: breakdown.segmentation,
          publicSubtotal: breakdown.publicSubtotal,
          finalScore,
          tier: tierOf(finalScore, tpl),
        };
      });
      storage.bulkUpdateCampaignAccountScores(updates as any);
      const counts = storage.countCampaignAccountsByStatus(id);
      const now = new Date().toISOString();
      storage.updateCampaign(id, { status: "scoring", scoredAccounts: counts.scored, updatedAt: now });
      res.json({ scored: updates.length, counts });
    } catch (err: any) {
      console.error("score-public error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/campaigns/:id/accounts", (req, res) => {
    const id = Number(req.params.id);
    const tier = req.query.tier as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 500;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const rows = storage.getCampaignAccounts(id, { tier, limit, offset });
    res.json(rows);
  });

  app.post("/api/campaigns/:id/enrich", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = enrichRequestSchema.parse(req.body);
      const campaign = storage.getCampaignById(id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      // Mark all as running first so UI reflects immediately.
      for (const accountId of parsed.accountIds) {
        storage.updateCampaignAccount(accountId, { enrichStatus: "running" });
      }
      // Kick off background enrichment — uses Anthropic to produce ATOM-style buying signals.
      void (async () => {
        const tpl = HEALTHCARE_HIPAA_TEMPLATE;
        for (const accountId of parsed.accountIds) {
          const acct = storage.getCampaignAccountById(accountId);
          if (!acct) continue;
          try {
            const prompt = `You are ΔTOM, an autonomous outbound enrichment agent. Produce a compact JSON for "${acct.accountName}" (${acct.subVertical || "healthcare"}, ${acct.state || "US"}). Return ONLY JSON with keys: buying_signals (array of 0-4 short strings), pain_points (0-3 strings), recent_news (0-2 strings), decision_makers (0-3 objects with title and seniority), atom_score (0-100). No prose.`;
            const result = await anthropic.messages.create({
              model: "claude-haiku-4-5",
              max_tokens: 800,
              messages: [{ role: "user", content: prompt }],
            });
            const text = result.content.find((b: any) => b.type === "text")?.text || "{}";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
            const atomBreakdown = scoreAtom({
              atom_buying_signals: data.buying_signals,
              atom_pain_points: data.pain_points,
              atom_recent_news: data.recent_news,
              atom_decision_makers: data.decision_makers,
              atom_score: data.atom_score,
            }, tpl);
            const finalScore = (acct.publicSubtotal || 0) + atomBreakdown.atomSubtotal;
            storage.updateCampaignAccount(accountId, {
              scoreAtomIntent: atomBreakdown.intent,
              scoreAtomPersonas: atomBreakdown.personas,
              scoreAtomFreshness: atomBreakdown.freshness,
              finalScore,
              tier: tierOf(finalScore, tpl),
              whyNow: atomBreakdown.whyNow.join(" | "),
              atomBuyingSignalsJson: JSON.stringify(data.buying_signals || []),
              atomPainPointsJson: JSON.stringify(data.pain_points || []),
              atomRecentNewsJson: JSON.stringify(data.recent_news || []),
              atomDecisionMakersJson: JSON.stringify(data.decision_makers || []),
              atomEnrichedAt: new Date().toISOString(),
              enrichStatus: "done",
              enrichError: null,
            });
          } catch (err: any) {
            storage.updateCampaignAccount(accountId, { enrichStatus: "failed", enrichError: err.message });
          }
        }
        const counts = storage.countCampaignAccountsByStatus(id);
        storage.updateCampaign(id, { enrichedAccounts: counts.enriched, status: counts.enriched >= counts.total ? "ready" : "enriching", updatedAt: new Date().toISOString() });
      })();

      res.json({ queued: parsed.accountIds.length });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/campaigns/:id/push", (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = pushRequestSchema.parse(req.body);
      const campaign = storage.getCampaignById(id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      let count = 0;
      for (const accountId of parsed.accountIds) {
        const acct = storage.getCampaignAccountById(accountId);
        if (!acct) continue;
        if (parsed.target === "prospects") {
          storage.createProspect({
            companyName: acct.accountName,
            domain: acct.domain || "",
            industry: acct.subVertical || "Healthcare",
            size: acct.walletGrade || "",
            score: Math.round(acct.finalScore || 0),
            status: "new",
            buyingSignals: acct.atomBuyingSignalsJson || "[]",
            decisionMakers: acct.atomDecisionMakersJson || "[]",
            recommendedProducts: JSON.stringify([campaign.productSlug]),
            createdAt: new Date().toISOString(),
          } as any);
        }
        storage.updateCampaignAccount(accountId, { pushedTo: parsed.target });
        count++;
      }
      res.json({ pushed: count, target: parsed.target });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/scoring-templates", (_req, res) => {
    res.json(storage.getScoringTemplates());
  });

  // ===== ATOM CONTENT WORKER =====
  registerContentRoutes(app);
}
