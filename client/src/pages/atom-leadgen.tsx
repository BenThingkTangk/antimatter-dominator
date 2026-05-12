import { useState, useEffect, useRef, useCallback } from "react";
import { useProductIntel } from "@/hooks/use-product-intel";
import { useToast } from "@/hooks/use-toast";
import { PhoneCall, PhoneOff, Loader2, Clock, ChevronDown, ChevronUp, Search, Crosshair, Play, Pause, Download, Mic } from "lucide-react";
import { AtomCta } from "@/components/ui/atom-form";
import { flagAsHVT, findDealByCompany } from "@/lib/warroom-store";
import { useLocation } from "wouter";

// ─── HVT Flag Button (reusable) ───────────────────────────────────
function HVTFlagButton({ companyName, contactName, phone }: { companyName: string; contactName: string; phone: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [flagged, setFlagged] = useState(() => Boolean(companyName && findDealByCompany(companyName)?.isHVT));

  useEffect(() => {
    setFlagged(Boolean(companyName && findDealByCompany(companyName)?.isHVT));
  }, [companyName]);

  const handleFlag = () => {
    if (!companyName.trim()) {
      toast({ title: "Company name required", description: "Enter a company name before flagging as HVT.", variant: "destructive" });
      return;
    }
    const stakeholders = contactName.trim() ? [{
      name: contactName,
      phone: phone,
      role: "unknown" as const,
      engagement: 40,
    }] : [];
    flagAsHVT(companyName, { source: "leadgen", stakeholders: stakeholders as any });
    setFlagged(true);
    toast({ title: "🎯 HVT Flagged", description: `${companyName} deployed to ΔTOM War Room — Von Clausewitz Engine activated.` });
  };

  if (flagged) {
    return (
      <button
        onClick={() => setLocation("/war-room")}
        className="h-[46px] px-4 rounded-xl border flex items-center gap-1.5 text-[12px] font-bold font-mono transition-all"
        style={{ background: "color-mix(in oklab, var(--color-error) 12%, transparent)", borderColor: "color-mix(in oklab, var(--color-error) 12%, transparent)", color: "var(--color-error)", boxShadow: "0 0 8px color-mix(in oklab, var(--color-error) 12%, transparent)" }}
      >
        🎯 HVT → War Room
      </button>
    );
  }

  return (
    <button
      onClick={handleFlag}
      className="h-[46px] px-4 rounded-xl border border-white/[0.08] flex items-center gap-1.5 text-[12px] text-white/50 hover:text-[var(--color-error)] hover:border-rose-500/30 bg-white/[0.02] hover:bg-rose-500/10 transition-all"
      title="Flag as HVT — Send to ΔTOM War Room"
    >
      <Crosshair className="w-3.5 h-3.5" />Flag HVT
    </button>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Direct Hume EVI — calls go through Vercel API, no bridge
const BRIDGE_URL = "https://45-79-202-76.sslip.io"; // kept for WebSocket events only
const ARC_LENGTH = Math.PI * 80; // radius=80, semicircle

// ─── Phone number formatter ───────────────────────────────────────────────────
// Ensures US numbers have +1 prefix. Passes through numbers that already have
// a country code (start with +). Strips spaces, dashes, parens.
function formatPhoneNumber(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  // Already has a + prefix — pass through as-is
  if (stripped.startsWith("+")) return stripped;
  // 10-digit US number — prepend +1
  if (/^\d{10}$/.test(stripped)) return `+1${stripped}`;
  // 11-digit number starting with 1 (e.g. 14155552671)
  if (/^1\d{10}$/.test(stripped)) return `+${stripped}`;
  // Return with + prefix as best-effort for other formats
  return `+${stripped}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Emotions {
  confidence: number;
  interest: number;
  skepticism: number;
  excitement: number;
  frustration: number;
  neutrality: number;
}

interface CallMetrics {
  sentiment: number;
  buyerIntent: number;
  stage: string;
  emotions: Emotions;
  buyingSignals: string[];
}

interface TranscriptEntry {
  speaker: "ATOM" | "PROSPECT";
  text: string;
  ts: number;
}

interface CallSummary {
  duration: number;
  finalSentiment: number;
  finalIntent: number;
  stage: string;
}

interface SentimentPoint {
  ts: number;
  value: number;
}

interface CallHistoryEntry {
  id: string;
  callSid: string;
  contactName: string;
  companyName: string;
  product: string;
  phoneNumber: string;
  timestamp: number;     // end-of-call wallclock ms (Date.now())
  callStartMs?: number;  // dial-time wallclock ms (Date.now() when call placed)
  duration: number;
  finalSentiment: number;
  finalIntent: number;
  finalStage: string;
  transcript: TranscriptEntry[];
  sentimentHistory: SentimentPoint[];
  emotions: Record<string, number>;
  buyingSignals: string[];
  recordEnabled?: boolean;
  recordingUrl?: string | null;
  warroom?: any | null;
}

/**
 * Push a call entry into history, deduplicating by callSid. If a call with
 * the same callSid is already there, we MERGE the new fields onto the old
 * row instead of pushing a duplicate. Called from 3 different code paths
 * (poll loop, websocket close, manual hangup) — any of which can fire for
 * the same call.
 */
function upsertHistoryEntry(prev: CallHistoryEntry[], entry: CallHistoryEntry): CallHistoryEntry[] {
  const i = prev.findIndex(c => c.callSid === entry.callSid);
  if (i === -1) return [entry, ...prev];
  const merged: CallHistoryEntry = {
    ...prev[i],
    ...entry,
    // Keep the longest transcript / sentiment history we've seen for this call
    transcript:       (entry.transcript?.length || 0)       >= (prev[i].transcript?.length || 0)       ? entry.transcript       : prev[i].transcript,
    sentimentHistory: (entry.sentimentHistory?.length || 0) >= (prev[i].sentimentHistory?.length || 0) ? entry.sentimentHistory : prev[i].sentimentHistory,
    // Keep the earlier callStartMs / later timestamp
    callStartMs: Math.min(prev[i].callStartMs ?? entry.callStartMs ?? entry.timestamp, entry.callStartMs ?? entry.timestamp),
    timestamp:   Math.max(prev[i].timestamp, entry.timestamp),
    duration:    Math.max(prev[i].duration, entry.duration),
  };
  return [merged, ...prev.slice(0, i), ...prev.slice(i + 1)];
}

type CallStatus = "idle" | "dialing" | "active" | "ended";
type ViewMode = "live" | "history";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatDateTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sentimentLabel(v: number) {
  if (v >= 80) return "Very Positive";
  if (v >= 55) return "Positive";
  if (v >= 35) return "Neutral";
  return "Negative";
}

function intentLabel(v: number) {
  if (v >= 85) return "Hot Lead";
  if (v >= 70) return "Purchase Ready";
  if (v >= 50) return "Interested";
  if (v >= 30) return "Curious";
  return "Low";
}

function sentimentColor(v: number) {
  if (v >= 80) return "#a78bfa";
  if (v >= 55) return "#34d399";
  if (v >= 35) return "#fbbf24";
  return "var(--color-error)";
}

function outcomeLabel(intent: number): string {
  if (intent > 75) return "Qualified";
  if (intent >= 40) return "Engaged";
  return "Cold";
}

function outcomeBadgeStyle(intent: number): React.CSSProperties {
  if (intent > 75)
    return { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" };
  if (intent >= 40)
    return { background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" };
  return { background: "color-mix(in oklab, var(--color-error) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-error) 12%, transparent)", color: "var(--color-error)" };
}

function cardBorderColor(intent: number): string {
  if (intent > 60) return "#34d399";
  if (intent >= 30) return "#fbbf24";
  return "var(--color-error)";
}

// Polar coords for arc endpoint
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── SVG Gauge ───────────────────────────────────────────────────────────────

function Gauge({ score, label, type, idSuffix = "" }: { score: number; label: string; type: "sentiment" | "intent"; idSuffix?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const offset = ARC_LENGTH - (ARC_LENGTH * pct) / 100;
  const color = type === "sentiment" ? sentimentColor(score) : score > 75 ? "#a78bfa" : "#696aac";
  const gradId = `gauge-grad-${type}${idSuffix}`;
  const glowId = `glow-${type}${idSuffix}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[220px]" overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-error)" />
            <stop offset="33%" stopColor="#fbbf24" />
            <stop offset="66%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          {score > 75 && type === "intent" && (
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>
        {/* Track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          stroke="var(--color-text-faint)"
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          stroke={type === "sentiment" ? `url(#${gradId})` : color}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          filter={score > 75 && type === "intent" ? `url(#${glowId})` : undefined}
        />
        {/* Score */}
        <text x="100" y="82" textAnchor="middle" fill="white" fontSize="36" fontWeight="300">
          {Math.round(pct)}
        </text>
        {/* Label */}
        <text x="100" y="104" textAnchor="middle" fill="var(--color-text-muted)" fontSize="11">
          {label}
        </text>
      </svg>
    </div>
  );
}

// ─── Emotion Bar ──────────────────────────────────────────────────────────────

const EMOTION_COLORS: Record<string, string> = {
  confidence: "#696aac",
  interest: "#34d399",
  skepticism: "#fbbf24",
  excitement: "#a78bfa",
  frustration: "var(--color-error)",
  neutrality: "#94a3b8",
};

function EmotionBar({ name, value }: { name: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, (value || 0) * 100)));
  const color = EMOTION_COLORS[name] ?? "#696aac";
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs capitalize" style={{ color: "var(--color-text-muted)" }}>
        {name}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div
          className="h-2 rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
      <span className="w-9 text-right text-xs" style={{ color: "var(--color-text-muted)" }}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Stage Timeline ───────────────────────────────────────────────────────────

const STAGES = ["Discovery", "Evaluation", "Negotiation", "Close"];

function StageTimeline({ activeStage }: { activeStage: string }) {
  const activeIdx = STAGES.findIndex(
    (s) => s.toLowerCase() === (activeStage || "").toLowerCase()
  );
  const idx = activeIdx >= 0 ? activeIdx : 0;

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => {
        const isActive = i === idx;
        const isPast = i < idx;
        return (
          <div key={stage} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-500"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #8587e3, #4c4dac)"
                    : isPast
                    ? "rgba(105,106,172,0.4)"
                    : "var(--color-text-faint)",
                  color: isActive || isPast ? "white" : "var(--color-text-muted)",
                  boxShadow: isActive ? "0 0 12px rgba(133,135,227,0.6)" : "none",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-[10px] mt-1 text-center truncate w-full"
                style={{
                  color: isActive
                    ? "#696aac"
                    : isPast
                    ? "var(--color-text-muted)"
                    : "var(--color-text-faint)",
                }}
              >
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="h-px flex-1 mb-4 transition-all duration-500"
                style={{
                  background: i < idx ? "rgba(105,106,172,0.5)" : "var(--color-text-faint)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function SentimentSparkline({ points, idSuffix = "" }: { points: Array<{ ts: number; value: number }>; idSuffix?: string }) {
  if (points.length < 2) {
    return (
      <div
        className="h-full flex items-center justify-center text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        Collecting data…
      </div>
    );
  }

  const W = 280;
  const H = 72;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p.value - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  });

  const linePath = `M ${pts.join(" L ")}`;
  const areaPath = `M ${pts[0]} L ${pts.join(" L ")} L ${W},${H} L 0,${H} Z`;
  const gradId = `sparkGrad${idSuffix}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#696aac" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#696aac" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} stroke="#8587e3" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Transcript Message ───────────────────────────────────────────────────────

function TxMessage({ entry }: { entry: TranscriptEntry }) {
  const isAtom = entry.speaker === "ATOM";
  return (
    <div className={`flex ${isAtom ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className="max-w-[80%] px-4 py-2.5 rounded-xl text-sm"
        style={
          isAtom
            ? {
                background: "rgba(105,106,172,0.1)",
                borderLeft: "2px solid #696aac",
                color: "var(--color-text)",
              }
            : {
                background: "rgba(255,255,255,0.04)",
                color: "var(--color-text)",
              }
        }
      >
        <div
          className="text-[10px] mb-1 font-medium uppercase tracking-wider"
          style={{ color: isAtom ? "#696aac" : "var(--color-text-muted)" }}
        >
          {isAtom ? "ΔTOM" : "Prospect"} · {formatTime(entry.ts)}
        </div>
        <div>{entry.text}</div>
      </div>
    </div>
  );
}

// ─── Pulsing Dot ─────────────────────────────────────────────────────────────

function PulsingDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ background: "#34d399" }}
      />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "#34d399" }} />
    </span>
  );
}

