/**
 * rate-limit — minimal shared rate limiter for serverless API routes.
 *
 * Strategy:
 *   1. If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured, use
 *      Upstash's REST API (atomic INCR + EXPIRE) — this is the ONLY mode that
 *      is correct across distributed Vercel lambdas. No SDK dependency; we call
 *      the REST endpoint with fetch().
 *   2. Otherwise fall back to a best-effort in-memory fixed-window counter.
 *
 * ⚠️  TODO(distributed): the in-memory fallback is per-lambda-instance only.
 *     On Vercel each cold start gets a fresh Map, and concurrent instances do
 *     NOT share state, so a determined attacker can exceed the limit by N×
 *     (N = number of warm instances). It still meaningfully throttles the
 *     common case (one warm instance absorbing a burst) and is a safe default,
 *     but for production-grade protection configure Upstash. Do NOT rely on the
 *     in-memory mode as a hard security boundary.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const UPSTASH_URL = clean(process.env.UPSTASH_REDIS_REST_URL);
const UPSTASH_TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN);
const HAS_UPSTASH = !!(UPSTASH_URL && UPSTASH_TOKEN);

export interface RateLimitOptions {
  /** Unique bucket name, e.g. "login", "ai-generate". */
  key: string;
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (best-effort). */
  resetSec: number;
  limit: number;
}

// ── In-memory fallback store (per-instance, best-effort) ──────────────────────
interface Bucket {
  count: number;
  expiresAt: number; // epoch ms
}
const memStore = new Map<string, Bucket>();

function memLimit(id: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const existing = memStore.get(id);
  if (!existing || existing.expiresAt <= now) {
    memStore.set(id, { count: 1, expiresAt: now + windowMs });
    // Opportunistic cleanup so the Map doesn't grow unbounded on a warm lambda.
    if (memStore.size > 5000) {
      memStore.forEach((v, k) => { if (v.expiresAt <= now) memStore.delete(k); });
    }
    return { allowed: true, remaining: limit - 1, resetSec: windowSec, limit };
  }
  existing.count += 1;
  const resetSec = Math.max(0, Math.ceil((existing.expiresAt - now) / 1000));
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetSec, limit };
  }
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetSec, limit };
}

async function upstashLimit(
  id: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  // INCR the key; on first hit (value === 1) set its TTL. Pipeline both in one
  // round-trip via the Upstash REST pipeline endpoint.
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", id],
        ["TTL", id],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const data: any = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    let ttl = Number(data?.[1]?.result ?? -1);
    if (count === 1 || ttl < 0) {
      // First request in the window (or no TTL set) → set the expiry.
      await fetch(`${UPSTASH_URL}/expire/${encodeURIComponent(id)}/${windowSec}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
      ttl = windowSec;
    }
    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      resetSec: ttl > 0 ? ttl : windowSec,
      limit,
    };
  } catch (err: any) {
    // Upstash unreachable: fall back to in-memory so we don't fail OPEN on a
    // store outage (still throttles the warm instance). Logged for observability.
    console.warn("[rate-limit] upstash error, using in-memory fallback:", err?.message);
    return memLimit(id, limit, windowSec);
  }
}

/** Best-effort client identifier: session cookie token, else x-forwarded-for IP. */
export function clientId(req: VercelRequest): string {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)atom_session=([^;]+)/);
  if (m) return "s:" + m[1].slice(0, 48);
  const xff = (req.headers["x-forwarded-for"] as string) || "";
  const ip = xff.split(",")[0].trim() || (req.socket as any)?.remoteAddress || "unknown";
  return "ip:" + ip;
}

/**
 * Check (and consume) one unit against a rate-limit bucket.
 * The bucket id is `${key}:${clientId}`.
 */
export async function rateLimit(
  req: VercelRequest,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const id = `rl:${opts.key}:${clientId(req)}`;
  if (HAS_UPSTASH) return upstashLimit(id, opts.limit, opts.windowSec);
  return memLimit(id, opts.limit, opts.windowSec);
}

/**
 * Convenience guard: enforce a limit and, if exceeded, write a 429 response and
 * return true (meaning the caller should stop). Sets standard rate-limit
 * headers. Returns false when the request may proceed.
 *
 *   if (await enforceRateLimit(req, res, { key: "login", limit: 10, windowSec: 60 })) return;
 */
export async function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  opts: RateLimitOptions,
): Promise<boolean> {
  const r = await rateLimit(req, opts);
  res.setHeader("X-RateLimit-Limit", String(r.limit));
  res.setHeader("X-RateLimit-Remaining", String(r.remaining));
  if (!r.allowed) {
    res.setHeader("Retry-After", String(r.resetSec));
    res.status(429).json({
      error: "rate_limited",
      message: "Too many requests — slow down and retry shortly.",
      retryAfterSec: r.resetSec,
    });
    return true;
  }
  return false;
}
