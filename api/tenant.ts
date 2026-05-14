/**
 * Multi-tenant resolver.
 *
 * GET /api/tenant?host=acme.atomdominator.com
 *   → { slug, name, logo_url, primary_hex, accent_hex, plan, hume_config_id?, twilio_subaccount_sid? }
 *
 * POST /api/tenant   { action: "create", ...fields }     (admin only)
 *   → creates a new tenant row
 *
 * POST /api/tenant   { action: "list" }                  (admin only)
 *   → lists all tenants
 *
 * POST /api/tenant   { action: "update", slug, ...fields } (admin only)
 *   → updates an existing tenant
 *
 * Tenants are stored in Supabase. Brand is loaded client-side on first paint
 * via `useTenant()` and applied to a CSS variable theme.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY); // for admin actions

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


// Default tenant — used ONLY when both host slug and Supabase lookup fail.
// Colors locked to canonical ΔTOM brand spec (Brand Design System v2 —
// "black titanium, teal plasma, instrument-grade glass"). Primary teal
// #00e6d3 is the immutable brand identifier per the spec.
const DEFAULT_TENANT = {
  slug: "antimatter",
  name: "AntimatterAI",
  logo_url: "/logo-atom.svg",
  primary_hex: "#00e6d3",   // canonical ΔTOM teal plasma
  accent_hex: "#00a7ff",    // canonical secondary blue
  plan: "enterprise",
  hume_config_id: null as string | null,
  twilio_subaccount_sid: null as string | null,
};

type Tenant = typeof DEFAULT_TENANT;

async function supabaseQuery(path: string, opts: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase not configured");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function slugFromHost(host: string): string {
  // acme.atomdominator.com → "acme"
  // atom-dominator-pro.vercel.app → "" (use default)
  // *.vercel.app → "" (use default)
  const h = (host || "").toLowerCase().split(":")[0];
  if (h.endsWith(".vercel.app")) return "";
  if (h === "atomdominator.com" || h === "www.atomdominator.com") return "";
  const parts = h.split(".");
  if (parts.length >= 3 && parts.slice(-2).join(".") === "atomdominator.com") {
    return parts[0];
  }
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  // ─── GET — public tenant lookup ─────────────────────────────────────────────
  if (req.method === "GET") {
    const host = String(req.query.host || req.headers.host || "").toString();
    // Canonical app hosts (*.vercel.app, atomdominator.com apex) ALWAYS resolve
    // to the antimatter Supabase row — not the hardcoded DEFAULT_TENANT — so
    // brand color / logo edits made in the admin UI take effect on the main
    // app immediately. This was the source of the persistent red brand bug:
    // an early DEFAULT_TENANT.primary_hex='#ef4444' kept overriding the DB.
    const slug = (req.query.slug as string) || slugFromHost(host) || "antimatter";

    try {
      const rows = await supabaseQuery(
        `tenants?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=*`
      );
      if (!rows || rows.length === 0) {
        return res.status(200).json({ ...DEFAULT_TENANT, source: "fallback", requested_slug: slug });
      }
      const t = rows[0];
      return res.status(200).json({
        slug: t.slug,
        name: t.name,
        logo_url: t.logo_url || DEFAULT_TENANT.logo_url,
        primary_hex: t.primary_hex || DEFAULT_TENANT.primary_hex,
        accent_hex: t.accent_hex || DEFAULT_TENANT.accent_hex,
        plan: t.plan || "trial",
        hume_config_id: t.hume_config_id || null,
        twilio_subaccount_sid: t.twilio_subaccount_sid || null,
        source: "db",
      });
    } catch (e: any) {
      // Supabase down or schema missing — fall back to default rather than 500.
      // Multi-tenant is graceful-degrade by design.
      return res.status(200).json({
        ...DEFAULT_TENANT,
        source: "error_fallback",
        error: e?.message || "supabase_unavailable",
      });
    }
  }

  // ─── POST — admin actions ───────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Require X-Admin-Key for any write
  const adminHeader = String(req.headers["x-admin-key"] || req.headers["X-Admin-Key"] || "");
  if (!ADMIN_API_KEY || adminHeader !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "admin_key_required" });
  }

  const action = req.body?.action;

  try {
    if (action === "create") {
      const { slug, name, logo_url, primary_hex, accent_hex, plan, admin_email, hume_config_id, twilio_subaccount_sid } = req.body || {};
      if (!slug || !name) return res.status(400).json({ error: "slug + name required" });

      // Idempotent upsert
      const inserted = await supabaseQuery("tenants", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          slug, name, logo_url, primary_hex, accent_hex,
          plan: plan || "trial",
          admin_email,
          hume_config_id: hume_config_id || null,
          twilio_subaccount_sid: twilio_subaccount_sid || null,
        }),
      });
      const tenantRow = inserted?.[0] ?? null;

      // If admin_email present, fire a welcome email — fire-and-forget.
      if (admin_email && tenantRow) {
        const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
        sendEmail({
          to: admin_email,
          subject: `Your ΔTOM workspace "${name}" is provisioned`,
          html: brandedEmail({
            preheader: `Your ${name} workspace is live on ΔTOM. Sign up to access it.`,
            heading: `${name} is live on ΔTOM`,
            body: `
              <p>The Nirmata team just provisioned your <strong style="color:#e8e8ea">${name}</strong> workspace on ΔTOM (ATOM Sales Dominator).</p>
              <p>Click below to sign up with this email and you'll be auto-linked to your workspace, then you can pick a plan, choose seats, and start your 14-day free trial.</p>
            `,
            ctaLabel: "Activate your workspace",
            ctaUrl: `${origin}/#/signup`,
            footer: `Slug: <code style="font-family:monospace;color:#00e6d3;">${slug}</code> · Plan: <code style="font-family:monospace;color:#00e6d3;">${plan || "trial"}</code>`,
          }),
          text: `Your ΔTOM workspace "${name}" is provisioned. Sign up to access it: ${origin}/#/signup`,
        }).catch(() => {});
      }

      return res.status(200).json({ ok: true, tenant: tenantRow });
    }

    if (action === "list") {
      const rows = await supabaseQuery("tenants?deleted_at=is.null&order=created_at.desc&select=*");
      return res.status(200).json({ tenants: rows });
    }

    if (action === "update") {
      // Bug: spreading req.body with `...patch` previously included `action`
      // itself, which Supabase rejected with PGRST204 “Could not find the
      // 'action' column of 'tenants'”. Strip every non-column field before PATCH.
      const {
        slug,
        action: _action,  // protocol field, not a column
        ...patch
      } = (req.body || {}) as Record<string, any>;
      if (!slug) return res.status(400).json({ error: "slug required" });

      // Allow-list the actual `tenants` columns (verified against the live
      // Supabase schema). Add a column here when you add one to the table.
      const ALLOWED_COLUMNS = new Set([
        "name",
        "plan",
        "primary_hex",
        "accent_hex",
        "logo_url",
        "admin_email",
        "owner_email",
        "hero_tagline",
        "custom_domain",
        "hume_config_id",
        "twilio_subaccount_sid",
        "twilio_phone_number",
        "stripe_customer_id",
        "stripe_subscription_id",
        "subscription_status",
        "current_plan_price_cents",
        "seats_purchased",
        "seats_used",
        "token_budget_cents",
        "token_spent_cents",
        "kill_switch",
        "trial_ends_at",
        "deleted_at",
      ]);
      const cleanPatch: Record<string, any> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (ALLOWED_COLUMNS.has(k)) cleanPatch[k] = v;
      }

      if (!Object.keys(cleanPatch).length) {
        return res.status(400).json({ error: "no updatable fields supplied" });
      }

      const updated = await supabaseQuery(
        `tenants?slug=eq.${encodeURIComponent(slug)}`,
        { method: "PATCH", body: JSON.stringify(cleanPatch) }
      );
      return res.status(200).json({ ok: true, tenant: updated?.[0] ?? null });
    }

    if (action === "delete") {
      const { slug } = req.body || {};
      if (!slug) return res.status(400).json({ error: "slug required" });
      await supabaseQuery(
        `tenants?slug=eq.${encodeURIComponent(slug)}`,
        { method: "PATCH", body: JSON.stringify({ deleted_at: new Date().toISOString() }) }
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `unknown action: ${action}. Use create|list|update|delete` });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "tenant_op_failed" });
  }
}
