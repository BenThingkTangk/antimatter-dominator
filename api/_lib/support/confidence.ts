/**
 * Confidence scoring. Combines retrieval relevance, source agreement, topic risk,
 * user tier, and presence of tenant diagnostics into a single 0..1 score.
 * Below ATOM_SUPPORT_CONFIDENCE_THRESHOLD (default 0.7) → escalate.
 */
import type { ConfidenceInput, ConfidenceResult } from "./types";

export const CONFIDENCE_THRESHOLD = (() => {
  const raw = Number(process.env.ATOM_SUPPORT_CONFIDENCE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.7;
})();

export function scoreConfidence(input: ConfidenceInput): ConfidenceResult {
  const factors: Record<string, number> = {};

  // Retrieval relevance — the strongest signal. No chunks → near-zero.
  const relevance = input.chunkCount === 0 ? 0 : clamp(input.topSimilarity);
  factors.relevance = relevance;

  // Source agreement — do multiple chunks agree (mean close to top)?
  const agreement =
    input.chunkCount <= 1 ? relevance * 0.8 : clamp(input.meanSimilarity);
  factors.agreement = agreement;

  // Coverage — more supporting chunks → steadier answer (diminishing returns).
  const coverage = clamp(Math.min(input.chunkCount, 4) / 4);
  factors.coverage = coverage;

  // Topic risk penalty — hard-block / sensitive topics push confidence down.
  const riskPenalty = input.topicRisk;
  factors.riskPenalty = riskPenalty;

  // Tenant diagnostics bonus — for account-specific questions, having live
  // diagnostics raises confidence we can answer accurately.
  const diagBonus = input.hasTenantDiagnostics ? 0.08 : 0;
  factors.diagBonus = diagBonus;

  // Weighted blend, then apply risk penalty multiplicatively.
  const base = relevance * 0.5 + agreement * 0.3 + coverage * 0.2;
  let score = base * (1 - riskPenalty * 0.9) + diagBonus;

  // Floor for a totally unsupported answer so we always escalate.
  if (input.chunkCount === 0) score = Math.min(score, 0.25);

  score = clamp(score);
  factors.final = score;
  return { score, factors };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
