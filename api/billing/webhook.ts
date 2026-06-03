/**
 * POST /api/billing/webhook
 *
 * Handles Stripe webhook events:
 *   - checkout.session.completed       → link customer, set plan + seats
 *   - customer.subscription.created    → mirror plan/seats/status
 *   - customer.subscription.updated    → plan/status changes, trial conversion, past_due emails
 *   - customer.subscription.deleted    → cancelled + kill_switch
 *   - invoice.payment_failed           → past_due + "update your card" email
 *   - invoice.paid                     → reactivate if was past_due + recovery email
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PLAN_TIERS } from "../../shared/seat-cost-model";
import { sendEmail } from "../_lib/send-email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_SECRET_KEY = clean(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = clean(process.env.STRIPE_WEBHOOK_SECRET);
const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://atom-dominator-pro.vercel.app";

// Production is determined by Vercel's VERCEL_ENV ("production" only on the
// production deployment). Falls back to NODE_ENV for non-Vercel hosts. Preview
// and development deployments are treated as non-production.
const IS_PRODUCTION =
  clean(process.env.VERCEL_ENV) === "production" ||
  (!process.env.VERCEL_ENV && clean(process.env.NODE_ENV) === "production");

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

// ── Reverse-map Stripe Price ID → plan key ──
const PRICE_ENV_MAP: Record<string, string> = {
  STRIPE_PRICE_STARTER_MONTHLY: "striker",
  STRIPE_PRICE_GROWTH_MONTHLY: "growth",
  STRIPE_PRICE_ADVISORY_MONTHLY: "advisory",
  STRIPE_PRICE_ENTERPRISE_MONTHLY: "enterprise",
};

function planFromPriceId(priceId: string): string | null {
  for (const [envKey, planKey] of Object.entries(PRICE_ENV_MAP)) {
    if (clean(process.env[envKey]) === priceId) return planKey;
  }
  return null;
}

// Heuristic plan inference from a Stripe price's product name
function inferPlanFromProduct(price: any): string | null {
  const name = (price?.product?.name || price?.nickname || "").toLowerCase();
  for (const tier of PLAN_TIERS) {
    if (name.includes(tier.id) || name.includes(tier.label.toLowerCase())) return tier.id;
  }
  // Legacy name compat
  if (name.includes("starter")) return "striker";
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

async function getTenantByCustomer(customerId: string): Promise<{ id: string; owner_email: string; plan: string; seats: number } | null> {
  try {
    const rows = await sb(
      `tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,owner_email,plan,seats`
    );
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch { return null; }
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
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error("[webhook] signature verification failed:", err?.message);
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }
    } else if (IS_PRODUCTION) {
      // Fail closed in production: never process an unverified webhook that can
      // mutate plan/seats/kill_switch state.
      console.error("[webhook] STRIPE_WEBHOOK_SECRET missing in production — refusing to process");
      return res.status(500).json({ error: "Webhook signature secret not configured" });
    } else {
      console.warn("[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (non-production only)");
      event = JSON.parse(rawBody.toString());
    }

    const type = event.type as string;
    const obj = event.data?.object as any;

    // ── checkout.session.completed ──
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
          if (item?.price?.id) {
            const mapped = planFromPriceId(item.price.id);
            if (mapped) plan = mapped;
            else if (!plan) plan = inferPlanFromProduct(item.price);
          }
        } catch (e: any) {
          console.warn("[webhook] retrieve sub failed:", e?.message);
        }
      }

      const patch: Record<string, any> = {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId || null,
        subscription_status: status,
        kill_switch: false,
        seats,
      };
      if (plan) patch.plan = plan;
      if (trialEnd) patch.trial_ends_at = trialEnd;

      if (tenantId) await patchTenantById(tenantId, patch);
      else if (customerId) await patchTenantByCustomer(customerId, patch);
    }

    // ── customer.subscription.created ──
    if (type === "customer.subscription.created") {
      const customerId = obj.customer as string;
      const status = obj.status as string;
      const subscriptionId = obj.id as string;
      const trialEnd = isoFromUnix(obj.trial_end);
      const item = obj.items?.data?.[0];
      const seats = item?.quantity || 1;

      let plan: string | null = null;
      if (item?.price?.id) {
        plan = planFromPriceId(item.price.id);
      }
      if (!plan) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
          const it = sub.items?.data?.[0];
          if (it?.price) plan = inferPlanFromProduct(it.price);
        } catch {}
      }

      const patch: Record<string, any> = {
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
        kill_switch: false,
        seats,
      };
      if (trialEnd) patch.trial_ends_at = trialEnd;
      if (plan) patch.plan = plan;

      await patchTenantByCustomer(customerId, patch);
    }

    // ── customer.subscription.updated ──
    if (type === "customer.subscription.updated") {
      const customerId = obj.customer as string;
      const status = obj.status as string;
      const prevStatus = event.data?.previous_attributes?.status as string | undefined;
      const subscriptionId = obj.id as string;
      const trialEnd = isoFromUnix(obj.trial_end);
      const item = obj.items?.data?.[0];
      const seats = item?.quantity || 1;

      let plan: string | null = null;
      if (item?.price?.id) {
        plan = planFromPriceId(item.price.id);
      }
      if (!plan) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
          const it = sub.items?.data?.[0];
          if (it?.price) plan = inferPlanFromProduct(it.price);
        } catch {}
      }

      const patch: Record<string, any> = {
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
        kill_switch: status === "past_due" || status === "canceled" || status === "unpaid",
        seats,
      };
      if (trialEnd) patch.trial_ends_at = trialEnd;
      if (plan) patch.plan = plan;

      await patchTenantByCustomer(customerId, patch);

      // Trial converted → send subscription-created email
      if (prevStatus === "trialing" && status === "active") {
        const tenant = await getTenantByCustomer(customerId);
        if (tenant?.owner_email) {
          sendEmail("subscription-created", tenant.owner_email, {
            planName: plan || tenant.plan || "Pro",
            seats: seats || tenant.seats || 1,
            nextBillingDate: "see billing portal",
            amount: "—",
            currency: "usd",
          }, { tenantId: tenant.id, subject: "Your ΔTOM trial has converted — welcome aboard" }).catch(() => {});
        }
      }

      // Active → past_due → send payment failed email
      if (prevStatus === "active" && status === "past_due") {
        const tenant = await getTenantByCustomer(customerId);
        if (tenant?.owner_email) {
          const retryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
          sendEmail("payment-failed", tenant.owner_email, {
            amount: "—",
            retryDate,
            updateCardUrl: `${APP_URL}/#/billing`,
            currency: "usd",
          }, { tenantId: tenant.id }).catch(() => {});
        }
      }
    }

    // ── customer.subscription.deleted ──
    if (type === "customer.subscription.deleted") {
      const customerId = obj.customer as string;
      await patchTenantByCustomer(customerId, {
        subscription_status: "canceled",
        kill_switch: true,
      });
    }

    // ── invoice.payment_failed ──
    if (type === "invoice.payment_failed") {
      const customerId = obj.customer as string;
      await patchTenantByCustomer(customerId, { subscription_status: "past_due" });

      const tenant = await getTenantByCustomer(customerId);
      if (tenant?.owner_email) {
        const amount = obj.amount_due ? (obj.amount_due / 100).toFixed(2) : "—";
        const retryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric" });
        sendEmail("payment-failed", tenant.owner_email, {
          amount,
          retryDate,
          updateCardUrl: `${APP_URL}/#/billing`,
          currency: (obj.currency as string) || "usd",
        }, { tenantId: tenant.id }).catch(() => {});
      }
    }

    // ── invoice.paid ──
    if (type === "invoice.paid") {
      const customerId = obj.customer as string;
      // Check if tenant was past_due before this payment
      const tenantRows = await sb(
        `tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=id,subscription_status,owner_email,plan,seats`
      );
      const tenant = Array.isArray(tenantRows) ? tenantRows[0] : null;
      const wasPastDue = tenant?.subscription_status === "past_due";

      await patchTenantByCustomer(customerId, {
        subscription_status: "active",
        kill_switch: false,
      });

      if (wasPastDue && tenant?.owner_email) {
        sendEmail("subscription-changed", tenant.owner_email, {
          oldPlan: "past_due",
          newPlan: tenant.plan || "active",
          seats: tenant.seats || 1,
          effectiveDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          amount: obj.amount_paid ? (obj.amount_paid / 100).toFixed(2) : "—",
          currency: (obj.currency as string) || "usd",
        }, { tenantId: tenant.id, subject: "Payment recovered — ΔTOM is back to full access" }).catch(() => {});
      }
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook]", e?.message);
    return res.status(400).json({ error: e?.message || "webhook error" });
  }
}
