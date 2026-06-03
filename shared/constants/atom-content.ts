/**
 * ATOM Content Worker — shared constants + a minimal, dependency-free YAML
 * parser scoped to the voice.yaml shape. The repo has no YAML dependency, and
 * the voice profile structure is fixed and operator-edited, so a small parser
 * keeps the bundle lean while still letting the UI round-trip the profile.
 */

export interface VoiceProfileShape {
  brand_name: string;
  core_identity: string;
  tone: string[];
  style_rules: string[];
  approved_phrases: string[];
  banned_phrases: string[];
  sentence_shape: {
    preferred_sentence_length: string;
    allow_fragments_for_emphasis: boolean;
    avoid_long_paragraphs: boolean;
  };
  intensity_levels: Record<string, { description: string }>;
  compliance: {
    require_metric_verification: boolean;
    mark_unverified_claims: boolean;
    avoid_medical_legal_financial_promises: boolean;
    avoid_absolute_guarantees: boolean;
  };
}

export const DEFAULT_VOICE_YAML = `voice:
  brand_name: "ATOM Sales OS"
  core_identity: "Autonomous revenue command system"
  tone:
    - "executive"
    - "surgical"
    - "confident"
    - "cinematic"
    - "direct"
    - "revenue-focused"
    - "founder-grade"
  style_rules:
    - "Lead with business impact before technical detail."
    - "Use short, powerful sentences."
    - "Avoid generic SaaS language."
    - "Avoid fluffy motivational language."
    - "Sound like a command center, not a content calendar."
    - "Make the buyer feel the cost of inaction."
    - "Use proof, numbers, and operational clarity."
    - "Explain simply first, then go technical when needed."
    - "Position ATOM as an execution layer, not another dashboard."
  approved_phrases:
    - "Revenue command center"
    - "Autonomous sales execution"
    - "Pipeline that moves while your team sleeps"
    - "Signal-to-sale operating system"
    - "AI sales force with executive control"
    - "Command, not dashboards"
  banned_phrases:
    - "game changer"
    - "revolutionary solution"
    - "seamless experience"
    - "unlock your potential"
    - "supercharge your workflow"
    - "next-gen platform"
    - "all-in-one solution"
    - "AI-powered magic"
  sentence_shape:
    preferred_sentence_length: "short-to-medium"
    allow_fragments_for_emphasis: true
    avoid_long_paragraphs: true
  intensity_levels:
    calm:
      description: "Executive, polished, restrained."
    sharp:
      description: "Direct, competitive, conversion-focused."
    war_mode:
      description: "Aggressive, market-taking, high-conviction, still professional."
  compliance:
    require_metric_verification: true
    mark_unverified_claims: true
    avoid_medical_legal_financial_promises: true
    avoid_absolute_guarantees: true
`;

