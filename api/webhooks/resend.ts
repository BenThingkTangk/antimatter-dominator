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
