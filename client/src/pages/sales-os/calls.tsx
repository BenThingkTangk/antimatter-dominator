import { useState } from "react";
import { PhoneCall, Play, Pause } from "lucide-react";
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

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 48 });
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

export default function Calls() {
  const [playing, setPlaying] = useState<string | null>(PROSPECTS[0].id);
  const live = PROSPECTS.slice(0, 6);

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

      <div className="space-y-3">
        {live.map((p) => {
          const isPlaying = playing === p.id;
          const tag = EMOTION_TAGS[(p.intentScore + p.companySize) % EMOTION_TAGS.length];
          return (
            <GlassCard key={p.id} className="p-4">
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
