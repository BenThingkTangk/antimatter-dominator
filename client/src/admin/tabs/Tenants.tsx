/**
 * Admin → Tenants
 *
 * Cross-tenant overview — growth, MRR stack, churn risk, power-user counts.
 */
import { Building2, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { useAdminQuery } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix, LineSpark, BarStack,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_MUTED, EmptyState,
} from "../charts";

interface TenantsData {
  kpis: { activeTenants: number; newThisMonth: number; mrrCents: number; atRisk: number };
  growth: { month: string; new_tenants: number; churned: number }[];
  mrrStack: { month: string; trial: number; starter: number; growth: number; advisory: number; enterprise: number }[];
  planMix: { name: string; value: number }[];
  tenantHealth: {
    slug: string; name: string; plan: string; dials30d: number; actions7d: number;
    seatsUsed: number; trial_ends_at: string | null; subscription_status: string;
    kill_switch: boolean; compliance_blocks_30d: number;
  }[];
}

function money(cents: number) {
  if (cents >= 100_000_00) return `$${(cents / 100_000_00).toFixed(1)}M`;
  if (cents >= 100_00) return `$${Math.round(cents / 100_00)}K`;
  return `$${(cents / 100).toFixed(0)}`;
}

export default function Tenants() {
  const { data } = useAdminQuery<TenantsData>(["admin","tenants"], "/api/admin/data?view=tenants-overview", { refetchInterval: 60_000 });
  const k = data?.kpis ?? { activeTenants: 0, newThisMonth: 0, mrrCents: 0, atRisk: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Active tenants" value={k.activeTenants} sub="Non-churned workspaces" tone="default" icon={Building2} />
        <KpiCard label="New · this month" value={k.newThisMonth} sub="Signups" tone="success" icon={TrendingUp} />
        <KpiCard label="MRR" value={money(k.mrrCents)} sub="Monthly recurring" tone="default" icon={DollarSign} />
        <KpiCard label="At risk" value={k.atRisk} sub="Churn indicators" tone={k.atRisk > 0 ? "warn" : "default"} icon={AlertTriangle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="MRR by plan · 12 months" subtitle="Trial / Starter / Growth / Advisory / Enterprise" height={280}>
          <AreaStack
            data={data?.mrrStack ?? []}
            xKey="month"
            series={[
              { key: "trial",      label: "Trial",      color: ATOM_MUTED },
              { key: "starter",    label: "Starter",    color: ATOM_TEAL_2 },
              { key: "growth",     label: "Growth",     color: ATOM_TEAL },
              { key: "advisory",   label: "Advisory",   color: ATOM_PURPLE },
              { key: "enterprise", label: "Enterprise", color: ATOM_AMBER },
            ]}
            valueFormatter={(v: number) => money(v)}
          />
        </ChartCard>
        <ChartCard title="Plan mix" height={280}>
          <DonutMix data={data?.planMix ?? []} />
        </ChartCard>
      </div>

      <ChartCard title="Tenant growth" subtitle="New vs churned, monthly" height={240}>
        <BarStack
          data={data?.growth ?? []}
          xKey="month"
          series={[
            { key: "new_tenants", label: "New", color: ATOM_GREEN },
            { key: "churned",     label: "Churned", color: "#ff6b8b" },
          ]}
        />
      </ChartCard>

      <ChartCard title="Tenant health" subtitle="Sorted by 30d dial activity">
        {!data?.tenantHealth?.length ? <EmptyState /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.tenantHealth.map((t) => (
              <div key={t.slug} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: t.kill_switch ? "rgba(255,107,139,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${t.kill_switch ? "rgba(255,107,139,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{t.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED }}>{t.slug} · {t.plan}</div>
                </div>
                <Cell label="Seats" value={t.seatsUsed} />
                <Cell label="Dials 30d" value={t.dials30d} />
                <Cell label="Actions 7d" value={t.actions7d} />
                <Cell label="Blocks 30d" value={t.compliance_blocks_30d} tone={t.compliance_blocks_30d > 0 ? "warn" : "default"} />
                <StatusPill status={t.subscription_status} trial={t.trial_ends_at} />
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function Cell({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: tone === "warn" ? ATOM_AMBER : "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
function StatusPill({ status, trial }: { status: string; trial: string | null }) {
  const color = status === "active" ? ATOM_GREEN : status === "trialing" ? ATOM_TEAL_2 : status === "past_due" ? ATOM_AMBER : "#ff6b8b";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
      <span style={{
        padding: "3px 10px", borderRadius: 999,
        background: `${color}14`, color,
        fontFamily: "var(--font-mono)", fontSize: 10,
        letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
      }}>{status}</span>
      {trial && status === "trialing" && (
        <span style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
          ends {new Date(trial).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}
