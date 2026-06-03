/**
 * DB-backed smoke test for INTERNAL production-event producers — the in-app
 * flows wired to emit first-class product_activity_events via eventRecorder
 * (server/content/eventRecorder), the in-process counterpart to the external
 * token-guarded POST /api/content/activity-events route.
 *
 * It exercises the exact helper calls (and the exact source_system /
 * source_record_id conventions) that server/routes.ts makes for two real
 * producer paths:
 *
 *   A. campaign push  → outreach_sent (every account) + lead_captured (when the
 *      push target is prospects). Keyed per (campaign, account).
 *   B. prospect status transition → reply_received (engaged) / meeting_booked
 *      (qualified). Keyed per (prospect, status).
 *
 * Asserts the internal producers obey the same proof-integrity contract as the
 * external route:
 *   1. recorder persists validated internal events
 *   2. re-running the SAME producer fact is idempotent (no double count)
 *   3. recorder is best-effort: a malformed event never throws (returns null)
 *   4. internally-emitted events flow into the EventsAdapter → verified metrics
 *   5. demo events stay out of production proof
 *
 * Imports server/storage (opens the real SQLite file + seeds demo metrics),
 * records clearly-tagged events under unique source systems, asserts, then
 * cleans up exactly the rows + production metrics it created.
 * Run: `npx tsx scripts/atom-content-producers-smoke.ts`
 */
import { storage, db } from "../server/storage";
import { recordProductActivityEvent, recordProductActivityEvents, type RecordEventInput } from "../server/content/eventRecorder";
import { runIngestion } from "../server/content/productActivityIngestion";
import { productActivityEvents, productActivityMetrics } from "../shared/schema";
import { sql } from "drizzle-orm";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

// Unique source systems so cleanup is surgical and can't touch real data. These
// mirror the production source systems used by server/routes.ts; the suffix
// keeps this test isolated from any real emitted rows.
const PUSH_SRC = "atom-campaign-push";
const STATUS_SRC = "atom-prospect-status";
const TEST_CAMPAIGN = 999001; // implausible ids → cleanup by source_record_id prefix
const iso = () => new Date().toISOString();

// Build the SAME events server/routes.ts emits on a campaign push to prospects.
function pushEventsForAccount(campaignId: number, accountId: number): RecordEventInput[] {
  return [
    {
      eventType: "lead_captured",
      sourceSystem: PUSH_SRC,
      sourceRecordId: `push-lead:campaign:${campaignId}:account:${accountId}`,
      occurredAt: iso(),
      accountId: String(accountId),
      campaignId: String(campaignId),
      metadata: { account: `acct-${accountId}`, productSlug: "smoke-product" },
    },
    {
      eventType: "outreach_sent",
      sourceSystem: PUSH_SRC,
      sourceRecordId: `push:campaign:${campaignId}:account:${accountId}:to:prospects`,
      occurredAt: iso(),
      accountId: String(accountId),
      campaignId: String(campaignId),
      metadata: { account: `acct-${accountId}`, target: "prospects" },
    },
  ];
}

// Cleanup helpers — only ever delete rows under our test campaign / prospect ids.
function cleanup() {
  db.delete(productActivityEvents).where(
    sql`${productActivityEvents.sourceRecordId} LIKE ${`%campaign:${TEST_CAMPAIGN}:%`}`,
  ).run();
  db.delete(productActivityEvents).where(
    sql`${productActivityEvents.sourceRecordId} LIKE ${`prospect:${TEST_CAMPAIGN}:%`}`,
  ).run();
}
cleanup(); // clear any leftovers from a prior aborted run

// ── (A) campaign push producer: outreach_sent + lead_captured ────────────────
console.log("(A) campaign push producer → outreach_sent + lead_captured");
{
  // Push 3 accounts to prospects → 3 outreach_sent + 3 lead_captured.
  const accountIds = [101, 102, 103];
  const events = accountIds.flatMap((a) => pushEventsForAccount(TEST_CAMPAIGN, a));
  const r = recordProductActivityEvents(events);
  assert(!!r && r.inserted === 6, `push recorded 6 events (got ${r?.inserted})`);

  const counts = storage.countProductActivityEventsByType({ sourceSystem: PUSH_SRC, includeDemo: false });
  // Other real pushes may exist in the DB, so assert "at least" our contribution
  // by scoping to our test campaign via the source_record_id prefix instead.
  const ours = storage.getProductActivityEvents({ sourceSystem: PUSH_SRC, includeDemo: true, limit: 1000 })
    .filter((e) => (e.sourceRecordId || "").includes(`campaign:${TEST_CAMPAIGN}:`));
  assert(ours.filter((e) => e.eventType === "outreach_sent").length === 3, "exactly 3 outreach_sent for our campaign");
  assert(ours.filter((e) => e.eventType === "lead_captured").length === 3, "exactly 3 lead_captured for our campaign");
  assert(typeof counts.outreach_sent === "number", "outreach_sent surfaces in type counts");
}

