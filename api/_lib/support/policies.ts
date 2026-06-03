/**
 * Topic-risk policy layer. Detects hard-block topics and escalation triggers.
 * The agent must NEVER answer hard-block topics substantively.
 */
import type { SupportTier } from "./types.js";

export type RiskCategory =
  | "pricing_negotiation"
  | "refund_approval"
  | "legal_advice"
  | "hipaa_phi"
  | "compliance_promise"
  | "security_incident"
  | "contract_sla"
  | "human_request"
  | "billing_sensitive"
  | "none";

interface RiskMatch {
  category: RiskCategory;
  hardBlock: boolean;        // must not answer substantively
  patterns: RegExp[];
}

// Order matters: first match wins for the primary category, but we collect all.
const RISK_RULES: RiskMatch[] = [
  {
    category: "hipaa_phi",
    hardBlock: true,
    patterns: [/\bhipaa\b/i, /\bphi\b/i, /protected health/i, /patient (data|record|info)/i, /\bephi\b/i],
  },
  {
    category: "legal_advice",
    hardBlock: true,
    patterns: [/\blawyer\b/i, /\blawsuit\b/i, /\blegal advice\b/i, /\bsue\b/i, /\bliabilit/i, /\bsubpoena\b/i, /\bgdpr\b.*\b(right|comply|legal)\b/i],
  },
  {
    category: "refund_approval",
    hardBlock: true,
    patterns: [/\brefund\b/i, /\bchargeback\b/i, /\bmoney back\b/i, /\breimburse/i],
  },
  {
    category: "pricing_negotiation",
    hardBlock: true,
    patterns: [/\bnegotiate\b.*\b(price|pricing|discount|deal|rate)\b/i, /\b(discount|lower price|better rate)\b/i, /\bcustom pricing\b/i],
  },
  {
    category: "contract_sla",
    hardBlock: true,
    patterns: [/\bsla\b/i, /\bcontract\b/i, /\bmsa\b/i, /\bterms of service\b.*\b(mean|liable|guarantee)\b/i, /\buptime guarantee\b/i],
  },
  {
    category: "security_incident",
    hardBlock: true,
    patterns: [/\b(security|data) breach\b/i, /\bdata loss\b/i, /\bhacked\b/i, /\bleak(ed)?\b.*\b(data|key|token|customer)\b/i, /\bincident\b.*\b(security|breach)\b/i],
  },
  {
    category: "compliance_promise",
    hardBlock: true,
    patterns: [/\b(are you|is atom|is it) (hipaa|soc ?2|gdpr|pci) compliant\b/i, /\bcompliance (guarantee|promise|certif)/i],
  },
  {
    category: "billing_sensitive",
    hardBlock: false, // routing-level billing answers are OK; sensitive ones escalate
    patterns: [/\bcancel(lation)?\b/i, /\bcancel my (account|subscription|plan)\b/i],
  },
  {
    category: "human_request",
    hardBlock: false,
    patterns: [/\b(talk|speak|connect) (to|with) (a|an)? ?(human|person|agent|rep|someone)\b/i, /\breal person\b/i, /\bthis is useless\b/i],
  },
];

export interface PolicyEvaluation {
  primary: RiskCategory;
  matched: RiskCategory[];
  hardBlock: boolean;
  topicRisk: number;          // 0..1
  angry: boolean;
}

const ANGER_PATTERNS = [/\b(angry|furious|ridiculous|unacceptable|terrible|worst|garbage|useless)\b/i, /!{2,}/, /\bASAP\b/];

export function evaluatePolicy(message: string): PolicyEvaluation {
  const matched: RiskCategory[] = [];
  let hardBlock = false;
  let primary: RiskCategory = "none";

  for (const rule of RISK_RULES) {
    if (rule.patterns.some((p) => p.test(message))) {
      matched.push(rule.category);
      if (rule.hardBlock) hardBlock = true;
      if (primary === "none") primary = rule.category;
    }
  }

  const angry = ANGER_PATTERNS.some((p) => p.test(message));
  // Risk weighting: hard-block topics dominate; soft routing topics mild.
  let topicRisk = 0;
  if (hardBlock) topicRisk = 0.95;
  else if (matched.length) topicRisk = 0.5;
  if (angry) topicRisk = Math.max(topicRisk, 0.6);

  return { primary, matched, hardBlock, topicRisk, angry };
}

/** The canned acknowledgement returned for hard-block topics (no substantive answer). */
export function hardBlockResponse(category: RiskCategory, tier: SupportTier): string {
  const human =
    tier === "partner"
      ? "Your account team will follow up shortly."
      : "A member of our team will follow up with you shortly.";
  const map: Partial<Record<RiskCategory, string>> = {
    hipaa_phi:
      "I'm not able to discuss HIPAA or protected health information details here. I've flagged this so the right specialist can help you safely.",
    legal_advice:
      "I can't provide legal advice or interpret legal matters. I've escalated this to our team.",
    refund_approval:
      "I'm not able to approve refunds or billing adjustments. I've routed this to our billing team.",
    pricing_negotiation:
      "I can't negotiate pricing or discounts. I've connected you with our team who can.",
    contract_sla:
      "I can't interpret contract or SLA terms. I've escalated this to the team who can review it with you.",
    security_incident:
      "This sounds like it may be security-sensitive. I've escalated it with high priority so our security team can respond.",
    compliance_promise:
      "I can't make compliance commitments on ATOM's behalf. I've routed your question to the team who handles compliance.",
  };
  const base = map[category] || "This needs a human on our team. I've escalated it for you.";
  return `${base} ${human}`;
}
