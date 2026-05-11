// Run with: npm test
// Uses node:test + tsx (no extra deps). Stubs global fetch to simulate
// Supabase (PostgREST) and Resend so the handler can be exercised end-to-end
// without network or DB.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://stub.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-key";
process.env.ADMIN_API_KEY = "stub-admin-key";
process.env.RESEND_API_KEY = "stub-resend-key";

const TENANT = {
  id: "tenant-1",
  slug: "acme",
  name: "Acme Inc",
  custom_domain: null as string | null,
};

interface FetchCall { url: string; method: string; body: any }
let calls: FetchCall[] = [];
let supabaseState: {
  tenant: typeof TENANT;
  existingAcceptedUser: boolean;
  pendingInvitesForEmail: number;
} = { tenant: TENANT, existingAcceptedUser: false, pendingInvitesForEmail: 0 };

function installFetchStub() {
  calls = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    // Resend
    if (url.startsWith("https://api.resend.com/emails")) {
      return new Response(JSON.stringify({ id: "email_stub_1" }), { status: 200 });
    }

    // Supabase PostgREST
    if (url.startsWith(process.env.SUPABASE_URL!)) {
      const path = url.slice(process.env.SUPABASE_URL!.length + "/rest/v1/".length);

      // tenants lookup by slug
      if (path.startsWith("tenants?slug=eq.")) {
        return new Response(JSON.stringify([supabaseState.tenant]), { status: 200 });
      }
      // tenant_users existing-accepted check
      if (path.startsWith("tenant_users?email=") && path.includes("accepted_at=not.is.null")) {
        return new Response(
          JSON.stringify(supabaseState.existingAcceptedUser ? [{ id: "u1", email: "x" }] : []),
          { status: 200 }
        );
      }
      // PATCH supersede pending invites
      if (method === "PATCH" && path.startsWith("tenant_invites?") && path.includes("accepted_at=is.null") && path.includes("revoked_at=is.null")) {
        const fakeRows = Array.from({ length: supabaseState.pendingInvitesForEmail }, (_, i) => ({ id: `inv-${i}` }));
        return new Response(JSON.stringify(fakeRows), { status: 200 });
      }
      // POST new invite
      if (method === "POST" && path === "tenant_invites") {
        return new Response(
          JSON.stringify([{ id: "new-invite-1", token: body.token, email: body.email, role: body.role }]),
          { status: 201 }
        );
      }
    }

    return new Response("not stubbed: " + url, { status: 500 });
  };
}

function mockReqRes(method: string, body: any = {}, query: any = {}) {
  const req: any = {
    method,
    body,
    query,
    headers: { "x-admin-key": "stub-admin-key", origin: "https://admin.atomdominator.com" },
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const res: any = {
    setHeader: () => {},
    status(c: number) { statusCode = c; return res; },
    json(b: any) { jsonBody = b; return res; },
    end() { return res; },
  };
  return { req, res, get statusCode() { return statusCode; }, get body() { return jsonBody; } };
}

test("tenantOrigin / buildInviteUrl / buildResetPasswordUrl", async () => {
  const mod = await import("./team.ts");
  assert.equal(mod.tenantOrigin({ slug: "acme", custom_domain: null }), "https://acme.atomdominator.com");
  assert.equal(mod.tenantOrigin({ slug: "acme", custom_domain: "go.acme.com" }), "https://go.acme.com");
  assert.equal(mod.tenantOrigin({ slug: "acme", custom_domain: "https://go.acme.com/" }), "https://go.acme.com");
  assert.equal(
    mod.buildInviteUrl({ slug: "acme", custom_domain: null }, "abc123"),
    "https://acme.atomdominator.com/#/invite/abc123"
  );
  assert.equal(
    mod.buildResetPasswordUrl({ slug: "acme", custom_domain: "go.acme.com" }, "m+test@akamai.com"),
    "https://go.acme.com/#/forgot-password?email=m%2Btest%40akamai.com"
  );
});

test("POST invite uses tenant canonical URL, not request origin", async () => {
  installFetchStub();
  supabaseState = { tenant: { ...TENANT, custom_domain: null }, existingAcceptedUser: false, pendingInvitesForEmail: 0 };
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "acme", email: "new@akamai.com", role: "rep" });
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 201);
  assert.equal(ctx.body.inviteUrl.startsWith("https://acme.atomdominator.com/#/invite/"), true,
    `expected canonical URL, got ${ctx.body.inviteUrl}`);
  const resendCall = calls.find(c => c.url.includes("api.resend.com"));
  assert.ok(resendCall, "should have called Resend");
  assert.ok(resendCall!.body.html.includes("acme.atomdominator.com"), "email html must contain tenant URL");
});

