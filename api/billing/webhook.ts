/**
 * POST /api/billing/webhook
 * Handles Stripe webhook events:
 *   - customer.subscription.updated
 *   - invoice.payment_failed
 *   - customer.subscription.deleted
 * Updates tenants.subscription_status and tenants.stripe_subscription_id.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_SECRET_KEY = clean(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = clean(process.env.STRIPE_WEBHOOK_SECRET);

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

// Vercel needs raw body for Stripe sig verification
export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(200).json({ received: true, message: "Stripe not configured" });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });

    const rawBody = await getRawBody(req);
    let event: any;

    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers["stripe-signature"] as string;
      if (!sig) return res.status(400).json({ error: "Missing stripe-signature header" });
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody.toString());
    }

    const type = event.type as string;
    const obj = event.data?.object;

    if (type === "customer.subscription.updated") {
      const customerId = obj.customer as string;
      const status = obj.status as string; // active, past_due, canceled, trialing, etc.
      const subscriptionId = obj.id as string;

      // Map Stripe status to our subscription_status
      let subscriptionStatus = status;
      if (status === "active") subscriptionStatus = "active";
      else if (status === "past_due") subscriptionStatus = "past_due";
      else if (status === "canceled") subscriptionStatus = "canceled";
      else if (status === "trialing") subscriptionStatus = "trialing";

      await sb(`tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          subscription_status: subscriptionStatus,
          stripe_subscription_id: subscriptionId,
          kill_switch: status === "past_due" || status === "canceled",
        }),
      });
    }

    if (type === "invoice.payment_failed") {
      const customerId = obj.customer as string;
      await sb(`tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        body: JSON.stringify({ subscription_status: "past_due" }),
      });
    }

    if (type === "customer.subscription.deleted") {
      const customerId = obj.customer as string;
      await sb(`tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          subscription_status: "canceled",
          kill_switch: true,
        }),
      });
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook]", e?.message);
    return res.status(400).json({ error: e?.message || "webhook error" });
  }
}
