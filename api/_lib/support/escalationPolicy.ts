/**
 * Decides WHETHER to escalate and at what severity, from the policy evaluation,
 * confidence, and tenant tier. Separate from escalation.ts (which does the
 * actual routing) so the decision is pure + unit-testable.
 */
import type { SupportTier } from "./types";
import type { PolicyEvaluation } from "./policies";
import type { Severity } from "./escalation";
import { CONFIDENCE_THRESHOLD } from "./confidence";

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  severity: Severity;
}

export function decideEscalation(opts: {
  policy: PolicyEvaluation;
  confidence: number;
  tier: SupportTier;
  accountImpacting?: boolean;
}): EscalationDecision {
  const { policy, confidence, tier } = opts;

  // 1. Hard-block topics always escalate.
  if (policy.hardBlock) {
    const critical = policy.matched.includes("security_incident");
    return {
      shouldEscalate: true,
      reason: `hard_block:${policy.primary}`,
      severity: critical ? "critical" : "high",
    };
  }

  // 2. Explicit human request / angry user.
  if (policy.matched.includes("human_request") || policy.angry) {
    return { shouldEscalate: true, reason: policy.angry ? "angry_user" : "user_request", severity: "normal" };
  }

  // 3. Account-impacting issue for Scale/Partner tenants.
  if (opts.accountImpacting && (tier === "scale" || tier === "partner")) {
    return { shouldEscalate: true, reason: "account_impacting_high_tier", severity: "high" };
  }

  // 4. Low confidence.
  if (confidence < CONFIDENCE_THRESHOLD) {
    return { shouldEscalate: true, reason: "low_confidence", severity: tier === "partner" ? "high" : "normal" };
  }

  return { shouldEscalate: false, reason: "none", severity: "low" };
}
