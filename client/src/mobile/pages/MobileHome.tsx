/**
 * Mobile Home — KPI hero + quick actions + 6 module tiles.
 *
 * Stack/vendor names are intentionally aliased: the user-facing surface never
 * mentions Hume, Claude, GPT, Perplexity, Sonar, Pinecone, pplx-embed, etc.
 * Internal naming scheme:
 *   PiQ       = voice runtime
 *   NirmX-UFO = LLM ensemble
 *   SiQ       = embeddings / RAG
 *   XiQ       = vector store
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  PhoneCall, Radar, MessageSquare, ChevronRight,
  Swords, TrendingUp, MessageSquareWarning, Shield, Brain, Megaphone,
} from "lucide-react";
import { MobileShell } from "../MobileShell";
import { useTenant } from "../../lib/useTenant";

interface Stats {
  callsToday: number;
  pipelineUsd: number;
  hotLeads: number;
}

const FALLBACK: Stats = { callsToday: 0, pipelineUsd: 0, hotLeads: 0 };

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

interface QuickAction {
  href: string;
  icon: any;
  label: string;
  sub: string;
  /** Icon chip accent color */
  accent: string;
  accentBg: string;
}

const PRIMARY_ACTIONS: QuickAction[] = [
  {
    href: "/m/dial", icon: PhoneCall, label: "Dial with ΔTOM",
    sub: "Voice agent · instant pickup",
    accent: "#696aac", accentBg: "rgba(105,106,172,0.1)",
  },
  {
    href: "/m/leads", icon: Radar, label: "Lead queue",
    sub: "Swipe to dial or snooze",
    accent: "#8587e3", accentBg: "rgba(0,167,255,0.1)",
  },
  {
    href: "/m/chat", icon: MessageSquare, label: "Ask ΔTOM",
    sub: "Markets, accounts, objections",
    accent: "#9b7bff", accentBg: "rgba(155,123,255,0.12)",
  },
];

const MODULE_ACTIONS: QuickAction[] = [
  {
    href: "/m/war-room", icon: Swords, label: "ΔTOM War Room",
    sub: "Live account intel + plays",
    accent: "#ff6b8b", accentBg: "rgba(255,107,139,0.12)",
  },
  {
    href: "/m/pitch", icon: TrendingUp, label: "ΔTOM Pitch",
    sub: "Precision pitch writer",
    accent: "#696aac", accentBg: "rgba(105,106,172,0.1)",
  },
  {
    href: "/m/objections", icon: MessageSquareWarning, label: "ΔTOM Objection Handler",
    sub: "Counter-objections with evidence",
    accent: "#ffd166", accentBg: "rgba(255,209,102,0.12)",
  },
  {
    href: "/m/market", icon: Shield, label: "ΔTOM Market Intent",
    sub: "Live buying signals",
    accent: "#72f2a1", accentBg: "rgba(114,242,161,0.12)",
  },
  {
    href: "/m/prospects", icon: Megaphone, label: "ΔTOM Prospect",
    sub: "Scan + enrich accounts",
    accent: "#8587e3", accentBg: "rgba(0,167,255,0.12)",
  },
  {
    href: "/m/warbook", icon: Brain, label: "ΔTOM WarBook",
    sub: "Deep intel on any company",
    accent: "#b987ff", accentBg: "rgba(185,135,255,0.12)",
  },
];

function QuickRow({ a }: { a: QuickAction }) {
  const Icon = a.icon;
  return (
    <Link href={a.href} className="m-row-btw" style={{ padding: "10px 0", textDecoration: "none", color: "inherit" }}>
      <span className="m-row" style={{ gap: 14 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 10,
          display: "grid", placeItems: "center",
          background: a.accentBg, color: a.accent,
        }}>
          <Icon size={18} />
        </span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700 }}>{a.label}</span>
          <span className="m-text-muted" style={{ fontSize: 13 }}>{a.sub}</span>
        </span>
      </span>
      <ChevronRight size={18} className="m-text-faint" />
    </Link>
  );
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
          callsToday:  d.callsToday  ?? 0,
          pipelineUsd: d.pipelineUsd ?? 0,
          hotLeads:    d.hotLeads    ?? 0,
        });
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  return (
    <MobileShell>
      <div className="m-stack-lg">
        {/* Hero KPI card */}
        <div className="m-card m-card-glow">
          <div className="m-eyebrow">{tenant?.name ?? "ΔTOM"} · Today</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <span className="m-kpi m-kpi-xl">{stats.callsToday}</span>
            <span className="m-text-muted" style={{ fontSize: 14 }}>calls dialled</span>
          </div>
          <div className="m-divider" />
          <div>
            <div className="m-eyebrow">Pipeline</div>
            <div className="m-kpi m-kpi-md" style={{ marginTop: 4 }}>{formatUsd(stats.pipelineUsd)}</div>
          </div>
        </div>

        {/* Primary quick actions */}
        <div className="m-card">
          <div className="m-card-eyebrow" style={{ marginBottom: 12 }}>Quick actions</div>
          <div className="m-stack">
            {PRIMARY_ACTIONS.map((a, i) => (
              <div key={a.href}>
                <QuickRow a={a} />
                {i < PRIMARY_ACTIONS.length - 1 && <div className="m-divider" />}
              </div>
            ))}
          </div>
        </div>

        {/* ΔTOM module suite — parity with web app */}
        <div className="m-card">
          <div className="m-card-eyebrow" style={{ marginBottom: 12 }}>ΔTOM modules</div>
          <div className="m-stack">
            {MODULE_ACTIONS.map((a, i) => (
              <div key={a.href}>
                <QuickRow a={a} />
                {i < MODULE_ACTIONS.length - 1 && <div className="m-divider" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