// ─── History Card Detail ──────────────────────────────────────────────────────

// ─── Helpers used by the history detail replay scrubber ────────────────────
function interpolateSentiment(points: SentimentPoint[], targetMs: number): number {
  if (!points || points.length === 0) return 0;
  if (targetMs <= points[0].ts) return points[0].value;
  if (targetMs >= points[points.length - 1].ts) return points[points.length - 1].value;
  for (let i = 1; i < points.length; i++) {
    if (points[i].ts >= targetMs) {
      const a = points[i - 1];
      const b = points[i];
      const range = (b.ts - a.ts) || 1;
      const t = (targetMs - a.ts) / range;
      return a.value + (b.value - a.value) * t;
    }
  }
  return points[points.length - 1].value;
}

function transcriptIndexAt(transcriptItems: TranscriptEntry[], targetMs: number): number {
  if (!transcriptItems || transcriptItems.length === 0) return -1;
  if (targetMs < transcriptItems[0].ts) return -1;
  let idx = 0;
  for (let i = 0; i < transcriptItems.length; i++) {
    if (transcriptItems[i].ts <= targetMs) idx = i;
    else break;
  }
  return idx;
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function HistoryCallDetail({ entry }: { entry: CallHistoryEntry }) {
  const idx = entry.id;

  // ─── Audio playback state ─────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [audioDurSec, setAudioDurSec] = useState(0);

  // Replay-scrub mode: when the user is actively playing the recording, we
  // re-derive the live-analytics panes from where in the call we are. When
  // there's no audio (or paused at start), we show the static end-of-call
  // final values. This is what lets reps "watch the call back" with the
  // sentiment line, transcript cursor, and emotion bars syncing to audio.
  //
  // We anchor on entry.callStartMs (recorded at dial time, same origin as
  // sentimentHistory[i].ts). Older entries without that field fall back to
  // the end-of-call timestamp minus duration.
  const callStartMs = entry.callStartMs ?? (entry.timestamp - (entry.duration * 1000));
  const cursorMs    = callStartMs + (currentSec * 1000);
  const inReplay    = audioReady && (isPlaying || currentSec > 0.25);

  const sortedTranscript = [...(entry.transcript || [])].sort((a, b) => a.ts - b.ts);
  const sortedSentiment  = [...(entry.sentimentHistory || [])].sort((a, b) => a.ts - b.ts);

  const replaySentiment = inReplay
    ? Math.round(interpolateSentiment(sortedSentiment, cursorMs))
    : entry.finalSentiment;

  const transcriptCursorIdx = inReplay
    ? transcriptIndexAt(sortedTranscript, cursorMs)
    : sortedTranscript.length - 1;

  // Try to fetch a recording URL from the backend. The Twilio recording
  // callback may have populated it after the call ended even if the row
  // wasn't saved locally with one.
  const [resolvedRecordingUrl, setResolvedRecordingUrl] = useState<string | null>(entry.recordingUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    if (!entry.callSid || entry.callSid.startsWith("manual-")) return;
    // We always go through our proxy — Twilio recordings need basic-auth.
    // Probing it with HEAD first lets us suppress the error UI if there's no
    // recording on this call.
    const proxied = `/api/atom-leadgen/recording-stream?callSid=${encodeURIComponent(entry.callSid)}`;
    fetch(proxied, { method: "HEAD" })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setResolvedRecordingUrl(proxied);
        else setResolvedRecordingUrl(null);
      })
      .catch(() => { if (!cancelled) setResolvedRecordingUrl(null); });
    return () => { cancelled = true; };
  }, [entry.callSid]);

  const hasAudio = Boolean(resolvedRecordingUrl);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setAudioError("Playback blocked. Try again."));
    else el.pause();
  };

  return (
    <>
    <div className="mt-4 space-y-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 flex flex-col items-center"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 self-start" style={{ color: "var(--color-text-muted)" }}>
            Sentiment
          </div>
          <Gauge score={entry.finalSentiment} label={sentimentLabel(entry.finalSentiment)} type="sentiment" idSuffix={`-hist-${idx}`} />
        </div>
        <div
          className="rounded-xl p-4 flex flex-col items-center"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 self-start" style={{ color: "var(--color-text-muted)" }}>
            Buyer Intent
          </div>
          <Gauge score={entry.finalIntent} label={intentLabel(entry.finalIntent)} type="intent" idSuffix={`-hist-${idx}`} />
        </div>
      </div>

      {/* Emotion Bars */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="text-xs uppercase tracking-wider mb-4" style={{ color: "var(--color-text-muted)" }}>
          Emotion Analysis
        </div>
        <div className="space-y-2.5">
          {Object.entries(entry.emotions).map(([name, val]) => (
            <EmotionBar key={name} name={name} value={val} />
          ))}
        </div>
      </div>

      {/* Stage + Sparkline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-4" style={{ color: "var(--color-text-muted)" }}>
            Call Stage
          </div>
          <StageTimeline activeStage={entry.finalStage} />
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
            Sentiment Timeline
          </div>
          <div className="h-20">
            <SentimentSparkline points={entry.sentimentHistory} idSuffix={`-hist-${idx}`} />
          </div>
        </div>
      </div>

      {/* Von Clausewitz / Aletheia Engine snapshot */}
      {entry.warroom && (
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "var(--color-text-muted)" }}>
            <span>Von Clausewitz Engine · Final Read</span>
            <span
              className="px-1.5 py-[1px] rounded text-[9px]"
              style={{
                background:
                  entry.warroom.dealRisk === "HEALTHY" ? "rgba(34,197,94,0.2)" :
                  entry.warroom.dealRisk === "CAUTION" ? "rgba(250,204,21,0.2)" :
                  entry.warroom.dealRisk === "AT_RISK" ? "rgba(251,146,60,0.2)" :
                  "rgba(239,68,68,0.2)",
                color:
                  entry.warroom.dealRisk === "HEALTHY" ? "#4ade80" :
                  entry.warroom.dealRisk === "CAUTION" ? "#fde047" :
                  entry.warroom.dealRisk === "AT_RISK" ? "var(--color-primary-2)" :
                  "var(--color-error)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {entry.warroom.dealRisk || "—"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Truth</div>
              <div className="text-xl font-light" style={{ color: "var(--color-text)" }}>{entry.warroom.truthScore ?? 0}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Leverage</div>
              <div className="text-xl font-light capitalize" style={{ color: "var(--color-text)" }}>
                {entry.warroom.negotiationPosture?.leveragePosition || "—"}
              </div>
              <div className="text-[9px] opacity-60">power {entry.warroom.negotiationPosture?.powerScore ?? 0}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Ghost risk</div>
              <div className="text-xl font-light" style={{
                color: (entry.warroom.ghostProbability ?? 0) > 50 ? "var(--color-error)" : "var(--color-text)",
              }}>
                {entry.warroom.ghostProbability ?? 0}%
              </div>
            </div>
          </div>
          {entry.warroom.signal && (
            <div className="mt-3 text-[11px] italic" style={{ color: "var(--color-text-muted)" }}>
              “{entry.warroom.signal}”
            </div>
          )}
          {Array.isArray(entry.warroom.flags) && entry.warroom.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {entry.warroom.flags.slice(0, 6).map((f: any, i: number) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: f.severity === "high" ? "var(--color-error)" :
                           f.severity === "medium" ? "var(--color-primary-2)" :
                           "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {f.type}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sentiment peaks & bottoms */}
      {sortedSentiment.length > 1 && (() => {
        const max = sortedSentiment.reduce((a, b) => b.value > a.value ? b : a);
        const min = sortedSentiment.reduce((a, b) => b.value < a.value ? b : a);
        const cs = callStartMs;
        return (
          <div
            className="rounded-xl p-4 grid grid-cols-2 gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Peak sentiment</div>
              <div className="text-2xl font-light" style={{ color: sentimentColor(max.value) }}>+{Math.round(max.value)}</div>
              <div className="text-[10px] opacity-70" style={{ color: "var(--color-text-muted)" }}>
                at {formatMs(max.ts - cs)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Lowest sentiment</div>
              <div className="text-2xl font-light" style={{ color: sentimentColor(min.value) }}>{Math.round(min.value)}</div>
              <div className="text-[10px] opacity-70" style={{ color: "var(--color-text-muted)" }}>
                at {formatMs(min.ts - cs)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Buying Signals */}
      {entry.buyingSignals.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>
            Buying Signals
          </div>
          <div className="flex flex-wrap gap-2">
            {entry.buyingSignals.map((sig, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(105,106,172,0.2)",
                  border: "1px solid rgba(133,135,227,0.3)",
                  color: "#696aac",
                }}
              >
                {sig}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div>
        <div className="text-xs uppercase tracking-wider mb-3 flex items-center justify-between" style={{ color: "var(--color-text-muted)" }}>
          <span>Full Transcript</span>
          {inReplay && transcriptCursorIdx >= 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "color-mix(in oklab, var(--color-primary) 14%, transparent)",
                color: "var(--color-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              Replay · turn {transcriptCursorIdx + 1}/{sortedTranscript.length}
            </span>
          )}
        </div>
        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: "360px", minHeight: "80px" }}
        >
          {sortedTranscript.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: "var(--color-text-faint)" }}>
              No transcript recorded.
            </div>
          ) : (
            sortedTranscript.map((e, i) => (
              <div
                key={i}
                style={{
                  opacity: inReplay ? (i <= transcriptCursorIdx ? 1 : 0.25) : 1,
                  outline: inReplay && i === transcriptCursorIdx
                    ? "1px solid color-mix(in oklab, var(--color-primary) 40%, transparent)"
                    : "none",
                  borderRadius: "8px",
                  transition: "opacity 120ms ease, outline-color 120ms ease",
                }}
              >
                <TxMessage entry={e} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>

    {/* ── Call Recording + Replay Scrubber (only when audio is available) ── */}
    {hasAudio && (
      <div
        className="mt-4 rounded-xl p-4"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid color-mix(in oklab, var(--color-primary) 22%, transparent)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic size={14} style={{ color: "var(--color-primary)" }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Call Recording · Live Analytics Replay
            </span>
          </div>
          <a
            href={resolvedRecordingUrl!}
            download={`atom-call-${entry.callSid}.mp3`}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--color-text-muted)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <Download size={11} />Download
          </a>
        </div>

        {/* Hidden audio element — we drive playback via the custom button */}
        <audio
          ref={audioRef}
          src={resolvedRecordingUrl || undefined}
          preload="metadata"
          onLoadedMetadata={() => {
            const el = audioRef.current;
            if (!el) return;
            setAudioReady(true);
            if (Number.isFinite(el.duration)) setAudioDurSec(el.duration);
            else if (entry.duration > 0) setAudioDurSec(entry.duration);
          }}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (!el) return;
            setCurrentSec(el.currentTime);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={() => setAudioError("Recording is still being processed by Twilio. Refresh in a minute.")}
        />

        {audioError && (
          <div className="text-[11px] mb-2" style={{ color: "var(--color-error)" }}>
            {audioError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center rounded-full transition-all"
            style={{
              width: 40, height: 40,
              background: "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))",
              color: "var(--color-text-inverse)",
              boxShadow: "0 0 14px var(--color-primary-glow)",
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={audioDurSec || entry.duration || 1}
              step={0.05}
              value={Math.min(currentSec, audioDurSec || entry.duration || 1)}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentSec(t);
                const el = audioRef.current;
                if (el) el.currentTime = t;
              }}
              className="w-full"
              style={{ accentColor: "var(--color-primary)" }}
            />
            <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
              <span>{formatMs(currentSec * 1000)}</span>
              <span>
                Sentiment now: <strong style={{ color: sentimentColor(replaySentiment) }}>{replaySentiment}</strong>
              </span>
              <span>{formatMs((audioDurSec || entry.duration) * 1000)}</span>
            </div>
          </div>
        </div>

        {sortedSentiment.length > 0 && (
          <div className="mt-3">
            <SentimentSparkline points={sortedSentiment} idSuffix={`-replay-${idx}`} />
          </div>
        )}
      </div>
    )}

    {!hasAudio && entry.recordEnabled && entry.callSid && !entry.callSid.startsWith("manual-") && (
      <div
        className="mt-4 rounded-xl p-3 text-[11px] flex items-center gap-2"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px dashed rgba(255,255,255,0.12)",
          color: "var(--color-text-muted)",
        }}
      >
        <Mic size={12} /> Recording still being processed by Twilio. Reopen this call in a minute to play it back.
      </div>
    )}
    </>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry, isExpanded, onToggle }: { entry: CallHistoryEntry; isExpanded: boolean; onToggle: () => void }) {
  const borderColor = cardBorderColor(entry.finalIntent);

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${isExpanded ? "var(--color-primary)" : "rgba(255,255,255,0.08)"}`,
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: isExpanded ? "0 0 16px rgba(105,106,172,0.15)" : "none",
      }}
      onClick={onToggle}
    >
      {/* Card header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {entry.companyName || "Unknown Company"}
            </span>
            {entry.contactName && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                · {entry.contactName}
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={outcomeBadgeStyle(entry.finalIntent)}
            >
              {outcomeLabel(entry.finalIntent)}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {entry.phoneNumber}
            </span>
            {entry.product && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                · {entry.product}
              </span>
            )}
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              · {formatDateTime(entry.timestamp)}
            </span>
            {entry.duration > 0 && (
              <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                · {formatDuration(entry.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Scores + chevron */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Sentiment
            </div>
            <div
              className="text-lg font-light"
              style={{ color: sentimentColor(entry.finalSentiment) }}
            >
              {Math.round(entry.finalSentiment)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
              Intent
            </div>
            <div className="text-lg font-light" style={{ color: "#696aac" }}>
              {Math.round(entry.finalIntent)}
            </div>
          </div>
          <div style={{ color: "var(--color-text-muted)" }}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && <HistoryCallDetail entry={entry} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ATOMLeadGen() {
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");

  // Form — pre-fill from cross-module navigation
  const [phone, setPhone] = useState(params.get("phone") || "");
  // Contact name is split into first + last fields per the brand spec.
  // We back-populate from a single ?contact=/?name= param too so old links keep working.
  const _legacyName = params.get("firstName") || params.get("name") || params.get("contact") || "";
  const _legacyParts = _legacyName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(params.get("contactFirstName") || _legacyParts[0] || "");
  const [lastName, setLastName]   = useState(params.get("contactLastName") || _legacyParts.slice(1).join(" ") || "");
  const contactName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const setContactName = (v: string) => {
    const parts = (v || "").trim().split(/\s+/);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" "));
  };
  const [companyName, setCompanyName] = useState(params.get("company") || params.get("companyName") || "");
  const [productSlug, setProductSlug] = useState(params.get("product") || "");
  const [pitchTopic, setPitchTopic] = useState(params.get("topic") || "");
  // "Record this call" toggle — default ON so a normal dial captures audio.
  // Persisted to localStorage so the rep's preference sticks across reloads.
  const [recordCall, setRecordCall] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("atom_dial_record");
      return v == null ? true : v === "1";
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("atom_dial_record", recordCall ? "1" : "0"); } catch {}
  }, [recordCall]);
  // Deal value field removed from the UI — enterprise routing now keys off
  // tenant plan + Apollo firmographics rather than a manual rep input.
  const dealValue = "";
  // Tier badge shown after dial — set from /api/atom-leadgen/call response.
  const [callTier, setCallTier] = useState<"standard" | "enterprise" | null>(null);
  const [reasoningModel, setReasoningModel] = useState<string | null>(null);

  // Call state
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callSid, setCallSid] = useState<string | null>(null);

  // Analytics
  const [metrics, setMetrics] = useState<CallMetrics>({
    sentiment: 0,
    buyerIntent: 0,
    stage: "Discovery",
    emotions: { confidence: 0, interest: 0, skepticism: 0, excitement: 0, frustration: 0, neutrality: 0 },
    buyingSignals: [],
  });
  const [sentimentHistory, setSentimentHistory] = useState<SentimentPoint[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [buyingSignals, setBuyingSignals] = useState<string[]>([]);
  const [warroom, setWarroom] = useState<any | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);

  // View mode + call history
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('atom_leadgen_call_history');
      const raw: CallHistoryEntry[] = saved ? JSON.parse(saved) : [];
      // One-time cleanup: prior versions could push the same callSid up to
      // 3 times (poll loop + websocket close + manual hangup all fired).
      // Collapse any duplicates that snuck into localStorage on load.
      const seen = new Set<string>();
      const deduped: CallHistoryEntry[] = [];
      for (const c of raw) {
        const key = c.callSid || c.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(c);
      }
      return deduped;
    } catch { return []; }
  });
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");

  // Persist call history to localStorage
  useEffect(() => {
    try { localStorage.setItem('atom_leadgen_call_history', JSON.stringify(callHistory)); } catch {}
  }, [callHistory]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);
  const seenMsgIds = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const callSidRef = useRef<string | null>(null);
  // Keep a ref to the latest metrics/transcript etc. so the ws callback can access them
  const metricsRef = useRef(metrics);
  const transcriptRef = useRef(transcript);
  const sentimentHistoryRef = useRef(sentimentHistory);
  const emotionsRef = useRef(metrics.emotions);
  const buyingSignalsRef = useRef(buyingSignals);
  const warroomRef       = useRef(warroom);
  const recordCallRef    = useRef(recordCall);
  // Wallclock millis the dial was placed (Date.now() right before /api/call).
  // Same origin as sentimentHistory[i].ts, so the replay scrubber
  // (audio currentTime) maps cleanly to sentiment timeline indexes.
  const callStartMsRef   = useRef<number>(0);
  const formRef = useRef({ contactName, companyName, product: productSlug, phone });

  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { sentimentHistoryRef.current = sentimentHistory; }, [sentimentHistory]);
  useEffect(() => { emotionsRef.current = metrics.emotions; }, [metrics.emotions]);
  useEffect(() => { buyingSignalsRef.current = buyingSignals; }, [buyingSignals]);
  useEffect(() => { warroomRef.current       = warroom; },       [warroom]);
  useEffect(() => { recordCallRef.current    = recordCall; },    [recordCall]);
  useEffect(() => {
    formRef.current = { contactName, companyName, product: productSlug, phone };
  }, [contactName, companyName, productSlug, phone]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ─── Pickup-delay killer: debounced RAG prewarm ──────────────────────────
  // The moment the user stops typing the product, fire a prewarm so the
  // backend RAG cache is HOT by the time they click Dial. Idempotent.
  // Cuts pickup-to-first-word from ~3s (cold) to ~600ms (warm).
  useEffect(() => {
    const product = productSlug.trim();
    if (!product || product.length < 3) return;
    if (callStatus === "active" || callStatus === "dialing") return;

    const handle = window.setTimeout(() => {
      fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prewarm", company_name: product }),
      }).catch(() => { /* prewarm is best-effort */ });
    }, 700);

    return () => window.clearTimeout(handle);
  }, [productSlug, callStatus]);

  // Cleanup WS + polling on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, []);

  // ─── Live poller — Hume EVI chat-events ─────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sessionId: string) => {
    stopPolling();
    seenMsgIds.current = new Set();
    sessionIdRef.current = sessionId;
    let endedCount = 0; // extra ticks after end to let final events land

    const tick = async () => {
      try {
        const res = await fetch(`/api/atom-leadgen/chat-events?sessionId=${encodeURIComponent(sessionId)}`);
        if (!res.ok) return;
        const data: any = await res.json();
        // status: pending | active | ended
        if (data.chatId == null) return; // Hume chat not started yet; keep polling

        if (data.warroom) setWarroom(data.warroom);
        // Restored: backend returns top-level buyingSignals[] from regex
        // extractor over the user's transcript turns. Merge into the shared
        // buyingSignals state so chips render on the live + history views.
        if (Array.isArray(data.buyingSignals) && data.buyingSignals.length) {
          setBuyingSignals((prev) => {
            const set = new Set(prev);
            for (const sig of data.buyingSignals) set.add(sig);
            return Array.from(set);
          });
        }
        if (data.metrics) {
          setMetrics({
            sentiment: data.metrics.sentiment ?? 0,
            buyerIntent: data.metrics.buyerIntent ?? 0,
            stage: ["Discovery", "Evaluation", "Negotiation", "Close"][(data.metrics.stage || 1) - 1] || "Discovery",
            emotions: {
              // Server returns 0..1 from rollupEmotions(). EmotionBar already
              // multiplies value*100 to get a percent. So pass through as-is
              // — don't double-multiply (that was the 'all bars at 100%' bug).
              confidence:  data.metrics.emotions?.confidence  ?? 0,
              interest:    data.metrics.emotions?.interest    ?? 0,
              skepticism:  data.metrics.emotions?.skepticism  ?? 0,
              excitement:  data.metrics.emotions?.excitement  ?? 0,
              frustration: data.metrics.emotions?.frustration ?? 0,
              neutrality:  data.metrics.emotions?.neutrality  ?? 0,
            },
            buyingSignals: data.buyingSignals || [],
          });
          setSentimentHistory(prev => {
            const last = prev[prev.length - 1];
            if (last && last.value === data.metrics.sentiment) return prev;
            return [...prev.slice(-59), { ts: Date.now(), value: data.metrics.sentiment }];
          });
        }

        // Transcript — append only new messages
        if (Array.isArray(data.transcript)) {
          const newMsgs = data.transcript.filter((m: any) => {
            const key = `${m.timestamp}|${m.role}|${m.text.slice(0, 20)}`;
            if (seenMsgIds.current.has(key)) return false;
            seenMsgIds.current.add(key);
            return true;
          });
          if (newMsgs.length) {
            setTranscript(prev => [
              ...prev,
              ...newMsgs.map((m: any) => ({
                speaker: m.role === "agent" ? "ATOM" : "PROSPECT" as "ATOM" | "PROSPECT",
                text: m.text,
                ts: m.timestamp,
              })),
            ]);
          }
        }

        if (data.status === "ended") {
          endedCount++;
          if (endedCount >= 2) {
            stopPolling();
            setCallStatus("ended");
            const dur = Math.round((Date.now() - (sessionIdRef.current ? Number(sessionIdRef.current.split("_")[1]) : Date.now())) / 1000);
            setSummary({
              duration: dur,
              finalSentiment: metricsRef.current.sentiment,
              finalIntent: metricsRef.current.buyerIntent,
              stage: metricsRef.current.stage,
            });

            const currentSid = callSidRef.current ?? sessionId;
            const form = formRef.current;
            const entry: CallHistoryEntry = {
              id: currentSid,
              callSid: currentSid,
              contactName: form.contactName,
              companyName: form.companyName,
              product: form.product,
              phoneNumber: form.phone,
              timestamp: Date.now(),
              duration: dur,
              finalSentiment: metricsRef.current.sentiment,
              finalIntent: metricsRef.current.buyerIntent,
              finalStage: metricsRef.current.stage,
              transcript: [...transcriptRef.current],
              sentimentHistory: [...sentimentHistoryRef.current],
              emotions: { ...emotionsRef.current },
              buyingSignals: [...buyingSignalsRef.current],
              recordEnabled: recordCallRef.current,
              recordingUrl: null,
              warroom: warroomRef.current,
              callStartMs: callStartMsRef.current || (Date.now() - dur * 1000),
            };
            setCallHistory(prev => upsertHistoryEntry(prev, entry));

            // Persist to Supabase so the call-history detail page can replay
            // it later from any device. Best-effort — the local copy in
            // localStorage above is the source of truth for the current rep.
            fetch("/api/atom-leadgen/save-call", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callSid: currentSid,
                duration: dur,
                finalSentiment: metricsRef.current.sentiment,
                finalIntent: metricsRef.current.buyerIntent,
                finalStage: metricsRef.current.stage,
                transcript: transcriptRef.current,
                sentimentHistory: sentimentHistoryRef.current,
                emotions: emotionsRef.current,
                buyingSignals: buyingSignalsRef.current,
                warroom: warroomRef.current,
                contactName: form.contactName,
                companyName: form.companyName,
                productName: form.product,
              }),
            }).catch(() => { /* best-effort */ });
          }
        }
      } catch (e) {
        console.warn("[poll] error", e);
      }
    };

    // Kick an immediate tick, then 1.8s interval
    tick();
    pollRef.current = window.setInterval(tick, 1800);
  }, [stopPolling]);

  const connectWebSocket = useCallback((sid: string) => {
    const wsUrl = `wss://45-79-202-76.sslip.io/events/${sid}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] connected", wsUrl);
    };

    ws.onmessage = (ev) => {
      let data: any;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (data.type === "call_started") {
        setCallStatus("active");
      } else if (data.type === "call_metrics") {
        const m: CallMetrics = {
          sentiment: data.sentiment ?? 0,
          buyerIntent: data.buyerIntent ?? 0,
          stage: data.stage ?? "Discovery",
          emotions: data.emotions ?? {
            confidence: 0,
            interest: 0,
            skepticism: 0,
            excitement: 0,
            frustration: 0,
            neutrality: 0,
          },
          buyingSignals: data.buyingSignals ?? [],
        };
        setMetrics(m);
        setSentimentHistory((prev) => [
          ...prev.slice(-59),
          { ts: data.ts ?? Date.now(), value: data.sentiment ?? 0 },
        ]);
        if (data.buyingSignals?.length) {
          setBuyingSignals((prev) => {
            const next = [...prev];
            for (const sig of data.buyingSignals) {
              if (!next.includes(sig)) next.push(sig);
            }
            return next;
          });
        }
      } else if (data.type === "transcript") {
        // Bridge sends role: 'agent'|'prospect', map to ATOM|PROSPECT
        const speaker = data.speaker === "ATOM" || data.role === "agent" ? "ATOM" : "PROSPECT";
        const text = data.text || "";
        if (text.trim()) {
          setTranscript((prev) => [
            ...prev,
            { speaker, text, ts: data.ts ?? Date.now() },
          ]);
        }
      } else if (data.type === "call_ended") {
        setCallStatus("ended");
        const dur = data.duration ?? 0;
        setSummary({
          duration: dur,
          finalSentiment: metricsRef.current.sentiment,
          finalIntent: metricsRef.current.buyerIntent,
          stage: metricsRef.current.stage,
        });

        // Push to call history using latest refs
        const currentSid = callSidRef.current ?? sid;
        const form = formRef.current;
        const entry: CallHistoryEntry = {
          id: currentSid,
          callSid: currentSid,
          contactName: form.contactName,
          companyName: form.companyName,
          product: form.product,
          phoneNumber: form.phone,
          timestamp: Date.now(),
          duration: dur,
          finalSentiment: metricsRef.current.sentiment,
          finalIntent: metricsRef.current.buyerIntent,
          finalStage: metricsRef.current.stage,
          transcript: [...transcriptRef.current],
          sentimentHistory: [...sentimentHistoryRef.current],
          emotions: { ...emotionsRef.current },
          buyingSignals: [...buyingSignalsRef.current],
          recordEnabled: recordCallRef.current,
          recordingUrl: null,
          warroom: warroomRef.current,
          callStartMs: callStartMsRef.current || (Date.now() - dur * 1000),
        };
        setCallHistory((prev) => upsertHistoryEntry(prev, entry));

        // Persist to Supabase (best-effort).
        fetch("/api/atom-leadgen/save-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callSid: currentSid,
            duration: dur,
            finalSentiment: metricsRef.current.sentiment,
            finalIntent: metricsRef.current.buyerIntent,
            finalStage: metricsRef.current.stage,
            transcript: transcriptRef.current,
            sentimentHistory: sentimentHistoryRef.current,
            emotions: emotionsRef.current,
            buyingSignals: buyingSignalsRef.current,
            warroom: warroomRef.current,
            contactName: form.contactName,
            companyName: form.companyName,
            productName: form.product,
          }),
        }).catch(() => { /* best-effort */ });

        ws.close();
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] error", e);
    };

    ws.onclose = () => {
      console.log("[WS] closed");
    };
  }, []);

  const handleDial = async () => {
    if (!phone.trim()) {
      toast({ title: "Phone number required", variant: "destructive" });
      return;
    }

    // Format phone number — ensure +1 prefix for US numbers
    const formattedPhone = formatPhoneNumber(phone.trim());
    console.log("[handleDial] Formatted phone:", formattedPhone);
    console.log("[handleDial] Bridge URL:", BRIDGE_URL);

    setCallStatus("dialing");
    // Anchor the wallclock origin for sentiment + transcript timestamps so
    // the replay scrubber lines audio currentTime up with the timeline.
    callStartMsRef.current = Date.now();
    setTranscript([]);
    setBuyingSignals([]);
    setSentimentHistory([]);
    setSummary(null);
    setWarroom(null);
    setMetrics({
      sentiment: 0,
      buyerIntent: 0,
      stage: "Discovery",
      emotions: { confidence: 0, interest: 0, skepticism: 0, excitement: 0, frustration: 0, neutrality: 0 },
      buyingSignals: [],
    });
    // Switch to live view when a new call starts
    setViewMode("live");

    try {
      // Start product intel fetch in background (non-blocking)
      // The bridge will also try to fetch RAG context on its own
      let productIntelData = null;
      const intelPromise = productSlug.trim()
        ? fetch("/api/product-intel/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: productSlug.trim() }),
          }).then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null);

      const callPayload = {
        phoneNumber: formattedPhone,
        firstName: contactName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        product: productSlug.trim() || undefined,
        pitchTopic: pitchTopic.trim() || undefined,
        productIntel: productIntelData || undefined,
        // Toggle — backend wires Twilio Record=true + recording status callback
        record: recordCall,
        // GPT-5.5 router inputs
        dealValue: dealValue ? Number(dealValue.replace(/[^0-9.]/g, "")) : undefined,
        tenantSlug: window.location.hostname.split(".")[0] || undefined,
      };

      console.log("[handleDial] POST /api/atom-leadgen/call", JSON.stringify(callPayload));

      // Start the call immediately — don't wait for intel
      const res = await fetch("/api/atom-leadgen/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callPayload),
      });

      console.log("[handleDial] Response status:", res.status);

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[handleDial] Error response body:", errText);
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json = await res.json();
      console.log("[handleDial] Success response:", json);
      const sid: string = json.callSid;
      setCallSid(sid);
      callSidRef.current = sid;
      // Surface backend's tier routing decision
      setCallTier(json.tier || "standard");
      setReasoningModel(json.reasoningModel || null);
      // Poll Hume by Twilio CallSid — Hume's TwiML integration writes call_sid
      // into chat metadata. The legacy `sessionId` query-param we used to send
      // was never propagated to the chat, so polling never resolved a chat.
      startPolling(sid);
      setCallStatus("active");
    } catch (err: any) {
      console.error("[handleDial] Caught error:", err);
      setCallStatus("idle");
      toast({
        title: "Failed to connect",
        description: err?.message ?? "Call service unreachable. Check your network.",
        variant: "destructive",
      });
    }
  };

  const handleEndCall = () => {
    wsRef.current?.close();
    stopPolling();
    const dur = 0;
    setCallStatus("ended");
    setSummary((prev) =>
      prev ?? {
        duration: dur,
        finalSentiment: metricsRef.current.sentiment,
        finalIntent: metricsRef.current.buyerIntent,
        stage: metricsRef.current.stage,
      }
    );

    // Push to history when manually ended
    const currentSid = callSidRef.current ?? "manual-" + Date.now();
    const form = formRef.current;
    const entry: CallHistoryEntry = {
      id: currentSid,
      callSid: currentSid,
      contactName: form.contactName,
      companyName: form.companyName,
      product: form.product,
      phoneNumber: form.phone,
      timestamp: Date.now(),
      duration: dur,
      finalSentiment: metricsRef.current.sentiment,
      finalIntent: metricsRef.current.buyerIntent,
      finalStage: metricsRef.current.stage,
      transcript: [...transcriptRef.current],
      sentimentHistory: [...sentimentHistoryRef.current],
      emotions: { ...emotionsRef.current },
      buyingSignals: [...buyingSignalsRef.current],
      recordEnabled: recordCallRef.current,
      recordingUrl: null,
      warroom: warroomRef.current,
      callStartMs: callStartMsRef.current || (Date.now() - dur * 1000),
    };
    setCallHistory((prev) => upsertHistoryEntry(prev, entry));

    // Persist to Supabase (best-effort).
    fetch("/api/atom-leadgen/save-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callSid: currentSid,
        duration: dur,
        finalSentiment: metricsRef.current.sentiment,
        finalIntent: metricsRef.current.buyerIntent,
        finalStage: metricsRef.current.stage,
        transcript: transcriptRef.current,
        sentimentHistory: sentimentHistoryRef.current,
        emotions: emotionsRef.current,
        buyingSignals: buyingSignalsRef.current,
        warroom: warroomRef.current,
        contactName: form.contactName,
        companyName: form.companyName,
        productName: form.product,
      }),
    }).catch(() => { /* best-effort */ });
  };

  const handleNewCall = () => {
    wsRef.current?.close();
    stopPolling();
    setCallStatus("idle");
    setCallSid(null);
    setTranscript([]);
    setBuyingSignals([]);
    setSentimentHistory([]);
    setSummary(null);
    setWarroom(null);
    setMetrics({
      sentiment: 0,
      buyerIntent: 0,
      stage: "Discovery",
      emotions: { confidence: 0, interest: 0, skepticism: 0, excitement: 0, frustration: 0, neutrality: 0 },
      buyingSignals: [],
    });
  };

  const showAnalytics = callStatus === "active" || callStatus === "ended";

  // Filter history
  const filteredHistory = callHistory.filter((entry) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      entry.companyName.toLowerCase().includes(q) ||
      entry.contactName.toLowerCase().includes(q) ||
      entry.phoneNumber.toLowerCase().includes(q) ||
      entry.product.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="min-h-screen px-4 py-8 md:px-8"
      style={{ background: "#020202", color: "var(--color-text)", fontFamily: "inherit" }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
              ΔTOM Dial
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              AI-powered outbound calling with live analytics
            </p>
          </div>

          {/* View toggle button */}
          <button
            onClick={() => setViewMode((v) => (v === "live" ? "history" : "live"))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all"
            style={{
              background: viewMode === "history" ? "rgba(105,106,172,0.2)" : "transparent",
              border: viewMode === "history"
                ? "1px solid #696aac"
                : "1px solid rgba(255,255,255,0.08)",
              color: viewMode === "history" ? "#696aac" : "var(--color-text-muted)",
              cursor: "pointer",
              boxShadow: viewMode === "history" ? "0 0 12px rgba(105,106,172,0.2)" : "none",
            }}
          >
            <Clock size={14} />
            Call History
            {callHistory.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: "rgba(105,106,172,0.35)",
                  color: "#696aac",
                }}
              >
                {callHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HISTORY VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {viewMode === "history" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search by company, contact, phone, or product…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--color-text)",
                }}
              />
            </div>

            {/* List */}
            {callHistory.length === 0 ? (
              <div
                className="rounded-2xl p-12 text-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Clock size={32} className="mx-auto mb-3" style={{ color: "var(--color-text-faint)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No calls yet. Make your first call to start building history.
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No calls match your search.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((entry) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedHistoryId === entry.id}
                    onToggle={() =>
                      setExpandedHistoryId((prev) => (prev === entry.id ? null : entry.id))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LIVE VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {viewMode === "live" && (
          <>
            {/* ═══ Section 1: Call Setup ═══ */}
            <div
              className="rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="text-xs uppercase tracking-wider mb-5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Call Setup
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Phone */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Phone Number <span style={{ color: "var(--color-error)" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                {/* Contact First Name */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Contact First Name
                  </label>
                  <input
                    type="text"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                {/* Contact Last Name */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Contact Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="Smith"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                </div>

                {/* Seller company (becomes "Adam from {{this}}" in the call opener) */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Pitching On Behalf Of <span style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>(seller company)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Akamai, AntimatterAI, TierPoint…"
                    value={productSlug}
                    onChange={(e) => setProductSlug(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                    Just the company name — ΔTOM will open with “Hey [name], this is Adam from [{productSlug || "AntimatterAI"}]”
                  </p>
                </div>

                {/* Pitch topic / talking point (informational — fed to brief, not the opener) */}
                <div>
                  <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">
                    Pitch Topic <span style={{ color: "var(--color-text-muted)", opacity: 0.6 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="HIPAA compliance changes, Guardicore segmentation, App & API Protector…"
                    value={pitchTopic}
                    onChange={(e) => setPitchTopic(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--color-text)",
                    }}
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)", opacity: 0.7 }}>
                    What you specifically want ΔTOM to bring up — surfaces in the call brief.
                  </p>
                </div>

                {/* Record this call — per-call audio capture toggle */}
                <div>
                  <label
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors"
                    style={{
                      background: recordCall ? "color-mix(in oklab, var(--color-primary) 9%, transparent)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${recordCall ? "color-mix(in oklab, var(--color-primary) 35%, transparent)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={recordCall}
                      onChange={(e) => setRecordCall(e.target.checked)}
                      disabled={callStatus === "active" || callStatus === "dialing"}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-current"
                      style={{ accentColor: "var(--color-primary)" }}
                    />
                    <span className="flex-1">
                      <span className="block text-sm" style={{ color: "var(--color-text)" }}>
                        Record this call
                        <span
                          className="ml-2 px-1.5 py-[1px] rounded text-[9px] uppercase tracking-[0.16em]"
                          style={{
                            background: recordCall ? "color-mix(in oklab, var(--color-primary) 22%, transparent)" : "rgba(255,255,255,0.06)",
                            color: recordCall ? "var(--color-primary)" : "var(--color-text-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {recordCall ? "ON" : "OFF"}
                        </span>
                      </span>
                      <span className="block text-[10px] mt-1" style={{ color: "var(--color-text-muted)", opacity: 0.75 }}>
                        Captures both audio channels. Playback + sentiment replay surfaces in History.
                      </span>
                    </span>
                  </label>
                </div>

                {/* Deal Value field removed — enterprise routing keys off
                    tenant plan + Apollo firmographics on the backend now. */}
              </div>

              {/* CTA row */}
              {callStatus === "idle" || callStatus === "dialing" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <AtomCta
                    accent="emerald"
                    onClick={handleDial}
                    disabled={callStatus === "dialing"}
                    className="w-full sm:w-auto px-6"
                  >
                    {callStatus === "dialing" ? (
                      <><Loader2 size={16} className="animate-spin" />Connecting…</>
                    ) : (
                      <><PhoneCall size={16} />Dial with ΔTOM</>
                    )}
                  </AtomCta>
                  <HVTFlagButton companyName={companyName} contactName={contactName} phone={phone} />
                </div>
              ) : callStatus === "active" ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <PulsingDot />
                    <span className="text-sm font-medium" style={{ color: "#34d399" }}>
                      Call Active
                      {companyName && ` — ${companyName}`}
                      {contactName && ` — ${contactName}`}
                    </span>
                    {callTier === "enterprise" && (
                      <span
                        className="text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{
                          background: "color-mix(in oklab, var(--color-primary) 14%, transparent)",
                          color: "var(--color-primary)",
                          border: "1px solid color-mix(in oklab, var(--color-primary) 35%, transparent)",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          boxShadow: "0 0 8px var(--color-primary-glow)",
                        }}
                      >
                        ⚡ Enterprise · {reasoningModel || "GPT-5"}
                      </span>
                    )}
                    {callTier === "standard" && reasoningModel && (
                      <span
                        className="text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {reasoningModel}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleEndCall}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{
                      background: "color-mix(in oklab, var(--color-error) 12%, transparent)",
                      border: "1px solid color-mix(in oklab, var(--color-error) 12%, transparent)",
                      color: "var(--color-error)",
                      cursor: "pointer",
                    }}
                  >
                    <PhoneOff size={14} />
                    End Call
                  </button>
                </div>
              ) : (
                /* ended */
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Call ended
                  </span>
                  <button
                    onClick={handleNewCall}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                      background: "linear-gradient(93.92deg, var(--color-primary-2) -13.51%, var(--color-primary) 40.91%, #ea580c 113.69%)", boxShadow: "0 0 15px var(--color-primary-glow-strong), inset 0 0 2px rgba(255,255,255,0.3)",
                      color: "white",
                      boxShadow: "0 0 16px rgba(133,135,227,0.3)",
                      cursor: "pointer",
                    }}
                  >
                    <PhoneCall size={14} />
                    New Call
                  </button>
                </div>
              )}
            </div>

            {/* ═══ Section 2: Live Analytics (only during/after call) ═══ */}
            {showAnalytics && (
              <div
                className="rounded-2xl p-6 space-y-6"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Live Analytics{callStatus === "ended" && " — Final State"}
                </div>

                {/* ── Row 1: Gauges ── */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-2 self-start"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Sentiment
                    </div>
                    <Gauge score={metrics.sentiment} label={sentimentLabel(metrics.sentiment)} type="sentiment" />
                  </div>
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-2 self-start"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Buyer Intent
                    </div>
                    <Gauge score={metrics.buyerIntent} label={intentLabel(metrics.buyerIntent)} type="intent" />
                  </div>
                </div>

                {/* ── Row 2: Emotion Bars ── */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="text-xs uppercase tracking-wider mb-4"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    Emotion Analysis
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(metrics.emotions).map(([name, val]) => (
                      <EmotionBar key={name} name={name} value={val} />
                    ))}
                  </div>
                </div>

                {/* ── Row 3: Stage + Sparkline ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-4"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Call Stage
                    </div>
                    <StageTimeline activeStage={metrics.stage} />
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-3"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Sentiment Timeline
                    </div>
                    <div className="h-20">
                      <SentimentSparkline points={sentimentHistory} />
                    </div>
                  </div>
                </div>

                {/* ── Von Clausewitz / Aletheia Engine ── */}
                {warroom && (
                  <div
                    className="rounded-xl p-4 space-y-4"
                    style={{
                      background: "rgba(220, 38, 38, 0.08)",
                      border: "1px solid rgba(220, 38, 38, 0.25)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="text-xs uppercase tracking-wider font-semibold"
                        style={{ color: "var(--color-error)" }}
                      >
                        ⚔️ War Room — Von Clausewitz Engine
                      </div>
                      <span
                        className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
                        style={{
                          background: warroom.dealRisk === "HEALTHY" ? "rgba(34,197,94,0.2)" :
                                      warroom.dealRisk === "CAUTION" ? "rgba(250,204,21,0.2)" :
                                      warroom.dealRisk === "AT_RISK" ? "rgba(251,146,60,0.2)" :
                                      "color-mix(in oklab, var(--color-error) 12%, transparent)",
                          color: warroom.dealRisk === "HEALTHY" ? "#4ade80" :
                                 warroom.dealRisk === "CAUTION" ? "#fde047" :
                                 warroom.dealRisk === "AT_RISK" ? "var(--color-primary-2)" :
                                 "var(--color-error)",
                        }}
                      >
                        {warroom.dealRisk || "—"}
                      </span>
                    </div>

                    {/* TRUTH + Posture + Ghost */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60">TRUTH</div>
                        <div className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>{warroom.truthScore ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60">Leverage</div>
                        <div className="text-sm font-semibold capitalize" style={{ color: "var(--color-text)" }}>
                          {warroom.negotiationPosture?.leveragePosition || "—"}
                        </div>
                        <div className="text-[10px] opacity-60">power {warroom.negotiationPosture?.powerScore ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60">Ghost Risk</div>
                        <div className="text-2xl font-bold" style={{ color: warroom.ghostProbability > 50 ? "var(--color-error)" : "var(--color-text)" }}>
                          {warroom.ghostProbability ?? 0}%
                        </div>
                      </div>
                    </div>

                    {/* Deception bars */}
                    {warroom.deception && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Deception Signals</div>
                        {Object.entries(warroom.deception as Record<string, number>).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-3 text-[11px]">
                            <span className="w-32 capitalize opacity-80">{k.replace(/Pct|Probability/g, "").replace(/([A-Z])/g, " $1").trim()}</span>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                              <div style={{ width: `${v}%`, height: "100%", background: v > 60 ? "var(--color-error)" : v > 30 ? "var(--color-primary-2)" : "#4ade80" }} />
                            </div>
                            <span className="w-8 text-right opacity-70">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Flags */}
                    {Array.isArray(warroom.flags) && warroom.flags.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1.5">Active Flags</div>
                        <div className="flex flex-wrap gap-1.5">
                          {warroom.flags.slice(0, 6).map((f: any, i: number) => (
                            <span
                              key={i}
                              title={f.phrase}
                              className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider"
                              style={{
                                background: f.severity === "high" ? "color-mix(in oklab, var(--color-error) 12%, transparent)" :
                                            f.severity === "medium" ? "rgba(251,146,60,0.2)" :
                                            "rgba(250,204,21,0.15)",
                                color: f.severity === "high" ? "#fca5a5" :
                                       f.severity === "medium" ? "#fdba74" :
                                       "#fde047",
                                border: "1px solid currentColor",
                              }}
                            >
                              {f.type?.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Competitive radar */}
                    {warroom.competitiveRadar?.competitorMentioned && (
                      <div
                        className="rounded-lg p-2.5 text-[11px]"
                        style={{ background: "color-mix(in oklab, var(--color-error) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-error) 12%, transparent)" }}
                      >
                        <span className="font-semibold" style={{ color: "#fca5a5" }}>⚠️ Competitor mentioned: </span>
                        <span className="opacity-90">{warroom.competitiveRadar.competitors?.join(", ") || "unnamed"}</span>
                      </div>
                    )}

                    {/* Suggested reply for ADAM */}
                    {warroom.suggestedReply && (
                      <div
                        className="rounded-lg p-3"
                        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
                      >
                        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#4ade80" }}>
                          ➤ Suggested Next Line ({warroom.move || "play"})
                        </div>
                        <div className="text-sm italic" style={{ color: "var(--color-text)" }}>
                          “{warroom.suggestedReply}”
                        </div>
                      </div>
                    )}

                    {warroom.signal && (
                      <div className="text-[11px] opacity-70 italic">— {warroom.signal}</div>
                    )}
                  </div>
                )}

                {/* ── Row 4: Buying Signals ── */}
                {buyingSignals.length > 0 && (
                  <div>
                    <div
                      className="text-xs uppercase tracking-wider mb-3"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Buying Signals
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {buyingSignals.map((sig, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: "rgba(105,106,172,0.2)",
                            border: "1px solid rgba(133,135,227,0.3)",
                            color: "#696aac",
                            animation: "slideIn 0.3s ease",
                          }}
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Call Summary (after ended) ── */}
                {callStatus === "ended" && summary && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: "rgba(105,106,172,0.08)",
                      border: "1px solid rgba(133,135,227,0.2)",
                    }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-3"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      Call Summary
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Duration</div>
                        <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                          {summary.duration ? formatDuration(summary.duration) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Final Sentiment</div>
                        <div className="text-sm font-medium" style={{ color: sentimentColor(summary.finalSentiment) }}>
                          {sentimentLabel(summary.finalSentiment)} ({Math.round(summary.finalSentiment)})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Final Intent</div>
                        <div className="text-sm font-medium" style={{ color: "#696aac" }}>
                          {intentLabel(summary.finalIntent)} ({Math.round(summary.finalIntent)})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "var(--color-text-muted)" }}>Final Stage</div>
                        <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                          {summary.stage}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Section 3: Live Transcript ═══ */}
            {showAnalytics && (
              <div
                className="rounded-2xl p-6"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-wider mb-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {callStatus === "ended" ? "Transcript" : "Live Transcript"}
                </div>

                <div
                  className="overflow-y-auto pr-1"
                  style={{
                    maxHeight: "420px",
                    minHeight: "120px",
                  }}
                >
                  {transcript.length === 0 ? (
                    <div
                      className="text-sm text-center py-10"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      {callStatus === "active" ? "Waiting for transcript…" : "No transcript recorded."}
                    </div>
                  ) : (
                    transcript.map((entry, i) => <TxMessage key={i} entry={entry} />)
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* slide-in animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: var(--color-text-faint); }
        input:focus { border-color: rgba(133,135,227,0.4) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--color-text-faint); border-radius: 9999px; }
      `}</style>
    </div>
  );
}
