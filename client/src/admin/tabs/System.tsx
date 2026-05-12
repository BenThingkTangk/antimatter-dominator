/**
 * Admin → System Control Panel
 *
 * Live QA Analyzer view. Consumes /api/qa/status + /api/qa/incidents.
 * Auto-refreshes every 30s. Shows per-component status grid, open incidents
 * with AI-suggested remediation, and historical probe chart.
 */
import { Activity, RefreshCw, ShieldCheck, AlertCircle, Clock } from "lucide-react";
import { useAdminQuery, useAdminMutation } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix, LineSpark,
  ATOM_TEAL, ATOM_AMBER, ATOM_DANGER, ATOM_GREEN, ATOM_MUTED, ATOM_FAINT, EmptyState,
} from "../charts";
import { Markdown } from "@/mobile/Markdown";

interface StatusData {
  components: {
    name: string;
    status: "ok" | "degraded" | "down";
    uptime24h: number;
    avgLatency: number;
    lastProbedAt: string | null;
    lastIncident: { detectedAt: string; severity: string; remediation: string } | null;
  }[];
  openIncidents: {
    id: number;
    component: string;
    severity: string;
    detected_at: string;
    remediation: string;
  }[];
  totalProbes24h: number;
  byStatus: { name: string; value: number }[];
  hourly: { hour: string; ok: number; degraded: number; down: number }[];
}

function statusColor(s: string) {
  if (s === "ok") return ATOM_GREEN;
  if (s === "degraded") return ATOM_AMBER;
  return ATOM_DANGER;
}

export default function System() {
  const { data, isLoading, refetch } = useAdminQuery<StatusData>(["admin","qa","status"], "/api/qa/status", { refetchInterval: 30_000 });
  const resolveIncident = useAdminMutation<{ id: number; postMortem?: string }, any>("/api/qa/incidents", "POST", [["admin","qa","status"]]);
  const triggerProbe = useAdminMutation<{}, any>("/api/qa/probe", "POST", [["admin","qa","status"]]);

  const components = data?.components ?? [];
  const up = components.filter(c => c.status === "ok").length;
  const down = components.filter(c => c.status === "down").length;
  const degraded = components.filter(c => c.status === "degraded").length;
  const openIncidents = data?.openIncidents ?? [];

  const overallStatus = down > 0 ? "Outage" : degraded > 0 ? "Degraded" : "All systems nominal";
  const overallTone = down > 0 ? "danger" : degraded > 0 ? "warn" : "success";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Platform status" value={overallStatus} sub={`${components.length} components monitored`} tone={overallTone as any} icon={ShieldCheck} />
        <KpiCard label="Components up" value={up} sub="Last probe" tone="success" icon={Activity} />
        <KpiCard label="Degraded" value={degraded} sub="Above latency threshold" tone={degraded > 0 ? "warn" : "default"} />
        <KpiCard label="Down" value={down} sub="Failing health check" tone={down > 0 ? "danger" : "default"} icon={AlertCircle} />
        <KpiCard label="Open incidents" value={openIncidents.length} sub="Needs attention" tone={openIncidents.length > 0 ? "danger" : "success"} />
      </div>

      {/* Historical area + donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard
          title="Probe history · 24 hours"
          subtitle={`${data?.totalProbes24h ?? 0} probes, ${components.length} components`}
          height={240}
          action={
            <button
              onClick={() => triggerProbe.mutate({})}
              disabled={triggerProbe.isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                background: "rgba(105,106,172,0.08)", border: "1px solid rgba(105,106,172,0.32)",
                color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontSize: 10,
                letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={10} style={triggerProbe.isPending ? { animation: "spin 1s linear infinite" } : {}} />
              {triggerProbe.isPending ? "Probing…" : "Run probes now"}
            </button>
          }
        >
          <AreaStack
            data={data?.hourly ?? []}
            xKey="hour"
            series={[
              { key: "ok",       label: "OK",       color: ATOM_GREEN },
              { key: "degraded", label: "Degraded", color: ATOM_AMBER },
              { key: "down",     label: "Down",     color: ATOM_DANGER },
            ]}
          />
        </ChartCard>
        <ChartCard title="Current status mix" subtitle="Components by current state" height={240}>
          <DonutMix data={data?.byStatus ?? []} />
        </ChartCard>
      </div>

      {/* Component grid */}
      <ChartCard title="Components" subtitle="Live probe results, last 24h uptime" height="auto" as any>
        {isLoading ? <EmptyState message="Probing…" /> : components.length === 0 ? (
          <EmptyState message="No probe data. Click 'Run probes now' to start." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {components.map((c) => (
              <div key={c.name} style={{
                padding: 14, borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${statusColor(c.status)}22`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700,
                    color: "var(--color-text)", letterSpacing: "0.02em",
                  }}>{c.name}</span>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 10px", borderRadius: 999,
                    background: `${statusColor(c.status)}14`,
                    color: statusColor(c.status),
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: statusColor(c.status), boxShadow: `0 0 6px ${statusColor(c.status)}` }} />
                    {c.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: ATOM_MUTED }}>
                  <span>Uptime 24h <span style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>{c.uptime24h.toFixed(1)}%</span></span>
                  <span>p50 <span style={{ color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>{c.avgLatency}ms</span></span>
                </div>
                {c.lastProbedAt && (
                  <div style={{ marginTop: 6, fontSize: 10, color: ATOM_FAINT, fontFamily: "var(--font-mono)" }}>
                    Last probe {new Date(c.lastProbedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Open incidents */}
      <ChartCard title="Open incidents" subtitle="Auto-generated with suggested remediation">
        {openIncidents.length === 0 ? (
          <div style={{
            padding: "28px 18px",
            borderRadius: 10,
            background: "rgba(114,242,161,0.06)",
            border: "1px solid rgba(114,242,161,0.24)",
            textAlign: "center",
            color: ATOM_GREEN,
            fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            No open incidents · all systems nominal
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {openIncidents.map((inc) => (
              <div key={inc.id} style={{
                padding: 14, borderRadius: 12,
                background: "rgba(255,107,139,0.04)",
                border: "1px solid rgba(255,107,139,0.24)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-text)" }}>
                    {inc.component}
                  </span>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999,
                    background: "rgba(255,107,139,0.14)", color: ATOM_DANGER,
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                  }}>{inc.severity || "major"}</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: ATOM_MUTED, marginBottom: 8 }}>
                  <Clock size={10} /> Detected {new Date(inc.detected_at).toLocaleString()}
                </div>
                <div style={{
                  padding: 12, borderRadius: 8,
                  background: "rgba(105,106,172,0.04)",
                  border: "1px solid rgba(105,106,172,0.16)",
                  marginBottom: 8,
                }}>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10,
                    color: ATOM_TEAL, letterSpacing: "0.12em", textTransform: "uppercase",
                    marginBottom: 4,
                  }}>Suggested remediation</div>
                  <Markdown text={inc.remediation || "—"} />
                </div>
                <button
                  onClick={() => resolveIncident.mutate({ id: inc.id })}
                  disabled={resolveIncident.isPending}
                  style={{
                    padding: "6px 14px", borderRadius: 8,
                    background: ATOM_TEAL, color: "#041413",
                    border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  }}
                >Mark resolved</button>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