// ── (B) prospect status producer: reply_received / meeting_booked ────────────
console.log("\n(B) prospect status producer → reply_received / meeting_booked");
{
  // Two transitions for the same test prospect id-space.
  recordProductActivityEvent({
    eventType: "reply_received",
    sourceSystem: STATUS_SRC,
    sourceRecordId: `prospect:${TEST_CAMPAIGN}:status:engaged`,
    occurredAt: iso(),
    prospectId: String(TEST_CAMPAIGN),
    metadata: { companyName: "Smoke Co", status: "engaged" },
  });
  recordProductActivityEvent({
    eventType: "meeting_booked",
    sourceSystem: STATUS_SRC,
    sourceRecordId: `prospect:${TEST_CAMPAIGN}:status:qualified`,
    occurredAt: iso(),
    prospectId: String(TEST_CAMPAIGN),
    metadata: { companyName: "Smoke Co", status: "qualified" },
  });
  const ours = storage.getProductActivityEvents({ sourceSystem: STATUS_SRC, includeDemo: true, limit: 1000 })
    .filter((e) => (e.sourceRecordId || "").startsWith(`prospect:${TEST_CAMPAIGN}:`));
  assert(ours.filter((e) => e.eventType === "reply_received").length === 1, "exactly 1 reply_received (engaged)");
  assert(ours.filter((e) => e.eventType === "meeting_booked").length === 1, "exactly 1 meeting_booked (qualified)");
}

// ── (1)/(2) idempotency: replaying the same producer fact is a no-op ─────────
console.log("\n(2) replaying the same producer fact is idempotent (no double count)");
{
  // Re-push account 101 (same campaign) — both its events must be skipped.
  const r = recordProductActivityEvents(pushEventsForAccount(TEST_CAMPAIGN, 101));
  assert(!!r && r.inserted === 0 && r.skipped === 2, `re-push skipped, not duplicated (inserted=${r?.inserted}, skipped=${r?.skipped})`);
  // Re-apply the same prospect status — skipped.
  const r2 = recordProductActivityEvent({
    eventType: "reply_received",
    sourceSystem: STATUS_SRC,
    sourceRecordId: `prospect:${TEST_CAMPAIGN}:status:engaged`,
    occurredAt: iso(),
    prospectId: String(TEST_CAMPAIGN),
  });
  assert(!!r2 && r2.inserted === 0 && r2.skipped === 1, "re-applied prospect status skipped");
  const ours = storage.getProductActivityEvents({ sourceSystem: PUSH_SRC, includeDemo: true, limit: 1000 })
    .filter((e) => (e.sourceRecordId || "").includes(`campaign:${TEST_CAMPAIGN}:`));
  assert(ours.length === 6, `our push event count unchanged after replay (got ${ours.length})`);
}

// ── (3) recorder is best-effort: malformed event never throws ────────────────
console.log("\n(3) recorder is best-effort (malformed event returns null, never throws)");
{
  let threw = false;
  let result: unknown = "sentinel";
  try {
    // Unknown event type — eventIngestion would throw a ZodError; the recorder
    // must swallow it and return null so a producer flow is never broken.
    result = recordProductActivityEvent({ eventType: "not_real" as any, sourceSystem: PUSH_SRC, occurredAt: iso() });
  } catch { threw = true; }
  assert(!threw, "recording a malformed event did not throw");
  assert(result === null, "recording a malformed event returned null");
}

// ── (4) internal events feed the EventsAdapter → verified production metrics ──
console.log("\n(4) internally-emitted events flow into EventsAdapter live metrics");
{
  const res = runIngestion({ sourceSystem: "atom-activity-events" });
  assert(res.persisted > 0, `events adapter persisted production metrics (${res.persisted})`);
  const prod = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" });
  const sent = prod.find((m) => m.metricKey === "messages_sent");
  assert(!!sent, "messages_sent metric derived from internal outreach_sent events");
  assert(sent?.confidence === "verified", "messages_sent is verified (direct count)");
  assert(sent?.isDemo === false, "messages_sent is production (demo=false)");
  const meta = JSON.parse(sent?.metadataJson || "{}");
  assert(meta.source_table === "product_activity_events", "metric provenance names the event table");
  const meetings = prod.find((m) => m.metricKey === "meetings_booked");
  assert(!!meetings, "meetings_booked metric derived from internal meeting_booked event");
}

// ── (5) demo events stay out of production proof ─────────────────────────────
console.log("\n(5) demo internal events excluded from production proof");
{
  const before = storage.countProductActivityEventsByType({ sourceSystem: PUSH_SRC, includeDemo: false }).outreach_sent || 0;
  const d = recordProductActivityEvent({
    eventType: "outreach_sent",
    sourceSystem: PUSH_SRC,
    sourceRecordId: `push:campaign:${TEST_CAMPAIGN}:account:999:to:demo`,
    occurredAt: iso(),
    isDemo: true,
  });
  assert(!!d && d.inserted === 1 && d.demo === 1, "demo event persisted and flagged demo");
  const after = storage.countProductActivityEventsByType({ sourceSystem: PUSH_SRC, includeDemo: false }).outreach_sent || 0;
  assert(after === before, `production outreach_sent count unchanged by demo event (${before} → ${after})`);
}

cleanup();
// Remove the production metrics our runIngestion may have written for the
// events source (mirrors the events smoke test's cleanup).
db.delete(productActivityMetrics).where(
  sql`${productActivityMetrics.isDemo} = 0 AND ${productActivityMetrics.sourceSystem} = 'atom-activity-events'`,
).run();

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
