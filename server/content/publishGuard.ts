/**
 * publishGuard — server-side enforcement that an ATOM Content generation cannot
 * be approved or exported while it carries unsafe claim state, even if the UI is
 * bypassed (direct POST /api/content/approve). This is the authoritative gate;
 * the React result page's `dirty`/score checks are convenience only.
 *
 * The guard is a pure function over the generation's persisted claimScore and
 * its persisted content_claims rows, so it is fully testable offline (no DB, no
 * network) and matches exactly what was last scored and stored by the worker.
 */
import {
  PUBLISH_MIN_CLAIM_SCORE, BLOCKING_CLAIM_VERDICTS, ALLOW_REVIEW_STATE_APPROVAL,
  GUARDED_APPROVAL_ACTIONS,
} from "@shared/constants/atom-content";
import type { ContentClaim } from "@shared/schema";

export interface BlockingClaim {
  claimText: string;
  claimType: string;
  verified: string;
  riskLevel: string;
  metricKey: string | null;
  sourceSystem: string | null;
}

export interface PublishGuardResult {
  ok: boolean;
  action: string;
  claimScore: number;
  minClaimScore: number;
  reasons: string[];
  rejectedClaims: BlockingClaim[];
  riskyClaims: BlockingClaim[];
  remediation: string[];
}

function toBlocking(c: ContentClaim): BlockingClaim {
  return {
    claimText: c.claimText,
    claimType: c.claimType,
    verified: c.verified,
    riskLevel: c.riskLevel,
    metricKey: c.metricKey ?? null,
    sourceSystem: c.sourceSystem ?? null,
  };
}

/**
 * Evaluate whether a generation may be approved/exported.
 *
 * Blocks when:
 *  - claimScore is below PUBLISH_MIN_CLAIM_SCORE (perfect claim safety), OR
 *  - any persisted claim has a rejected verdict (unsupported/fabricated), OR
 *  - any persisted claim has needs_review verdict (demo-backed / medium-confidence
 *    / absolute) unless policy explicitly permits review-state approval.
 *
 * Returns a structured result; callers turn !ok into an HTTP 422.
 */
export function evaluatePublishGuard(
  action: string,
  claimScore: number,
  claims: ContentClaim[],
): PublishGuardResult {
  const reasons: string[] = [];
  const remediation: string[] = [];

  // Only approve/export promote an asset to a published/ready state; revised and
  // rejected are review-workflow transitions and are never gated by claim safety.
  if (!GUARDED_APPROVAL_ACTIONS.includes(action)) {
    return {
      ok: true, action, claimScore, minClaimScore: PUBLISH_MIN_CLAIM_SCORE,
      reasons, rejectedClaims: [], riskyClaims: [], remediation,
    };
  }

  const rejectedClaims = claims.filter((c) => c.verified === "rejected").map(toBlocking);
  const riskyClaims = claims
    .filter((c) => BLOCKING_CLAIM_VERDICTS.includes(c.verified) && c.verified !== "rejected")
    .map(toBlocking);

  if (claimScore < PUBLISH_MIN_CLAIM_SCORE) {
    reasons.push(
      `claimScore ${Math.round(claimScore)} is below the required ${PUBLISH_MIN_CLAIM_SCORE} for ${action}.`,
    );
    remediation.push("Remove or verify the flagged claims, then re-verify so the claim score returns to 100.");
  }

  if (rejectedClaims.length > 0) {
    reasons.push(
      `${rejectedClaims.length} rejected claim(s): unsupported or fabricated numeric/factual statements.`,
    );
    remediation.push("Delete the unsupported numbers or back them with a verified live metric of the same unit type.");
  }

  if (riskyClaims.length > 0) {
    reasons.push(
      `${riskyClaims.length} claim(s) in needs_review state (demo-backed, medium-confidence, or absolute).`,
    );
    remediation.push(
      ALLOW_REVIEW_STATE_APPROVAL
        ? "Review the flagged claims before publishing."
        : "Resolve needs_review claims (verify against production metrics or remove) — review-state content cannot be approved or exported under current policy.",
    );
  }

  return {
    ok: reasons.length === 0,
    action,
    claimScore,
    minClaimScore: PUBLISH_MIN_CLAIM_SCORE,
    reasons,
    rejectedClaims,
    riskyClaims,
    remediation,
  };
}

/** Error thrown by the worker when the guard blocks; the route maps it to HTTP 422. */
export class PublishGuardError extends Error {
  readonly status = 422;
  readonly detail: PublishGuardResult;
  constructor(detail: PublishGuardResult) {
    super(`Approval blocked: ${detail.reasons.join(" ")}`);
    this.name = "PublishGuardError";
    this.detail = detail;
  }
}
