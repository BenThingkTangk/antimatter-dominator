import { useState } from "react";
import { PhoneCall, Play, Pause, ShieldCheck, ArrowUpRight, Bot, User } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";
import { PROSPECTS } from "@/data/warroom-seed";

const EMOTION_TAGS = ["Excited", "Hesitant", "Interested", "Objecting"] as const;
const EMOTION_COLOR: Record<string, string> = {
  Excited: "#34d399",
  Hesitant: "#f5c842",
  Interested: "#00d4ff",
  Objecting: "#fb7185",
};

// Seeded transcript with speaker turns + emotion per turn. Deterministic so the
// replay reads identically every render — investor-safe.
interface Turn {
  who: "ATOM" | "PROSPECT";
  text: string;
  emotion: keyof typeof EMOTION_COLOR;
  /** position on the 0..100 call timeline */
  at: number;
}

const TRANSCRIPT: Turn[] = [
  { who: "ATOM", text: "Hi Dana — calling about your RevOps ramp. Got 30 seconds?", emotion: "Interested", at: 4 },
  { who: "PROSPECT", text: "We already use a dialer, so I'm not sure this is a fit.", emotion: "Objecting", at: 22 },
  { who: "ATOM", text: "Totally fair. Most teams keep theirs — ATOM sits on top and books the meetings it can't.", emotion: "Interested", at: 38 },
  { who: "PROSPECT", text: "Okay… how fast did Meridian see results?", emotion: "Hesitant", at: 56 },
  { who: "ATOM", text: "14 days to 3.1× more first meetings. Sending the one-pager now.", emotion: "Excited", at: 72 },
  { who: "PROSPECT", text: "Send it over — let's grab 20 minutes Thursday.", emotion: "Excited", at: 92 },
];

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 56 });
  return (
    <div className="flex items-center gap-[3px] h-12">
      {bars.map((_, i) => {
        const h = 20 + Math.abs(Math.sin(i * 0.6)) * 70 + (i % 5) * 4;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: `${Math.min(h, 100)}%`,
              background: active
                ? "linear-gradient(180deg, #00d4ff, #7c3aed)"
                : "rgba(255,255,255,0.14)",
              opacity: active ? 0.5 + Math.abs(Math.sin(i)) * 0.5 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}

// Emotion arc across the call — recovers after the objection dip.
function EmotionTimeline() {
  return (
    <div className="relative h-16 mt-1">
      <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="emo-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00d4ff" />
            <stop offset="40%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path
          d="M 0 16 C 12 12, 18 30, 24 30 C 34 30, 40 18, 56 20 C 70 22, 80 8, 100 5"
          fill="none"
          stroke="url(#emo-line)"
          strokeWidth="1.6"
          style={{ filter: "drop-shadow(0 0 4px rgba(0,212,255,0.4))" }}
        />
      </svg>
      {/* objection marker */}
      <div className="absolute" style={{ left: "22%", top: 0, bottom: 0 }}>
        <div className="h-full w-px" style={{ background: "rgba(251,113,133,0.5)" }} />
        <span
          className="absolute -translate-x-1/2 top-0 text-[8px] font-mono uppercase px-1 rounded"
          style={{ background: "rgba(251,113,133,0.18)", color: "#fb7185" }}
        >
          objection
        </span>
      </div>
      <div className="absolute" style={{ left: "72%", top: 0, bottom: 0 }}>
        <div className="h-full w-px" style={{ background: "rgba(52,211,153,0.5)" }} />
        <span
          className="absolute -translate-x-1/2 top-0 text-[8px] font-mono uppercase px-1 rounded"
          style={{ background: "rgba(52,211,153,0.18)", color: "#34d399" }}
        >
          resolved
        </span>
      </div>
    </div>
  );
}

function CallReplay({ contact, company }: { contact: string; company: string }) {
  return (
    <GlassCard glow className="p-5 mb-5" data-testid="call-replay">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: SALES_OS.cyan }}>
            Call Intelligence Replay
          </p>
          <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>
            {contact} · {company}
          </h3>
        </div>
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
          style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}
        >
          <ShieldCheck size={12} /> TCPA cleared
        </span>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "rgba(246,248,255,0.45)" }}>
        Emotion arc
      </p>
      <EmotionTimeline />

      <div className="mt-4 space-y-2.5">
        {TRANSCRIPT.map((t, i) => {
          const isAtom = t.who === "ATOM";
          return (
            <div key={i} className={`flex gap-3 ${isAtom ? "" : "flex-row-reverse"}`}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: isAtom ? "rgba(0,212,255,0.16)" : "rgba(124,58,237,0.16)",
                  color: isAtom ? SALES_OS.cyan : "#c4b5fd",
                }}
              >
                {isAtom ? <Bot size={14} /> : <User size={14} />}
              </div>
              <div
                className="max-w-[78%] rounded-xl px-3 py-2"
                style={{
                  background: isAtom ? "rgba(0,212,255,0.06)" : "rgba(124,58,237,0.06)",
                  border: `1px solid ${isAtom ? "rgba(0,212,255,0.18)" : "rgba(124,58,237,0.18)"}`,
                }}
              >
                <div className={`flex items-center gap-2 mb-0.5 ${isAtom ? "" : "justify-end"}`}>
                  <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "rgba(246,248,255,0.45)" }}>
                    {isAtom ? "ATOM" : "Prospect"}
                  </span>
                  <span
                    className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{ background: `${EMOTION_COLOR[t.emotion]}22`, color: EMOTION_COLOR[t.emotion] }}
                  >
                    {t.emotion}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "#f6f8ff" }}>{t.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-4 p-3 rounded-xl flex items-center gap-2"
        style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.28)" }}
      >
        <ArrowUpRight size={14} style={{ color: SALES_OS.cyan }} />
        <div>
          <span className="text-[9px] font-mono uppercase tracking-wider block" style={{ color: SALES_OS.cyan }}>
            Recommended follow-up
          </span>
          <span className="text-xs font-semibold" style={{ color: "#f6f8ff" }}>
            Send Meridian ROI case study + Thursday 10:00 calendar hold
          </span>
        </div>
      </div>
    </GlassCard>
  );
}

