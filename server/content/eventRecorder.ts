/**
 * eventRecorder — internal, server-side emission of first-class production
 * activity events from ATOM app flows (campaign push, enrichment, prospect
 * status transitions). It is the in-process counterpart to the external,
 * token-guarded POST /api/content/activity-events route:
 *
 *   - Same validation + idempotency as eventIngestion.ingestEvents (it calls it),
 *     so internally emitted events obey the identical proof-integrity contract:
 *     known event types, ISO timestamps, idempotent on (sourceSystem,
 *     sourceRecordId). A repeated production fact is never double-counted.
 *   - NO bearer token: callers are trusted in-process producers, not the public
 *     internet, so the route's auth boundary does not apply. No secret is read
 *     or emitted here.
 *   - Best-effort: recording is observability, not the producer's primary job.
 *     A recording failure must never break the real flow (a failed push must not
 *     500 because telemetry failed), so every call is wrapped and only logged.
 *
 * The EventsAdapter (productActivityIngestion) reads ALL production events
 * regardless of sourceSystem, so events emitted here flow into live metrics
 * automatically — no adapter change needed.
 */
import { ingestEvents, type IngestEventsResult } from "./eventIngestion";
import { productEventInputSchema } from "@shared/schema";
import type { z } from "zod";

// Accept the schema's INPUT shape so internal callers don't have to pass fields
// that the schema defaults (e.g. isDemo defaults to false). ingestEvents still
// parses/validates, so the persisted row is always fully normalised.
export type RecordEventInput = z.input<typeof productEventInputSchema>;

/**
 * Record a single production activity event. Best-effort and never throws:
 * validation/persistence errors are caught and logged so a producer flow is
 * never broken by event recording. Returns the ingest result on success or
 * null if the event was rejected/failed.
 */
export function recordProductActivityEvent(event: RecordEventInput): IngestEventsResult | null {
  return recordProductActivityEvents([event]);
}

/**
 * Record a batch of production activity events idempotently. Best-effort and
 * never throws. An empty batch is a no-op. On any error (e.g. a malformed
 * event) nothing is half-written — ingestEvents validates the whole batch
 * before persisting — and the error is logged, not propagated.
 */
export function recordProductActivityEvents(events: RecordEventInput[]): IngestEventsResult | null {
  if (!events.length) return null;
  try {
    return ingestEvents({ events });
  } catch (err: any) {
    // Telemetry must not break production flows: swallow + log, never rethrow.
    console.error("[eventRecorder] failed to record product activity events:", err?.message || err);
    return null;
  }
}
