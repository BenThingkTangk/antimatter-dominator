/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed       → first persistence (plan, seats, sub id, customer id)
 *   - customer.subscription.created    → mirror of above
 *   - customer.subscription.updated    → status / seat / plan changes
 *   - invoice.payment_failed           → mark past_due
 *   - customer.subscription.deleted    → mark canceled + flip kill_switch
 *
 * Updates tenants table: subscription_status, stripe_subscription_id, plan,
 * seats, trial_ends_at, kill_switch.
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

function isoFromUnix(s: number | null | undefined): string | null {
  return typeof s === "number" ? new Date(s * 1000).toISOString() : null;
}

// Heuristic plan inference from a Stripe price's product name.
function inferPlanFromPrice(price: any): string | null {
  const name = (price?.product?.name || price?.nickname || "").toLowerCase();
  if (name.includes("starter")) return "starter";
  if (name.includes("growth")) return "growth";
  if (name.includes("advisory")) return "advisory";
  if (name.includes("enterprise")) return "enterprise";
  return null;
}

async function patchTenantByCustomer(customerId: string, patch: Record<string, any>) {
  if (!customerId) return;
  await sb(`tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

async function patchTenantById(tenantId: string, patch: Record<string, any>) {
  if (!tenantId) return;
  await sb(`tenants?id=eq.${encodeURIComponent(tenantId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
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
    const obj = event.data?.object as any;

    // ── checkout.session.completed ─────────────────────────────────────────────
    if (type === "checkout.session.completed") {
      const customerId = obj.customer as string;
      const subscriptionId = obj.subscription as string;
      const tenantId = obj.metadata?.tenant_id as string | undefined;
      const planMeta = obj.metadata?.plan as string | undefined;
      const seatsMeta = Number(obj.metadata?.seats || 1);

      let trialEnd: string | null = null;
      let status = "active";
      let plan = planMeta || null;
      let seats = seatsMeta || 1;

      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
          status = sub.status;
          trialEnd = isoFromUnix(sub.trial_end);
          const item = sub.items?.data?.[0];
          if (item?.quantity) seats = item.quantity;
          if (!plan && item?.price) plan = inferPlanFromPrice(item.price);
        } catch (e: any) {
          console.warn("[webhook] retrieve sub failed:", e?.message);
        }
      }

      const patch: Record<string, any> = {
        stripe_subscription_id: subscriptionId || null,
        subscription_status: status,
        kill_switch: false,
      };
      if (plan) patch.plan = plan;
      if (seats) patch.seats = seats;
      if (trialEnd) patch.trial_ends_at = trialEnd;

      if (tenantId) await patchTenantById(tenantId, patch);
      else if (customerId) await patchTenantByCustomer(customerId, patch);
    }

    // ── customer.subscription.created / updated ────────────────────────────────
    if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
      const customerId = obj.customer as string;
      const status = obj.status as string;
      const subscriptionId = obj.id as string;
      const trialEnd = isoFromUnix(obj.trial_end);
      const item = obj.items?.data?.[0];
      const seats = item?.quantity || 1;

      // Re-fetch with expanded product to infer plan
      let plan: string | null = null;
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
        const it = sub.items?.data?.[0];
        if (it?.price) plan = inferPlanFromPrice(it.price);
      } catch {}

      const patch: Record<string, any> = {
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
        kill_switch: status === "past_due" || status === "canceled" || status === "unpaid",
        seats,
      };
      if (trialEnd) patch.trial_ends_at = trialEnd;
      if (plan) patch.plan = plan;

      await patchTenantByCustomer(customerId, patch);
    }

    // ── invoice.payment_failed ─────────────────────────────────────────────────
    if (type === "invoice.payment_failed") {
      const customerId = obj.customer as string;
      await patchTenantByCustomer(customerId, { subscription_status: "past_due" });
    }

    // ── customer.subscription.deleted ──────────────────────────────────────────
    if (type === "customer.subscription.deleted") {
      const customerId = obj.customer as string;
      await patchTenantByCustomer(customerId, {
        subscription_status: "canceled",
        kill_switch: true,
      });
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook]", e?.message);
    return res.status(400).json({ error: e?.message || "webhook error" });
  }
}
