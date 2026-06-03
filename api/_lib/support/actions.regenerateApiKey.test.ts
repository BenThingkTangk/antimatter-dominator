/**
 * Targeted test for the security-critical ordering in regenerate_api_key.
 *
 * No project-wide test runner is configured (no vitest/jest in package.json),
 * so this is a self-contained script runnable with the repo's `tsx` dependency:
 *
 *   npx tsx api/_lib/support/actions.regenerateApiKey.test.ts
 *
 * It mocks global fetch to drive the Supabase REST helper and asserts:
 *   1. Happy path: new key is INSERTED before any revoke PATCH, and the
 *      returned response carries the one-time plaintext key.
 *   2. Persistence failure (insert returns non-2xx → sbInsert yields null):
 *      NO revoke PATCH is issued, the response is ok:false and does NOT expose
 *      a new key, and an error audit row is written.
 */
import assert from "node:assert";

// Env must be set BEFORE importing actions.ts (module-level reads).
process.env.ATOM_SUPPORT_ENABLE_ACTIONS = "true";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

type Call = { method: string; path: string; body: any };

interface FetchScript {
  /** Return [status, jsonBody] for a given request, or throw to simulate network error. */
  (call: Call): [number, any];
}

let calls: Call[] = [];

function installFetch(script: FetchScript) {
  calls = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const path = String(url).replace("https://example.supabase.co/rest/v1/", "");
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call: Call = { method, path, body };
    calls.push(call);
    const [status, json] = script(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (json === undefined ? "" : JSON.stringify(json)),
    } as any;
  };
}

const session = {
  authenticated: true,
  userId: "user-1",
  tenantId: "tenant-1",
  tenantSlug: "acme",
  email: "owner@acme.test",
  fullName: "Owner",
} as any;

async function run() {
  const { runAction } = await import("./actions");

  // ── Case 1: happy path ─────────────────────────────────────────────────────
  installFetch(({ method, path }) => {
    if (method === "POST" && path.startsWith("tenant_api_keys")) {
      // Insert succeeds → return the persisted row (return=representation).
      return [201, [{ id: "key-new", key_prefix: "atom_sk_xxxx" }]];
    }
    if (method === "PATCH" && path.startsWith("tenant_api_keys")) {
      return [204, undefined]; // revoke old keys
    }
    if (method === "POST" && path.startsWith("support_action_log")) {
      return [201, [{ id: "audit-1" }]];
    }
    return [200, []];
  });

  const ok = await runAction("regenerate_api_key", session);

  const keyCalls = calls.filter((c) => c.path.startsWith("tenant_api_keys"));
  const insertIdx = keyCalls.findIndex((c) => c.method === "POST");
  const revokeIdx = keyCalls.findIndex((c) => c.method === "PATCH");
  assert.ok(insertIdx >= 0, "expected an INSERT of the new key");
  assert.ok(revokeIdx >= 0, "expected a revoke PATCH on success");
  assert.ok(insertIdx < revokeIdx, "INSERT of new key MUST precede revoke of old key");
  assert.equal(ok.ok, true, "happy path should report success");
  assert.equal(ok.data?.apiKey?.startsWith("atom_sk_"), true, "one-time plaintext key returned");
  // Revoke must exclude the freshly-inserted key id.
  assert.ok(
    keyCalls[revokeIdx].path.includes("id=neq.key-new"),
    "revoke must exclude the newly inserted key id",
  );
  console.log("PASS case 1: insert-before-revoke + one-time key returned");

  // ── Case 2: persistence fails (insert returns error → sbInsert => null) ──────
  installFetch(({ method, path }) => {
    if (method === "POST" && path.startsWith("tenant_api_keys")) {
      return [500, { message: "db down" }]; // insert fails → sbInsert returns null
    }
    if (method === "PATCH" && path.startsWith("tenant_api_keys")) {
      return [204, undefined];
    }
    if (method === "POST" && path.startsWith("support_action_log")) {
      return [201, [{ id: "audit-2" }]];
    }
    return [200, []];
  });

  const fail = await runAction("regenerate_api_key", session);

  const revokeAfterFail = calls.filter(
    (c) => c.method === "PATCH" && c.path.startsWith("tenant_api_keys"),
  );
  assert.equal(revokeAfterFail.length, 0, "MUST NOT revoke the old key when persistence fails");
  assert.equal(fail.ok, false, "failed persistence must not claim success");
  assert.equal(fail.data?.apiKey, undefined, "failed persistence must NOT expose a new key");
  const auditRows = calls.filter(
    (c) => c.method === "POST" && c.path.startsWith("support_action_log"),
  );
  assert.ok(
    auditRows.some((c) => c.body?.result === "error" && c.body?.reason === "new_key_persist_failed"),
    "an error audit row must be written on persistence failure",
  );
  console.log("PASS case 2: persistence failure is safe (no revoke, no leaked key, audited)");

  console.log("\nALL TESTS PASSED");
}

run().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
