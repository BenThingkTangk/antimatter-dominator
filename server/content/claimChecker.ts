/**
 * claimChecker — extracts factual claims from generated content, matches
 * numeric/metric claims against live numbers, flags absolute claims and
 * compliance-risk language, and returns a structured risk report with a
 * 0-100 claim-verification score.
 */
import { ABSOLUTE_CLAIM_TERMS, COMPLIANCE_RISK_TERMS } from "@shared/constants/atom-content";
import type { LiveNumbersResult, LiveMetric } from "./liveNumbersEngine";
import type { InsertContentClaim } from "@shared/schema";

export type ClaimVerdict = "verified" | "needs_review" | "rejected";
export type ClaimType = "metric" | "absolute" | "outcome" | "general";

export interface DetectedClaim {
  claimText: string;
  claimType: ClaimType;
  metricKey: string | null;
  verified: ClaimVerdict;
  sourceSystem: string | null;
  confidence: string | null;
  riskLevel: "low" | "medium" | "high";
  note: string;
}

export interface ClaimReport {
  score: number; // 0-100
  claims: DetectedClaim[];
  metricClaims: DetectedClaim[];
  claimsNeedingVerification: DetectedClaim[];
  rejectedClaims: DetectedClaim[];
  riskFlags: string[];
  complianceWarnings: string[];
  summary: string;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/;

function sentencesOf(content: string): string[] {
  return content.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
}

/**
 * Find every numeric factual token in a sentence — plain counts, percentages,
 * currency, ranges, multipliers, and metric-like phrases. The previous version
 * relied on a keyword allowlist, which let fabricated counts ("42 enterprise
 * logos") slip through with no claim recorded. We now extract all numbers and
 * let unit semantics + metric matching decide the verdict.
 *
 * Excluded: years (1900-2099), ordinals ("1st"), and list/heading markers so we
 * don't flag "Step 2" or "in 2024" as performance claims.
 */
const NUMBER_TOKEN_RE =
  /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|k\b|m\b|million|billion|events?|hrs?|hours?|leads?|reps?|customers?|logos?|accounts?|deals?|x\b)?/gi;

interface ParsedNumber {
  raw: string;
  value: number;
  unit: string | null; // normalized: "%", "$", "$M", or null for bare count
}

/** Canonical unit-class so a claim can only bind to a semantically compatible metric. */
export type UnitClass = "percent" | "currency" | "duration" | "count";

export function unitClass(unit: string | null | undefined): UnitClass {
  const u = (unit || "").toLowerCase().trim();
  if (u === "%" || u === "percent") return "percent";
  if (u === "$" || u === "$m" || u === "usd" || u.startsWith("$")) return "currency";
  if (u === "hr" || u === "hrs" || u === "hour" || u === "hours" || u === "min" || u === "mins" || u === "days") return "duration";
  return "count";
}

function isYear(value: number, raw: string): boolean {
  return /^\d{4}$/.test(raw.trim()) && value >= 1900 && value <= 2099;
}

function parseNumeric(token: string): ParsedNumber | null {
  const m = token.match(/(\$)?([\d,]+(?:\.\d+)?)\s?(%|percent|k|m|million|billion|events?|hrs?|hours?|leads?|reps?|customers?|logos?|accounts?|deals?|x)?/i);
  if (!m) return null;
  let value = parseFloat(m[2].replace(/,/g, ""));
  if (Number.isNaN(value)) return null;
  const rawUnit = m[3] ? m[3].toLowerCase() : null;
  let unit: string | null = rawUnit || (m[1] ? "$" : null);
  if (rawUnit === "k") { value *= 1_000; unit = m[1] ? "$" : null; }
  else if (rawUnit === "m" || rawUnit === "million") { value *= 1; unit = m[1] ? "$M" : null; }
  else if (rawUnit === "billion") { value *= 1; unit = m[1] ? "$M" : null; }
  else if (rawUnit === "percent") unit = "%";
  else if (rawUnit && unitClass(rawUnit) === "count") unit = null; // plain count noun, drop label
  return { raw: token, value, unit };
}

/** Extract all numeric factual tokens from a sentence (excluding years). */
function extractNumbers(sentence: string): ParsedNumber[] {
  const out: ParsedNumber[] = [];
  const re = new RegExp(NUMBER_TOKEN_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(sentence)) !== null) {
    if (match[0] === "") { re.lastIndex++; continue; }
    const parsed = parseNumeric(match[0]);
    if (!parsed) continue;
    if (isYear(parsed.value, match[0])) continue;
    out.push(parsed);
  }
  return out;
}

const RANK = (c: string) => ({ verified: 4, high: 3, medium: 2, low: 1, unverified: 0 } as Record<string, number>)[c] ?? 0;

/**
 * Try to bind a numeric value to a live metric. A match requires BOTH equal
 * value AND a compatible unit-class — a percent claim can only bind to a
 * percent-rate metric, currency only to currency, counts only to counts. This
 * closes the unit-blind hole where "42%" matched "leads_generated = 42".
 *
 * Demo metrics may only back a claim when demo data is explicitly allowed;
 * otherwise they are ignored so demo numbers can never be promoted as real
 * verified proof.
 */
