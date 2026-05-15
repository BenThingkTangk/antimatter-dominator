// ΔTOM push — marks selected accounts as pushed to a downstream target
// (e.g. "atom-prospects", "outreach", "salesforce"). For now this is a
// soft-push: we tag the rows so the UI reflects the action.
// Wiring to real CRM/sequencer happens in a follow-up.
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const accountIds: number[] = Array.isArray(body.accountIds)
      ? body.accountIds.map((x: any) => parseInt(x, 10)).filter((x: number) => !isNaN(x))
      : [];
    const target = (body.target || "atom-prospects").toString().trim();
    if (accountIds.length === 0) return res.status(400).json({ error: "accountIds required" });

    const idsCsv = accountIds.join(",");
    await sb(`atom_campaign_accounts?id=in.(${idsCsv})&campaign_id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ pushed_to: target }),
      headers: { Prefer: "return=minimal" },
    });

    return res.json({ ok: true, pushed: accountIds.length, target });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "push failed" });
  }
}
