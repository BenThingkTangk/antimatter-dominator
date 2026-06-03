/**
 * productActivityIngestion — derives REAL product-activity metrics from
 * persisted production data (prospects, campaigns, campaign accounts) and
 * upserts them into product_activity_metrics so liveNumbersEngine / claimChecker
 * can cite production proof instead of only seeded demo metrics.
 *
 * Proof-integrity rules this module is bound by:
 *   - It ONLY reads persisted production rows. It never fabricates a number; if a
 *     source has no rows, the metric is simply not emitted (or emitted as 0 with a
 *     source_count of 0 in metadata — never invented).
 *   - Every emitted metric is written with isDemo=false and provenance metadata
 *     (window, filters, source counts, demo:false).
 *   - Confidence policy:
 *       verified → a direct count/derivation over persisted production rows
 *                  (e.g. number of prospects with status='qualified').
 *       high     → a deterministic derivation that is one logical step removed
 *                  (e.g. a rate computed from two reliable persisted counts).
 *     Demo data is never read here, so demo can never be promoted to production.
 *   - Pipeline/conversion rates are emitted ONLY when both numerator and
 *     denominator are reliable (denominator > 0); otherwise the rate is skipped.
 *
 * The ADAPTER interface lets future production feeds (a real outreach/email
 * provider, a calendar/meetings source, a conversation log) plug in without
 * touching the engine: implement MetricAdapter, register it in ADAPTERS.
 */
import { storage } from "../storage";
import type { InsertProductActivityMetric } from "@shared/schema";
import type { MetricConfidence } from "./liveNumbersEngine";

/** A single derived metric prior to persistence. Provenance is mandatory. */
export interface DerivedMetric {
  metricKey: string;
  metricLabel: string;
  value: number;
  unit: string; // '', '%', 'events', 'hrs', '$M'
  sourceSystem: string; // e.g. 'atom-prospects', 'atom-campaigns'
  /** Source record id OR a derivation-window id when the metric aggregates many rows. */
  sourceRecordId: string;
  confidence: Extract<MetricConfidence, "verified" | "high">;
  capturedAt: string; // ISO
  metadata: Record<string, unknown>; // window, filters, source counts, demo:false
}

export interface IngestionWindow {
  /** ISO lower bound (inclusive) for source records, or null for all-time. */
  from: string | null;
  /** ISO upper bound (inclusive), or null for now. */
  to: string | null;
  /** Stable id for this derivation window, used as sourceRecordId suffix. */
  windowId: string;
}

/**
 * An adapter turns one production data source into zero-or-more DerivedMetrics.
 * Adapters MUST NOT invent data: if the source is empty they return [] (or a
 * zero metric with source_count:0 in metadata, clearly attributed).
 */
export interface MetricAdapter {
  /** Stable source-system identifier persisted on every metric it emits. */
  readonly sourceSystem: string;
  /** Human description for operator-facing previews. */
  readonly description: string;
  /** Whether the underlying production source currently has any rows. */
  available(): boolean;
  /** Derive metrics for the given window. Pure read over persisted data. */
  derive(window: IngestionWindow): DerivedMetric[];
}

function makeWindow(from?: string | null, to?: string | null): IngestionWindow {
  const f = from ?? null;
  const t = to ?? null;
  const windowId = `w_${f ? Date.parse(f) : "all"}_${t ? Date.parse(t) : "now"}`;
  return { from: f, to: t, windowId };
}

/** True if an ISO timestamp falls inside the window (null bounds = open). */
function inWindow(iso: string | null | undefined, w: IngestionWindow): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (w.from && t < Date.parse(w.from)) return false;
  if (w.to && t > Date.parse(w.to)) return false;
  return true;
}

function baseMeta(w: IngestionWindow, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    window: { from: w.from, to: w.to, windowId: w.windowId },
    demo: false,
    ...extra,
  };
}

/**
 * Build a DerivedMetric, filling the per-adapter constant provenance fields
 * (sourceSystem, capturedAt) and the window-stable sourceRecordId derived from
 * the metricKey — so the key is written exactly once and can't drift.
 */
function emit(
  source: MetricAdapter,
  w: IngestionWindow,
  capturedAt: string,
  m: {
    metricKey: string; metricLabel: string; value: number; unit: string;
    confidence: DerivedMetric["confidence"]; meta: Record<string, unknown>;
  },
): DerivedMetric {
  return {
    metricKey: m.metricKey,
    metricLabel: m.metricLabel,
    value: m.value,
    unit: m.unit,
    sourceSystem: source.sourceSystem,
    sourceRecordId: `${source.sourceSystem}:${m.metricKey}:${w.windowId}`,
    confidence: m.confidence,
    capturedAt,
    metadata: baseMeta(w, m.meta),
  };
}

