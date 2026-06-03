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

import { sendEmail } from "./_lib/send-email.js";


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

      // If admin_email present, fire an invite email — fire-and-forget.
      if (admin_email && tenantRow) {
        const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
        sendEmail("invite", admin_email, {
          inviterName: "Nirmata team",
          tenantName: name,
          role: "admin",
          acceptUrl: `${origin}/#/signup`,
          expiresAt: "14 days",
        }, {
          tenantId: tenantRow.id,
          subject: `Your ΔTOM workspace "${name}" is provisioned`,
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
