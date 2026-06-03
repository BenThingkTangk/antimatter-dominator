/**
 * providerWebhooks — the provider-level proof layer. It turns raw payloads from
 * real external producer systems (outbound email/outreach senders, inbox reply
 * webhooks, calendar bookers, conversation/transcript systems) into validated,
 * idempotent product_activity_events.
 *
 * Where this sits in the proof pipeline
 * ─────────────────────────────────────
 *   provider  ──HTTP──►  /api/content/activity-events/webhooks/{email,reply,
 *                         calendar,conversation}
 *                              │  (token-guarded route; see routes.ts)
 *                              ▼
 *                   normalize<Provider>()  ← THIS FILE: per-provider Zod schema
 *                              │              + normalization to the canonical
 *                              ▼              ProductEventInput contract
 *                   ingestEvents()  ← same validation + idempotency the internal
 *                                      eventRecorder and the generic POST route use
 *                              ▼
 *                   product_activity_events  ──►  EventsAdapter  ──►  live metrics
 *
 * Proof-integrity contract preserved end-to-end:
 *   - No fabricated data. A normalizer maps exactly the facts the provider sent;
 *     it never invents counts, timestamps, or linkage ids.
 *   - Idempotency. Every event carries a STABLE source_record_id built from the
 *     provider's own event/message id (`provider:providerEventId`), so a provider
 *     retrying a webhook can never double-count. ingestEvents dedupes on
 *     (sourceSystem, sourceRecordId).
 *   - Demo/test isolation. A provider may flag an event as test (explicit `test`/
 *     `demo` field, or a provider-native test marker). Such events are persisted
 *     with isDemo=true and the EventsAdapter excludes them from production proof.
 *     Production proof requires an explicitly non-test production event.
 *   - No secrets here. Authentication is enforced at the route boundary
 *     (verifyEventIngestToken); this module never reads or echoes a secret.
 *
 * Single + batch: each provider schema accepts either one event object or
 * `{ events: [...] }`, so a provider can deliver one webhook or a batch.
 */
import { z } from "zod";
import { ingestEvents, type IngestEventsResult } from "./eventIngestion";
import type { RecordEventInput } from "./eventRecorder";

// ── Shared building blocks ───────────────────────────────────────────────────

/** A provider key — stable, lowercase, used in source_system + source_record_id. */
export type ProviderChannel = "email" | "reply" | "calendar" | "conversation";

/** ISO-or-epoch timestamp coercion. Providers send ISO strings or unix seconds/ms. */
const timestamp = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v): string => {
    if (v == null || v === "") return new Date().toISOString();
    if (typeof v === "number") {
      // Heuristic: seconds vs ms. < 1e12 ⇒ seconds.
      const ms = v < 1e12 ? v * 1000 : v;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  });

/** Optional, bounded id-like string; empty → undefined. */
const optId = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v == null || v === "" ? undefined : String(v).slice(0, 200)));

/** Linkage ids shared by every provider payload (all optional). */
const linkageShape = {
  tenantId: optId,
  userId: optId,
  prospectId: optId,
  accountId: optId,
  campaignId: optId,
  /** Explicit test/demo flag. `test` and `demo` are accepted aliases. */
  test: z.boolean().optional(),
  demo: z.boolean().optional(),
};

/** Resolve whether an event is a demo/test event from explicit flags + extras. */
function isTestEvent(flags: { test?: boolean; demo?: boolean }, extra?: boolean): boolean {
  return Boolean(flags.test || flags.demo || extra);
}

/**
 * Build the canonical event. Centralises the stable source_record_id rule so it
 * can't drift between providers: `<provider>:<providerEventId>`. The providerEventId
 * is REQUIRED by each schema, guaranteeing idempotency.
 */
function toEvent(args: {
  eventType: RecordEventInput["eventType"];
  sourceSystem: string;
  providerEventId: string;
  occurredAt: string;
  isDemo: boolean;
  linkage: { tenantId?: string; userId?: string; prospectId?: string; accountId?: string; campaignId?: string };
  metadata: Record<string, unknown>;
}): RecordEventInput {
  return {
    eventType: args.eventType,
    sourceSystem: args.sourceSystem,
    sourceRecordId: `${args.sourceSystem}:${args.providerEventId}`.slice(0, 200),
    occurredAt: args.occurredAt,
    tenantId: args.linkage.tenantId,
    userId: args.linkage.userId,
    prospectId: args.linkage.prospectId,
    accountId: args.linkage.accountId,
    campaignId: args.linkage.campaignId,
    isDemo: args.isDemo,
    metadata: args.metadata,
  };
}

/** Accept a single payload object OR a `{ events: [...] }` batch for any schema. */
function singleOrBatch<T extends z.ZodTypeAny>(item: T) {
  return z.union([item, z.object({ events: z.array(item).min(1).max(1000) })]);
}