function matchMetric(parsed: ParsedNumber, live: LiveNumbersResult): LiveMetric | undefined {
  const wantClass = unitClass(parsed.unit);
  const candidates = live.metrics.filter((m) => {
    if (Math.abs(m.value - parsed.value) >= 0.001) return false;
    if (unitClass(m.unit) !== wantClass) return false;
    if (m.isDemo && !live.demoMode) return false; // demo proof requires explicit opt-in
    return true;
  });
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => RANK(b.confidence) - RANK(a.confidence))[0];
}

export function checkClaims(content: string, live: LiveNumbersResult): ClaimReport {
  const claims: DetectedClaim[] = [];
  const riskFlags: string[] = [];
  const complianceWarnings: string[] = [];

  for (const sentence of sentencesOf(content)) {
    const lower = sentence.toLowerCase();

    // Compliance-risk language (medical / legal / financial / guarantees).
    const compHit = COMPLIANCE_RISK_TERMS.find((t) => lower.includes(t));
    if (compHit) {
      complianceWarnings.push(`Compliance risk near "${compHit}": ${sentence}`);
    }

    // Absolute claims.
    const absHit = ABSOLUTE_CLAIM_TERMS.find((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sentence));

    // Numeric claims — extract EVERY numeric factual statement in the sentence.
    // No keyword allowlist: any unsupported number is surfaced, never ignored.
    const numbers = extractNumbers(sentence);
    if (numbers.length > 0) {
      for (const parsed of numbers) {
        const matched = matchMetric(parsed, live);
        const demoNote = matched?.isDemo ? " [DEMO metric — not real production proof]" : "";
        if (matched && matched.usableInFinal) {
          claims.push({
            claimText: sentence,
            claimType: "metric",
            metricKey: matched.metricKey,
            verified: matched.isDemo ? "needs_review" : "verified",
            sourceSystem: matched.sourceSystem,
            confidence: matched.confidence,
            riskLevel: matched.isDemo ? "medium" : "low",
            note: matched.isDemo
              ? `Matched a DEMO metric (${matched.sourceSystem}, ${matched.confidence}). Demo data cannot certify real proof — review before publishing.`
              : `Backed by ${matched.sourceSystem} (${matched.confidence}, captured ${matched.capturedAt.slice(0, 10)}).`,
          });
          if (matched.isDemo) riskFlags.push(`Demo metric backing a claim: "${sentence.slice(0, 80)}"`);
        } else if (matched && matched.suggestableOnly) {
          claims.push({
            claimText: sentence,
            claimType: "metric",
            metricKey: matched.metricKey,
            verified: "needs_review",
            sourceSystem: matched.sourceSystem,
            confidence: matched.confidence,
            riskLevel: "medium",
            note: `Matched a medium-confidence metric — needs review before publishing.${demoNote}`,
          });
          riskFlags.push(`Medium-confidence metric used: "${sentence.slice(0, 80)}"`);
        } else {
          claims.push({
            claimText: sentence,
            claimType: "metric",
            metricKey: null,
            verified: "rejected",
            sourceSystem: null,
            confidence: null,
            riskLevel: "high",
            note: `Numeric claim "${parsed.raw.trim()}" has no matching verified live metric of the same unit type. Remove or verify.`,
          });
          riskFlags.push(`Unsupported numeric claim: "${sentence.slice(0, 80)}"`);
        }
      }
      continue;
    }

    if (absHit) {
      claims.push({
        claimText: sentence,
        claimType: "absolute",
        metricKey: null,
        verified: "needs_review",
        sourceSystem: null,
        confidence: null,
        riskLevel: "high",
        note: `Absolute term "${absHit}" — only defensible with approved proof.`,
      });
      riskFlags.push(`Absolute claim ("${absHit}"): "${sentence.slice(0, 80)}"`);
    }
  }

  const metricClaims = claims.filter((c) => c.claimType === "metric");
  const claimsNeedingVerification = claims.filter((c) => c.verified === "needs_review");
  const rejectedClaims = claims.filter((c) => c.verified === "rejected");

  // Score: penalize rejected hard, needs_review moderate; full marks when
  // there are no factual-claim issues at all.
  let score = 100;
  score -= rejectedClaims.length * 25;
  score -= claimsNeedingVerification.length * 8;
  score -= complianceWarnings.length * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const summary =
    rejectedClaims.length > 0
      ? `${rejectedClaims.length} unsupported numeric claim(s). Remove or verify before publishing.`
      : claimsNeedingVerification.length > 0
        ? `${claimsNeedingVerification.length} claim(s) need review.`
        : "All factual claims either verified or claim-free. Safe to proceed.";

  return {
    score,
    claims,
    metricClaims,
    claimsNeedingVerification,
    rejectedClaims,
    riskFlags,
    complianceWarnings,
    summary,
  };
}

/** Map detected claims to rows for persistence. */
export function claimsToRows(generationId: number, report: ClaimReport): InsertContentClaim[] {
  const now = new Date().toISOString();
  return report.claims.map((c) => ({
    generationId,
    claimText: c.claimText,
    claimType: c.claimType,
    metricKey: c.metricKey,
    verified: c.verified,
    sourceSystem: c.sourceSystem,
    confidence: c.confidence,
    riskLevel: c.riskLevel,
    createdAt: now,
  }));
}
