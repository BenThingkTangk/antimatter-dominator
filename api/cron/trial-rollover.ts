/**
 * /api/cron/trial-rollover — daily 09:00 UTC
 *
 * For every tenant where trial_ends_at < now() AND subscription_status = 'trialing':
 *   - If stripe_subscription_id is set → no-op (Stripe handles billing).
 *   - Else → mark subscription_status='past_due', kill_switch=true.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);

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
  // Fail-closed CRON auth. Accepts Vercel cron's bearer header AND the
  // x-vercel-cron internal hint, but only when CRON_SECRET is configured.
  if (!CRON_SECRET) {
    return res.status(503).json({ error: "cron receiver not configured" });
  }
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const vercelCron = String(req.headers["x-vercel-cron"] || "");
  if (auth !== CRON_SECRET && vercelCron !== "1") {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "supabase not configured" });
  }

  try {
    const now = new Date().toISOString();

    // Find all trialing tenants whose trial has expired
    const expiredTrials = await sb(
      `tenants?subscription_status=eq.trialing&trial_ends_at=lt.${now}&deleted_at=is.null&select=id,slug,owner_email,stripe_subscription_id`
    );

    if (!Array.isArray(expiredTrials) || expiredTrials.length === 0) {
      return res.status(200).json({ processed: 0, message: "No expired trials" });
    }

    let rolled = 0;
    let skipped = 0;

    for (const tenant of expiredTrials) {
      // If Stripe subscription exists, Stripe handles billing — skip
      if (tenant.stripe_subscription_id) {
        skipped++;
        continue;
      }

      // Mark as past_due with kill_switch
      await sb(`tenants?id=eq.${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          subscription_status: "past_due",
          kill_switch: true,
        }),
      });
      rolled++;

      console.log(`[trial-rollover] ${tenant.slug} (${tenant.owner_email}) → past_due + kill_switch`);
    }

    return res.status(200).json({
      processed: expiredTrials.length,
      rolled,
      skipped,
      message: `${rolled} tenant(s) moved to past_due, ${skipped} skipped (have Stripe subscription)`,
    });
  } catch (e: any) {
    console.error("[cron/trial-rollover]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
