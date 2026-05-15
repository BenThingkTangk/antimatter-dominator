// ΔTOM bulk import — POST { accounts: [...] }
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const MAX_ROWS = 5000;

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const accounts: any[] = Array.isArray(body.accounts) ? body.accounts : [];
    if (accounts.length === 0) return res.status(400).json({ error: "accounts array empty" });
    if (accounts.length > MAX_ROWS) {
      return res.status(400).json({ error: `Too many rows. Max ${MAX_ROWS} per import.` });
    }

    // Verify campaign exists
    const camp = await sb(`atom_campaigns?id=eq.${id}&select=id&limit=1`);
    if (!Array.isArray(camp) || camp.length === 0) return res.status(404).json({ error: "campaign not found" });

    const rows = accounts
      .filter((a) => (a?.accountName || "").toString().trim())
      .map((a) => ({
        campaign_id: id,
        account_name: (a.accountName || "").toString().trim(),
        domain: a.domain || null,
        state: a.state || null,
        sub_vertical: a.subVertical || null,
        revenue: typeof a.revenue === "number" ? a.revenue : null,
        akafit: a.akafit || null,
        wallet_grade: a.walletGrade || null,
        extra_tags_json: a.extraTags || {},
        enrich_status: "pending",
      }));

    if (rows.length === 0) return res.status(400).json({ error: "No valid rows after filtering" });

    // Batch insert in chunks of 500
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      await sb("atom_campaign_accounts", {
        method: "POST",
        body: JSON.stringify(batch),
        headers: { Prefer: "return=minimal" },
      });
      inserted += batch.length;
    }

    // Update campaign totals
    await sb(`atom_campaigns?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        total_accounts: inserted,
        status: "importing",
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });

    return res.json({ ok: true, inserted });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "import failed" });
  }
}
