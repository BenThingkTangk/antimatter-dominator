/**
 * Diagnostics adapter — Sentry (and room for API-failure feeds).
 * Returns SUMMARIZED, non-sensitive error titles for the support agent to
 * reason about ("why did my campaign fail?"). Live when SENTRY_AUTH_TOKEN is
 * set; otherwise returns [] (clearly a no-op, never a fabricated error).
 */
const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SENTRY_AUTH_TOKEN = clean(process.env.SENTRY_AUTH_TOKEN);
const SENTRY_ORG = clean(process.env.SENTRY_ORG);
const SENTRY_PROJECT = clean(process.env.SENTRY_PROJECT);

export function sentryConfigured(): boolean {
  return Boolean(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);
}

/**
 * Fetch recent unresolved Sentry issues, optionally filtered to a tenant tag.
 * Returns up to 3 short titles. Best-effort; never throws into the chat path.
 */
export async function recentSentryErrors(tenantSlug?: string): Promise<string[]> {
  if (!sentryConfigured()) return [];
  try {
    const query = tenantSlug
      ? `is:unresolved tenant:${tenantSlug}`
      : "is:unresolved";
    const url =
      `https://sentry.io/api/0/projects/${encodeURIComponent(SENTRY_ORG)}/${encodeURIComponent(SENTRY_PROJECT)}/issues/` +
      `?query=${encodeURIComponent(query)}&statsPeriod=14d&limit=3`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const issues: any[] = await r.json();
    return (Array.isArray(issues) ? issues : [])
      .slice(0, 3)
      .map((i) => String(i.title || i.metadata?.value || "").slice(0, 140))
      .filter(Boolean);
  } catch {
    return [];
  }
}
