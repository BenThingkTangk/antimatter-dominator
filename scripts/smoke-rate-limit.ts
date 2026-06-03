#!/usr/bin/env node
/**
 * smoke-rate-limit — verifies the in-memory fallback of api/_lib/rate-limit.ts
 * throttles after the configured limit and resets after the window. Does not
 * require Upstash (asserts the conservative best-effort path).
 *
 * Run:  npx tsx scripts/smoke-rate-limit.ts
 */
import { rateLimit } from "../api/_lib/rate-limit.ts";

const req = (ip = "1.2.3.4") => ({
  headers: { "x-forwarded-for": ip },
  socket: { remoteAddress: ip },
}) as any;

let failures = 0;
function assert(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name}`); failures++; }
}

console.log("rate-limit in-memory smoke tests:\n");

// Limit 3 per 1s window for a fresh client.
const opts = { key: "smoke", limit: 3, windowSec: 1 };
const r1 = await rateLimit(req(), opts);
const r2 = await rateLimit(req(), opts);
const r3 = await rateLimit(req(), opts);
const r4 = await rateLimit(req(), opts);

assert("1st request allowed", r1.allowed === true);
assert("2nd request allowed", r2.allowed === true);
assert("3rd request allowed (at limit)", r3.allowed === true);
assert("4th request blocked (over limit)", r4.allowed === false);
assert("remaining decrements", r1.remaining === 2 && r2.remaining === 1);

// Different client is independent.
const other = await rateLimit(req("9.9.9.9"), opts);
assert("different client gets fresh bucket", other.allowed === true);

// After window expiry the bucket resets.
await new Promise((res) => setTimeout(res, 1100));
const r5 = await rateLimit(req(), opts);
assert("request allowed again after window reset", r5.allowed === true);

console.log();
if (failures > 0) {
  console.error(`FAILED: ${failures} assertion(s).`);
  process.exit(1);
}
console.log("PASS: rate limiter throttles over-limit bursts and resets per window.");
