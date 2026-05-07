/**
 * GET /api/admin/email-log
 *
 * Returns the latest invites + signups with whatever Resend metadata we can
 * gather so the admin can cross-check live deliverability against the Resend
 * dashboard. We never store the Resend message ID server-side (that would
 * require schema changes); instead we surface invite tokens, recipient
 * emails, timestamps, accepted state, and tenant context in one payload.
 *
 * Auth: X-Admin-Key.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);
const RESEND_FROM = clean(process.env.RESEND_FROM) || "ATOM <hello@atomsalesdominator.com>";

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Latest 50 invites across all tenants
    const invites = await sb(
      "tenant_invites?select=id,email,role,token,invited_by,invited_at,accepted_at,revoked_at,tenant_id,expires_at&order=invited_at.desc&limit=50"
    );
    const tenantIds = Array.from(new Set((invites || []).map((i: any) => i.tenant_id).filter(Boolean)));
    let tenantsBySlug: Record<string, { slug: string; name: string }> = {};
    let tenantsById: Record<string, { slug: string; name: string }> = {};
    if (tenantIds.length) {
      const tenants = await sb(`tenants?id=in.(${tenantIds.join(",")})&select=id,slug,name`);
      for (const t of tenants || []) {
        tenantsById[t.id] = { slug: t.slug, name: t.name };
        tenantsBySlug[t.slug] = { slug: t.slug, name: t.name };
      }
    }

    // Latest 20 user signups (welcome emails)
    const users = await sb(
      "tenant_users?deleted_at=is.null&select=id,email,full_name,role,invited_at,accepted_at,last_login_at,tenant_id&order=invited_at.desc&limit=20"
    );
    const userTenantIds = Array.from(new Set((users || []).map((u: any) => u.tenant_id).filter(Boolean)));
    if (userTenantIds.length) {
      const need = userTenantIds.filter((id: string) => !tenantsById[id]);
      if (need.length) {
        const more = await sb(`tenants?id=in.(${need.join(",")})&select=id,slug,name`);
        for (const t of more || []) tenantsById[t.id] = { slug: t.slug, name: t.name };
      }
    }

    const inviteRows = (invites || []).map((i: any) => ({
      id: i.id,
      type: "invite",
      to: i.email,
      role: i.role,
      sentAt: i.invited_at,
      acceptedAt: i.accepted_at,
      revokedAt: i.revoked_at,
      expiresAt: i.expires_at,
      invitedBy: i.invited_by,
      tenant: tenantsById[i.tenant_id] || null,
      acceptUrl: `https://atom-dominator-pro.vercel.app/#/invite/${i.token}`,
      status: i.revoked_at
        ? "revoked"
        : i.accepted_at
          ? "accepted"
          : (new Date(i.expires_at).getTime() < Date.now() ? "expired" : "pending"),
    }));

    const userRows = (users || []).map((u: any) => ({
      id: u.id,
      type: "signup",
      to: u.email,
      role: u.role,
      sentAt: u.invited_at,
      acceptedAt: u.accepted_at,
      lastLoginAt: u.last_login_at,
      tenant: tenantsById[u.tenant_id] || null,
      status: u.last_login_at ? "active" : "signed-up",
    }));

    return res.status(200).json({
      from: RESEND_FROM,
      resendDashboard: "https://resend.com/logs",
      invites: inviteRows,
      users: userRows,
    });
  } catch (e: any) {
    console.error("[admin/email-log]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
