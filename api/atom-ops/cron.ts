/**
 * GET /api/atom-ops/cron — scheduled ATOM Ops job (Vercel Cron, 12:00 UTC daily).
 *
 * Protected by CRON_SECRET (Authorization: Bearer <secret>), matching the
 * repo's existing cron convention. Runs the (non-destructive) morning brief and
 * delivers it via the notification fan-out (Telegram + console badge).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyCronSecret } from "../../lib/atom-ops/api-auth";
import { runMorningBrief } from "../../lib/atom-ops/macros/morning-brief";
import { logger } from "../../lib/atom-ops/logger";
import { errMessage, type OpsContext } from "../../lib/atom-ops/types";

const log = logger.child({ route: "atom-ops/cron" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const cronAuth = verifyCronSecret(req);
  if (!cronAuth.ok) {
    return res.status(cronAuth.status).json({ error: cronAuth.error });
  }

  const context: OpsContext = {
    actorEmail: "cron@atom-ops",
    actorRole: "system",
    isSuperAdmin: true,
    source: "cron",
    sessionId: "cron",
  };

  try {
    const brief = await runMorningBrief(context);
    return res.status(200).json({
      status: "ok",
      ranAt: new Date().toISOString(),
      brief: brief.ok ? brief.data : null,
      summary: brief.summary,
    });
  } catch (e) {
    log.error({ err: errMessage(e) }, "cron failed");
    return res.status(500).json({ error: errMessage(e) });
  }
}
