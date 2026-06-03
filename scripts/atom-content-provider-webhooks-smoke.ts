/**
 * DB-backed smoke test for the PROVIDER WEBHOOK layer — the provider-level proof
 * surface (server/content/providerWebhooks) that turns real external producer
 * payloads (outbound email/outreach senders, inbox reply webhooks, calendar
 * bookers, conversation/transcript systems) into first-class
 * product_activity_events.
 *
 * It exercises ingestProviderWebhook end to end and asserts the proof-integrity
 * contract the provider layer must preserve:
 *   1. a valid email webhook inserts an email_sent (and a non-email kind →
 *      outreach_sent) event with provider provenance
 *   2. a valid reply webhook inserts reply_received
 *   3. a valid calendar webhook inserts meeting_booked; a cancellation is NOT proof
 *   4. a valid conversation webhook inserts conversation_event (+ meeting_booked
 *      when the transcript booked a meeting)
 *   5. invalid payloads are rejected (no write)
 *   6. a duplicate provider event id is idempotent (no double count) — single + batch
 *   7. a provider test/demo event is persisted as demo and EXCLUDED from
 *      production proof / the EventsAdapter
 *   8. normalized provider events flow into the EventsAdapter → verified metrics
 *
 * Imports server/storage (opens the real SQLite file), uses unique provider names
 * so cleanup is surgical, asserts, then deletes exactly the rows + production
 * metrics it created.
 * Run: `npx tsx scripts/atom-content-provider-webhooks-smoke.ts`
 */
import { storage, db } from "../server/storage";
import { ingestProviderWebhook } from "../server/content/providerWebhooks";
import { runIngestion } from "../server/content/productActivityIngestion";
import { productActivityEvents, productActivityMetrics } from "../shared/schema";
import { sql } from "drizzle-orm";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

// Unique provider names → source_system = `provider:<name>`. Cleanup targets the
// provider: prefix so it can never touch real or other-test rows.
const EMAIL_PROVIDER = "smoke-email-provider";
const REPLY_PROVIDER = "smoke-reply-provider";
const CAL_PROVIDER = "smoke-cal-provider";
const CONV_PROVIDER = "smoke-conv-provider";
const ALL_PROVIDERS = [EMAIL_PROVIDER, REPLY_PROVIDER, CAL_PROVIDER, CONV_PROVIDER];
const iso = (minsAgo = 0) => new Date(Date.now() - minsAgo * 60_000).toISOString();

function cleanup() {
  for (const p of ALL_PROVIDERS) {
    db.delete(productActivityEvents).where(sql`${productActivityEvents.sourceSystem} = ${`provider:${p}`}`).run();
  }
}
function eventsFor(provider: string) {
  return storage.getProductActivityEvents({ sourceSystem: `provider:${provider}`, includeDemo: true, limit: 1000 });
}
cleanup(); // clear leftovers from a prior aborted run

// ── (1) email webhook → email_sent / outreach_sent ───────────────────────────
console.log("(1) email webhook → email_sent (+ non-email kind → outreach_sent)");
{
  const r = ingestProviderWebhook("email", {
    provider: EMAIL_PROVIDER, messageId: "msg-1", sentAt: iso(10),
    subject: "Hello", to: "a@example.com", prospectId: "p-1", campaignId: "c-1",
  });
  assert(r.channel === "email" && r.inserted === 1, `email webhook inserted 1 (got ${r.inserted})`);
  const ev = eventsFor(EMAIL_PROVIDER).find((e) => e.sourceRecordId === `provider:${EMAIL_PROVIDER}:email:msg-1`);
  assert(ev?.eventType === "email_sent", "email kind → email_sent");
  assert(ev?.prospectId === "p-1" && ev?.campaignId === "c-1", "linkage ids persisted");
  const meta = JSON.parse(ev?.metadataJson || "{}");
  assert(meta.provider === EMAIL_PROVIDER && meta.message_id === "msg-1", "metadata carries provider + message id");

  // A non-email kind (e.g. a generic outreach touch) → outreach_sent.
  const r2 = ingestProviderWebhook("email", { provider: EMAIL_PROVIDER, messageId: "dm-1", kind: "dm", sentAt: iso(9) });
  assert(r2.inserted === 1, "outreach (dm) webhook inserted 1");
  const ev2 = eventsFor(EMAIL_PROVIDER).find((e) => e.sourceRecordId === `provider:${EMAIL_PROVIDER}:email:dm-1`);
  assert(ev2?.eventType === "outreach_sent", "non-email kind → outreach_sent");

  // Batch of 4 more emails in one webhook.
  const rb = ingestProviderWebhook("email", { events: Array.from({ length: 4 }, (_, i) => ({
    provider: EMAIL_PROVIDER, messageId: `bulk-${i}`, sentAt: iso(8),
  }))});
  assert(rb.inserted === 4, `batch email webhook inserted 4 (got ${rb.inserted})`);
}

