/**
 * DB-backed smoke test for the first-class ATOM Content activity-event feed.
 * Verifies the proof-integrity contract of the event source + events adapter:
 *
 *   1. a validated event (single + batch) is persisted
 *   2. an invalid event is rejected (no write)
 *   3. the events adapter derives VERIFIED metrics from persisted events, with
 *      strong provenance (source table, event types, counts, demo:false)
 *   4. derived reply/meeting RATES are high-confidence and only when reliable
 *   5. re-ingestion of the same events is idempotent (no duplicate rows / counts)
 *   6. demo events are excluded from production proof (kept separate)
 *   7. the publish guard still blocks demo-backed / unsupported claims
 *
 * This imports server/storage (opens the real SQLite file + seeds demo metrics),
 * inserts clearly-tagged production + demo events, asserts, then cleans up the
 * rows and production metrics it created.
 * Run: `npx tsx scripts/atom-content-events-smoke.ts`
 */
import { storage, db } from "../server/storage";
import { ingestEvents } from "../server/content/eventIngestion";
import { runIngestion } from "../server/content/productActivityIngestion";
import { getLiveNumbers } from "../server/content/liveNumbersEngine";
import { checkClaims } from "../server/content/claimChecker";
import { evaluatePublishGuard } from "../server/content/publishGuard";
import { productActivityEvents, productActivityMetrics } from "../shared/schema";
import type { ContentClaim } from "../shared/schema";
import { sql } from "drizzle-orm";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

const SRC = "smoke-events"; // unique source system so cleanup is surgical
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

// Clean any leftovers from a prior aborted run before we start.
db.delete(productActivityEvents).where(sql`${productActivityEvents.sourceSystem} = ${SRC}`).run();

// ── (1) validated single + batch insert ─────────────────────────────────────
console.log("(1) validated event insert (single + batch)");
{
  const single = ingestEvents({
    eventType: "lead_captured", sourceSystem: SRC, sourceRecordId: "ev-lead-1", occurredAt: iso(10),
    metadata: { campaign: "smoke" },
  });
  assert(single.accepted === 1 && single.inserted === 1, "single valid event persisted");

  // 6 emails, 3 replies, 1 meeting, 2 conversations, 1 followup → exact counts.
  const batchEvents = [
    ...Array.from({ length: 6 }, (_, i) => ({ eventType: "email_sent", sourceSystem: SRC, sourceRecordId: `ev-email-${i}`, occurredAt: iso(9) })),
    ...Array.from({ length: 3 }, (_, i) => ({ eventType: "reply_received", sourceSystem: SRC, sourceRecordId: `ev-reply-${i}`, occurredAt: iso(8) })),
    { eventType: "meeting_booked", sourceSystem: SRC, sourceRecordId: "ev-mtg-0", occurredAt: iso(7) },
    ...Array.from({ length: 2 }, (_, i) => ({ eventType: "conversation_event", sourceSystem: SRC, sourceRecordId: `ev-conv-${i}`, occurredAt: iso(6) })),
    { eventType: "followup_completed", sourceSystem: SRC, sourceRecordId: "ev-fu-0", occurredAt: iso(5) },
  ];
  const batch = ingestEvents({ events: batchEvents });
  assert(batch.accepted === batchEvents.length && batch.inserted === batchEvents.length, `batch of ${batchEvents.length} persisted`);
  const counts = storage.countProductActivityEventsByType({ sourceSystem: SRC, includeDemo: false });
  assert(counts.email_sent === 6, `email_sent count exact (${counts.email_sent})`);
  assert(counts.reply_received === 3, `reply_received count exact (${counts.reply_received})`);
  assert(counts.meeting_booked === 1, `meeting_booked count exact (${counts.meeting_booked})`);
}

// ── (2) invalid event rejected (no write) ────────────────────────────────────
console.log("\n(2) invalid event rejected");
{
  const before = storage.getProductActivityEvents({ sourceSystem: SRC, includeDemo: true }).length;
  let threw = false;
  try { ingestEvents({ eventType: "not_a_real_type", sourceSystem: SRC, occurredAt: iso(1) }); }
  catch { threw = true; }
  assert(threw, "unknown event_type is rejected");

  let threw2 = false;
  try { ingestEvents({ eventType: "email_sent", sourceSystem: SRC, occurredAt: "not-a-date" }); }
  catch { threw2 = true; }
  assert(threw2, "non-ISO occurredAt is rejected");

  const after = storage.getProductActivityEvents({ sourceSystem: SRC, includeDemo: true }).length;
  assert(after === before, "rejected events wrote nothing");
}

// ── (3) events adapter derives VERIFIED metrics with provenance ──────────────
console.log("\n(3) events adapter derives verified metrics with provenance");
{
  const res = runIngestion({ sourceSystem: "atom-activity-events" });
  assert(res.persisted > 0, `events adapter persisted production metrics (${res.persisted})`);
  const prod = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" });
  const sent = prod.find((m) => m.metricKey === "messages_sent");
  assert(!!sent && sent.metricValue === 6, `messages_sent == 6 (got ${sent?.metricValue})`);
  assert(sent?.confidence === "verified", "messages_sent is verified (direct count)");
  assert(sent?.isDemo === false, "messages_sent is demo=false");
  const meta = JSON.parse(sent!.metadataJson || "{}");
  assert(meta.demo === false, "metadata carries demo:false");
  assert(meta.source_table === "product_activity_events", "metadata names the source table");
  assert(Array.isArray(meta.event_types), "metadata names the source event types");
  assert(typeof meta.source_count === "number", "metadata carries source_count");
  assert(!!meta.window, "metadata carries the derivation window");

  const meetings = prod.find((m) => m.metricKey === "meetings_booked");
  assert(!!meetings && meetings.metricValue === 1, `meetings_booked == 1 (got ${meetings?.metricValue})`);
  const convos = prod.find((m) => m.metricKey === "conversations_processed");
  assert(!!convos && convos.metricValue === 2, `conversations_processed == 2 (got ${convos?.metricValue})`);
}

