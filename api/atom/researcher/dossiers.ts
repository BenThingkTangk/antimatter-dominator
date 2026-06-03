/**
 * ATOM Researcher — account dossier service.
 *
 * POST /api/atom/researcher/dossiers
 *   body (see atom_researcher_api_integration_spec.md):
 *     target_company (required), target_domain?, target_contact_name?,
 *     target_contact_title?, contact_linkedin_url?, company_website?,
 *     solution_being_positioned?, call_type?, relationship_stage?,
 *     primary_goal?, known_context?
 *
 *   success → { ok: true, dossier: <saved row>, snapshot: <core snapshot> }
 *   error   → { ok: false, error, details? }
 *
 * The agent is driven by the ATOM Researcher system prompt and asked to return
 * JSON matching atom_account_dossier_schema.json. We parse + lightly validate
 * that JSON, persist it to atom_dossiers, and normalize the key sources into
 * atom_dossier_sources. Tenant isolation is via tenant_slug (X-Tenant-Slug),
 * matching the rest of the platform.
 *
 * LLM provider: Anthropic Claude (ANTHROPIC_API_KEY) is primary; OpenAI
 * (OPENAI_API_KEY) is the fallback — same abstraction the enrich pipeline uses.
 * No secret ever reaches the client.
 *
 * Self-contained per the project rule: Vercel nft cannot reliably bundle sibling
 * imports, so Supabase + provider helpers are inlined here.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ANTHROPIC_API_KEY = clean(process.env.ANTHROPIC_API_KEY);
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);
const ANTHROPIC_MODEL = clean(process.env.ATOM_RESEARCHER_MODEL) || "claude-sonnet-4-6";
const OPENAI_MODEL = clean(process.env.ATOM_RESEARCHER_OPENAI_MODEL) || "gpt-4o";

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// ── Request validation (zod — existing repo convention) ──────────────────────
const ENUM_FALLBACK = "Unknown";
const requestSchema = z.object({
  target_company: z.string().trim().min(1, "target_company is required"),
  target_domain: z.string().trim().optional(),
  target_contact_name: z.string().trim().optional(),
  target_contact_title: z.string().trim().optional(),
  contact_linkedin_url: z.string().trim().url("contact_linkedin_url must be a URL").optional(),
  company_website: z.string().trim().url("company_website must be a URL").optional(),
  solution_being_positioned: z.string().trim().optional(),
  call_type: z.string().trim().optional(),
  relationship_stage: z.string().trim().optional(),
  primary_goal: z.string().trim().optional(),
  known_context: z.string().trim().optional(),
});
type DossierRequest = z.infer<typeof requestSchema>;

// ── ATOM Researcher system prompt (verbatim, atom_researcher_system_prompt.md) ─
const ATOM_RESEARCHER_SYSTEM_PROMPT = `# ATOM Researcher System Prompt

## System Identity

You are ATOM Researcher, an elite account-intelligence agent inside the ATOM AI Sales Dominator platform by Nirmata Holdings.

Your mission is to generate tactical, source-backed account dossiers for prospects, customers, partners, investors, and strategic accounts before sales, discovery, demo, expansion, renewal, re-engagement, partnership, or investor conversations.

You operate with the precision of an investment banking analyst, the instincts of an intelligence officer, and the speed of an autonomous AI sales agent.

Every dossier must give the rep, founder, AI caller, or operator an unfair advantage before the conversation starts.

## Core Objective

Given a target company and optional contact, research and produce a complete ATOM Account Dossier that answers: who the company is, who the contact is, why the account matters now, what pain is likely active, which Nirmata or portfolio solution is the best fit, what the rep should say first, what objections are likely, and what next step should be driven. The dossier must be tactical, concise, sourced where possible, and ready for use by a human sales rep or AI calling agent.

## Supported Solution Routing

If solution_being_positioned is provided, tailor the entire dossier to that solution. If it is missing, empty, or "auto", select the strongest fit and explain the routing rationale:
- ATOM: sales automation, AI SDR/calling, outbound scale, pipeline generation, account research, CRM workflows, revenue operations, follow-up automation, call intelligence.
- AntimatterAI: AI infrastructure, intelligent agents, workflow automation, enterprise AI systems, AI transformation, data orchestration.
- ClinixAI: healthcare AI, clinical workflows, patient intake, provider operations, compliance-aware automation, care coordination.
- HumanOS: human-centered operating systems, productivity orchestration, executive command centers, cognitive workflow.
- RRG.bio: regenerative medicine, stem cell therapies, longevity, biotech partnerships, clinical innovation.
- Thingk Tangk: creative AI, children's education, storytelling, media, VR, interactive entertainment.
- Nirmata Holdings: strategic AI transformation, infrastructure, venture-building, edge computing, portfolio innovation.

## Research Rules

1. Prioritize current information from the last 90 days.
2. Use credible sources: company website, press pages, LinkedIn, job postings, funding databases, SEC filings, executive interviews, podcasts, review sites, G2, tech indicators, engineering blogs, reputable media.
3. Do not fabricate facts.
4. If a claim cannot be verified, label it as unverified and recommend a manual check.
5. Separate verified facts from strategic inference.
6. Cite sources wherever possible.
7. Make the output useful in under 60 seconds for a rep reviewing before a call.
8. Avoid generic sales advice. Every sentence must be tactical.
9. If contact data is limited, identify likely buyer personas and recommend target titles.

## Guardrails

- Never fabricate data or source URLs. Always mark unverified claims.
- Keep source URLs attached to claims. Avoid generic messaging.
- If overall confidence is LOW, recommend a manual research pass before executive outreach.
- If the account appears regulated, healthcare-related, financial, or enterprise-grade, flag likely compliance and procurement friction in risk_flags.

## Tone

Write like a battlefield intelligence officer: direct, sharp, tactical, confident, source-backed, commercially useful, free of filler. Do not sound like a generic research assistant.`;

// Appended at runtime to force schema-conformant JSON (per integration spec).
const JSON_OUTPUT_INSTRUCTION = `Return only valid JSON matching the ATOM Account Dossier JSON Schema. Do not include markdown, commentary, code fences, or extra keys.

The JSON object MUST contain these top-level keys: metadata, input, dossier_snapshot, company_intelligence, contact_intelligence, relevance_mapping, call_strategy_brief, objection_handling, power_move, source_notes_and_verification_gaps.

- metadata: { dossier_id, generated_at (ISO 8601), agent_name: "ATOM Researcher", confidence_score: "LOW"|"MEDIUM"|"HIGH", confidence_rationale, model_used?, research_window? }
- dossier_snapshot: { company_one_liner, contact_one_liner?, best_buyer_persona_if_no_contact?, why_reach_out_now, recommended_solution_angle, solution_routing_rationale?, pitch_hook, top_pain_hypothesis, strongest_trigger_event, best_opener, confidence_score, confidence_rationale, recommended_call_duration: "15 min"|"30 min"|"45 min", deal_potential: "SMB"|"Mid-Market"|"Enterprise"|"Strategic", next_best_action }
- relevance_mapping.pain_to_solution_matches MUST have exactly 3 items; call_strategy_brief.discovery_questions exactly 5; objection_handling exactly 3.
- source_notes_and_verification_gaps.key_sources_used is an array of { title, url, publisher?, published_at?, accessed_at? }. Use only real source URLs; never invent them.`;

function buildUserPrompt(req: DossierRequest): string {
  const lines: string[] = [];
  lines.push("Build an ATOM Account Dossier for the following target.");
  lines.push("");
  lines.push("=== INPUT ===");
  lines.push(`target_company: ${req.target_company}`);
  if (req.target_domain) lines.push(`target_domain: ${req.target_domain}`);
  if (req.target_contact_name) lines.push(`target_contact_name: ${req.target_contact_name}`);
  if (req.target_contact_title) lines.push(`target_contact_title: ${req.target_contact_title}`);
  if (req.contact_linkedin_url) lines.push(`contact_linkedin_url: ${req.contact_linkedin_url}`);
  if (req.company_website) lines.push(`company_website: ${req.company_website}`);
  lines.push(`solution_being_positioned: ${req.solution_being_positioned || "auto"}`);
  if (req.call_type) lines.push(`call_type: ${req.call_type}`);
  if (req.relationship_stage) lines.push(`relationship_stage: ${req.relationship_stage}`);
  if (req.primary_goal) lines.push(`primary_goal: ${req.primary_goal}`);
  if (req.known_context) lines.push(`known_context: ${req.known_context}`);
  lines.push("");
  lines.push("Echo these input fields back under the `input` key of the JSON.");
  lines.push("");
  lines.push(JSON_OUTPUT_INSTRUCTION);
  return lines.join("\n");
}

// ── LLM provider abstraction: Anthropic primary, OpenAI fallback ─────────────
async function generateDossierJson(userPrompt: string): Promise<{ raw: string; model: string }> {
  if (anthropic) {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      system: ATOM_RESEARCHER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const raw = (resp.content || [])
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { raw, model: ANTHROPIC_MODEL };
  }
  if (OPENAI_API_KEY) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: ATOM_RESEARCHER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`openai ${r.status}: ${txt.slice(0, 200)}`);
    }
    const d: any = await r.json();
    return { raw: (d?.choices?.[0]?.message?.content || "").trim(), model: OPENAI_MODEL };
  }
  throw new Error(
    "No AI provider configured. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY in the server environment.",
  );
}

// ── Lightweight schema-shape validation (avoid persisting malformed data) ────
const CONFIDENCE = new Set(["LOW", "MEDIUM", "HIGH"]);
const REQUIRED_TOP_KEYS = [
  "metadata", "input", "dossier_snapshot", "company_intelligence", "contact_intelligence",
  "relevance_mapping", "call_strategy_brief", "objection_handling", "power_move",
  "source_notes_and_verification_gaps",
];

/** Extract the JSON object from a model response (tolerates stray fences/prose). */
function extractJson(raw: string): any {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const m = candidate.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model response did not contain a JSON object.");
    return JSON.parse(m[0]);
  }
}