// ─── Adapter: prospects ────────────────────────────────────────────────────
// prospects.status flows new → contacted → engaged → qualified → closed.
// Each transition is a real, persisted production fact:
//   leads_generated   = count(prospects)                       (verified)
//   prospects_contacted (outreach proxy) = count(status in contacted+) (verified)
//   replies_received  = count(status in engaged+)              (verified)
//   meetings_booked   = count(status in qualified+)            (verified)
//   lead_conversion_rate = qualified / total * 100             (high, rate)
// Note: prospects has a `lastUpdated` timestamp (not a created_at), so the
// time window filters on lastUpdated; all-time is used when no window is given.
class ProspectsAdapter implements MetricAdapter {
  readonly sourceSystem = "atom-prospects";
  readonly description = "Prospect pipeline (status transitions: new→contacted→engaged→qualified→closed)";

  private rows() {
    return storage.getProspects();
  }
  available(): boolean {
    return this.rows().length > 0;
  }
  derive(w: IngestionWindow): DerivedMetric[] {
    const all = this.rows();
    // Window filter is best-effort: prospects only carry lastUpdated. When a
    // window is supplied we restrict to rows updated in it; otherwise all-time.
    const scoped = (w.from || w.to) ? all.filter((p) => inWindow(p.lastUpdated, w)) : all;
    const total = scoped.length;
    if (total === 0) return [];

    const STAGES = ["new", "contacted", "engaged", "qualified", "closed"];
    const rank = (s: string) => {
      const i = STAGES.indexOf((s || "new").toLowerCase());
      return i < 0 ? 0 : i;
    };
    const atLeast = (stage: string) => scoped.filter((p) => rank(p.status) >= rank(stage)).length;

    const contacted = atLeast("contacted");
    const engaged = atLeast("engaged");
    const qualified = atLeast("qualified");
    const now = new Date().toISOString();
    // Conversion rate is deterministic but one step removed from raw counts →
    // "high", not "verified". The denominator (total) is guaranteed > 0 by the
    // early return above, so the rate is always backed by a reliable denominator.
    const rate = Math.round((qualified / total) * 1000) / 10; // 1 decimal

    return [
      emit(this, w, now, { metricKey: "leads_generated", metricLabel: "Leads generated", value: total, unit: "", confidence: "verified", meta: { derivation: "count(prospects)", source_count: total } }),
      emit(this, w, now, { metricKey: "prospects_contacted", metricLabel: "Prospects contacted (outreach)", value: contacted, unit: "", confidence: "verified", meta: { derivation: "count(status>=contacted)", source_count: total } }),
      emit(this, w, now, { metricKey: "replies_received", metricLabel: "Replies received", value: engaged, unit: "", confidence: "verified", meta: { derivation: "count(status>=engaged)", source_count: total } }),
      emit(this, w, now, { metricKey: "meetings_booked", metricLabel: "Meetings booked", value: qualified, unit: "", confidence: "verified", meta: { derivation: "count(status>=qualified)", source_count: total } }),
      emit(this, w, now, { metricKey: "lead_conversion_rate", metricLabel: "Lead conversion rate", value: rate, unit: "%", confidence: "high", meta: { derivation: "qualified / total * 100", numerator: qualified, denominator: total, source_count: total } }),
    ];
  }
}

// ─── Adapter: campaigns ──────────────────────────────────────────────────────
// campaigns + campaign_accounts carry persisted processing counts. We derive:
//   campaign_events_processed = sum(scoredAccounts + enrichedAccounts)  (verified)
//   accounts_scored           = sum(scoredAccounts)                     (verified)
//   followups_completed (proxy) = count(accounts with enrichStatus='done') (verified)
//   outreach_pushed           = count(accounts pushedTo not null)       (verified)
class CampaignsAdapter implements MetricAdapter {
  readonly sourceSystem = "atom-campaigns";
  readonly description = "Campaign processing (accounts scored/enriched, pushed to outreach)";

