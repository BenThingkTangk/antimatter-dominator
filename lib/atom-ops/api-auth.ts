/**
 * API-layer auth + rate limiting for ATOM Ops routes.
 *
 * Reuses the repo's session model: atom_session cookie → user_sessions →
 * tenant_users (role + email) → superadmin check via NIRMATA_HQ_EMAILS.
 *
 * Exposes:
 *   resolveSuperAdmin(req)  → { ok, actor } | { ok:false, status, error }
 *   rateLimit(sessionId)    → boolean (true = allowed)  [60 req/min/session]
 */
import crypto from "crypto";
import type { VercelRequest } from "@vercel/node";
import { getEnv, isProduction, superAdminEmails } from "./env";
import { isSupabaseConfigured, sbRest, sbRpc } from "./supabase-rest";
import { logger } from "./logger";
import { errMessage } from "./types";

const log = logger.child({ component: "api-auth" });

export interface Actor {
  email: string;
  role: string | null;
  isSuperAdmin: boolean;
  sessionId: string;
}

export type AuthOutcome =
  | { ok: true; actor: Actor }
  | { ok: false; status: number; error: string };

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

/**
 * Resolve the caller to a superadmin actor, or a failure with an HTTP status.
 * 401 when unauthenticated, 403 when authenticated but not superadmin.
 */
export async function resolveSuperAdmin(req: VercelRequest): Promise<AuthOutcome> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["atom_session"];
  if (!token) return { ok: false, status: 401, error: "Not authenticated" };

  const sessionId = crypto.createHash("sha256").update(token).digest("hex").slice(0, 24);

  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, error: "Supabase not configured" };
  }

  try {
    const sessions = await sbRest<
      Array<{ user_id: string; expires_at: string }>
    >(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,expires_at`,
    );
    const session = sessions?.[0];
    if (!session) return { ok: false, status: 401, error: "Session not found" };
    if (new Date(session.expires_at) < new Date()) {
      return { ok: false, status: 401, error: "Session expired" };
    }

    const users = await sbRest<Array<{ email: string; role: string }>>(
      `tenant_users?id=eq.${session.user_id}&deleted_at=is.null&select=email,role`,
    );
    const user = users?.[0];
    if (!user) return { ok: false, status: 401, error: "User not found" };

    const isSuperAdmin = superAdminEmails().includes(user.email.toLowerCase());
    if (!isSuperAdmin) {
      return { ok: false, status: 403, error: "Superadmin only" };
    }

    return {
      ok: true,
      actor: { email: user.email, role: user.role, isSuperAdmin, sessionId },
    };
  } catch (e) {
    return { ok: false, status: 500, error: errMessage(e) };
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────
// 60 requests / minute / key. Two backends:
//   - rateLimitDb(): cross-instance, persisted in ops_rate_limits via the
//     ops_rate_limit_hit() RPC. This is the production path — in-process
//     counters do NOT hold across serverless instances.
//   - in-memory fallback: best-effort, per-instance only. Used in development
//     when Supabase is not configured.
const WINDOW_MS = 60_000;
const WINDOW_SECONDS = 60;
const MAX_REQ = 60;
const buckets = new Map<string, number[]>();

/** Best-effort, per-instance fallback (development / Supabase absent). */
export function rateLimitMemory(key: string, max = MAX_REQ): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/**
 * Cross-instance rate limit. Uses the Postgres ops_rate_limit_hit() RPC so the
 * cap holds across all serverless instances. Falls back to the per-instance
 * memory limiter only when Supabase is unconfigured (development).
 *
 * Fail-closed-ish: if the DB call errors in production we DENY (return false)
 * rather than silently allowing unbounded requests.
 */
export async function rateLimit(key: string, max = MAX_REQ): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return rateLimitMemory(key, max);
  }
  try {
    const rows = await sbRpc<Array<{ allowed: boolean; current_count: number }>>(
      "ops_rate_limit_hit",
      { p_bucket_key: key, p_max: max, p_window_seconds: WINDOW_SECONDS },
    );
    const row = Array.isArray(rows) ? rows[0] : (rows as unknown as { allowed?: boolean });
    return Boolean(row?.allowed);
  } catch (e) {
    log.error({ err: errMessage(e) }, "rate-limit RPC failed");
    // In production, a broken limiter must not become an open door.
    if (isProduction()) return false;
    return rateLimitMemory(key, max);
  }
}

/**
 * CRON_SECRET guard. Accepts either CRON_SECRET (repo convention) or
 * ATOM_OPS_CRON_SECRET. FAILS CLOSED in production when neither is set, so a
 * misconfigured deployment cannot expose the cron route unauthenticated.
 *
 * Returns a discriminated outcome so the route can pick the right status:
 *   - missing secret in prod → 503 (server misconfigured)
 *   - bad/absent bearer      → 401 (unauthorized)
 */
export type CronAuth = { ok: true } | { ok: false; status: number; error: string };

export function verifyCronSecret(req: VercelRequest): CronAuth {
  const secret = getEnv("CRON_SECRET") || getEnv("ATOM_OPS_CRON_SECRET");
  if (!secret) {
    if (isProduction()) {
      return {
        ok: false,
        status: 503,
        error: "Cron secret not configured (set CRON_SECRET or ATOM_OPS_CRON_SECRET).",
      };
    }
    // Development convenience only.
    return { ok: true };
  }
  const header = (req.headers.authorization || "").toString();
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
