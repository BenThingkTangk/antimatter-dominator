/**
 * /api/invite — invite token resolver + accept handler.
 *
 *   GET  /api/invite?token=…
 *     → { ok, invite: { email, role, tenant }, expired? }
 *
 *   POST /api/invite
 *     Body: { token, fullName, password }
 *     → creates a tenant_users row, marks the invite accepted, returns a
 *       session cookie so the user is logged straight in.
 *
 * No admin key needed — the secret token authenticates the request.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

const INVITE_TTL_DAYS = 14;
const SESSION_TTL_DAYS = 7;

function inviteIsExpired(invitedAt: string): boolean {
  const t = new Date(invitedAt).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t > INVITE_TTL_DAYS * 24 * 3600 * 1000;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const token = String(req.query.token || "").trim();
      if (!token) return res.status(400).json({ error: "token required" });

      const rows = await sb(
        `tenant_invites?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=id,email,role,invited_at,accepted_at,tenant_id`
      );
      const invite = Array.isArray(rows) ? rows[0] : null;
      if (!invite) return res.status(404).json({ error: "Invite not found or revoked" });
      if (invite.accepted_at) return res.status(409).json({ error: "This invite has already been accepted — please sign in." });
      if (inviteIsExpired(invite.invited_at)) {
        return res.status(410).json({ error: "This invite has expired — ask your admin for a new one." });
      }

      const tRows = await sb(
        `tenants?id=eq.${invite.tenant_id}&deleted_at=is.null&select=id,slug,name,plan,primary_hex`
      );
      const tenant = Array.isArray(tRows) ? tRows[0] : null;
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      return res.status(200).json({
        ok: true,
        invite: { email: invite.email, role: invite.role, tenant },
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const token = String(body.token || "").trim();
      const fullName = String(body.fullName || "").trim();
      const password = String(body.password || "");
      if (!token) return res.status(400).json({ error: "token required" });
      if (!fullName) return res.status(400).json({ error: "Full name required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

      const rows = await sb(
        `tenant_invites?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=id,email,role,invited_at,accepted_at,tenant_id`
      );
      const invite = Array.isArray(rows) ? rows[0] : null;
      if (!invite) return res.status(404).json({ error: "Invite not found or revoked" });
      if (invite.accepted_at) return res.status(409).json({ error: "This invite has already been accepted." });
      if (inviteIsExpired(invite.invited_at)) {
        return res.status(410).json({ error: "This invite has expired." });
      }

      // Block if a user with this email already exists in this tenant
      const existing = await sb(
        `tenant_users?email=eq.${encodeURIComponent(invite.email)}&tenant_id=eq.${invite.tenant_id}&deleted_at=is.null&select=id&limit=1`
      );
      if (Array.isArray(existing) && existing.length > 0) {
        // Mark invite accepted anyway so we don't loop
        await sb(`tenant_invites?id=eq.${invite.id}`, {
          method: "PATCH",
          body: JSON.stringify({ accepted_at: new Date().toISOString() }),
        });
        return res.status(409).json({ error: "An account with this email already exists in this tenant — please sign in instead." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userRows = await sb("tenant_users", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: invite.tenant_id,
          email: invite.email,
          full_name: fullName,
          role: invite.role,
          password_hash: passwordHash,
          invited_at: invite.invited_at,
          accepted_at: new Date().toISOString(),
        }),
      });
      const user = Array.isArray(userRows) ? userRows[0] : userRows;
      if (!user?.id) throw new Error("Failed to create user");

      await sb(`tenant_invites?id=eq.${invite.id}`, {
        method: "PATCH",
        body: JSON.stringify({ accepted_at: new Date().toISOString() }),
      });

      // Mint session
      const sessionToken = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000).toISOString();
      await sb("user_sessions", {
        method: "POST",
        body: JSON.stringify({
          token: sessionToken,
          user_id: user.id,
          tenant_id: invite.tenant_id,
          expires_at: expiresAt,
        }),
      });

      const isHttps = (req.headers["x-forwarded-proto"] || "").toString().includes("https") || true;
      res.setHeader(
        "Set-Cookie",
        [
          `atom_session=${sessionToken}`,
          "Path=/",
          `Max-Age=${SESSION_TTL_DAYS * 24 * 3600}`,
          "HttpOnly",
          "SameSite=Lax",
          ...(isHttps ? ["Secure"] : []),
        ].join("; ")
      );

      return res.status(200).json({
        ok: true,
        user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, tenant_id: invite.tenant_id },
        redirectTo: "/#/billing",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[invite]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
