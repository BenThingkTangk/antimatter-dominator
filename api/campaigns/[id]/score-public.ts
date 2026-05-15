// ΔTOM public-signal scorer.
// Self-contained — Vercel nft can't reliably trace sibling imports.
// Logic mirrors server/scoring/engine.ts exactly.
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

// ── Scoring config ──────────────────────────────────────────────────────────
const WEIGHTS = {
  regulatory: 25, breach: 20, accountFit: 15, listDensity: 5, segmentation: 5,
  atomIntent: 12, atomPersonas: 10, atomFreshness: 8,
};
const SUB_VERTICAL: Record<string, { phi: number; seg: number; note: string }> = {
  "Healthcare Provider": { phi: 1.0, seg: 1.0, note: "Largest PHI volume + EHR/IoT segmentation pain; mandated by 2025 HIPAA rule" },
  "Healthcare Payer": { phi: 0.95, seg: 0.9, note: "Massive PHI; claims systems; high regulatory scrutiny" },
  "Pharma and Biotech": { phi: 0.55, seg: 0.85, note: "Clinical-trial data + IP; OT/lab segmentation" },
  "Medical Devices and Equipment": { phi: 0.45, seg: 0.95, note: "Connected devices = lateral-movement crown jewels" },
  "Health Tech": { phi: 0.7, seg: 0.8, note: "PHI handling varies; HIPAA BAA exposure" },
};
const WALLET: Record<string, number> = { "Mega Strategic": 1.0, "Strategic": 0.85, "Large Enterprise": 0.65 };
const AKAFIT: Record<string, number> = { A: 1.0, B: 0.65, C: 0.3 };
const HV_LISTS: Record<string, number> = {
  "2026 NC Must Win TAL": 1.0, "North America ESG 2026 TAL Prospects": 0.9, "2026 Bain Money Map": 0.85,
  "2026-H1 SDR Security Focus - Core": 1.0, "North America API 2026 TAL Prospects": 0.7,
  "API Sec NC Noname Tier 1.2 TAL": 0.6, "2023 Unified Threat Shield": 0.5, "ESG Focus 30": 0.95,
  "2025 NC Must Win TAL": 0.6, "2024 NC Must Win TAL": 0.4,
};
const TIER = { t1: 75, t2: 60, t3: 45 };

function r2(n: number) { return Math.round(n * 100) / 100; }
function revFactor(rev: number | null | undefined): number {
  if (typeof rev !== "number" || rev <= 0) return 0.3;
  if (rev >= 50_000_000_000) return 1.0;
  if (rev >= 10_000_000_000) return 0.92;
  if (rev >= 2_000_000_000) return 0.78;
  if (rev >= 500_000_000) return 0.62;
  if (rev >= 100_000_000) return 0.45;
  return 0.25;
}
function tierOf(score: number): "T1" | "T2" | "T3" | "T4" {
  if (score >= TIER.t1) return "T1";
  if (score >= TIER.t2) return "T2";
  if (score >= TIER.t3) return "T3";
  return "T4";
}

function scoreRow(r: any) {
  const sub = r.sub_vertical || "";
  const profile = SUB_VERTICAL[sub] || { phi: 0.3, seg: 0.3, note: "Unknown sub-vertical" };
  const rev = typeof r.revenue === "number" ? r.revenue : null;
  const rFac = revFactor(rev);
  const wFac = WALLET[r.wallet_grade || ""] ?? 0.4;
  const aFac = AKAFIT[(r.akafit || "").toUpperCase()] ?? 0.3;

  const extra = r.extra_tags_json || {};
  const tlRaw = (extra.target_lists || "").toString();
  const tokens = tlRaw.split(";").map((t: string) => t.trim()).filter(Boolean);
  let listScore = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    if (HV_LISTS[t] !== undefined) { listScore = Math.max(listScore, HV_LISTS[t]); matched.push(t); }
  }
  const density = Math.min(1.0, tokens.length / 8.0);
  const combined = 0.65 * listScore + 0.35 * density;

  const sReg = WEIGHTS.regulatory * (0.6 * profile.phi + 0.4 * rFac);
  const sFit = WEIGHTS.accountFit * (0.5 * aFac + 0.5 * wFac);
  const sDen = WEIGHTS.listDensity * combined;
  const sSeg = WEIGHTS.segmentation * profile.seg;
  const publicSub = r2(sReg + sFit + sDen + sSeg);

  // ATOM portion is 0 until enrichment runs.
  const final = publicSub;
  const tier = tierOf(final);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  try {
    // Pull all accounts in this campaign (paginated, 1000 at a time)
    let scored = 0;
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const url = `atom_campaign_accounts?campaign_id=eq.${id}&select=id,sub_vertical,revenue,akafit,wallet_grade,extra_tags_json&order=id.asc&limit=${pageSize}&offset=${from}`;
      const rows: any[] = await sb(url);
      if (!Array.isArray(rows) || rows.length === 0) break;

      // Score & PATCH each row (Supabase doesn't support bulk update by id in one call without RPC)
      // Use parallel writes in batches of 25 for throughput.
      const updates = rows.map((r) => {
        const s = scoreRow(r);
        return sb(`atom_campaign_accounts?id=eq.${r.id}`, {
          method: "PATCH",
          body: JSON.stringify(s),
          headers: { Prefer: "return=minimal" },
        });
      });
      // Run in chunks to avoid socket exhaustion
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

    return res.json({ ok: true, scored });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "scoring failed" });
  }
}
