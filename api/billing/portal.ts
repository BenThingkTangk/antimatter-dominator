/**
 * POST /api/billing/portal
 * Returns Stripe Billing Portal URL for the current tenant.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_SECRET_KEY = clean(process.env.STRIPE_SECRET_KEY);

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(503).json({
        portalUrl: null,
        message: "Billing temporarily unavailable.",
      });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=tenant_id`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return res.status(401).json({ error: "Session expired" });

    const tenants = await sb(`tenants?id=eq.${session.tenant_id}&select=stripe_customer_id`);
    const tenant = Array.isArray(tenants) ? tenants[0] : null;
    if (!tenant?.stripe_customer_id) {
      return res.status(400).json({ error: "No Stripe customer on file — subscribe to a plan first" });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });

    const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${origin}/#/admin/tenants`,
    });

    return res.status(200).json({ portalUrl: portalSession.url });
  } catch (e: any) {
    console.error("[billing/portal]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
