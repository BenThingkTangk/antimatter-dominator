import { useState } from "react";
import { Megaphone, Mail, Linkedin, Phone, MessageSquare, Rocket, Clock, ArrowUpRight, Activity } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";

const SEQUENCE = [
  { day: "Day 1", channel: "Email", icon: Mail, color: "#f5c842" },
  { day: "Day 2", channel: "LinkedIn", icon: Linkedin, color: "#38bdf8" },
  { day: "Day 3", channel: "Call", icon: Phone, color: "#00d4ff" },
  { day: "Day 5", channel: "SMS", icon: MessageSquare, color: "#7c3aed" },
];

interface Campaign {
  name: string;
  vertical: string;
  contacts: number;
  sent: number;
  open: number;
  reply: number;
  status: "Active" | "Scheduled";
  /** 0..100 ATOM-computed health */
  health: number;
  sendWindow: string;
  nextStep: string;
}

const CAMPAIGNS: Campaign[] = [
  { name: "Q3 SaaS Expansion", vertical: "SaaS", contacts: 1240, sent: 982, open: 47, reply: 12, status: "Active", health: 88, sendWindow: "Tue–Thu · 9–11am local", nextStep: "Advance 214 openers to Day-3 call" },
  { name: "Logistics Reactivation", vertical: "Logistics", contacts: 640, sent: 410, open: 39, reply: 8, status: "Active", health: 64, sendWindow: "Mon/Wed · 1–3pm local", nextStep: "A/B test subject line on cold half" },
  { name: "Healthcare ABM", vertical: "Healthcare", contacts: 320, sent: 188, open: 52, reply: 17, status: "Active", health: 92, sendWindow: "Tue–Thu · 8–10am local", nextStep: "Route 11 replies to AE today" },
  { name: "Fintech Founders", vertical: "Fintech", contacts: 510, sent: 0, open: 0, reply: 0, status: "Scheduled", health: 0, sendWindow: "Launches Mon 9am", nextStep: "Warm sending domain · 48h" },
];

function healthColor(h: number) {
  if (h >= 80) return "#34d399";
  if (h >= 55) return "#f5c842";
  if (h > 0) return "#fb7185";
  return "rgba(246,248,255,0.3)";
}

function CampaignCard({ c }: { c: Campaign }) {
  const [open, setOpen] = useState(false);
  const hc = healthColor(c.health);
  return (
    <GlassCard className="p-4 transition-all" data-testid={`campaign-card-${c.name.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "#f6f8ff" }}>{c.name}</p>
          <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.5)" }}>{c.vertical} · {c.contacts} contacts</p>
        </div>
        <span
          className="text-[10px] font-mono uppercase px-2 py-1 rounded-full shrink-0"
          style={
            c.status === "Active"
              ? { background: "rgba(52,211,153,0.14)", color: "#34d399" }
              : { background: "rgba(245,200,66,0.14)", color: "#f5c842" }
          }
        >
          {c.status}
        </span>
      </div>

      {/* health */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(246,248,255,0.45)" }}>
            <Activity size={10} /> Campaign health
          </span>
          <span className="text-[10px] font-mono" style={{ color: hc }}>{c.health || "—"}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full" style={{ width: `${c.health}%`, background: hc }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: "#f6f8ff" }}>{c.sent}</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>Sent</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: SALES_OS.cyan }}>{c.open}%</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>Open</p>
        </div>
        <div>
          <p className="text-sm font-bold tabular-nums" style={{ color: "#34d399" }}>{c.reply}%</p>
          <p className="text-[9px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>Reply</p>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        data-testid={`campaign-expand-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
        className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px]"
        style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)", color: SALES_OS.cyan }}
      >
        <span className="font-mono uppercase tracking-wider">Orchestration</span>
        <ArrowUpRight size={12} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(246,248,255,0.6)" }}>
            <Clock size={12} style={{ color: SALES_OS.cyan }} /> {c.sendWindow}
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {SEQUENCE.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.day} className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: `${s.color}14`, border: `1px solid ${s.color}44` }}>
                    <Icon size={12} style={{ color: s.color }} />
                    <span className="text-[10px]" style={{ color: "#f6f8ff" }}>{s.channel}</span>
                  </div>
                  {i < SEQUENCE.length - 1 && <div className="w-3 h-px shrink-0" style={{ background: "rgba(0,212,255,0.3)" }} />}
                </div>
              );
            })}
          </div>
          <div className="p-2.5 rounded-lg" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.28)" }}>
            <span className="text-[9px] font-mono uppercase tracking-wider block" style={{ color: "#c4b5fd" }}>
              ATOM next best step
            </span>
            <span className="text-xs font-semibold" style={{ color: "#f6f8ff" }}>{c.nextStep}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

export default function Campaigns() {
  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 03"
        title="Campaigns"
        subtitle="Multichannel outbound orchestration — ATOM runs the cadence."
        icon={<Megaphone size={22} />}
        actions={
          <button
            data-testid="new-campaign"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: SALES_OS.cyan, color: "#04121a" }}
          >
            <Rocket size={14} /> New Campaign
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Active Campaigns" value="3" delta="1 scheduled" />
        <StatTile label="Contacts Engaged" value="1,580" delta="+340 this week" accent={SALES_OS.violet} />
        <StatTile label="Avg Open Rate" value="46%" delta="above target" accent="#34d399" />
        <StatTile label="Replies" value="37" delta="ATOM-handled" />
      </div>

      <GlassCard className="p-5 mb-6">
        <p className="text-xs font-mono uppercase tracking-[0.2em] mb-4" style={{ color: SALES_OS.cyan }}>
          Standard Outbound Sequence
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {SEQUENCE.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.day} className="flex items-center gap-2 shrink-0">
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: `${step.color}14`, border: `1px solid ${step.color}44` }}
                >
                  <Icon size={16} style={{ color: step.color }} />
                  <div>
                    <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.5)" }}>
                      {step.day}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>
                      {step.channel}
                    </p>
                  </div>
                </div>
                {i < SEQUENCE.length - 1 && (
                  <div className="w-6 h-px shrink-0" style={{ background: "rgba(0,212,255,0.3)" }} />
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <p className="text-xs font-mono uppercase tracking-[0.2em] mb-3" style={{ color: SALES_OS.cyan }}>
        Live Campaigns
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {CAMPAIGNS.map((c) => (
          <CampaignCard key={c.name} c={c} />
        ))}
      </div>
    </PageShell>
  );
}
