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

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);
const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
const RESEND_FROM = clean(process.env.RESEND_FROM) || "ATOM <hello@atomsalesdominator.com>";

// ── Inlined Resend send + brand HTML (Vercel nft tracing breaks sibling _lib imports) ──
interface EmailInput { to: string; subject: string; html: string; text?: string; replyTo?: string }
interface EmailResult { ok: boolean; id?: string; error?: string; skipped?: boolean }
async function sendEmail(input: EmailInput): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
  if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) return { ok: false, error: "Invalid recipient email" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        // Plain-text fallback materially improves Gmail / ProofPoint trust;
        // strip-tags fallback keeps it readable when not provided explicitly.
        text: input.text || input.html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
        reply_to: input.replyTo || "hello@atomsalesdominator.com",
        // List-Unsubscribe + List-Unsubscribe-Post are part of Gmail's
        // bulk-sender requirements (Feb 2024) and significantly reduce spam
        // flagging on transactional + lifecycle email.
        headers: {
          "List-Unsubscribe": "<mailto:unsubscribe@atomsalesdominator.com>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "X-Entity-Ref-ID": "atom-transactional-" + Date.now(),
        },
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[email] Resend", r.status, j?.message || j);
      return { ok: false, error: j?.message || `Resend ${r.status}` };
    }
    return { ok: true, id: j?.id };
  } catch (e: any) {
    console.error("[email] send failed:", e?.message);
    return { ok: false, error: e?.message || "send failed" };
  }
}
function brandedEmail(o: { preheader?: string; heading: string; body: string; ctaLabel?: string; ctaUrl?: string; footer?: string }): string {
  const teal = "#00e6d3", bg = "#05090c", card = "#0c1014", text = "#e8e8ea", muted = "#7e8590";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${o.heading}</title></head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${o.preheader ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;color:${bg};">${o.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${card};border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px 32px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px;"><div style="width:32px;height:32px;border-radius:8px;background:${teal};box-shadow:0 0 18px ${teal}40;text-align:center;color:${bg};font-weight:800;line-height:32px;font-size:14px;font-family:monospace;">Δ</div></td>
<td style="vertical-align:middle;color:${text};font-weight:700;font-size:16px;letter-spacing:0.04em;">ΔTOM</td>
</tr></table></td></tr>
<tr><td style="padding:18px 32px 8px 32px;"><h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${text};font-weight:700;letter-spacing:-0.01em;">${o.heading}</h1>
<div style="font-size:14px;line-height:1.6;color:${muted};">${o.body}</div></td></tr>
${o.ctaLabel && o.ctaUrl ? `<tr><td align="center" style="padding:16px 32px 28px 32px;">
<a href="${o.ctaUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${teal};color:${bg};text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;box-shadow:0 0 24px ${teal}40;">${o.ctaLabel}</a>
<div style="margin-top:14px;font-size:11px;color:${muted};font-family:monospace;word-break:break-all;">Or paste this link: <a href="${o.ctaUrl}" style="color:${teal};text-decoration:none;">${o.ctaUrl}</a></div></td></tr>` : ""}
${o.footer ? `<tr><td style="padding:0 32px 24px 32px;font-size:11px;line-height:1.6;color:${muted};border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">${o.footer}</td></tr>` : ""}
</table><div style="margin-top:14px;font-size:10px;color:${muted};font-family:monospace;letter-spacing:0.12em;text-transform:uppercase;">AntimatterAI · Nirmata Holdings</div>
</td></tr></table></body></html>`;
}

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
      const emailResult = await sendEmail({
        to: email,
        subject: `You’re invited to ${tenant.name} on ΔTOM`,
        html: brandedEmail({
          preheader: `${invitedBy || "Your team"} invited you to ${tenant.name} on ΔTOM — accept your invite to get started.`,
          heading: `You're invited to ${tenant.name}`,
          body: `
            <p>${invitedBy ? `<strong style="color:#e8e8ea">${invitedBy}</strong>` : "Your team"} just invited you to join <strong style="color:#e8e8ea">${tenant.name}</strong> on ΔTOM (ATOM Sales Dominator) as <strong style="color:#e8e8ea">${role}</strong>.</p>
            <p>Click the button below to accept your invite, set your password, and start running ATOM — the AI sales operating system. The link is single-use and expires in 14 days.</p>
          `,
          ctaLabel: "Accept invite & sign in",
          ctaUrl: inviteUrl,
          footer: `If you weren't expecting this email, you can safely ignore it. Questions? Just reply to this message.`,
        }),
        text: `You've been invited to join ${tenant.name} on ΔTOM as ${role}. Accept here: ${inviteUrl}`,
        replyTo: invitedBy && /@/.test(invitedBy) ? invitedBy : undefined,
      });
      return res.status(201).json({
        invite: invite?.[0] || invite,
        inviteUrl,
        email: { sent: emailResult.ok, id: emailResult.id, error: emailResult.error, skipped: emailResult.skipped },
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