test("POST invite honors custom_domain when set", async () => {
  installFetchStub();
  supabaseState = { tenant: { ...TENANT, custom_domain: "portal.acme.io" }, existingAcceptedUser: false, pendingInvitesForEmail: 0 };
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "acme", email: "new@akamai.com", role: "rep" });
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 201);
  assert.equal(ctx.body.inviteUrl.startsWith("https://portal.acme.io/#/invite/"), true);
});

test("POST invite supersedes pending duplicates before issuing a new token", async () => {
  installFetchStub();
  supabaseState = { tenant: { ...TENANT, custom_domain: null }, existingAcceptedUser: false, pendingInvitesForEmail: 3 };
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "acme", email: "dupe@akamai.com", role: "rep" });
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 201);
  assert.equal(ctx.body.supersededInvites, 3);

  // Verify PATCH happened BEFORE POST new invite
  const patchIdx = calls.findIndex(c => c.method === "PATCH" && c.url.includes("tenant_invites"));
  const postIdx = calls.findIndex(c => c.method === "POST" && c.url.endsWith("/tenant_invites"));
  assert.ok(patchIdx >= 0, "should PATCH old invites");
  assert.ok(postIdx >= 0, "should POST new invite");
  assert.ok(patchIdx < postIdx, "supersede must run before issuing new token");
});

test("POST invite for an existing accepted user routes to reset-password (no new invite, no password exposure)", async () => {
  installFetchStub();
  supabaseState = { tenant: { ...TENANT, custom_domain: null }, existingAcceptedUser: true, pendingInvitesForEmail: 0 };
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "acme", email: "mpare@akamai.com", role: "rep" });
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 200);
  assert.equal(ctx.body.existingUser, true);
  assert.equal(ctx.body.resetPasswordUrl, "https://acme.atomdominator.com/#/forgot-password?email=mpare%40akamai.com");

  // Must NOT create a new invite row
  const insertedInvite = calls.find(c => c.method === "POST" && c.url.endsWith("/tenant_invites"));
  assert.equal(insertedInvite, undefined, "must not create a new invite for existing accepted users");

  // The email body must not contain anything that looks like a password leak
  const resendCall = calls.find(c => c.url.includes("api.resend.com"));
  assert.ok(resendCall, "should have sent reset email");
  assert.ok(!/password\s*[:=]\s*\S+/i.test(resendCall!.body.text || ""), "must not include a literal password in email text");
  assert.ok(resendCall!.body.subject.toLowerCase().includes("reset"), "subject should mention reset");
});

test("POST rejects unknown tenant", async () => {
  installFetchStub();
  supabaseState = { tenant: undefined as any, existingAcceptedUser: false, pendingInvitesForEmail: 0 };
  // Make tenants lookup return []
  const realFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    if (url.includes("tenants?slug=eq.")) return new Response("[]", { status: 200 });
    return realFetch(url, init);
  };
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "ghost", email: "x@y.com", role: "rep" });
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 404);
});

test("POST rejects missing admin key", async () => {
  installFetchStub();
  const mod = await import("./team.ts");
  const ctx = mockReqRes("POST", { tenantSlug: "acme", email: "x@y.com", role: "rep" });
  ctx.req.headers["x-admin-key"] = "wrong";
  await mod.default(ctx.req, ctx.res);
  assert.equal(ctx.statusCode, 401);
});