// ── (4) derived rates are high-confidence and reliable-only ──────────────────
console.log("\n(4) derived rates high-confidence, only when reliable");
{
  const prod = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" });
  const replyRate = prod.find((m) => m.metricKey === "reply_rate");
  // 3 replies / 6 sent = 50%
  assert(!!replyRate && replyRate.metricValue === 50, `reply_rate == 50% (got ${replyRate?.metricValue})`);
  assert(replyRate?.confidence === "high", "reply_rate is high-confidence (derived rate)");
  const rateMeta = JSON.parse(replyRate!.metadataJson || "{}");
  assert(rateMeta.denominator === 6 && rateMeta.numerator === 3, "reply_rate records numerator+denominator");
  // meeting rate = 1 meeting / 3 replies = 33.3%
  const mtgRate = prod.find((m) => m.metricKey === "meeting_conversion_rate");
  assert(!!mtgRate && mtgRate.confidence === "high", "meeting_conversion_rate is high-confidence");
}

// ── (5) re-ingestion is idempotent ───────────────────────────────────────────
console.log("\n(5) re-ingestion is idempotent");
{
  // Re-posting the same events (same source_record_id) must be skipped.
  const re = ingestEvents({ events: [
    { eventType: "email_sent", sourceSystem: SRC, sourceRecordId: "ev-email-0", occurredAt: iso(9) },
    { eventType: "reply_received", sourceSystem: SRC, sourceRecordId: "ev-reply-0", occurredAt: iso(8) },
  ]});
  assert(re.inserted === 0 && re.skipped === 2, `duplicate events skipped, not duplicated (inserted=${re.inserted}, skipped=${re.skipped})`);
  const counts = storage.countProductActivityEventsByType({ sourceSystem: SRC, includeDemo: false });
  assert(counts.email_sent === 6, "email_sent count unchanged after re-post");

  // Re-running the metric ingestion must not duplicate production metric rows.
  const before = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" }).length;
  runIngestion({ sourceSystem: "atom-activity-events" });
  const after = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" }).length;
  assert(after === before, `re-ingest did not duplicate derived metrics (${before} → ${after})`);
}

// ── (6) demo events excluded from production proof ───────────────────────────
console.log("\n(6) demo events stay separate from production proof");
{
  const demo = ingestEvents({ events: Array.from({ length: 99 }, (_, i) => ({
    eventType: "email_sent", sourceSystem: SRC, sourceRecordId: `ev-demo-${i}`, occurredAt: iso(4), isDemo: true,
  }))});
  assert(demo.inserted === 99 && demo.demo === 99, "demo events persisted and flagged demo");
  // Production count must be unchanged; demo events do not inflate proof.
  const prodCounts = storage.countProductActivityEventsByType({ sourceSystem: SRC, includeDemo: false });
  assert(prodCounts.email_sent === 6, `production email_sent still 6 (demo excluded; got ${prodCounts.email_sent})`);
  // Re-derive and confirm messages_sent did NOT jump to 105.
  runIngestion({ sourceSystem: "atom-activity-events" });
  const sent = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" }).find((m) => m.metricKey === "messages_sent");
  assert(sent?.metricValue === 6, `messages_sent metric ignores demo events (got ${sent?.metricValue})`);

  // claimChecker: a claim backed by the verified production metric verifies.
  const live = getLiveNumbers();
  const sentMetric = live.metrics.find((m) => m.metricKey === "messages_sent" && m.sourceSystem === "atom-activity-events");
  assert(!!sentMetric, "messages_sent surfaces in default (production) live numbers");
  const report = checkClaims(`We sent ${sentMetric!.value} outreach messages this week.`, live);
  const claim = report.claims.find((c) => c.claimType === "metric");
  assert(claim?.verified === "verified", `claim verifies against the events-derived metric (got ${claim?.verified})`);
  assert(claim?.sourceSystem === "atom-activity-events", "claim provenance points to the event source");
}

// ── (7) publish guard still blocks demo-backed / unsupported claims ──────────
console.log("\n(7) publish guard unchanged");
{
  const demoClaim: ContentClaim = {
    id: 1, generationId: 1, claimText: "We sent 105 messages.", claimType: "metric",
    metricKey: "messages_sent", verified: "needs_review", sourceSystem: "demo",
    confidence: "high", riskLevel: "medium", createdAt: iso(0),
  } as ContentClaim;
  const r = evaluatePublishGuard("exported", 92, [demoClaim]);
  assert(!r.ok, "demo-backed needs_review claim still blocks export");
  const rejected: ContentClaim = { ...demoClaim, verified: "rejected", riskLevel: "high", sourceSystem: null, metricKey: null } as ContentClaim;
  const r2 = evaluatePublishGuard("approved", 70, [rejected]);
  assert(!r2.ok, "unsupported (rejected) claim still blocks approval");
}

// ── cleanup: remove the events + production metrics this test created ────────
db.delete(productActivityEvents).where(sql`${productActivityEvents.sourceSystem} = ${SRC}`).run();
db.delete(productActivityMetrics).where(
  sql`${productActivityMetrics.isDemo} = 0 AND ${productActivityMetrics.sourceSystem} = 'atom-activity-events'`,
).run();

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
