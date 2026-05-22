/**
 * POST /api/auth/reset-password
 * Body: { email }
 *
 * Creates a password_reset_tokens row and sends a reset email via Resend.
 * Always returns 200 regardless of whether the email exists (security).
 *
 * The password_reset_tokens table must exist in Supabase:
 *   id            uuid primary key default gen_random_uuid()
 *   user_id       uuid not null references tenant_users(id)
 *   token         text unique not null
 *   expires_at    timestamptz not null
 *   used_at       timestamptz
 *   created_at    timestamptz default now()
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { sendEmail } from "../_lib/send-email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://atom-dominator-pro.vercel.app";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }

    // Always return success — don't reveal whether the email exists
    const successResponse = { ok: true, message: "If an account with that email exists, a reset link has been sent." };

    // Look up the user
    const users = await sb(
      `tenant_users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id,full_name,email&limit=1`
    );
    const user = Array.isArray(users) ? users[0] : null;

    if (!user) {
      // User doesn't exist — still return success (security)
      return res.status(200).json(successResponse);
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Insert token into password_reset_tokens
    await sb("password_reset_tokens", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        token,
        expires_at: expiresAt,
      }),
    });

    // Send reset email
    const resetUrl = `${APP_URL}/#/reset-password/${token}`;
    sendEmail("password-reset", email, {
      resetUrl,
      expiresInMinutes: 60,
    }, { userId: user.id }).catch(() => {});

    return res.status(200).json(successResponse);
  } catch (e: any) {
    console.error("[auth/reset-password]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
