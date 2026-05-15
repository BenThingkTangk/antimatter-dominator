// ΔTOM campaigns: list & create.
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

// Map snake_case rows from Postgres -> camelCase fields the frontend expects.
function mapCampaign(row: any) {
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
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const rows = await sb(
        "atom_campaigns?select=id,name,product_slug,product_label,scoring_template_slug,status,total_accounts,scored_accounts,enriched_accounts,created_at,updated_at&order=created_at.desc",
      );
      return res.json((rows || []).map(mapCampaign));
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const name = (body.name || "").toString().trim();
      const productSlug = (body.productSlug || "").toString().trim() || null;
      const productLabel = (body.productLabel || "").toString().trim() || null;
      const scoringTemplateSlug = (body.scoringTemplateSlug || "").toString().trim();
      if (!name) return res.status(400).json({ error: "name required" });
      if (!scoringTemplateSlug) return res.status(400).json({ error: "scoringTemplateSlug required" });

      // Verify template exists
      const tpl = await sb(
        `atom_scoring_templates?select=slug&slug=eq.${encodeURIComponent(scoringTemplateSlug)}&limit=1`,
      );
      if (!Array.isArray(tpl) || tpl.length === 0) {
        return res.status(400).json({ error: "Unknown scoring template" });
      }

      const inserted = await sb("atom_campaigns", {
        method: "POST",
        body: JSON.stringify({
          name,
          product_slug: productSlug,
          product_label: productLabel,
          scoring_template_slug: scoringTemplateSlug,
          status: "draft",
        }),
      });
      const row = Array.isArray(inserted) ? inserted[0] : inserted;
      return res.json(mapCampaign(row));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "campaigns failed" });
  }
}
