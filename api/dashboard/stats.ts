/**
 * GET /api/dashboard/stats
 * Tenant KPI dashboard — returns 6 metric families (volume, quality, output,
 * efficiency, health, compliance) aggregated from usage_events + atom_calls +
 * atom_campaign_accounts for the authenticated tenant.
 *
 * Auth: atom_session cookie (same as /api/auth/me).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
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

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

// ─── Date helpers ──────────────────────────────────────────────────────────
function startOfDay(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfWeek(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday start
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function startOfMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    // ── Auth: resolve tenant from session cookie ──
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=id,user_id,tenant_id,expires_at`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    const tenantId = session.tenant_id;

    // ── Resolve tenant slug (atom_calls uses tenant_slug, not tenant_id) ──
    const tenants = await sb(`tenants?id=eq.${tenantId}&select=slug`);
    const tenantSlug = Array.isArray(tenants) && tenants[0] ? tenants[0].slug : null;

    // ── Parallel data fetch ──
    const todayISO = startOfDay();
    const weekISO = startOfWeek();
    const monthISO = startOfMonth();
    const d7 = daysAgo(7);
    const d30 = daysAgo(30);

    const [
      usageToday,
      usageWeek,
      usageMonth,
      usageAll,
      callsMonth,
      calls7d,
      calls30d,
      campaignAccounts,
      usageEvents30d,
      tenantUsers,
    ] = await Promise.all([
      // Volume: usage_events counts
      sb(`usage_events?tenant_id=eq.${tenantId}&entitlement=eq.voice&created_at=gte.${todayISO}&select=qty,metadata`).catch(() => []),
      sb(`usage_events?tenant_id=eq.${tenantId}&entitlement=eq.voice&created_at=gte.${weekISO}&select=qty`).catch(() => []),
      sb(`usage_events?tenant_id=eq.${tenantId}&entitlement=eq.voice&created_at=gte.${monthISO}&select=qty,metadata`).catch(() => []),
      sb(`usage_events?tenant_id=eq.${tenantId}&select=qty,entitlement,created_at&order=created_at.desc&limit=5000`).catch(() => []),
      // Calls this month
      tenantSlug
        ? sb(`atom_calls?tenant_slug=eq.${encodeURIComponent(tenantSlug)}&started_at=gte.${monthISO}&select=id,status,duration_s,final_sentiment,final_intent,final_stage,started_at,ended_at,contact_name`).catch(() => [])
        : Promise.resolve([]),
      // Calls last 7 days
      tenantSlug
        ? sb(`atom_calls?tenant_slug=eq.${encodeURIComponent(tenantSlug)}&started_at=gte.${d7}&select=id,status,duration_s`).catch(() => [])
        : Promise.resolve([]),
      // Calls last 30 days (for sentiment trend)
      tenantSlug
        ? sb(`atom_calls?tenant_slug=eq.${encodeURIComponent(tenantSlug)}&started_at=gte.${d30}&select=final_sentiment,started_at,duration_s`).catch(() => [])
        : Promise.resolve([]),
      // Campaign accounts for health metrics
      tenantSlug
        ? sb(`atom_campaign_accounts?tenant_slug=eq.${encodeURIComponent(tenantSlug)}&select=id,created_at,enrich_status&limit=2000`).catch(() => [])
        : Promise.resolve([]),
      // All usage_events last 30d for health metrics
      sb(`usage_events?tenant_id=eq.${tenantId}&created_at=gte.${d30}&select=entitlement,qty,metadata,created_at`).catch(() => []),
      // Tenant users for per-rep breakdown
      sb(`tenant_users?tenant_id=eq.${tenantId}&deleted_at=is.null&select=id,full_name,email`).catch(() => []),
    ]);

    // ── VOLUME ──
    const sumQty = (rows: any[]) =>
      Array.isArray(rows) ? rows.reduce((s, r) => s + (r.qty || 1), 0) : 0;

    const today = sumQty(usageToday);
    const thisWeek = sumQty(usageWeek);
    const thisMonth = sumQty(usageMonth);

    // Per-rep breakdown from usage_events metadata.user_id
    const repMap: Record<string, number> = {};
    for (const ev of usageMonth ?? []) {
      const uid = ev.metadata?.user_id || "unknown";
      repMap[uid] = (repMap[uid] || 0) + (ev.qty || 1);
    }
    const userLookup: Record<string, string> = {};
    for (const u of tenantUsers ?? []) {
      userLookup[u.id] = u.full_name || u.email || u.id;
    }
    const perRep = Object.entries(repMap)
      .map(([userId, count]) => ({
        userId,
        name: userLookup[userId] || userId.slice(0, 8),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // ── QUALITY ──
    const safe7d = Array.isArray(calls7d) ? calls7d : [];
    const initiated7d = safe7d.length;
    const connected7d = safe7d.filter(
      (c: any) => c.status === "completed" || c.status === "in-progress"
    ).length;
    const pickupRate = initiated7d > 0 ? Math.round((connected7d / initiated7d) * 100) : 0;

    const completedMonth = (Array.isArray(callsMonth) ? callsMonth : []).filter(
      (c: any) => c.status === "completed" && c.duration_s > 0
    );
    const avgDuration =
      completedMonth.length > 0
        ? Math.round(
            completedMonth.reduce((s: number, c: any) => s + (c.duration_s || 0), 0) /
              completedMonth.length
          )
        : 0;

    // Truth score from final_sentiment (0-100 scale → 0-1)
    const scored = completedMonth.filter(
      (c: any) => c.final_sentiment !== null && c.final_sentiment !== undefined
    );
    const avgTruthScore =
      scored.length > 0
        ? Math.round(
            (scored.reduce((s: number, c: any) => s + Math.abs(c.final_sentiment), 0) /
              scored.length /
              100) *
              100
          ) / 100
        : 0;

    // Sentiment trend — daily average over 30 days
    const safe30d = Array.isArray(calls30d) ? calls30d : [];
    const dayBuckets: Record<string, { sum: number; count: number }> = {};
    for (const c of safe30d) {
      if (c.final_sentiment === null || c.final_sentiment === undefined) continue;
      const day = (c.started_at || "").slice(0, 10);
      if (!day) continue;
      if (!dayBuckets[day]) dayBuckets[day] = { sum: 0, count: 0 };
      dayBuckets[day].sum += c.final_sentiment;
      dayBuckets[day].count++;
    }
    const sentimentTrend = Object.entries(dayBuckets)
      .map(([date, { sum, count }]) => ({
        date,
        score: Math.round(sum / count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── OUTPUT ──
    const meetingsBooked = (Array.isArray(callsMonth) ? callsMonth : []).filter(
      (c: any) => c.final_stage === "meeting_booked"
    ).length;
    const pipelineDials = (Array.isArray(callsMonth) ? callsMonth : []).filter(
      (c: any) =>
        c.final_stage === "meeting_booked" ||
        c.final_stage === "interested" ||
        c.final_stage === "follow_up"
    ).length;

    // ── EFFICIENCY ──
    const voiceEvents = (Array.isArray(usageAll) ? usageAll : []).filter(
      (e: any) => e.entitlement === "voice"
    );
    const totalCostCents = voiceEvents.reduce(
      (s: number, e: any) => s + (e.metadata?.cost_cents || 0),
      0
    );
    const totalDials = sumQty(voiceEvents);
    const costPerDial = totalDials > 0 ? Math.round(totalCostCents / totalDials) : 0;
    const costPerMeeting =
      meetingsBooked > 0 ? Math.round((costPerDial * thisMonth) / meetingsBooked) : 0;

    // ── HEALTH ──
    const safeUE30 = Array.isArray(usageEvents30d) ? usageEvents30d : [];
    const emailsSent = safeUE30.filter((e: any) => e.entitlement === "email").length;
    const bounces = safeUE30.filter(
      (e: any) => e.entitlement === "email" && e.metadata?.bounce === true
    ).length;
    const optOuts = safeUE30.filter(
      (e: any) => e.entitlement === "email" && e.metadata?.opt_out === true
    ).length;
    const hardBounceRate = emailsSent > 0 ? Math.round((bounces / emailsSent) * 100) : 0;
    const optOutRate = emailsSent > 0 ? Math.round((optOuts / emailsSent) * 1000) / 10 : 0;

    // Campaign fatigue — estimate from repeat-contacted prospects
    const safeCampaign = Array.isArray(campaignAccounts) ? campaignAccounts : [];
    const channelSaturation = safeCampaign.length > 0
      ? Math.round(
          (safeCampaign.filter((a: any) => a.enrich_status === "done").length /
            safeCampaign.length) *
            100
        )
      : 0;
    const campaignFatigue = Math.min(100, Math.round(channelSaturation * 0.6));

    // ── COMPLIANCE ──
    const tcpaFlagged = safeUE30.filter(
      (e: any) => e.metadata?.tcpa_blocked === true
    ).length;
    const lastScrub = safeUE30
      .filter((e: any) => e.metadata?.dnc_scrub === true)
      .sort((a: any, b: any) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      )[0];
    const dncScrubLastAt = lastScrub?.created_at || null;
    const dncScrubNextDue = dncScrubLastAt
      ? new Date(new Date(dncScrubLastAt).getTime() + 30 * 86_400_000).toISOString()
      : null;

    return res.status(200).json({
      volume: { today, thisWeek, thisMonth, perRep },
      quality: { pickupRate, avgDuration, avgTruthScore, sentimentTrend },
      output: { meetingsBooked, pipelineDials },
      efficiency: { costPerDial, costPerMeeting },
      health: { campaignFatigue, channelSaturation, hardBounceRate, optOutRate },
      compliance: { tcpaFlagged, dncScrubLastAt, dncScrubNextDue },
    });
  } catch (e: any) {
    console.error("[dashboard/stats]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
