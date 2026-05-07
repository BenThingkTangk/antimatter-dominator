/**
 * Admin → Billing
 *
 * Cross-tenant MRR/ARR trajectory, plan ladder, recent invoices, past-due watch.
 * Data comes from /api/admin/data?view=billing-overview.
 */
import { DollarSign, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { useAdminQuery } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, LineSpark, BarStack,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_MUTED, ATOM_FAINT, EmptyState,
} from "../charts";

interface BillingData {
  kpis: { mrrCents: number; arrCents: number; churnRatePct: number; pastDue: number };
  mrrSeries: { month: string; mrr: number }[];
  arrSeries: { month: string; arr: number }[];
  planLadder: { plan: string; price_cents: number; tenants: number }[];
  recentInvoices: { id: string; tenant_slug: string; amount_cents: number; status: string; created_at: string }[];
}

const money = (cents: number) => {
  if (cents >= 100_000_00) return `$${(cents / 100_000_00).toFixed(1)}M`;
  if (cents >= 100_00) return `$${Math.round(cents / 100_00)}K`;
  return `$${(cents / 100).toFixed(0)}`;
};

const PLAN_COLOR: Record<string, string> = {
  trial: ATOM_MUTED,
  starter: ATOM_TEAL_2,
  growth: ATOM_TEAL,
  advisory: ATOM_PURPLE,
  enterprise: ATOM_AMBER,
};

export default function Billing() {
  const { data } = useAdminQuery<BillingData>(["admin", "billing"], "/api/admin/data?view=billing-overview", { refetchInterval: 60_000 });
  const k = data?.kpis ?? { mrrCents: 0, arrCents: 0, churnRatePct: 0, pastDue: 0 };

  const mrrLine = (data?.mrrSeries ?? []).map(r => ({ x: r.month.slice(2), y: r.mrr }));
  const arrLine = (data?.arrSeries ?? []).map(r => ({ x: r.month.slice(2), y: r.arr }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="MRR" value={money(k.mrrCents)} sub="Monthly recurring" tone="default" icon={DollarSign} />
        <KpiCard label="ARR" value={money(k.arrCents)} sub="Annualised" tone="success" icon={TrendingUp} />
        <KpiCard label="Churn rate" value={`${k.churnRatePct.toFixed(1)}%`} sub="Trailing 30d" tone={k.churnRatePct > 5 ? "warn" : "default"} icon={Activity} />
        <KpiCard label="Past due" value={k.pastDue} sub="Subscriptions in dunning" tone={k.pastDue > 0 ? "danger" : "default"} icon={AlertTriangle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="MRR · 12 months" subtitle="Revenue trajectory" height={240}>
          <LineSpark data={mrrLine} color={ATOM_TEAL} />
        </ChartCard>
        <ChartCard title="ARR · 12 months" subtitle="Annualised projection" height={240}>
          <LineSpark data={arrLine} color={ATOM_GREEN} />
        </ChartCard>
      </div>

      <ChartCard title="Plan ladder" subtitle="Monthly price × tenant count">
        {!data?.planLadder?.length ? <EmptyState /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {data.planLadder.map(p => (
              <div key={p.plan} style={{
                padding: 14, borderRadius: 12,
                background: `linear-gradient(180deg, ${PLAN_COLOR[p.plan] || ATOM_MUTED}1a, transparent)`,
                border: `1px solid ${PLAN_COLOR[p.plan] || ATOM_MUTED}40`,
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_MUTED, marginBottom: 4 }}>{p.plan}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: PLAN_COLOR[p.plan] || ATOM_TEAL, fontVariantNumeric: "tabular-nums" }}>
                  {money(p.price_cents)}<span style={{ fontSize: 12, color: ATOM_MUTED, fontWeight: 500 }}>/mo</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--color-text)", fontFamily: "var(--font-mono)" }}>
                  {p.tenants} tenant{p.tenants === 1 ? "" : "s"} · {money(p.price_cents * p.tenants)}/mo
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      <ChartCard title="Recent invoices" subtitle="Last 30 days · streamed from Stripe webhook">
        {!data?.recentInvoices?.length ? <EmptyState message="No invoices yet — connect Stripe to populate" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.recentInvoices.map(inv => (
              <div key={inv.id} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{inv.tenant_slug}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>{inv.id}</div>
                </div>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
                  {money(inv.amount_cents)}
                </span>
                <span style={{
                  padding: "3px 10px", borderRadius: 999,
                  background: inv.status === "paid" ? `${ATOM_GREEN}1a` : inv.status === "open" ? `${ATOM_AMBER}1a` : "rgba(255,107,139,0.16)",
                  color: inv.status === "paid" ? ATOM_GREEN : inv.status === "open" ? ATOM_AMBER : "#ff6b8b",
                  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                }}>{inv.status}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED }}>
                  {new Date(inv.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
