/**
 * liveNumbersEngine — the single source of truth for any numeric claim ATOM
 * Content is allowed to make. It queries product_activity_metrics, filters by
 * source / window / confidence, and attaches provenance to every metric so the
 * generator can never invent a number.
 *
 * Confidence policy:
 *   verified | high  → usable in final content
 *   medium           → suggestable, but must be flagged for review
 *   low | unverified → never usable as a factual claim
 */
import { storage } from "../storage";
import type { ProductActivityMetric } from "@shared/schema";

export type MetricConfidence = "verified" | "high" | "medium" | "low" | "unverified";

export interface LiveMetric {
  metricKey: string;
  metricLabel: string;
  value: number;
  unit: string;
  display: string; // human-formatted, e.g. "42", "31%", "5,204 events"
  sourceSystem: string;
  sourceRecordId: string | null;
  confidence: MetricConfidence;
  capturedAt: string;
  isDemo: boolean;
  usableInFinal: boolean; // verified | high
  suggestableOnly: boolean; // medium
}

export interface LiveNumbersQuery {
  sourceSystem?: string | null;
  from?: string | null;
  to?: string | null;
  /** When true, demo-seeded metrics are eligible (demo mode). */
  allowDemoData?: boolean;
  /** Minimum confidence to include. Defaults to "low" (excludes unverified). */
  minConfidence?: MetricConfidence;
}

export interface LiveNumbersResult {
  metrics: LiveMetric[];
  usable: LiveMetric[]; // verified|high
  suggestable: LiveMetric[]; // medium
  unusable: LiveMetric[]; // low|unverified
  hasUsable: boolean;
  fallbackMessage: string | null;
  demoMode: boolean;
}

const RANK: Record<MetricConfidence, number> = {
  unverified: 0,
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

export function formatMetric(value: number, unit: string): string {
  const n = Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (!unit) return n;
  if (unit === "%") return `${n}%`;
  if (unit === "$M") return `$${n}M`;
  return `${n} ${unit}`;
}

function toLiveMetric(m: ProductActivityMetric): LiveMetric {
  const confidence = (m.confidence as MetricConfidence) || "unverified";
  return {
    metricKey: m.metricKey,
    metricLabel: m.metricLabel,
    value: m.metricValue,
    unit: m.unit,
    display: formatMetric(m.metricValue, m.unit),
    sourceSystem: m.sourceSystem,
    sourceRecordId: m.sourceRecordId ?? null,
    confidence,
    capturedAt: m.capturedAt,
    isDemo: !!m.isDemo,
    usableInFinal: confidence === "verified" || confidence === "high",
    suggestableOnly: confidence === "medium",
  };
}

export function getLiveNumbers(query: LiveNumbersQuery = {}): LiveNumbersResult {
  const minConfidence = query.minConfidence ?? "low";
  const minRank = RANK[minConfidence];

  const raw = storage.getProductActivityMetrics({
    sourceSystem: query.sourceSystem || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    includeDemo: !!query.allowDemoData,
  });

  const metrics = raw
    .map(toLiveMetric)
    .filter((m) => RANK[m.confidence] >= minRank);

  const usable = metrics.filter((m) => m.usableInFinal);
  const suggestable = metrics.filter((m) => m.suggestableOnly);
  const unusable = metrics.filter((m) => !m.usableInFinal && !m.suggestableOnly);

  const demoMode = !!query.allowDemoData;
  let fallbackMessage: string | null = null;
  if (usable.length === 0) {
    fallbackMessage = demoMode
      ? "No verified or high-confidence metrics in this window. Demo data is enabled but still cannot back factual claims unless promoted. Numeric claims will be omitted or marked needs-verification."
      : "No verified or high-confidence product activity metrics available for this window. ATOM Content will omit numeric claims or mark them as needing verification. Enable demo mode only for non-production drafts.";
  }

  return {
    metrics,
    usable,
    suggestable,
    unusable,
    hasUsable: usable.length > 0,
    fallbackMessage,
    demoMode,
  };
}

/** Look up a single metric by key within an already-computed result. */
export function findMetric(result: LiveNumbersResult, metricKey: string): LiveMetric | undefined {
  return result.metrics.find((m) => m.metricKey === metricKey);
}
