import { useState, useEffect, useRef, useCallback } from "react";
import {
  Eye,
  Shield,
  Brain,
  Activity,
  AlertTriangle,
  BarChart3,
  Target,
  Zap,
  MessageSquare,
  Phone,
  Mail,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Radio,
  Mic,
  Users,
  FileText,
  Search,
  History,
  Layers,
  Video,
  Crosshair,
  Cpu,
  Wifi,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId = "live" | "text" | "pipeline" | "playbook" | "history";
type ChannelId = "VIDEO" | "VOICE" | "TEXT-SMS" | "EMAIL";

interface AnalysisResult {
  truthScore: number;
  hedgePct: number;
  evasionPct: number;
  urgency: string;
  dealRisk: number;
  riskLevel: string;
  highlightedHtml: string;
  hedgeCount: number;
  evasionCount: number;
  wordCount: number;
  sentCount: number;
  buyerIntent?: string;
  ghostRisk?: string;
  actionable?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const C = {
  bg: "#020202",
  card: "rgba(246,246,253,0.03)",
  cardBorder: "rgba(246,246,253,0.08)",
  accent: "#696aac",
  primary: "#3e3f7e",
  secondary: "#a2a3e9",
  green: "#1dd1a1",
  red: "#f87171",
  amber: "#fbbf24",
  cyan: "#22d3ee",
  textPrimary: "#f6f6fd",
  textMuted: "rgba(246,246,253,0.55)",
  textFaint: "rgba(246,246,253,0.35)",
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
};

const HEDGES = ["definitely", "absolutely", "strong fit", "very interested", "bullish", "top of mind", "100%", "for sure", "no question", "certainly"];
const EVASIONS = ["next quarter", "few months", "revisit", "settle down", "pause", "internal reprioritization", "circle back", "when things", "right now", "at the moment"];
const URGENCY_WORDS = ["urgent", "asap", "today", "right now", "by end of", "immediately"];

const SAMPLE_SMS =
  "Hey, just wanted to check in. We are still very interested but the decision has been pushed to next quarter. Our CEO is very bullish on this and thinks it's a great fit. We will definitely circle back soon.";
const SAMPLE_EMAIL =
  "Hi,\n\nThank you for the proposal. The team believes there is a strong fit. However, due to some internal reprioritization we need to pause the evaluation for now. We would love to revisit in a few months when things settle down. Definitely keeping you top of mind.\n\nBest,\nJames";

const INTEL_CUES = [
  {
    level: "RED",
    title: "Budget narrative integrity: LOW",
    desc: "Aletheia flags high hedge + stall language around budget. Treat current objection as cover for hidden blocker or alternate vendor.",
  },
  {
    level: "AMBER",
    title: "Authority claim requires escalation",
    desc: 'Subject references "board" and "internal process" without specifics. Initiate authority flush sequence.',
  },
  {
    level: "RED",
    title: "Timeline fabrication detected",
    desc: 'Subject shifted commitment window from "this quarter" to "Q3/Q4 maybe" — 2 timeline shifts in 90s.',
  },
  {
    level: "AMBER",
    title: "Competitive intel gap",
    desc: 'Subject mentioned "other options" without naming vendors. Deploy competitive flush.',
  },
];

const DEMO_TRANSCRIPT = [
  { time: "0:00", speaker: "ATOM", text: "Hey — this is ADAM from Antimatter AI. Quick question about your infrastructure...", flag: null },
  { time: "0:12", speaker: "PROSPECT", text: "Oh hey, yeah we're actually looking at a few things right now.", flag: "vague" },
  { time: "0:28", speaker: "ATOM", text: "What specifically are you evaluating?", flag: null },
  { time: "0:35", speaker: "PROSPECT", text: "Well, it's kind of a committee decision... I'd need to run it by a few people.", flag: "authority evasion" },
  { time: "0:52", speaker: "ATOM", text: "Who would be the key decision maker?", flag: null },
  { time: "0:58", speaker: "PROSPECT", text: "That's... hard to say exactly. It's more of a group thing.", flag: "distancing, deflection" },
];

const DEALS = [
  { name: "Acme Corp", value: "$420K", stage: "Negotiation", truthAdj: 34, risk: "HIGH", trend: "down" },
  { name: "Globex Inc", value: "$180K", stage: "Demo", truthAdj: 78, risk: "LOW", trend: "up" },
  { name: "Initech", value: "$95K", stage: "Discovery", truthAdj: 52, risk: "MEDIUM", trend: "flat" },
  { name: "Umbrella Co", value: "$310K", stage: "Proposal", truthAdj: 41, risk: "HIGH", trend: "down" },
  { name: "Stark Industries", value: "$890K", stage: "Closing", truthAdj: 68, risk: "MEDIUM", trend: "up" },
];

const PLAYBOOK_TACTICS = [
  {
    name: "Authority Flush",
    trigger: "Subject avoids naming decision-makers",
    script: "If I could get 30 minutes with [person], what would be the fastest path to that conversation?",
    color: C.red,
  },
  {
    name: "Timeline Lock",
    trigger: "Subject gives vague timeline",
    script: "Help me understand — if we could solve [pain point] by [date], what would need to be true internally?",
    color: C.amber,
  },
  {
    name: "Budget Reveal",
    trigger: "Budget hedge detected",
    script: "Most teams we work with have a range in mind. What range would make this a no-brainer vs. a hard sell?",
    color: C.accent,
  },
  {
    name: "Competitor Flush",
    trigger: "Vague 'other options' signal",
    script: "Who else are you evaluating? I want to make sure we're comparing the right things.",
    color: C.cyan,
  },
];

// ─── Scanline card component ────────────────────────────────────────────────

function ScanlineCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 16,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(246,246,253,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(246,246,253,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          zIndex: 0,
        }}
      />
      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.12) 3px,
            rgba(0,0,0,0.12) 4px
          )`,
          zIndex: 1,
        }}
      />
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}

// ─── Module label ─────────────────────────────────────────────────────────

function ModuleLabel({ num, name }: { num: string; name: string }) {
  return (
    <div
      style={{
        fontFamily: "'Courier New', monospace",
        fontSize: 10,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: C.textFaint,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ color: C.accent }}>Module {num}</span>
      <span style={{ color: C.textFaint }}>·</span>
      <span>{name}</span>
    </div>
  );
}

// ─── Truth Meter Arc (SVG) ──────────────────────────────────────────────────

function TruthMeterArc({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = clampedScore < 40 ? C.red : clampedScore < 70 ? C.amber : C.green;
  const riskLabel = clampedScore < 40 ? "HIGH RISK" : clampedScore < 70 ? "MEDIUM" : "LOW RISK";

  // Semi-circle arc: center (90,80), radius 64, from 180° to 0°
  const cx = 90;
  const cy = 80;
  const r = 62;
  const startAngle = Math.PI; // 180°
  const endAngle = 0; // 0°
  const totalArc = Math.PI; // 180°

  function polarToCartesian(angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  // Score arc: from 180° going clockwise (decreasing angle) by score/100 of π
  const scoreAngle = startAngle - (clampedScore / 100) * totalArc;
  const scoreEnd = polarToCartesian(scoreAngle);
  const largeArcFlag = clampedScore > 50 ? 1 : 0;
  const scorePath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${scoreEnd.x} ${scoreEnd.y}`;

  const circumference = Math.PI * r;
  const strokeDash = (clampedScore / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={180} height={100} viewBox="0 0 180 100" style={{ overflow: "visible" }}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(246,246,253,0.08)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={trackPath}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "stroke-dasharray 0.6s ease, stroke 0.4s ease" }}
        />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = startAngle - (tick / 100) * totalArc;
          const inner = { x: cx + (r - 8) * Math.cos(angle), y: cy + (r - 8) * Math.sin(angle) };
          const outer = { x: cx + (r + 4) * Math.cos(angle), y: cy + (r + 4) * Math.sin(angle) };
          return (
            <line
              key={tick}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke="rgba(246,246,253,0.2)"
              strokeWidth={1}
            />
          );
        })}
      </svg>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 36,
          fontWeight: 700,
          color: color,
          lineHeight: 1,
          marginTop: -16,
          letterSpacing: "-0.02em",
          textShadow: `0 0 20px ${color}88`,
          transition: "color 0.4s ease",
        }}
        data-flicker="true"
      >
        {clampedScore}
      </div>
      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2, fontFamily: "'Courier New', monospace", letterSpacing: "0.1em" }}>
        / 100 · TRUTH INDEX
      </div>
      <div
        style={{
          marginTop: 8,
          padding: "3px 12px",
          borderRadius: 999,
          border: `1px solid ${color}66`,
          background: `${color}16`,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: color,
          fontFamily: "'Courier New', monospace",
        }}
      >
        {riskLabel}
      </div>
    </div>
  );
}

