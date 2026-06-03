/**
 * Offline smoke test for ATOM Content proof-integrity hardening. Exercises the
 * pure functions (checkClaims, unitClass, validateVoiceYaml) against fixtures —
 * no DB, no network, no API key.
 * Run: `npx tsx scripts/atom-content-proof-smoke.ts`
 *
 * Covers the review's blocking cases:
 *   a. "pipeline conversion hit 42%" must NOT verify against leads_generated=42
 *   b. "We onboarded 42 enterprise logos" must be detected (not ignored, score!=100)
 *   c. demo metric cannot verify a production claim when allowDemoData is off
 *   d. demo metric evidence is clearly marked when allowDemoData is on
 *   e. best-first LinkedIn prompt produces no fake metrics when none are verified
 */
import { checkClaims, unitClass } from "../server/content/claimChecker";
import type { LiveMetric, LiveNumbersResult } from "../server/content/liveNumbersEngine";
import { validateVoiceYaml, DEFAULT_VOICE_YAML } from "../shared/constants/atom-content";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

function metric(p: Partial<LiveMetric> & { metricKey: string; value: number; unit: string }): LiveMetric {
  const confidence = p.confidence ?? "high";
  return {
    metricKey: p.metricKey,
    metricLabel: p.metricLabel ?? p.metricKey,
    value: p.value,
    unit: p.unit,
    display: p.display ?? String(p.value),
    sourceSystem: p.sourceSystem ?? "atom-leadgen",
    sourceRecordId: p.sourceRecordId ?? null,
    confidence,
    capturedAt: p.capturedAt ?? "2026-06-01T00:00:00.000Z",
    isDemo: p.isDemo ?? false,
    usableInFinal: confidence === "verified" || confidence === "high",
    suggestableOnly: confidence === "medium",
  };
}

function live(metrics: LiveMetric[], demoMode: boolean): LiveNumbersResult {
  const usable = metrics.filter((m) => m.usableInFinal);
  const suggestable = metrics.filter((m) => m.suggestableOnly);
  const unusable = metrics.filter((m) => !m.usableInFinal && !m.suggestableOnly);
  return {
    metrics, usable, suggestable, unusable,
    hasUsable: usable.length > 0,
    fallbackMessage: usable.length ? null : "No verified metrics.",
    demoMode,
  };
}

// Mirrors the seeded demo metrics that triggered the original bug.
const leadsGenerated42 = metric({ metricKey: "leads_generated", metricLabel: "Leads generated", value: 42, unit: "", display: "42", confidence: "high" });
const replyRate31 = metric({ metricKey: "reply_rate_delta", metricLabel: "Reply-rate increase", value: 31, unit: "%", display: "31%", sourceSystem: "campaigns", confidence: "verified" });

// ─── unitClass ───────────────────────────────────────────────────────────────
console.log("unitClass");
assert(unitClass("%") === "percent", "% is percent");
assert(unitClass("percent") === "percent", "percent is percent");
assert(unitClass("$") === "currency" && unitClass("$M") === "currency", "$ and $M are currency");
assert(unitClass("") === "count" && unitClass("events") === "count", "bare/events are count");
assert(unitClass("hrs") === "duration", "hrs is duration");

// ─── (a) percent claim must NOT bind to a count metric of equal value ─────────
console.log("\n(a) unit-blind matching closed");
{
  const report = checkClaims("Our pipeline conversion hit 42%.", live([leadsGenerated42], false));
  const c = report.claims.find((x) => x.claimText.includes("42%"));
  assert(!!c, "a 42% claim is detected");
  assert(c?.verified === "rejected", "42% does NOT verify against leads_generated=42 (rejected)");
  assert(c?.metricKey !== "leads_generated", "42% is not bound to leads_generated");
  assert(report.score < 100, `score penalized (got ${report.score})`);
}

