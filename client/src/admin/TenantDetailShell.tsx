/**
 * /admin/t/:slug — per-tenant deep dashboard.
 *
 * Cinematic operator view for one tenant: dial volume, module usage,
 * power-user leaderboard, hour×day call heatmap, integrations, seats.
 * Reachable from Nirmata HQ tenant grid + churn-risk drill-in buttons.
 */
import { useRoute, useLocation } from "wouter";

interface TenantDetailShellProps { slug?: string; backHref?: string; }
import { ArrowLeft, Activity, Users, Plug, Phone, Shield, BarChart3 } from "lucide-react";
import { useAdminQuery } from "./useAdminApi";
import { useAdminKey } from "./AdminShell";
import {
  KpiCard, ChartCard, LineSpark, DonutMix, HeatmapGrid, LeaderboardRow, EmptyState,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_GREEN, ATOM_AMBER, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT,
} from "./charts";

interface DetailData {
  tenant: { id: string; slug: string; name: string; plan: string };
  kpis: {
    dials30d: number; actions30d: number; activeSeats: number;
    integrationsConnected: number; predialAllowed: number; predialBlocked: number;
  };
  dialTrend: { day: string; dials: number }[];
  moduleMix: { name: string; value: number }[];
  heatmap: number[][];
  leaderboard: { email: string; name: string; score: number; dials: number; conversion: number; tier: "top" | "mid" | "bottom" }[];
  users: { email: string; role: string; full_name: string | null; last_login_at: string | null; created_at: string }[];
  integrations: { provider: string; status: string; last_synced_at: string | null }[];
}

export default function TenantDetailShell({ slug: slugProp, backHref }: TenantDetailShellProps = {}) {
  const [, paramsDesktop] = useRoute<{ slug: string }>("/admin/t/:slug");
  const [, paramsMobile]  = useRoute<{ slug: string }>("/m/admin/t/:slug");
  const [, navigate] = useLocation();
  const slug = slugProp || paramsDesktop?.slug || paramsMobile?.slug || "antimatter";
  const back = backHref || (paramsMobile ? "/m/admin" : "/admin/hq");
  const { key } = useAdminKey();

  const { data, isLoading } = useAdminQuery<DetailData>(
    ["admin", "tenant-detail", slug],
    `/api/admin/data?view=tenant-detail&tenantSlug=${slug}`,
    { refetchInterval: 30_000, enabled: !!key },
  );

  if (!key) {
    return (
      <div style={{ padding: 28, borderRadius: 14,
        background: "linear-gradient(180deg, rgba(255,209,102,0.06), rgba(255,209,102,0.02))",
        border: "1px solid rgba(255,209,102,0.32)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_AMBER, marginBottom: 6 }}>Admin key required</div>
        <p style={{ color: "var(--color-text-muted)" }}>Set your <code>ADMIN_API_KEY</code> via <a href="#/admin" style={{ color: ATOM_TEAL }}>System Control</a>.</p>
      </div>
    );
  }

  const k = data?.kpis ?? { dials30d: 0, actions30d: 0, activeSeats: 0, integrationsConnected: 0, predialAllowed: 0, predialBlocked: 0 };
  const dialLine = (data?.dialTrend ?? []).map((d) => ({ x: d.day, y: d.dials }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => navigate(back)} style={{
            width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 10,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: ATOM_MUTED, cursor: "pointer",
          }} title="Back to HQ"><ArrowLeft size={16} /></button>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_MUTED }}>
              Tenant · {data?.tenant?.slug || slug}
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)" }}>
              {data?.tenant?.name || slug}
            </h1>
          </div>
        </div>
        {data?.tenant?.plan && (
          <span style={{
            padding: "6px 14px", borderRadius: 999,
            background: data.tenant.plan === "enterprise" ? `${ATOM_AMBER}1a` : `${ATOM_TEAL}1a`,
            color: data.tenant.plan === "enterprise" ? ATOM_AMBER : ATOM_TEAL,
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
          }}>{data.tenant.plan}</span>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <KpiCard label="Dials · 30d" value={k.dials30d} sub="Calls placed" tone="default" icon={Phone} />
        <KpiCard label="Actions · 30d" value={k.actions30d} sub="Module activations" tone="default" icon={Activity} />
        <KpiCard label="Seats" value={k.activeSeats} sub="Active members" tone="default" icon={Users} />
        <KpiCard label="Integrations" value={k.integrationsConnected} sub="Connected" tone="success" icon={Plug} />
        <KpiCard label="Pre-dial allowed" value={k.predialAllowed} sub="Last 7d" tone="success" icon={Shield} />
        <KpiCard label="Pre-dial blocked" value={k.predialBlocked} sub="Last 7d" tone={k.predialBlocked > 0 ? "warn" : "default"} icon={Shield} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Dial volume · 30d" subtitle="Daily" height={240}>
          <LineSpark data={dialLine} color={ATOM_TEAL} />
        </ChartCard>
        <ChartCard title="Module mix · 30d" subtitle="Where the team spends time" height={240}>
          <DonutMix data={data?.moduleMix ?? []} />
        </ChartCard>
      </div>

      <ChartCard title="Activity heatmap · 7d × 24h" subtitle="When this tenant runs" height={200}>
        <HeatmapGrid data={data?.heatmap ?? Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))} />
      </ChartCard>

      <ChartCard title="Power-user leaderboard" subtitle="Top reps by score · 30d activity">
        {!data?.leaderboard?.length ? <EmptyState message="Not enough activity yet" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.leaderboard.map((r, i) => (
              <LeaderboardRow key={r.email} rank={i+1} name={r.name} email={r.email} score={r.score} dials={r.dials} conversion={r.conversion} tier={r.tier} />
            ))}
          </div>
        )}
      </ChartCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="Members" subtitle={`${data?.users?.length ?? 0} seats`}>
          {!data?.users?.length ? <EmptyState message="No members yet" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.users.map((u) => (
                <div key={u.email} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center",
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{u.full_name || u.email}</div>
                    <div style={{ fontSize: 11, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>{u.email}</div>
                  </div>
                  <span style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                    background: u.role === "admin" ? `${ATOM_AMBER}1a` : "rgba(255,255,255,0.04)",
                    color: u.role === "admin" ? ATOM_AMBER : ATOM_MUTED,
                  }}>{u.role}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT }}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "never"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Integrations" subtitle="Status per provider">
          {!data?.integrations?.length ? <EmptyState message="No integrations connected" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.integrations.map((i) => (
                <div key={i.provider} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{i.provider}</span>
                  <span style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                    background: i.status === "connected" ? `${ATOM_GREEN}1a` : i.status === "error" ? `${ATOM_DANGER}1a` : "rgba(255,255,255,0.04)",
                    color: i.status === "connected" ? ATOM_GREEN : i.status === "error" ? ATOM_DANGER : ATOM_MUTED,
                  }}>{i.status}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
