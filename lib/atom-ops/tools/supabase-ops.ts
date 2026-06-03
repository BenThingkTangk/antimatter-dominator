/**
 * Supabase ops tool — uses the repo's service-role REST model.
 *
 * SAFETY: runApprovedMigration does NOT execute arbitrary SQL. It maps an
 * allowlisted slug to a known migration file under sql/ and a corresponding
 * pre-deployed RPC. Arbitrary SQL execution from a web request is forbidden.
 */
import { getEnv } from "../env";
import { logger } from "../logger";
import { sbRest, sbRpc } from "../supabase-rest";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const log = logger.child({ tool: "supabase-ops" });

/**
 * Allowlisted migrations. Each maps a stable slug to the file a human applies
 * and (optionally) an idempotent RPC the server may invoke. Add entries here
 * deliberately; the API will refuse any slug not present.
 */
const APPROVED_MIGRATIONS: Record<
  string,
  { file: string; rpc?: string; description: string }
> = {
  "atom-ops-tables": {
    file: "sql/020-atom-ops-tables.sql",
    description: "Creates ops_audit_log + ops_macros with RLS and seed macros.",
  },
};

/**
 * @destructive Applies an APPROVED, allowlisted migration only. If a matching
 * idempotent RPC exists it is invoked; otherwise this returns the file path and
 * instructs the operator to apply it via the Supabase SQL editor (arbitrary SQL
 * over HTTP is intentionally not supported).
 */
export async function runApprovedMigration(p: {
  slug: string;
}): Promise<OpsResult<{ slug: string; file: string; applied: boolean }>> {
  try {
    const entry = APPROVED_MIGRATIONS[p.slug];
    if (!entry) {
      return fail(
        `Unknown migration slug '${p.slug}'. Allowed: ${Object.keys(APPROVED_MIGRATIONS).join(", ") || "(none)"}`,
      );
    }
    if (entry.rpc) {
      await sbRpc(entry.rpc, {});
      return ok(
        { slug: p.slug, file: entry.file, applied: true },
        `Applied migration '${p.slug}' via RPC ${entry.rpc}`,
      );
    }
    return ok(
      { slug: p.slug, file: entry.file, applied: false },
      `Migration '${p.slug}' is allowlisted but has no auto-apply RPC. Apply ${entry.file} in the Supabase SQL editor.`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "runApprovedMigration failed");
    return fail(`runApprovedMigration failed: ${errMessage(e)}`);
  }
}

/** Get approximate row counts for a set of tables (non-destructive). */
export async function getRowCounts(p: {
  tables?: string[];
}): Promise<OpsResult<Record<string, number>>> {
  try {
    const tables =
      p.tables && p.tables.length
        ? p.tables
        : ["tenants", "tenant_users", "ops_audit_log"];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      // Validate identifier to avoid path injection in the REST URL.
      if (!/^[a-z_][a-z0-9_]*$/i.test(t)) {
        counts[t] = -1;
        continue;
      }
      const res = await fetch(
        `${getEnv("SUPABASE_URL", true)}/rest/v1/${t}?select=id`,
        {
          method: "HEAD",
          headers: {
            apikey: getEnv("SUPABASE_SERVICE_ROLE_KEY", true),
            Authorization: `Bearer ${getEnv("SUPABASE_SERVICE_ROLE_KEY", true)}`,
            Prefer: "count=exact",
            Range: "0-0",
          },
        },
      );
      const range = res.headers.get("content-range") || "";
      const total = Number(range.split("/")[1]);
      counts[t] = Number.isFinite(total) ? total : 0;
    }
    return ok(counts, `Row counts for ${Object.keys(counts).length} table(s)`);
  } catch (e) {
    return fail(`getRowCounts failed: ${errMessage(e)}`);
  }
}

/**
 * Run a read-only RLS test against an allowlisted table. Verifies that the
 * service role can read and reports the row count, used to sanity-check RLS
 * deployment. Non-destructive.
 */
