/**
 * session — shared cookie-session resolver for API endpoints.
 *
 * Consolidates the resolveSession() snippet that was copy-pasted across a dozen
 * handlers. Looks up the `atom_session` cookie against Supabase user_sessions
 * and returns { userId, tenantId } or null. Fails closed (returns null) on any
 * error so callers can uniformly respond 401.
 */
import type { VercelRequest } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export interface Session {
  userId: string;
  tenantId: string;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

/**
 * True when the request carries a valid X-Admin-Key matching ADMIN_API_KEY.
 * Used by internal/server-to-server callers (QA probes, cron) that don't hold
 * a user session cookie. Returns false if ADMIN_API_KEY is unset.
 */
export function hasAdminKey(req: VercelRequest): boolean {
  if (!ADMIN_API_KEY) return false;
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  return provided === ADMIN_API_KEY;
}

/**
 * Authorize a request via EITHER a user session OR a valid admin key.
 * Returns the session when present, a synthetic admin marker for admin-key
 * callers, or null when neither is valid (caller should 401).
 */
export async function authorize(
  req: VercelRequest,
): Promise<{ session: Session | null; admin: boolean } | null> {
  const session = await resolveSession(req);
  if (session) return { session, admin: false };
  if (hasAdminKey(req)) return { session: null, admin: true };
  return null;
}

export async function resolveSession(req: VercelRequest): Promise<Session | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["atom_session"];
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const s = Array.isArray(rows) ? rows[0] : null;
    return s ? { userId: s.user_id, tenantId: s.tenant_id } : null;
  } catch {
    return null;
  }
}