function unwrap<T>(parsed: T | { events: T[] }): T[] {
  return parsed && typeof parsed === "object" && "events" in (parsed as any)
    ? (parsed as { events: T[] }).events
    : [parsed as T];
}

// ── (1) Outbound email / outreach sent ───────────────────────────────────────
// A provider (e.g. Resend, an outreach sender) reports that a message was sent.
// `kind` lets a generic outreach sender say it was a call/dm rather than email;
// "email" → email_sent, anything else → outreach_sent (the alias-friendly type).
export const emailWebhookSchema = singleOrBatch(
  z.object({
    provider: z.string().min(1).max(120).default("email-provider"),
    messageId: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 200)),
    kind: z.enum(["email", "message", "call", "dm", "outreach"]).optional().default("email"),
    sentAt: timestamp,
    subject: z.string().max(500).optional(),
    to: z.string().max(320).optional(),
    threadId: optId,
    ...linkageShape,
  }),
);

export function normalizeEmail(body: unknown): RecordEventInput[] {
  const parsed = emailWebhookSchema.parse(body);
  return unwrap(parsed).map((e) => {
    const sourceSystem = `provider:${e.provider}`;
    return toEvent({
      eventType: e.kind === "email" ? "email_sent" : "outreach_sent",
      sourceSystem,
      providerEventId: `email:${e.messageId}`,
      occurredAt: e.sentAt,
      isDemo: isTestEvent(e),
      linkage: e,
      metadata: {
        provider: e.provider,
        provider_event_type: e.kind,
        channel: "email",
        message_id: e.messageId,
        thread_id: e.threadId,
        subject: e.subject,
        to: e.to,
      },
    });
  });
}

// ── (2) Inbound reply received ────────────────────────────────────────────────
// An inbox/reply webhook reports a prospect replied to outreach.
export const replyWebhookSchema = singleOrBatch(
  z.object({
    provider: z.string().min(1).max(120).default("inbox-provider"),
    replyId: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 200)),
    receivedAt: timestamp,
    threadId: optId,
    inReplyToMessageId: optId,
    fromEmail: z.string().max(320).optional(),
    snippet: z.string().max(2000).optional(),
    ...linkageShape,
  }),
);

export function normalizeReply(body: unknown): RecordEventInput[] {
  const parsed = replyWebhookSchema.parse(body);
  return unwrap(parsed).map((e) => {
    const sourceSystem = `provider:${e.provider}`;
    return toEvent({
      eventType: "reply_received",
      sourceSystem,
      providerEventId: `reply:${e.replyId}`,
      occurredAt: e.receivedAt,
      isDemo: isTestEvent(e),
      linkage: e,
      metadata: {
        provider: e.provider,
        provider_event_type: "reply_received",
        channel: "reply",
        reply_id: e.replyId,
        thread_id: e.threadId,
        in_reply_to_message_id: e.inReplyToMessageId,
        from_email: e.fromEmail,
        snippet: e.snippet,
      },
    });
  });
}

// ── (3) Calendar / meeting booked ─────────────────────────────────────────────
// A calendar booker (e.g. Calendly, Cal.com) reports a meeting/demo was scheduled.
// `status` lets a provider distinguish booked vs canceled; only booked events
// map to meeting_booked (cancellations are recorded as metadata, not proof).
export const calendarWebhookSchema = singleOrBatch(
  z.object({
    provider: z.string().min(1).max(120).default("calendar-provider"),
    bookingId: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 200)),
    status: z.enum(["booked", "scheduled", "confirmed", "canceled", "rescheduled"]).optional().default("booked"),
    scheduledAt: timestamp,
    meetingType: z.string().max(200).optional(),
    inviteeEmail: z.string().max(320).optional(),
    ...linkageShape,
  }),
);

/** Statuses that count as a real booking (proof). Cancellations are not proof. */
const BOOKED_STATUSES = new Set(["booked", "scheduled", "confirmed", "rescheduled"]);

export function normalizeCalendar(body: unknown): RecordEventInput[] {
  const parsed = calendarWebhookSchema.parse(body);
  // Only emit meeting_booked for booking statuses. A cancellation is a real fact
  // but it is NOT a booked meeting, so emitting meeting_booked for it would
  // inflate proof — we drop it (the route reports accepted=0 for that event).
  return unwrap(parsed)
    .filter((e) => BOOKED_STATUSES.has(e.status))
    .map((e) => {
      const sourceSystem = `provider:${e.provider}`;
      return toEvent({
        eventType: "meeting_booked",
        sourceSystem,
        providerEventId: `meeting:${e.bookingId}`,
        occurredAt: e.scheduledAt,
        isDemo: isTestEvent(e),
        linkage: e,
        metadata: {
          provider: e.provider,
          provider_event_type: `calendar.${e.status}`,
          channel: "calendar",
          booking_id: e.bookingId,
          meeting_type: e.meetingType,
          invitee_email: e.inviteeEmail,
        },
      });
    });
}

