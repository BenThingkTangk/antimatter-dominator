/**
 * Eval scenarios — the launch QA checklist as runnable, assertable cases that
 * exercise the PURE decision layers (policy, confidence, escalation, tone)
 * without any network/LLM dependency. Surfaced on the internal eval page and
 * runnable in CI via api/_lib/support/__tests__.
 */
import { evaluatePolicy } from "./policies";
import { scoreConfidence, CONFIDENCE_THRESHOLD } from "./confidence";
import { decideEscalation } from "./escalationPolicy";
import { planToTier, toneDirective } from "./tone";
import type { ConfidenceInput } from "./types";

export interface EvalCase {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

const goodRetrieval: Omit<ConfidenceInput, "topicRisk" | "tier"> = {
  topSimilarity: 0.82, meanSimilarity: 0.7, chunkCount: 4, hasTenantDiagnostics: false,
};

export function runEvalScenarios(): { cases: EvalCase[]; passed: number; total: number } {
  const cases: EvalCase[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) =>
    cases.push({ id, label, pass, detail });

  // 1. Logged-out marketing question (general, public tier) — should answer.
  {
    const p = evaluatePolicy("What does ATOM do?");
    const c = scoreConfidence({ ...goodRetrieval, topicRisk: p.topicRisk, tier: "public" });
    const d = decideEscalation({ policy: p, confidence: c.score, tier: "public" });
    add("marketing_question", "Logged-out marketing question", !d.shouldEscalate && c.score >= CONFIDENCE_THRESHOLD,
      `conf=${c.score.toFixed(2)} escalate=${d.shouldEscalate}`);
  }

  // 2. No-source answer → escalate.
  {
    const p = evaluatePolicy("How do I integrate ATOM with my custom CRM webhook?");
    const c = scoreConfidence({ topSimilarity: 0, meanSimilarity: 0, chunkCount: 0, topicRisk: p.topicRisk, tier: "starter", hasTenantDiagnostics: false });
    const d = decideEscalation({ policy: p, confidence: c.score, tier: "starter" });
    add("no_source", "No-source answer escalates", c.score < CONFIDENCE_THRESHOLD && d.shouldEscalate,
      `conf=${c.score.toFixed(2)} reason=${d.reason}`);
  }

  // 3. Billing / refund escalation (hard-block).
  {
    const p = evaluatePolicy("I want a refund for last month");
    const d = decideEscalation({ policy: p, confidence: 0.9, tier: "scale" });
    add("refund_escalation", "Refund request escalates + hard-block", p.hardBlock && d.shouldEscalate && d.reason.startsWith("hard_block"),
      `primary=${p.primary} reason=${d.reason}`);
  }

  // 4. Legal escalation (hard-block).
  {
    const p = evaluatePolicy("Should I get a lawyer about this lawsuit?");
    add("legal_escalation", "Legal advice hard-blocked", p.hardBlock && p.primary === "legal_advice", `primary=${p.primary}`);
  }

  // 5. HIPAA/PHI block.
  {
    const p = evaluatePolicy("Can I store patient PHI for HIPAA campaigns?");
    add("hipaa_block", "HIPAA/PHI hard-blocked", p.hardBlock && p.matched.includes("hipaa_phi"), `matched=${p.matched.join(",")}`);
  }

  // 6. Pricing negotiation block.
  {
    const p = evaluatePolicy("Can you give me a discount on pricing if I negotiate?");
    add("pricing_block", "Pricing negotiation hard-blocked", p.hardBlock && p.matched.includes("pricing_negotiation"), `matched=${p.matched.join(",")}`);
  }

  // 7. Security incident → critical severity.
  {
    const p = evaluatePolicy("I think we had a data breach, customer data leaked");
    const d = decideEscalation({ policy: p, confidence: 0.9, tier: "partner" });
    add("security_incident", "Security incident → critical", d.shouldEscalate && d.severity === "critical", `severity=${d.severity}`);
  }

  // 8. Angry user asking for human → escalate.
  {
    const p = evaluatePolicy("This is ridiculous, get me a real person now!!");
    const d = decideEscalation({ policy: p, confidence: 0.9, tier: "scale" });
    add("angry_human", "Angry user → escalate", d.shouldEscalate, `reason=${d.reason}`);
  }

  // 9. Low-confidence threshold honored.
  {
    const p = evaluatePolicy("Tell me about the changelog");
    const c = scoreConfidence({ topSimilarity: 0.4, meanSimilarity: 0.35, chunkCount: 1, topicRisk: 0, tier: "starter", hasTenantDiagnostics: false });
    const d = decideEscalation({ policy: p, confidence: c.score, tier: "starter" });
    add("low_confidence", "Low confidence escalates", d.shouldEscalate && d.reason === "low_confidence", `conf=${c.score.toFixed(2)}`);
  }

  // 10. Account-impacting Scale/Partner issue escalates even at decent confidence.
  {
    const p = evaluatePolicy("My API key stopped working in production");
    const d = decideEscalation({ policy: p, confidence: 0.75, tier: "partner", accountImpacting: true });
    add("account_impacting", "Account-impacting high-tier escalates", d.shouldEscalate && d.reason === "account_impacting_high_tier", `reason=${d.reason}`);
  }

  // 11. Tier tone mapping.
  {
    const starter = planToTier("trial") === "starter";
    const scale = planToTier("growth") === "scale";
    const partner = planToTier("enterprise") === "partner";
    add("tier_mapping", "Plan→tier mapping", starter && scale && partner,
      `trial→${planToTier("trial")} growth→${planToTier("growth")} enterprise→${planToTier("enterprise")}`);
  }

  // 12. Tone directives differ per tier.
  {
    const distinct = new Set([toneDirective("starter"), toneDirective("scale"), toneDirective("partner")]).size === 3;
    add("tone_directives", "Distinct tone per tier", distinct, "starter/scale/partner directives differ");
  }

  // 13. Safe question, good sources, no risk → NO escalation (avoid over-escalating).
  {
    const p = evaluatePolicy("How do I create a campaign?");
    const c = scoreConfidence({ ...goodRetrieval, topicRisk: p.topicRisk, tier: "scale" });
    const d = decideEscalation({ policy: p, confidence: c.score, tier: "scale" });
    add("no_over_escalate", "Confident safe answer does not escalate", !d.shouldEscalate, `conf=${c.score.toFixed(2)}`);
  }

  const passed = cases.filter((c) => c.pass).length;
  return { cases, passed, total: cases.length };
}