// ── (2) reply webhook → reply_received ────────────────────────────────────────
console.log("\n(2) reply webhook → reply_received");
{
  const r = ingestProviderWebhook("reply", {
    provider: REPLY_PROVIDER, replyId: "reply-1", receivedAt: iso(7),
    fromEmail: "a@example.com", snippet: "Sure, let's talk", prospectId: "p-1",
  });
  assert(r.inserted === 1, `reply webhook inserted 1 (got ${r.inserted})`);
  const ev = eventsFor(REPLY_PROVIDER).find((e) => e.sourceRecordId === `provider:${REPLY_PROVIDER}:reply:reply-1`);
  assert(ev?.eventType === "reply_received", "reply webhook → reply_received");
}

// ── (3) calendar webhook → meeting_booked; cancellation NOT proof ─────────────
console.log("\n(3) calendar webhook → meeting_booked (cancellation is not proof)");
{
  const r = ingestProviderWebhook("calendar", {
    provider: CAL_PROVIDER, bookingId: "book-1", scheduledAt: iso(6),
    meetingType: "demo", inviteeEmail: "a@example.com", prospectId: "p-1",
  });
  assert(r.inserted === 1, `calendar booked webhook inserted 1 (got ${r.inserted})`);
  const ev = eventsFor(CAL_PROVIDER).find((e) => e.sourceRecordId === `provider:${CAL_PROVIDER}:meeting:book-1`);
  assert(ev?.eventType === "meeting_booked", "calendar booked → meeting_booked");

  // A cancellation normalizes to ZERO proof events (not a booked meeting).
  const rc = ingestProviderWebhook("calendar", { provider: CAL_PROVIDER, bookingId: "book-cancel", status: "canceled", scheduledAt: iso(5) });
  assert(rc.normalized === 0 && rc.inserted === 0, "calendar cancellation produces no proof event");
}

// ── (4) conversation webhook → conversation_event (+ meeting_booked) ──────────
console.log("\n(4) conversation webhook → conversation_event (+ meeting_booked when booked)");
{
  const r = ingestProviderWebhook("conversation", {
    provider: CONV_PROVIDER, conversationId: "conv-1", occurredAt: iso(4),
    channel: "call", durationSeconds: 420, sentiment: "positive",
  });
  assert(r.inserted === 1, `conversation webhook inserted 1 (got ${r.inserted})`);
  const ev = eventsFor(CONV_PROVIDER).find((e) => e.sourceRecordId === `provider:${CONV_PROVIDER}:conversation:conv-1`);
  assert(ev?.eventType === "conversation_event", "conversation webhook → conversation_event");

  // A transcript that booked a meeting emits BOTH a conversation_event and a
  // distinctly-keyed meeting_booked.
  const r2 = ingestProviderWebhook("conversation", {
    provider: CONV_PROVIDER, conversationId: "conv-2", occurredAt: iso(3), channel: "call", bookedMeeting: true,
  });
  assert(r2.normalized === 2 && r2.inserted === 2, `transcript+booking inserted 2 (got ${r2.inserted})`);
  const both = eventsFor(CONV_PROVIDER).filter((e) => (e.sourceRecordId || "").includes("conv-2"));
  assert(both.some((e) => e.eventType === "conversation_event"), "conv-2 emitted conversation_event");
  assert(both.some((e) => e.eventType === "meeting_booked"), "conv-2 emitted meeting_booked");
  assert(new Set(both.map((e) => e.sourceRecordId)).size === 2, "the two conv-2 events have distinct source_record_ids");
}

