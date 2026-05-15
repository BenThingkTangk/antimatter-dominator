// ΔTOM campaign accounts list (with tier filter).
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

function mapAccount(r: any) {
  if (!r) return r;
  return {
    id: r.id,
    campaignId: r.campaign_id,
    accountName: r.account_name,
    domain: r.domain,
    state: r.state,
    subVertical: r.sub_vertical,
    revenue: r.revenue,
    akafit: r.akafit,
    walletGrade: r.wallet_grade,
    extraTags: r.extra_tags_json,
    scoreRegulatory: r.score_regulatory ?? 0,
    scoreBreach: r.score_breach ?? 0,
    scoreAccountFit: r.score_account_fit ?? 0,
    scoreSegmentation: r.score_segmentation ?? 0,
    scoreListDensity: r.score_list_density ?? 0,
    scoreAtomIntent: r.score_atom_intent ?? 0,
    scoreAtomPersonas: r.score_atom_personas ?? 0,
    scoreAtomFreshness: r.score_atom_freshness ?? 0,
    publicSubtotal: r.public_subtotal ?? 0,
    finalScore: r.final_score ?? 0,
    tier: r.tier,
    whyNow: r.why_now,
    recommendedMove: r.recommended_move,
    enrichStatus: r.enrich_status || "pending",
    enrichError: r.enrich_error,
    pushedTo: r.pushed_to,
    atomEnrichedAt: r.atom_enriched_at,
    evidenceJson: r.evidence_json,
    evidenceSource: r.evidence_source,
    rulesVersion: r.rules_version,
    ragContextJson: r.rag_context_json,
    ragSourcesJson: r.rag_sources_json,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  const tier = (req.query.tier || "").toString().toUpperCase();
  const limit = Math.min(parseInt((req.query.limit || "1000").toString(), 10) || 1000, 2000);

  try {
    let filter = `campaign_id=eq.${id}`;
    if (tier && ["T1", "T2", "T3", "T4"].includes(tier)) {
      filter += `&tier=eq.${tier}`;
    }
    const rows = await sb(
      `atom_campaign_accounts?${filter}&order=final_score.desc.nullslast&limit=${limit}&select=*`,
    );
    return res.json((rows || []).map(mapAccount));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "accounts failed" });
  }
}
