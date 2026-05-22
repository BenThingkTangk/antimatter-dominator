/**
 * GET /api/auth/me
 * Reads atom_session cookie → joins user_sessions → tenant_users → tenants.
 * Returns { user, tenant, role, isSuperAdmin }.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const NIRMATA_HQ_EMAILS = (process.env.NIRMATA_HQ_EMAILS || "ben.oleary@thingktangk.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Look up session
    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=id,user_id,tenant_id,expires_at`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;

    if (!session) {
      return res.status(401).json({ error: "Session not found or revoked" });
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    // Look up user
    const users = await sb(
      `tenant_users?id=eq.${session.user_id}&deleted_at=is.null&select=id,email,full_name,role,tenant_id,onboarding_complete,icp_seed,product_seed`
    );
    const user = Array.isArray(users) ? users[0] : null;
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Look up tenant
    const tenants = await sb(
      `tenants?id=eq.${session.tenant_id}&deleted_at=is.null&select=id,slug,name,plan,trial_ends_at,subscription_status,kill_switch,primary_hex,accent_hex`
    );
    const tenant = Array.isArray(tenants) ? tenants[0] : null;
    if (!tenant) {
      return res.status(401).json({ error: "Tenant not found" });
    }

    const isSuperAdmin = NIRMATA_HQ_EMAILS.includes(user.email);

    return res.status(200).json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
        subscription_status: tenant.subscription_status,
        kill_switch: tenant.kill_switch,
        primary_hex: tenant.primary_hex,
        accent_hex: tenant.accent_hex,
      },
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        onboardingComplete: user.onboarding_complete ?? false,
        icpSeed: user.icp_seed ?? null,
        productSeed: user.product_seed ?? null,
      },
      role: user.role,
      isSuperAdmin,
    });
  } catch (e: any) {
    console.error("[auth/me]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
