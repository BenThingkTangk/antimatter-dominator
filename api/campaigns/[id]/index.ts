// ΔTOM campaign detail.
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
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function sbCount(path: string): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const r = await fetch(url, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const cr = r.headers.get("content-range") || "*/0";
  const total = parseInt(cr.split("/")[1] || "0", 10);
  return isNaN(total) ? 0 : total;
}

function mapCampaign(row: any, counts?: { total: number; scored: number; enriched: number }) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    productSlug: row.product_slug,
    productLabel: row.product_label,
    scoringTemplateSlug: row.scoring_template_slug,
    status: row.status,
    totalAccounts: row.total_accounts ?? 0,
    scoredAccounts: row.scored_accounts ?? 0,
    enrichedAccounts: row.enriched_accounts ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    counts,
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

  try {
    const rows = await sb(`atom_campaigns?id=eq.${id}&limit=1`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return res.status(404).json({ error: "not found" });

    const [total, scored, enriched] = await Promise.all([
      sbCount(`atom_campaign_accounts?campaign_id=eq.${id}&select=id`),
      sbCount(`atom_campaign_accounts?campaign_id=eq.${id}&final_score=gt.0&select=id`),
      sbCount(`atom_campaign_accounts?campaign_id=eq.${id}&enrich_status=eq.ok&select=id`),
    ]);

    return res.json(mapCampaign(row, { total, scored, enriched }));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "campaign detail failed" });
  }
}
