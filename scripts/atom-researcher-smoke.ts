/**
 * Offline smoke test for the ATOM Researcher engine: citation/source-map
 * hardening AND the multi-source search strategy (recency relaxation +
 * source-strategy prompt). Runs the pure functions against simulated Perplexity
 * response shapes — no network, no API key.
 * Run: `npx tsx scripts/atom-researcher-smoke.ts`
 */
import {
  harvestCitations,
  parseDossier,
  ensureSourceMapMarkdown,
  strategyForMode,
  buildUserPrompt,
} from "../api/_lib/atom-researcher";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

// A dossier whose Source Map section has numeric refs but NO literal URLs —
// exactly the live-run failure mode (36 [n] markers, 0 http links).
const markdown = `## 1. Executive Brief
Cloudflare is a leading edge platform [1][2]. Strong momentum [3].

## 4. Buying Signals
Funding: NOT DETECTED — no recent raise.
Hiring: DETECTED — aggressive infra hiring [4].
Expansion: DETECTED — new regions [5].
Product launch: NOT DETECTED.
Compliance pressure: NOT DETECTED.
Tech migration: NOT DETECTED.
Competitor weakness: NOT DETECTED.
Leadership change: NOT DETECTED.
Customer pain: NOT DETECTED.
Market event: NOT DETECTED.

## 11. Confidence + Gaps
Confidence: 82%
VERIFIED: public filings. INFERRED: roadmap.

## 12. Source Map
1. Cloudflare investor relations — financials
2. TechCrunch coverage — recent news`;

// Case A: newer Sonar shape — citations as OBJECTS + search_results.
const liveData = {
  choices: [{ message: { content: markdown } }],
  citations: [
    { url: "https://cloudflare.com/investor", title: "Cloudflare IR", date: "2026-04-10" },
    { url: "https://techcrunch.com/cf", title: "TechCrunch: Cloudflare" },
  ],
  search_results: [
    { url: "https://sec.gov/cf-10k", title: "Cloudflare 10-K", date: "2026-02-01" },
    { url: "https://reuters.com/cf-news", title: "Reuters" },
    { url: "https://cloudflare.com/investor", title: "dup — should dedupe" },
  ],
};

const cites = harvestCitations(liveData);
assert(cites.length === 4, `harvestCitations dedupes objects+search_results → 4 (got ${cites.length})`);
assert(cites.every((c) => /^https?:\/\//.test(c.url)), "every harvested citation has a real URL");
assert(cites.some((c) => c.date === "2026-02-01"), "dates are carried through");

const dossier = parseDossier(markdown, cites, { companyName: "Cloudflare", domain: "cloudflare.com" }, "vibranium_war_room");
assert(dossier.sourceMap.length === 4, `sourceMap built from API citations → 4 (got ${dossier.sourceMap.length})`);
assert(typeof dossier.confidenceScore === "number" && dossier.confidenceScore === 82, `confidenceScore populated as number 82 (got ${dossier.confidenceScore})`);
assert(dossier.confidence === dossier.confidenceScore, "confidence and confidenceScore agree");
assert(dossier.sourceCount === 4, "sourceCount mirrors sourceMap length");
assert(dossier.sourceMap.some((s) => s.tier === "primary"), "sec.gov / company domain scored primary");
assert(!dossier.sourceThin, "4 sources → not source-thin");

const enriched = ensureSourceMapMarkdown(markdown, dossier.sourceMap);
assert(/https?:\/\//.test(enriched), "URL-less Source Map stub gets real URLs appended");
assert((enriched.match(/## 12\. Source Map/g) || []).length === 1, "exactly one Source Map section after enrichment");
assert(enriched.includes("https://sec.gov/cf-10k"), "appended map includes an API-only URL the model never wrote");

// Case B: legacy string[] citations + already-linked source map → unchanged.
const legacy = harvestCitations({ citations: ["https://a.com", "https://b.com", "https://c.com"] });
assert(legacy.length === 3, "legacy string[] citations still parse");
const linkedMd = `## 12. Source Map\n1. [A](https://a.com) — x`;
const d2 = parseDossier(linkedMd, legacy, { companyName: "X" }, "fast_scan");
assert(ensureSourceMapMarkdown(linkedMd, d2.sourceMap) === linkedMd, "already-linked source map left untouched");

// Case C: source-thin (<3 citations) flag.
const thin = parseDossier("## 1. Executive Brief\nx", harvestCitations({ citations: ["https://only.com"] }), { companyName: "Y" }, "fast_scan");
assert(thin.sourceThin === true, "1 citation → sourceThin true");
assert(thin.confidence <= 55, "source-thin caps confidence ≤ 55");

// Case D: multi-source strategy — deep tiers must NOT hard-filter recency,
// and the user prompt must demand multiple distinct primary/credible sources.
const vib = strategyForMode("vibranium_war_room");
assert(vib.recency === undefined, "vibranium_war_room has NO hard recency filter (was 'week')");
assert(strategyForMode("deep_research").recency === undefined, "deep_research has NO hard recency filter");
assert(strategyForMode("pro_dossier").recency === undefined, "pro_dossier has NO hard recency filter");
assert(strategyForMode("fast_scan").recency === undefined, "fast_scan no longer caps recency to a month");
assert(vib.searchContextSize === "high", "vibranium keeps high search_context_size");
assert(strategyForMode("deep_research").searchContextSize === "high", "deep_research keeps high search_context_size");

const vibPrompt = buildUserPrompt({ companyName: "Cloudflare", domain: "cloudflare.com" }, "vibranium_war_room");
assert(/at least 8/.test(vibPrompt), "vibranium prompt demands >= 8 distinct sources");
assert(/SOURCE STRATEGY \(MANDATORY\)/.test(vibPrompt), "vibranium prompt has mandatory source-strategy block");
assert(/Investor relations \/ SEC filings/.test(vibPrompt), "prompt names primary/official source types (IR/SEC)");
assert(/never build the dossier from a single article/i.test(vibPrompt), "prompt forbids single-article dossiers");
assert(/Source Map MUST be URL-rich/.test(vibPrompt), "prompt requires a URL-rich source map");

const fastPrompt = buildUserPrompt({ companyName: "Cloudflare" }, "fast_scan");
assert(/at least 3 DISTINCT/.test(fastPrompt), "fast_scan still asks for >= 3 distinct sources");
assert(fastPrompt.length < vibPrompt.length, "fast_scan prompt stays more compact than vibranium");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
