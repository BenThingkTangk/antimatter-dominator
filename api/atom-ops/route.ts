/**
 * POST /api/atom-ops/route   — main ATOM Ops dispatch endpoint.
 * GET  /api/atom-ops/route?actions=1  — list available actions (palette).
 * GET  /api/atom-ops/route?audit=1    — recent audit rows (console table).
 * GET  /api/atom-ops/route?badge=1    — notification badge state.
 *
 * (Vercel maps file path → URL; the Next.js-style "route.ts" name is preserved
 *  per spec. On this Vite+Express+Vercel repo the URL is /api/atom-ops/route.)
 *
 * Body for POST:
 *   { intent: string }                      — plan/execute an intent
 *   { confirmationId: string, confirm: true }  — execute a pending op
 *   { confirmationId: string, cancel: true }   — cancel a pending op
 *
 * Auth: superadmin only (atom_session cookie). Rate limit: 60 req/min/session.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rateLimit, resolveSuperAdmin } from "../../lib/atom-ops/api-auth";
import { readRecentAudit } from "../../lib/atom-ops/audit";
import { clearBadge, getBadge } from "../../lib/atom-ops/notify";
import { OpsOrchestrator, listActions } from "../../lib/atom-ops/index";
import { logger } from "../../lib/atom-ops/logger";
import { errMessage, type OpsContext } from "../../lib/atom-ops/types";

const log = logger.child({ route: "atom-ops" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  const auth = await resolveSuperAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!rateLimit(auth.actor.sessionId)) {
    return res.status(429).json({ error: "Rate limit exceeded (60/min)" });
  }

  const context: OpsContext = {
    actorEmail: auth.actor.email,
    actorRole: auth.actor.role,
    isSuperAdmin: true,
    source: "console",
    sessionId: auth.actor.sessionId,
  };

  try {
    if (req.method === "GET") {
      if (req.query.actions) return res.status(200).json({ actions: listActions() });
      if (req.query.badge) return res.status(200).json({ badge: getBadge() });
      if (req.query.clearBadge) {
        clearBadge();
        return res.status(200).json({ ok: true });
      }
      const limit = Number(req.query.limit) || 50;
      const rows = await readRecentAudit(limit);
      return res.status(200).json({ audit: rows });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = (req.body || {}) as {
      intent?: string;
      confirmationId?: string;
      confirm?: boolean;
      cancel?: boolean;
    };

    if (body.confirmationId && body.cancel) {
      const out = await OpsOrchestrator.cancel(body.confirmationId, context);
      return res.status(200).json(out);
    }
    if (body.confirmationId && body.confirm) {
      const out = await OpsOrchestrator.execute(body.confirmationId, context);
      return res.status(200).json(out);
    }
    if (typeof body.intent === "string" && body.intent.trim()) {
      const out = await OpsOrchestrator.dispatch(body.intent, context);
      return res.status(200).json(out);
    }

    return res.status(400).json({ error: "Provide intent or confirmationId" });
  } catch (e) {
    log.error({ err: errMessage(e) }, "dispatch failed");
    return res.status(500).json({ error: errMessage(e) });
  }
}
