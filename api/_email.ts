/**
 * Shared Resend email helper. Inlined into each consumer that needs it
 * (Vercel nft tracing has been finicky with sibling _lib imports — but
 * top-level _email.ts at api/ root traces reliably).
 *
 * Env:
 *   RESEND_API_KEY        — required to actually send.
 *   RESEND_FROM           — optional; defaults to "ATOM <onboarding@resend.dev>".
 *                           NOTE: until you verify a custom domain in Resend,
 *                           the default test sender works for dev mode but
 *                           Resend will only deliver to *your verified inbox*.
 *                           Once you verify atomdominator.com or similar,
 *                           set RESEND_FROM=ATOM <hello@atomdominator.com>.
 *
 * Returns { ok, id?, error? } and never throws — email failures must NEVER
 * block the underlying tenant / invite / billing operation.
 */

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
  const FROM = clean(process.env.RESEND_FROM) || "ATOM <onboarding@resend.dev>";

  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY missing — skipping send to", input.to);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
  }
  if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { ok: false, error: "Invalid recipient email" };
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("[email] Resend error", r.status, j?.message || j);
      return { ok: false, error: j?.message || `Resend ${r.status}` };
    }
    return { ok: true, id: j?.id };
  } catch (e: any) {
    console.error("[email] send failed:", e?.message);
    return { ok: false, error: e?.message || "send failed" };
  }
}

// ─── Branded HTML template ───────────────────────────────────────────────────

export function brandedEmail({
  preheader,
  heading,
  body,
  ctaLabel,
  ctaUrl,
  footer,
}: {
  preheader?: string;
  heading: string;
  body: string;        // HTML allowed
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const teal = "#00e6d3";
  const bg = "#05090c";
  const card = "#0c1014";
  const text = "#e8e8ea";
  const muted = "#7e8590";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
${preheader ? `<div style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;color:${bg};">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${card};border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <div style="width:32px;height:32px;border-radius:8px;background:${teal};box-shadow:0 0 18px ${teal}40;text-align:center;color:${bg};font-weight:800;line-height:32px;font-size:14px;font-family:monospace;">Δ</div>
            </td>
            <td style="vertical-align:middle;color:${text};font-weight:700;font-size:16px;letter-spacing:0.04em;">
              ΔTOM
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 32px 8px 32px;">
        <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:${text};font-weight:700;letter-spacing:-0.01em;">${heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:${muted};">${body}</div>
      </td></tr>
      ${ctaLabel && ctaUrl ? `
      <tr><td align="center" style="padding:16px 32px 28px 32px;">
        <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${teal};color:${bg};text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;box-shadow:0 0 24px ${teal}40;">
          ${ctaLabel}
        </a>
        <div style="margin-top:14px;font-size:11px;color:${muted};font-family:monospace;word-break:break-all;">
          Or paste this link: <a href="${ctaUrl}" style="color:${teal};text-decoration:none;">${ctaUrl}</a>
        </div>
      </td></tr>` : ""}
      ${footer ? `<tr><td style="padding:0 32px 24px 32px;font-size:11px;line-height:1.6;color:${muted};border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">${footer}</td></tr>` : ""}
    </table>
    <div style="margin-top:14px;font-size:10px;color:${muted};font-family:monospace;letter-spacing:0.12em;text-transform:uppercase;">
      AntimatterAI · Nirmata Holdings
    </div>
  </td></tr>
</table>
</body>
</html>`;
}