export default function Calls() {
  const [playing, setPlaying] = useState<string | null>(PROSPECTS[0].id);
  const live = PROSPECTS.slice(0, 6);
  const active = live.find((p) => p.id === playing) || null;

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 02"
        title="Calls"
        subtitle="Live and recorded ATOM voice calls with Hume emotion analysis."
        icon={<PhoneCall size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Calls Today" value="142" delta="+24 vs yesterday" />
        <StatTile label="Connect Rate" value="38%" delta="above benchmark" accent="#34d399" />
        <StatTile label="Avg Duration" value="4:12" delta="ATOM-led" accent={SALES_OS.violet} />
        <StatTile label="Meetings Set" value="19" delta="from calls" />
      </div>

      {active && <CallReplay contact={active.contact} company={active.company} />}

      <div className="space-y-3">
        {live.map((p) => {
          const isPlaying = playing === p.id;
          const tag = EMOTION_TAGS[(p.intentScore + p.companySize) % EMOTION_TAGS.length];
          return (
            <GlassCard
              key={p.id}
              className="p-4 transition-all"
              style={isPlaying ? { border: "1px solid rgba(0,212,255,0.4)" } : undefined}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setPlaying(isPlaying ? null : p.id)}
                  data-testid={`call-play-${p.id}`}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: isPlaying ? SALES_OS.cyan : "rgba(0,212,255,0.12)",
                    color: isPlaying ? "#04121a" : SALES_OS.cyan,
                    border: "1px solid rgba(0,212,255,0.3)",
                  }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <div className="w-40 shrink-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#f6f8ff" }}>
                    {p.contact}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "rgba(246,248,255,0.5)" }}>
                    {p.company}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <Waveform active={isPlaying} />
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{ background: `${EMOTION_COLOR[tag]}22`, color: EMOTION_COLOR[tag] }}
                  >
                    {tag}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "rgba(246,248,255,0.45)" }}>
                    {Math.floor(p.intentScore / 12)}:{String(p.companySize % 60).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </PageShell>
  );
}
