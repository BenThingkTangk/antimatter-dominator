// ΔTOM public-signal scorer (template-aware).
// Self-contained — Vercel nft can't reliably trace sibling imports.
//
// Two rule packs live here today:
//   1. healthcare-segmentation-hipaa  — Akamai Guardicore play
//      Public 0-70: regulatory + breach + accountFit + listDensity + segmentation
//      ATOM 0-30: intent + personas + freshness (added in /enrich)
//      Tiers: T1≥75 / T2≥60 / T3≥45
//
//   2. cloud-ai-infrastructure-v1     — ΔTOM TARGET architecture spec
//      Pure-deterministic 4L + 4S + 4G + 3E + 3M + 2T, max 100
//      Tiers: T1≥80 / T2≥65 / T3≥50
//
// The healthcare logic must stay byte-identical with server/scoring/engine.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !KEY) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function r2(n: number) { return Math.round(n * 100) / 100; }

// ─── HEALTHCARE RULE PACK ──────────────────────────────────────────────────
const HC_WEIGHTS = {
  regulatory: 25, breach: 20, accountFit: 15, listDensity: 5, segmentation: 5,
  atomIntent: 12, atomPersonas: 10, atomFreshness: 8,
};
const HC_SUBV: Record<string, { phi: number; seg: number; note: string }> = {
  "Healthcare Provider": { phi: 1.0, seg: 1.0, note: "Largest PHI volume + EHR/IoT segmentation pain; mandated by 2025 HIPAA rule" },
  "Healthcare Payer": { phi: 0.95, seg: 0.9, note: "Massive PHI; claims systems; high regulatory scrutiny" },
  "Pharma and Biotech": { phi: 0.55, seg: 0.85, note: "Clinical-trial data + IP; OT/lab segmentation" },
  "Medical Devices and Equipment": { phi: 0.45, seg: 0.95, note: "Connected devices = lateral-movement crown jewels" },
  "Health Tech": { phi: 0.7, seg: 0.8, note: "PHI handling varies; HIPAA BAA exposure" },
};
const HC_WALLET: Record<string, number> = { "Mega Strategic": 1.0, "Strategic": 0.85, "Large Enterprise": 0.65 };
const HC_AKAFIT: Record<string, number> = { A: 1.0, B: 0.65, C: 0.3 };
const HC_LISTS: Record<string, number> = {
  "2026 NC Must Win TAL": 1.0, "North America ESG 2026 TAL Prospects": 0.9, "2026 Bain Money Map": 0.85,
  "2026-H1 SDR Security Focus - Core": 1.0, "North America API 2026 TAL Prospects": 0.7,
  "API Sec NC Noname Tier 1.2 TAL": 0.6, "2023 Unified Threat Shield": 0.5, "ESG Focus 30": 0.95,
  "2025 NC Must Win TAL": 0.6, "2024 NC Must Win TAL": 0.4,
};
const HC_TIER = { t1: 75, t2: 60, t3: 45 };

function revFactor(rev: number | null | undefined): number {
  if (typeof rev !== "number" || rev <= 0) return 0.3;
  if (rev >= 50_000_000_000) return 1.0;
  if (rev >= 10_000_000_000) return 0.92;
  if (rev >= 2_000_000_000) return 0.78;
  if (rev >= 500_000_000) return 0.62;
  if (rev >= 100_000_000) return 0.45;
  return 0.25;
}

