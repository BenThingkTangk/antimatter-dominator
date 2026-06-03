/**
 * @nirmata/atom-workforce-sdk
 *
 * A SAFE, NON-DESTRUCTIVE subset of the ATOM Ops toolset, intended for use by
 * autonomous workforce agents that must NEVER mutate production state. Only
 * read/draft operations are exported here. Destructive operations (deploys,
 * merges, refunds, DNS writes, tenant suspends, sends) are intentionally absent
 * and live only behind the superadmin, confirmation-gated console.
 *
 * Re-exported from the canonical implementations in lib/atom-ops so there is a
 * single source of truth. Each returns the shared OpsResult shape.
 */

// GitHub (read/comment only)
export { listOpenPRs, postIssue, commentOnIssue } from "../../../lib/atom-ops/tools/github";

// Stripe (read only)
export { lookupCustomer } from "../../../lib/atom-ops/tools/stripe";

// Supabase ops (read only)
export { getRowCounts, runRLSTestQuery } from "../../../lib/atom-ops/tools/supabase-ops";

// Sentry (read only)
export { readSentryErrors } from "../../../lib/atom-ops/tools/sentry-posthog";

// Email (draft only — does NOT send)
export { draftEmail } from "../../../lib/atom-ops/tools/email";

export type { OpsResult } from "../../../lib/atom-ops/types";

/**
 * Static manifest of what this SDK exposes, with the destructive flag pinned to
 * false for every entry. Useful for capability discovery / agent tool specs.
 */
export const WORKFORCE_TOOLS = [
  { id: "github.listOpenPRs", destructive: false },
  { id: "github.postIssue", destructive: false },
  { id: "github.commentOnIssue", destructive: false },
  { id: "stripe.lookupCustomer", destructive: false },
  { id: "supabase.getRowCounts", destructive: false },
  { id: "supabase.runRLSTestQuery", destructive: false },
  { id: "sentry.readSentryErrors", destructive: false },
  { id: "email.draftEmail", destructive: false },
] as const;
