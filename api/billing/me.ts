/**
 * GET /api/billing/me
 *
 * Returns the current tenant's billing state: plan, seats, subscription status,
 * trial end, current period end, Stripe customer + subscription IDs, and the
 * pricing-tier catalog so the client can render the pricing page in one round
 * trip without leaking secrets.
 *
 * Auth: cookie-based session (atom_session).
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

const CATALOG = [
  { plan: "starter",    label: "Starter",    perSeatCents:  9900, includedSeats:  5, dialsPerMonth: "500",     features: ["ATOM Pitch + Objections", "Lead Gen + Dial", "5 voice agents", "Email support"] },
  { plan: "growth",     label: "Growth",     perSeatCents: 19900, includedSeats: 15, dialsPerMonth: "2,000",   features: ["Everything in Starter", "Campaign Engine", "Market Intent", "Premium Sonar signals", "Priority support"] },
  { plan: "advisory",   label: "Advisory",   perSeatCents: 49900, includedSeats: 50, dialsPerMonth: "10,000",  features: ["Everything in Growth", "War Room HVT pipeline", "Vibranium GA console", "Dedicated success manager"] },
  { plan: "enterprise", label: "Enterprise", perSeatCents: 99900, includedSeats:  0, dialsPerMonth: "Unlimited", features: ["Everything in Advisory", "Custom Hume voice agents", "Twilio sub-account", "Compliance & audit logs", "24/7 SLA"] },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies["atom_session"];
    if (!token) {
      return res.status(200).json({
        authenticated: false,
        catalog: CATALOG,
        stripeConfigured: !!STRIPE_SECRET_KEY,
      });
    }

    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) {
      return res.status(200).json({
        authenticated: false,
        catalog: CATALOG,
        stripeConfigured: !!STRIPE_SECRET_KEY,
      });
    }

    const rows = await sb(
      `tenants?id=eq.${session.tenant_id}&select=id,slug,name,owner_email,plan,subscription_status,trial_ends_at,stripe_customer_id,stripe_subscription_id,kill_switch`
    );
    const tenant = Array.isArray(rows) ? rows[0] : null;
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // If we have a Stripe subscription, hydrate live state (seats, period end)
    let liveSubscription: any = null;
    if (STRIPE_SECRET_KEY && tenant.stripe_subscription_id) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
        const sub = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id, { expand: ["items.data.price.product"] });
        const item = sub.items?.data?.[0];
        liveSubscription = {
          status: sub.status,
          seats: item?.quantity || 1,
          unitAmountCents: typeof item?.price?.unit_amount === "number" ? item.price.unit_amount : null,
          currency: item?.price?.currency || "usd",
          interval: item?.price?.recurring?.interval || "month",
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        };
      } catch (e: any) {
        console.warn("[billing/me] stripe retrieve failed:", e?.message);
      }
    }

    return res.status(200).json({
      authenticated: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        owner_email: tenant.owner_email,
        plan: tenant.plan,
        subscription_status: tenant.subscription_status,
        trial_ends_at: tenant.trial_ends_at,
        stripe_customer_id: tenant.stripe_customer_id,
        stripe_subscription_id: tenant.stripe_subscription_id,
        kill_switch: tenant.kill_switch,
      },
      liveSubscription,
      catalog: CATALOG,
      stripeConfigured: !!STRIPE_SECRET_KEY,
    });
  } catch (e: any) {
    console.error("[billing/me]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
