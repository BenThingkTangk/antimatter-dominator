/**
 * Entitlement enforcement gate — imported by every metered API endpoint.
 *
 * Maps high-level entitlement keys to PLAN_TIERS caps from shared/seat-cost-model.
 * Usage is tracked in a Supabase `usage_events` table per billing period.
 *
 * Supabase table (create if not exists):
 *   usage_events (
 *     id uuid pk default gen_random_uuid(),
 *     tenant_id uuid not null,
 *     entitlement text not null,
 *     qty integer default 1,
 *     metadata jsonb,
 *     created_at timestamptz default now()
 *   )
 */
import { PLAN_TIERS } from "../../shared/seat-cost-model";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

export type Entitlement =
  | "voice"
  | "campaign_voice"
  | "sms"
  | "email"
  | "pitch"
  | "objection"
  | "warbook"
  | "warroom"
  | "leadgen"
  | "signal";

// Maps entitlement keys to the caps field on PlanTier
const CAP_MAP: Record<Entitlement, keyof NonNullable<typeof PLAN_TIERS[0]["caps"]>> = {
  voice: "dialMinutesPerSeat",
  campaign_voice: "campaignMinutesPerSeat",
  sms: "smsPerSeat",
  email: "emailsPerSeat",
  pitch: "pitchesPerSeat",
  objection: "pitchesPerSeat",       // shares pitch cap
  warbook: "warbookQueriesPerSeat",
  warroom: "warroomAnalysesPerSeat",
  leadgen: "prospectEnrichmentsPerSeat",
  signal: "signalQueriesPerSeat",
};

// ── Tenant cache (30s TTL) ────────────────────────────────
interface CachedTenant {
  data: any;
  fetchedAt: number;
}
const tenantCache = new Map<string, CachedTenant>();
const CACHE_TTL_MS = 30_000;

async function loadTenant(tenantId: string): Promise<any> {
  const cached = tenantCache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data;

  const rows = await sb(
    `tenants?id=eq.${encodeURIComponent(tenantId)}&select=id,plan,seats,subscription_status,trial_ends_at,stripe_subscription_id,kill_switch`
  );
  const tenant = Array.isArray(rows) ? rows[0] : null;
  if (tenant) {
    tenantCache.set(tenantId, { data: tenant, fetchedAt: Date.now() });
  }
  return tenant;
}

export interface EntitlementResult {
  allowed: boolean;
  reason?: "plan_cap_exceeded" | "plan_does_not_include" | "subscription_inactive" | "trial_expired" | "suspended";
  used?: number;
  cap?: number;
  plan?: string;
}

