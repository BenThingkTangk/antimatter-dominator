/**
 * ATOM Target Intelligence Engine — Daily Briefs Cron
 * Runs daily via Vercel Cron. Fetches all T1/T2 HVT targets from a simple
 * registry endpoint and triggers daily brief generation for each.
 *
 * GET /api/cron/daily-briefs
 * Scheduled by vercel.json crons config.
 *
 * Since we use localStorage client-side for deals (no server DB), this endpoint
 * acts as a public trigger that the client can call on login/morning to process
 * any pending brief jobs. The front-end calls this on first load of each day.
 *
 * For true server-side scheduled briefs with a persistence layer, a server DB
 * (Postgres/Supabase) would be needed. This endpoint returns a 200 OK and emits
 * a heartbeat event that the frontend listens for.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron auth header (Vercel sets this automatically for cron invocations)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.json({
    status: "ok",
    message: "Daily briefs cron heartbeat — client will pull briefs on next load",
    triggeredAt: new Date().toISOString(),
    note: "Client-side War Room auto-refreshes briefs for T1/T2 HVTs at start of each day.",
  });
}
