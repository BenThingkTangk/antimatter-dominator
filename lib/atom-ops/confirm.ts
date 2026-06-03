/**
 * ConfirmationStore — holds pending destructive operations between the
 * "plan" and "execute" phases of the Plan → Confirm → Execute pattern.
 *
 * Persistence model:
 *   - In production/serverless, Supabase-backed persistence
 *     (ops_pending_confirmations) is REQUIRED. A plan that cannot be persisted
 *     surfaces as an error rather than living only in one instance's memory —
 *     otherwise the confirm/execute request (which may land on a different
 *     instance) would silently fail to find the plan.
 *   - In development, an in-memory Map is an acceptable fallback when Supabase
 *     is not configured.
 * Pending ops expire after 5 minutes regardless of backend.
 */
import crypto from "crypto";
import { isProduction } from "./env";
import { logger } from "./logger";
import { isSupabaseConfigured, sbRest } from "./supabase-rest";
import { errMessage, type ConfirmationPlan } from "./types";

const log = logger.child({ component: "confirm" });

export const CONFIRM_TTL_MS = 5 * 60 * 1000;

const memory = new Map<string, ConfirmationPlan>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, plan] of Array.from(memory.entries())) {
    if (plan.expiresAt <= now) memory.delete(id);
  }
}

export function newConfirmationId(): string {
  return crypto.randomBytes(12).toString("hex");
}

export interface CreatePlanInput {
  intent: string;
  tool: string;
  action: string;
  summary: string;
  params: Record<string, unknown>;
  actorEmail: string;
  source: ConfirmationPlan["source"];
  sessionId: string;
}

export async function createPlan(input: CreatePlanInput): Promise<ConfirmationPlan> {
  purgeExpired();
  const now = Date.now();
  const plan: ConfirmationPlan = {
    confirmationId: newConfirmationId(),
    intent: input.intent,
    tool: input.tool,
    action: input.action,
    destructive: true,
    summary: input.summary,
    params: input.params,
    createdAt: now,
    expiresAt: now + CONFIRM_TTL_MS,
    actorEmail: input.actorEmail,
    source: input.source,
    sessionId: input.sessionId,
  };
  memory.set(plan.confirmationId, plan);

  // In production/serverless, persistence is REQUIRED: confirm/execute may land
  // on a different instance, so a memory-only plan would be unredeemable. A
  // failure here must surface, not be swallowed.
  if (isProduction() && !isSupabaseConfigured()) {
    throw new Error(
      "ATOM Ops confirmation persistence requires Supabase in production " +
        "(SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). Apply sql/020-atom-ops-tables.sql " +
        "and configure env before enabling destructive ops.",
    );
  }

  if (isSupabaseConfigured()) {
    try {
      await sbRest("ops_pending_confirmations", {
        method: "POST",
        headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
        body: JSON.stringify({
          confirmation_id: plan.confirmationId,
          intent: plan.intent,
          tool: plan.tool,
          action: plan.action,
          summary: plan.summary,
          params: plan.params,
          actor_email: plan.actorEmail,
          source: plan.source,
          session_id: plan.sessionId,
          created_at: new Date(plan.createdAt).toISOString(),
          expires_at: new Date(plan.expiresAt).toISOString(),
        }),
      });
    } catch (e) {
      // In production a failed persist means the plan is unredeemable across
      // instances — surface it. In development we tolerate it (warm-instance
      // memory still works) for a missing table during local iteration.
      if (isProduction()) {
        log.error({ err: errMessage(e) }, "pending-confirmation persist failed");
        memory.delete(plan.confirmationId);
        throw new Error(
          `Failed to persist pending confirmation: ${errMessage(e)}. ` +
            "Ensure sql/020-atom-ops-tables.sql has been applied.",
        );
      }
      log.debug({ err: errMessage(e) }, "pending-confirmation persist skipped (dev)");
    }
  }
  return plan;
}

export async function getPlan(confirmationId: string): Promise<ConfirmationPlan | null> {
  purgeExpired();
  const local = memory.get(confirmationId);
  if (local) {
    return local.expiresAt > Date.now() ? local : null;
  }
  if (isSupabaseConfigured()) {
    try {
      const rows = await sbRest<
        Array<{
          confirmation_id: string;
          intent: string;
          tool: string;
          action: string;
          summary: string;
          params: Record<string, unknown>;
          actor_email: string;
          source: ConfirmationPlan["source"];
          session_id: string;
          created_at: string;
          expires_at: string;
        }>
      >(
        `ops_pending_confirmations?confirmation_id=eq.${encodeURIComponent(confirmationId)}&select=*&limit=1`,
      );
      const row = rows?.[0];
      if (!row) return null;
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt <= Date.now()) return null;
      const plan: ConfirmationPlan = {
        confirmationId: row.confirmation_id,
        intent: row.intent,
        tool: row.tool,
        action: row.action,
        destructive: true,
        summary: row.summary,
        params: row.params || {},
        actorEmail: row.actor_email,
        source: row.source ?? "console",
        sessionId: row.session_id ?? "",
        createdAt: new Date(row.created_at).getTime(),
        expiresAt,
      };
      memory.set(plan.confirmationId, plan);
      return plan;
    } catch (e) {
      // In production the DB is the source of truth; a lookup failure must not
      // masquerade as "not found" (which would let a retry silently re-plan).
      if (isProduction()) {
        log.error({ err: errMessage(e) }, "pending-confirmation lookup failed");
        throw new Error(`Failed to load pending confirmation: ${errMessage(e)}`);
      }
      log.debug({ err: errMessage(e) }, "pending-confirmation lookup skipped (dev)");
    }
  }
  return null;
}

export async function consumePlan(confirmationId: string): Promise<ConfirmationPlan | null> {
  const plan = await getPlan(confirmationId);
  if (plan) await deletePlan(confirmationId);
  return plan;
}

export async function deletePlan(confirmationId: string): Promise<void> {
  memory.delete(confirmationId);
  if (isSupabaseConfigured()) {
    try {
      await sbRest(
        `ops_pending_confirmations?confirmation_id=eq.${encodeURIComponent(confirmationId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } },
      );
    } catch (e) {
      log.debug({ err: errMessage(e) }, "pending-confirmation delete skipped");
    }
  }
}

/** Test/diagnostic helper. */
export function _memorySize(): number {
  purgeExpired();
  return memory.size;
}
