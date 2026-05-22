/**
 * GET /api/cron/trial-expiring
 *
 * Vercel Cron — runs daily. Queries tenants whose trial_ends_at is 7, 3, or 1
 * days away and sends a trial-expiring email to the owner.
 *
 * Auth: CRON_SECRET header (Vercel injects automatically for crons).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../_lib/send-email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);
const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://atom-dominator-pro.vercel.app";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  // Verify cron secret if configured
  if (CRON_SECRET) {
    const provided = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (provided !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();
    const sent: string[] = [];

    for (const daysRemaining of [7, 3, 1]) {
      // Target date = now + daysRemaining days (± 12 hours to catch the window)
      const target = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
      const dayStart = new Date(target);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(target);
      dayEnd.setHours(23, 59, 59, 999);

      const tenants = await sb(
        `tenants?subscription_status=eq.trialing&trial_ends_at=gte.${dayStart.toISOString()}&trial_ends_at=lte.${dayEnd.toISOString()}&deleted_at=is.null&select=id,owner_email,name,seats`
      );

      if (!Array.isArray(tenants)) continue;

      for (const tenant of tenants) {
        if (!tenant.owner_email) continue;

        // Get first name from owner's user record
        let firstName = "there";
        try {
          const users = await sb(
            `tenant_users?tenant_id=eq.${tenant.id}&email=eq.${encodeURIComponent(tenant.owner_email)}&deleted_at=is.null&select=full_name&limit=1`
          );
          if (Array.isArray(users) && users[0]?.full_name) {
            firstName = users[0].full_name.split(" ")[0];
          }
        } catch {}

        // Get usage stats (best-effort)
        let dials = 0;
        let meetings = 0;
        try {
          const stats = await sb(
            `tenant_stats?tenant_id=eq.${tenant.id}&select=total_dials,total_meetings&limit=1`
          );
          if (Array.isArray(stats) && stats[0]) {
            dials = stats[0].total_dials || 0;
            meetings = stats[0].total_meetings || 0;
          }
        } catch {}

        sendEmail("trial-expiring", tenant.owner_email, {
          daysRemaining,
          upgradeUrl: `${APP_URL}/#/billing`,
          dials,
          meetings,
          firstName,
        }, { tenantId: tenant.id }).catch(() => {});

        sent.push(`${tenant.owner_email} (${daysRemaining}d)`);
      }
    }

    return res.status(200).json({ ok: true, sent: sent.length, details: sent });
  } catch (e: any) {
    console.error("[cron/trial-expiring]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