function scoreHealthcare(r: any) {
  const sub = r.sub_vertical || "";
  const profile = HC_SUBV[sub] || { phi: 0.3, seg: 0.3, note: "Unknown sub-vertical" };
  const rev = typeof r.revenue === "number" ? r.revenue : null;
  const rFac = revFactor(rev);
  const wFac = HC_WALLET[r.wallet_grade || ""] ?? 0.4;
  const aFac = HC_AKAFIT[(r.akafit || "").toUpperCase()] ?? 0.3;

  const extra = r.extra_tags_json || {};
  const tlRaw = (extra.target_lists || "").toString();
  const tokens = tlRaw.split(";").map((t: string) => t.trim()).filter(Boolean);
  let listScore = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    if (HC_LISTS[t] !== undefined) { listScore = Math.max(listScore, HC_LISTS[t]); matched.push(t); }
  }
  const density = Math.min(1.0, tokens.length / 8.0);
  const combined = 0.65 * listScore + 0.35 * density;

  const sReg = HC_WEIGHTS.regulatory * (0.6 * profile.phi + 0.4 * rFac);
  const sFit = HC_WEIGHTS.accountFit * (0.5 * aFac + 0.5 * wFac);
  const sDen = HC_WEIGHTS.listDensity * combined;
  const sSeg = HC_WEIGHTS.segmentation * profile.seg;
  const publicSub = r2(sReg + sFit + sDen + sSeg);
  const final = publicSub;
  const tier = final >= HC_TIER.t1 ? "T1" : final >= HC_TIER.t2 ? "T2" : final >= HC_TIER.t3 ? "T3" : "T4";

  const whyNow: string[] = [];
  if (matched.length) whyNow.push(`Lists: ${matched.slice(0, 2).join(", ")}`);
  whyNow.push(`Profile: ${profile.note}`);
  if (rev && rev >= 10_000_000_000) whyNow.push("Mega-revenue: strategic priority");

  return {
    score_regulatory: r2(sReg),
    score_account_fit: r2(sFit),
    score_list_density: r2(sDen),
    score_segmentation: r2(sSeg),
    score_breach: 0,
    score_atom_intent: 0,
    score_atom_personas: 0,
    score_atom_freshness: 0,
    public_subtotal: publicSub,
    final_score: final,
    tier,
    why_now: whyNow.join(" | "),
  };
}

// ─── CLOUD/AI-INFRA RULE PACK ──────────────────────────────────────────────
type CloudWeights = {
  latency: number; security: number; gpu_inference: number; egress: number; multicloud: number; trigger: number;
};
type CloudSubvProfile = {
  latency: number; security: number; gpu_inference: number; egress: number; multicloud: number; trigger: number; note: string;
};

const CLOUD_DEFAULT_WEIGHTS: CloudWeights = { latency: 4, security: 4, gpu_inference: 4, egress: 3, multicloud: 3, trigger: 2 };
const CLOUD_DEFAULT_THRESHOLDS = { t1: 80, t2: 65, t3: 50 };

function clamp15(n: any): number {
  const v = Math.round(Number(n) || 0);
  if (v < 1) return 1;
  if (v > 5) return 5;
  return v;
}

function pickScore(direct: any, fallback: number): number {
  if (direct == null || direct === "") return fallback;
  return clamp15(direct);
}

