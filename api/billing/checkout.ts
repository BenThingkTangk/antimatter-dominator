/**
 * POST /api/billing/checkout
 * Body: { plan: "starter"|"growth"|"advisory"|"enterprise", seats?: number, withTrial?: boolean }
 *
 * Creates a Stripe Checkout Session for the current tenant. Honors:
 *  • Per-seat pricing — `seats` becomes Stripe line-item quantity (defaults to 1).
 *  • 14-day free trial — `withTrial=true` (default) attaches `subscription_data.trial_period_days = 14`.
 *  • Optional Stripe Price IDs — if env vars STRIPE_PRICE_<PLAN> are set, the checkout
 *    uses those prices (recommended for production). Otherwise falls back to inline
 *    price_data (current behavior, useful for test mode).
 *  • Tax + promotion codes — both enabled.
 *
 * Returns: { checkoutUrl } or { checkoutUrl: null, message } if Stripe not configured.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PLAN_TIERS } from "../../shared/seat-cost-model";

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

// Build per-seat prices + labels from PLAN_TIERS (single source of truth)
const PURCHASABLE_TIERS = PLAN_TIERS.filter((t) => !t.contactSales && t.monthlyPerSeat > 0);
const PER_SEAT_PRICES: Record<string, number> = {};
const PLAN_LABELS: Record<string, string> = {};
for (const t of PURCHASABLE_TIERS) {
  PER_SEAT_PRICES[t.id] = t.monthlyPerSeat * 100; // dollars → cents
  PLAN_LABELS[t.id] = `ATOM ${t.label}`;
}

// Env-var Stripe Price IDs (preferred in production)
const PRICE_ENV_MAP: Record<string, string> = {
  striker: "STRIPE_PRICE_STARTER_MONTHLY",
  growth: "STRIPE_PRICE_GROWTH_MONTHLY",
  advisory: "STRIPE_PRICE_ADVISORY_MONTHLY",
  enterprise: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
};

function priceIdForPlan(plan: string): string {
  const envKey = PRICE_ENV_MAP[plan];
  return envKey ? clean(process.env[envKey]) : "";
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
      return res.status(200).json({
        checkoutUrl: null,
        message: "Stripe not configured — set STRIPE_SECRET_KEY in Vercel env to enable checkout.",
      });
    }

    const body = req.body || {};
    const plan = String(body.plan || "").toLowerCase();
    const seats = Math.max(1, Math.min(500, Number(body.seats) || 1));
    const withTrial = body.withTrial !== false; // default true
    const tierDef = PLAN_TIERS.find((t) => t.id === plan);
    if (!PER_SEAT_PRICES[plan]) {
      return res.status(400).json({ error: `Invalid plan. Choose one of: ${Object.keys(PER_SEAT_PRICES).join(", ")}` });
    }

    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return res.status(401).json({ error: "Session expired" });

    const tenants = await sb(`tenants?id=eq.${session.tenant_id}&select=id,slug,name,owner_email,stripe_customer_id,stripe_subscription_id`);
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

    // Build line item — prefer real Stripe Price IDs in production, fallback to inline price_data
    const priceId = priceIdForPlan(plan);
    const lineItem: any = priceId
      ? { price: priceId, quantity: seats }
      : {
          price_data: {
            currency: "usd",
            unit_amount: PER_SEAT_PRICES[plan],
            recurring: { interval: "month" },
            product_data: {
              name: `${PLAN_LABELS[plan]} — per seat`,
            },
          },
          quantity: seats,
        };

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [lineItem],
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "auto",
      subscription_data: {
        ...(withTrial && tierDef?.freeTrialDays ? { trial_period_days: tierDef.freeTrialDays } : {}),
        metadata: { tenant_id: tenant.id, tenant_slug: tenant.slug, plan, seats: String(seats) },
      },
      success_url: `${origin}/#/billing?checkout=success`,
      cancel_url: `${origin}/#/billing?checkout=cancel`,
      metadata: { tenant_id: tenant.id, tenant_slug: tenant.slug, plan, seats: String(seats), with_trial: String(withTrial) },
    });

    return res.status(200).json({ checkoutUrl: checkoutSession.url });
  } catch (e: any) {
    console.error("[billing/checkout]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
