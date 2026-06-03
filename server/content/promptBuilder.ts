/**
 * promptBuilder — assembles the system + user prompt for ATOM Content. The
 * model is instructed to obey voice.yaml, never invent metrics, and return a
 * strict JSON envelope.
 */
import type { ContentBrief } from "@shared/schema";
import type { LiveMetric } from "./liveNumbersEngine";

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  blog: "Blog post",
  "case-study": "Case study",
  whitepaper: "Whitepaper",
  linkedin: "LinkedIn post",
  "x-thread": "X (Twitter) thread",
  youtube: "YouTube description",
  launch: "Launch announcement",
  "founder-pov": "Founder POV post",
  "investor-insight": "Investor-style market insight post",
  "product-update": "Product update post",
  "customer-success": "Customer success story",
  "seo-landing": "SEO landing page draft",
};

export const CONTENT_TYPE_RULES: Record<string, string> = {
  blog: "Strong hook → executive problem framing → operational consequence → product-led solution → proof points → CTA. 900-1,500 words unless the brief overrides length.",
  "case-study": "Customer context → before state → ATOM deployment → live numbers used → business impact → quote placeholder (if no approved quote) → CTA.",
  whitepaper: "Executive abstract → market shift → operating model → technical architecture → ROI logic → risk/compliance notes → next step.",
  linkedin: "Strong first line → short paragraphs → founder/exec tone → one core idea → optional proof point → CTA or discussion close.",
  "x-thread": "Hook tweet → 6-10 tweets, one idea each, concise → final CTA. Number the tweets.",
  youtube: "2-line hook → what the viewer will learn → product context → CTA → links placeholder → hashtags placeholder.",
  launch: "Announce the capability, the operational shift it unlocks, who it's for, proof, and a clear next step.",
  "founder-pov": "First-person founder conviction. One sharp thesis, lived operational detail, a call to rethink the status quo.",
  "investor-insight": "Market-structure thesis, the shift underway, where value accrues, and ATOM's position in it. Sober, data-anchored.",
  "product-update": "What shipped, why it matters operationally, who benefits, and how to act on it.",
  "customer-success": "Outcome-first narrative of a customer win with verified numbers and an executive takeaway.",
  "seo-landing": "Headline + subhead → problem → solution → proof → benefit bullets → FAQ stubs → CTA. Keyword-aware but never keyword-stuffed.",
};

export const SYSTEM_PROMPT = `You are ATOM Content, the long-form content worker for ATOM Sales OS. You write like an executive revenue operator, not a generic SaaS marketer. You obey voice.yaml. You never invent metrics. You use only verified live numbers supplied to you. If proof is missing, mark the claim as needing verification or remove it. Never make medical, legal, financial, or guaranteed-outcome promises.`;

function metricLine(m: LiveMetric): string {
  return `- ${m.metricLabel}: ${m.display} [key=${m.metricKey}, source=${m.sourceSystem}, confidence=${m.confidence}, captured=${m.capturedAt.slice(0, 10)}${m.isDemo ? ", DEMO" : ""}]`;
}

export function buildUserPrompt(args: {
  brief: ContentBrief;
  voiceYaml: string;
  usableMetrics: LiveMetric[];
  suggestableMetrics: LiveMetric[];
  hasUsable: boolean;
}): string {
  const { brief, voiceYaml, usableMetrics, suggestableMetrics, hasUsable } = args;
  const typeLabel = CONTENT_TYPE_LABELS[brief.contentType] || brief.contentType;
  const typeRules = CONTENT_TYPE_RULES[brief.contentType] || "Write a focused, conversion-ready asset.";

  const metricsBlock = hasUsable
    ? `VERIFIED / HIGH-CONFIDENCE LIVE METRICS (the ONLY numbers you may state as fact):\n${usableMetrics.map(metricLine).join("\n")}`
    : `NO verified or high-confidence live metrics are available. Do NOT include any numeric performance claims. Write a compelling asset WITHOUT inventing numbers.`;

  const suggestBlock = suggestableMetrics.length
    ? `\n\nMEDIUM-CONFIDENCE METRICS (may be referenced ONLY if you explicitly mark them "needs verification" in the body and in claims_needing_verification):\n${suggestableMetrics.map(metricLine).join("\n")}`
    : "";

  return `Produce a ${typeLabel}.

INPUTS:
- content_type: ${brief.contentType} (${typeLabel})
- target_audience: ${brief.targetAudience}
- funnel_stage: ${brief.funnelStage}
- intensity: ${brief.intensity}
- primary_cta: ${brief.primaryCta || "(none specified — propose one)"}
- product_focus: ${brief.productFocus || "ATOM Sales OS (overall)"}
- user_notes: ${brief.notes || "(none)"}

CONTENT-TYPE RULES:
${typeRules}

${metricsBlock}${suggestBlock}

VOICE PROFILE (voice.yaml) — obey every rule, tone, and banned-phrase constraint:
\`\`\`yaml
${voiceYaml}
\`\`\`

HARD RULES:
1. Never invent a metric. Only numbers from the verified list above may be stated as fact, and each must read naturally with its proof.
2. If a number would help but no verified metric exists, either omit it or phrase qualitatively.
3. Honor the intensity level from voice.yaml.
4. No medical, legal, financial, or guaranteed-outcome promises.
5. Match the asset structure to the content-type rules.

OUTPUT — return ONLY raw JSON (no markdown fences) with exactly these keys:
{
  "title": string,
  "asset_type": string,
  "content": string,            // the full asset body in markdown
  "summary": string,            // 1-2 sentence executive summary
  "cta": string,
  "live_numbers_used": [ { "metric_key": string, "label": string, "value": string, "source": string } ],
  "claims": [ string ],
  "claims_needing_verification": [ string ],
  "voice_compliance_notes": [ string ],
  "risk_flags": [ string ],
  "derivative_recommendations": [ string ]
}`;
}
