/**
 * Server-side push notification via OneSignal REST API.
 * Silently skips if OneSignal env vars are not configured.
 */
export async function sendPush(
  externalUserId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, any>;
    url?: string;
  },
): Promise<{ sent: boolean; reason?: string }> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    console.warn("[push] OneSignal not configured; skipping push");
    return { sent: false, reason: "not_configured" };
  }
  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        include_aliases: { external_id: [externalUserId] },
        target_channel: "push",
        headings: { en: payload.title },
        contents: { en: payload.body },
        data: payload.data ?? {},
        url: payload.url,
      }),
    });
    if (!res.ok) {
      console.error("[push] failed", await res.text());
      return { sent: false, reason: "api_error" };
    }
    return { sent: true };
  } catch (err: any) {
    console.error("[push] exception:", err?.message);
    return { sent: false, reason: "exception" };
  }
}
