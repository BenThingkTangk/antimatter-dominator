import rules from "../_lib/scoring-rules.json";

export type Evidence = {
  latency_score: number;
  security_score: number;
  gpu_score: number;
  egress_score: number;
  multicloud_score: number;
  trigger_score: number;
  latency_evidence?: string;
  security_evidence?: string;
  gpu_evidence?: string;
  egress_evidence?: string;
  multicloud_evidence?: string;
  trigger_evidence?: string;
};

export type Tier = "T1" | "T2" | "T3" | "T4";

export type ScoreResult = {
  score: number;
  tier: Tier;
  next_action: string;
  rules_version: string;
  explanation: {
    breakdown: string;
    latency: number;
    security: number;
    gpu_inference: number;
    egress_cost: number;
    multicloud: number;
    trigger: number;
  };
};

const clamp = (n: unknown): number => {
  const v = Math.round(Number(n) || 1);
  return Math.max(1, Math.min(5, v));
};

export function scoreAccount(evidence: Evidence): ScoreResult {
  const L = clamp(evidence.latency_score);
  const S = clamp(evidence.security_score);
  const G = clamp(evidence.gpu_score);
  const E = clamp(evidence.egress_score);
  const M = clamp(evidence.multicloud_score);
  const T = clamp(evidence.trigger_score);
  const w = rules.weights as Record<string, number>;
  const score = w.latency * L + w.security * S + w.gpu_inference * G + w.egress * E + w.multicloud * M + w.trigger * T;

  let tier: Tier = "T4";
  if (score >= rules.tiers.T1.min) tier = "T1";
  else if (score >= rules.tiers.T2.min) tier = "T2";
  else if (score >= rules.tiers.T3.min) tier = "T3";

  return {
    score,
    tier,
    next_action: (rules.tiers as any)[tier].action,
    rules_version: rules.version,
    explanation: {
      breakdown: w.latency + "x" + L + " + " + w.security + "x" + S + " + " + w.gpu_inference + "x" + G + " + " + w.egress + "x" + E + " + " + w.multicloud + "x" + M + " + " + w.trigger + "x" + T + " = " + score,
      latency: L,
      security: S,
      gpu_inference: G,
      egress_cost: E,
      multicloud: M,
      trigger: T
    }
  };
}
