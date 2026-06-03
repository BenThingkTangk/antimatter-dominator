/**
 * dial-gate — fail-CLOSED compliance gate for autonomous outbound voice dials.
 *
 * SAFETY CONTRACT (do not weaken without compliance sign-off):
 *   A real outbound call may be placed ONLY when this gate returns
 *   { decision: "allow" }. That happens exclusively when the pre-dial
 *   compliance endpoint returns HTTP 200 with `allowed === true`.
 *
 *   EVERY other outcome blocks the dial:
 *     - tenant slug missing            → block (cannot scope consent/DNC)
 *     - ADMIN_API_KEY not configured   → block (cannot authenticate the check)
 *     - compliance endpoint non-200    → block (vendor/infra error)
 *     - fetch throws / times out       → block (vendor unavailable)
 *     - response not JSON / malformed  → block (unknown result)
 *     - allowed !== true               → block (explicit compliance block)
 *
 * This replaces the previous fail-OPEN behavior where a timeout, a missing
 * tenant slug, or an unreachable compliance service silently let the dial
 * proceed. Placing an autonomous TCPA-regulated call without a positive
 * compliance decision is the single highest-liability failure mode in the
 * product, so the default is always "do not dial".
 *
 * The only escape hatch is the env var ATOM_DIAL_FALLBACK_MODE:
 *   - "block"         (default) — infra/unknown errors block the dial.
 *   - "manual_review" — infra/unknown errors return decision="manual_review"
 *                       so the caller can queue the dial for a human instead
 *                       of placing it. Still NEVER auto-dials.
 * There is intentionally NO value that makes errors auto-allow.
 */
import type { VercelRequest } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

export type DialDecision = "allow" | "block" | "manual_review";

export interface DialGateResult {
  decision: DialDecision;
  /** Machine reason code, e.g. "no_consent_on_file", "compliance_unavailable". */
  reason: string;
  /** Reasons array surfaced by the compliance endpoint (if any). */
  blockReasons?: string[];
  /** Raw per-check detail from the compliance endpoint (if any). */
  checks?: unknown;
  /** HTTP status the caller should return. 200 only when decision==="allow". */
  httpStatus: number;
  /** True when the block was caused by infra/vendor failure rather than a
   *  real compliance rule. Useful for alerting/observability. */
  infraError?: boolean;
}

function fallbackMode(): "block" | "manual_review" {
  const m = clean(process.env.ATOM_DIAL_FALLBACK_MODE).toLowerCase();
  return m === "manual_review" ? "manual_review" : "block";
}

/** Build the failure result for an infra/unknown error, honoring fallback mode. */
function infraFailure(reason: string): DialGateResult {
  const mode = fallbackMode();
  if (mode === "manual_review") {
    return {
      decision: "manual_review",
      reason,
      httpStatus: 202,
      infraError: true,
    };
  }
  return {
    decision: "block",
    reason,
    httpStatus: 503,
    infraError: true,
  };
}

/**
 * Run the fail-closed pre-dial compliance check.
 *
 * @param req      the incoming Vercel request (used to resolve self origin)
 * @param phoneE164 the normalized destination number
 * @param tenantSlug the tenant slug the dial is scoped to
 */
export async function evaluateDial(
  req: VercelRequest,
  phoneE164: string,
  tenantSlug: string,
): Promise<DialGateResult> {
  const adminKey = clean(process.env.ADMIN_API_KEY);

  // Fail closed on the prerequisites required to even ASK for a decision.
  if (!tenantSlug) {
    return {
      decision: "block",
      reason: "tenant_slug_missing",
      httpStatus: 403,
    };
  }
  if (!adminKey) {
    return infraFailure("compliance_not_configured");
  }
  if (!phoneE164) {
    return { decision: "block", reason: "phone_missing", httpStatus: 400 };
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers.host as string) ||
    "atom-dominator-pro.vercel.app";

  let pdcRes: Response;
  try {
    pdcRes = await fetch(`${proto}://${host}/api/compliance/pre-dial-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
      body: JSON.stringify({ phone: phoneE164, tenantSlug }),
      signal: AbortSignal.timeout(6000),
    });
  } catch (err: any) {
    // Timeout / DNS / connection refused / vendor unavailable → fail closed.
    console.error(
      "[dial-gate] pre-dial-check unreachable, BLOCKING dial:",
      err?.message,
    );
    return infraFailure("compliance_unavailable");
  }

  if (!pdcRes.ok) {
    // 4xx/5xx from the compliance service → unknown/error result → fail closed.
    const body = await pdcRes.text().catch(() => "");
    console.error(
      `[dial-gate] pre-dial-check HTTP ${pdcRes.status}, BLOCKING dial:`,
      body.slice(0, 200),
    );
    return infraFailure("compliance_error_" + pdcRes.status);
  }

  let pdc: any;
  try {
    pdc = await pdcRes.json();
  } catch {
    console.error("[dial-gate] pre-dial-check returned non-JSON, BLOCKING dial");
    return infraFailure("compliance_malformed_response");
  }

  // The ONLY path that allows a real dial: explicit positive decision.
  if (pdc && pdc.allowed === true) {
    return {
      decision: "allow",
      reason: "compliance_passed",
      checks: pdc.checks,
      httpStatus: 200,
    };
  }

  // Explicit compliance block (consent missing, DNC, quiet hours, etc.)
  return {
    decision: "block",
    reason: pdc?.blockReasons?.[0] || "compliance_block",
    blockReasons: pdc?.blockReasons,
    checks: pdc?.checks,
    httpStatus: 451,
  };
}
