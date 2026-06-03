/**
 * Bridge from the Vercel `api/` provider runtime into the Express ATOM Content
 * provider webhook layer (server/content/providerWebhooks). Real provider flows
 * running on Vercel (Resend delivery webhooks, ATOM leadgen call saves) call
 * `forwardContentActivityEvent` to forward a provider-level PROOF fact to the
 * token-guarded endpoints:
 *
 *   POST {base}/api/content/activity-events/webhooks/{email,reply,calendar,conversation}
 *
 * Trust boundary & secrets
 * ─────────────────────────
 *   - The bearer token (CONTENT_EVENTS_INGEST_TOKEN) is read ONLY here, server
 *     side, and sent as `Authorization: Bearer …`. It is never returned to a
 *     caller and never reaches the client. These helpers run exclusively inside
 *     Vercel serverless functions.
 *   - The base URL comes from ATOM_CONTENT_EVENTS_BASE_URL (falling back to
 *     ATOM_OPS_PUBLIC_URL, the deployment's own public URL), so a producer can
 *     target the same deployment that hosts the Express app.
 *
 * Best-effort proof telemetry
 * ───────────────────────────
 *   Proof forwarding is NON-CRITICAL: a producer flow (e.g. saving a call,
 *   recording a delivery) must NEVER fail because the content-event layer is
 *   down or unconfigured. Every path here no-ops or returns a structured result
 *   and logs; it never throws. Callers fire-and-forget.
 *
 * Idempotency
 * ───────────
 *   The forwarder does NOT invent ids. Each caller supplies the provider's own
 *   stable native id (Resend email_id, Twilio callSid) as the schema's required
 *   id field; the Express layer keys source_record_id on `<provider>:<id>` so a
 *   provider retry can never double-count.
 */

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

/** Resolve the Express base URL for the content-event endpoints (no trailing slash). */
function resolveBaseUrl(): string {
  const base = clean(process.env.ATOM_CONTENT_EVENTS_BASE_URL) || clean(process.env.ATOM_OPS_PUBLIC_URL);
  return base.replace(/\/+$/, "");
}

/** The bearer the Express ingest/webhook routes require (server-side only). */
function resolveToken(): string {
  return (
    clean(process.env.CONTENT_EVENTS_INGEST_TOKEN) ||
    clean(process.env.CRON_SECRET) ||
    clean(process.env.ATOM_OPS_CRON_SECRET)
  );
}

export type ContentEventChannel = "email" | "reply" | "calendar" | "conversation";

export interface ForwardResult {
  forwarded: boolean;
  status?: number;
  reason?: string;
}

/**
 * Forward one provider webhook payload to the Express content-event layer.
 * Best-effort: returns a structured result and logs on any failure; never throws.
 * The `payload` must match the channel's provider schema (e.g. for "email":
 * `{ provider, messageId, sentAt, … }`).
 */
export async function forwardContentActivityEvent(
  channel: ContentEventChannel,
  payload: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<ForwardResult> {
  const base = resolveBaseUrl();
  const token = resolveToken();

  if (!base) {
    console.warn(`[content-events] base URL not configured — skipping ${channel} proof event`);
    return { forwarded: false, reason: "no_base_url" };
  }
  if (!token) {
    console.warn(`[content-events] ingest token not configured — skipping ${channel} proof event`);
    return { forwarded: false, reason: "no_token" };
  }

  const url = `${base}/api/content/activity-events/webhooks/${channel}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options?.timeoutMs ?? 3500),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[content-events] ${channel} proof forward failed ${res.status}: ${text.slice(0, 200)}`);
      return { forwarded: false, status: res.status, reason: `http_${res.status}` };
    }
    return { forwarded: true, status: res.status };
  } catch (err: any) {
    console.error(`[content-events] ${channel} proof forward error:`, err?.message);
    return { forwarded: false, reason: err?.message || "fetch_error" };
  }
}
