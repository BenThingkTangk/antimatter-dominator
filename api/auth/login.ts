/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Validates credentials, creates session, sets atom_session cookie.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { enforceRateLimit } from "../_lib/rate-limit";

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

const NIRMATA_HQ_EMAILS = (process.env.NIRMATA_HQ_EMAILS || "ben.oleary@thingktangk.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Throttle credential-stuffing / brute force.
  if (await enforceRateLimit(req, res, { key: "auth-login", limit: 10, windowSec: 60 })) return;

  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      // Constant-time delay to prevent timing attacks
      await new Promise((r) => setTimeout(r, 250));
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Lookup user by email
    const users = await sb(
      `tenant_users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id,tenant_id,email,full_name,role,password_hash`
    );
    const user = Array.isArray(users) ? users[0] : null;

    if (!user || !user.password_hash) {
      await new Promise((r) => setTimeout(r, 250));
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // bcrypt compare
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await new Promise((r) => setTimeout(r, 250));
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Look up tenant
    const tenants = await sb(
      `tenants?id=eq.${user.tenant_id}&deleted_at=is.null&select=id,slug,name,plan,trial_ends_at,subscription_status`
    );
    const tenant = Array.isArray(tenants) ? tenants[0] : null;
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Update last_login_at
    await sb(`tenant_users?id=eq.${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    });

    // Generate session token
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb("user_sessions", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        tenant_id: user.tenant_id,
        token,
        user_agent: (req.headers["user-agent"] || "").slice(0, 512),
        ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim(),
        expires_at: expiresAt,
      }),
    });

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `atom_session=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`
    );

    const isSuperAdmin = NIRMATA_HQ_EMAILS.includes(user.email);

    return res.status(200).json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
        subscription_status: tenant.subscription_status,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      },
      role: user.role,
      isSuperAdmin,
      redirectTo: "/",
    });
  } catch (e: any) {
    console.error("[auth/login]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
