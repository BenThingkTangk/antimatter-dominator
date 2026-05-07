/**
 * POST /api/billing/checkout
 * Body: { plan }
 * Returns Stripe Checkout Session URL, or null if Stripe not configured.
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

const PLAN_PRICES: Record<string, number> = {
  starter: 9900,
  growth: 29900,
  advisory: 79900,
  enterprise: 199900,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(200).json({
        checkoutUrl: null,
        message: "Stripe not configured — running in dev mode",
      });
    }

    const body = req.body || {};
    const plan = String(body.plan || "").toLowerCase();
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ error: `Invalid plan. Choose one of: ${Object.keys(PLAN_PRICES).join(", ")}` });
    }

    // Get current user from session
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return res.status(401).json({ error: "Session expired" });

    const tenants = await sb(`tenants?id=eq.${session.tenant_id}&select=id,slug,name,owner_email,stripe_customer_id`);
    const tenant = Array.isArray(tenants) ? tenants[0] : null;
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });

    // Get or create customer
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.owner_email,
        name: tenant.name,
        metadata: { tenant_id: tenant.id, tenant_slug: tenant.slug },
      });
      customerId = customer.id;
      await sb(`tenants?id=eq.${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stripe_customer_id: customerId }),
      });
    }

    const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: PLAN_PRICES[plan],
            recurring: { interval: "month" },
            product_data: {
              name: `ATOM ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/#/?checkout=success`,
      cancel_url: `${origin}/#/?checkout=cancel`,
      metadata: { tenant_id: tenant.id, plan },
    });

    return res.status(200).json({ checkoutUrl: checkoutSession.url });
  } catch (e: any) {
    console.error("[billing/checkout]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