function stripQuotes(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function coerce(v: string): any {
  const t = v.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && !Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return stripQuotes(t);
}

interface RawLine { indent: number; key: string | null; value: string | null; isItem: boolean; }

function tokenize(yaml: string): RawLine[] {
  const out: RawLine[] = [];
  for (const raw of yaml.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (line.startsWith("- ")) {
      out.push({ indent, key: null, value: line.slice(2), isItem: true });
      continue;
    }
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out.push({ indent, key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim(), isItem: false });
  }
  return out;
}

/**
 * Recursive-descent build of a block at `baseIndent`. Consumes lines from the
 * shared cursor object. Produces either a plain object (mapping keys) — list
 * values are attached as arrays under their owning key.
 */
function buildBlock(lines: RawLine[], cursor: { i: number }, baseIndent: number): any {
  const node: any = {};
  while (cursor.i < lines.length) {
    const ln = lines[cursor.i];
    if (ln.indent < baseIndent) break;
    if (ln.indent > baseIndent) {
      // Should have been consumed by a child build; skip defensively.
      cursor.i++;
      continue;
    }
    if (ln.isItem) break; // lists are handled by the owning key below
    cursor.i++;
    const key = ln.key as string;
    if (ln.value && ln.value.length > 0) {
      node[key] = coerce(ln.value);
      continue;
    }
    // value-less key: nested block — either a list (next line is item) or a map.
    const next = lines[cursor.i];
    if (next && next.indent > baseIndent && next.isItem) {
      const items: any[] = [];
      while (cursor.i < lines.length && lines[cursor.i].indent > baseIndent && lines[cursor.i].isItem) {
        items.push(coerce(lines[cursor.i].value as string));
        cursor.i++;
      }
      node[key] = items;
    } else if (next && next.indent > baseIndent) {
      node[key] = buildBlock(lines, cursor, next.indent);
    } else {
      node[key] = {};
    }
  }
  return node;
}

/**
 * Parse the voice.yaml document into a VoiceProfileShape. Tolerant of the
 * specific 2-space-indented structure used by voice.yaml. Falls back to the
 * default profile for any missing/garbled field so generation never crashes.
 */
export function parseVoiceYaml(yaml: string): VoiceProfileShape {
  let root: any = {};
  try {
    const lines = tokenize(yaml);
    if (lines.length) root = buildBlock(lines, { i: 0 }, lines[0].indent);
  } catch {
    root = {};
  }

  const v = (root.voice ?? root) as any;
  const def = parseShapeFromDefault();
  const arr = (x: any, d: string[]) => (Array.isArray(x) && x.length ? x.map(String) : d);
  const intensity = (() => {
    const out: Record<string, { description: string }> = {};
    const src = v.intensity_levels;
    if (src && typeof src === "object" && !Array.isArray(src)) {
      for (const k of Object.keys(src)) {
        const d = src[k]?.description;
        out[k] = { description: typeof d === "string" ? d : "" };
      }
    }
    return Object.keys(out).length ? out : def.intensity_levels;
  })();

  return {
    brand_name: typeof v.brand_name === "string" ? v.brand_name : def.brand_name,
    core_identity: typeof v.core_identity === "string" ? v.core_identity : def.core_identity,
    tone: arr(v.tone, def.tone),
    style_rules: arr(v.style_rules, def.style_rules),
    approved_phrases: arr(v.approved_phrases, def.approved_phrases),
    banned_phrases: arr(v.banned_phrases, def.banned_phrases),
    sentence_shape: {
      preferred_sentence_length:
        v.sentence_shape?.preferred_sentence_length ?? def.sentence_shape.preferred_sentence_length,
      allow_fragments_for_emphasis:
        typeof v.sentence_shape?.allow_fragments_for_emphasis === "boolean"
          ? v.sentence_shape.allow_fragments_for_emphasis
          : def.sentence_shape.allow_fragments_for_emphasis,
      avoid_long_paragraphs:
        typeof v.sentence_shape?.avoid_long_paragraphs === "boolean"
          ? v.sentence_shape.avoid_long_paragraphs
          : def.sentence_shape.avoid_long_paragraphs,
    },
    intensity_levels: intensity,
    compliance: {
      require_metric_verification:
        typeof v.compliance?.require_metric_verification === "boolean"
          ? v.compliance.require_metric_verification
          : def.compliance.require_metric_verification,
      mark_unverified_claims:
        typeof v.compliance?.mark_unverified_claims === "boolean"
          ? v.compliance.mark_unverified_claims
          : def.compliance.mark_unverified_claims,
      avoid_medical_legal_financial_promises:
        typeof v.compliance?.avoid_medical_legal_financial_promises === "boolean"
          ? v.compliance.avoid_medical_legal_financial_promises
          : def.compliance.avoid_medical_legal_financial_promises,
      avoid_absolute_guarantees:
        typeof v.compliance?.avoid_absolute_guarantees === "boolean"
          ? v.compliance.avoid_absolute_guarantees
          : def.compliance.avoid_absolute_guarantees,
    },
  };
}

// The default profile, expressed directly so parseVoiceYaml can fall back to
// it field-by-field without risking infinite recursion through the parser.
function parseShapeFromDefault(): VoiceProfileShape {
  return {
    brand_name: "ATOM Sales OS",
    core_identity: "Autonomous revenue command system",
    tone: ["executive", "surgical", "confident", "cinematic", "direct", "revenue-focused", "founder-grade"],
    style_rules: [
      "Lead with business impact before technical detail.",
      "Use short, powerful sentences.",
      "Avoid generic SaaS language.",
      "Avoid fluffy motivational language.",
      "Sound like a command center, not a content calendar.",
      "Make the buyer feel the cost of inaction.",
      "Use proof, numbers, and operational clarity.",
      "Explain simply first, then go technical when needed.",
      "Position ATOM as an execution layer, not another dashboard.",
    ],
    approved_phrases: [
      "Revenue command center",
      "Autonomous sales execution",
      "Pipeline that moves while your team sleeps",
      "Signal-to-sale operating system",
      "AI sales force with executive control",
      "Command, not dashboards",
    ],
    banned_phrases: [
      "game changer",
      "revolutionary solution",
      "seamless experience",
      "unlock your potential",
      "supercharge your workflow",
      "next-gen platform",
      "all-in-one solution",
      "AI-powered magic",
    ],
    sentence_shape: {
      preferred_sentence_length: "short-to-medium",
      allow_fragments_for_emphasis: true,
      avoid_long_paragraphs: true,
    },
    intensity_levels: {
      calm: { description: "Executive, polished, restrained." },
      sharp: { description: "Direct, competitive, conversion-focused." },
      war_mode: { description: "Aggressive, market-taking, high-conviction, still professional." },
    },
    compliance: {
      require_metric_verification: true,
      mark_unverified_claims: true,
      avoid_medical_legal_financial_promises: true,
      avoid_absolute_guarantees: true,
    },
  };
}

export const DEFAULT_VOICE_PROFILE: VoiceProfileShape = parseShapeFromDefault();

export interface VoiceYamlValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** The parsed profile (with per-field default fallback) — only meaningful when valid. */
  profile: VoiceProfileShape;
}