// ─── Truth Timeline Chart (SVG polyline) ────────────────────────────────────

function TruthTimeline({ history }: { history: number[] }) {
  const W = 220;
  const H = 48;
  const pad = 4;
  const pts = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v / 100) * (H - pad * 2));
    return `${x},${y}`;
  });
  const lastVal = history[history.length - 1] ?? 50;
  const lineColor = lastVal < 40 ? C.red : lastVal < 70 ? C.amber : C.green;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.14em" }}>
        ATI TREND · LAST 90s
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Reference lines */}
        {[30, 70].map((y) => {
          const yPos = H - pad - ((y / 100) * (H - pad * 2));
          return (
            <line
              key={y}
              x1={pad} y1={yPos}
              x2={W - pad} y2={yPos}
              stroke="rgba(246,246,253,0.08)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          );
        })}
        {/* Area fill */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={[...pts, `${W - pad},${H}`, `${pad},${H}`].join(" ")}
          fill="url(#areaGrad)"
          stroke="none"
        />
        {/* Line */}
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${lineColor}88)` }}
        />
        {/* Last point dot */}
        {pts.length > 0 && (() => {
          const lastPt = pts[pts.length - 1].split(",");
          return (
            <circle
              cx={parseFloat(lastPt[0])}
              cy={parseFloat(lastPt[1])}
              r={3}
              fill={lineColor}
              style={{ filter: `drop-shadow(0 0 4px ${lineColor})` }}
            />
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Waveform ──────────────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 24 }, () => 8 + Math.random() * 32)
  );

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => {
      setBars(Array.from({ length: 24 }, () => 8 + Math.random() * 32));
    }, 140);
    return () => clearInterval(iv);
  }, [active]);

  return (
    <div
      style={{
        height: 42,
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        overflow: "hidden",
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            borderRadius: 2,
            background: active
              ? `linear-gradient(to top, ${C.accent}, ${C.secondary})`
              : "rgba(246,246,253,0.12)",
            height: active ? h : 8,
            transition: "height 0.12s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Fusion Metric Chip ────────────────────────────────────────────────────

function FusionChip({ label, value, unit = "%", colorize = true }: { label: string; value: number; unit?: string; colorize?: boolean }) {
  const pct = unit === "%" ? value : value * 100;
  const color = colorize ? (pct > 70 ? C.red : pct > 40 ? C.amber : C.green) : C.secondary;
  return (
    <div
      style={{
        background: "rgba(246,246,253,0.03)",
        border: `1px solid rgba(246,246,253,0.08)`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          color: C.textFaint,
          fontFamily: "'Courier New', monospace",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          textShadow: `0 0 12px ${color}66`,
          lineHeight: 1,
        }}
      >
        {unit === "%" ? Math.round(pct) : value.toFixed(2)}
        <span style={{ fontSize: 11, fontWeight: 400, color: C.textFaint, marginLeft: 2 }}>{unit}</span>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 99,
          background: "rgba(246,246,253,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.round(pct)}%`,
            height: "100%",
            background: color,
            borderRadius: 99,
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── CSS injection for animations ──────────────────────────────────────────

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

@keyframes pulse-rec {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(248,113,113,0.6); }
  50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(248,113,113,0); }
}
@keyframes flicker {
  0%, 100% { opacity: 1; }
  4% { opacity: 0.85; }
  8% { opacity: 1; }
  15% { opacity: 0.9; }
  20% { opacity: 1; }
}
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes blink-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
.atom-page * { box-sizing: border-box; }
.rec-pulse { animation: pulse-rec 1.5s infinite; }
.data-flicker { animation: flicker 4s infinite; }
.blink-dot { animation: blink-dot 1.2s infinite; }
`;

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AtomAletheia() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("live");
  const [activeChannel, setActiveChannel] = useState<ChannelId>("VIDEO");
  const [isRecording, setIsRecording] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [truthScore, setTruthScore] = useState(34);
  const [stressIndex] = useState(71);
  const [humeAffect, setHumeAffect] = useState(0.72);
  const [prosodyStress, setProsodyStress] = useState(0.68);
  const [nlpEvasion, setNlpEvasion] = useState(0.54);
  const [behaviorDrift, setBehaviorDrift] = useState(0.33);
  const [gazeRatio, setGazeRatio] = useState(42);
  const [microSpikes, setMicroSpikes] = useState(3);
  const [speechRate, setSpeechRate] = useState(1.3);
  const [threatLevel, setThreatLevel] = useState("MEDIUM");
  const [truthHistory, setTruthHistory] = useState([82, 74, 61, 48, 40, 34]);
  const [sessionTime, setSessionTime] = useState(0);
  const [signalCount] = useState(14);

  // Text analyzer
  const [inputText, setInputText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Inject global styles
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => { el.remove(); };
  }, []);

  // Live metrics simulation
  useEffect(() => {
    const iv = setInterval(() => {
      setTruthScore((prev) => {
        const next = Math.max(5, Math.min(95, prev + Math.round((Math.random() - 0.55) * 8)));
        setThreatLevel(next < 40 ? "HIGH" : next < 70 ? "MEDIUM" : "LOW");
        return next;
      });
      setHumeAffect((prev) => Math.max(0.1, Math.min(0.99, prev + (Math.random() - 0.5) * 0.08)));
      setProsodyStress((prev) => Math.max(0.1, Math.min(0.99, prev + (Math.random() - 0.5) * 0.06)));
      setNlpEvasion((prev) => Math.max(0.1, Math.min(0.99, prev + (Math.random() - 0.5) * 0.05)));
      setBehaviorDrift((prev) => Math.max(0.1, Math.min(0.99, prev + (Math.random() - 0.5) * 0.04)));
      setGazeRatio((prev) => Math.max(10, Math.min(90, prev + Math.round((Math.random() - 0.5) * 10))));
      setMicroSpikes(Math.round(Math.random() * 7));
      setSpeechRate(+(1.0 + Math.random() * 0.8).toFixed(1));
      setTruthHistory((prev) => {
        const arr = [...prev.slice(-11), truthScore];
        return arr;
      });
    }, 1800);
    return () => clearInterval(iv);
  }, [truthScore]);

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => setSessionTime((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setCameraActive(true);
      setIsRecording(true);
      toast({ title: "Camera & mic live", description: "Aletheia is now scanning." });
    } catch (e) {
      toast({ title: "Camera error", description: "Check browser permissions.", variant: "destructive" });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setIsRecording(false);
  }, []);

  const toggleCamera = () => {
    if (cameraActive) stopCamera();
    else startCamera();
  };

  // Text analyzer
  const analyzeText = useCallback(async () => {
    const text = inputText.trim();
    if (!text) {
      toast({ title: "No text", description: "Paste a message first.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch("https://45-79-202-76.sslip.io/aletheia/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel: "text" }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const lower = text.toLowerCase();
      let hedgeCount = 0, evasionCount = 0, urgencyCount = 0;
      HEDGES.forEach((h) => { if (lower.includes(h)) hedgeCount++; });
      EVASIONS.forEach((e) => { if (lower.includes(e)) evasionCount++; });
      URGENCY_WORDS.forEach((u) => { if (lower.includes(u)) urgencyCount++; });
      const truthScore = data.truth_score ?? Math.max(5, 100 - Math.min(95, hedgeCount * 18) * 0.4 - Math.min(95, evasionCount * 15) * 0.5 - 10);
      const hedgePct = Math.min(95, hedgeCount * 18);
      const evasionPct = Math.min(95, evasionCount * 15);
      const dealRisk = Math.min(95, Math.round(hedgePct * 0.4 + evasionPct * 0.5 + 10));
      let highlighted = text;
      HEDGES.forEach((h) => { const re = new RegExp(`(${h})`, "gi"); highlighted = highlighted.replace(re, `<mark style="background:rgba(248,113,113,0.2);color:${C.red};border-radius:3px;padding:0 2px">$1</mark>`); });
      EVASIONS.forEach((e) => { const re = new RegExp(`(${e})`, "gi"); highlighted = highlighted.replace(re, `<mark style="background:rgba(251,191,36,0.15);color:${C.amber};border-radius:3px;padding:0 2px">$1</mark>`); });
      setAnalysisResult({
        truthScore: data.truth_score ?? truthScore,
        hedgePct,
        evasionPct,
        urgency: urgencyCount > 0 ? "High" : "Low",
        dealRisk,
        riskLevel: dealRisk > 65 ? "HIGH" : dealRisk > 35 ? "MEDIUM" : "LOW",
        highlightedHtml: highlighted.replace(/\n/g, "<br>"),
        hedgeCount,
        evasionCount,
        wordCount: text.split(/\s+/).length,
        sentCount: text.split(/[.!?]+/).filter(Boolean).length,
        buyerIntent: data.buyer_intent ?? (truthScore > 60 ? "GENUINE" : "UNCERTAIN"),
        ghostRisk: data.ghost_risk ?? (dealRisk > 65 ? "HIGH" : "MEDIUM"),
        actionable: data.actionable_insight ?? "Initiate forcing function — request concrete next step with date.",
      });
    } catch {
      // Fallback local analysis
      const lower = text.toLowerCase();
      let hedgeCount = 0, evasionCount = 0, urgencyCount = 0;
      HEDGES.forEach((h) => { if (lower.includes(h)) hedgeCount++; });
      EVASIONS.forEach((e) => { if (lower.includes(e)) evasionCount++; });
      URGENCY_WORDS.forEach((u) => { if (lower.includes(u)) urgencyCount++; });
      const hedgePct = Math.min(95, hedgeCount * 18);
      const evasionPct = Math.min(95, evasionCount * 15);
      const dealRisk = Math.min(95, Math.round(hedgePct * 0.4 + evasionPct * 0.5 + 10));
      const ts = Math.max(5, 100 - dealRisk - Math.round(Math.random() * 10));
      let highlighted = text;
      HEDGES.forEach((h) => { const re = new RegExp(`(${h})`, "gi"); highlighted = highlighted.replace(re, `<mark style="background:rgba(248,113,113,0.2);color:${C.red};border-radius:3px;padding:0 2px">$1</mark>`); });
      EVASIONS.forEach((e) => { const re = new RegExp(`(${e})`, "gi"); highlighted = highlighted.replace(re, `<mark style="background:rgba(251,191,36,0.15);color:${C.amber};border-radius:3px;padding:0 2px">$1</mark>`); });
      setAnalysisResult({
        truthScore: ts,
        hedgePct,
        evasionPct,
        urgency: urgencyCount > 0 ? "High" : "Low",
        dealRisk,
        riskLevel: dealRisk > 65 ? "HIGH" : dealRisk > 35 ? "MEDIUM" : "LOW",
        highlightedHtml: highlighted.replace(/\n/g, "<br>"),
        hedgeCount,
        evasionCount,
        wordCount: text.split(/\s+/).length,
        sentCount: text.split(/[.!?]+/).filter(Boolean).length,
        buyerIntent: ts > 60 ? "GENUINE" : "UNCERTAIN",
        ghostRisk: dealRisk > 65 ? "HIGH" : "MEDIUM",
        actionable: "Initiate forcing function — request concrete next step with date.",
      });
    }
    setIsAnalyzing(false);
  }, [inputText, toast]);

  // ─── Shared styles ─────────────────────────────────────────────────────────

  const chipBase: React.CSSProperties = {
    padding: "4px 14px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
    border: "1px solid rgba(246,246,253,0.18)",
    background: "rgba(246,246,253,0.04)",
    color: C.textMuted,
    fontFamily: C.font,
  };

  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: `rgba(105,106,172,0.25)`,
    border: `1px solid ${C.accent}`,
    color: C.textPrimary,
    boxShadow: `0 0 10px ${C.accent}55`,
  };

  const subTabBase: React.CSSProperties = {
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    border: "1px solid transparent",
    background: "transparent",
    color: C.textFaint,
    fontFamily: C.font,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap" as const,
  };

  const subTabActive: React.CSSProperties = {
    ...subTabBase,
    background: "rgba(105,106,172,0.18)",
    border: `1px solid rgba(105,106,172,0.5)`,
    color: C.textPrimary,
  };

  const threatColor = threatLevel === "HIGH" ? C.red : threatLevel === "MEDIUM" ? C.amber : C.green;

  // ─── Render: Live Session ──────────────────────────────────────────────────

  const renderLiveSession = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0,1fr) 300px",
        gap: 16,
        alignItems: "start",
      }}
    >
      {/* MODULE 01 — Subject Feed */}
      <ScanlineCard style={{ padding: "16px 16px 14px" }}>
        <ModuleLabel num="01" name="Subject Feed" />

        {/* Video */}
        <div
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            background: "radial-gradient(circle at top, rgba(105,106,172,0.3), #020202 60%)",
            border: "1px solid rgba(246,246,253,0.1)",
          }}
        >
          {/* Subject meta overlay — top */}
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 10,
              right: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: "rgba(2,2,2,0.75)",
                backdropFilter: "blur(6px)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 9,
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.12em",
                color: C.textMuted,
                border: "1px solid rgba(246,246,253,0.1)",
              }}
            >
              <div style={{ color: C.textFaint, fontSize: 8, marginBottom: 2 }}>SUBJECT ID</div>
              <div style={{ color: C.textPrimary, fontWeight: 600 }}>PROSPECT-001</div>
            </div>
            <div
              style={{
                backdropFilter: "blur(6px)",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 9,
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.12em",
                border: `1px solid ${threatColor}55`,
                background: `rgba(2,2,2,0.82)`,
              }}
            >
              <div style={{ color: C.textFaint, fontSize: 8, marginBottom: 2 }}>THREAT LEVEL</div>
              <div style={{ color: threatColor, fontWeight: 700 }}>{threatLevel}</div>
            </div>
          </div>

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              height: 220,
              objectFit: "cover",
              display: "block",
              filter: "saturate(1.1) contrast(1.05)",
              background: "#030308",
            }}
          />

          {/* Subject foot overlay — bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "linear-gradient(transparent, rgba(2,2,2,0.9))",
              padding: "18px 10px 8px",
              display: "flex",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            {[
              { label: "GAZE", value: `${gazeRatio}%` },
              { label: "µ-EXP", value: `${microSpikes} spk` },
              { label: "WPM", value: `${speechRate}x` },
            ].map((m) => (
              <div key={m.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.14em" }}>{m.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, fontFamily: "'Courier New', monospace" }}>{m.value}</div>
              </div>
            ))}
          </div>

          {!cameraActive && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "rgba(2,2,2,0.7)",
                zIndex: 5,
              }}
            >
              <Crosshair size={28} color={C.accent} style={{ opacity: 0.6 }} />
              <div style={{ fontSize: 11, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.14em" }}>
                NO SIGNAL
              </div>
            </div>
          )}
        </div>

        {/* Camera toggle */}
        <button
          onClick={toggleCamera}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px",
            borderRadius: 8,
            border: `1px solid ${cameraActive ? C.green + "66" : "rgba(246,246,253,0.12)"}`,
            background: cameraActive ? `rgba(29,209,161,0.12)` : "rgba(246,246,253,0.04)",
            color: cameraActive ? C.green : C.textMuted,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontFamily: C.font,
          }}
        >
          {cameraActive ? (
            <><span className="blink-dot" style={{ width: 6, height: 6, borderRadius: 999, background: C.green, display: "inline-block" }} />FEED LIVE</>
          ) : (
            <><Video size={12} />ENABLE FEED</>
          )}
        </button>

        {/* Waveform */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.16em", marginBottom: 4 }}>
            VOICE SIGNAL · {cameraActive ? "ACTIVE" : "IDLE"}
          </div>
          <Waveform active={cameraActive} />
        </div>

        {/* Channel status */}
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(246,246,253,0.06)",
            background: "rgba(246,246,253,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {[
            { label: "Video Signal", val: cameraActive ? 90 : 0, color: C.green },
            { label: "Audio Signal", val: cameraActive ? 86 : 0, color: C.secondary },
            { label: "NLP Engine", val: 100, color: C.cyan },
          ].map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
              <span style={{ color: C.textFaint, fontFamily: "'Courier New', monospace", width: 80, flexShrink: 0 }}>{s.label}</span>
              <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(246,246,253,0.08)" }}>
                <div style={{ width: `${s.val}%`, height: "100%", background: s.color, borderRadius: 99, transition: "width 0.5s" }} />
              </div>
              <span style={{ color: s.color, fontFamily: "'Courier New', monospace", fontSize: 10, minWidth: 28, textAlign: "right" }}>{s.val > 0 ? s.val : "—"}</span>
            </div>
          ))}
        </div>
      </ScanlineCard>

      {/* MODULE 02 — Signal Fusion */}
      <ScanlineCard style={{ padding: "16px 16px 14px" }}>
        <ModuleLabel num="02" name="Signal Fusion" />

        {/* Truth Meter */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid rgba(246,246,253,0.06)" }}>
          <TruthMeterArc score={truthScore} />
        </div>

        {/* Fusion metrics 2x2 */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.18em", marginBottom: 8 }}>
            MODALITY FUSION
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <FusionChip label="Hume Affect" value={humeAffect} unit="idx" colorize={true} />
            <FusionChip label="Prosody Stress" value={prosodyStress} unit="idx" colorize={true} />
            <FusionChip label="NLP Evasion" value={nlpEvasion} unit="idx" colorize={true} />
            <FusionChip label="Behavior Drift" value={behaviorDrift} unit="idx" colorize={true} />
          </div>
        </div>

        {/* Truth timeline */}
        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(246,246,253,0.06)", background: "rgba(246,246,253,0.02)" }}>
          <TruthTimeline history={truthHistory} />
        </div>

        {/* Time window stats */}
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
          }}
        >
          {[
            { label: "LAST 30s", value: `${Math.round(truthHistory.slice(-2).reduce((a, b) => a + b, 0) / 2)}`, unit: "ATI" },
            { label: "SIGNALS", value: `${signalCount}`, unit: "ACT" },
            { label: "ATI DRIFT", value: `${truthHistory.length > 1 ? (truthHistory[truthHistory.length - 1] - truthHistory[0]) : 0}`, unit: "pts" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(246,246,253,0.02)",
                border: "1px solid rgba(246,246,253,0.06)",
                borderRadius: 8,
                padding: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 8, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.14em" }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, fontFamily: "'Courier New', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 8, color: C.textFaint, fontFamily: "'Courier New', monospace" }}>{s.unit}</div>
            </div>
          ))}
        </div>

        {/* Transcript */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.18em", marginBottom: 8 }}>
            LIVE TRANSCRIPT
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              maxHeight: 160,
              overflowY: "auto",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(246,246,253,0.06)",
              background: "rgba(246,246,253,0.02)",
            }}
          >
            {DEMO_TRANSCRIPT.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, lineHeight: 1.5 }}>
                <span style={{ color: C.textFaint, fontFamily: "'Courier New', monospace", fontSize: 10, minWidth: 36, flexShrink: 0 }}>
                  [{line.time}]
                </span>
                <span style={{ color: line.speaker === "PROSPECT" ? C.secondary : C.textMuted, fontWeight: 600, fontSize: 10, minWidth: 52, flexShrink: 0 }}>
                  {line.speaker}
                </span>
                <span style={{ color: C.textMuted, flex: 1 }}>
                  {line.text}
                  {line.flag && (
                    <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "rgba(251,191,36,0.15)", color: C.amber, fontSize: 9, fontFamily: "'Courier New', monospace" }}>
                      FLAG: {line.flag}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ScanlineCard>

      {/* MODULE 03 — Operator Intel */}
      <ScanlineCard style={{ padding: "16px 16px 14px" }}>
        <ModuleLabel num="03" name="Operator Intel" />

        {/* Intel cues */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTEL_CUES.map((cue, i) => {
            const dotColor = cue.level === "RED" ? C.red : C.amber;
            return (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${dotColor}22`,
                  background: `${dotColor}08`,
                  display: "flex",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: dotColor,
                    boxShadow: `0 0 6px ${dotColor}`,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.textPrimary,
                      letterSpacing: "0.04em",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Courier New', monospace",
                        fontSize: 9,
                        color: dotColor,
                        marginRight: 5,
                        letterSpacing: "0.1em",
                      }}
                    >
                      [{cue.level}]
                    </span>
                    {cue.title}
                  </div>
                  <div style={{ fontSize: 10, color: C.textFaint, lineHeight: 1.5 }}>{cue.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick text analyzer */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.18em", marginBottom: 8 }}>
            QUICK TEXT SCAN
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste SMS, email, or message..."
            style={{
              width: "100%",
              minHeight: 72,
              borderRadius: 8,
              border: "1px solid rgba(246,246,253,0.12)",
              background: "rgba(2,2,2,0.7)",
              color: C.textPrimary,
              padding: "10px",
              fontSize: 11,
              resize: "vertical",
              fontFamily: C.font,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              onClick={analyzeText}
              disabled={isAnalyzing}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 8,
                border: `1px solid ${C.accent}66`,
                background: `linear-gradient(93.92deg, #8587e3 -13%, #4c4dac 40%, ${C.accent} 113%)`,
                color: C.textPrimary,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: C.font,
                fontWeight: 600,
              }}
            >
              {isAnalyzing ? "SCANNING..." : "ANALYZE"}
            </button>
            <button
              onClick={() => setInputText(SAMPLE_SMS)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(246,246,253,0.12)",
                background: "rgba(246,246,253,0.03)",
                color: C.textFaint,
                fontSize: 10,
                cursor: "pointer",
                fontFamily: C.font,
              }}
            >
              SMS
            </button>
            <button
              onClick={() => setInputText(SAMPLE_EMAIL)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(246,246,253,0.12)",
                background: "rgba(246,246,253,0.03)",
                color: C.textFaint,
                fontSize: 10,
                cursor: "pointer",
                fontFamily: C.font,
              }}
            >
              EMAIL
            </button>
          </div>

          {analysisResult && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Score chips */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {[
                  { label: "Truth", value: `${Math.round(analysisResult.truthScore)}`, color: analysisResult.truthScore > 65 ? C.green : analysisResult.truthScore > 35 ? C.amber : C.red },
                  { label: "Deal Risk", value: `${Math.round(analysisResult.dealRisk)}%`, color: analysisResult.dealRisk > 65 ? C.red : analysisResult.dealRisk > 35 ? C.amber : C.green },
                  { label: "Hedging", value: `${Math.round(analysisResult.hedgePct)}%`, color: C.amber },
                  { label: "Evasion", value: `${Math.round(analysisResult.evasionPct)}%`, color: C.red },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: `1px solid ${m.color}33`,
                      background: `${m.color}0a`,
                    }}
                  >
                    <div style={{ fontSize: 8, color: C.textFaint, fontFamily: "'Courier New', monospace", letterSpacing: "0.12em" }}>{m.label.toUpperCase()}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: "'Courier New', monospace" }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {/* Highlighted text */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(246,246,253,0.08)",
                  background: "rgba(246,246,253,0.02)",
                  fontSize: 10,
                  lineHeight: 1.7,
                  color: C.textMuted,
                  maxHeight: 100,
                  overflowY: "auto",
                }}
                dangerouslySetInnerHTML={{ __html: analysisResult.highlightedHtml }}
              />
              {analysisResult.actionable && (
                <div
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: `1px solid ${C.cyan}33`,
                    background: `${C.cyan}08`,
                    fontSize: 10,
                    color: C.cyan,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 600, fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: "0.1em" }}>ACTION: </span>
                  {analysisResult.actionable}
                </div>
              )}
            </div>
          )}
        </div>
      </ScanlineCard>
    </div>
  );

  // ─── Render: Text Analyzer ──────────────────────────────────────────────────

  const renderTextAnalyzer = () => (
    <ScanlineCard style={{ padding: "24px" }}>
      <ModuleLabel num="04" name="Text Intelligence Analyzer" />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 20 }}>
        <div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste any SMS, email, or message here and hit Analyze."
            style={{
              width: "100%",
              minHeight: 200,
              borderRadius: 12,
              border: "1px solid rgba(246,246,253,0.14)",
              background: "rgba(2,2,2,0.7)",
              color: C.textPrimary,
              padding: "14px",
              fontSize: 13,
              resize: "vertical",
              fontFamily: C.font,
              outline: "none",
            }}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={analyzeText}
              disabled={isAnalyzing}
              style={{
                padding: "10px 28px",
                borderRadius: 40,
                border: "none",
                background: `linear-gradient(93.92deg, #8587e3 -13%, #4c4dac 40%, ${C.accent} 113%)`,
                boxShadow: `0 0 10px ${C.accent}, inset 0 0 2px rgba(255,255,255,0.61)`,
                color: C.textPrimary,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: C.font,
                fontWeight: 600,
              }}
            >
              {isAnalyzing ? "Scanning..." : "Analyze with Aletheia"}
            </button>
            <button
              onClick={() => setInputText(SAMPLE_SMS)}
              style={{
                padding: "8px 16px",
                borderRadius: 40,
                border: "1px solid rgba(246,246,253,0.26)",
                background: "rgba(2,2,2,0.8)",
                color: C.textMuted,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: C.font,
              }}
            >
              Load SMS sample
            </button>
            <button
              onClick={() => setInputText(SAMPLE_EMAIL)}
              style={{
                padding: "8px 16px",
                borderRadius: 40,
                border: "1px solid rgba(246,246,253,0.26)",
                background: "rgba(2,2,2,0.8)",
                color: C.textMuted,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: C.font,
              }}
            >
              Load email sample
            </button>
          </div>
        </div>

        <div>
          {!analysisResult ? (
            <div style={{ fontSize: 12, color: C.textFaint, padding: "4px 2px", lineHeight: 1.8 }}>
              Aletheia will highlight deceptive phrases in{" "}
              <span style={{ color: C.red }}>red</span> and stall language in{" "}
              <span style={{ color: C.amber }}>amber</span>, then suggest counter-moves for your reply.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { label: "Truth Score", value: `${Math.round(analysisResult.truthScore)}`, color: analysisResult.truthScore > 65 ? C.green : analysisResult.truthScore > 35 ? C.amber : C.red },
                  { label: "Hedging", value: `${Math.round(analysisResult.hedgePct)}%`, color: C.amber },
                  { label: "Evasion", value: `${Math.round(analysisResult.evasionPct)}%`, color: C.red },
                  { label: "Urgency", value: analysisResult.urgency, color: C.cyan },
                  { label: "Deal Risk", value: `${Math.round(analysisResult.dealRisk)}%`, color: analysisResult.dealRisk > 65 ? C.red : analysisResult.dealRisk > 35 ? C.amber : C.green },
                  { label: "Ghost Risk", value: analysisResult.ghostRisk ?? "—", color: (analysisResult.ghostRisk ?? "").toUpperCase() === "HIGH" ? C.red : C.amber },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(246,246,253,0.1)",
                      background: "rgba(246,246,253,0.03)",
                      padding: "9px 10px",
                    }}
                  >
                    <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: C.textFaint, marginBottom: 4, fontFamily: "'Courier New', monospace" }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "'Courier New', monospace" }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid rgba(246,246,253,0.14)",
                  background: "rgba(2,2,2,0.7)",
                  padding: "12px",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: C.textMuted,
                }}
                dangerouslySetInnerHTML={{ __html: analysisResult.highlightedHtml }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Intel cues after analysis */}
      {analysisResult && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {analysisResult.hedgeCount > 0 && (
            <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: C.red, boxShadow: `0 0 8px ${C.red}aa`, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>Over-assurance hedging ({analysisResult.hedgeCount})</div>
                <div style={{ color: C.textMuted, marginTop: 2 }}>Phrases like "definitely" and "strong fit" appear often. Genuine buyers rarely stack this much reassurance.</div>
              </div>
            </div>
          )}
          {analysisResult.evasionCount > 0 && (
            <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: C.amber, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500 }}>Stall / delay language ({analysisResult.evasionCount})</div>
                <div style={{ color: C.textMuted, marginTop: 2 }}>References to "next quarter" or "few months" are classic ghosting architecture. Treat this as low intent unless you create a forcing function.</div>
              </div>
            </div>
          )}
          {analysisResult.actionable && (
            <div
              style={{
                marginTop: 4,
                padding: "10px 14px",
                borderRadius: 10,
                border: `1px solid ${C.cyan}33`,
                background: `${C.cyan}08`,
                fontSize: 11,
                color: C.cyan,
                lineHeight: 1.6,
              }}
            >
              <span style={{ fontWeight: 700, fontFamily: "'Courier New', monospace", fontSize: 10, letterSpacing: "0.1em" }}>RECOMMENDED ACTION: </span>
              {analysisResult.actionable}
            </div>
          )}
        </div>
      )}
    </ScanlineCard>
  );

  // ─── Render: Deal Pipeline ──────────────────────────────────────────────────

  const renderPipeline = () => (
    <ScanlineCard style={{ padding: "24px" }}>
      <ModuleLabel num="05" name="Deal Pipeline · Truth-Adjusted" />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["Account", "Value", "Stage", "ATI Score", "Risk", "Trend"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: C.textFaint,
                  borderBottom: "1px solid rgba(246,246,253,0.08)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEALS.map((deal, i) => {
            const riskColor = deal.risk === "HIGH" ? C.red : deal.risk === "LOW" ? C.green : C.amber;
            const atiColor = deal.truthAdj > 65 ? C.green : deal.truthAdj > 35 ? C.amber : C.red;
            return (
              <tr
                key={i}
                style={{
                  borderBottom: "1px solid rgba(246,246,253,0.04)",
                }}
              >
                <td style={{ padding: "12px 12px", color: C.textPrimary, fontWeight: 500 }}>{deal.name}</td>
                <td style={{ padding: "12px 12px", color: C.textMuted, fontFamily: "'Courier New', monospace" }}>{deal.value}</td>
                <td style={{ padding: "12px 12px", color: C.textFaint, fontSize: 11 }}>{deal.stage}</td>
                <td style={{ padding: "12px 12px" }}>
                  <span
                    style={{
                      color: atiColor,
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 700,
                      textShadow: `0 0 8px ${atiColor}66`,
                    }}
                  >
                    {deal.truthAdj}
                  </span>
                </td>
                <td style={{ padding: "12px 12px" }}>
                  <span
                    style={{
                      padding: "2px 9px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      background: `${riskColor}18`,
                      border: `1px solid ${riskColor}55`,
                      color: riskColor,
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {deal.risk}
                  </span>
                </td>
                <td style={{ padding: "12px 12px" }}>
                  {deal.trend === "up" ? (
                    <TrendingUp size={14} color={C.green} />
                  ) : deal.trend === "down" ? (
                    <TrendingDown size={14} color={C.red} />
                  ) : (
                    <span style={{ color: C.textFaint, fontSize: 10 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScanlineCard>
  );

  // ─── Render: Playbook ──────────────────────────────────────────────────────

  const renderPlaybook = () => (
    <ScanlineCard style={{ padding: "24px" }}>
      <ModuleLabel num="06" name="Strategic Playbook" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {PLAYBOOK_TACTICS.map((tactic, i) => (
          <div
            key={i}
            style={{
              padding: "16px",
              borderRadius: 12,
              border: `1px solid ${tactic.color}33`,
              background: `${tactic.color}08`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: tactic.color,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "'Courier New', monospace",
                marginBottom: 6,
              }}
            >
              {tactic.name}
            </div>
            <div style={{ fontSize: 10, color: C.textFaint, marginBottom: 10, lineHeight: 1.5 }}>
              <span style={{ color: C.textMuted }}>Trigger: </span>{tactic.trigger}
            </div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(246,246,253,0.08)",
                background: "rgba(246,246,253,0.03)",
                fontSize: 11,
                lineHeight: 1.6,
                color: C.textMuted,
                fontStyle: "italic",
              }}
            >
              "{tactic.script}"
            </div>
          </div>
        ))}
      </div>
    </ScanlineCard>
  );

  // ─── Render: History ──────────────────────────────────────────────────────

  const renderHistory = () => (
    <ScanlineCard style={{ padding: "24px" }}>
      <ModuleLabel num="07" name="Session History" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { time: "Today 14:22", subject: "PROSPECT-001", duration: "12:34", ati: 34, risk: "HIGH", flags: 4 },
          { time: "Today 11:05", subject: "PROSPECT-002", duration: "08:17", ati: 67, risk: "MEDIUM", flags: 1 },
          { time: "Yesterday 16:40", subject: "PROSPECT-003", duration: "21:02", ati: 82, risk: "LOW", flags: 0 },
          { time: "Yesterday 10:15", subject: "PROSPECT-004", duration: "15:44", ati: 41, risk: "HIGH", flags: 3 },
          { time: "3 days ago", subject: "PROSPECT-005", duration: "06:58", ati: 74, risk: "LOW", flags: 0 },
        ].map((session, i) => {
          const riskColor = session.risk === "HIGH" ? C.red : session.risk === "LOW" ? C.green : C.amber;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(246,246,253,0.06)",
                background: "rgba(246,246,253,0.02)",
              }}
            >
              <div style={{ fontSize: 11, color: C.textFaint, fontFamily: "'Courier New', monospace", minWidth: 120 }}>{session.time}</div>
              <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500, flex: 1 }}>{session.subject}</div>
              <div style={{ fontSize: 11, color: C.textFaint, fontFamily: "'Courier New', monospace", minWidth: 50 }}>{session.duration}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color: riskColor, minWidth: 32 }}>{session.ati}</div>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  background: `${riskColor}18`,
                  border: `1px solid ${riskColor}55`,
                  color: riskColor,
                  fontFamily: "'Courier New', monospace",
                }}
              >
                {session.risk}
              </span>
              <div style={{ fontSize: 10, color: session.flags > 0 ? C.amber : C.textFaint, fontFamily: "'Courier New', monospace" }}>
                {session.flags} flags
              </div>
            </div>
          );
        })}
      </div>
    </ScanlineCard>
  );

  // ─── Page render ─────────────────────────────────────────────────────────

  return (
    <div
      className="atom-page"
      style={{
        minHeight: "100vh",
        fontFamily: C.font,
        background: `radial-gradient(circle at top, ${C.primary}33 0, ${C.bg} 55%, ${C.bg} 100%)`,
        color: C.textPrimary,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Nav ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(24px)",
          background: `linear-gradient(to bottom, rgba(2,2,2,0.92), rgba(2,2,2,0.7), transparent)`,
          borderBottom: `1px solid rgba(246,246,253,0.08)`,
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            padding: "12px 30px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: `radial-gradient(circle at 30% 0%, #e3e3f8, ${C.accent} 42%, #020202 100%)`,
                boxShadow: `0 0 24px ${C.accent}aa`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em" }}>A</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 14, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>ATOM Aletheia</div>
              <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: "0.16em", textTransform: "uppercase" }}>Truth &amp; Intent Engine</div>
            </div>
          </div>

          {/* Channel pills */}
          <div style={{ display: "flex", gap: 6, marginLeft: 20 }}>
            {(["VIDEO", "VOICE", "TEXT-SMS", "EMAIL"] as ChannelId[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                style={activeChannel === ch ? chipActive : chipBase}
              >
                {ch === "VIDEO" && <Video size={10} style={{ display: "inline", marginRight: 4 }} />}
                {ch === "VOICE" && <Mic size={10} style={{ display: "inline", marginRight: 4 }} />}
                {ch === "TEXT-SMS" && <MessageSquare size={10} style={{ display: "inline", marginRight: 4 }} />}
                {ch === "EMAIL" && <Mail size={10} style={{ display: "inline", marginRight: 4 }} />}
                {ch}
              </button>
            ))}
          </div>

          {/* REC button */}
          <button
            onClick={toggleCamera}
            className={isRecording ? "rec-pulse" : ""}
            style={{
              marginLeft: "auto",
              padding: "7px 18px",
              borderRadius: 999,
              border: `1px solid ${isRecording ? C.red + "88" : "rgba(246,246,253,0.2)"}`,
              background: isRecording ? `rgba(248,113,113,0.15)` : "rgba(246,246,253,0.04)",
              color: isRecording ? C.red : C.textMuted,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: C.font,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: isRecording ? C.red : "rgba(246,246,253,0.3)",
                display: "inline-block",
              }}
            />
            REC
          </button>
        </div>

        {/* HUD bar */}
        <div
          style={{
            borderTop: "1px solid rgba(246,246,253,0.05)",
            background: "rgba(2,2,2,0.5)",
            padding: "6px 30px",
          }}
        >
          <div
            style={{
              maxWidth: 1500,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              fontFamily: "'Courier New', monospace",
              fontSize: 10,
            }}
          >
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ color: C.textFaint }}>STATUS</span>
              <span style={{ color: isRecording ? C.green : C.amber }}>
                <span
                  className={isRecording ? "blink-dot" : ""}
                  style={{ width: 5, height: 5, borderRadius: 999, background: isRecording ? C.green : C.amber, display: "inline-block", marginRight: 5 }}
                />
                {isRecording ? "LIVE SCAN" : "STANDBY"}
              </span>
              <span style={{ color: C.textFaint }}>SESSION</span>
              <span style={{ color: C.textMuted }}>{formatTime(sessionTime)}</span>
              <span style={{ color: C.textFaint }}>ATI</span>
              <span style={{ color: truthScore < 40 ? C.red : truthScore < 70 ? C.amber : C.green, fontWeight: 700 }}>{truthScore}</span>
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
              <span style={{ color: C.textFaint }}>MODELS</span>
              <span style={{ color: C.textMuted }}>Hume · GPT‑4o · Prosody</span>
              <span style={{ color: C.textFaint }}>SIGNALS</span>
              <span style={{ color: C.secondary }}>{signalCount} ACT</span>
            </div>
            <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
              <span style={{ color: C.textFaint }}>CHANNEL</span>
              <span style={{ color: C.cyan }}>{activeChannel}</span>
              <span style={{ color: C.textFaint }}>THREAT</span>
              <span style={{ color: threatColor, fontWeight: 700 }}>{threatLevel}</span>
              <span style={{ color: C.textFaint }}>SUBJECT</span>
              <span style={{ color: C.textMuted }}>PROSPECT-001</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: 1500,
          margin: "0 auto",
          padding: "24px 30px 80px",
          width: "100%",
        }}
      >
        {activeTab === "live" && renderLiveSession()}
        {activeTab === "text" && renderTextAnalyzer()}
        {activeTab === "pipeline" && renderPipeline()}
        {activeTab === "playbook" && renderPlaybook()}
        {activeTab === "history" && renderHistory()}
      </main>

      {/* ── Sub-tabs bar (bottom) ─────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          backdropFilter: "blur(20px)",
          background: "rgba(2,2,2,0.88)",
          borderTop: `1px solid rgba(246,246,253,0.08)`,
          padding: "10px 30px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflowX: "auto",
        }}
      >
        {([
          { id: "live", label: "Live Session", icon: <Radio size={12} /> },
          { id: "text", label: "Text Analyzer", icon: <FileText size={12} /> },
          { id: "pipeline", label: "Deal Pipeline", icon: <BarChart3 size={12} /> },
          { id: "playbook", label: "Playbook", icon: <Target size={12} /> },
          { id: "history", label: "History", icon: <History size={12} /> },
        ] as { id: TabId; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={activeTab === tab.id ? subTabActive : subTabBase}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}

        <div
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: C.textFaint,
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.1em",
            flexShrink: 0,
          }}
        >
          ATOM · Nirmata Holdings · © 2026
        </div>
      </div>
    </div>
  );
}