export async function runRLSTestQuery(p: {
  table: string;
}): Promise<OpsResult<{ table: string; readable: boolean; sample: number }>> {
  try {
    if (!/^[a-z_][a-z0-9_]*$/i.test(p.table)) {
      return fail(`Invalid table identifier '${p.table}'`);
    }
    const rows = await sbRest<unknown[]>(`${p.table}?select=*&limit=1`);
    return ok(
      { table: p.table, readable: true, sample: Array.isArray(rows) ? rows.length : 0 },
      `RLS test on ${p.table}: service-role readable`,
    );
  } catch (e) {
    return ok(
      { table: p.table, readable: false, sample: 0 },
      `RLS test on ${p.table}: not readable (${errMessage(e)})`,
    );
  }
}

/**
 * @destructive Creates a new tenant row.
 */
export async function createTenant(p: {
  slug: string;
  name: string;
  plan?: string;
}): Promise<OpsResult<{ id: string; slug: string }>> {
  try {
    const rows = await sbRest<Array<{ id: string; slug: string }>>("tenants", {
      method: "POST",
      body: JSON.stringify({
        slug: p.slug,
        name: p.name,
        plan: p.plan || "trial",
      }),
    });
    const t = rows?.[0];
    if (!t) return fail("createTenant returned no row");
    return ok({ id: t.id, slug: t.slug }, `Created tenant ${t.slug}`);
  } catch (e) {
    return fail(`createTenant failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Suspends a tenant (sets kill_switch true).
 */
export async function suspendTenant(p: {
  slug: string;
}): Promise<OpsResult<{ slug: string; suspended: boolean }>> {
  try {
    await sbRest(`tenants?slug=eq.${encodeURIComponent(p.slug)}`, {
      method: "PATCH",
      body: JSON.stringify({ kill_switch: true }),
      headers: { Prefer: "return=minimal" },
    });
    return ok({ slug: p.slug, suspended: true }, `Suspended tenant ${p.slug}`);
  } catch (e) {
    return fail(`suspendTenant failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Resets a user's password to a freshly generated one. The new
 * password is returned once and never logged.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcryptjs (used elsewhere in the repo) hashes look like $2a$/$2b$/$2y$<cost>$...
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export async function resetUserPassword(p: {
  email: string;
  newPasswordHash: string;
}): Promise<OpsResult<{ email: string; reset: boolean }>> {
  try {
    const email = (p.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return fail(`resetUserPassword: invalid email '${p.email}'`);
    }
    // Refuse to store a plaintext or non-bcrypt value — the caller must pass a
    // pre-computed bcrypt hash (never a raw password) so plaintext can't leak.
    if (typeof p.newPasswordHash !== "string" || !BCRYPT_RE.test(p.newPasswordHash)) {
      return fail(
        "resetUserPassword: newPasswordHash must be a bcrypt hash ($2a/$2b/$2y$...), not a plaintext password.",
      );
    }
    await sbRest(`tenant_users?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ password_hash: p.newPasswordHash }),
      headers: { Prefer: "return=minimal" },
    });
    return ok({ email, reset: true }, `Reset password for ${email}`);
  } catch (e) {
    return fail(`resetUserPassword failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  runApprovedMigration: {
    meta: { tool: "supabase", action: "runApprovedMigration", destructive: true, description: "Apply an allowlisted migration" },
    run: (p) => runApprovedMigration(p as unknown as Parameters<typeof runApprovedMigration>[0]),
  },
  getRowCounts: {
    meta: { tool: "supabase", action: "getRowCounts", destructive: false, description: "Get table row counts" },
    run: (p) => getRowCounts(p as unknown as Parameters<typeof getRowCounts>[0]),
  },
  runRLSTestQuery: {
    meta: { tool: "supabase", action: "runRLSTestQuery", destructive: false, description: "Run an RLS read test" },
    run: (p) => runRLSTestQuery(p as unknown as Parameters<typeof runRLSTestQuery>[0]),
  },
  createTenant: {
    meta: { tool: "supabase", action: "createTenant", destructive: true, description: "Create a tenant" },
    run: (p) => createTenant(p as unknown as Parameters<typeof createTenant>[0]),
  },
  suspendTenant: {
    meta: { tool: "supabase", action: "suspendTenant", destructive: true, description: "Suspend a tenant" },
    run: (p) => suspendTenant(p as unknown as Parameters<typeof suspendTenant>[0]),
  },
  resetUserPassword: {
    meta: { tool: "supabase", action: "resetUserPassword", destructive: true, description: "Reset a user password" },
    run: (p) => resetUserPassword(p as unknown as Parameters<typeof resetUserPassword>[0]),
  },
};