/**
 * Validate a voice.yaml document before accepting it. parseVoiceYaml is
 * deliberately tolerant (it falls back field-by-field so generation never
 * crashes), but that tolerance is wrong at the save boundary: an operator who
 * submits garbage or clears every banned phrase should get a clear failure, not
 * a silent restore-to-defaults reported as "valid".
 *
 * Rules:
 *  - The document must parse into a recognizable voice structure (at least one
 *    of the core keys present). Pure garbage is rejected.
 *  - banned_phrases must be a non-empty list. Clearing it removes the brand's
 *    primary tone guardrail, so we reject rather than silently re-seed defaults.
 *  - Empty/whitespace input is rejected (callers should keep the existing
 *    profile or fall back to DEFAULT_VOICE_YAML explicitly, not via a blank save).
 */
export function validateVoiceYaml(yaml: string): VoiceYamlValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!yaml || !yaml.trim()) {
    return { valid: false, errors: ["Voice profile is empty."], warnings, profile: DEFAULT_VOICE_PROFILE };
  }

  let root: any = {};
  let tokenizedAny = false;
  try {
    const lines = tokenize(yaml);
    tokenizedAny = lines.length > 0;
    if (lines.length) root = buildBlock(lines, { i: 0 }, lines[0].indent);
  } catch {
    return { valid: false, errors: ["Voice profile is not valid YAML."], warnings, profile: DEFAULT_VOICE_PROFILE };
  }

  const v = (root.voice ?? root) as any;
  const CORE_KEYS = ["brand_name", "core_identity", "tone", "style_rules", "approved_phrases", "banned_phrases"];
  const recognized = v && typeof v === "object" && CORE_KEYS.some((k) => k in v);
  if (!tokenizedAny || !recognized) {
    errors.push("Voice profile does not contain a recognizable voice structure (expected keys like brand_name, tone, banned_phrases).");
  }

  // banned_phrases must be present and non-empty — it is the core tone guardrail.
  if (recognized) {
    const banned = v.banned_phrases;
    if (!Array.isArray(banned) || banned.filter((b: any) => String(b).trim()).length === 0) {
      errors.push("banned_phrases must list at least one phrase. Clearing it disables the brand-voice guardrail.");
    }
    if (!("brand_name" in v) || !String(v.brand_name ?? "").trim()) {
      warnings.push("brand_name is missing; the default brand name will be used.");
    }
    if (!Array.isArray(v.tone) || v.tone.length === 0) {
      warnings.push("tone is empty; default tone descriptors will be used.");
    }
  }

  const profile = parseVoiceYaml(yaml);
  return { valid: errors.length === 0, errors, warnings, profile };
}

// Weak SaaS filler the voice checker flags beyond explicit banned phrases.
export const WEAK_FILLER_PATTERNS = [
  "leverage", "synergy", "cutting-edge", "best-in-class", "world-class",
  "robust", "holistic", "paradigm", "frictionless", "turnkey", "bandwidth",
  "circle back", "low-hanging fruit", "move the needle", "value-add",
];

// Absolute terms the claim checker flags unless backed by approved proof.
export const ABSOLUTE_CLAIM_TERMS = [
  "guaranteed", "guarantee", "always", "never", "best", "#1", "number one",
  "100%", "fastest", "cheapest", "only", "instantly", "zero risk", "risk-free",
];

// Domains that demand a compliance warning when asserted as outcomes.
export const COMPLIANCE_RISK_TERMS = [
  "cure", "diagnose", "treatment", "fda", "hipaa-certified", "guaranteed roi",
  "guaranteed return", "tax", "legal advice", "investment advice",
];

/**
 * Server-side publish/approval guard policy for ATOM Content.
 *
 * claimChecker scores a clean, claim-free or fully-verified asset at exactly
 * 100 (rejected claims −25, needs_review −8, compliance warnings −10). 100 is
 * therefore the project's existing semantics for "perfect claim safety", so the
 * approve/export guard requires a claimScore of 100 — anything lower means the
 * scorer found at least one unsupported, review-state, or compliance-risk claim
 * and the asset must not be promoted to approved/exported.
 */
export const PUBLISH_MIN_CLAIM_SCORE = 100;

/**
 * Claim verdicts that block approval/export. `rejected` is an unsupported /
 * fabricated factual claim; `needs_review` covers demo-backed, medium-confidence
 * and absolute claims that are not yet defensible. Default product policy blocks
 * BOTH — review-state claims must be resolved (verified or removed) before an
 * asset can be approved or exported. Flip ALLOW_REVIEW_STATE_APPROVAL only if a
 * future policy explicitly permits promoting needs_review content.
 */
export const ALLOW_REVIEW_STATE_APPROVAL = false;
export const BLOCKING_CLAIM_VERDICTS: readonly string[] =
  ALLOW_REVIEW_STATE_APPROVAL ? ["rejected"] : ["rejected", "needs_review"];

/** Actions that promote a generation to a published/exported state and must pass the guard. */
export const GUARDED_APPROVAL_ACTIONS: readonly string[] = ["approved", "exported"];
