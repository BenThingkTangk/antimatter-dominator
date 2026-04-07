import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { PhoneCall, PhoneOff, Loader2 } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_URL = "https://45-79-202-76.sslip.io";
const ARC_LENGTH = Math.PI * 80; // radius=80, semicircle

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

type CallStatus = "idle" | "dialing" | "active" | "ended";

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

// Polar coords for arc endpoint
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── SVG Gauge ───────────────────────────────────────────────────────────────

function Gauge({ score, label, type }: { score: number; label: string; type: "sentiment" | "intent" }) {
  const pct = Math.max(0, Math.min(100, score));
  const offset = ARC_LENGTH - (ARC_LENGTH * pct) / 100;
  const color = type === "sentiment" ? sentimentColor(score) : score > 75 ? "#a78bfa" : "#696aac";
  const gradId = `gauge-grad-${type}`;

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
            <filter id="glow">
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
          filter={score > 75 && type === "intent" ? "url(#glow)" : undefined}
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

function SentimentSparkline({ points }: { points: Array<{ ts: number; value: number }> }) {
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#696aac" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#696aac" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGrad)" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ATOMLeadGen() {
  const { toast } = useToast();

  // Form
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [productSlug, setProductSlug] = useState("");

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
  const [sentimentHistory, setSentimentHistory] = useState<Array<{ ts: number; value: number }>>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [buyingSignals, setBuyingSignals] = useState<string[]>([]);
  const [summary, setSummary] = useState<CallSummary | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const callSidRef = useRef<string | null>(null);

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
        setSummary({
          duration: data.duration ?? 0,
          finalSentiment: metrics.sentiment,
          finalIntent: metrics.buyerIntent,
          stage: metrics.stage,
        });
        ws.close();
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] error", e);
    };

    ws.onclose = () => {
      console.log("[WS] closed");
    };
  }, [metrics]);

  const handleDial = async () => {
    if (!phone.trim()) {
      toast({ title: "Phone number required", variant: "destructive" });
      return;
    }
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

    try {
      const res = await fetch(`${BRIDGE_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone.trim(),
          contactName: contactName.trim() || undefined,
          companyName: companyName.trim() || undefined,
          productSlug: productSlug.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const json = await res.json();
      const sid: string = json.callSid;
      setCallSid(sid);
      callSidRef.current = sid;
      connectWebSocket(sid);
      setCallStatus("active");
    } catch (err: any) {
      setCallStatus("idle");
      toast({
        title: "Failed to connect",
        description: err?.message ?? "Bridge unreachable. Check your network.",
        variant: "destructive",
      });
    }
  };

  const handleEndCall = () => {
    wsRef.current?.close();
    setCallStatus("ended");
    setSummary((prev) =>
      prev ?? {
        duration: 0,
        finalSentiment: metrics.sentiment,
        finalIntent: metrics.buyerIntent,
        stage: metrics.stage,
      }
    );
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

  return (
    <div
      className="min-h-screen px-4 py-8 md:px-8"
      style={{ background: "#020202", color: "rgba(246,246,253,0.9)", fontFamily: "inherit" }}
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "rgba(246,246,253,0.95)" }}>
            ATOM Lead Gen
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(246,246,253,0.4)" }}>
            AI-powered outbound calling with live analytics
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Section 1: Call Setup
        ═══════════════════════════════════════════════════════════════════ */}
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
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all"
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
            <div className="flex items-center justify-between">
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

        {/* ═══════════════════════════════════════════════════════════════════
            Section 2: Live Analytics (only during/after call)
        ═══════════════════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════════════════
            Section 3: Live Transcript
        ═══════════════════════════════════════════════════════════════════ */}
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
              Live Transcript
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
