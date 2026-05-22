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

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const STRIPE_SECRET_KEY = clean(process.env.STRIPE_SECRET_KEY);
const STRIPE_WEBHOOK_SECRET = clean(process.env.STRIPE_WEBHOOK_SECRET);
const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
const RESEND_FROM = clean(process.env.RESEND_FROM) || "ATOM <hello@atomsalesdominator.com>";
const APP_URL = clean(process.env.NEXT_PUBLIC_APP_URL) || "https://atom-dominator-pro.vercel.app";

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

async function getOwnerEmail(customerId: string): Promise<string | null> {
  try {
    const rows = await sb(
      `tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=owner_email`
    );
    return Array.isArray(rows) && rows[0]?.owner_email ? rows[0].owner_email : null;
  } catch { return null; }
}

// ── Fire-and-forget branded email ──
function sendEmail(to: string, subject: string, heading: string, body: string, ctaLabel?: string, ctaUrl?: string) {
  if (!RESEND_API_KEY || !to) return;
  const teal = "#00e6d3", bg = "#05090c", card = "#0c1014", text = "#e8e8ea", muted = "#7e8590";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${card};border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px 32px;"><div style="width:32px;height:32px;border-radius:8px;background:${teal};text-align:center;color:${bg};font-weight:800;line-height:32px;font-size:14px;font-family:monospace;">Δ</div></td></tr>
<tr><td style="padding:18px 32px 8px 32px;"><h1 style="margin:0 0 12px 0;font-size:22px;color:${text};font-weight:700;">${heading}</h1>
<div style="font-size:14px;line-height:1.6;color:${muted};">${body}</div></td></tr>
${ctaLabel && ctaUrl ? `<tr><td align="center" style="padding:16px 32px 28px 32px;">
<a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:${teal};color:${bg};text-decoration:none;font-weight:700;font-size:14px;">${ctaLabel}</a></td></tr>` : ""}
</table></td></tr></table></body></html>`;

  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  }).catch(() => {});
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
    } else {
      console.warn("[webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
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

      // Trial converted → send email
      if (prevStatus === "trialing" && status === "active") {
        const email = await getOwnerEmail(customerId);
        if (email) {
          sendEmail(email,
            "Your ΔTOM trial has converted — welcome to the team",
            "Trial converted!",
            `<p>Your subscription is now <strong style="color:#e8e8ea">active</strong>. You have full access to all ${plan || "your"} plan features.</p>
             <p>Thank you for choosing ΔTOM — we're excited to help you dominate.</p>`,
            "Go to ΔTOM →",
            `${APP_URL}/#/pitch`,
          );
        }
      }

      // Active → past_due → send payment failed email
      if (prevStatus === "active" && status === "past_due") {
        const email = await getOwnerEmail(customerId);
        if (email) {
          sendEmail(email,
            "Action required: ΔTOM payment failed",
            "Payment failed",
            `<p>We were unable to process your latest payment. Please update your card to avoid service interruption.</p>
             <p>Your access will be restricted in 7 days if the payment issue isn't resolved.</p>`,
            "Update payment method →",
            `${APP_URL}/#/billing`,
          );
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

      const email = await getOwnerEmail(customerId);
      if (email) {
        sendEmail(email,
          "Failed payment — please update your card",
          "Payment failed",
          `<p>Your latest ΔTOM invoice could not be processed. Please update your payment method to keep your subscription active.</p>`,
          "Update card →",
          `${APP_URL}/#/billing`,
        );
      }
    }

    // ── invoice.paid ──
    if (type === "invoice.paid") {
      const customerId = obj.customer as string;
      // Check if tenant was past_due before this payment
      const tenantRows = await sb(
        `tenants?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=subscription_status,owner_email`
      );
      const tenant = Array.isArray(tenantRows) ? tenantRows[0] : null;
      const wasPastDue = tenant?.subscription_status === "past_due";

      await patchTenantByCustomer(customerId, {
        subscription_status: "active",
        kill_switch: false,
      });

      if (wasPastDue && tenant?.owner_email) {
        sendEmail(tenant.owner_email,
          "Payment recovered — ΔTOM is back to full access",
          "Payment recovered!",
          `<p>Your payment has been processed successfully. Your ΔTOM subscription is active again with full access to all features.</p>`,
          "Back to ΔTOM →",
          `${APP_URL}/#/pitch`,
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[billing/webhook]", e?.message);
    return res.status(400).json({ error: e?.message || "webhook error" });
  }
}