export async function checkEntitlement(
  tenantId: string,
  entitlement: Entitlement,
): Promise<EntitlementResult> {
  const tenant = await loadTenant(tenantId);
  if (!tenant) return { allowed: false, reason: "subscription_inactive" };

  const status = tenant.subscription_status;

  // Hard cutoff: kill_switch is set by the billing webhook (past_due / canceled /
  // unpaid) and by the trial-rollover cron (expired trial with no Stripe sub).
  // A suspended tenant loses all paid/metered access immediately. This only gates
  // metered product endpoints — public auth flows never call checkEntitlement.
  if (tenant.kill_switch === true) {
    return { allowed: false, reason: "suspended", plan: tenant.plan };
  }

  // Cancelled → blocked
  if (status === "canceled" || status === "cancelled") {
    return { allowed: false, reason: "subscription_inactive", plan: tenant.plan };
  }

  // Past due → blocked. Billing state sets kill_switch alongside past_due, but we
  // also block on the status directly so a suspended/past_due tenant loses paid
  // access even if kill_switch was not yet propagated.
  if (status === "past_due" || status === "unpaid") {
    return { allowed: false, reason: "suspended", plan: tenant.plan };
  }

  // Trial expired check
  if (status === "trialing" && tenant.trial_ends_at) {
    if (new Date(tenant.trial_ends_at) < new Date()) {
      return { allowed: false, reason: "trial_expired", plan: tenant.plan };
    }
  }

  // Look up plan tier
  const planId = tenant.plan || "recon";
  const tier = PLAN_TIERS.find((t) => t.id === planId);
  if (!tier) {
    // Unknown plan — default to recon (trial) caps
    return { allowed: true, plan: planId };
  }

  // Get the cap for this entitlement
  const capKey = CAP_MAP[entitlement];
  const capPerSeat = capKey ? (tier.caps as any)[capKey] : undefined;

  // If the plan has no cap defined for this entitlement
  if (capPerSeat === undefined || capPerSeat === null) {
    // Enterprise/Advisory/Sovereign with empty caps = unlimited
    if (Object.keys(tier.caps).length === 0) {
      return { allowed: true, plan: planId };
    }
    // Cap key exists in CAP_MAP but not in plan → plan doesn't include it
    return { allowed: false, reason: "plan_does_not_include", plan: planId };
  }

  // Unlimited check (cap is explicitly very large or tier has no limit)
  if (capPerSeat < 0 || capPerSeat >= 999999) {
    return { allowed: true, plan: planId };
  }

  // Total cap = per-seat cap × seats
  const seats = tenant.seats || 1;
  const totalCap = capPerSeat * seats;

  // Count usage this billing period (calendar month for simplicity)
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  try {
    const countRows = await sb(
      `usage_events?tenant_id=eq.${encodeURIComponent(tenantId)}&entitlement=eq.${encodeURIComponent(entitlement)}&created_at=gte.${periodStart.toISOString()}&select=qty`,
    );
    const used = Array.isArray(countRows)
      ? countRows.reduce((sum: number, r: any) => sum + (r.qty || 1), 0)
      : 0;

    if (used >= totalCap) {
      return { allowed: false, reason: "plan_cap_exceeded", used, cap: totalCap, plan: planId };
    }

    return { allowed: true, used, cap: totalCap, plan: planId };
  } catch (err: any) {
    // If usage_events table doesn't exist yet, allow through (don't block revenue)
    console.warn("[entitlements] usage query failed (table may not exist):", err?.message);
    return { allowed: true, plan: planId };
  }
}

export async function recordUsage(
  tenantId: string,
  entitlement: Entitlement,
  qty: number = 1,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    await sb("usage_events", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenantId,
        entitlement,
        qty,
        metadata: metadata || null,
      }),
    });
  } catch (err: any) {
    // Non-fatal: don't break the feature if usage tracking fails
    console.warn("[entitlements] recordUsage failed:", err?.message);
  }
}

/**
 * Get usage summary for a tenant — used by billing/me to show progress bars.
 */
export async function getUsageSummary(
  tenantId: string,
): Promise<Record<string, { used: number; cap: number }>> {
  const tenant = await loadTenant(tenantId);
  if (!tenant) return {};

  const planId = tenant.plan || "recon";
  const tier = PLAN_TIERS.find((t) => t.id === planId);
  if (!tier) return {};

  const seats = tenant.seats || 1;
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const summary: Record<string, { used: number; cap: number }> = {};

  try {
    // Fetch all usage this period in one query
    const rows = await sb(
      `usage_events?tenant_id=eq.${encodeURIComponent(tenantId)}&created_at=gte.${periodStart.toISOString()}&select=entitlement,qty`,
    );

    const usageByType: Record<string, number> = {};
    if (Array.isArray(rows)) {
      for (const r of rows) {
        usageByType[r.entitlement] = (usageByType[r.entitlement] || 0) + (r.qty || 1);
      }
    }

    for (const [ent, capKey] of Object.entries(CAP_MAP)) {
      const capPerSeat = (tier.caps as any)[capKey];
      if (capPerSeat === undefined || capPerSeat === null) continue;
      const totalCap = capPerSeat < 0 ? -1 : capPerSeat * seats;
      summary[ent] = {
        used: usageByType[ent] || 0,
        cap: totalCap,
      };
    }
  } catch {
    // Table may not exist yet
  }

  return summary;
}