function scoreCloudInfra(
  r: any,
  weights: CloudWeights,
  subvProfile: Record<string, CloudSubvProfile>,
  thresholds: { t1: number; t2: number; t3: number },
) {
  const extra = r.extra_tags_json || {};
  const segRaw = (r.sub_vertical || extra.segment || "enterprise_saas").toString().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const fallback: CloudSubvProfile =
    subvProfile[segRaw] || subvProfile["enterprise_saas"] || {
      latency: 3, security: 3, gpu_inference: 3, egress: 3, multicloud: 3, trigger: 2, note: "Unknown segment — neutral defaults",
    };

  const L = pickScore(extra.latency_score, fallback.latency);
  const S = pickScore(extra.security_score, fallback.security);
  const G = pickScore(extra.gpu_score ?? extra.gpu_inference_score, fallback.gpu_inference);
  const E = pickScore(extra.egress_score, fallback.egress);
  const M = pickScore(extra.multicloud_score, fallback.multicloud);
  const T = pickScore(extra.trigger_score, fallback.trigger);

  const final = r2(
    weights.latency * L +
      weights.security * S +
      weights.gpu_inference * G +
      weights.egress * E +
      weights.multicloud * M +
      weights.trigger * T,
  );
  const tier = final >= thresholds.t1 ? "T1" : final >= thresholds.t2 ? "T2" : final >= thresholds.t3 ? "T3" : "T4";

  const why = [
    `Segment: ${segRaw} (${fallback.note})`,
    `L=${L} S=${S} G=${G} E=${E} M=${M} T=${T}`,
  ];

  return {
    // We re-use the existing score_* columns to store the 6 cloud dimensions
    // — naming is a bit loose but it keeps the schema unchanged and the UI
    // still renders something sensible. Per-dim values are weight*raw so the
    // sum equals final_score.
    score_regulatory: r2(weights.security * S),       // security
    score_account_fit: r2(weights.gpu_inference * G), // gpu_inference
    score_list_density: r2(weights.egress * E),       // egress
    score_segmentation: r2(weights.multicloud * M),   // multicloud
    score_breach: r2(weights.trigger * T),            // trigger
    score_atom_intent: 0,
    score_atom_personas: 0,
    score_atom_freshness: r2(weights.latency * L),    // latency (parked here)
    public_subtotal: final,
    final_score: final,
    tier,
    why_now: why.join(" | "),
  };
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  try {
    // Fetch campaign to learn which template to apply
    const camps = await sb(`atom_campaigns?id=eq.${id}&select=id,scoring_template_slug&limit=1`);
    const camp = Array.isArray(camps) ? camps[0] : null;
    if (!camp) return res.status(404).json({ error: "campaign not found" });
    const templateSlug = (camp.scoring_template_slug || "healthcare-segmentation-hipaa").toString();

    // Load the template row (only need its config jsons for cloud-infra; healthcare is hardcoded)
    let cloudWeights = CLOUD_DEFAULT_WEIGHTS;
    let cloudThresholds = CLOUD_DEFAULT_THRESHOLDS;
    let cloudSubv: Record<string, CloudSubvProfile> = {};

    if (templateSlug === "cloud-ai-infrastructure-v1") {
      const tplRows = await sb(
        `atom_scoring_templates?slug=eq.${encodeURIComponent(templateSlug)}&select=weights_json,sub_vertical_profile_json,tier_thresholds_json&limit=1`,
      );
      const tpl = Array.isArray(tplRows) ? tplRows[0] : null;
      if (tpl?.weights_json) cloudWeights = { ...cloudWeights, ...tpl.weights_json };
      if (tpl?.tier_thresholds_json) cloudThresholds = { ...cloudThresholds, ...tpl.tier_thresholds_json };
      if (tpl?.sub_vertical_profile_json) cloudSubv = tpl.sub_vertical_profile_json || {};
    }

    // Paginate through accounts in the campaign and score each
    let scored = 0;
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const url = `atom_campaign_accounts?campaign_id=eq.${id}&select=id,sub_vertical,revenue,akafit,wallet_grade,extra_tags_json&order=id.asc&limit=${pageSize}&offset=${from}`;
      const rows: any[] = await sb(url);
      if (!Array.isArray(rows) || rows.length === 0) break;

      const updates = rows.map((r) => {
        const s = templateSlug === "cloud-ai-infrastructure-v1"
          ? scoreCloudInfra(r, cloudWeights, cloudSubv, cloudThresholds)
          : scoreHealthcare(r);
        return sb(`atom_campaign_accounts?id=eq.${r.id}`, {
          method: "PATCH",
          body: JSON.stringify(s),
          headers: { Prefer: "return=minimal" },
        });
      });
      for (let i = 0; i < updates.length; i += 25) {
        await Promise.all(updates.slice(i, i + 25));
      }
      scored += rows.length;
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    await sb(`atom_campaigns?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        scored_accounts: scored,
        status: "scored",
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });

    return res.json({ ok: true, scored, template: templateSlug });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "scoring failed" });
  }
}
