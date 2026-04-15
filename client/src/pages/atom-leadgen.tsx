import { useState, useEffect, useRef, useCallback } from "react";
import { useProductIntel } from "@/hooks/use-product-intel";
import { useToast } from "@/hooks/use-toast";
import { PhoneCall, PhoneOff, Loader2, Clock, ChevronDown, ChevronUp, Search } from "lucide-react";

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
  timestamp: number;
  duration: number;
  finalSentiment: number;
  finalIntent: number;
  finalStage: string;
  transcript: TranscriptEntry[];
  sentimentHistory: SentimentPoint[];
  emotions: Record<string, number>;
  buyingSignals: string[];
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
  return "#f87171";
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
  return { background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" };
}

function cardBorderColor(intent: number): string {
  if (intent > 60) return "#34d399";
  if (intent >= 30) return "#fbbf24";
  return "#f87171";
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
            <stop offset="0%" stopColor="#ef4444" />
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
          stroke="rgba(246,246,253,0.06)"
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
        <text x="100" y="104" textAnchor="middle" fill="rgba(246,246,253,0.5)" fontSize="11">
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
  frustration: "#f87171",
  neutrality: "#94a3b8",
};

function EmotionBar({ name, value }: { name: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, (value || 0) * 100)));
  const color = EMOTION_COLORS[name] ?? "#696aac";
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs capitalize" style={{ color: "rgba(246,246,253,0.6)" }}>
        {name}
      </span>
      <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(246,246,253,0.06)" }}>
        <div
          className="h-2 rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
      <span className="w-9 text-right text-xs" style={{ color: "rgba(246,246,253,0.45)" }}>
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
                    : "rgba(246,246,253,0.06)",
                  color: isActive || isPast ? "white" : "rgba(246,246,253,0.3)",
                  boxShadow: isActive ? "0 0 12px rgba(133,135,227,0.6)" : "none",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-[10px] mt-1 text-center truncate w-full"
                style={{
                  color: isActive
                    ? "#a2a3e9"
                    : isPast
                    ? "rgba(246,246,253,0.5)"
                    : "rgba(246,246,253,0.25)",
                }}
              >
                {stage}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className="h-px flex-1 mb-4 transition-all duration-500"
                style={{
                  background: i < idx ? "rgba(105,106,172,0.5)" : "rgba(246,246,253,0.08)",
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
        style={{ color: "rgba(246,246,253,0.3)" }}
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
                color: "rgba(246,246,253,0.85)",
              }
            : {
                background: "rgba(246,246,253,0.05)",
                color: "rgba(246,246,253,0.75)",
              }
        }
      >
        <div
          className="text-[10px] mb-1 font-medium uppercase tracking-wider"
          style={{ color: isAtom ? "#a2a3e9" : "rgba(246,246,253,0.4)" }}
        >
          {isAtom ? "ATOM" : "Prospect"} · {formatTime(entry.ts)}
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

