/**
 * Save the final transcript + sentiment history + warroom snapshot to
 * Supabase so the call-history detail page can replay it later from any
 * device (not just the browser that placed the call).
 *
 * POST /api/atom-leadgen/save-call
 *   { callSid, transcript, sentimentHistory, emotions, buyingSignals,
 *     warroom, finalSentiment, finalIntent, finalStage, duration }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendPush } from "../_lib/push";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

/** Fire push to all admins for a tenant when a meeting is booked. Non-blocking. */
async function notifyMeetingBooked(callRow: any) {
  try {
    const tenantSlug = callRow?.tenant_slug;
    if (!tenantSlug) return;
    // Resolve tenant → admin users
    const tenants = await sb(`tenants?slug=eq.${encodeURIComponent(tenantSlug)}&select=id`);
    const tenantId = tenants?.[0]?.id;
    if (!tenantId) return;
    const admins = await sb(`tenant_users?tenant_id=eq.${tenantId}&role=eq.admin&deleted_at=is.null&select=id,full_name`);
    if (!Array.isArray(admins) || admins.length === 0) return;
    const contactName = callRow.contact_name || "Unknown";
    const companyName = callRow.company_name || "";
    for (const admin of admins) {
      sendPush(admin.id, {
        title: "Meeting booked",
        body: `${contactName}${companyName ? ` (${companyName})` : ""} — via ΔTOM dial`,
        url: `/#/m/home`,
      }).catch(() => {});
    }
  } catch (err: any) {
    console.warn("[save-call] push notify failed:", err?.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST")   return res.status(405).json({ error: "method" });

  const b = req.body || {};
  const callSid = (b.callSid || b.call_sid || "").toString().trim();
  if (!callSid) return res.status(400).json({ error: "callSid required" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  // Cap transcript size — pathological calls could blow up Postgres rows.
  const transcript        = Array.isArray(b.transcript)        ? b.transcript.slice(-400)        : null;
  const sentimentHistory  = Array.isArray(b.sentimentHistory)  ? b.sentimentHistory.slice(-200)  : null;
  const buyingSignals     = Array.isArray(b.buyingSignals)     ? b.buyingSignals.slice(0, 64)    : null;

  const patch: any = {
    transcript_json:         transcript,
    sentiment_history_json:  sentimentHistory,
    emotions_json:           (b.emotions && typeof b.emotions === "object") ? b.emotions : null,
    buying_signals_json:     buyingSignals,
    warroom_json:            (b.warroom && typeof b.warroom === "object") ? b.warroom : null,
    final_sentiment:         Number.isFinite(Number(b.finalSentiment)) ? Math.round(Number(b.finalSentiment)) : null,
    final_intent:            Number.isFinite(Number(b.finalIntent))    ? Math.round(Number(b.finalIntent))    : null,
    final_stage:             (b.finalStage || b.stage || "").toString() || null,
    ended_at:                new Date().toISOString(),
  };
  if (Number.isFinite(Number(b.duration)) && Number(b.duration) > 0) {
    patch.duration_s = Math.round(Number(b.duration));
  }
  if (b.contactName)  patch.contact_name = String(b.contactName).slice(0, 200);
  if (b.companyName)  patch.company_name = String(b.companyName).slice(0, 200);
  if (b.productName || b.product)
    patch.product_name = String(b.productName || b.product).slice(0, 200);

  try {
    // Try PATCH first (row was seeded at dial time).
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/atom_calls?call_sid=eq.${encodeURIComponent(callSid)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(patch),
      }
    );
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(500).json({ error: `supabase ${r.status}: ${t.slice(0, 200)}` });
    }
    const rows: any[] = await r.json();
    // If no row existed yet (browser-only fallback), insert one.
    if (!rows || rows.length === 0) {
      const insert = await fetch(`${SUPABASE_URL}/rest/v1/atom_calls`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          call_sid: callSid,
          status: "completed",
          started_at: new Date(Date.now() - (Number(b.duration) || 0) * 1000).toISOString(),
          ...patch,
        }),
      });
      if (!insert.ok) {
        const t = await insert.text().catch(() => "");
        return res.status(500).json({ error: `supabase insert ${insert.status}: ${t.slice(0, 200)}` });
      }
      const inserted: any[] = await insert.json();
      const insertedRow = inserted?.[0] || null;
      if (patch.final_stage === "meeting_booked" && insertedRow) {
        notifyMeetingBooked(insertedRow).catch(() => {});
      }
      return res.status(200).json({ ok: true, row: insertedRow, mode: "insert" });
    }
    const savedRow = rows[0];
    // Fire push notification if meeting was booked (non-blocking)
    if (patch.final_stage === "meeting_booked" && savedRow) {
      notifyMeetingBooked(savedRow).catch(() => {});
    }
    return res.status(200).json({ ok: true, row: savedRow, mode: "update" });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "failed" });
  }
}
