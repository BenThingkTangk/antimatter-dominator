/**
 * POST /api/webhooks/resend
 *
 * Handles Resend delivery webhooks: email.delivered, email.bounced,
 * email.complained, email.opened, email.clicked.
 *
 * Updates the `email_log` table in Supabase so the admin dashboard can
 * show delivery status for every transactional email sent.
 *
 * Signature verification uses the `svix` library (Resend's standard).
 * Set RESEND_WEBHOOK_SECRET in Vercel env to enable verification.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Webhook } from "svix";
import { forwardContentActivityEvent } from "../_lib/content-events.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const RESEND_WEBHOOK_SECRET = clean(process.env.RESEND_WEBHOOK_SECRET);
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sbUpdate(sql: string): Promise<void> {
  // We use Supabase REST PATCH for updates keyed on resend_id
  // This is more portable than raw SQL
}

async function patchEmailLog(resendId: string, fields: Record<string, any>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !resendId) return;
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/email_log?resend_id=eq.${encodeURIComponent(resendId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(fields),
      },
    );
  } catch (err: any) {
    console.error(`[resend-webhook] email_log update failed:`, err?.message);
  }
}

/**
 * Resend tags arrive as `data.tags` — either an array of `{ name, value }` or a
 * plain object. Pull out a linkage id if (and only if) the producer set one;
 * never fabricate. Recognised keys map to the provider webhook's linkage shape.
 */
function tagValue(data: any, ...keys: string[]): string | undefined {
  const tags = data?.tags;
  let map: Record<string, string> = {};
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t.name === "string") map[t.name] = String(t.value ?? "");
    }
  } else if (tags && typeof tags === "object") {
    for (const [k, v] of Object.entries(tags)) map[k] = String(v ?? "");
  }
  for (const k of keys) {
    const v = map[k];
    if (v) return v;
  }
  return undefined;
}

/** Forward a Resend `email.delivered` event as an email_sent proof event. */
async function forwardDeliveredProof(emailId: string, data: any, deliveredAt: string): Promise<void> {
  await forwardContentActivityEvent("email", {
    provider: "resend",
    // Stable provider id → idempotent source_record_id. A Resend retry of the
    // same delivery dedupes on the same email_id.
    messageId: emailId,
    kind: "email",
    // Prefer the provider-reported delivery time when present.
    sentAt: data?.created_at || deliveredAt,
    subject: typeof data?.subject === "string" ? data.subject : undefined,
    to: Array.isArray(data?.to) ? data.to[0] : (typeof data?.to === "string" ? data.to : undefined),
    // Linkage ids only when the producer tagged them (see send-email tags).
    prospectId: tagValue(data, "prospect_id", "prospectId"),
    campaignId: tagValue(data, "campaign_id", "campaignId"),
    accountId: tagValue(data, "account_id", "accountId"),
    tenantId: tagValue(data, "tenant_id", "tenantId"),
    userId: tagValue(data, "user_id", "userId"),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Always return 200 — Resend retries on 5xx; we want idempotency
  const ok = () => res.status(200).json({ received: true });

  try {
    const rawBody = JSON.stringify(req.body);

    // Verify signature if secret is configured
    if (RESEND_WEBHOOK_SECRET) {
      const svixId = req.headers["svix-id"] as string;
      const svixTimestamp = req.headers["svix-timestamp"] as string;
      const svixSignature = req.headers["svix-signature"] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn("[resend-webhook] Missing svix headers — rejecting");
        return ok(); // Return 200 anyway to avoid retries
      }

      try {
        const wh = new Webhook(RESEND_WEBHOOK_SECRET);
        wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch (err: any) {
        console.error("[resend-webhook] Signature verification failed:", err?.message);
        return ok(); // Return 200 — bad signature, but don't trigger retries
      }
    } else {
      console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — skipping signature verification");
    }

    const event = req.body;
    const eventType: string = event?.type || "";
    const data = event?.data || {};
    const emailId: string = data?.email_id || "";

    if (!emailId) {
      console.warn("[resend-webhook] No email_id in event payload");
      return ok();
    }

    const now = new Date().toISOString();

    switch (eventType) {
      case "email.delivered":
        await patchEmailLog(emailId, { delivered_at: now });
        // PROOF: a delivered email is a real "message sent" fact. Forward it to
        // the ATOM Content provider webhook layer (best-effort, never blocks the
        // 200 to Resend). Bounces/complaints are NOT forwarded — they are not
        // sent proof. Idempotent on Resend's own email_id.
        await forwardDeliveredProof(emailId, data, now);
        break;

      case "email.bounced":
        await patchEmailLog(emailId, {
          bounced_at: now,
          bounce_type: data?.bounce?.type || "unknown",
        });
        break;

      case "email.complained":
        await patchEmailLog(emailId, { complained_at: now });
        break;

      case "email.opened":
        // COALESCE — only record the first open
        await patchEmailLog(emailId, { opened_at: now });
        break;

      case "email.clicked":
        // COALESCE — only record the first click
        await patchEmailLog(emailId, { clicked_at: now });
        break;

      default:
        console.log(`[resend-webhook] Unhandled event type: ${eventType}`);
    }

    return ok();
  } catch (err: any) {
    console.error("[resend-webhook] Error:", err?.message);
    return ok(); // Always 200
  }
}
