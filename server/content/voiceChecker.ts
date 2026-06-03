/**
 * voiceChecker — scores generated output against the active voice profile
 * (voice.yaml). Detects banned phrases and weak SaaS filler, checks sentence
 * shape rules, and returns a 0-100 tone-compliance score with actionable
 * rewrites.
 */
import {
  parseVoiceYaml,
  WEAK_FILLER_PATTERNS,
  type VoiceProfileShape,
} from "@shared/constants/atom-content";

export interface VoiceViolation {
  type: "banned_phrase" | "weak_filler" | "long_paragraph" | "long_sentence";
  detail: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

export interface VoiceReport {
  score: number; // 0-100
  violations: VoiceViolation[];
  suggestedRewrites: string[];
  approvedPhrasesUsed: string[];
  bannedPhrasesFound: string[];
  weakFillerFound: string[];
  summary: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkVoice(content: string, yamlOrProfile: string | VoiceProfileShape): VoiceReport {
  const profile: VoiceProfileShape =
    typeof yamlOrProfile === "string" ? parseVoiceYaml(yamlOrProfile) : yamlOrProfile;

  const lower = content.toLowerCase();
  const violations: VoiceViolation[] = [];
  const suggestedRewrites: string[] = [];
  const bannedPhrasesFound: string[] = [];
  const weakFillerFound: string[] = [];

  // Banned phrases — hard penalty.
  for (const phrase of profile.banned_phrases) {
    const re = new RegExp(escapeRegExp(phrase.toLowerCase()), "g");
    if (re.test(lower)) {
      bannedPhrasesFound.push(phrase);
      violations.push({
        type: "banned_phrase",
        detail: `Uses banned phrase "${phrase}".`,
        severity: "high",
        suggestion: `Remove "${phrase}" — replace with concrete operational outcome.`,
      });
      suggestedRewrites.push(`Strip "${phrase}" and lead with a measurable business outcome instead.`);
    }
  }

  // Weak SaaS filler — medium penalty.
  for (const filler of WEAK_FILLER_PATTERNS) {
    const re = new RegExp(`\\b${escapeRegExp(filler)}\\b`, "i");
    if (re.test(content)) {
      weakFillerFound.push(filler);
      violations.push({
        type: "weak_filler",
        detail: `Contains weak SaaS filler "${filler}".`,
        severity: "medium",
        suggestion: `Replace "${filler}" with a sharp, specific verb or a number.`,
      });
    }
  }

  // Sentence shape — long paragraphs.
  if (profile.sentence_shape.avoid_long_paragraphs) {
    const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      const words = p.split(/\s+/).length;
      if (words > 90) {
        violations.push({
          type: "long_paragraph",
          detail: `A paragraph runs ${words} words — too dense for a command-center voice.`,
          severity: "low",
          suggestion: "Break into 2-3 short paragraphs. Lead each with the point.",
        });
        break; // one flag is enough signal
      }
    }
  }

  // Sentence length — flag a few very long sentences.
  const sentences = countSentences(content);
  const longSentences = sentences.filter((s) => s.split(/\s+/).length > 38);
  if (longSentences.length > 0) {
    violations.push({
      type: "long_sentence",
      detail: `${longSentences.length} sentence(s) exceed 38 words.`,
      severity: "low",
      suggestion: "Cut long sentences in half. Short, powerful lines convert.",
    });
  }

  // Approved phrases used — positive signal.
  const approvedPhrasesUsed = profile.approved_phrases.filter((p) =>
    lower.includes(p.toLowerCase()),
  );

  // Score: start at 100, subtract by severity, add small credit for approved phrases.
  let score = 100;
  for (const v of violations) {
    score -= v.severity === "high" ? 18 : v.severity === "medium" ? 7 : 3;
  }
  score += Math.min(approvedPhrasesUsed.length * 2, 6);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const summary =
    bannedPhrasesFound.length > 0
      ? `Tone breach: ${bannedPhrasesFound.length} banned phrase(s). Rewrite before publishing.`
      : weakFillerFound.length > 2
        ? "Tone drift: too much generic SaaS filler. Tighten toward operational specifics."
        : score >= 85
          ? "On-voice. Reads like a revenue command center."
          : "Acceptable, but tighten for sharper executive tone.";

  return {
    score,
    violations,
    suggestedRewrites,
    approvedPhrasesUsed,
    bannedPhrasesFound,
    weakFillerFound,
    summary,
  };
}
