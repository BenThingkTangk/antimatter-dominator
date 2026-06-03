/**
 * eventIngestion — server-side validation + safe persistence of first-class
 * production activity events posted by real product systems (outreach senders,
 * inbox reply webhooks, calendar bookers, conversation logs).
 *
 * Proof-integrity contract:
 *   - Payloads are validated by Zod (known event types, ISO timestamps) before
 *     any write. Invalid events are rejected with a structured error.
 *   - Persistence is idempotent on (sourceSystem, sourceRecordId): re-posting an
 *     event already seen is skipped, never duplicated — so a retrying producer
 *     cannot inflate counts.
 *   - `isDemo` marks operator/test events; production proof (the events adapter)
 *     reads isDemo=false rows ONLY, so a test event can never become proof.
 *   - No secrets are accepted or echoed. Auth lives at the route boundary.
 */
import { storage } from "../storage";
import {
  productEventInputSchema, productEventBatchSchema,
  type ProductEventInput, type InsertProductActivityEvent,
} from "@shared/schema";
import { z } from "zod";

function toRow(e: ProductEventInput, now: string): InsertProductActivityEvent {
  return {
    eventType: e.eventType,
    sourceSystem: e.sourceSystem,
    sourceRecordId: e.sourceRecordId ?? null,
    occurredAt: e.occurredAt,
    tenantId: e.tenantId ?? null,
    userId: e.userId ?? null,
    prospectId: e.prospectId ?? null,
    accountId: e.accountId ?? null,
    campaignId: e.campaignId ?? null,
    isDemo: e.isDemo ?? false,
    metadataJson: e.metadata != null ? JSON.stringify(e.metadata) : null,
    createdAt: now,
  };
}

export interface IngestEventsResult {
  accepted: number; // events that passed validation
  inserted: number; // newly persisted (idempotent)
  skipped: number; // duplicates ignored on natural key
  demo: number; // how many accepted events were demo-flagged
}

/**
 * Validate and persist a batch of events. Accepts either a single-event body
 * (`{ eventType, ... }`) or a batch body (`{ events: [...] }`). Throws a
 * ZodError on invalid input so the route returns a 400 with field detail.
 */
export function ingestEvents(body: unknown): IngestEventsResult {
  // Accept single OR batch. A single event is normalised to a one-element batch.
  const single = productEventInputSchema.safeParse(body);
  const events: ProductEventInput[] = single.success
    ? [single.data]
    : productEventBatchSchema.parse(body).events;

  const now = new Date().toISOString();
  const rows = events.map((e) => toRow(e, now));
  const { inserted, skipped } = storage.insertProductActivityEvents(rows);
  return {
    accepted: events.length,
    inserted,
    skipped,
    demo: events.filter((e) => e.isDemo).length,
  };
}

const recentQuerySchema = z.object({
  sourceSystem: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeDemo: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

/**
 * Operator-facing debug view: recent event counts by type plus a small sample.
 * Production-only by default; demo events are included only on explicit opt-in
 * and are reported separately so they are never mistaken for proof.
 */
export function recentEvents(opts: z.input<typeof recentQuerySchema> = {}) {
  const q = recentQuerySchema.parse(opts);
  const scope = { sourceSystem: q.sourceSystem, from: q.from, to: q.to };
  const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

  const countsByType = storage.countProductActivityEventsByType({ ...scope, includeDemo: q.includeDemo });
  const productionByType = storage.countProductActivityEventsByType({ ...scope, includeDemo: false });
  const allByType = storage.countProductActivityEventsByType({ ...scope, includeDemo: true });

  return {
    countsByType,
    totalProduction: sum(productionByType),
    demoTotal: sum(allByType) - sum(productionByType), // demo = all − production, in the same scope
    sample: storage.getProductActivityEvents({ ...scope, includeDemo: q.includeDemo, limit: q.limit ?? 25 }),
  };
}
