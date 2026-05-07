/**
 * POST /api/auth/logout
 * Reads atom_session cookie, revokes session, clears cookie.
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];

    if (token) {
      // Revoke session
      await sb(
        `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null`,
        {
          method: "PATCH",
          body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        }
      );
    }

    // Clear cookie
    res.setHeader(
      "Set-Cookie",
      "atom_session=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax"
    );

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[auth/logout]", e?.message);
    // Still clear cookie on error
    res.setHeader(
      "Set-Cookie",
      "atom_session=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax"
    );
    return res.status(200).json({ ok: true });
  }
}
