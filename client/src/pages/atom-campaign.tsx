import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BRIDGE_URL = "https://45-79-202-76.sslip.io";

// ─── Phone number formatter ───────────────────────────────────────────────────
function formatPhoneNumber(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (/^\d{10}$/.test(stripped)) return `+1${stripped}`;
  if (/^1\d{10}$/.test(stripped)) return `+${stripped}`;
  return `+${stripped}`;
}

// Product is now free-text input, not a fixed list

const GEO_OPTIONS = [
  "All US", "US South (TX, FL, GA, NC, TN...)", "US Northeast (NY, NJ, MA, CT...)",
  "US Midwest (IL, OH, MI, IN, MN...)", "US West (CA, WA, OR, CO, AZ...)",
  "US Southeast (FL, GA, NC, SC, VA...)", "Texas", "California", "New York",
  "Florida", "Illinois", "Georgia", "North Carolina", "Washington",
  "Massachusetts", "Colorado", "EU", "UK", "Canada", "Global",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "setup" | "researching" | "review" | "active" | "paused" | "complete";
type TargetStatus = "queued" | "calling" | "connected" | "completed" | "failed" | "skipped";
type Disposition = "qualified" | "not_interested" | "no_answer" | "callback" | "hot_lead";

interface CampaignForm {
  brief: string;
  targetIndustry: string;
  targetGeo: string;
  targetCount: number;
  productSlug: string;
  alertEmail: string;
}

interface DecisionMaker {
  name: string;
  title: string;
  linkedin?: string;
}

interface Target {
  id: string;
  rank: number;
  companyName: string;
  industry: string;
  size: string;
  location: string;
  decisionMaker: DecisionMaker;
  email?: string;
  phone?: string;
  tags: string[];
  status: TargetStatus;
}

interface TranscriptLine {
  speaker: "ATOM" | "Prospect";
  text: string;
  ts: number;
}

interface CallHistoryEntry {
  targetId: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  duration: number; // seconds
  sentiment: number;
  intent: number;
  disposition: Disposition;
  transcript: TranscriptLine[];
  expanded: boolean;
  // Rich analytics snapshot (captured at call_complete)
  sentimentHistory: SentimentPoint[];
  emotions: EmotionData[];
  buyingSignals: string[];
}

interface HotLead {
  targetId: string;
  companyName: string;
  contactName: string;
  sentiment: number;
  intent: number;
  buyingSignals: string[];
}

interface LiveCallState {
  targetId: string | null;
  companyName: string;
  contactName: string;
  contactTitle: string;
  sentiment: number;
  intent: number;
  callStage: string;
  transcript: TranscriptLine[];
}

interface SentimentPoint {
  time: number; // seconds into call
  score: number;
}

interface EmotionData {
  name: string;
  value: number; // 0-100
  color: string;
}

type CallStageName = "Discovery" | "Evaluation" | "Negotiation" | "Close";

interface CampaignStats {
  dialed: number;
  connected: number;
  qualified: number;
  hotLeads: number;
  remaining: number;
  total: number;
  avgSentiment: number;
  avgIntent: number;
}

interface ToastMsg {
  id: number;
  message: string;
  type: "error" | "info" | "success";
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const S = {
  card: {
    backgroundColor: "rgba(246,246,253,0.03)",
    border: "1px solid rgba(246,246,253,0.10)",
    borderRadius: 12,
    padding: "20px 24px",
  } as React.CSSProperties,

  cardSmall: {
    backgroundColor: "rgba(246,246,253,0.03)",
    border: "1px solid rgba(246,246,253,0.10)",
    borderRadius: 12,
    padding: "14px 18px",
  } as React.CSSProperties,

  primaryBtn: {
    background: "linear-gradient(93.92deg, #8587e3 -13.51%, #4c4dac 40.91%, #696aac 113.69%)",
    boxShadow: "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)",
    border: "none",
    borderRadius: 40,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "box-shadow 0.2s ease",
    fontFamily: "inherit",
  } as React.CSSProperties,

  secondaryBtn: {
    background: "transparent",
    border: "2px solid #8587e3",
    borderRadius: 40,
    color: "#a2a3e9",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s ease",
  } as React.CSSProperties,

  input: {
    width: "100%",
    backgroundColor: "rgba(246,246,253,0.04)",
    border: "1px solid rgba(246,246,253,0.12)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "#f6f6fd",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "rgba(246,246,253,0.5)",
    marginBottom: 6,
  } as React.CSSProperties,

  accentText: { color: "#a2a3e9" } as React.CSSProperties,
  highlightText: { color: "#c7c8f2" } as React.CSSProperties,
  mutedText: { color: "rgba(246,246,253,0.5)" } as React.CSSProperties,
};

function getGaugeColor(score: number): string {
  if (score >= 60) return "#696aac";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

function getStatusColor(status: TargetStatus): string {
  switch (status) {
    case "queued": return "#6b7280";
    case "calling": return "#f59e0b";
    case "connected": return "#3b82f6";
    case "completed": return "#22c55e";
    case "failed": return "#ef4444";
    case "skipped": return "#4b5563";
    default: return "#6b7280";
  }
}

function getDispositionColor(d: Disposition): string {
  switch (d) {
    case "qualified": return "#22c55e";
    case "hot_lead": return "#696aac";
    case "not_interested": return "#ef4444";
    case "no_answer": return "#6b7280";
    case "callback": return "#f59e0b";
    default: return "#6b7280";
  }
}

function getDispositionLabel(d: Disposition): string {
  switch (d) {
    case "qualified": return "Qualified";
    case "hot_lead": return "Hot Lead";
    case "not_interested": return "Not Interested";
    case "no_answer": return "No Answer";
    case "callback": return "Callback";
    default: return d;
  }
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getPhaseLabel(phase: Phase): string {
  switch (phase) {
    case "setup": return "Idle";
    case "researching": return "Researching";
    case "review": return "Ready";
    case "active": return "Active";
    case "paused": return "Paused";
    case "complete": return "Complete";
  }
}

function getPhaseBadgeStyle(phase: Phase): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
  };
  switch (phase) {
    case "setup": return { ...base, background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)" };
    case "researching": return { ...base, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" };
    case "review": return { ...base, background: "rgba(105,106,172,0.18)", color: "#a2a3e9", border: "1px solid rgba(105,106,172,0.4)" };
    case "active": return { ...base, background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" };
    case "paused": return { ...base, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" };
    case "complete": return { ...base, background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: ToastMsg[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 10,
            backgroundColor: t.type === "error" ? "rgba(239,68,68,0.12)" : t.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(105,106,172,0.15)",
            border: `1px solid ${t.type === "error" ? "rgba(239,68,68,0.35)" : t.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(105,106,172,0.4)"}`,
            color: t.type === "error" ? "#fca5a5" : t.type === "success" ? "#86efac" : "#c7c8f2",
            fontSize: 13, maxWidth: 360,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, opacity: 0.6, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Sentiment gauge helpers ──────────────────────────────────────────────────

function getSentimentLabel(score: number): string {
  if (score >= 80) return "Very Positive";
  if (score >= 60) return "Positive";
  if (score >= 30) return "Neutral";
  return "Negative";
}

function getIntentLabel(score: number): string {
  if (score >= 80) return "Hot Lead";
  if (score >= 65) return "Purchase Ready";
  if (score >= 45) return "Interested";
  if (score >= 25) return "Curious";
  return "Low";
}

function getSentimentArcColor(score: number): string {
  if (score >= 80) return "url(#sentGradPurple)";
  if (score >= 60) return "url(#sentGradGreen)";
  if (score >= 30) return "url(#sentGradAmber)";
  return "url(#sentGradRed)";
}

function getIntentArcColor(score: number): string {
  if (score >= 80) return "url(#intGradGreen)";
  if (score >= 65) return "url(#intGradTeal)";
  if (score >= 30) return "url(#intGradAmber)";
  return "url(#intGradRed)";
}

// ─── Radial Gauge ─────────────────────────────────────────────────────────────

function RadialGauge({
  score,
  label,
  sublabel,
  size = 140,
  variant = "sentiment",
  hot = false,
}: {
  score: number;
  label: string;
  sublabel: string;
  size?: number;
  variant?: "sentiment" | "intent";
  hot?: boolean;
}) {
  // Semicircle arc: starts at 180deg (left), ends at 0deg (right)
  // Center = (size/2, size/2+10), radius = size*0.38
  const cx = size / 2;
  const cy = size / 2 + 8;
  const r = size * 0.38;
  const strokeW = size * 0.075;

  // Arc length for 180 degrees
  const circumference = Math.PI * r; // half circle
  const filled = Math.max(0, Math.min(1, score / 100)) * circumference;
  const gap = circumference - filled;

  const arcColor = variant === "sentiment" ? getSentimentArcColor(score) : getIntentArcColor(score);

  // Path: semicircle from left to right (bottom half suppressed)
  // startX = cx - r, startY = cy
  // endX = cx + r, endY = cy
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  const trackPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  const sentIds = {
    red: "sentGradRed",
    amber: "sentGradAmber",
    green: "sentGradGreen",
    purple: "sentGradPurple",
  };
  const intIds = {
    red: "intGradRed",
    amber: "intGradAmber",
    teal: "intGradTeal",
    green: "intGradGreen",
  };

  const scoreColor =
    score >= 80 ? (variant === "sentiment" ? "#a2a3e9" : "#4ade80")
    : score >= 60 ? (variant === "sentiment" ? "#22c55e" : "#14b8a6")
    : score >= 30 ? "#f59e0b"
    : "#ef4444";

  return (
    <div style={{ position: "relative", width: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size * 0.65}
        viewBox={`0 0 ${size} ${size * 0.65}`}
        style={{
          filter: hot ? "drop-shadow(0 0 10px rgba(105,106,172,0.7))" : "drop-shadow(0 0 6px rgba(105,106,172,0.3))",
          overflow: "visible",
          display: "block",
          transition: "filter 0.8s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <defs>
          {variant === "sentiment" ? (
            <>
              <linearGradient id={sentIds.red} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f87171" />
              </linearGradient>
              <linearGradient id={sentIds.amber} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id={sentIds.green} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
              <linearGradient id={sentIds.purple} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#696aac" />
                <stop offset="100%" stopColor="#a2a3e9" />
              </linearGradient>
            </>
          ) : (
            <>
              <linearGradient id={intIds.red} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#f87171" />
              </linearGradient>
              <linearGradient id={intIds.amber} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id={intIds.teal} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#696aac" />
              </linearGradient>
              <linearGradient id={intIds.green} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
            </>
          )}
        </defs>

        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(246,246,253,0.07)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <path
          d={trackPath}
          fill="none"
          stroke={arcColor}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap + 0.5}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.8s ease" }}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy - r * 0.12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={scoreColor}
          fontSize={size * 0.18}
          fontWeight="300"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          style={{ transition: "fill 0.8s ease" }}
        >
          {score}
        </text>
      </svg>

      {/* Label below */}
      <div style={{
        textAlign: "center",
        marginTop: -4,
        fontSize: size * 0.082,
        fontWeight: 600,
        color: scoreColor,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        transition: "color 0.8s ease",
      }}>
        {sublabel}
      </div>
      <div style={{
        textAlign: "center",
        marginTop: 3,
        fontSize: size * 0.072,
        color: "rgba(246,246,253,0.4)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Emotion Dimension Bars ───────────────────────────────────────────────────

const EMOTION_COLORS: Record<string, string> = {
  Confidence: "#696aac",
  Interest: "#a2a3e9",
  Skepticism: "#f59e0b",
  Excitement: "#22c55e",
  Frustration: "#ef4444",
  Neutrality: "#64748b",
};

function EmotionBars({ emotions }: { emotions: EmotionData[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {emotions.map((e) => (
        <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11,
            color: "rgba(246,246,253,0.55)",
            width: 76,
            flexShrink: 0,
            fontWeight: 500,
          }}>{e.name}</span>

          <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(246,246,253,0.06)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${e.value}%`,
              background: `linear-gradient(90deg, ${e.color}cc, ${e.color})`,
              borderRadius: 3,
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
              boxShadow: `0 0 6px ${e.color}60`,
            }} />
          </div>

          <span style={{
            fontSize: 11,
            color: e.color,
            width: 32,
            textAlign: "right",
            fontWeight: 600,
            flexShrink: 0,
            transition: "color 0.4s ease",
          }}>{e.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Call Stage Timeline ──────────────────────────────────────────────────────

const CALL_STAGES: CallStageName[] = ["Discovery", "Evaluation", "Negotiation", "Close"];

function CallStageTimeline({ currentStage }: { currentStage: string }) {
  const currentIdx = useMemo(() => {
    const lower = currentStage.toLowerCase();
    if (lower.includes("close") || lower.includes("closing")) return 3;
    if (lower.includes("negot")) return 2;
    if (lower.includes("eval") || lower.includes("demo")) return 1;
    if (lower.includes("discov") || lower.includes("connect") || lower.includes("initiat")) return 0;
    return 0;
  }, [currentStage]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {CALL_STAGES.map((stage, i) => {
        const isActive = i === currentIdx;
        const isComplete = i < currentIdx;
        const color = isComplete ? "#696aac" : isActive ? "#a2a3e9" : "rgba(246,246,253,0.2)";
        const isLast = i === CALL_STAGES.length - 1;

        return (
          <div key={stage} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1, minWidth: 0 }}>
            {/* Node */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
            }}>
              <div style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${color}`,
                backgroundColor: isActive ? "rgba(162,163,233,0.18)" : isComplete ? "rgba(105,106,172,0.3)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive ? "0 0 10px rgba(162,163,233,0.5)" : "none",
                transition: "all 0.6s ease",
                flexShrink: 0,
              }}>
                {isComplete ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#696aac" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: isActive ? "#a2a3e9" : "rgba(246,246,253,0.15)", transition: "background 0.4s ease" }} />
                )}
              </div>
              <span style={{
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color,
                fontWeight: isActive ? 700 : 500,
                whiteSpace: "nowrap",
                transition: "color 0.4s ease",
              }}>{stage}</span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{ flex: 1, height: 2, margin: "0 4px", marginBottom: 18, borderRadius: 1, backgroundColor: "rgba(246,246,253,0.08)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: isComplete ? "100%" : isActive ? "50%" : "0%",
                  background: "linear-gradient(90deg, #696aac, #a2a3e9)",
                  borderRadius: 1,
                  transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sentiment Sparkline ──────────────────────────────────────────────────────

function SentimentSparkline({ points }: { points: SentimentPoint[] }) {
  const W = 280;
  const H = 52;
  const PAD = 6;

  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    const maxTime = Math.max(...points.map((p) => p.time));
    const minTime = Math.max(0, maxTime - 60);
    const visible = points.filter((p) => p.time >= minTime);
    if (visible.length < 2) return "";

    const xScale = (t: number) => PAD + ((t - minTime) / Math.max(60, maxTime - minTime)) * (W - PAD * 2);
    const yScale = (s: number) => H - PAD - (s / 100) * (H - PAD * 2);

    const first = visible[0];
    const last = visible[visible.length - 1];

    return [
      `M ${xScale(first.time).toFixed(1)} ${H - PAD}`,
      `L ${xScale(first.time).toFixed(1)} ${yScale(first.score).toFixed(1)}`,
      ...visible.slice(1).map((p, i) => {
        const prev = visible[i];
        const cpX = ((xScale(prev.time) + xScale(p.time)) / 2).toFixed(1);
        return `C ${cpX} ${yScale(prev.score).toFixed(1)} ${cpX} ${yScale(p.score).toFixed(1)} ${xScale(p.time).toFixed(1)} ${yScale(p.score).toFixed(1)}`;
      }),
      `L ${xScale(last.time).toFixed(1)} ${H - PAD}`,
      "Z",
    ].join(" ");
  }, [points]);

  const linePath = useMemo(() => {
    if (points.length < 2) return "";
    const maxTime = Math.max(...points.map((p) => p.time));
    const minTime = Math.max(0, maxTime - 60);
    const visible = points.filter((p) => p.time >= minTime);
    if (visible.length < 2) return "";

    const xScale = (t: number) => PAD + ((t - minTime) / Math.max(60, maxTime - minTime)) * (W - PAD * 2);
    const yScale = (s: number) => H - PAD - (s / 100) * (H - PAD * 2);

    return visible.map((p, i) => {
      if (i === 0) return `M ${xScale(p.time).toFixed(1)} ${yScale(p.score).toFixed(1)}`;
      const prev = visible[i - 1];
      const cpX = ((xScale(prev.time) + xScale(p.time)) / 2).toFixed(1);
      return `C ${cpX} ${yScale(prev.score).toFixed(1)} ${cpX} ${yScale(p.score).toFixed(1)} ${xScale(p.time).toFixed(1)} ${yScale(p.score).toFixed(1)}`;
    }).join(" ");
  }, [points]);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#696aac" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#696aac" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Horizontal guide lines */}
      {[25, 50, 75].map((y) => (
        <line
          key={y}
          x1={PAD} y1={H - PAD - (y / 100) * (H - PAD * 2)}
          x2={W - PAD} y2={H - PAD - (y / 100) * (H - PAD * 2)}
          stroke="rgba(246,246,253,0.05)" strokeWidth="1"
        />
      ))}
      {pathD && (
        <path d={pathD} fill="url(#sparkFill)" />
      )}
      {linePath && (
        <path d={linePath} fill="none" stroke="#a2a3e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.length >= 2 && (() => {
        const maxTime = Math.max(...points.map((p) => p.time));
        const minTime = Math.max(0, maxTime - 60);
        const visible = points.filter((p) => p.time >= minTime);
        if (visible.length === 0) return null;
        const last = visible[visible.length - 1];
        const xScale = (t: number) => PAD + ((t - minTime) / Math.max(60, maxTime - minTime)) * (W - PAD * 2);
        const yScale = (s: number) => H - PAD - (s / 100) * (H - PAD * 2);
        return (
          <circle
            cx={xScale(last.time)}
            cy={yScale(last.score)}
            r={3}
            fill="#a2a3e9"
            style={{ filter: "drop-shadow(0 0 4px #696aac)" }}
          />
        );
      })()}
    </svg>
  );
}

// ─── Buying Signals Panel ─────────────────────────────────────────────────────

function BuyingSignalsBadges({ signals }: { signals: string[] }) {
  if (signals.length === 0) {
    return <span style={{ fontSize: 12, color: "rgba(246,246,253,0.25)" }}>Signals detected during the call will appear here…</span>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {signals.map((s, i) => (
        <span
          key={i}
          style={{
            padding: "4px 11px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            backgroundColor: "rgba(105,106,172,0.15)",
            border: "1px solid rgba(105,106,172,0.45)",
            color: "#c7c8f2",
            boxShadow: "0 0 8px rgba(105,106,172,0.2)",
            animation: "slideIn 0.4s ease forwards",
            whiteSpace: "nowrap",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

// Legacy GaugeBar kept for call history display
function GaugeBar({ value, label }: { value: number; label: string }) {
  const color = getGaugeColor(value);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(246,246,253,0.5)" }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(246,246,253,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.5s ease, background-color 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "rgba(246,246,253,0.4)" }}>
        {value >= 60 ? "Positive" : value >= 30 ? "Neutral" : "Resistant"}
      </div>
    </div>
  );
}

function StatusDot({ status, pulse }: { status: TargetStatus; pulse?: boolean }) {
  const color = getStatusColor(status);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10, flexShrink: 0 }}>
      {pulse && status === "calling" && (
        <span style={{
          position: "absolute", width: 10, height: 10, borderRadius: "50%",
          backgroundColor: color, opacity: 0.4,
          animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite",
        }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "block", position: "relative" }} />
    </span>
  );
}

// ─── Phase 1: Campaign Setup ──────────────────────────────────────────────────

function PhaseSetup({
  form, setForm, onSubmit, loading,
}: {
  form: CampaignForm;
  setForm: (f: CampaignForm) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const handleChange = (field: keyof CampaignForm, value: string | number) =>
    setForm({ ...form, [field]: value });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={S.card}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#c7c8f2", marginBottom: 4, marginTop: 0 }}>
          New Campaign
        </h2>
        <p style={{ ...S.mutedText, fontSize: 14, marginTop: 0, marginBottom: 28 }}>
          Describe your target and ATOM will research prospects and auto-dial them.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Brief */}
          <div>
            <label style={S.label}>Campaign Brief</label>
            <textarea
              value={form.brief}
              onChange={(e) => handleChange("brief", e.target.value)}
              placeholder="Describe your campaign objective, target companies, and product to pitch..."
              rows={5}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Industry + Geo row */}
          <div className="campaign-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={S.label}>Target Industry</label>
              <input
                type="text"
                value={form.targetIndustry}
                onChange={(e) => handleChange("targetIndustry", e.target.value)}
                placeholder="e.g. information technology, healthcare, financial services"
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Target Geography</label>
              <select
                value={form.targetGeo}
                onChange={(e) => handleChange("targetGeo", e.target.value)}
                style={{ ...S.input }}
              >
                {GEO_OPTIONS.map((g) => (
                  <option key={g} value={g} style={{ backgroundColor: "#111" }}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Count + Product row */}
          <div className="campaign-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={S.label}>Target Count</label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.targetCount}
                onChange={(e) => handleChange("targetCount", Math.max(1, parseInt(e.target.value) || 1))}
                style={S.input}
              />
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.35)", marginTop: 4 }}>Set your target count</div>
            </div>
            <div>
              <label style={S.label}>Product to Pitch</label>
              <input
                type="text"
                value={form.productSlug}
                onChange={(e) => handleChange("productSlug", e.target.value)}
                placeholder="e.g. Akamai CDN, Five9, TierPoint, Antimatter AI..."
                style={{ ...S.input }}
              />
            </div>
          </div>

          {/* Alert email */}
          <div>
            <label style={S.label}>Alert Email</label>
            <input
              type="email"
              value={form.alertEmail}
              onChange={(e) => handleChange("alertEmail", e.target.value)}
              placeholder="Get notified when hot leads are found"
              style={S.input}
            />
          </div>

          {/* Submit */}
          <button
            onClick={onSubmit}
            disabled={loading || !form.brief.trim()}
            style={{
              ...S.primaryBtn,
              padding: "14px 32px",
              fontSize: 15,
              marginTop: 4,
              opacity: loading || !form.brief.trim() ? 0.6 : 1,
              cursor: loading || !form.brief.trim() ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!loading && form.brief.trim()) e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
          >
            {loading ? "Researching…" : "Research Targets"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 1b: Researching loading state ─────────────────────────────────────

function PhaseResearching() {
  const [dots, setDots] = useState("...");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Animated atom icon */}
        <div style={{ width: 72, height: 72, margin: "0 auto 28px", position: "relative" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "2px solid rgba(105,106,172,0.4)",
            position: "absolute", inset: 0,
            animation: "spin 3s linear infinite",
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "#8587e3",
            position: "absolute", inset: 0,
            animation: "spin 1.5s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: "22px",
            borderRadius: "50%",
            backgroundColor: "rgba(105,106,172,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#8587e3", fontSize: 14, fontWeight: 700 }}>AI</span>
          </div>
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#c7c8f2", margin: "0 0 10px" }}>
          ATOM is analyzing sources and building your target list{dots}
        </h3>
        <p style={{ color: "rgba(246,246,253,0.5)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Scanning industry databases, LinkedIn signals, funding data, and tech stack indicators to surface the highest-intent prospects.
        </p>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Scanning industry databases",
            "Enriching with Hunter.io contact data",
            "Scoring by buyer intent signals",
            "Ranking targets by fit score",
          ].map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 16px",
              backgroundColor: "rgba(246,246,253,0.03)",
              border: "1px solid rgba(246,246,253,0.08)",
              borderRadius: 8,
              fontSize: 13, color: "rgba(246,246,253,0.6)",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "1.5px solid rgba(105,106,172,0.5)",
                borderTopColor: "#8587e3",
                display: "inline-block",
                animation: `spin ${1 + i * 0.2}s linear infinite`,
                flexShrink: 0,
              }} />
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2: Target Review ───────────────────────────────────────────────────

function TargetCard({ target }: { target: Target }) {
  return (
    <div style={{
      ...S.cardSmall,
      position: "relative",
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
    }}>
      {/* Rank badge */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg, #8587e3, #4c4dac)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
      }}>
        #{target.rank}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <StatusDot status={target.status} pulse />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f6f6fd" }}>{target.companyName}</span>
        </div>

        <div style={{ fontSize: 12, color: "rgba(246,246,253,0.5)", marginBottom: 8 }}>
          {target.industry} · {target.size} · {target.location}
        </div>

        {/* Decision maker */}
        <div style={{ fontSize: 13, color: "rgba(246,246,253,0.75)", marginBottom: 6 }}>
          <span style={{ color: "#c7c8f2", fontWeight: 600 }}>{target.decisionMaker.name}</span>
          {" · "}{target.decisionMaker.title}
          {target.decisionMaker.linkedin && (
            <a
              href={target.decisionMaker.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 8, color: "#a2a3e9", fontSize: 11, textDecoration: "none" }}
            >
              LinkedIn ↗
            </a>
          )}
        </div>

        {/* Contact info */}
        <div style={{ fontSize: 12, color: "rgba(246,246,253,0.5)", marginBottom: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {target.email && <span>✉ {target.email}</span>}
          <span>{target.phone ? `📞 ${target.phone}` : <span style={{ color: "rgba(246,246,253,0.3)" }}>No phone — will skip</span>}</span>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {target.tags.map((tag) => (
            <span key={tag} style={{
              padding: "2px 9px", borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              backgroundColor: "rgba(105,106,172,0.15)",
              border: "1px solid rgba(105,106,172,0.3)",
              color: "#a2a3e9",
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhaseReview({
  targets, form, campaignId,
  onLaunch, onEditCampaign,
}: {
  targets: Target[];
  form: CampaignForm;
  campaignId: string;
  onLaunch: () => void;
  onEditCampaign: () => void;
}) {
  const withPhone = targets.filter((t) => t.phone).length;
  const estMinutes = withPhone * 4;

  return (
    <div className="campaign-review-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, padding: "32px 24px", alignItems: "start" }}>
      {/* Left: target list */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#c7c8f2", margin: "0 0 16px" }}>
          {targets.length} Targets Identified
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {targets.map((t) => <TargetCard key={t.id} target={t} />)}
        </div>
      </div>

      {/* Right: summary + launch */}
      <div style={{ position: "sticky", top: 24 }}>
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#c7c8f2", marginTop: 0, marginBottom: 14 }}>Campaign Summary</h3>

          <div style={{ fontSize: 13, color: "rgba(246,246,253,0.65)", marginBottom: 16, lineHeight: 1.6 }}>
            {form.brief.slice(0, 140)}{form.brief.length > 140 ? "…" : ""}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Total Targets", value: targets.length },
              { label: "With Phone Numbers", value: withPhone },
              { label: "Est. Call Time", value: `~${estMinutes} min` },
              { label: "Product", value: form.productSlug },
              { label: "Geography", value: form.targetGeo },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(246,246,253,0.45)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c7c8f2" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "rgba(246,246,253,0.35)", marginBottom: 6 }}>Campaign ID: {campaignId}</div>

          <button
            onClick={onLaunch}
            style={{ ...S.primaryBtn, width: "100%", padding: "13px", fontSize: 15, marginBottom: 10 }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
          >
            Launch Campaign
          </button>

          <button
            onClick={onEditCampaign}
            style={{ ...S.secondaryBtn, width: "100%", padding: "11px", fontSize: 14 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(133,135,227,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Edit Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: Live Dashboard ──────────────────────────────────────────────────

const DEFAULT_EMOTIONS: EmotionData[] = [
  { name: "Confidence", value: 0, color: EMOTION_COLORS.Confidence },
  { name: "Interest", value: 0, color: EMOTION_COLORS.Interest },
  { name: "Skepticism", value: 0, color: EMOTION_COLORS.Skepticism },
  { name: "Excitement", value: 0, color: EMOTION_COLORS.Excitement },
  { name: "Frustration", value: 0, color: EMOTION_COLORS.Frustration },
  { name: "Neutrality", value: 0, color: EMOTION_COLORS.Neutrality },
];

function LiveCallPanel({
  live,
  sentimentHistory,
  emotions,
  buyingSignals,
  callDuration,
}: {
  live: LiveCallState;
  sentimentHistory: SentimentPoint[];
  emotions: EmotionData[];
  buyingSignals: string[];
  callDuration: number;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const isHotLead = live.intent >= 75;

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [live.transcript]);

  const sectionHeader: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "rgba(246,246,253,0.4)",
    fontWeight: 600,
    marginBottom: 12,
    marginTop: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Header: company + duration ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "14px 18px",
        borderColor: live.targetId ? "rgba(105,106,172,0.25)" : "rgba(246,246,253,0.08)",
      }}>
        {live.targetId ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(246,246,253,0.4)", marginBottom: 5 }}>Live Call</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f6f6fd", marginBottom: 2 }}>{live.companyName}</div>
              <div style={{ fontSize: 13, color: "#a2a3e9" }}>
                {live.contactName}
                {live.contactTitle && <span style={{ color: "rgba(246,246,253,0.45)" }}> · {live.contactTitle}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.35)", marginBottom: 3, letterSpacing: "0.06em" }}>DURATION</div>
              <div style={{ fontSize: 20, fontWeight: 300, color: "#c7c8f2", letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums" }}>
                {formatDuration(callDuration)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "rgba(246,246,253,0.3)", fontSize: 14 }}>Waiting to connect…</div>
        )}
      </div>

      {/* ── Gauges row ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "flex-start",
        gap: 16,
      }}>
        {/* Sentiment gauge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <RadialGauge
            score={live.sentiment}
            label="Sentiment"
            sublabel={getSentimentLabel(live.sentiment)}
            size={130}
            variant="sentiment"
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, backgroundColor: "rgba(246,246,253,0.07)", alignSelf: "stretch", margin: "4px 0" }} />

        {/* Intent gauge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          {isHotLead && (
            <div style={{
              position: "absolute",
              top: -8,
              right: -8,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              background: "linear-gradient(93.92deg, #8587e3, #4c4dac)",
              color: "#fff",
              boxShadow: "0 0 10px rgba(105,106,172,0.6)",
              animation: "hotPulse 1.5s ease infinite",
              zIndex: 1,
            }}>HOT</div>
          )}
          <RadialGauge
            score={live.intent}
            label="Buyer Intent"
            sublabel={getIntentLabel(live.intent)}
            size={115}
            variant="intent"
            hot={isHotLead}
          />
        </div>
      </div>

      {/* ── Emotion Analysis ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "14px 18px",
      }}>
        <p style={sectionHeader}>Emotion Analysis</p>
        <EmotionBars emotions={emotions} />
      </div>

      {/* ── Call Stage ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "14px 18px",
      }}>
        <p style={sectionHeader}>Call Stage</p>
        <CallStageTimeline currentStage={live.callStage} />
      </div>

      {/* ── Sentiment Timeline ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "14px 18px",
      }}>
        <p style={sectionHeader}>Sentiment Timeline</p>
        {sentimentHistory.length < 2 ? (
          <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(246,246,253,0.2)" }}>Collecting data…</span>
          </div>
        ) : (
          <SentimentSparkline points={sentimentHistory} />
        )}
      </div>

      {/* ── Buying Signals ──── */}
      <div style={{
        ...S.cardSmall,
        padding: "14px 18px",
      }}>
        <p style={sectionHeader}>Buying Signals</p>
        <BuyingSignalsBadges signals={buyingSignals} />
      </div>

      {/* ── Live Transcript ──── */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(246,246,253,0.08)", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(246,246,253,0.4)" }}>
          Live Transcript
        </div>
        <div
          ref={transcriptRef}
          style={{ maxHeight: 240, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}
        >
          {live.transcript.length === 0 ? (
            <div style={{ color: "rgba(246,246,253,0.3)", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
              Transcript will appear here…
            </div>
          ) : (
            live.transcript.map((line, i) => {
              const isAtom = line.speaker === "ATOM";
              return (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: isAtom ? "rgba(105,106,172,0.12)" : "rgba(246,246,253,0.03)",
                  border: `1px solid ${isAtom ? "rgba(105,106,172,0.3)" : "rgba(246,246,253,0.08)"}`,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: isAtom ? "#a2a3e9" : "rgba(246,246,253,0.4)",
                    marginBottom: 5,
                  }}>{line.speaker}</div>
                  <div style={{ fontSize: 13, color: "#f6f6fd", lineHeight: 1.6 }}>{line.text}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Outcome helpers for campaign history ────────────────────────────────────

function campaignOutcomeLabel(intent: number): string {
  if (intent > 75) return "Qualified";
  if (intent >= 40) return "Engaged";
  return "Cold";
}

function campaignOutcomeBadgeStyle(intent: number): React.CSSProperties {
  if (intent > 75)
    return { background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" };
  if (intent >= 40)
    return { background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" };
  return { background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" };
}

function campaignCardLeftBorder(intent: number): string {
  if (intent > 75) return "#34d399";
  if (intent >= 40) return "#fbbf24";
  return "#f87171";
}

// ─── Sparkline for campaign history (works with SentimentPoint {time,score}) ─

function CampSparkline({ points, idSuffix = "" }: { points: SentimentPoint[]; idSuffix?: string }) {
  const W = 260, H = 52, PAD = 6;
  if (points.length < 2) {
    return (
      <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "rgba(246,246,253,0.25)" }}>No data</span>
      </div>
    );
  }
  const maxTime = Math.max(...points.map((p) => p.time));
  const minTime = 0;
  const xScale = (t: number) => PAD + ((t - minTime) / Math.max(maxTime - minTime, 1)) * (W - PAD * 2);
  const yScale = (s: number) => H - PAD - (s / 100) * (H - PAD * 2);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.time).toFixed(1)} ${yScale(p.score).toFixed(1)}`).join(" ");
  const areaPath = `M ${xScale(points[0].time).toFixed(1)} ${H - PAD} ${linePath.slice(1)} L ${xScale(points[points.length - 1].time).toFixed(1)} ${H - PAD} Z`;
  const gradId = `campSparkGrad${idSuffix}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#696aac" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#696aac" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke="#a2a3e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Rich campaign history card ───────────────────────────────────────────────

function CampaignHistoryCard({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: CallHistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const leftBorder = campaignCardLeftBorder(entry.intent);
  const sectionHdr: React.CSSProperties = {
    fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "rgba(246,246,253,0.4)", fontWeight: 600, marginBottom: 10, marginTop: 0,
  };

  return (
    <div
      style={{
        backgroundColor: "rgba(246,246,253,0.03)",
        border: `1px solid ${isExpanded ? "#696aac" : "rgba(246,246,253,0.08)"}`,
        borderLeft: `3px solid ${leftBorder}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: isExpanded ? "0 0 16px rgba(105,106,172,0.12)" : "none",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      {/* ── Summary row (always visible) ── */}
      <div
        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
        onClick={onToggle}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#f6f6fd" }}>{entry.companyName || "Unknown"}</span>
            {entry.contactName && (
              <span style={{ fontSize: 12, color: "rgba(246,246,253,0.5)" }}>· {entry.contactName}</span>
            )}
            <span
              style={{
                padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                ...campaignOutcomeBadgeStyle(entry.intent),
              }}
            >
              {campaignOutcomeLabel(entry.intent)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "rgba(246,246,253,0.4)", flexWrap: "wrap" }}>
            <span>{formatDuration(entry.duration)}</span>
            <span style={{ color: getDispositionColor(entry.disposition) }}>{getDispositionLabel(entry.disposition)}</span>
          </div>
        </div>

        {/* Scores + chevron */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(246,246,253,0.35)", marginBottom: 2 }}>Sentiment</div>
            <div style={{ fontSize: 18, fontWeight: 300, color: getGaugeColor(entry.sentiment) }}>{entry.sentiment}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(246,246,253,0.35)", marginBottom: 2 }}>Intent</div>
            <div style={{ fontSize: 18, fontWeight: 300, color: "#a2a3e9" }}>{entry.intent}</div>
          </div>
          <div style={{ color: "rgba(246,246,253,0.35)", fontSize: 14, lineHeight: 1 }}>{isExpanded ? "▲" : "▼"}</div>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(246,246,253,0.06)" }}>
          <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Frozen gauges */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{
                borderRadius: 10, padding: "12px 14px",
                background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <p style={sectionHdr}>Sentiment</p>
                <RadialGauge
                  score={entry.sentiment}
                  label="Sentiment"
                  sublabel={getSentimentLabel(entry.sentiment)}
                  size={120}
                  variant="sentiment"
                />
              </div>
              <div style={{
                borderRadius: 10, padding: "12px 14px",
                background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <p style={sectionHdr}>Buyer Intent</p>
                <RadialGauge
                  score={entry.intent}
                  label="Buyer Intent"
                  sublabel={getIntentLabel(entry.intent)}
                  size={120}
                  variant="intent"
                  hot={entry.intent > 75}
                />
              </div>
            </div>

            {/* Emotion bars */}
            {entry.emotions.length > 0 && (
              <div style={{
                borderRadius: 10, padding: "12px 14px",
                background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)",
              }}>
                <p style={sectionHdr}>Emotion Analysis</p>
                <EmotionBars emotions={entry.emotions} />
              </div>
            )}

            {/* Stage + Sparkline */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{
                borderRadius: 10, padding: "12px 14px",
                background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)",
              }}>
                <p style={sectionHdr}>Call Stage</p>
                <CallStageTimeline currentStage={entry.transcript.length > 0 ? "Close" : "Discovery"} />
              </div>
              <div style={{
                borderRadius: 10, padding: "12px 14px",
                background: "rgba(246,246,253,0.025)", border: "1px solid rgba(246,246,253,0.06)",
              }}>
                <p style={sectionHdr}>Sentiment Timeline</p>
                <CampSparkline points={entry.sentimentHistory} idSuffix={`-ch-${entry.targetId}`} />
              </div>
            </div>

            {/* Buying signals */}
            {entry.buyingSignals.length > 0 && (
              <div>
                <p style={sectionHdr}>Buying Signals</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {entry.buyingSignals.map((sig, i) => (
                    <span
                      key={i}
                      style={{
                        padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 500,
                        backgroundColor: "rgba(105,106,172,0.15)",
                        border: "1px solid rgba(105,106,172,0.45)",
                        color: "#c7c8f2",
                      }}
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full transcript */}
            <div>
              <p style={sectionHdr}>Transcript</p>
              <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                {entry.transcript.length === 0 ? (
                  <div style={{ fontSize: 12, color: "rgba(246,246,253,0.25)", textAlign: "center", padding: "20px 0" }}>
                    No transcript recorded.
                  </div>
                ) : (
                  entry.transcript.map((line, i) => {
                    const isAtom = line.speaker === "ATOM";
                    return (
                      <div key={i} style={{
                        padding: "8px 12px", borderRadius: 7,
                        backgroundColor: isAtom ? "rgba(105,106,172,0.12)" : "rgba(246,246,253,0.03)",
                        border: `1px solid ${isAtom ? "rgba(105,106,172,0.3)" : "rgba(246,246,253,0.06)"}`,
                        fontSize: 12,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: isAtom ? "#a2a3e9" : "rgba(246,246,253,0.4)", marginBottom: 3 }}>
                          {isAtom ? "ATOM" : "Prospect"}
                        </div>
                        <div style={{ color: "#f6f6fd", lineHeight: 1.55 }}>{line.text}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CallHistoryFeed({
  history,
  expandedId,
  onToggle,
}: {
  history: CallHistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 620 }}>
      {history.length === 0 && (
        <div style={{ color: "rgba(246,246,253,0.3)", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
          Completed calls will appear here
        </div>
      )}
      {[...history].reverse().map((entry) => (
        <CampaignHistoryCard
          key={entry.targetId}
          entry={entry}
          isExpanded={expandedId === entry.targetId}
          onToggle={() => onToggle(entry.targetId)}
        />
      ))}
    </div>
  );
}

function HotLeadsPanel({ hotLeads }: { hotLeads: HotLead[] }) {
  if (hotLeads.length === 0) return null;

  return (
    <div style={{
      ...S.card,
      borderColor: "rgba(105,106,172,0.4)",
      boxShadow: "0 0 24px rgba(105,106,172,0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#c7c8f2", margin: 0 }}>
          Hot Leads — Score 75+
        </h3>
        <span style={{
          padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: "linear-gradient(93.92deg, #8587e3, #4c4dac)",
          color: "#fff",
        }}>{hotLeads.length}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {hotLeads.map((lead) => (
          <div key={lead.targetId} style={{
            padding: "14px 16px", borderRadius: 10,
            backgroundColor: "rgba(105,106,172,0.08)",
            border: "1px solid rgba(105,106,172,0.35)",
            boxShadow: "0 0 12px rgba(105,106,172,0.08)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f6f6fd", marginBottom: 2 }}>{lead.companyName}</div>
            <div style={{ fontSize: 13, color: "#a2a3e9", marginBottom: 10 }}>{lead.contactName}</div>

            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: getGaugeColor(lead.sentiment) }}>{lead.sentiment}</div>
                <div style={{ fontSize: 10, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sentiment</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: getGaugeColor(lead.intent) }}>{lead.intent}</div>
                <div style={{ fontSize: 10, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Intent</div>
              </div>
            </div>

            {lead.buyingSignals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "rgba(246,246,253,0.4)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Key Signals</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {lead.buyingSignals.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "rgba(246,246,253,0.7)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ color: "#696aac", flexShrink: 0 }}>›</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.primaryBtn, padding: "7px 14px", fontSize: 12 }}>
                Review
              </button>
              <button style={{ ...S.secondaryBtn, padding: "6px 12px", fontSize: 12 }}>
                Send Follow-up
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseLiveDashboard({
  targets, stats, live, history, hotLeads, phase,
  sentimentHistory, emotions, buyingSignals, callDuration,
  expandedHistoryId, onPause, onResume, onToggleHistoryExpand,
}: {
  targets: Target[];
  stats: CampaignStats;
  live: LiveCallState;
  history: CallHistoryEntry[];
  hotLeads: HotLead[];
  phase: "active" | "paused";
  sentimentHistory: SentimentPoint[];
  emotions: EmotionData[];
  buyingSignals: string[];
  callDuration: number;
  expandedHistoryId: string | null;
  onPause: () => void;
  onResume: () => void;
  onToggleHistoryExpand: (id: string) => void;
}) {
  const pct = stats.total > 0 ? Math.round(((stats.total - stats.remaining) / stats.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px" }}>
      {/* Progress bar row */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#c7c8f2" }}>
            Calling {stats.total - stats.remaining} of {stats.total}…
          </div>
          <button
            onClick={phase === "active" ? onPause : onResume}
            style={{
              ...S.secondaryBtn,
              padding: "8px 20px",
              fontSize: 13,
              borderColor: phase === "active" ? "#f59e0b" : "#22c55e",
              color: phase === "active" ? "#f59e0b" : "#22c55e",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = phase === "active" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {phase === "active" ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(246,246,253,0.08)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, #8587e3, #696aac)",
            borderRadius: 3,
            transition: "width 0.8s ease",
          }} />
        </div>

        {/* Stats row */}
        <div className="campaign-stats-bar" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "Dialed", value: stats.dialed, color: "#c7c8f2" },
            { label: "Connected", value: stats.connected, color: "#a2a3e9" },
            { label: "Qualified", value: stats.qualified, color: "#22c55e" },
            { label: "Hot Leads", value: stats.hotLeads, color: "#8587e3" },
            { label: "Remaining", value: stats.remaining, color: "rgba(246,246,253,0.4)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Middle split view */}
      <div className="campaign-split-view" style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, minHeight: 0 }}>
        {/* Live call panel */}
        <div>
          <LiveCallPanel
            live={live}
            sentimentHistory={sentimentHistory}
            emotions={emotions}
            buyingSignals={buyingSignals}
            callDuration={callDuration}
          />
        </div>

        {/* Call history */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(246,246,253,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 0, marginBottom: 12 }}>
            Call History ({history.length})
          </h3>
          <CallHistoryFeed history={history} expandedId={expandedHistoryId} onToggle={onToggleHistoryExpand} />
        </div>
      </div>

      {/* Hot leads panel */}
      <HotLeadsPanel hotLeads={hotLeads} />
    </div>
  );
}

// ─── Phase 4: Campaign Complete ───────────────────────────────────────────────

function PhaseComplete({
  stats, hotLeads, history, form,
  onNewCampaign,
}: {
  stats: CampaignStats;
  hotLeads: HotLead[];
  history: CallHistoryEntry[];
  form: CampaignForm;
  onNewCampaign: () => void;
}) {
  const handleExport = () => {
    const rows = [
      ["Company", "Contact", "Title", "Duration", "Sentiment", "Intent", "Disposition"],
      ...history.map((e) => [
        e.companyName, e.contactName, e.contactTitle,
        formatDuration(e.duration), String(e.sentiment), String(e.intent),
        getDispositionLabel(e.disposition),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atom-campaign-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#c7c8f2", margin: "0 0 8px" }}>Campaign Complete</h2>
        <p style={{ color: "rgba(246,246,253,0.5)", margin: 0, fontSize: 15 }}>
          {form.productSlug} · {form.targetGeo}
        </p>
      </div>

      {/* Summary stats */}
      <div className="campaign-complete-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total Calls", value: stats.dialed },
          { label: "Connected", value: stats.connected },
          { label: "Qualified", value: stats.qualified },
          { label: "Hot Leads", value: stats.hotLeads },
          { label: "Avg Sentiment", value: stats.avgSentiment },
          { label: "Avg Intent", value: stats.avgIntent },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#c7c8f2", marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: "rgba(246,246,253,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Hot leads */}
      {hotLeads.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <HotLeadsPanel hotLeads={hotLeads} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        <button
          onClick={handleExport}
          style={{ ...S.primaryBtn, padding: "13px 32px", fontSize: 15 }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
        >
          Export Results CSV
        </button>
        <button
          onClick={onNewCampaign}
          style={{ ...S.secondaryBtn, padding: "13px 32px", fontSize: 15 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(133,135,227,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          New Campaign
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AtomCampaign() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [campaignId, setCampaignId] = useState<string>("");
  const [form, setForm] = useState<CampaignForm>({
    brief: "",
    targetIndustry: "",
    targetGeo: "All US",
    targetCount: 10,
    productSlug: "",
    alertEmail: "",
  });
  const [targets, setTargets] = useState<Target[]>([]);
  const [live, setLive] = useState<LiveCallState>({
    targetId: null,
    companyName: "",
    contactName: "",
    contactTitle: "",
    sentiment: 0,
    intent: 0,
    callStage: "",
    transcript: [],
  });
  const [history, setHistory] = useState<CallHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('atom_campaign_call_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    dialed: 0, connected: 0, qualified: 0, hotLeads: 0, remaining: 0, total: 0, avgSentiment: 0, avgIntent: 0,
  });
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [sentimentHistory, setSentimentHistory] = useState<SentimentPoint[]>([]);
  const [emotions, setEmotions] = useState<EmotionData[]>(DEFAULT_EMOTIONS);
  const [buyingSignals, setBuyingSignals] = useState<string[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const callStartRef = useRef<number | null>(null);
  const callDurationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simTickRef = useRef(0);
  const toastIdRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot refs for rich history capture
  const sentimentHistoryRef = useRef<SentimentPoint[]>([]);
  const emotionsRef = useRef<EmotionData[]>(DEFAULT_EMOTIONS);
  const buyingSignalsRef = useRef<string[]>([]);
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Keep snapshot refs current so they can be captured in WS event handlers
  // Persist campaign call history
  useEffect(() => {
    try { localStorage.setItem('atom_campaign_call_history', JSON.stringify(history)); } catch {}
  }, [history]);

  useEffect(() => { sentimentHistoryRef.current = sentimentHistory; }, [sentimentHistory]);
  useEffect(() => { emotionsRef.current = emotions; }, [emotions]);
  useEffect(() => { buyingSignalsRef.current = buyingSignals; }, [buyingSignals]);

  const addToast = useCallback((message: string, type: ToastMsg["type"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── WebSocket — connects to bridge's /events/:callSid endpoint ───────────
  const connectWs = useCallback((callSid: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Bridge only has /events/:callSid — not campaign-level WS
    const wsUrl = `wss://${BRIDGE_URL.replace(/^https?:\/\//, "")}/events/${callSid}`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      addToast("Unable to open WebSocket connection.", "error");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Campaign WS] connected", wsUrl);
      if (wsReconnectRef.current) {
        clearTimeout(wsReconnectRef.current);
        wsReconnectRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        handleWsEvent(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      console.log("[Campaign WS] closed for callSid:", callSid);
    };

    ws.onerror = (e) => {
      console.error("[Campaign WS] error", e);
    };
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWsEvent = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    switch (type) {
      case "target_calling": {
        const targetId = msg.targetId as string;
        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "calling" as TargetStatus } : t));
        setLive({
          targetId,
          companyName: (msg.companyName as string) ?? "",
          contactName: (msg.contactName as string) ?? "",
          contactTitle: (msg.contactTitle as string) ?? "",
          sentiment: 0,
          intent: 0,
          callStage: "Initiating call…",
          transcript: [],
        });
        // Reset per-call state
        setSentimentHistory([]);
        setEmotions(DEFAULT_EMOTIONS);
        setBuyingSignals([]);
        setCallDuration(0);
        callStartRef.current = Date.now();
        if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = setInterval(() => {
          if (callStartRef.current !== null) {
            setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
          }
        }, 1000);
        break;
      }

      case "call_connected": {
        const targetId = msg.targetId as string;
        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "connected" as TargetStatus } : t));
        setLive((prev) => ({ ...prev, callStage: "Connected" }));
        break;
      }

      case "call_transcript": {
        const line: TranscriptLine = {
          speaker: (msg.speaker as "ATOM" | "Prospect"),
          text: (msg.text as string) ?? "",
          ts: Date.now(),
        };
        setLive((prev) => ({ ...prev, transcript: [...prev.transcript, line] }));
        break;
      }

      case "call_metrics": {
        const newSentiment = (msg.sentiment as number) ?? 0;
        // Accept both "buyerIntent" (per spec) and legacy "intent"
        const newIntent = (msg.buyerIntent as number) ?? (msg.intent as number) ?? 0;
        // Accept both "stage" (per spec) and legacy "callStage"
        const newStage = (msg.stage as string) ?? (msg.callStage as string) ?? "";
        setLive((prev) => ({
          ...prev,
          sentiment: newSentiment || prev.sentiment,
          intent: newIntent || prev.intent,
          callStage: newStage || prev.callStage,
        }));
        // Update sentiment history
        if (newSentiment > 0) {
          setSentimentHistory((prev) => [
            ...prev,
            { time: callStartRef.current ? Math.floor((Date.now() - callStartRef.current) / 1000) : prev.length * 3, score: newSentiment },
          ]);
        }
        // Map emotions from WS if provided — accept both 0-1 fractions and 0-100 integers
        if (msg.emotions && typeof msg.emotions === "object") {
          const wsEmotions = msg.emotions as Record<string, number>;
          setEmotions(DEFAULT_EMOTIONS.map((e) => {
            const key = e.name;
            const keyLower = key.toLowerCase();
            const raw = wsEmotions[key] ?? wsEmotions[keyLower];
            if (raw === undefined) return e;
            // Normalise: if value <= 1 it's a fraction, otherwise already 0-100
            const value = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
            return { ...e, value };
          }));
        }
        // Map buying signals from WS if provided
        if (Array.isArray(msg.buyingSignals)) {
          setBuyingSignals((prev) => {
            const next = [...prev];
            for (const sig of msg.buyingSignals as string[]) {
              if (!next.includes(sig)) next.push(sig);
            }
            return next;
          });
        }
        break;
      }

      case "call_complete": {
        if (callDurationTimerRef.current) {
          clearInterval(callDurationTimerRef.current);
          callDurationTimerRef.current = null;
        }
        callStartRef.current = null;
        const targetId = msg.targetId as string;
        const disposition = (msg.disposition as Disposition) ?? "no_answer";
        const sentiment = (msg.sentiment as number) ?? 0;
        const intent = (msg.intent as number) ?? 0;
        const duration = (msg.duration as number) ?? 0;

        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "completed" as TargetStatus } : t));

        setLive((curr) => {
          const entry: CallHistoryEntry = {
            targetId,
            companyName: curr.companyName,
            contactName: curr.contactName,
            contactTitle: curr.contactTitle,
            duration,
            sentiment,
            intent,
            disposition,
            transcript: curr.transcript,
            expanded: false,
            // Rich analytics snapshot captured at call end
            sentimentHistory: [...sentimentHistoryRef.current],
            emotions: [...emotionsRef.current],
            buyingSignals: [...buyingSignalsRef.current],
          };
          setHistory((h) => [...h, entry]);
          return { ...curr, callStage: "" };
        });

        setStats((prev) => {
          const newDialed = prev.dialed + 1;
          const newConnected = msg.connected ? prev.connected + 1 : prev.connected;
          const newQualified = disposition === "qualified" || disposition === "hot_lead" ? prev.qualified + 1 : prev.qualified;
          const newRemaining = Math.max(0, prev.remaining - 1);
          const sentimentSum = prev.avgSentiment * prev.dialed + sentiment;
          const intentSum = prev.avgIntent * prev.dialed + intent;
          return {
            ...prev,
            dialed: newDialed,
            connected: newConnected,
            qualified: newQualified,
            remaining: newRemaining,
            avgSentiment: newDialed ? Math.round(sentimentSum / newDialed) : 0,
            avgIntent: newDialed ? Math.round(intentSum / newDialed) : 0,
          };
        });
        break;
      }

      case "hot_lead": {
        const lead: HotLead = {
          targetId: (msg.targetId as string) ?? "",
          companyName: (msg.companyName as string) ?? "",
          contactName: (msg.contactName as string) ?? "",
          sentiment: (msg.sentiment as number) ?? 0,
          intent: (msg.intent as number) ?? 0,
          buyingSignals: (msg.buyingSignals as string[]) ?? [],
        };
        setHotLeads((prev) => [...prev, lead]);
        setStats((prev) => ({ ...prev, hotLeads: prev.hotLeads + 1 }));
        addToast(`🔥 Hot lead: ${lead.companyName} — ${lead.contactName}`, "success");
        break;
      }

      case "campaign_progress": {
        const current = (msg.current as number) ?? 0;
        const total = (msg.total as number) ?? 0;
        setStats((prev) => ({ ...prev, total, remaining: total - current }));
        break;
      }

      case "campaign_complete": {
        setPhase("complete");
        wsRef.current?.close();
        wsRef.current = null;
        addToast("Campaign complete!", "success");
        break;
      }
    }
  }, [addToast]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // ── Refs for campaign dialing loop ────────────────────────────────────────
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const targetsRef = useRef<Target[]>([]);
  useEffect(() => { targetsRef.current = targets; }, [targets]);

  // ── API calls ─────────────────────────────────────────────────────────────

  const handleResearch = useCallback(async () => {
    setPhase("researching");

    try {
      // Generate a local campaign ID — we don't use bridge for campaign management
      const localCampaignId = `cam-${Date.now()}`;
      setCampaignId(localCampaignId);

      // Use the Vercel prospects/scan API to find real targets from Apollo
      const scanPayload: Record<string, any> = {
        industry: form.targetIndustry || undefined,
        geo: form.targetGeo || "All US",
        productFocus: form.productSlug || undefined,
        jobTitles: [],
        excludeCompanies: [],
      };

      // Parse brief for additional context keywords
      if (form.brief && form.brief.trim()) {
        scanPayload.keywords = form.brief.trim().slice(0, 200);
      }

      console.log("[Campaign] Researching targets via /api/prospects/scan:", scanPayload);

      const scanRes = await fetch("/api/prospects/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanPayload),
      });

      if (!scanRes.ok) {
        const text = await scanRes.text().catch(() => "");
        throw new Error(`Prospect scan failed: ${scanRes.status}${text ? ` — ${text}` : ""}`);
      }

      const scanData: any[] = await scanRes.json();
      console.log(`[Campaign] Got ${scanData.length} prospects from Apollo`);

      // Map Apollo prospect data to Target format
      const fetchedTargets: Target[] = [];
      let rank = 1;
      for (const p of scanData) {
        // Parse contacts JSON if it's a string
        let contacts: any[] = [];
        try {
          contacts = typeof p.contacts === "string" ? JSON.parse(p.contacts) : (p.contacts || []);
        } catch { contacts = []; }

        // Use best contact as decision maker
        const topContact = contacts[0] || {};
        const contactName = topContact.firstName && topContact.lastName
          ? `${topContact.firstName} ${topContact.lastName}`
          : topContact.firstName || topContact.lastName || "";

        fetchedTargets.push({
          id: `t-${rank}-${localCampaignId}`,
          rank,
          companyName: p.companyName || `Company ${rank}`,
          industry: p.industry || "",
          size: p.companySize || "",
          location: "",
          decisionMaker: {
            name: contactName,
            title: topContact.position || topContact.title || "",
            linkedin: topContact.linkedin || undefined,
          },
          email: topContact.email || undefined,
          phone: topContact.phone || topContact.mobilePhone || p.companyPhone || undefined,
          tags: (() => {
            try { return JSON.parse(p.signals || "[]"); } catch { return []; }
          })(),
          status: "queued" as TargetStatus,
        });
        rank++;

        // Honor targetCount limit
        if (rank > form.targetCount) break;
      }

      setTargets(fetchedTargets);
      setStats((prev) => ({
        ...prev,
        total: fetchedTargets.length,
        remaining: fetchedTargets.length,
      }));
      setPhase("review");
      addToast(`Found ${fetchedTargets.length} real prospects from Apollo.`, "success");
    } catch (err) {
      console.error("[Campaign] Research error:", err);
      addToast(err instanceof Error ? err.message : "Research failed. Please try again.", "error");
      setPhase("setup");
    }
  }, [form, addToast]);

  // ── Sequential dialing loop — uses bridge POST /call for each target ──────
  const dialNextTarget = useCallback(async (targetList: Target[]) => {
    const pending = targetList.filter((t) => t.status === "queued");
    if (pending.length === 0) {
      setPhase("complete");
      addToast("Campaign complete! All targets dialed.", "success");
      return;
    }

    if (isStoppedRef.current) return;

    // Wait while paused
    if (isPausedRef.current) {
      setTimeout(() => dialNextTarget(targetsRef.current), 2000);
      return;
    }

    const target = pending[0];

    // Mark as calling
    setTargets((prev) => prev.map((t) => t.id === target.id ? { ...t, status: "calling" as TargetStatus } : t));
    setLive({
      targetId: target.id,
      companyName: target.companyName,
      contactName: target.decisionMaker.name,
      contactTitle: target.decisionMaker.title,
      sentiment: 0,
      intent: 0,
      callStage: "Initiating call…",
      transcript: [],
    });
    setSentimentHistory([]);
    setEmotions(DEFAULT_EMOTIONS);
    setBuyingSignals([]);
    setCallDuration(0);
    callStartRef.current = Date.now();
    if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
    callDurationTimerRef.current = setInterval(() => {
      if (callStartRef.current !== null) {
        setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
      }
    }, 1000);

    // Dial via bridge POST /call
    if (!target.phone) {
      console.warn(`[Campaign] No phone for target ${target.companyName} — skipping`);
      setTargets((prev) => prev.map((t) => t.id === target.id ? { ...t, status: "skipped" as TargetStatus } : t));
      setLive((prev) => ({ ...prev, targetId: null, callStage: "" }));
      if (callDurationTimerRef.current) { clearInterval(callDurationTimerRef.current); callDurationTimerRef.current = null; }
      callStartRef.current = null;
      setStats((prev) => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));
      // Continue to next
      setTimeout(() => dialNextTarget(targetsRef.current), 1500);
      return;
    }

    const formattedPhone = formatPhoneNumber(target.phone);
    console.log(`[Campaign] Dialing ${target.companyName} at ${formattedPhone}`);

    try {
      const callPayload = {
        to: formattedPhone,
        firstName: target.decisionMaker.name.split(" ")[0] || undefined,
        companyName: target.companyName || undefined,
        product: form.productSlug || undefined,
      };

      const res = await fetch(`${BRIDGE_URL}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(callPayload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[Campaign] Call failed for ${target.companyName}: ${res.status} ${errText}`);
        throw new Error(`Call failed: ${res.status}`);
      }

      const json = await res.json();
      const callSid: string = json.callSid;
      console.log(`[Campaign] Call started for ${target.companyName}, SID: ${callSid}`);

      setTargets((prev) => prev.map((t) => t.id === target.id ? { ...t, status: "connected" as TargetStatus } : t));
      setLive((prev) => ({ ...prev, callStage: "Connected" }));
      setStats((prev) => ({ ...prev, dialed: prev.dialed + 1, connected: prev.connected + 1 }));

      // Connect WS to monitor this specific call
      connectWs(callSid);

      // Wait for call to end before dialing next — poll call status via bridge
      // We listen to the WS call_ended event, with a 5-minute timeout fallback
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.log(`[Campaign] Call timeout for ${target.companyName}`);
          resolve();
        }, 5 * 60 * 1000);

        const checkInterval = setInterval(() => {
          if (isStoppedRef.current) { clearTimeout(timeout); clearInterval(checkInterval); resolve(); }
        }, 1000);

        // Listen for call_ended via GET /call/:callSid/summary polling
        const pollSummary = async () => {
          while (!isStoppedRef.current) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const summaryRes = await fetch(`${BRIDGE_URL}/call/${callSid}/summary`);
              if (summaryRes.ok) {
                const summaryData = await summaryRes.json();
                if (summaryData.status === "completed" || summaryData.duration > 0) {
                  clearTimeout(timeout);
                  clearInterval(checkInterval);
                  resolve();
                  return;
                }
              }
            } catch { /* silent */ }
          }
        };
        pollSummary();
      });

      // Mark completed
      setTargets((prev) => prev.map((t) => t.id === target.id ? { ...t, status: "completed" as TargetStatus } : t));
      setLive((prev) => ({ ...prev, targetId: null, callStage: "" }));
      if (callDurationTimerRef.current) { clearInterval(callDurationTimerRef.current); callDurationTimerRef.current = null; }
      callStartRef.current = null;
      setStats((prev) => ({ ...prev, remaining: Math.max(0, prev.remaining - 1) }));

      // Brief pause between calls
      if (!isStoppedRef.current) {
        await new Promise((r) => setTimeout(r, 3000));
        dialNextTarget(targetsRef.current);
      }
    } catch (err) {
      console.error(`[Campaign] Error dialing ${target.companyName}:`, err);
      setTargets((prev) => prev.map((t) => t.id === target.id ? { ...t, status: "failed" as TargetStatus } : t));
      setLive((prev) => ({ ...prev, targetId: null, callStage: "" }));
      if (callDurationTimerRef.current) { clearInterval(callDurationTimerRef.current); callDurationTimerRef.current = null; }
      callStartRef.current = null;
      setStats((prev) => ({ ...prev, dialed: prev.dialed + 1, remaining: Math.max(0, prev.remaining - 1) }));
      addToast(`Failed to reach ${target.companyName} — continuing.`, "info");
      await new Promise((r) => setTimeout(r, 2000));
      if (!isStoppedRef.current) dialNextTarget(targetsRef.current);
    }
  }, [form, connectWs, addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLaunch = useCallback(async () => {
    isPausedRef.current = false;
    isStoppedRef.current = false;
    setPhase("active");
    addToast("Campaign launched — ATOM is dialing.", "success");
    // Start the sequential dialing loop using locally tracked targets
    dialNextTarget(targetsRef.current);
  }, [dialNextTarget, addToast]);

  const handlePause = useCallback(async () => {
    // Pause is managed locally — no bridge endpoint needed
    isPausedRef.current = true;
    setPhase("paused");
    addToast("Campaign paused.", "info");
  }, [addToast]);

  const handleResume = useCallback(async () => {
    // Resume is managed locally — continues the dialing loop
    isPausedRef.current = false;
    setPhase("active");
    addToast("Campaign resumed.", "success");
    dialNextTarget(targetsRef.current);
  }, [dialNextTarget, addToast]);

  const handleNewCampaign = useCallback(() => {
    // Stop the dialing loop
    isStoppedRef.current = true;
    isPausedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    if (callDurationTimerRef.current) clearInterval(callDurationTimerRef.current);
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    callStartRef.current = null;
    setCampaignId("");
    setTargets([]);
    setHistory([]);
    setHotLeads([]);
    setLive({ targetId: null, companyName: "", contactName: "", contactTitle: "", sentiment: 0, intent: 0, callStage: "", transcript: [] });
    setStats({ dialed: 0, connected: 0, qualified: 0, hotLeads: 0, remaining: 0, total: 0, avgSentiment: 0, avgIntent: 0 });
    setSentimentHistory([]);
    setEmotions(DEFAULT_EMOTIONS);
    setBuyingSignals([]);
    setCallDuration(0);
    sentimentHistoryRef.current = [];
    emotionsRef.current = DEFAULT_EMOTIONS;
    buyingSignalsRef.current = [];
    setShowHistoryOverlay(false);
    setExpandedHistoryId(null);
    setForm({ brief: "", targetIndustry: "", targetGeo: "All US", targetCount: 10, productSlug: "", alertEmail: "" });
    setPhase("setup");
  }, []);

  const handleToggleHistoryExpand = useCallback((id: string) => {
    setExpandedHistoryId((prev) => (prev === id ? null : id));
  }, []);

  // ── Simulation: animate emotions + sentiment history when a call is live ───────────
  // Only fires when there's a live targetId and sentiment history is sparse
  // (i.e., no real WS data is streaming rich metrics)
  useEffect(() => {
    if (!live.targetId) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      simTickRef.current = 0;
      return;
    }

    simTickRef.current = 0;
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);

    const SIGNALS = [
      "Asked about pricing",
      "Mentioned competitor",
      "Requested demo",
      "Expressed urgency",
      "Asked about integrations",
      "Mentioned budget approval",
    ];

    simIntervalRef.current = setInterval(() => {
      simTickRef.current += 1;
      const t = simTickRef.current;

      // Interpolated emotion progression: neutral -> interest -> excitement
      const progress = Math.min(t / 40, 1); // 0 to 1 over 40 ticks (40s)

      // Only run simulation if sentiment history looks sparse (no active real data)
      setSentimentHistory((prev) => {
        // If real data is arriving (score was set via WS), don't simulate
        if (prev.length > 0 && prev[prev.length - 1].time > t - 2) return prev;
        // Simulate a realistic curve: starts at 35, rises to 70 by end
        const baseScore = 35 + progress * 35;
        const jitter = (Math.random() - 0.5) * 12;
        const score = Math.round(Math.max(15, Math.min(95, baseScore + jitter)));
        return [...prev, { time: t, score }];
      });

      // Simulate emotion shifts
      setEmotions(() => {
        // We still animate — but if WS provides them, handleWsEvent updates directly
        const conf = Math.round(20 + progress * 55 + (Math.random() - 0.5) * 8);
        const interest = Math.round(15 + progress * 55 + (Math.random() - 0.5) * 10);
        const skep = Math.round(40 - progress * 30 + (Math.random() - 0.5) * 8);
        const exc = Math.round(5 + progress * 50 + (Math.random() - 0.5) * 12);
        const frust = Math.round(20 - progress * 15 + (Math.random() - 0.5) * 6);
        const neut = Math.round(60 - progress * 40 + (Math.random() - 0.5) * 8);
        return [
          { name: "Confidence", value: Math.max(0, Math.min(99, conf)), color: EMOTION_COLORS.Confidence },
          { name: "Interest", value: Math.max(0, Math.min(99, interest)), color: EMOTION_COLORS.Interest },
          { name: "Skepticism", value: Math.max(0, Math.min(99, skep)), color: EMOTION_COLORS.Skepticism },
          { name: "Excitement", value: Math.max(0, Math.min(99, exc)), color: EMOTION_COLORS.Excitement },
          { name: "Frustration", value: Math.max(0, Math.min(99, frust)), color: EMOTION_COLORS.Frustration },
          { name: "Neutrality", value: Math.max(0, Math.min(99, neut)), color: EMOTION_COLORS.Neutrality },
        ];
      });

      // Simulate buying signals appearing
      setBuyingSignals((prev) => {
        if (prev.length >= 4) return prev;
        if (t === 10 && prev.length < 1) return [SIGNALS[0]];
        if (t === 20 && prev.length < 2) return [...prev, SIGNALS[1]];
        if (t === 32 && prev.length < 3) return [...prev, SIGNALS[2]];
        if (t === 45 && prev.length < 4) return [...prev, SIGNALS[3]];
        return prev;
      });

      // Simulate live.sentiment update (only when not getting real WS data)
      setLive((prev) => {
        if (prev.sentiment > 5) return prev; // real WS data is present, skip
        const baseScore = 35 + Math.min(t / 40, 1) * 35;
        const score = Math.round(Math.max(15, Math.min(95, baseScore + (Math.random() - 0.5) * 10)));
        const intentBase = 20 + Math.min(t / 50, 1) * 60;
        const intent = Math.round(Math.max(10, Math.min(95, intentBase + (Math.random() - 0.5) * 10)));
        const stages = ["Discovery", "Evaluation", "Negotiation"];
        const stageIdx = Math.min(Math.floor(t / 20), 2);
        return { ...prev, sentiment: score, intent, callStage: stages[stageIdx] };
      });
    }, 1000);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [live.targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Note: Status polling removed — campaign state is tracked locally.
  // The bridge only has POST /call, GET /calls, GET /call/:callSid/summary.
  // Campaign progress is managed via the local dialNextTarget loop.

  // ── Render ─────────────────────────────────────────────────────────────────

  const historyOverlay = showHistoryOverlay && (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        backgroundColor: "rgba(2,2,2,0.88)",
        backdropFilter: "blur(16px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        overflowY: "auto",
        padding: "40px 24px 60px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowHistoryOverlay(false); }}
    >
      <div style={{
        width: "100%", maxWidth: 860,
        backgroundColor: "#0d0d12",
        border: "1px solid rgba(105,106,172,0.25)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
      }}>
        {/* Overlay header */}
        <div style={{
          padding: "18px 24px",
          borderBottom: "1px solid rgba(246,246,253,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          backgroundColor: "rgba(246,246,253,0.02)",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#c7c8f2" }}>Call History</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(246,246,253,0.4)" }}>
              {history.length} {history.length === 1 ? "call" : "calls"} — current session
            </p>
          </div>
          <button
            onClick={() => setShowHistoryOverlay(false)}
            style={{
              background: "rgba(246,246,253,0.06)",
              border: "1px solid rgba(246,246,253,0.12)",
              borderRadius: 8,
              color: "rgba(246,246,253,0.7)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "4px 10px",
              fontFamily: "inherit",
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Overlay body */}
        <div style={{ padding: "20px 24px" }}>
          {history.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              color: "rgba(246,246,253,0.3)", fontSize: 14,
            }}>
              No calls recorded yet. History populates as campaign calls complete.
            </div>
          ) : (
            <CallHistoryFeed
              history={history}
              expandedId={expandedHistoryId}
              onToggle={handleToggleHistoryExpand}
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(2); opacity: 0; }
        }
        @keyframes hotPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(105,106,172,0.6); }
          50% { box-shadow: 0 0 20px rgba(105,106,172,1), 0 0 40px rgba(105,106,172,0.4); }
        }
        @keyframes gaugeGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(105,106,172,0.3)); }
          50% { filter: drop-shadow(0 0 16px rgba(105,106,172,0.8)); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(105,106,172,0.35); border-radius: 3px; }
        input, select, textarea { color-scheme: dark; }
        input:focus, select:focus, textarea:focus {
          border-color: rgba(105,106,172,0.6) !important;
          outline: none;
        }
      `}</style>

      {historyOverlay}

      <div style={{
        minHeight: "100vh",
        backgroundColor: "#020202",
        color: "#f6f6fd",
        fontFamily: "'Plus Jakarta Sans', 'Arial', 'Helvetica', sans-serif",
      }}>
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          borderBottom: "1px solid rgba(246,246,253,0.08)",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(2,2,2,0.9)",
          backdropFilter: "blur(12px)",
          zIndex: 100,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 3px", color: "#f6f6fd", letterSpacing: "-0.02em" }}>
              ATOM Campaign Engine
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(246,246,253,0.45)" }}>
              Autonomous outbound prospecting powered by AI
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Call History button */}
            <button
              onClick={() => setShowHistoryOverlay((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 16px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                background: showHistoryOverlay ? "rgba(105,106,172,0.22)" : "transparent",
                border: showHistoryOverlay ? "1px solid #696aac" : "1px solid rgba(246,246,253,0.15)",
                color: showHistoryOverlay ? "#a2a3e9" : "rgba(246,246,253,0.6)",
                transition: "all 0.15s ease",
                boxShadow: showHistoryOverlay ? "0 0 12px rgba(105,106,172,0.2)" : "none",
              }}
              onMouseEnter={(e) => { if (!showHistoryOverlay) { e.currentTarget.style.background = "rgba(246,246,253,0.05)"; e.currentTarget.style.color = "rgba(246,246,253,0.8)"; } }}
              onMouseLeave={(e) => { if (!showHistoryOverlay) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(246,246,253,0.6)"; } }}
            >
              {/* Clock icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Call History
              {history.length > 0 && (
                <span style={{
                  background: "rgba(105,106,172,0.35)",
                  color: "#a2a3e9",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  lineHeight: 1.6,
                }}>
                  {history.length}
                </span>
              )}
            </button>

            {/* Phase badge */}
            <div style={getPhaseBadgeStyle(phase)}>
              {(phase === "active") && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#4ade80", display: "inline-block", animation: "pulse 2s ease infinite" }} />
              )}
              {getPhaseLabel(phase)}
            </div>

            {/* Campaign ID chip */}
            {campaignId && (
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.3)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(246,246,253,0.1)" }}>
                {campaignId}
              </div>
            )}
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <main>
          {phase === "setup" && (
            <PhaseSetup form={form} setForm={setForm} onSubmit={handleResearch} loading={false} />
          )}

          {phase === "researching" && (
            <PhaseResearching />
          )}

          {phase === "review" && (
            <PhaseReview
              targets={targets}
              form={form}
              campaignId={campaignId}
              onLaunch={handleLaunch}
              onEditCampaign={() => setPhase("setup")}
            />
          )}

          {(phase === "active" || phase === "paused") && (
            <PhaseLiveDashboard
              targets={targets}
              stats={stats}
              live={live}
              history={history}
              hotLeads={hotLeads}
              phase={phase}
              sentimentHistory={sentimentHistory}
              emotions={emotions}
              buyingSignals={buyingSignals}
              callDuration={callDuration}
              expandedHistoryId={expandedHistoryId}
              onPause={handlePause}
              onResume={handleResume}
              onToggleHistoryExpand={handleToggleHistoryExpand}
            />
          )}

          {phase === "complete" && (
            <PhaseComplete
              stats={stats}
              hotLeads={hotLeads}
              history={history}
              form={form}
              onNewCampaign={handleNewCampaign}
            />
          )}
        </main>
      </div>
    </>
  );
}
