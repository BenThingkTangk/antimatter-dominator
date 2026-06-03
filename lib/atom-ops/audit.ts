/**
 * ATOM Ops audit log — append-only, tamper-evident via SHA-256 chaining.
 *
 * The hash chain (prior_hash + entry_hash) is computed ATOMICALLY in a Postgres
 * BEFORE INSERT trigger (public.ops_audit_chain in sql/020-atom-ops-tables.sql),
 * serialized by a per-table advisory transaction lock. The application MUST NOT
 * compute the chain itself — doing so reintroduces a read→compute→insert race
 * between concurrent inserters. We just send the event fields and read back the
 * DB-computed entry_hash as a receipt.
 *
 * Writes are best-effort: a Supabase outage must not block an operator action
 * from being attempted, but every attempt is logged locally (logger) too.
 */
import { logger } from "./logger";
import { isSupabaseConfigured, sbRest } from "./supabase-rest";
import { errMessage, type OpsSource } from "./types";

const log = logger.child({ component: "audit" });

export interface AuditEntry {
  actorEmail: string;
  actorRole?: string | null;
  intent: string;
  tool?: string | null;
  action?: string | null;
  destructive?: boolean;
  phase: "plan" | "confirm" | "execute" | "cancel" | "error";
  result?: "ok" | "blocked" | "error";
  summary?: string | null;
  params?: Record<string, unknown>;
  data?: unknown;
  reason?: string | null;
  source: OpsSource;
  confirmationId?: string | null;
}

/** Keys redacted out of persisted params/data so secrets never land in the log. */
const SECRET_KEYS = new Set([
  "value",
  "newPasswordHash",
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
]);

function redactDeep(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(redactDeep);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.has(k) ? "[redacted]" : redactDeep(v);
    }
    return out;
  }
  return input;
}

/**
 * Append an audit entry. Returns the computed entry hash (also when the remote
 * write is skipped/failed, so callers always get a deterministic receipt).
 */
export async function appendOpsAudit(entry: AuditEntry): Promise<{ entryHash: string }> {
  const params = redactDeep(entry.params ?? {}) as Record<string, unknown>;
  const data = redactDeep(entry.data ?? null);

  // Always emit to the structured logger as a durable secondary record. The
  // tamper-evident entryHash is assigned by the DB trigger; "" here means the
  // remote write was skipped or failed (still logged locally).
  let entryHash = "";

  if (isSupabaseConfigured()) {
    try {
      // The BEFORE INSERT trigger computes prior_hash + entry_hash atomically
      // under an advisory xact lock. We send ONLY the event fields and read the
      // computed entry_hash back as a receipt (return=representation).
      const rows = await sbRest<Array<{ entry_hash: string }>>("ops_audit_log", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          actor_email: entry.actorEmail,
          actor_role: entry.actorRole ?? null,
          intent: entry.intent,
          tool: entry.tool ?? null,
          action: entry.action ?? null,
          destructive: entry.destructive ?? false,
          phase: entry.phase,
          result: entry.result ?? "ok",
          summary: entry.summary ?? null,
          params,
          data,
          reason: entry.reason ?? null,
          source: entry.source,
          confirmation_id: entry.confirmationId ?? null,
        }),
      });
      entryHash = Array.isArray(rows) && rows[0]?.entry_hash ? rows[0].entry_hash : "";
    } catch (e) {
      log.error({ err: errMessage(e) }, "ops_audit_log write failed");
    }
  }

  log.info(
    {
      actor: entry.actorEmail,
      intent: entry.intent,
      phase: entry.phase,
      result: entry.result ?? "ok",
      destructive: entry.destructive ?? false,
      entryHash,
    },
    "ops-audit",
  );

  return { entryHash };
}

/** Read recent audit rows for the console table. */
export async function readRecentAudit(limit = 50): Promise<unknown[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const rows = await sbRest<unknown[]>(
      `ops_audit_log?select=*&order=created_at.desc&limit=${Math.min(limit, 200)}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    log.warn({ err: errMessage(e) }, "readRecentAudit failed");
    return [];
  }
}
