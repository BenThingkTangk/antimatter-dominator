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
import { superAdminEmails } from "./env";
import { isSupabaseConfigured, sbRest } from "./supabase-rest";
import { errMessage } from "./types";

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

// ── Rate limiting: 60 requests / minute / session (in-memory sliding window) ──
const WINDOW_MS = 60_000;
const MAX_REQ = 60;
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max = MAX_REQ): boolean {
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

/** CRON_SECRET guard, matching the repo's existing cron auth convention. */
export function verifyCronSecret(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset → allow (mirrors api/cron/daily-briefs.ts)
  const header = (req.headers.authorization || "").toString();
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
