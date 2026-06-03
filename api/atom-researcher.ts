/**
 * ATOM Researcher Pro / Sonar — Vibranium-tier deep-research worker.
 *
 * POST /api/atom-researcher
 *   body: {
 *     companyName, domain, contactName, contactTitle, linkedinUrl,
 *     salesObjective, offering, competitor, notes,
 *     mode: "fast_scan" | "pro_dossier" | "deep_research" | "vibranium_war_room"
 *   }
 *
 *   success → {
 *     ok: true, researchId, mode, dossier: { ...structured }, rawMarkdown,
 *     model, latencyMs
 *   }
 *   error   → { ok: false, error, details }
 *
 * Perplexity Sonar is called server-side ONLY using PERPLEXITY_API_KEY.
 * The key never reaches the client. PERPLEXITY_MODEL_RESEARCH optionally
 * overrides the model for the deep tiers (defaults to sonar-pro).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  runResearch,
  PERPLEXITY_API_KEY,
  type ResearchRequest,
  type ResearchMode,
} from "./_lib/atom-researcher.js";

const VALID_MODES: ResearchMode[] = [
  "fast_scan", "pro_dossier", "deep_research", "vibranium_war_room",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed", details: "Use POST." });
  }

  // Polished configuration state — surfaced verbatim by the UI.
  if (!PERPLEXITY_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "perplexity_not_configured",
      details: "PERPLEXITY_API_KEY is not configured. Add it to your server environment to activate live Sonar research.",
    });
  }

  const b = (req.body || {}) as Record<string, unknown>;
  const mode = VALID_MODES.includes(b.mode as ResearchMode)
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
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: "research_failed",
      details: err?.message || "Unexpected error during ATOM research.",
    });
  }
}
