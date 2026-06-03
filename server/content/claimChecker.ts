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

// Numbers that look like factual metrics: 42, 31%, 5,204, $1.2M, 74 percent.
const NUMERIC_RE = /(\$?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|k|m|million|billion|events|hrs|hours|leads|x)?)/i;

/** Try to bind a numeric value found in text to a usable live metric. */
function matchMetric(value: number, unit: string | null, live: LiveNumbersResult): LiveMetric | undefined {
  const candidates = live.metrics.filter((m) => Math.abs(m.value - value) < 0.001);
  if (candidates.length === 0) return undefined;
  if (unit) {
    const u = unit.toLowerCase();
    const byUnit = candidates.find((m) => m.unit.toLowerCase() === u || (u === "percent" && m.unit === "%"));
    if (byUnit) return byUnit;
  }
  // Prefer the highest-confidence candidate.
  const rank = (c: string) => ({ verified: 4, high: 3, medium: 2, low: 1, unverified: 0 } as any)[c] ?? 0;
  return candidates.sort((a, b) => rank(b.confidence) - rank(a.confidence))[0];
}

function parseNumeric(token: string): { value: number; unit: string | null } | null {
  const m = token.match(/(\$)?([\d,]+(?:\.\d+)?)\s?(%|percent|k|m|million|billion|events|hrs|hours|leads|x)?/i);
  if (!m) return null;
  let value = parseFloat(m[2].replace(/,/g, ""));
  let unit: string | null = m[3] ? m[3].toLowerCase() : m[1] ? "$" : null;
  if (unit === "k") { value *= 1_000; unit = null; }
  else if (unit === "m" || unit === "million") { value *= 1; unit = m[1] ? "$M" : null; }
  else if (unit === "percent") unit = "%";
  if (Number.isNaN(value)) return null;
  return { value, unit };
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

    // Metric claims — sentence contains a number that reads as a stat.
    const numToken = sentence.match(NUMERIC_RE)?.[0];
    const looksLikeStat = !!numToken && /(lead|reply|repl|reduc|increas|process|event|pipeline|conversion|%|percent|\$|faster|x )/i.test(sentence);

    if (looksLikeStat && numToken) {
      const parsed = parseNumeric(numToken);
      const matched = parsed ? matchMetric(parsed.value, parsed.unit, live) : undefined;
      if (matched && matched.usableInFinal) {
        claims.push({
          claimText: sentence,
          claimType: "metric",
          metricKey: matched.metricKey,
          verified: "verified",
          sourceSystem: matched.sourceSystem,
          confidence: matched.confidence,
          riskLevel: "low",
          note: `Backed by ${matched.sourceSystem} (${matched.confidence}, captured ${matched.capturedAt.slice(0, 10)}).`,
        });
      } else if (matched && matched.suggestableOnly) {
        claims.push({
          claimText: sentence,
          claimType: "metric",
          metricKey: matched.metricKey,
          verified: "needs_review",
          sourceSystem: matched.sourceSystem,
          confidence: matched.confidence,
          riskLevel: "medium",
          note: `Matched a medium-confidence metric — needs review before publishing.`,
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
          note: "Numeric claim with no matching verified live metric. Remove or verify.",
        });
        riskFlags.push(`Unsupported numeric claim: "${sentence.slice(0, 80)}"`);
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