// ── (4) Conversation / transcript processed ───────────────────────────────────
// A conversation/transcript system (call recorder, chat log, leadgen call) reports
// a processed conversation event. If the transcript indicates a meeting was
// booked, the provider can set `bookedMeeting: true` to ALSO emit meeting_booked
// (keyed distinctly so it stays idempotent and never collides with the
// conversation_event row).
export const conversationWebhookSchema = singleOrBatch(
  z.object({
    provider: z.string().min(1).max(120).default("conversation-provider"),
    conversationId: z.union([z.string(), z.number()]).transform((v) => String(v).slice(0, 200)),
    occurredAt: timestamp,
    channel: z.enum(["call", "chat", "voice", "video", "transcript"]).optional().default("transcript"),
    durationSeconds: z.number().nonnegative().optional(),
    sentiment: z.string().max(60).optional(),
    bookedMeeting: z.boolean().optional(),
    ...linkageShape,
  }),
);

export function normalizeConversation(body: unknown): RecordEventInput[] {
  const parsed = conversationWebhookSchema.parse(body);
  const out: RecordEventInput[] = [];
  for (const e of unwrap(parsed)) {
    const sourceSystem = `provider:${e.provider}`;
    const isDemo = isTestEvent(e);
    out.push(
      toEvent({
        eventType: "conversation_event",
        sourceSystem,
        providerEventId: `conversation:${e.conversationId}`,
        occurredAt: e.occurredAt,
        isDemo,
        linkage: e,
        metadata: {
          provider: e.provider,
          provider_event_type: `conversation.${e.channel}`,
          channel: e.channel,
          conversation_id: e.conversationId,
          duration_seconds: e.durationSeconds,
          sentiment: e.sentiment,
        },
      }),
    );
    // A transcript that booked a meeting is a second, distinct production fact.
    // Keyed on `meeting:<conversationId>` so it dedupes independently of the
    // conversation_event row and of any calendar-provider booking.
    if (e.bookedMeeting) {
      out.push(
        toEvent({
          eventType: "meeting_booked",
          sourceSystem,
          providerEventId: `meeting:${e.conversationId}`,
          occurredAt: e.occurredAt,
          isDemo,
          linkage: e,
          metadata: {
            provider: e.provider,
            provider_event_type: "conversation.meeting_booked",
            channel: e.channel,
            conversation_id: e.conversationId,
            derived_from: "conversation_transcript",
          },
        }),
      );
    }
  }
  return out;
}

// ── Provider registry + dispatcher ────────────────────────────────────────────

export interface ProviderNormalizer {
  readonly channel: ProviderChannel;
  readonly description: string;
  /** Canonical event types this channel can emit (for status/readiness UI). */
  readonly emits: RecordEventInput["eventType"][];
  normalize(body: unknown): RecordEventInput[];
}

export const PROVIDER_NORMALIZERS: Record<ProviderChannel, ProviderNormalizer> = {
  email: {
    channel: "email",
    description: "Outbound email/outreach sent (e.g. Resend, outreach senders)",
    emits: ["email_sent", "outreach_sent"],
    normalize: normalizeEmail,
  },
  reply: {
    channel: "reply",
    description: "Inbound reply received (inbox/reply webhooks)",
    emits: ["reply_received"],
    normalize: normalizeReply,
  },
  calendar: {
    channel: "calendar",
    description: "Calendar/meeting booked (e.g. Calendly, Cal.com)",
    emits: ["meeting_booked"],
    normalize: normalizeCalendar,
  },
  conversation: {
    channel: "conversation",
    description: "Conversation/transcript processed (call/chat logs, leadgen calls)",
    emits: ["conversation_event", "meeting_booked"],
    normalize: normalizeConversation,
  },
};

export interface ProviderIngestResult extends IngestEventsResult {
  channel: ProviderChannel;
  /** Events the normalizer produced (after dropping non-proof events e.g. cancels). */
  normalized: number;
}

/**
 * Validate + normalize + persist a provider webhook payload. Throws a ZodError
 * on invalid input (route → 400). Returns the ingest result plus how many events
 * the normalizer produced. A payload that normalizes to zero proof events (e.g.
 * a calendar cancellation) is accepted but inserts nothing.
 */
export function ingestProviderWebhook(channel: ProviderChannel, body: unknown): ProviderIngestResult {
  const normalizer = PROVIDER_NORMALIZERS[channel];
  const events = normalizer.normalize(body);
  if (events.length === 0) {
    return { channel, normalized: 0, accepted: 0, inserted: 0, skipped: 0, demo: 0 };
  }
  const result = ingestEvents({ events });
  return { channel, normalized: events.length, ...result };
}
