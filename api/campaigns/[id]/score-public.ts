// ΔTOM public-signal scorer v2 — rule packs versioned in git.
//
// Canonical rule packs live as JSON at /api/_rules/*.json so they get diffs,
// PR review, and rollback. But Vercel nft tracing is unreliable for sibling
// file imports (see api/_lib/apollo.ts), so the actual scorer inlines the
// pack data here. Keep these literals in sync with the JSON spec — the
// RULE_PACK_VERSION_CHECK at the bottom will scream during local dev if you
// edit one but forget the other.
//
// Two engines today:
//   1. engine = "healthcare-hipaa-v1"   (4-dim public + 3-dim ATOM)
//   2. engine = "cloud-ai-infra-v1"     (4L + 4S + 4G + 3E + 3M + 2T)

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ── INLINED RULE PACKS (mirror /api/_rules/*.v1.json) ──────────────────────
const healthcarePack = {
  slug: "healthcare-segmentation-hipaa",
  version: "v1.0.0",
  engine: "healthcare-hipaa-v1",
  weights: {
    regulatory: 25, breach: 20, account_fit: 15, list_density: 5, segmentation: 5,
    atom_intent: 12, atom_personas: 10, atom_freshness: 8,
  },
  sub_vertical_profile: {
    "Healthcare Provider":           { phi: 1.0,  seg: 1.0,  note: "Largest PHI volume + EHR/IoT segmentation pain; mandated by 2025 HIPAA rule" },
    "Healthcare Payer":              { phi: 0.95, seg: 0.9,  note: "Massive PHI; claims systems; high regulatory scrutiny" },
    "Pharma and Biotech":            { phi: 0.55, seg: 0.85, note: "Clinical-trial data + IP; OT/lab segmentation" },
    "Medical Devices and Equipment": { phi: 0.45, seg: 0.95, note: "Connected devices = lateral-movement crown jewels" },
    "Health Tech":                   { phi: 0.7,  seg: 0.8,  note: "PHI handling varies; HIPAA BAA exposure" },
  } as Record<string, { phi: number; seg: number; note: string }>,
  revenue_factors: [
    { min: 50_000_000_000, factor: 1.0 },
    { min: 10_000_000_000, factor: 0.92 },
    { min: 2_000_000_000,  factor: 0.78 },
    { min: 500_000_000,    factor: 0.62 },
    { min: 100_000_000,    factor: 0.45 },
    { min: 0,              factor: 0.25 },
  ],
  akafit_multipliers: { A: 1.0, B: 0.65, C: 0.3 } as Record<string, number>,
  wallet_multipliers: { "Mega Strategic": 1.0, "Strategic": 0.85, "Large Enterprise": 0.65 } as Record<string, number>,
  high_value_lists: {
    "2026 NC Must Win TAL": 1.0, "North America ESG 2026 TAL Prospects": 0.9, "2026 Bain Money Map": 0.85,
    "2026-H1 SDR Security Focus - Core": 1.0, "North America API 2026 TAL Prospects": 0.7,
    "API Sec NC Noname Tier 1.2 TAL": 0.6, "2023 Unified Threat Shield": 0.5, "ESG Focus 30": 0.95,
    "2025 NC Must Win TAL": 0.6, "2024 NC Must Win TAL": 0.4,
  } as Record<string, number>,
  tiers: {
    T1: { min: 75, action: "executive_play — direct CISO outreach + Akamai Guardicore segmentation pitch" },
    T2: { min: 60, action: "automated_sequence — ATOM Voice Bridge + nurture" },
    T3: { min: 45, action: "nurture — content drip, watch for breach/regulatory triggers" },
    T4: { min: 0,  action: "hold — not a fit today" },
  } as Record<string, { min: number; action: string }>,
};

const cloudPack = {
  slug: "cloud-ai-infrastructure-v1",
  version: "v1.0.0",
  engine: "cloud-ai-infra-v1",
  weights: {
    latency: 4, security: 4, gpu_inference: 4, egress: 3, multicloud: 3, trigger: 2,
  } as Record<string, number>,
  sub_vertical_profile: {
    ai_saas:         { latency: 4, security: 4, gpu_inference: 5, egress: 3, multicloud: 3, trigger: 3, note: "Core inference product, heavy GPU + RAG/LLM dependency" },
    fintech_fraud:   { latency: 5, security: 5, gpu_inference: 3, egress: 2, multicloud: 3, trigger: 3, note: "Real-time fraud detection, regulated, latency-critical" },
    voice_ai:        { latency: 5, security: 4, gpu_inference: 5, egress: 3, multicloud: 3, trigger: 4, note: "Real-time voice + GPU inference, edge-native" },
    healthcare_ai:   { latency: 4, security: 5, gpu_inference: 4, egress: 2, multicloud: 4, trigger: 3, note: "PHI + HIPAA + sovereignty mandate" },
    sports_media:    { latency: 4, security: 3, gpu_inference: 3, egress: 5, multicloud: 3, trigger: 3, note: "Heavy media/files/global traffic, latency-sensitive playback" },
    enterprise_saas: { latency: 3, security: 4, gpu_inference: 3, egress: 3, multicloud: 3, trigger: 2, note: "General enterprise workloads, moderate everything" },
    gov_defense:     { latency: 3, security: 5, gpu_inference: 3, egress: 2, multicloud: 5, trigger: 3, note: "Sovereignty mandate, regulated, multicloud-required" },
  } as Record<string, { latency: number; security: number; gpu_inference: number; egress: number; multicloud: number; trigger: number; note: string }>,
  tiers: {
    T1: { min: 80, action: "executive_play — direct CISO/CTO outreach + Akamai+Linode joint pitch" },
    T2: { min: 65, action: "automated_sequence — ATOM Voice Bridge + nurture" },
    T3: { min: 50, action: "nurture — content drip, watch for trigger events" },
    T4: { min: 0,  action: "hold — not a fit today" },
  } as Record<string, { min: number; action: string }>,
};

type RulePack = typeof healthcarePack | typeof cloudPack;

const PACKS: Record<string, RulePack> = {
  "healthcare-segmentation-hipaa": healthcarePack as RulePack,
  "cloud-ai-infrastructure-v1":    cloudPack as RulePack,
};

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

function tierFromThresholds(score: number, tiers: any): "T1" | "T2" | "T3" | "T4" {
  if (score >= (tiers?.T1?.min ?? 75)) return "T1";
  if (score >= (tiers?.T2?.min ?? 60)) return "T2";
  if (score >= (tiers?.T3?.min ?? 45)) return "T3";
  return "T4";
}

// ─── HEALTHCARE ENGINE ─────────────────────────────────────────────────────
function revFactor(rev: number | null | undefined, table: any[]): number {
  if (typeof rev !== "number" || rev <= 0) return (table.find((t) => t.min === 0)?.factor) ?? 0.25;
  for (const t of table) {
    if (rev >= t.min) return t.factor;
  }
  return 0.25;
}

// Breach signal weighting:
// - Direct breach (account had its own incident): 0.95 × weight
// - Peer breach only (industry peers breached): 0.60 × weight
// - No evidence yet: 0.20 × weight (we assume some baseline risk in healthcare)
function breachFactor(direct: any, peer: any): number {
  const hasDirect = Array.isArray(direct) ? direct.length > 0 : (direct && typeof direct === "object" && Object.keys(direct).length > 0);
  const hasPeer = Array.isArray(peer) ? peer.length > 0 : (peer && typeof peer === "object" && Object.keys(peer).length > 0);
  if (hasDirect) return 0.95;
  if (hasPeer) return 0.60;
  return 0.20;
}

function scoreHealthcare(r: any, pack: any) {
  const W = pack.weights;
  const SUBV = pack.sub_vertical_profile || {};
  const LISTS = pack.high_value_lists || {};
  const AKAFIT = pack.akafit_multipliers || {};
  const WALLET = pack.wallet_multipliers || {};
  const REVTBL = pack.revenue_factors || [];

  const sub = r.sub_vertical || "";
  const profile = SUBV[sub] || { phi: 0.3, seg: 0.3, note: "Unknown sub-vertical" };
  const rev = typeof r.revenue === "number" ? r.revenue : null;
  const rFac = revFactor(rev, REVTBL);
  const wFac = WALLET[r.wallet_grade || ""] ?? 0.4;
  const aFac = AKAFIT[(r.akafit || "").toUpperCase()] ?? 0.3;

  const extra = r.extra_tags_json || {};
  const tlRaw = (extra.target_lists || "").toString();
  const tokens = tlRaw.split(";").map((t: string) => t.trim()).filter(Boolean);
  let listScore = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    if (LISTS[t] !== undefined) { listScore = Math.max(listScore, LISTS[t]); matched.push(t); }
  }
  const density = Math.min(1.0, tokens.length / 8.0);
  const combined = 0.65 * listScore + 0.35 * density;

  const sReg = W.regulatory * (0.6 * profile.phi + 0.4 * rFac);
  const sFit = W.account_fit * (0.5 * aFac + 0.5 * wFac);
  const sDen = W.list_density * combined;
  const sSeg = W.segmentation * profile.seg;
  const bFac = breachFactor(r.direct_breach_json, r.peer_breach_json);
  const sBreach = W.breach * bFac;
  const publicSub = r2(sReg + sFit + sDen + sSeg + sBreach);
  const final = publicSub;
  const tier = tierFromThresholds(final, pack.tiers);
  const tierMeta = pack.tiers?.[tier] || {};
  const recommendedMove = tierMeta.action || null;

  const whyNow: string[] = [];
  if (matched.length) whyNow.push(`Lists: ${matched.slice(0, 2).join(", ")}`);
  whyNow.push(`Profile: ${profile.note}`);
  if (rev && rev >= 10_000_000_000) whyNow.push("Mega-revenue: strategic priority");
  if (bFac >= 0.9) whyNow.push("Direct breach history on file");
  else if (bFac >= 0.5) whyNow.push("Peer breach pressure in segment");

  return {
    score_regulatory: r2(sReg),
    score_account_fit: r2(sFit),
    score_list_density: r2(sDen),
    score_segmentation: r2(sSeg),
    score_breach: r2(sBreach),
    score_atom_intent: 0,
    score_atom_personas: 0,
    score_atom_freshness: 0,
    public_subtotal: publicSub,
    final_score: final,
    tier,
    why_now: whyNow.join(" | "),
    recommended_move: recommendedMove,
  };
}

// ─── CLOUD/AI-INFRA ENGINE ─────────────────────────────────────────────────
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

function scoreCloudInfra(r: any, pack: any) {
  const W = pack.weights;
  const SUBV = pack.sub_vertical_profile || {};

  const extra = r.extra_tags_json || {};
  const segRaw = (r.sub_vertical || extra.segment || "enterprise_saas")
    .toString().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const fallback = SUBV[segRaw] || SUBV["enterprise_saas"] || {
    latency: 3, security: 3, gpu_inference: 3, egress: 3, multicloud: 3, trigger: 2,
    note: "Unknown segment — neutral defaults",
  };

  const L = pickScore(extra.latency_score, fallback.latency);
  const S = pickScore(extra.security_score, fallback.security);
  const G = pickScore(extra.gpu_score ?? extra.gpu_inference_score, fallback.gpu_inference);
  const E = pickScore(extra.egress_score, fallback.egress);
  const M = pickScore(extra.multicloud_score, fallback.multicloud);
  const T = pickScore(extra.trigger_score, fallback.trigger);

  const final = r2(W.latency * L + W.security * S + W.gpu_inference * G + W.egress * E + W.multicloud * M + W.trigger * T);
  const tier = tierFromThresholds(final, pack.tiers);
  const tierMeta = pack.tiers?.[tier] || {};

  const why = [
    `Segment: ${segRaw} (${fallback.note})`,
    `L=${L} S=${S} G=${G} E=${E} M=${M} T=${T}`,
  ];

  return {
    // Re-use existing score_* columns to store the 6 cloud dimensions.
    score_regulatory: r2(W.security * S),       // security
    score_account_fit: r2(W.gpu_inference * G), // gpu_inference
    score_list_density: r2(W.egress * E),       // egress
    score_segmentation: r2(W.multicloud * M),   // multicloud
    score_breach: r2(W.trigger * T),            // trigger
    score_atom_intent: 0,
    score_atom_personas: 0,
    score_atom_freshness: r2(W.latency * L),    // latency
    public_subtotal: final,
    final_score: final,
    tier,
    why_now: why.join(" | "),
    recommended_move: tierMeta.action || null,
  };
}

// ─── DISPATCH ──────────────────────────────────────────────────────────────
function scoreRow(r: any, pack: any) {
  switch (pack.engine) {
    case "healthcare-hipaa-v1": return scoreHealthcare(r, pack);
    case "cloud-ai-infra-v1":   return scoreCloudInfra(r, pack);
    default: throw new Error(`Unknown rule pack engine: ${pack.engine}`);
  }
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
    const camps = await sb(`atom_campaigns?id=eq.${id}&select=id,scoring_template_slug&limit=1`);
    const camp = Array.isArray(camps) ? camps[0] : null;
    if (!camp) return res.status(404).json({ error: "campaign not found" });

    const templateSlug = (camp.scoring_template_slug || "healthcare-segmentation-hipaa").toString();
    const pack = PACKS[templateSlug];
    if (!pack) return res.status(400).json({ error: `No rule pack for slug: ${templateSlug}` });

    let scored = 0;
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const url = `atom_campaign_accounts?campaign_id=eq.${id}&select=id,sub_vertical,revenue,akafit,wallet_grade,extra_tags_json,direct_breach_json,peer_breach_json&order=id.asc&limit=${pageSize}&offset=${from}`;
      const rows: any[] = await sb(url);
      if (!Array.isArray(rows) || rows.length === 0) break;

      const updates = rows.map((r) => {
        const s = scoreRow(r, pack);
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

    return res.json({ ok: true, scored, template: templateSlug, rule_version: (pack as any).version });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "scoring failed" });
  }
}