  private campaigns() {
    return storage.getCampaigns();
  }
  available(): boolean {
    return this.campaigns().length > 0;
  }
  derive(w: IngestionWindow): DerivedMetric[] {
    const camps = (w.from || w.to)
      ? this.campaigns().filter((c) => inWindow(c.updatedAt || c.createdAt, w))
      : this.campaigns();
    if (camps.length === 0) return [];

    let scored = 0;
    let enriched = 0;
    let accountsTotal = 0;
    let enrichDone = 0;
    let pushed = 0;
    for (const c of camps) {
      scored += c.scoredAccounts || 0;
      enriched += c.enrichedAccounts || 0;
      const accts = storage.getCampaignAccounts(c.id);
      accountsTotal += accts.length;
      enrichDone += accts.filter((a) => a.enrichStatus === "done").length;
      pushed += accts.filter((a) => !!a.pushedTo).length;
    }
    const eventsProcessed = scored + enriched;
    const now = new Date().toISOString();
    const meta = (extra: Record<string, unknown>) => ({ source_count: camps.length, accounts_total: accountsTotal, ...extra });

    return [
      emit(this, w, now, { metricKey: "campaign_events_processed", metricLabel: "Campaign events processed", value: eventsProcessed, unit: "events", confidence: "verified", meta: meta({ derivation: "sum(scoredAccounts + enrichedAccounts)", scored, enriched }) }),
      emit(this, w, now, { metricKey: "accounts_scored", metricLabel: "Accounts scored", value: scored, unit: "", confidence: "verified", meta: meta({ derivation: "sum(campaigns.scoredAccounts)" }) }),
      emit(this, w, now, { metricKey: "followups_completed", metricLabel: "Follow-up enrichments completed", value: enrichDone, unit: "", confidence: "verified", meta: meta({ derivation: "count(account.enrichStatus='done')" }) }),
      emit(this, w, now, { metricKey: "outreach_pushed", metricLabel: "Accounts pushed to outreach", value: pushed, unit: "", confidence: "verified", meta: meta({ derivation: "count(account.pushedTo != null)" }) }),
    ];
  }
}

/** Registered adapters. Add a new production feed by appending here. */
export const ADAPTERS: MetricAdapter[] = [new ProspectsAdapter(), new CampaignsAdapter()];

export interface IngestionPreview {
  window: IngestionWindow;
  adapters: { sourceSystem: string; description: string; available: boolean; metrics: DerivedMetric[] }[];
  metrics: DerivedMetric[];
  totalMetrics: number;
  availableSources: number;
  emptySources: string[];
}

export interface IngestionResult extends IngestionPreview {
  persisted: number;
  demo: false;
}

/**
 * Compute (but do not persist) the metrics that would be ingested. Safe to call
 * for an operator preview — pure read over production data.
 */
export function previewIngestion(opts: { from?: string | null; to?: string | null; sourceSystem?: string | null } = {}): IngestionPreview {
  const window = makeWindow(opts.from, opts.to);
  const selected = opts.sourceSystem
    ? ADAPTERS.filter((a) => a.sourceSystem === opts.sourceSystem)
    : ADAPTERS;

  const adapters = selected.map((a) => {
    const available = a.available();
    const metrics = available ? a.derive(window) : [];
    return { sourceSystem: a.sourceSystem, description: a.description, available, metrics };
  });

  const metrics = adapters.flatMap((a) => a.metrics);
  const emptySources = adapters.filter((a) => !a.available || a.metrics.length === 0).map((a) => a.sourceSystem);

  return {
    window,
    adapters,
    metrics,
    totalMetrics: metrics.length,
    availableSources: adapters.filter((a) => a.available).length,
    emptySources,
  };
}

/**
 * Derive and PERSIST production metrics. Uses upsertProductionMetric so a repeat
 * ingest of the same window replaces its own prior production rows (idempotent)
 * and never touches demo rows. Returns provenance for every persisted metric.
 */
export function runIngestion(opts: { from?: string | null; to?: string | null; sourceSystem?: string | null } = {}): IngestionResult {
  const preview = previewIngestion(opts);
  let persisted = 0;
  for (const m of preview.metrics) {
    const row: InsertProductActivityMetric = {
      metricKey: m.metricKey,
      metricLabel: m.metricLabel,
      metricValue: m.value,
      unit: m.unit,
      sourceSystem: m.sourceSystem,
      sourceRecordId: m.sourceRecordId,
      confidence: m.confidence,
      isDemo: false,
      capturedAt: m.capturedAt,
      metadataJson: JSON.stringify(m.metadata),
    };
    storage.upsertProductionMetric(row);
    persisted++;
  }
  return { ...preview, persisted, demo: false };
}