function HistoryCallDetail({ entry }: { entry: CallHistoryEntry }) {
  const idx = entry.id;
  return (
    <div className="mt-4 space-y-4 pt-4" style={{ borderTop: "1px solid rgba(246,246,253,0.06)" }}>
      {/* Gauges */}
      <div className="grid grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 flex flex-col items-center"
          style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 self-start" style={{ color: "rgba(246,246,253,0.45)" }}>
            Sentiment
          </div>
          <Gauge score={entry.finalSentiment} label={sentimentLabel(entry.finalSentiment)} type="sentiment" idSuffix={`-hist-${idx}`} />
        </div>
        <div
          className="rounded-xl p-4 flex flex-col items-center"
          style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 self-start" style={{ color: "rgba(246,246,253,0.45)" }}>
            Buyer Intent
          </div>
          <Gauge score={entry.finalIntent} label={intentLabel(entry.finalIntent)} type="intent" idSuffix={`-hist-${idx}`} />
        </div>
      </div>

      {/* Emotion Bars */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
      >
        <div className="text-xs uppercase tracking-wider mb-4" style={{ color: "rgba(246,246,253,0.45)" }}>
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
          style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-4" style={{ color: "rgba(246,246,253,0.45)" }}>
            Call Stage
          </div>
          <StageTimeline activeStage={entry.finalStage} />
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
        >
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(246,246,253,0.45)" }}>
            Sentiment Timeline
          </div>
          <div className="h-20">
            <SentimentSparkline points={entry.sentimentHistory} idSuffix={`-hist-${idx}`} />
          </div>
        </div>
      </div>

      {/* Buying Signals */}
      {entry.buyingSignals.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(246,246,253,0.45)" }}>
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
                  color: "#a2a3e9",
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
        <div className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(246,246,253,0.45)" }}>
          Full Transcript
        </div>
        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: "360px", minHeight: "80px" }}
        >
          {entry.transcript.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: "rgba(246,246,253,0.25)" }}>
              No transcript recorded.
            </div>
          ) : (
            entry.transcript.map((e, i) => <TxMessage key={i} entry={e} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry, isExpanded, onToggle }: { entry: CallHistoryEntry; isExpanded: boolean; onToggle: () => void }) {
  const borderColor = cardBorderColor(entry.finalIntent);

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-all duration-200"
      style={{
        background: "rgba(246,246,253,0.03)",
        border: `1px solid ${isExpanded ? "#696aac" : "rgba(246,246,253,0.08)"}`,
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: isExpanded ? "0 0 16px rgba(105,106,172,0.15)" : "none",
      }}
      onClick={onToggle}
    >
      {/* Card header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: "rgba(246,246,253,0.9)" }}>
              {entry.companyName || "Unknown Company"}
            </span>
            {entry.contactName && (
              <span className="text-xs" style={{ color: "rgba(246,246,253,0.45)" }}>
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
            <span className="text-xs" style={{ color: "rgba(246,246,253,0.4)" }}>
              {entry.phoneNumber}
            </span>
            {entry.product && (
              <span className="text-xs" style={{ color: "rgba(246,246,253,0.4)" }}>
                · {entry.product}
              </span>
            )}
            <span className="text-xs" style={{ color: "rgba(246,246,253,0.3)" }}>
              · {formatDateTime(entry.timestamp)}
            </span>
            {entry.duration > 0 && (
              <span className="text-xs" style={{ color: "rgba(246,246,253,0.3)" }}>
                · {formatDuration(entry.duration)}
              </span>
            )}
          </div>
        </div>

        {/* Scores + chevron */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(246,246,253,0.35)" }}>
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
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(246,246,253,0.35)" }}>
              Intent
            </div>
            <div className="text-lg font-light" style={{ color: "#a2a3e9" }}>
              {Math.round(entry.finalIntent)}
            </div>
          </div>
          <div style={{ color: "rgba(246,246,253,0.35)" }}>
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
  const [contactName, setContactName] = useState(params.get("firstName") || params.get("name") || "");
  const [companyName, setCompanyName] = useState(params.get("company") || params.get("companyName") || "");
  const [productSlug, setProductSlug] = useState(params.get("product") || "");

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
  const [summary, setSummary] = useState<CallSummary | null>(null);

  // View mode + call history
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('atom_leadgen_call_history');
      return saved ? JSON.parse(saved) : [];
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
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const callSidRef = useRef<string | null>(null);
  // Keep a ref to the latest metrics/transcript etc. so the ws callback can access them
  const metricsRef = useRef(metrics);
  const transcriptRef = useRef(transcript);
  const sentimentHistoryRef = useRef(sentimentHistory);
  const emotionsRef = useRef(metrics.emotions);
  const buyingSignalsRef = useRef(buyingSignals);
  const formRef = useRef({ contactName, companyName, product: productSlug, phone });

  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { sentimentHistoryRef.current = sentimentHistory; }, [sentimentHistory]);
  useEffect(() => { emotionsRef.current = metrics.emotions; }, [metrics.emotions]);
  useEffect(() => { buyingSignalsRef.current = buyingSignals; }, [buyingSignals]);
  useEffect(() => {
    formRef.current = { contactName, companyName, product: productSlug, phone };
  }, [contactName, companyName, productSlug, phone]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

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
        setCallHistory((prev) => [
          {
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
          },
          ...prev,
        ]);

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
    setTranscript([]);
    setBuyingSignals([]);
    setSentimentHistory([]);
    setSummary(null);
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
        productIntel: productIntelData || undefined,
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
      connectWebSocket(sid);
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
    setCallHistory((prev) => [
      {
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
      },
      ...prev,
    ]);
  };

  const handleNewCall = () => {
    wsRef.current?.close();
    setCallStatus("idle");
    setCallSid(null);
    setTranscript([]);
    setBuyingSignals([]);
    setSentimentHistory([]);
    setSummary(null);
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
      style={{ background: "#020202", color: "rgba(246,246,253,0.9)", fontFamily: "inherit" }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "rgba(246,246,253,0.95)" }}>
              ATOM Lead Gen
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>
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
                : "1px solid rgba(246,246,253,0.15)",
              color: viewMode === "history" ? "#a2a3e9" : "rgba(246,246,253,0.6)",
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
                  color: "#a2a3e9",
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
                style={{ color: "rgba(246,246,253,0.3)" }}
              />
              <input
                type="text"
                placeholder="Search by company, contact, phone, or product…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(246,246,253,0.04)",
                  border: "1px solid rgba(246,246,253,0.1)",
                  color: "rgba(246,246,253,0.9)",
                }}
              />
            </div>

            {/* List */}
            {callHistory.length === 0 ? (
              <div
                className="rounded-2xl p-12 text-center"
                style={{
                  background: "rgba(246,246,253,0.02)",
                  border: "1px solid rgba(246,246,253,0.06)",
                }}
              >
                <Clock size={32} className="mx-auto mb-3" style={{ color: "rgba(246,246,253,0.15)" }} />
                <p className="text-sm" style={{ color: "rgba(246,246,253,0.35)" }}>
                  No calls yet. Make your first call to start building history.
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{
                  background: "rgba(246,246,253,0.02)",
                  border: "1px solid rgba(246,246,253,0.06)",
                }}
              >
                <p className="text-sm" style={{ color: "rgba(246,246,253,0.35)" }}>
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
                background: "rgba(246,246,253,0.03)",
                border: "1px solid rgba(246,246,253,0.08)",
              }}
            >
              <div
                className="text-xs uppercase tracking-wider mb-5"
                style={{ color: "rgba(246,246,253,0.5)" }}
              >
                Call Setup
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {/* Phone */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "rgba(246,246,253,0.5)" }}>
                    Phone Number <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(246,246,253,0.05)",
                      border: "1px solid rgba(246,246,253,0.1)",
                      color: "rgba(246,246,253,0.9)",
                    }}
                  />
                </div>

                {/* Contact Name */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "rgba(246,246,253,0.5)" }}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Smith"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(246,246,253,0.05)",
                      border: "1px solid rgba(246,246,253,0.1)",
                      color: "rgba(246,246,253,0.9)",
                    }}
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "rgba(246,246,253,0.5)" }}>
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
                      background: "rgba(246,246,253,0.05)",
                      border: "1px solid rgba(246,246,253,0.1)",
                      color: "rgba(246,246,253,0.9)",
                    }}
                  />
                </div>

                {/* Product */}
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "rgba(246,246,253,0.5)" }}>
                    Product / Service to Pitch
                  </label>
                  <input
                    type="text"
                    placeholder="Akamai, TierPoint, CDN…"
                    value={productSlug}
                    onChange={(e) => setProductSlug(e.target.value)}
                    disabled={callStatus === "active" || callStatus === "dialing"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "rgba(246,246,253,0.05)",
                      border: "1px solid rgba(246,246,253,0.1)",
                      color: "rgba(246,246,253,0.9)",
                    }}
                  />
                </div>
              </div>

              {/* CTA row */}
              {callStatus === "idle" || callStatus === "dialing" ? (
                <button
                  onClick={handleDial}
                  disabled={callStatus === "dialing"}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-sm transition-all"
                  style={{
                    background: "linear-gradient(135deg, #8587e3, #4c4dac, #696aac)",
                    color: "white",
                    boxShadow: "0 0 20px rgba(133,135,227,0.35)",
                    opacity: callStatus === "dialing" ? 0.7 : 1,
                    cursor: callStatus === "dialing" ? "not-allowed" : "pointer",
                  }}
                >
                  {callStatus === "dialing" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      <PhoneCall size={16} />
                      Dial with ATOM
                    </>
                  )}
                </button>
              ) : callStatus === "active" ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PulsingDot />
                    <span className="text-sm font-medium" style={{ color: "#34d399" }}>
                      Call Active
                      {companyName && ` — ${companyName}`}
                      {contactName && ` — ${contactName}`}
                    </span>
                  </div>
                  <button
                    onClick={handleEndCall}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{
                      background: "rgba(248,113,113,0.15)",
                      border: "1px solid rgba(248,113,113,0.3)",
                      color: "#f87171",
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
                  <span className="text-sm" style={{ color: "rgba(246,246,253,0.5)" }}>
                    Call ended
                  </span>
                  <button
                    onClick={handleNewCall}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                    style={{
                      background: "linear-gradient(135deg, #8587e3, #4c4dac, #696aac)",
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
                  background: "rgba(246,246,253,0.03)",
                  border: "1px solid rgba(246,246,253,0.08)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: "rgba(246,246,253,0.5)" }}
                >
                  Live Analytics{callStatus === "ended" && " — Final State"}
                </div>

                {/* ── Row 1: Gauges ── */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-2 self-start"
                      style={{ color: "rgba(246,246,253,0.45)" }}
                    >
                      Sentiment
                    </div>
                    <Gauge score={metrics.sentiment} label={sentimentLabel(metrics.sentiment)} type="sentiment" />
                  </div>
                  <div
                    className="rounded-xl p-4 flex flex-col items-center"
                    style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-2 self-start"
                      style={{ color: "rgba(246,246,253,0.45)" }}
                    >
                      Buyer Intent
                    </div>
                    <Gauge score={metrics.buyerIntent} label={intentLabel(metrics.buyerIntent)} type="intent" />
                  </div>
                </div>

                {/* ── Row 2: Emotion Bars ── */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
                >
                  <div
                    className="text-xs uppercase tracking-wider mb-4"
                    style={{ color: "rgba(246,246,253,0.45)" }}
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
                    style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-4"
                      style={{ color: "rgba(246,246,253,0.45)" }}
                    >
                      Call Stage
                    </div>
                    <StageTimeline activeStage={metrics.stage} />
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{ background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)" }}
                  >
                    <div
                      className="text-xs uppercase tracking-wider mb-3"
                      style={{ color: "rgba(246,246,253,0.45)" }}
                    >
                      Sentiment Timeline
                    </div>
                    <div className="h-20">
                      <SentimentSparkline points={sentimentHistory} />
                    </div>
                  </div>
                </div>

                {/* ── Row 4: Buying Signals ── */}
                {buyingSignals.length > 0 && (
                  <div>
                    <div
                      className="text-xs uppercase tracking-wider mb-3"
                      style={{ color: "rgba(246,246,253,0.45)" }}
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
                            color: "#a2a3e9",
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
                      style={{ color: "rgba(246,246,253,0.45)" }}
                    >
                      Call Summary
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>Duration</div>
                        <div className="text-sm font-medium" style={{ color: "rgba(246,246,253,0.9)" }}>
                          {summary.duration ? formatDuration(summary.duration) : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>Final Sentiment</div>
                        <div className="text-sm font-medium" style={{ color: sentimentColor(summary.finalSentiment) }}>
                          {sentimentLabel(summary.finalSentiment)} ({Math.round(summary.finalSentiment)})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>Final Intent</div>
                        <div className="text-sm font-medium" style={{ color: "#a2a3e9" }}>
                          {intentLabel(summary.finalIntent)} ({Math.round(summary.finalIntent)})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs mb-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>Final Stage</div>
                        <div className="text-sm font-medium" style={{ color: "rgba(246,246,253,0.9)" }}>
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
                  background: "rgba(246,246,253,0.03)",
                  border: "1px solid rgba(246,246,253,0.08)",
                }}
              >
                <div
                  className="text-xs uppercase tracking-wider mb-4"
                  style={{ color: "rgba(246,246,253,0.5)" }}
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
                      style={{ color: "rgba(246,246,253,0.25)" }}
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
        input::placeholder { color: rgba(246,246,253,0.2); }
        input:focus { border-color: rgba(133,135,227,0.4) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(246,246,253,0.1); border-radius: 9999px; }
      `}</style>
    </div>
  );
}
