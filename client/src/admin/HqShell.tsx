/**
 * NIRMATA HQ — Cross-tenant overlord console.
 *
 * Visible only to superAdmins (gated by AppLayout). Shows:
 *   • Top-line: portfolio MRR/ARR, paying tenants, trials, dials 30d
 *   • MRR trajectory by plan (12-month area stack)
 *   • Open incidents (live, from /api/qa/status feed)
 *   • Cross-tenant churn risk leaderboard (with one-click kill-switch)
 *   • Company OKR targets — editable inline
 *   • Cross-tenant module-usage heatmap (7d × 24h)
 *
 * Auth: requires ADMIN_API_KEY (same gate as /admin) + isSuperAdmin in session.
 * Data: GET /api/admin/data?view=hq — single Vercel function.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Crown, DollarSign, TrendingUp, AlertTriangle, Activity, Building2, Target, Flame, ArrowRight,
} from "lucide-react";
import { useAdminQuery, useAdminMutation } from "./useAdminApi";
import { useAdminKey } from "./AdminShell";
import { useSessionContext } from "../auth/AuthGate";
import {
  KpiCard, ChartCard, AreaStack, HeatmapGrid, EmptyState,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT,
} from "./charts";

interface HqData {
  kpis: {
    mrrCents: number; arrCents: number; tenants: number; paying: number; trials: number;
    atRisk: number; openIncidents: number; dials30d: number;
  };
  mrrSeries: any[];
  heatmap: number[][];
  churnRisk: { slug: string; name: string; plan: string; score: number; reasons: string[] }[];
  targets: Record<string, any[]>;
  incidents: { id: number; component: string; severity: string; status: string; started_at: string; resolved_at: string | null }[];
  tenants: { slug: string; name: string; plan: string; mrr: number; dials30d: number; actions7d: number; seatsUsed: number; compliance_blocks_30d: number; kill_switch: boolean; subscription_status: string }[];
}

const money = (cents: number) => {
  if (cents >= 100_000_00) return `$${(cents / 100_000_00).toFixed(1)}M`;
  if (cents >= 100_00) return `$${Math.round(cents / 100_00)}K`;
  return `$${(cents / 100).toFixed(0)}`;
};

export default function HqShell() {
  const { user, isSuperAdmin } = useSessionContext();
  const { key } = useAdminKey();
  const [location, navigate] = useLocation();
  const isMobile = location.startsWith("/m");
  const tenantPrefix = isMobile ? "/m/admin/t" : "/admin/t";

  const { data, isLoading, refetch } = useAdminQuery<HqData>(["admin","hq"], "/api/admin/data?view=hq", {
    refetchInterval: 30_000, enabled: !!key,
  });
  const killSwitch = useAdminMutation<any, any>("/api/admin/data?view=tenant-killswitch", "POST", [["admin","hq"]]);
  const updateTarget = useAdminMutation<any, any>("/api/admin/data?view=target-update", "POST", [["admin","hq"]]);

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 28, borderRadius: 16,
          background: "linear-gradient(180deg, rgba(255,107,139,0.06), rgba(255,107,139,0.02))",
          border: "1px solid rgba(255,107,139,0.32)", textAlign: "center" }}>
          <Crown size={28} style={{ color: ATOM_AMBER, marginBottom: 12 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>Nirmata HQ — restricted</div>
          <p style={{ color: ATOM_MUTED }}>This overlord console is visible only to Nirmata super_admins. Your account ({user?.email || "anon"}) is not on the allow-list.</p>
        </div>
      </div>
    );
  }

  if (!key) {
    return (
      <div style={{ padding: 28, borderRadius: 14,
        background: "linear-gradient(180deg, rgba(255,209,102,0.06), rgba(255,209,102,0.02))",
        border: "1px solid rgba(255,209,102,0.32)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_AMBER, marginBottom: 6 }}>Admin key required</div>
        <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>Open <a href="#/admin" style={{ color: ATOM_TEAL }}>System Control</a> to set your <code>ADMIN_API_KEY</code>, then return here.</p>
      </div>
    );
  }

  const k = data?.kpis ?? { mrrCents: 0, arrCents: 0, tenants: 0, paying: 0, trials: 0, atRisk: 0, openIncidents: 0, dials30d: 0 };
  const mrrLabel = "Portfolio MRR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_AMBER, marginBottom: 6 }}>
            <Crown size={14} /> Nirmata · Overlord
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)" }}>
            HQ Console
          </h1>
          <p style={{ color: ATOM_MUTED, marginTop: 6, fontSize: 14 }}>
            Cross-tenant revenue, incidents, churn risk, and OKRs across the entire ΔTOM portfolio.
          </p>
        </div>
        <button onClick={() => refetch()} style={{
          padding: "8px 14px", borderRadius: 10,
          background: "rgba(0,230,211,0.06)", border: "1px solid rgba(0,230,211,0.24)",
          color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
          cursor: "pointer",
        }}>Refresh feed</button>
      </header>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <KpiCard label={mrrLabel} value={money(k.mrrCents)} sub="Monthly recurring" tone="success" icon={DollarSign} />
        <KpiCard label="ARR" value={money(k.arrCents)} sub="Annualised" tone="default" icon={TrendingUp} />
        <KpiCard label="Tenants" value={k.tenants} sub={`${k.paying} paying · ${k.trials} trial`} tone="default" icon={Building2} />
        <KpiCard label="Dials · 30d" value={k.dials30d} sub="Across portfolio" tone="default" icon={Activity} />
        <KpiCard label="At-risk" value={k.atRisk} sub="Churn signals firing" tone={k.atRisk > 0 ? "warn" : "default"} icon={AlertTriangle} />
        <KpiCard label="Incidents" value={k.openIncidents} sub="Open · live QA feed" tone={k.openIncidents > 0 ? "danger" : "success"} icon={Flame} />
      </div>

      {/* Revenue trajectory + Heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Portfolio MRR · 12 months" subtitle="By plan tier" height={280}>
          <AreaStack
            data={data?.mrrSeries ?? []}
            xKey="month"
            series={[
              { key: "trial",      label: "Trial",      color: ATOM_MUTED },
              { key: "starter",    label: "Starter",    color: ATOM_TEAL_2 },
              { key: "growth",     label: "Growth",     color: ATOM_TEAL },
              { key: "advisory",   label: "Advisory",   color: ATOM_PURPLE },
              { key: "enterprise", label: "Enterprise", color: ATOM_AMBER },
            ]}
            valueFormatter={money}
          />
        </ChartCard>
        <ChartCard title="Module usage · 7d × 24h" subtitle="Cross-tenant heatmap" height={280}>
          <HeatmapGrid data={data?.heatmap ?? Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))} />
        </ChartCard>
      </div>

      {/* Churn risk + Incidents */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
        <ChartCard title="Churn risk · live" subtitle="Sorted by signal score · click to drill in">
          {!data?.churnRisk?.length ? <EmptyState message="No churn signals — portfolio is healthy" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.churnRisk.map((r) => (
                <div key={r.slug} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
                  padding: "12px 14px", borderRadius: 10,
                  background: r.score >= 70 ? "rgba(255,107,139,0.06)" : "rgba(255,209,102,0.04)",
                  border: `1px solid ${r.score >= 70 ? "rgba(255,107,139,0.28)" : "rgba(255,209,102,0.18)"}`,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center",
                    background: r.score >= 70 ? `${ATOM_DANGER}20` : `${ATOM_AMBER}20`,
                    color: r.score >= 70 ? ATOM_DANGER : ATOM_AMBER,
                    fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums",
                  }}>{r.score}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{r.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>{r.plan}</span>
                      {r.reasons.map((rr) => (
                        <span key={rr} style={{
                          padding: "1px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase",
                          background: "rgba(255,255,255,0.04)", color: ATOM_FAINT, border: "1px solid rgba(255,255,255,0.06)",
                        }}>{rr}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => navigate(`${tenantPrefix}/${r.slug}`)} style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                    background: "rgba(0,230,211,0.08)", border: "1px solid rgba(0,230,211,0.24)", color: ATOM_TEAL, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>Drill in <ArrowRight size={11} /></button>
                  <button
                    onClick={() => { if (confirm(`Toggle kill-switch on ${r.name}?`)) killSwitch.mutate({ tenantSlug: r.slug, enabled: true }); }}
                    title="Engage kill-switch (read-only mode)"
                    style={{
                      padding: "6px 10px", borderRadius: 8, fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                      background: "transparent", border: "1px solid rgba(255,107,139,0.32)", color: ATOM_DANGER, cursor: "pointer",
                    }}>kill</button>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Open incidents" subtitle="Live QA Analyzer feed">
          {!data?.incidents?.length ? <EmptyState message="All systems nominal" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.incidents.slice(0, 8).map((i) => (
                <div key={i.id} style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: i.status === "resolved" ? "rgba(114,242,161,0.04)" : "rgba(255,107,139,0.06)",
                  border: `1px solid ${i.status === "resolved" ? "rgba(114,242,161,0.16)" : "rgba(255,107,139,0.24)"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text)", fontWeight: 700 }}>{i.component}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      background: i.severity === "critical" ? "rgba(255,107,139,0.16)" : "rgba(255,209,102,0.16)",
                      color: i.severity === "critical" ? ATOM_DANGER : ATOM_AMBER,
                    }}>{i.severity}</span>
                  </div>
                  <div style={{ fontSize: 10, color: ATOM_FAINT, fontFamily: "var(--font-mono)" }}>
                    {new Date(i.started_at).toLocaleString()}{i.resolved_at ? ` → resolved ${new Date(i.resolved_at).toLocaleTimeString()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* OKR Targets */}
      <ChartCard title="Company OKRs" subtitle="2026Q2 + FY2026 · click any value to edit" action={<Target size={14} style={{ color: ATOM_AMBER }} />}>
        {Object.keys(data?.targets || {}).length === 0 ? <EmptyState message="No targets seeded yet" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {Object.entries(data!.targets).map(([horizon, rows]) => (
              <div key={horizon}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_MUTED, marginBottom: 8 }}>
                  {horizon}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {(rows as any[]).map((t) => (
                    <TargetCard key={t.id} target={t} onSave={(p) => updateTarget.mutate({ id: t.id, ...p })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Tenant grid (drill-in cards) */}
      <ChartCard title="Tenants" subtitle="Click any card to drill into per-tenant analytics">
        {!data?.tenants?.length ? <EmptyState /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {data.tenants.map((t) => (
              <button key={t.slug} onClick={() => navigate(`${tenantPrefix}/${t.slug}`)} style={{
                textAlign: "left", padding: 14, borderRadius: 12,
                background: t.kill_switch ? "rgba(255,107,139,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${t.kill_switch ? "rgba(255,107,139,0.2)" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer", color: "var(--color-text)",
                transition: "transform 160ms cubic-bezier(0.16,1,0.3,1), border-color 160ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,230,211,0.32)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.kill_switch ? "rgba(255,107,139,0.2)" : "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.08em" }}>{t.slug}</div>
                  </div>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                    background: t.plan === "enterprise" ? `${ATOM_AMBER}1a` : t.plan === "trial" ? "rgba(255,255,255,0.04)" : `${ATOM_TEAL}1a`,
                    color: t.plan === "enterprise" ? ATOM_AMBER : t.plan === "trial" ? ATOM_MUTED : ATOM_TEAL,
                  }}>{t.plan}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 10 }}>
                  <Mini label="MRR" value={money(t.mrr)} />
                  <Mini label="Dials 30d" value={t.dials30d.toString()} />
                  <Mini label="Seats" value={t.seatsUsed.toString()} />
                </div>
              </button>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function TargetCard({ target, onSave }: { target: any; onSave: (p: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>(String(target.current_value ?? 0));
  const pct = target.target_value > 0 ? Math.min(100, (target.current_value / target.target_value) * 100) : 0;
  const tone = pct >= 90 ? ATOM_GREEN : pct >= 60 ? ATOM_TEAL : pct >= 30 ? ATOM_AMBER : ATOM_DANGER;
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
        {target.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        {editing ? (
          <input
            autoFocus
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { onSave({ current_value: Number(val) }); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onSave({ current_value: Number(val) }); setEditing(false); } }}
            style={{
              fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: tone, background: "transparent",
              border: `1px solid ${tone}40`, borderRadius: 6, padding: "2px 6px", width: 100, outline: "none",
            }}
          />
        ) : (
          <span onClick={() => setEditing(true)} style={{
            fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: tone, fontVariantNumeric: "tabular-nums",
            cursor: "pointer", borderBottom: "1px dashed transparent",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = `${tone}80`)}
          onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
          >{Number(target.current_value ?? 0).toLocaleString()}</span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: ATOM_FAINT }}>
          / {Number(target.target_value ?? 0).toLocaleString()} {target.unit || ""}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone, boxShadow: `0 0 12px ${tone}80` }} />
      </div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {pct.toFixed(0)}% to target
      </div>
    </div>
  );
}