function validateDossierShape(d: any): string[] {
  const errors: string[] = [];
  if (!d || typeof d !== "object") return ["dossier is not an object"];
  for (const k of REQUIRED_TOP_KEYS) {
    if (!(k in d)) errors.push(`missing key: ${k}`);
  }
  const snap = d.dossier_snapshot;
  if (!snap || typeof snap !== "object") {
    errors.push("dossier_snapshot is missing or not an object");
  } else {
    if (typeof snap.company_one_liner !== "string" || !snap.company_one_liner.trim()) {
      errors.push("dossier_snapshot.company_one_liner is required");
    }
    if (snap.confidence_score && !CONFIDENCE.has(snap.confidence_score)) {
      errors.push("dossier_snapshot.confidence_score must be LOW|MEDIUM|HIGH");
    }
  }
  const meta = d.metadata;
  if (meta && meta.confidence_score && !CONFIDENCE.has(meta.confidence_score)) {
    errors.push("metadata.confidence_score must be LOW|MEDIUM|HIGH");
  }
  return errors;
}

// ── Supabase REST helper (service role) ──────────────────────────────────────
async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Pick confidence from snapshot, falling back to metadata. */
function pickConfidence(d: any): string | null {
  const c = d?.dossier_snapshot?.confidence_score || d?.metadata?.confidence_score;
  return c && CONFIDENCE.has(c) ? c : null;
}

