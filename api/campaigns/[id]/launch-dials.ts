// ΔTOM launch-dials — stub endpoint for triggering ATOM Voice dials on a
// campaign. Validates the campaign exists and is in 'ready' status, then
// returns a queued count. Actual dial orchestration (Telnyx SIP, voice
// pipeline) will be wired in the ATOM Voice integration phase.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  try {
    // Verify campaign exists and is ready
    const rows = await sb(`campaigns?id=eq.${id}&select=id,name,status`);
    if (!rows?.length) return res.status(404).json({ error: "Campaign not found" });
    const campaign = rows[0];
    if (campaign.status !== "ready") {
      return res.status(400).json({ error: `Campaign status is '${campaign.status}', must be 'ready' to launch dials` });
    }

    // Count accounts available for dialing
    const accounts = await sb(
      `campaign_accounts?campaign_id=eq.${id}&select=id&enrich_status=in.(ok,done)`,
      { headers: { Prefer: "count=exact" } },
    );
    const queued = Array.isArray(accounts) ? accounts.length : 0;

    // TODO: Wire to ATOM Voice orchestrator (Telnyx SIP outbound)
    // For now, return the count of accounts that would be dialed.
    return res.status(200).json({ ok: true, campaignId: id, queued });
  } catch (err: any) {
    console.error("launch-dials error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
