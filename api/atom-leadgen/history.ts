/**
 * Call history listing + single-call fetch for the ATOM Dial replay view.
 *
 * GET /api/atom-leadgen/history             -> last 50 calls (compact)
 * GET /api/atom-leadgen/history?callSid=…   -> single call w/ full transcript + replay data
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`supabase ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tenant-Slug");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  const callSid    = String(req.query.callSid || req.query.call_sid || "").trim();
  const tenantSlug = String(req.query.tenant || req.query.tenantSlug || "").trim();

  try {
    if (callSid) {
      // Single-call detail
      const rows: any[] = await sb(
        `atom_calls?call_sid=eq.${encodeURIComponent(callSid)}&select=*`
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "not found" });
      }
      return res.status(200).json({ call: rows[0] });
    }

    // List
    const cols = [
      "id","call_sid","to_number","from_number","status","started_at","ended_at","duration_s",
      "recording_url","recording_sid","recording_status","record_enabled",
      "contact_name","company_name","product_name","pitch_topic","tenant_slug",
      "final_sentiment","final_intent","final_stage",
    ].join(",");
    let path = `atom_calls?select=${cols}&order=started_at.desc.nullslast&limit=50`;
    if (tenantSlug) path += `&tenant_slug=eq.${encodeURIComponent(tenantSlug)}`;
    const rows: any[] = await sb(path);
    return res.status(200).json({ calls: rows || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "failed" });
  }
}