/** Normalize key_sources_used into source rows; drop entries without a usable URL. */
function normalizeSources(d: any, dossierRowId: string): any[] {
  const list = d?.source_notes_and_verification_gaps?.key_sources_used;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const url = typeof s.url === "string" ? s.url.trim() : "";
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    rows.push({
      dossier_id: dossierRowId,
      title: (typeof s.title === "string" && s.title.trim()) ? s.title.trim() : url,
      url,
      publisher: typeof s.publisher === "string" ? s.publisher.trim() || null : null,
      published_at: typeof s.published_at === "string" ? s.published_at.trim() || null : null,
      ...(typeof s.accessed_at === "string" && s.accessed_at.trim() ? { accessed_at: s.accessed_at.trim() } : {}),
    });
  }
  return rows;
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tenant-Slug");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed", details: "Use POST." });
  }

  // Validate input server-side.
  const rawBody = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "invalid_request",
      details: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
    });
  }
  const input = parsed.data;

  if (!anthropic && !OPENAI_API_KEY) {
    return res.status(503).json({
      ok: false,
      error: "ai_not_configured",
      details: "Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY to generate dossiers.",
    });
  }

  const tenantSlug = (req.headers["x-tenant-slug"] || "").toString().trim() || null;
  const dossierId = `atomd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    // 1. Generate the structured dossier.
    const { raw, model } = await generateDossierJson(buildUserPrompt(input));
    if (!raw) {
      return res.status(502).json({ ok: false, error: "empty_response", details: "The model returned no content." });
    }

    // 2. Parse + lightly validate to avoid saving malformed data.
    let dossierJson: any;
    try {
      dossierJson = extractJson(raw);
    } catch (e: any) {
      return res.status(502).json({ ok: false, error: "invalid_dossier_json", details: e?.message || "Could not parse model JSON." });
    }
    const shapeErrors = validateDossierShape(dossierJson);
    if (shapeErrors.length) {
      return res.status(502).json({ ok: false, error: "dossier_schema_mismatch", details: shapeErrors });
    }

    // Stamp authoritative metadata + echo input so stored JSON is self-consistent.
    dossierJson.metadata = {
      ...(dossierJson.metadata || {}),
      dossier_id: dossierId,
      agent_name: "ATOM Researcher",
      generated_at: dossierJson.metadata?.generated_at || new Date().toISOString(),
      model_used: model,
    };
    dossierJson.input = { ...(dossierJson.input || {}), ...input };

    const confidence = pickConfidence(dossierJson);
    const dealPotential = typeof dossierJson?.dossier_snapshot?.deal_potential === "string"
      ? dossierJson.dossier_snapshot.deal_potential
      : null;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      // No persistence configured — still return the generated dossier so the
      // feature is usable in environments without Supabase.
      return res.status(200).json({
        ok: true,
        persisted: false,
        dossier: { dossier_id: dossierId, dossier_json: dossierJson, model_used: model },
        snapshot: dossierJson.dossier_snapshot,
      });
    }

    // 3. Insert the dossier row.
    const inserted = await supabase("atom_dossiers", {
      method: "POST",
      body: JSON.stringify({
        dossier_id: dossierId,
        tenant_slug: tenantSlug,
        target_company: input.target_company,
        target_domain: input.target_domain || null,
        target_contact_name: input.target_contact_name || null,
        target_contact_title: input.target_contact_title || null,
        solution_being_positioned: input.solution_being_positioned || null,
        call_type: input.call_type || null,
        relationship_stage: input.relationship_stage || null,
        primary_goal: input.primary_goal || null,
        confidence_score: confidence,
        deal_potential: dealPotential,
        model_used: model,
        dossier_json: dossierJson,
        markdown_render: null,
      }),
    });
    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    // 4. Normalize + insert source rows (best-effort; never fails the response).
    const sourceRows = normalizeSources(dossierJson, row.id);
    if (sourceRows.length) {
      await supabase("atom_dossier_sources", {
        method: "POST",
        body: JSON.stringify(sourceRows),
        headers: { Prefer: "return=minimal" },
      }).catch((e) => console.warn("[atom_dossier_sources] insert failed:", e?.message));
    }

    // 5. Return the saved record + core snapshot fields.
    return res.status(200).json({
      ok: true,
      persisted: true,
      dossier: row,
      snapshot: dossierJson.dossier_snapshot,
      sources_saved: sourceRows.length,
    });
  } catch (err: any) {
    const isAbort = err?.name === "AbortError" || /aborted|timeout/i.test(err?.message || "");
    return res.status(isAbort ? 504 : 500).json({
      ok: false,
      error: isAbort ? "timeout" : "dossier_failed",
      details: err?.message || "Unexpected error generating the dossier.",
    });
  }
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
