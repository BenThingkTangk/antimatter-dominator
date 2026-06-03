/**
 * DB-backed smoke test for ATOM Content production-metric ingestion.
 * Verifies the proof-integrity contract added by the ingestion path:
 *
 *   1. ingestion creates PRODUCTION metrics (isDemo=false) with demo:false metadata
 *   2. ingestion does NOT overwrite or demo-promote the seeded demo metrics
 *   3. liveNumbersEngine returns ingested verified/high production metrics by default
 *   4. claimChecker can verify a matching claim against an ingested production metric
 *   5. unverified/demo metrics remain blocked by the PR#14 publish-guard behavior
 *   6. re-ingestion is idempotent (upsert, not duplicate)
 *
 * This imports server/storage which opens the real SQLite file and seeds demo
 * metrics — exactly the state we need to prove demo isolation. It seeds a couple
 * of production prospect/campaign rows, runs ingestion, and asserts. It cleans up
 * the production rows it created on exit.
 * Run: `npx tsx scripts/atom-content-ingest-smoke.ts`
 */
import { storage } from "../server/storage";
import { runIngestion, previewIngestion } from "../server/content/productActivityIngestion";
import { getLiveNumbers } from "../server/content/liveNumbersEngine";
import { checkClaims } from "../server/content/claimChecker";
import { evaluatePublishGuard } from "../server/content/publishGuard";
import type { ContentClaim } from "../shared/schema";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

const now = new Date().toISOString();

// ── Seed real production source rows ─────────────────────────────────────────
// 5 prospects: 1 new, 1 contacted, 1 engaged, 2 qualified → totals are exact.
const seededProspectNames = ["ING-SMOKE-A", "ING-SMOKE-B", "ING-SMOKE-C", "ING-SMOKE-D", "ING-SMOKE-E"];
const prospectStatuses = ["new", "contacted", "engaged", "qualified", "qualified"];
seededProspectNames.forEach((name, i) => {
  storage.createProspect({
    companyName: name, industry: "smoke-test", score: 80, reason: "smoke", matchedProducts: "[]",
    signals: "[]", companySize: "smb", urgency: "low", lastUpdated: now, status: prospectStatuses[i],
  });
});

const baselineTotal = storage.getProspects().length; // includes any pre-existing prospects

// ── Snapshot demo metrics BEFORE ingestion ───────────────────────────────────
const demoBefore = storage.getProductActivityMetrics({ includeDemo: true }).filter((m) => m.isDemo);
const demoBeforeKeys = demoBefore.map((m) => `${m.metricKey}|${m.metricValue}|${m.confidence}`).sort();
assert(demoBefore.length > 0, `demo metrics are seeded (found ${demoBefore.length})`);

// ── (preview is pure / persists nothing) ─────────────────────────────────────
console.log("\npreview is pure (no persistence)");
{
  const prodMetricsBefore = storage.getProductActivityMetrics({ includeDemo: false }).length;
  const pv = previewIngestion();
  const prodMetricsAfter = storage.getProductActivityMetrics({ includeDemo: false }).length;
  assert(prodMetricsAfter === prodMetricsBefore, "preview() did not persist anything");
  assert(pv.totalMetrics > 0, `preview derived metrics from production data (${pv.totalMetrics})`);
  assert(pv.metrics.every((m) => (m.metadata as any).demo === false), "every previewed metric carries demo:false metadata");
}

// ── (1) ingestion creates production metrics with demo:false metadata ─────────
console.log("\n(1) ingestion creates production metrics (demo=false)");
const result = runIngestion();
assert(result.persisted > 0, `ingestion persisted production metrics (${result.persisted})`);
assert(result.demo === false, "ingestion result is flagged demo:false");
const prodAfter = storage.getProductActivityMetrics({ includeDemo: false });
const leadsRow = prodAfter.find((m) => m.metricKey === "leads_generated" && m.sourceSystem === "atom-prospects");
assert(!!leadsRow, "leads_generated production row exists");
assert(leadsRow?.isDemo === false, "leads_generated row is isDemo=false");
assert(leadsRow?.metricValue === baselineTotal, `leads_generated == prospect count (${leadsRow?.metricValue} == ${baselineTotal})`);
{
  const meta = JSON.parse(leadsRow!.metadataJson || "{}");
  assert(meta.demo === false, "persisted metadata has demo:false");
  assert(!!meta.window, "persisted metadata carries the derivation window");
  assert(typeof meta.source_count === "number", "persisted metadata carries source_count");
}
// meetings_booked = qualified count (>= 2 from our seed)
const meetingsRow = prodAfter.find((m) => m.metricKey === "meetings_booked");
assert(!!meetingsRow && meetingsRow.metricValue >= 2, `meetings_booked reflects qualified prospects (${meetingsRow?.metricValue})`);

