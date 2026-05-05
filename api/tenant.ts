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

// Default tenant (used when no subdomain match — the canonical app)
const DEFAULT_TENANT = {
  slug: "antimatter",
  name: "AntimatterAI",
  logo_url: "/logo-atom.svg",
  primary_hex: "#ef4444",
  accent_hex: "#06b6d4",
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
    const slug = (req.query.slug as string) || slugFromHost(host);

    if (!slug) {
      return res.status(200).json({ ...DEFAULT_TENANT, source: "default" });
    }

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
        logo_url: t.logo_url,
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
      return res.status(200).json({ ok: true, tenant: inserted?.[0] ?? null });
    }

    if (action === "list") {
      const rows = await supabaseQuery("tenants?deleted_at=is.null&order=created_at.desc&select=*");
      return res.status(200).json({ tenants: rows });
    }

    if (action === "update") {
      const { slug, ...patch } = req.body || {};
      if (!slug) return res.status(400).json({ error: "slug required" });
      const updated = await supabaseQuery(
        `tenants?slug=eq.${encodeURIComponent(slug)}`,
        { method: "PATCH", body: JSON.stringify(patch) }
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
