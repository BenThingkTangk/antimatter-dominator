/**
 * Stripe tool — REST API via fetch (Basic auth with secret key). The `stripe`
 * SDK is listed in package.json for callers who prefer it; REST keeps this
 * serverless-friendly and import-safe.
 *
 * Env: STRIPE_SECRET_KEY.
 */
import { getEnv } from "../env";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.stripe.com/v1";
const log = logger.child({ tool: "stripe" });

function authHeader(): Record<string, string> {
  const key = getEnv("STRIPE_SECRET_KEY", true);
  const basic = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

/** Stripe wants application/x-www-form-urlencoded for writes. */
function form(params: Record<string, string | number | boolean>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.append(k, String(v));
  return usp.toString();
}

async function stripeRequest<T>(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const url =
    method === "GET" && params
      ? `${API}${path}?${form(params)}`
      : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeader(),
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "POST" && params ? form(params) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/**
 * @destructive Issues a refund against a payment intent or charge.
 */
export async function issueRefund(p: {
  paymentIntentId?: string;
  chargeId?: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}): Promise<OpsResult<{ id: string; status: string }>> {
  try {
    if (!p.paymentIntentId && !p.chargeId) {
      return fail("issueRefund requires paymentIntentId or chargeId");
    }
    const params: Record<string, string | number> = {};
    if (p.paymentIntentId) params.payment_intent = p.paymentIntentId;
    if (p.chargeId) params.charge = p.chargeId;
    if (p.amount) params.amount = p.amount;
    if (p.reason) params.reason = p.reason;
    const r = await stripeRequest<{ id: string; status: string }>(
      "/refunds",
      "POST",
      params,
    );
    return ok({ id: r.id, status: r.status }, `Refund ${r.id}: ${r.status}`);
  } catch (e) {
    log.error({ err: errMessage(e) }, "issueRefund failed");
    return fail(`issueRefund failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Creates a coupon (affects billing for any customer who redeems).
 */
export async function createCoupon(p: {
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration?: "once" | "repeating" | "forever";
  name?: string;
}): Promise<OpsResult<{ id: string }>> {
  try {
    const params: Record<string, string | number> = {
      duration: p.duration || "once",
    };
    if (p.percentOff) params.percent_off = p.percentOff;
    if (p.amountOff) {
      params.amount_off = p.amountOff;
      params.currency = p.currency || "usd";
    }
    if (p.name) params.name = p.name;
    const r = await stripeRequest<{ id: string }>("/coupons", "POST", params);
    return ok({ id: r.id }, `Created coupon ${r.id}`);
  } catch (e) {
    return fail(`createCoupon failed: ${errMessage(e)}`);
  }
}

/** Look up a customer by email (non-destructive). */
export async function lookupCustomer(p: {
  email: string;
}): Promise<
  OpsResult<{ id: string; email: string; created: number } | null>
> {
  try {
    const r = await stripeRequest<{
      data: Array<{ id: string; email: string; created: number }>;
    }>("/customers", "GET", { email: p.email, limit: 1 });
    const c = r.data?.[0] || null;
    return ok(c, c ? `Customer ${c.id}` : `No customer for ${p.email}`);
  } catch (e) {
    return fail(`lookupCustomer failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Changes a subscription's plan (price). Prorates by default.
 */
export async function changePlan(p: {
  subscriptionId: string;
  itemId: string;
  newPriceId: string;
}): Promise<OpsResult<{ id: string; status: string }>> {
  try {
    const r = await stripeRequest<{ id: string; status: string }>(
      `/subscriptions/${encodeURIComponent(p.subscriptionId)}`,
      "POST",
      {
        "items[0][id]": p.itemId,
        "items[0][price]": p.newPriceId,
        proration_behavior: "create_prorations",
      },
    );
    return ok({ id: r.id, status: r.status }, `Changed plan on ${r.id}`);
  } catch (e) {
    return fail(`changePlan failed: ${errMessage(e)}`);
  }
}

/**
 * Macro helper: approximate Monthly Recurring Revenue from active
 * subscriptions (sums monthly-normalized plan amounts). Non-destructive.
 */
export async function lookupMRR(): Promise<
  OpsResult<{ mrrCents: number; activeSubscriptions: number; currency: string }>
> {
  try {
    let mrrCents = 0;
    let count = 0;
    let currency = "usd";
    let startingAfter: string | undefined;
    // Bounded pagination (max 5 pages) to keep the call snappy.
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string | number> = {
        status: "active",
        limit: 100,
        "expand[]": "data.items.data.price",
      };
      if (startingAfter) params.starting_after = startingAfter;
      const r = await stripeRequest<{
        data: Array<{
          id: string;
          currency: string;
          items: {
            data: Array<{
              quantity?: number;
              price?: {
                unit_amount?: number;
                recurring?: { interval?: string; interval_count?: number };
              };
            }>;
          };
        }>;
        has_more: boolean;
      }>("/subscriptions", "GET", params);
      for (const sub of r.data) {
        currency = sub.currency || currency;
        count++;
        for (const item of sub.items.data) {
          const amount = item.price?.unit_amount || 0;
          const qty = item.quantity || 1;
          const interval = item.price?.recurring?.interval || "month";
          const intervalCount = item.price?.recurring?.interval_count || 1;
          const monthly =
            interval === "year"
              ? amount / (12 * intervalCount)
              : interval === "week"
                ? (amount * 52) / 12 / intervalCount
                : amount / intervalCount;
          mrrCents += monthly * qty;
        }
      }
      if (!r.has_more || r.data.length === 0) break;
      startingAfter = r.data[r.data.length - 1].id;
    }
    return ok(
      { mrrCents: Math.round(mrrCents), activeSubscriptions: count, currency },
      `MRR ≈ ${(mrrCents / 100).toFixed(2)} ${currency.toUpperCase()} across ${count} sub(s)`,
    );
  } catch (e) {
    return fail(`lookupMRR failed: ${errMessage(e)}`);
  }
}

/**
 * Macro helper: churn proxy — subscriptions canceled in the trailing 30 days.
 * Non-destructive.
 */
export async function lookupChurn(): Promise<
  OpsResult<{ canceledLast30d: number }>
> {
  try {
    const since = Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const r = await stripeRequest<{
      data: Array<{ id: string; canceled_at: number | null }>;
    }>("/subscriptions", "GET", {
      status: "canceled",
      limit: 100,
      "created[gte]": since,
    });
    const canceled = (r.data || []).filter(
      (s) => s.canceled_at && s.canceled_at >= since,
    ).length;
    return ok({ canceledLast30d: canceled }, `${canceled} cancellation(s) in 30d`);
  } catch (e) {
    return fail(`lookupChurn failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  issueRefund: {
    meta: { tool: "stripe", action: "issueRefund", destructive: true, description: "Issue a refund" },
    run: (p) => issueRefund(p as unknown as Parameters<typeof issueRefund>[0]),
  },
  createCoupon: {
    meta: { tool: "stripe", action: "createCoupon", destructive: true, description: "Create a coupon" },
    run: (p) => createCoupon(p as unknown as Parameters<typeof createCoupon>[0]),
  },
  lookupCustomer: {
    meta: { tool: "stripe", action: "lookupCustomer", destructive: false, description: "Look up a customer" },
    run: (p) => lookupCustomer(p as unknown as Parameters<typeof lookupCustomer>[0]),
  },
  changePlan: {
    meta: { tool: "stripe", action: "changePlan", destructive: true, description: "Change subscription plan" },
    run: (p) => changePlan(p as unknown as Parameters<typeof changePlan>[0]),
  },
  lookupMRR: {
    meta: { tool: "stripe", action: "lookupMRR", destructive: false, description: "Approximate MRR" },
    run: () => lookupMRR(),
  },
  lookupChurn: {
    meta: { tool: "stripe", action: "lookupChurn", destructive: false, description: "30d churn proxy" },
    run: () => lookupChurn(),
  },
};
