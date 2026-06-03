/**
 * ConfirmationStore — holds pending destructive operations between the
 * "plan" and "execute" phases of the Plan → Confirm → Execute pattern.
 *
 * In-memory by default (Map), with OPTIONAL Supabase persistence so a pending
 * op survives a serverless cold start / instance hop. Pending ops expire after
 * 5 minutes regardless of backend.
 */
import crypto from "crypto";
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
  };
  memory.set(plan.confirmationId, plan);

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
          created_at: new Date(plan.createdAt).toISOString(),
          expires_at: new Date(plan.expiresAt).toISOString(),
        }),
      });
    } catch (e) {
      // Persistence is optional — table may not exist. In-memory still works
      // within a warm instance.
      log.debug({ err: errMessage(e) }, "pending-confirmation persist skipped");
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
        createdAt: new Date(row.created_at).getTime(),
        expiresAt,
      };
      memory.set(plan.confirmationId, plan);
      return plan;
    } catch (e) {
      log.debug({ err: errMessage(e) }, "pending-confirmation lookup skipped");
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
