/**
 * QA Analyzer Panel — live reliability monitor for all ATOM surfaces.
 *
 * Fetches /api/qa/status every 60s, renders KPI cards, per-component
 * status grid, open incidents with remediation, probe histogram, and
 * status donut.
 */
import { useState } from "react";
import { useAdminQuery, useAdminMutation } from "./useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix,
  ATOM_TEAL, ATOM_AMBER, ATOM_CORAL, ATOM_GREEN, ATOM_MUTED, ATOM_DANGER,
  ATOM_TEXT, EmptyState,
} from "./charts";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, ShieldAlert, XCircle,
  type LucideIcon,
} from "lucide-react";

// Cast lucide icons to match KpiCard's icon prop type
const asIcon = (I: LucideIcon) => I as unknown as React.ComponentType<{ size?: number }>;

/* ── Severity colors ─────────────────────────────────────────────────── */
const SEV_COLOR: Record<string, string> = {
  critical: ATOM_DANGER,
  major: ATOM_CORAL,
  minor: ATOM_AMBER,
};
const STATUS_COLOR: Record<string, string> = {
  ok: ATOM_GREEN,
  degraded: ATOM_AMBER,
  down: ATOM_CORAL,
  unknown: ATOM_MUTED,
};
const STATUS_LABEL: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "No data",
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface ComponentStatus {
  name: string;
  status: string;
  uptime24h: number | null;
  avgLatency: number | null;
  lastProbedAt: string | null;
  lastIncident: { id: string; severity: string; remediation: string; detected_at: string } | null;
  totalProbes: number;
}
interface Incident {
  id: string;
  component: string;
  severity: string;
  remediation: string | null;
  detected_at: string;
  resolved_at: string | null;
  post_mortem: string | null;
}
interface HourlyBucket {
  hour: string;
  ok: number;
  degraded: number;
  down: number;
}
interface StatusData {
  components: ComponentStatus[];
  openIncidents: Incident[];
  totalProbes24h: number;
  hourly: HourlyBucket[];
}

