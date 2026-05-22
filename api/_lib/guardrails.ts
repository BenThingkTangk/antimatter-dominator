/**
 * LLM output guardrails — defense-in-depth for AI-generated sales content.
 *
 * Scans pitch / objection-handler / warbook text for patterns that violate
 * FTC Act § 5, TCPA, or internal ATOM compliance rules:
 *   - Fake urgency / scarcity tactics
 *   - Fearmongering / disaster language
 *   - Closing or payment instructions (AI must never close)
 *   - AI pretending to be human
 *   - Medical / health claims without evidence
 *
 * Usage:
 *   import { checkGuardrails } from "../_lib/guardrails";
 *   const check = checkGuardrails(llmOutput);
 *   if (check.blocked) { ... }
 */

interface GuardrailPattern {
  id: string;
  regex: RegExp;
  block: boolean;
  replacement?: string;
}

const PATTERNS: GuardrailPattern[] = [
  { id: "no_fake_urgency", regex: /\b(today only|last chance|going up|act now|limited time|expires tonight|price increases)\b/i, block: true },
  { id: "no_fearmongering", regex: /\b(you'll lose|disaster|catastroph|breach is coming|terminally ill|going to die|you'll be hacked)\b/i, block: true },
  { id: "no_closing_by_ai", regex: /\b(sign here|wire the funds|swipe your card|charging your card now|enter your credit card|send payment)\b/i, block: true },
  { id: "no_ai_pretending_human", regex: /\b(I'm just like you|I'm human|I have feelings|I am a person|I'm a real person)\b/i, block: true },
  { id: "no_medical_claim", regex: /\b(cure[sd]?|treats|prevents disease|FDA[- ]approved|clinically proven to)\b/i, block: true },
];

export interface GuardrailResult {
  blocked: boolean;
  reason?: string;
  patternId?: string;
  match?: string;
}

/**
 * Check text against guardrail patterns. Returns blocked=true if any
 * blocking pattern matches.
 */
export function checkGuardrails(text: string): GuardrailResult {
  if (!text) return { blocked: false };
  try {
    for (const p of PATTERNS) {
      const m = text.match(p.regex);
      if (m && p.block) {
        return { blocked: true, reason: p.id, patternId: p.id, match: m[0] };
      }
    }
  } catch (e) {
    // Never crash the app on guardrail failure — return text unchanged
    console.warn("[guardrails] pattern check error:", e);
  }
  return { blocked: false };
}

/**
 * Apply guardrails to text. If a blocking pattern is found, returns a
 * sanitized version with the offending phrase replaced. If no match,
 * returns the original text unchanged.
 */
export function applyGuardrails(text: string): { text: string; modified: boolean; reason?: string } {
  if (!text) return { text, modified: false };
  try {
    let modified = false;
    let result = text;
    let firstReason: string | undefined;
    for (const p of PATTERNS) {
      if (p.regex.test(result)) {
        if (!firstReason) firstReason = p.id;
        // Replace the matched phrase with a safer placeholder
        result = result.replace(p.regex, "[removed for compliance]");
        modified = true;
      }
    }
    if (modified) {
      console.warn(`[guardrails] sanitized output — first match: ${firstReason}`);
    }
    return { text: result, modified, reason: firstReason };
  } catch (e) {
    console.warn("[guardrails] apply error:", e);
    return { text, modified: false };
  }
}
