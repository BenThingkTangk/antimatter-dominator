import { Activity, Phone, MessageSquare, Mail, Linkedin } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";
import { useAgentActivity, Channel, Sentiment } from "@/hooks/useAgentActivity";

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Phone; color: string }> = {
  CALLING: { label: "Calling", icon: Phone, color: "#00d4ff" },
  TEXTING: { label: "Texting", icon: MessageSquare, color: "#7c3aed" },
  EMAILING: { label: "Emailing", icon: Mail, color: "#f5c842" },
  LINKEDIN: { label: "LinkedIn", icon: Linkedin, color: "#38bdf8" },
};

const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "#34d399",
  neutral: "#f5c842",
  negative: "#fb7185",
};

export default function AgentActivity() {
  const events = useAgentActivity(3000);

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="System"
        title="Agent Activity"
        subtitle="Everything ATOM is doing right now, across every channel."
        icon={<Activity size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Live Calls" value="7" delta="ATOM-led" />
        <StatTile label="Sequences Active" value="23" delta="multichannel" accent={SALES_OS.violet} />
        <StatTile label="Emails Today" value="982" delta="46% open" accent="#f5c842" />
        <StatTile label="LinkedIn Pending" value="11" delta="warming" accent="#38bdf8" />
      </div>

      <GlassCard glow className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
          </span>
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: SALES_OS.cyan }}>
            Live Action Feed
          </p>
        </div>
        <div className="space-y-2">
          {events.map((ev) => {
            const meta = CHANNEL_META[ev.channel];
            const Icon = meta.icon;
            const sColor = SENTIMENT_COLOR[ev.sentiment];
            return (
              <div
                key={ev.id}
                className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${meta.color}1f`, color: meta.color }}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: meta.color }}>
                      ATOM {meta.label}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: sColor, boxShadow: `0 0 6px ${sColor}` }} />
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: "#f6f8ff" }}>
                    {ev.primary} <span className="font-normal" style={{ color: "rgba(246,248,255,0.5)" }}>· {ev.detail}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-mono" style={{ color: SALES_OS.cyan }}>intent {ev.intent}</p>
                  <p className="text-[10px]" style={{ color: "rgba(246,248,255,0.55)" }}>{ev.nextAction}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </PageShell>
  );
}