// percent claim that DOES match a percent metric should verify
{
  const report = checkClaims("Reply rates climbed 31%.", live([replyRate31], false));
  const c = report.claims.find((x) => x.claimText.includes("31%"));
  assert(c?.verified === "verified", "31% verifies against reply_rate_delta=31% (verified)");
}

// ─── (b) plain-count fabrication is detected, not ignored ─────────────────────
console.log("\n(b) fabricated plain counts detected");
{
  const report = checkClaims("We onboarded 42 enterprise logos.", live([], false));
  assert(report.claims.length > 0, "the count claim is detected (not ignored)");
  const c = report.claims[0];
  assert(c.verified === "rejected" || c.verified === "needs_review", `count claim is rejected/needs_review (got ${c.verified})`);
  assert(report.score < 100, `claimScore is NOT 100 (got ${report.score})`);
}

// ─── (c) demo metric cannot verify a production claim (demo off) ──────────────
console.log("\n(c) demo data cannot back production claims when disabled");
{
  const demoLeads = metric({ metricKey: "leads_generated", value: 42, unit: "", display: "42", isDemo: true, confidence: "high" });
  // claim is a plain count of 42 — same unit class as the demo metric
  const report = checkClaims("We generated 42 leads.", live([demoLeads], /* demoMode */ false));
  const c = report.claims[0];
  assert(c.verified === "rejected", `demo metric rejected when allowDemoData=false (got ${c.verified})`);
  assert(c.metricKey === null, "no demo metric bound when demo disabled");
}

// ─── (d) demo metric evidence is clearly marked (demo on) ─────────────────────
console.log("\n(d) demo provenance clearly marked when enabled");
{
  const demoLeads = metric({ metricKey: "leads_generated", value: 42, unit: "", display: "42", isDemo: true, confidence: "high" });
  const report = checkClaims("We generated 42 leads.", live([demoLeads], /* demoMode */ true));
  const c = report.claims[0];
  assert(c.verified === "needs_review", `demo-backed claim is needs_review, never verified (got ${c.verified})`);
  assert(/DEMO/i.test(c.note), "claim note flags DEMO provenance");
  assert(report.riskFlags.some((f) => /demo/i.test(f)), "riskFlags warn about demo backing");
}

// ─── (e) best-first LinkedIn output with no metrics → no fake numbers ─────────
console.log("\n(e) no verified metrics → no fabricated proof");
{
  // The demo LinkedIn body when hasUsable=false states no numbers.
  const linkedinNoMetrics = [
    "Your team doesn't need another dashboard. It needs to close more, faster.",
    "ATOM Sales OS is a revenue command center — autonomous sales execution.",
    "We're not citing numbers here: no verified live metrics are attached to this draft, and ATOM Content does not invent proof.",
    "Book a live walkthrough.",
  ].join("\n\n");
  const report = checkClaims(linkedinNoMetrics, live([], false));
  const numericClaims = report.claims.filter((c) => c.claimType === "metric");
  assert(numericClaims.length === 0, "no numeric/metric claims asserted when no metrics exist");
  assert(report.score === 100, `claimScore stays 100 with zero numeric claims (got ${report.score})`);
}

// ─── voice YAML validation ────────────────────────────────────────────────────
console.log("\nvoice YAML validation");
assert(validateVoiceYaml(DEFAULT_VOICE_YAML).valid, "default voice.yaml is valid");
assert(!validateVoiceYaml("").valid, "empty voice profile is rejected");
assert(!validateVoiceYaml("just some random words\nnot yaml at all").valid, "garbage is rejected");
{
  const clearedBanned = DEFAULT_VOICE_YAML.replace(/  banned_phrases:[\s\S]*?  sentence_shape:/, "  banned_phrases:\n  sentence_shape:");
  const v = validateVoiceYaml(clearedBanned);
  assert(!v.valid, "clearing banned_phrases is rejected (guardrail removed)");
  assert(v.errors.some((e) => /banned_phrases/.test(e)), "error names banned_phrases");
}

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
