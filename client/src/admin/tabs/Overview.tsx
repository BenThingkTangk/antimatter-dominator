/**
 * Admin → Overview
 *
 * High-level health snapshot across the entire ΔTOM platform — KPIs, today's
 * activity, plan mix, recent incidents, top alerts.
 */
import { Activity, Building2, Users, Shield, Phone, AlertTriangle } from "lucide-react";
import { useAdminQuery } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix, LineSpark,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_AMBER, ATOM_DANGER, ATOM_GREEN, ATOM_MUTED, EmptyState,
} from "../charts";

interface OverviewData {
  kpis: { tenants: number; users: number; dialsToday: number; openIncidents: number; complianceBlocks24h: number };
  trend: { hour: string; dials: number; blocks: number; incidents: number }[];
  planMix: { name: string; value: number }[];
  recentEvents: { ts: string; severity: "info" | "warn" | "danger"; text: string }[];
}

export default function Overview() {
  const { data, isLoading } = useAdminQuery<OverviewData>(["admin","overview"], "/api/admin/overview", { refetchInterval: 60_000 });
  const kpis = data?.kpis ?? { tenants: 0, users: 0, dialsToday: 0, openIncidents: 0, complianceBlocks24h: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <KpiCard label="Active tenants" value={kpis.tenants} sub="Live workspaces" icon={Building2} tone="default" />
        <KpiCard label="Seats" value={kpis.users} sub="Across every tenant" icon={Users} tone="default" />
        <KpiCard label="Dials · Today" value={kpis.dialsToday} sub="ΔTOM Dial" icon={Phone} tone="success" />
        <KpiCard label="Compliance blocks · 24h" value={kpis.complianceBlocks24h} sub="TCPA pre-dial gate" icon={Shield} tone={kpis.complianceBlocks24h > 0 ? "warn" : "default"} />
        <KpiCard label="Open incidents" value={kpis.openIncidents} sub="System health" icon={AlertTriangle} tone={kpis.openIncidents > 0 ? "danger" : "success"} />
      </div>

      {/* Trend + Plan mix */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Activity · Last 24 hours" subtitle="Dials, compliance blocks, incidents" height={260}>
          <AreaStack
            data={data?.trend ?? []}
            xKey="hour"
            series={[
              { key: "dials",     label: "Dials",     color: ATOM_TEAL },
              { key: "blocks",    label: "Blocks",    color: ATOM_AMBER },
              { key: "incidents", label: "Incidents", color: ATOM_DANGER },
            ]}
          />
        </ChartCard>
        <ChartCard title="Plan distribution" subtitle="Tenants by plan" height={260}>
          <DonutMix data={data?.planMix ?? []} />
        </ChartCard>
      </div>

      {/* Recent events */}
      <ChartCard title="Recent platform events" subtitle="System + compliance + admin actions" height={300}>
        {isLoading || !data?.recentEvents?.length ? (
          <EmptyState message={isLoading ? "Loading…" : "No events yet"} />
        ) : (
          <div style={{ overflowY: "auto", height: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
            {data.recentEvents.map((e, i) => {
              const color = e.severity === "danger" ? ATOM_DANGER : e.severity === "warn" ? ATOM_AMBER : ATOM_GREEN;
              return (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "120px 8px 1fr",
                  gap: 12, alignItems: "center", padding: "8px 12px",
                  borderRadius: 8, background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED, letterSpacing: "0.06em" }}>
                    {new Date(e.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span style={{ fontSize: 13, color: "var(--color-text)" }}>{e.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
