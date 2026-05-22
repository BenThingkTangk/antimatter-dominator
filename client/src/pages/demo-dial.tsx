/**
 * /demo-dial — Cinematic activation moment.
 * NO real Twilio / Hume / OpenAI calls fire. Pure animated state for the activation moment.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DtomLogo } from "@nirmata/atom-design-system/react";
import { Button } from "@/components/ui/button";
import {
  PhoneCall, ArrowRight, RotateCcw, Building2, User, Briefcase,
  Activity, Brain, Gauge, Zap, Mic, Radio,
} from "lucide-react";

// ─── Pre-scripted demo transcript ────────────────────────────────────────────
interface Beat {
  t: number;
  speaker: "atom" | "lead";
  text: string;
}

const DEMO_BEATS: Beat[] = [
  { t: 0, speaker: "atom", text: "Hey Jordan, this is Chris. Got a sec?" },
  { t: 3.5, speaker: "lead", text: "Uh… I'm a little busy, what's this about?" },
  { t: 6.2, speaker: "atom", text: "Yeah, takes 30 seconds. I noticed Acme just raised a B — congrats." },
  { t: 11.0, speaker: "lead", text: "Thanks. What can I help you with?" },
  { t: 12.5, speaker: "atom", text: "We help VPs of Sales like you 10x outbound without hiring more SDRs. Worth a 15-minute look?" },
  { t: 18.0, speaker: "lead", text: "We're already doing okay on outbound, honestly." },
  { t: 21.5, speaker: "atom", text: "Totally hear that. Out of curiosity — what's your meeting-booked rate per SDR per week right now?" },
  { t: 26.0, speaker: "lead", text: "Probably four or five." },
  { t: 28.0, speaker: "atom", text: "ΔTOM averages 23. Want me to send you the case study and put 15 minutes on Jordan's calendar Thursday?" },
  { t: 33.5, speaker: "lead", text: "…Yeah, send it over. Thursday 2pm works." },
  { t: 37.0, speaker: "atom", text: "Booked. You'll get the invite in 30 seconds. Thanks Jordan." },
];

const TOTAL_DURATION = 42; // seconds

// ─── Metric interpolation helpers ────────────────────────────────────────────
function lerpKeyframes(t: number, keyframes: [number, number][]): number {
  if (t <= keyframes[0][0]) return keyframes[0][1];
  if (t >= keyframes[keyframes.length - 1][0]) return keyframes[keyframes.length - 1][1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const [t0, v0] = keyframes[i];
    const [t1, v1] = keyframes[i + 1];
    if (t >= t0 && t <= t1) {
      const pct = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * pct;
    }
  }
  return keyframes[keyframes.length - 1][1];
}

const TRUTH_SCORE_KF: [number, number][] = [[0, 0.30], [11, 0.45], [21, 0.58], [33, 0.71], [42, 0.86]];
const SENTIMENT_KF: [number, number][] = [[0, -0.10], [11, 0.05], [21, 0.25], [33, 0.50], [42, 0.60]];

function intentLevel(t: number): string {
  if (t < 21) return "LOW";
  if (t < 33) return "MEDIUM";
  return "HIGH";
}

function intentColor(level: string): string {
  if (level === "HIGH") return "#1dd1a1";
  if (level === "MEDIUM") return "#fbbf24";
  return "var(--color-error)";
}

// ─── Latency waterfall (static visual) ───────────────────────────────────────
const LATENCY_STEPS = [
  { label: "mic→edge", ms: 8, color: "#696aac" },
  { label: "ASR", ms: 40, color: "#8587e3" },
  { label: "LLM", ms: 90, color: "var(--color-primary)" },
  { label: "TTS", ms: 50, color: "#8587e3" },
  { label: "edge→carrier", ms: 12, color: "#696aac" },
];
const TOTAL_LATENCY = LATENCY_STEPS.reduce((a, s) => a + s.ms, 0);

// ─── Component ───────────────────────────────────────────────────────────────
export default function DemoDial() {
  const [, navigate] = useLocation();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visibleBeats, setVisibleBeats] = useState<number>(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    setPlaying(true);
    setDone(false);
    setElapsed(0);
    setVisibleBeats(0);
    startRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000;
      setElapsed(t);

      // Reveal beats
      let count = 0;
      for (const beat of DEMO_BEATS) {
        if (t >= beat.t) count++;
      }
      setVisibleBeats(count);

      if (t >= TOTAL_DURATION) {
        clearInterval(timerRef.current!);
        setPlaying(false);
        setDone(true);
      }
    }, 50);
  }, []);

  const replay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    start();
  }, [start]);

  useEffect(() => {
    // Auto-start after a brief cinematic pause
    const t = setTimeout(start, 800);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [start]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleBeats]);

  const truthScore = lerpKeyframes(elapsed, TRUTH_SCORE_KF);
  const sentiment = lerpKeyframes(elapsed, SENTIMENT_KF);
  const intent = intentLevel(elapsed);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "radial-gradient(120% 80% at 50% 15%, #14141c 0%, #08080c 60%, #020202 100%)",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <DtomLogo size="sm" showIcon={false} showWordmark={true} ariaLabel="ΔTOM" />
        <span
          className="text-[11px] font-mono tracking-widest uppercase"
          style={{ color: "var(--color-primary)", opacity: 0.7 }}
        >
          Demo Mode
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-8 max-w-4xl mx-auto w-full gap-6">
        {/* Prospect Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full rounded-2xl p-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in oklab, var(--color-primary) 15%, transparent)" }}
            >
              <User size={22} className="text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#f6f6fd]">Jordan Mitchell</h2>
              <div className="flex items-center gap-3 text-[13px] text-white/40 flex-wrap">
                <span className="flex items-center gap-1"><Briefcase size={12} /> VP of Sales</span>
                <span className="flex items-center gap-1"><Building2 size={12} /> Acme Corp</span>
                <span className="flex items-center gap-1"><Zap size={12} /> Series B SaaS</span>
              </div>
            </div>
            {playing && (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1dd1a1] animate-pulse" />
                <span className="text-[11px] font-mono text-[#1dd1a1]">LIVE</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Transcript Panel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="w-full rounded-2xl overflow-hidden flex-1 min-h-[280px] max-h-[380px] flex flex-col"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <Mic size={14} className="text-[var(--color-primary)] opacity-70" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-white/30">Live Transcript</span>
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {DEMO_BEATS.slice(0, visibleBeats).map((beat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex gap-3"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold"
                    style={{
                      background: beat.speaker === "atom"
                        ? "color-mix(in oklab, var(--color-primary) 20%, transparent)"
                        : "rgba(255,255,255,0.06)",
                      color: beat.speaker === "atom" ? "var(--color-primary)" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {beat.speaker === "atom" ? "AI" : "JM"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-white/25 mb-0.5">
                      {beat.speaker === "atom" ? "ΔTOM Agent" : "Jordan Mitchell"} · {beat.t.toFixed(1)}s
                    </div>
                    <p className="text-[14px] leading-relaxed" style={{ color: beat.speaker === "atom" ? "#e8e8ea" : "rgba(255,255,255,0.6)" }}>
                      {beat.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {visibleBeats === 0 && playing && (
              <div className="flex items-center gap-2 justify-center py-8">
                <Radio size={16} className="text-[var(--color-primary)] animate-pulse" />
                <span className="text-sm text-white/30">Connecting call...</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Metrics Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {/* Truth Score */}
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Gauge size={14} className="text-[var(--color-primary)] opacity-70" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">Truth Score</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: truthScore >= 0.7 ? "#1dd1a1" : truthScore >= 0.4 ? "#fbbf24" : "var(--color-error)" }}>
                {(truthScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden" role="progressbar" aria-valuenow={Math.round(truthScore * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Truth score">
              <motion.div
                className="h-full rounded-full"
                style={{ background: truthScore >= 0.7 ? "#1dd1a1" : truthScore >= 0.4 ? "#fbbf24" : "var(--color-error)" }}
                animate={{ width: `${truthScore * 100}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Buyer Intent */}
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-[var(--color-primary)] opacity-70" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">Buyer Intent</span>
            </div>
            <span
              className="text-2xl font-bold"
              style={{ color: intentColor(intent) }}
            >
              {intent}
            </span>
          </div>

          {/* Sentiment */}
          <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-[var(--color-primary)] opacity-70" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">Sentiment</span>
            </div>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: sentiment >= 0.3 ? "#1dd1a1" : sentiment >= 0 ? "#fbbf24" : "var(--color-error)" }}
            >
              {sentiment >= 0 ? "+" : ""}{sentiment.toFixed(2)}
            </span>
          </div>
        </motion.div>

        {/* Latency Waterfall */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="w-full rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-[var(--color-primary)] opacity-70" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">Latency Waterfall</span>
            </div>
            <span className="text-[11px] font-mono font-bold" style={{ color: "var(--color-primary)" }}>{TOTAL_LATENCY}ms total</span>
          </div>
          <div className="flex items-center gap-1">
            {LATENCY_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center" style={{ flex: step.ms }}>
                <div
                  className="w-full h-3 rounded-sm relative overflow-hidden"
                  style={{ background: step.color, opacity: 0.7 }}
                >
                  {playing && (
                    <div
                      className="absolute inset-0 rounded-sm animate-pulse"
                      style={{ background: step.color }}
                    />
                  )}
                </div>
                <span className="text-[9px] font-mono text-white/25 mt-1 whitespace-nowrap">{step.label}</span>
                <span className="text-[9px] font-mono text-white/15">{step.ms}ms</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Completion Banner */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full rounded-2xl p-6 text-center"
              style={{
                background: "linear-gradient(135deg, rgba(29,209,161,0.08) 0%, rgba(105,106,172,0.08) 100%)",
                border: "1px solid rgba(29,209,161,0.2)",
                boxShadow: "0 0 40px rgba(29,209,161,0.06)",
              }}
            >
              <p className="text-lg font-bold text-[#f6f6fd] mb-2">
                Demo complete — ΔTOM qualified Jordan as a warm lead and booked a Thursday demo
              </p>
              <p className="text-[13px] text-white/40 mb-6">
                200ms response time. Zero SDRs needed. This is what your outbound could look like.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button
                  onClick={() => navigate("/atom-leadgen")}
                  className="px-6 rounded-full"
                  style={{
                    background: "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))",
                    color: "var(--color-text-inverse)",
                    boxShadow: "0 0 18px var(--color-primary-glow)",
                  }}
                >
                  <PhoneCall size={16} className="mr-2" /> Dial a real prospect <ArrowRight size={14} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={replay}
                  className="px-6 rounded-full border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                >
                  <RotateCcw size={14} className="mr-2" /> Replay demo
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
