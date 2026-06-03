/** Audit logging for ATOM Support actions. Writes to support_action_log. */
import { sbInsert } from "./supabase";

export interface AuditEntry {
  action: string;
  tenantId?: string | null;
  tenantSlug?: string | null;
  userId?: string | null;
  actorEmail?: string | null;
  resource?: string | null;
  result: "ok" | "denied" | "error" | "escalated";
  reason?: string | null;
  payload?: Record<string, any>;
}

export async function audit(entry: AuditEntry): Promise<void> {
  await sbInsert("support_action_log", {
    action: entry.action,
    tenant_id: entry.tenantId || null,
    tenant_slug: entry.tenantSlug || null,
    user_id: entry.userId || null,
    actor_email: entry.actorEmail || null,
    resource: entry.resource || null,
    result: entry.result,
    reason: entry.reason || null,
    payload: entry.payload || {},
  });
}
