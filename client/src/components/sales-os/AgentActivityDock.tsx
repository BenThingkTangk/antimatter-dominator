// AgentActivityDock — persistent bottom dock showing a horizontal scrolling
// ticker of live ATOM actions across every channel. Mounted on all
// authenticated app pages. Seeded by useAgentActivity (mock, 3s cycle).
import { Phone, MessageSquare, Mail, Linkedin, ArrowRight, Sparkles } from "lucide-react";
import { useAgentActivity, AgentEvent, Channel, Sentiment } from "@/hooks/useAgentActivity";
import { useSalesOsDemo } from "@/lib/sales-os-demo";

const CHANNEL_META: Record<
  Channel,
  { label: string; icon: typeof Phone; color: string }
> = {
  CALLING: { label: "ATOM CALLING", icon: Phone, color: "#00d4ff" },
  TEXTING: { label: "ATOM TEXTING", icon: MessageSquare, color: "#7c3aed" },
  EMAILING: { label: "ATOM EMAILING", icon: Mail, color: "#f5c842" },
  LINKEDIN: { label: "ATOM LINKEDIN", icon: Linkedin, color: "#38bdf8" },
};

const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: "#34d399",
  neutral: "#f5c842",
  negative: "#fb7185",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Objecting",
};

function EventChip({ ev }: { ev: AgentEvent }) {
  const meta = CHANNEL_META[ev.channel];
  const Icon = meta.icon;
  const sColor = SENTIMENT_COLOR[ev.sentiment];
  return (
    <div
      className="flex items-center gap-3 shrink-0 px-4 py-2 mr-3 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(0,212,255,0.16)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${meta.color}1f`, color: meta.color }}
      >
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-mono uppercase tracking-[0.18em]"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: sColor, boxShadow: `0 0 6px ${sColor}` }}
            title={SENTIMENT_LABEL[ev.sentiment]}
          />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs font-semibold" style={{ color: "#f6f8ff" }}>
            {ev.primary}
          </span>
          <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.5)" }}>
            {ev.detail}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 whitespace-nowrap">
          <span className="text-[10px] font-mono" style={{ color: sColor }}>
            intent {ev.intent}
          </span>
          <ArrowRight size={9} style={{ color: "rgba(246,248,255,0.3)" }} />
          <span className="text-[10px]" style={{ color: "rgba(246,248,255,0.6)" }}>
            {ev.nextAction}
          </span>
        </div>
      </div>
    </div>
  );
}

function DemoBeatChip() {
  const { demoStepData, demoStep } = useSalesOsDemo();
  if (!demoStepData) return null;
  return (
    <div
      data-testid="dock-demo-beat"
      className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-r"
      style={{
        borderColor: "rgba(124,58,237,0.3)",
        background: "rgba(124,58,237,0.1)",
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}
      >
        <Sparkles size={14} />
      </div>
      <div className="min-w-0">
        <span
          className="text-[9px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "#c4b5fd" }}
        >
          Investor Demo · Step {demoStep + 1}
        </span>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-xs font-semibold" style={{ color: "#f6f8ff" }}>
            {demoStepData.title}
          </span>
          <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.6)" }}>
            {demoStepData.metric}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AgentActivityDock() {
  const events = useAgentActivity(3000);
  const { demoActive } = useSalesOsDemo();
  // Duplicate the batch so the marquee loop is seamless.
  const loop = [...events, ...events, ...events];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      data-testid="agent-activity-dock"
    >
      <div
        className="pointer-events-auto"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,13,20,0) 0%, rgba(10,13,20,0.92) 28%, #0a0d14 100%)",
          borderTop: `1px solid ${demoActive ? "rgba(124,58,237,0.4)" : "rgba(0,212,255,0.18)"}`,
          backdropFilter: "blur(12px)",
          transition: "border-color .4s",
        }}
      >
        <div className="flex items-center">
          <div
            className="shrink-0 px-4 py-3 flex items-center gap-2 border-r"
            style={{ borderColor: "rgba(0,212,255,0.16)" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-[0.22em]"
              style={{ color: "#00d4ff" }}
            >
              ATOM Live
            </span>
          </div>
          <DemoBeatChip />
          <div className="relative flex-1 overflow-hidden py-2">
            <div className="flex animate-[salesos-marquee_28s_linear_infinite] hover:[animation-play-state:paused]">
              {loop.map((ev, i) => (
                <EventChip key={`${ev.id}-${i}`} ev={ev} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes salesos-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>
    </div>
  );
}

export default AgentActivityDock;