// ── (2) ingestion does NOT overwrite or demo-promote seeded demo metrics ──────
console.log("\n(2) demo metrics untouched / never promoted");
{
  const demoAfter = storage.getProductActivityMetrics({ includeDemo: true }).filter((m) => m.isDemo);
  const demoAfterKeys = demoAfter.map((m) => `${m.metricKey}|${m.metricValue}|${m.confidence}`).sort();
  assert(demoAfter.length === demoBefore.length, `demo metric count unchanged (${demoBefore.length} → ${demoAfter.length})`);
  assert(JSON.stringify(demoAfterKeys) === JSON.stringify(demoBeforeKeys), "demo metric values/confidence unchanged");
  assert(prodAfter.every((m) => m.isDemo === false), "no ingested production row is flagged demo");
  // A demo leads_generated and a production leads_generated coexist distinctly.
  const demoLeads = demoAfter.find((m) => m.metricKey === "leads_generated");
  assert(!!demoLeads && demoLeads.isDemo === true, "seeded demo leads_generated still present as demo");
}

// ── (3) liveNumbersEngine returns ingested verified/high production metrics by default
console.log("\n(3) liveNumbersEngine surfaces production proof by default");
{
  const live = getLiveNumbers(); // default: demo OFF, minConfidence low
  const ours = live.metrics.filter((m) => m.sourceSystem === "atom-prospects" && !m.isDemo);
  assert(ours.length > 0, "production prospect metrics are returned by default (no demo opt-in)");
  assert(ours.every((m) => !m.isDemo), "default live numbers contain no demo rows");
  const usableLeads = live.usable.find((m) => m.metricKey === "leads_generated" && !m.isDemo);
  assert(!!usableLeads, "ingested leads_generated is usable-in-final (verified)");
  const convRate = live.metrics.find((m) => m.metricKey === "lead_conversion_rate" && !m.isDemo);
  assert(!!convRate && (convRate.confidence === "high" || convRate.confidence === "verified"), "conversion rate is high/verified, never demo");
}

// ── (4) claimChecker verifies a matching claim against an ingested metric ─────
console.log("\n(4) claimChecker verifies against ingested production metric");
{
  const live = getLiveNumbers();
  const leads = live.metrics.find((m) => m.metricKey === "leads_generated" && !m.isDemo)!;
  const report = checkClaims(`We generated ${leads.value} leads this quarter.`, live);
  const claim = report.claims.find((c) => c.claimType === "metric");
  assert(!!claim, "the numeric claim is detected");
  assert(claim?.verified === "verified", `claim verifies against the ingested production metric (got ${claim?.verified})`);
  assert(claim?.metricKey === "leads_generated", "claim binds to leads_generated");
  assert(claim?.sourceSystem === "atom-prospects", "claim provenance points to the real source system");
  assert(report.score === 100, `claimScore is 100 for a fully-backed claim (got ${report.score})`);
}

// ── (5) demo/unverified metrics remain blocked by the publish guard ───────────
console.log("\n(5) demo / unverified claims stay blocked by publish guard (PR#14)");
{
  // A demo-backed claim is recorded as needs_review by the checker; the guard
  // must block approve/export on it regardless of the ingested production data.
  const demoClaim: ContentClaim = {
    id: 1, generationId: 1, claimText: "We generated 42 leads.", claimType: "metric",
    metricKey: "leads_generated", verified: "needs_review", sourceSystem: "demo",
    confidence: "high", riskLevel: "medium", createdAt: now,
  } as ContentClaim;
  const r = evaluatePublishGuard("exported", 92, [demoClaim]);
  assert(!r.ok, "demo-backed needs_review claim still blocks export");
  assert(r.riskyClaims.length === 1, "guard surfaces the demo-backed risky claim");

  // An unsupported numeric claim (rejected) blocks too.
  const rejected: ContentClaim = { ...demoClaim, verified: "rejected", riskLevel: "high", sourceSystem: null, metricKey: null } as ContentClaim;
  const r2 = evaluatePublishGuard("approved", 70, [rejected]);
  assert(!r2.ok, "unsupported (rejected) claim still blocks approval");
}

// ── (6) re-ingestion is idempotent (upsert, not duplicate) ────────────────────
console.log("\n(6) re-ingestion is idempotent");
{
  const before = storage.getProductActivityMetrics({ includeDemo: false }).filter((m) => m.sourceSystem === "atom-prospects").length;
  runIngestion();
  const after = storage.getProductActivityMetrics({ includeDemo: false }).filter((m) => m.sourceSystem === "atom-prospects").length;
  assert(after === before, `re-ingest did not duplicate production rows (${before} → ${after})`);
}

// ── cleanup: remove the production metrics + prospects we created ─────────────
import { db } from "../server/storage";
import { productActivityMetrics, prospects } from "../shared/schema";
import { sql } from "drizzle-orm";
db.delete(productActivityMetrics).where(sql`${productActivityMetrics.isDemo} = 0`).run();
db.delete(prospects).where(sql`${prospects.companyName} IN (${sql.join(seededProspectNames.map((n) => sql`${n}`), sql`, `)})`).run();

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
