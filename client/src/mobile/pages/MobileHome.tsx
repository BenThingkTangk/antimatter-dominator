/**
 * Mobile Home — KPI hero + quick actions + live tile.
 *
 * Pulls live numbers from /api/atom-stats when available; falls back to
 * sensible zeros so the screen still looks intentional on a fresh tenant.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PhoneCall, Radar, MessageSquare, ChevronRight, Activity, Zap } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { useTenant } from "../../lib/useTenant";

interface Stats {
  callsToday: number;
  pipelineUsd: number;
  firstTokenMs: number;
  hotLeads: number;
}

const FALLBACK: Stats = { callsToday: 0, pipelineUsd: 0, firstTokenMs: 264, hotLeads: 0 };

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export default function MobileHome() {
  const { tenant } = useTenant();
  const [stats, setStats] = useState<Stats>(FALLBACK);

  useEffect(() => {
    fetch("/api/atom-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStats({
          callsToday:   d.callsToday   ?? 0,
          pipelineUsd:  d.pipelineUsd  ?? 0,
          firstTokenMs: d.firstTokenMs ?? FALLBACK.firstTokenMs,
          hotLeads:     d.hotLeads     ?? 0,
        });
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  return (
    <MobileShell>
      <div className="m-stack-lg">
        {/* Hero KPI card */}
        <div className="m-card m-card-glow">
          <div className="m-eyebrow">{tenant?.name ?? "ATOM"} · Today</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span className="m-kpi m-kpi-xl">{stats.callsToday}</span>
            <span className="m-text-muted" style={{ fontSize: 14 }}>calls dialled</span>
          </div>
          <div className="m-divider" />
          <div className="m-grid-2">
            <div>
              <div className="m-eyebrow">Pipeline</div>
              <div className="m-kpi m-kpi-md">{formatUsd(stats.pipelineUsd)}</div>
            </div>
            <div>
              <div className="m-eyebrow">First token</div>
              <div className="m-kpi m-kpi-md">{stats.firstTokenMs}<span style={{ fontSize: 16, marginLeft: 4 }}>ms</span></div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="m-card">
          <div className="m-card-eyebrow" style={{ marginBottom: 12 }}>Quick actions</div>
          <div className="m-stack">
            <Link href="/m/dial" className="m-row-btw" style={{ padding: "10px 0", textDecoration: "none", color: "inherit" }}>
              <span className="m-row" style={{ gap: 14 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(0,230,211,0.1)", color: "#00e6d3" }}>
                  <PhoneCall size={18} />
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700 }}>Dial with ATOM</span>
                  <span className="m-text-muted" style={{ fontSize: 13 }}>Steve Jobs voice · Hume EVI · 264ms</span>
                </span>
              </span>
              <ChevronRight size={18} className="m-text-faint" />
            </Link>

            <div className="m-divider" />

            <Link href="/m/leads" className="m-row-btw" style={{ padding: "10px 0", textDecoration: "none", color: "inherit" }}>
              <span className="m-row" style={{ gap: 14 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(0,167,255,0.1)", color: "#00a7ff" }}>
                  <Radar size={18} />
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700 }}>Lead queue</span>
                  <span className="m-text-muted" style={{ fontSize: 13 }}>{stats.hotLeads} hot · swipe to dial</span>
                </span>
              </span>
              <ChevronRight size={18} className="m-text-faint" />
            </Link>

            <div className="m-divider" />

            <Link href="/m/chat" className="m-row-btw" style={{ padding: "10px 0", textDecoration: "none", color: "inherit" }}>
              <span className="m-row" style={{ gap: 14 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(155,123,255,0.12)", color: "#9b7bff" }}>
                  <MessageSquare size={18} />
                </span>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontWeight: 700 }}>Ask ATOM</span>
                  <span className="m-text-muted" style={{ fontSize: 13 }}>Sonar · Sonar Pro · live citations</span>
                </span>
              </span>
              <ChevronRight size={18} className="m-text-faint" />
            </Link>
          </div>
        </div>

        {/* Status strip */}
        <div className="m-card">
          <div className="m-row-btw">
            <span className="m-pill m-pill-live"><span className="m-pill-dot" />Live</span>
            <span className="m-text-muted m-mono" style={{ fontSize: 11 }}>EVI · GPT-5 ensemble</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
            <div>
              <div className="m-eyebrow">Voice</div>
              <div className="m-row" style={{ gap: 6, marginTop: 4 }}>
                <Activity size={14} color="#00e6d3" />
                <span style={{ fontSize: 13 }}>Hume EVI</span>
              </div>
            </div>
            <div>
              <div className="m-eyebrow">RAG</div>
              <div className="m-row" style={{ gap: 6, marginTop: 4 }}>
                <Zap size={14} color="#00e6d3" />
                <span style={{ fontSize: 13 }}>pplx-embed</span>
              </div>
            </div>
            <div>
              <div className="m-eyebrow">Tier</div>
              <div className="m-row" style={{ gap: 6, marginTop: 4 }}>
                <span className="m-mono" style={{ color: tenant?.plan === "enterprise" ? "#00e6d3" : "#9ca8ad", fontSize: 13 }}>
                  {(tenant?.plan ?? "standard").toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
