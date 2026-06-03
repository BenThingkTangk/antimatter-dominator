/**
 * ATOM Ops audit log — append-only, tamper-evident via SHA-256 chaining.
 * Mirrors the chaining approach in api/_lib/admin.ts (appendAuditLog) but
 * targets the ops_audit_log table and the ATOM Ops field set.
 *
 * Writes are best-effort: a Supabase outage must not block an operator action
 * from being attempted, but every attempt is logged locally (logger) too.
 */
import crypto from "crypto";
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

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
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

  let priorHash = "";
  if (isSupabaseConfigured()) {
    try {
      const prior = await sbRest<Array<{ entry_hash: string }>>(
        "ops_audit_log?select=entry_hash&order=created_at.desc&limit=1",
      );
      priorHash = Array.isArray(prior) && prior[0]?.entry_hash ? prior[0].entry_hash : "";
    } catch (e) {
      log.warn({ err: errMessage(e) }, "could not read prior audit hash");
    }
  }

  const canonical = JSON.stringify({
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
    prior_hash: priorHash,
  });
  const entryHash = sha256(canonical);

  // Always emit to the structured logger as a durable secondary record.
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

  if (isSupabaseConfigured()) {
    try {
      await sbRest("ops_audit_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
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
          prior_hash: priorHash,
          entry_hash: entryHash,
        }),
      });
    } catch (e) {
      log.error({ err: errMessage(e) }, "ops_audit_log write failed");
    }
  }

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
