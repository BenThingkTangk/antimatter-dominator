/**
 * POST /api/auth/reset-password/confirm
 * Body: { token, newPassword }
 *
 * Validates token, hashes new password with bcrypt (cost 12), updates user,
 * marks token used, invalidates all other tokens for this user.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { enforceRateLimit } from "../../_lib/rate-limit";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Inlined Supabase helper (Vercel nft tracing) ──
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

// Password validation: at least 10 chars, 1 uppercase, 1 number
function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (!/[A-Z]/.test(pw)) return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number";
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Throttle reset-token brute force.
  if (await enforceRateLimit(req, res, { key: "auth-reset-confirm", limit: 10, windowSec: 300 })) return;

  try {
    const body = req.body || {};
    const token = String(body.token || "").trim();
    const newPassword = String(body.newPassword || "");

    if (!token) return res.status(400).json({ error: "Token is required" });

    // Validate password strength
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    // Look up token — must exist, not used, not expired
    const tokens = await sb(
      `password_reset_tokens?token=eq.${encodeURIComponent(token)}&used_at=is.null&select=id,user_id,expires_at&limit=1`
    );
    const resetToken = Array.isArray(tokens) ? tokens[0] : null;

    if (!resetToken) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Check expiry
    if (new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await sb(`tenant_users?id=eq.${resetToken.user_id}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: passwordHash }),
    });

    // Mark this token as used
    await sb(`password_reset_tokens?token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH",
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });

    // Invalidate all other reset tokens for this user
    await sb(
      `password_reset_tokens?user_id=eq.${resetToken.user_id}&used_at=is.null&token=neq.${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      }
    );

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error("[auth/reset-password/confirm]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
