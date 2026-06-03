#!/usr/bin/env node
/**
 * smoke-dial-gate — verifies the fail-CLOSED behavior of the pre-dial compliance
 * gate (api/_lib/dial-gate.ts) WITHOUT placing any real calls or hitting a real
 * compliance vendor. It stubs global.fetch to simulate each failure mode and
 * asserts the gate never returns decision="allow" unless the compliance service
 * explicitly returns { allowed: true }.
 *
 * Run:  npx tsx scripts/smoke-dial-gate.mjs
 *       (tsx resolves the .ts import directly)
 *
 * Exit code 0 = all assertions pass, 1 = a fail-open regression was detected.
 */
const ADMIN_KEY = "test-admin-key";
process.env.ADMIN_API_KEY = ADMIN_KEY;

const { evaluateDial } = await import("../api/_lib/dial-gate.ts");

const req = (overrides = {}) => ({
  headers: { host: "test.local", ...(overrides.headers || {}) },
  ...overrides,
});

let failures = 0;
function assert(name, cond) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}`);
    failures++;
  }
}

// Helper to stub fetch for a single evaluateDial call.
function withFetch(fn, run) {
  const orig = global.fetch;
  global.fetch = fn;
  return Promise.resolve(run()).finally(() => { global.fetch = orig; });
}

console.log("dial-gate fail-closed smoke tests:\n");

// 1. Missing tenant slug → block (never asks vendor)
{
  const r = await evaluateDial(req(), "+15551234567", "");
  assert("missing tenant slug blocks", r.decision === "block" && r.reason === "tenant_slug_missing");
}

// 2. Compliance vendor TIMEOUT / unreachable → block (default fallback)
process.env.ATOM_DIAL_FALLBACK_MODE = "block";
await withFetch(
  () => Promise.reject(new Error("ETIMEDOUT")),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("vendor timeout blocks (fallback=block)", r.decision === "block" && r.infraError === true);
  },
);

// 3. Compliance vendor 500 → block
await withFetch(
  () => Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("boom") }),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("vendor 500 blocks", r.decision === "block" && r.infraError === true);
  },
);

// 4. Malformed (non-JSON) response → block
await withFetch(
  () => Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("not json")) }),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("malformed response blocks", r.decision === "block" && r.reason === "compliance_malformed_response");
  },
);

// 5. Explicit compliance block (allowed:false) → block with reasons
await withFetch(
  () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ allowed: false, blockReasons: ["federal_dnc"] }) }),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("allowed:false blocks", r.decision === "block" && r.blockReasons?.[0] === "federal_dnc");
  },
);

// 6. allowed missing entirely → block (unknown result)
await withFetch(
  () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("missing allowed field blocks", r.decision === "block");
  },
);

// 7. Explicit positive decision → allow (the ONLY allow path)
await withFetch(
  () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ allowed: true, checks: {} }) }),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("allowed:true allows", r.decision === "allow" && r.httpStatus === 200);
  },
);

// 8. fallback=manual_review: vendor unreachable → manual_review (never allow)
process.env.ATOM_DIAL_FALLBACK_MODE = "manual_review";
await withFetch(
  () => Promise.reject(new Error("ECONNREFUSED")),
  async () => {
    const r = await evaluateDial(req(), "+15551234567", "acme");
    assert("vendor unreachable + fallback=manual_review → manual_review (not allow)",
      r.decision === "manual_review" && r.decision !== "allow");
  },
);

// 9. Missing ADMIN_API_KEY → never allow
process.env.ATOM_DIAL_FALLBACK_MODE = "block";
delete process.env.ADMIN_API_KEY;
{
  const r = await evaluateDial(req(), "+15551234567", "acme");
  assert("missing ADMIN_API_KEY blocks", r.decision !== "allow");
}
process.env.ADMIN_API_KEY = ADMIN_KEY;

console.log();
if (failures > 0) {
  console.error(`FAILED: ${failures} assertion(s) — fail-open regression detected.`);
  process.exit(1);
}
console.log("PASS: dial gate fails closed on every error/unknown path.");