/* ── Inline markdown renderer (lightweight) ──────────────────────────── */
function MiniMarkdown({ text }: { text: string }) {
  // Handle **bold**, `code`, and *italic* inline
  const parts = text.split(/(\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g);
  return (
    <span>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} style={{ fontFamily: "var(--font-mono)", fontSize: "0.86em", padding: "1px 5px", borderRadius: 4, background: "rgba(0,230,211,0.08)", color: ATOM_TEAL }}>{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.endsWith("*"))
          return <em key={i}>{p.slice(1, -1)}</em>;
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/* ── Component ───────────────────────────────────────────────────────── */
export default function QaPanel() {
  const { data, isLoading } = useAdminQuery<StatusData>(
    ["qa", "status"],
    "/api/qa/status",
    { refetchInterval: 60_000 },
  );

  const resolveMutation = useAdminMutation<{ id: string; action: string; postMortem?: string }>(
    "/api/qa/incidents",
    "POST",
    [["qa", "status"]],
  );

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const components = data?.components ?? [];
  const openIncidents = data?.openIncidents ?? [];
  const totalProbes = data?.totalProbes24h ?? 0;
  const hourly = data?.hourly ?? [];

  const upCount = components.filter((c) => c.status === "ok").length;
  const degradedCount = components.filter((c) => c.status === "degraded").length;
  const downCount = components.filter((c) => c.status === "down").length;

  // Donut data
  const donutData = [
    { name: "Operational", value: upCount },
    { name: "Degraded", value: degradedCount },
    { name: "Down", value: downCount },
  ].filter((d) => d.value > 0);
  // If no data at all show all as unknown
  if (donutData.length === 0 && components.length > 0) {
    donutData.push({ name: "No data", value: components.length });
  }

  function handleResolve(id: string) {
    setResolvingId(id);
    resolveMutation.mutate({ id, action: "resolve" }, {
      onSettled: () => setResolvingId(null),
    });
  }

  const allOk = downCount === 0 && degradedCount === 0 && components.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="System Status"
          value={allOk ? "All Systems Go" : downCount > 0 ? `${downCount} Down` : `${degradedCount} Degraded`}
          sub={`${components.length} components monitored`}
          icon={asIcon(allOk ? CheckCircle2 : AlertTriangle)}
          tone={allOk ? "success" : downCount > 0 ? "danger" : "warn"}
        />
        <KpiCard
          label="Components Up"
          value={upCount}
          sub={`of ${components.length} total`}
          icon={asIcon(Activity)}
          tone="success"
        />
        <KpiCard
          label="Open Incidents"
          value={openIncidents.length}
          sub={openIncidents.length === 0 ? "All clear" : `${openIncidents.filter((i) => i.severity === "critical").length} critical`}
          icon={asIcon(ShieldAlert)}
          tone={openIncidents.length > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Probes · 24h"
          value={totalProbes}
          sub="Last 24 hours"
          icon={asIcon(Clock)}
          tone="default"
        />
      </div>

      {/* ── Component Grid ───────────────────────────────────────────── */}
      <div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
          textTransform: "uppercase", color: ATOM_MUTED, marginBottom: 10,
        }}>Component Status</div>
        {isLoading ? (
          <EmptyState message="Loading probes..." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {components.map((c) => {
              const color = STATUS_COLOR[c.status] || ATOM_MUTED;
              return (
                <div key={c.name} style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
                  border: `1px solid ${c.status === "down" ? `${ATOM_CORAL}44` : c.status === "degraded" ? `${ATOM_AMBER}33` : "rgba(255,255,255,0.06)"}`,
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 999,
                      background: color,
                      boxShadow: `0 0 8px ${color}88`,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                      color: ATOM_TEXT, letterSpacing: "0.04em",
                      flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{c.name}</span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color, letterSpacing: "0.08em", textTransform: "uppercase",
                      fontWeight: 700,
                    }}>{STATUS_LABEL[c.status] || c.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <Stat label="Uptime" value={c.uptime24h !== null ? `${c.uptime24h}%` : "--"} />
                    <Stat label="Avg ms" value={c.avgLatency !== null ? `${c.avgLatency}` : "--"} />
                    <Stat label="Probes" value={`${c.totalProbes}`} />
                  </div>
                  {c.lastProbedAt && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED }}>
                      Last: {new Date(c.lastProbedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Open Incidents ───────────────────────────────────────────── */}
      {openIncidents.length > 0 && (
        <ChartCard title="Open Incidents" subtitle={`${openIncidents.length} active`} height={openIncidents.length * 100 + 40}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {openIncidents.map((inc) => {
              const sevColor = SEV_COLOR[inc.severity] || ATOM_AMBER;
              return (
                <div key={inc.id} style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${sevColor}33`,
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <XCircle size={14} style={{ color: sevColor }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: ATOM_TEXT }}>
                      {inc.component}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      padding: "2px 8px", borderRadius: 999,
                      background: `${sevColor}1a`, border: `1px solid ${sevColor}44`,
                      color: sevColor,
                    }}>{inc.severity}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, marginLeft: "auto" }}>
                      {new Date(inc.detected_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {inc.remediation && (
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, paddingLeft: 24 }}>
                      <MiniMarkdown text={inc.remediation} />
                    </div>
                  )}
                  <div style={{ paddingLeft: 24 }}>
                    <button
                      onClick={() => handleResolve(inc.id)}
                      disabled={resolvingId === inc.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 8,
                        background: "rgba(114,242,161,0.08)",
                        border: "1px solid rgba(114,242,161,0.32)",
                        color: ATOM_GREEN, fontFamily: "var(--font-mono)",
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                        cursor: resolvingId === inc.id ? "wait" : "pointer",
                        opacity: resolvingId === inc.id ? 0.5 : 1,
                      }}
                    >
                      <CheckCircle2 size={12} />
                      {resolvingId === inc.id ? "Resolving..." : "Mark resolved"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* ── Charts ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Probe Results · Last 24h" subtitle="OK / Degraded / Down per hour" height={260}>
          <AreaStack
            data={hourly}
            xKey="hour"
            series={[
              { key: "ok",       label: "OK",       color: ATOM_GREEN },
              { key: "degraded", label: "Degraded", color: ATOM_AMBER },
              { key: "down",     label: "Down",     color: ATOM_CORAL },
            ]}
          />
        </ChartCard>
        <ChartCard title="Current Status" subtitle="Components by health" height={260}>
          <DonutMix data={donutData} />
        </ChartCard>
      </div>
    </div>
  );
}

/* ── Tiny stat helper ────────────────────────────────────────────────── */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: ATOM_MUTED }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: ATOM_TEXT, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
