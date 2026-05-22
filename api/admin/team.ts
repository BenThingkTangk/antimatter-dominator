/**
 * /api/admin/team — tenant user + invite management.
 *
 *   GET    ?tenantSlug=<slug>     → { users: [...], invites: [...] }
 *   POST   invite   { tenantSlug, email, role, invitedBy }
 *   PATCH           { tenantSlug, userId, role }
 *   DELETE          { tenantSlug, userId }    (soft-delete)
 *
 * Auth: X-Admin-Key header required.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { sendEmail } from "../_lib/send-email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

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

async function tenantBySlug(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const rows = await sb(`tenants?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

const VALID_ROLES = ["admin", "manager", "rep", "viewer"] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const slug = String(req.query.tenantSlug || "").trim();
      if (!slug) return res.status(400).json({ error: "tenantSlug required" });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });
      const [users, invites] = await Promise.all([
        sb(`tenant_users?tenant_id=eq.${tenant.id}&deleted_at=is.null&order=invited_at.desc&select=id,email,full_name,role,invited_at,accepted_at,last_login_at`),
        sb(`tenant_invites?tenant_id=eq.${tenant.id}&accepted_at=is.null&revoked_at=is.null&order=invited_at.desc&select=id,email,role,invited_by,invited_at,expires_at`),
      ]);
      return res.status(200).json({ tenant, users, invites });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const slug = String(body.tenantSlug || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "rep").trim();
      const invitedBy = String(body.invitedBy || "").trim();
      if (!slug || !email) return res.status(400).json({ error: "tenantSlug and email required" });
      if (!VALID_ROLES.includes(role as any)) return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });
      const token = crypto.randomBytes(24).toString("base64url");
      const invite = await sb("tenant_invites", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: tenant.id,
          email,
          role,
          token,
          invited_by: invitedBy || null,
        }),
      });
      const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
      const inviteUrl = `${origin}/#/invite/${token}`;

      // Fire-and-forget email send — never blocks the invite write.
      const emailResult = await sendEmail("invite", email, {
        inviterName: invitedBy || "Your team",
        tenantName: tenant.name,
        role,
        acceptUrl: inviteUrl,
        expiresAt: "14 days",
      }, { tenantId: tenant.id });
      return res.status(201).json({
        invite: invite?.[0] || invite,
        inviteUrl,
        email: { sent: emailResult.sent, id: emailResult.id, error: emailResult.reason },
      });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      const slug = String(body.tenantSlug || "").trim();
      const userId = String(body.userId || "").trim();
      const role = String(body.role || "").trim();
      if (!slug || !userId || !role) return res.status(400).json({ error: "tenantSlug, userId, role required" });
      if (!VALID_ROLES.includes(role as any)) return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });
      const updated = await sb(
        `tenant_users?tenant_id=eq.${tenant.id}&id=eq.${userId}`,
        { method: "PATCH", body: JSON.stringify({ role }) }
      );
      return res.status(200).json({ user: updated?.[0] || null });
    }

    if (req.method === "DELETE") {
      const body = req.body || {};
      const slug = String(body.tenantSlug || "").trim();
      const userId = String(body.userId || "").trim();
      if (!slug || !userId) return res.status(400).json({ error: "tenantSlug and userId required" });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });
      const updated = await sb(
        `tenant_users?tenant_id=eq.${tenant.id}&id=eq.${userId}`,
        { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }
      );
      return res.status(200).json({ revoked: updated?.length ?? 0 });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[admin/team]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
