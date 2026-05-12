/**
 * Layer 2 — Bot Defense & Rate Limiting
 *
 * Responsibilities:
 *  - Token-bucket rate limiting per client IP:
 *      • General endpoints: 60 req/min
 *      • /signals/*:        10 req/min
 *      • /pitch/*:           5 req/min
 *  - Suspicious user-agent blocking
 *  - CAPTCHA challenge fall-through (sets header for downstream challenge page)
 *
 * NOTE: Akamai EdgeWorkers do not provide persistent shared memory across
 * instances. Token-bucket state here uses in-process Map (best-effort within
 * a single worker instance). For production, pair with Akamai EdgeKV for
 * shared counters.
 */

/** In-process token-bucket store: key = `${ip}:${bucket}` → {tokens, ts} */
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export interface RateLimitConfig {
  capacity: number;    // max tokens
  refillRate: number;  // tokens per second
}

const RATE_LIMITS: Array<{ prefix: string; config: RateLimitConfig }> = [
  { prefix: "/signals/", config: { capacity: 10,  refillRate: 10  / 60 } },
  { prefix: "/pitch/",   config: { config: null, capacity: 5,   refillRate: 5   / 60 } as unknown as RateLimitConfig },
];
const DEFAULT_RATE: RateLimitConfig = { capacity: 60, refillRate: 60 / 60 };

/** Suspicious UA fragments — requests matching these are immediately denied */
const BLOCKED_UA_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /curl\//i,
  /libwww-perl/i,
  /\bbot\b/i,
  /\bspider\b/i,
  /\bscraper\b/i,
  /\bcrawler\b/i,
  /zgrab/i,
  /masscan/i,
  /nikto/i,
  /nuclei/i,
];

/** Paths that should present a CAPTCHA challenge instead of hard-deny */
const CAPTCHA_CHALLENGE_PATHS = ["/pitch/", "/api/atom-leadgen/"];

function getRateLimitConfig(path: string): RateLimitConfig {
  for (const rule of RATE_LIMITS) {
    if (path.startsWith(rule.prefix)) return rule.config;
  }
  return DEFAULT_RATE;
}

function consumeToken(ip: string, path: string, nowMs: number): boolean {
  const cfg = getRateLimitConfig(path);
  const key = `${ip}:${path.split("/")[1] ?? "general"}`;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: cfg.capacity, lastRefill: nowMs };
    buckets.set(key, bucket);
  }

  // Refill based on elapsed time
  const elapsed = (nowMs - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillRate);
  bucket.lastRefill = nowMs;

  if (bucket.tokens < 1) return false;

  bucket.tokens -= 1;
  return true;
}

function isBlockedUA(ua: string): boolean {
  return BLOCKED_UA_PATTERNS.some((re) => re.test(ua));
}

function shouldChallenge(path: string): boolean {
  return CAPTCHA_CHALLENGE_PATHS.some((p) => path.startsWith(p));
}

/**
 * Main EdgeWorker hook — returns true if the request should be allowed,
 * false if it was denied (response already set on the request object).
 */
export async function enforceRateLimit(
  request: EW.IngressClientRequest
): Promise<boolean> {
  const ua   = request.getHeader("User-Agent")?.[0] ?? "";
  const ip   = request.getVariable("PMUSER_TRUE_CLIENT_IP") ??
               request.getHeader("True-Client-IP")?.[0] ??
               request.getHeader("X-Forwarded-For")?.[0]?.split(",")[0]?.trim() ??
               "unknown";
  const path = request.path ?? "/";

  // 1. Blocked UA → 403 immediately
  if (isBlockedUA(ua)) {
    request.respondWith(403, { "Content-Type": "application/json" },
      JSON.stringify({ error: "Forbidden", reason: "blocked_ua" }));
    return false;
  }

  // 2. Token bucket check
  const allowed = consumeToken(ip, path, Date.now());

  if (!allowed) {
    // 3. CAPTCHA fall-through for some paths
    if (shouldChallenge(path)) {
      request.setVariable("PMUSER_CAPTCHA_REQUIRED", "true");
      // Let through so Akamai WAF / Bot Manager can inject challenge page
      request.addHeader("X-ATOM-Challenge", "required");
      return true;
    }

    // Hard rate-limit deny
    request.respondWith(429, {
      "Content-Type": "application/json",
      "Retry-After": "60",
      "X-RateLimit-Limit": String(getRateLimitConfig(path).capacity),
      "X-RateLimit-Remaining": "0",
    }, JSON.stringify({ error: "Too Many Requests" }));
    return false;
  }

  // Tag remaining capacity (informational)
  const key = `${ip}:${path.split("/")[1] ?? "general"}`;
  const bucket = buckets.get(key);
  if (bucket) {
    request.addHeader("X-RateLimit-Remaining", String(Math.floor(bucket.tokens)));
  }

  return true;
}

export { BLOCKED_UA_PATTERNS, getRateLimitConfig, consumeToken, isBlockedUA };
