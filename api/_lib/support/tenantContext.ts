/**
 * Safe tenant-context adapter. Produces a SUMMARIZED view of tenant state for
 * the support agent — never raw DB rows, never secrets. Pulls:
 *   - plan/tier, role, billing routing status (safe, non-sensitive)
 *   - most recent campaign + status (diagnostic for "why did my campaign fail?")
 *   - recent diagnostic errors from Sentry (if configured)
 *
 * Everything is best-effort: any failure degrades to a partial summary rather
 * than blocking the chat reply.
 */
import { sb, supabaseConfigured } from "./supabase.js";
import { planToTier } from "./tone.js";
import { recentSentryErrors } from "./diagnostics.js";
import type { TenantContextSummary } from "./types.js";
import type { ResolvedSession } from "./auth.js";

export async function buildTenantContext(session: ResolvedSession): Promise<TenantContextSummary> {
  const tier = planToTier(session.plan);
  if (!session.authenticated || !session.tenantId) {
    return { tier: "public" };
  }

  const ctx: TenantContextSummary = {
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
    userId: session.userId,
    userEmail: session.email,
    role: session.role,
    plan: session.plan,
    tier,
    usageLevel: "unknown",
    recentCampaign: null,
    recentErrors: [],
    billingStatus: safeBillingStatus(session.subscriptionStatus),
  };

  if (!supabaseConfigured()) return ctx;

  // Most recent campaign for this tenant (status only — no row dump).
  try {
    const rows = await sb(
      `campaigns?tenant_id=eq.${session.tenantId}&select=name,status,updated_at&order=updated_at.desc&limit=1`,
    );
    const c = Array.isArray(rows) ? rows[0] : null;
    if (c) ctx.recentCampaign = { name: c.name, status: c.status, updatedAt: c.updated_at };
  } catch {
    // campaigns may be keyed differently per deployment; ignore quietly.
  }

  // Coarse usage level from call volume (last 30d), bucketed — never exact counts.
  try {
    const rows = await sb(
      `tenant_calls?tenant_id=eq.${session.tenantId}&select=id&limit=200`,
    );
    const n = Array.isArray(rows) ? rows.length : 0;
    ctx.usageLevel = n > 100 ? "high" : n > 20 ? "medium" : n > 0 ? "low" : "unknown";
  } catch {
    /* ignore */
  }

  // Recent diagnostic errors (Sentry) — summarized titles only.
  try {
    ctx.recentErrors = await recentSentryErrors(session.tenantSlug);
  } catch {
    ctx.recentErrors = [];
  }

  return ctx;
}

/** Collapse Stripe statuses to a safe routing-level label. Never amounts/dates. */
function safeBillingStatus(s: string | undefined): string | undefined {
  const v = (s || "").toLowerCase();
  if (!v) return undefined;
  if (["active", "trialing"].includes(v)) return v;
  if (["past_due", "unpaid", "incomplete"].includes(v)) return "past_due";
  if (["canceled", "cancelled"].includes(v)) return "canceled";
  return "active";
}
