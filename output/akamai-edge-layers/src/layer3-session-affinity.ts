/**
 * Layer 3 — Session Affinity (Sticky Sessions)
 *
 * Responsibilities:
 *  - Read session identifier from either:
 *      a) `atom_session` cookie
 *      b) `X-ATOM-Session` request header
 *  - Hash the session ID into one of N origin buckets
 *  - Override the Layer-1 origin decision so that all requests in a session
 *    consistently hit the same origin (critical for ATOM Dial stateful calls)
 *  - Write the chosen origin back to a PMUSER variable so Layer 1 can read it
 *
 * The bucket→origin mapping must stay stable across deploys; do not reorder
 * the ORIGIN_POOL array once in production.
 */

// Origin pool in bucket order — must match layer1 constants
const ORIGIN_POOL: string[] = [
  "atom-api-us-east.atomsalesdominator.com",
  "atom-api-us-west.atomsalesdominator.com",
  "atom-api-eu-west.atomsalesdominator.com",
  "atom-api-gpu-us-east.atomsalesdominator.com",
];

const BUCKET_COUNT = ORIGIN_POOL.length;

/**
 * Simple FNV-1a 32-bit hash — produces consistent results across V8/SpiderMonkey.
 * Avoids crypto APIs not available in all EdgeWorker environments.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (32-bit) with overflow wrapping
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash;
}

/** Map a session ID string to an origin hostname deterministically. */
export function sessionToOrigin(sessionId: string): string {
  const bucket = fnv1a32(sessionId) % BUCKET_COUNT;
  return ORIGIN_POOL[bucket]!;
}

/**
 * Parse the `atom_session` cookie value from the Cookie header string.
 */
export function parseSessionCookie(cookieHeader: string): string | undefined {
  const match = cookieHeader.match(/(?:^|;\s*)atom_session=([^;]+)/);
  return match?.[1];
}

/**
 * Main EdgeWorker hook — resolves sticky origin and populates PMUSER_ATOM_ORIGIN
 * so that layer1 respects it via RouterContext.stickyOrigin.
 *
 * Returns the sticky origin if resolved, undefined otherwise.
 */
export async function resolveSessionAffinity(
  request: EW.IngressClientRequest
): Promise<string | undefined> {
  // Prefer header over cookie (header is set by native app clients; cookie by web)
  const sessionId =
    request.getHeader("X-ATOM-Session")?.[0] ??
    parseSessionCookie(request.getHeader("Cookie")?.[0] ?? "");

  if (!sessionId) return undefined;

  const stickyOrigin = sessionToOrigin(sessionId);

  // Expose to downstream layers via Akamai variable
  request.setVariable("PMUSER_ATOM_STICKY_ORIGIN", stickyOrigin);
  request.setVariable("PMUSER_ATOM_SESSION_ID", sessionId);

  // Add a header so the origin can log the affinity decision
  request.addHeader("X-ATOM-Session-Origin", stickyOrigin);

  return stickyOrigin;
}

export { ORIGIN_POOL, BUCKET_COUNT };
