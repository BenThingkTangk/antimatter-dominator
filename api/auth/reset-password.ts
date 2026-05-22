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

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
const RESEND_FROM = clean(process.env.RESEND_FROM) || "ATOM <hello@atomsalesdominator.com>";
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

// ── Inlined Resend email ──
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
        text: input.text || input.html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
        reply_to: input.replyTo || "hello@atomsalesdominator.com",
        headers: {
          "X-Entity-Ref-ID": "atom-reset-" + Date.now(),
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
    sendEmail({
      to: email,
      subject: "Reset your ΔTOM password",
      html: brandedEmail({
        preheader: "You requested a password reset for your ΔTOM account.",
        heading: "Reset your password",
        body: `
          <p>We received a request to reset the password for <strong style="color:#e8e8ea">${email}</strong>.</p>
          <p>Click the button below to choose a new password. This link expires in <strong style="color:#e8e8ea">1 hour</strong>.</p>
          <p style="margin-top:12px;font-size:12px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `,
        ctaLabel: "Reset password →",
        ctaUrl: resetUrl,
        footer: "This link expires in 1 hour. If you didn't request a password reset, no action is needed.",
      }),
      text: `Reset your ΔTOM password: ${resetUrl} — this link expires in 1 hour.`,
    }).catch(() => {});

    return res.status(200).json(successResponse);
  } catch (e: any) {
    console.error("[auth/reset-password]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