// ── (5) invalid payloads rejected (no write) ──────────────────────────────────
console.log("\n(5) invalid payloads rejected");
{
  const before = eventsFor(EMAIL_PROVIDER).length;
  let threw = false;
  try { ingestProviderWebhook("email", { provider: EMAIL_PROVIDER }); } catch { threw = true; } // missing messageId
  assert(threw, "email webhook missing messageId is rejected");
  let threw2 = false;
  try { ingestProviderWebhook("reply", { provider: REPLY_PROVIDER }); } catch { threw2 = true; } // missing replyId
  assert(threw2, "reply webhook missing replyId is rejected");
  const after = eventsFor(EMAIL_PROVIDER).length;
  assert(after === before, "rejected webhook wrote nothing");
}

// ── (6) duplicate provider event id is idempotent ─────────────────────────────
console.log("\n(6) duplicate provider event id is idempotent");
{
  // Re-deliver msg-1 (same provider, same id) — must be skipped.
  const r = ingestProviderWebhook("email", { provider: EMAIL_PROVIDER, messageId: "msg-1", sentAt: iso(10) });
  assert(r.inserted === 0 && r.skipped === 1, `re-delivered email skipped (inserted=${r.inserted}, skipped=${r.skipped})`);
  // Batch where one is new and one is a duplicate.
  const rb = ingestProviderWebhook("email", { events: [
    { provider: EMAIL_PROVIDER, messageId: "bulk-0", sentAt: iso(8) }, // dup
    { provider: EMAIL_PROVIDER, messageId: "fresh-1", sentAt: iso(8) }, // new
  ]});
  assert(rb.inserted === 1 && rb.skipped === 1, `mixed batch inserted 1 / skipped 1 (got ${rb.inserted}/${rb.skipped})`);
}

// ── (7) provider test/demo event excluded from production proof ───────────────
console.log("\n(7) provider test/demo event excluded from production proof");
{
  const prodBefore = storage.countProductActivityEventsByType({ sourceSystem: `provider:${EMAIL_PROVIDER}`, includeDemo: false }).email_sent || 0;
  const r = ingestProviderWebhook("email", { provider: EMAIL_PROVIDER, messageId: "test-1", sentAt: iso(2), test: true });
  assert(r.inserted === 1 && r.demo === 1, "test-flagged webhook persisted as demo");
  const ev = eventsFor(EMAIL_PROVIDER).find((e) => e.sourceRecordId === `provider:${EMAIL_PROVIDER}:email:test-1`);
  assert(ev?.isDemo === true, "test event stored with isDemo=true");
  const prodAfter = storage.countProductActivityEventsByType({ sourceSystem: `provider:${EMAIL_PROVIDER}`, includeDemo: false }).email_sent || 0;
  assert(prodAfter === prodBefore, `production email_sent count unchanged by demo event (${prodBefore} → ${prodAfter})`);
}

// ── (8) normalized provider events feed the EventsAdapter → verified metrics ──
console.log("\n(8) provider events flow into EventsAdapter → verified production metrics");
{
  const res = runIngestion({ sourceSystem: "atom-activity-events" });
  assert(res.persisted > 0, `events adapter persisted production metrics (${res.persisted})`);
  const prod = storage.getProductActivityMetrics({ includeDemo: false, sourceSystem: "atom-activity-events" });
  const sent = prod.find((m) => m.metricKey === "messages_sent");
  assert(!!sent && sent.confidence === "verified" && sent.isDemo === false, "messages_sent is verified production metric from provider events");
  const meetings = prod.find((m) => m.metricKey === "meetings_booked");
  assert(!!meetings, "meetings_booked metric derived from provider calendar/conversation events");
  const convos = prod.find((m) => m.metricKey === "conversations_processed");
  assert(!!convos, "conversations_processed metric derived from provider conversation events");
}

// ── cleanup ───────────────────────────────────────────────────────────────────
cleanup();
db.delete(productActivityMetrics).where(
  sql`${productActivityMetrics.isDemo} = 0 AND ${productActivityMetrics.sourceSystem} = 'atom-activity-events'`,
).run();

console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
process.exit(failures === 0 ? 0 : 1);
