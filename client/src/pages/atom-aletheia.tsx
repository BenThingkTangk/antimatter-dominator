import { useState, useEffect, useRef } from "react";
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
  Copy,
  ExternalLink,
  Radio,
  Mic,
  Users,
  FileText,
  Search,
  History,
  GitBranch,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "live" | "text" | "pipeline" | "playbook" | "architecture" | "history";

interface WaveBar {
  height: number;
  delay: number;
  duration: number;
  color: string;
}

interface TextAnalysisResult {
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#696aac";
const SONAR = "#22d3ee";
const VOICE = "#a78bfa";
const DANGER = "#f87171";
const WARN = "#fbbf24";
const SUCCESS = "#4ade80";
const TEXT_PRIMARY = "#f6f6fd";
const TEXT_MUTED = "rgba(255,255,255,0.55)";

const FONT_FAMILY = "'Plus Jakarta Sans', Arial, sans-serif";

const HEDGES = [
  "definitely", "absolutely", "certainly", "of course", "obviously",
  "without a doubt", "for sure", "100%", "no question",
];
const EVASIONS = [
  "circle back", "revisit", "few months", "settle down", "pause",
  "reprioritization", "internal process", "right now", "at the moment", "when things",
];
const URGENCY_WORDS = ["urgent", "asap", "immediately", "today", "deadline", "by end of"];

const SAMPLE_SMS =
  "Hey just checking in — still very interested in moving forward. Our CEO is bullish on this. Just need to loop in legal which should be quick. Will circle back by end of week definitely!";
const SAMPLE_EMAIL =
  "Hi,\n\nThank you for the proposal. We've had a chance to review and the team thinks there's a strong fit. However, we've decided to pause the evaluation process for now due to some internal reprioritization. We would love to revisit this conversation in a few months when things settle down. Definitely keeping you top of mind!\n\nBest,\nJames";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div
      style={{
        height: 4,
        borderRadius: 99,
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}

function Tag({
  children,
  color,
  bg,
  border,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase" as const,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        background: bg,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </span>
  );
}

function LiveTag() {
  return (
    <Tag
      color={SONAR}
      bg="rgba(34,211,238,0.08)"
      border="rgba(34,211,238,0.2)"
    >
      ● LIVE
    </Tag>
  );
}

function Card({
  children,
  style,
  glow,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glow?: string;
}) {
  return (
    <div
      style={{
        background: "#111114",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: glow ? `0 0 0 1px ${glow}22, 0 4px 24px rgba(0,0,0,0.4)` : "0 2px 12px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueColor,
  delta,
  deltaType,
}: {
  label: string;
  value: string;
  valueColor: string;
  delta: string;
  deltaType: "up" | "down" | "neutral";
}) {
  const deltaColor =
    deltaType === "up" ? SUCCESS : deltaType === "down" ? DANGER : TEXT_MUTED;
  return (
    <Card>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: TEXT_MUTED,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 36,
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "monospace",
          fontSize: 10,
          color: deltaColor,
        }}
      >
        {deltaType === "down" && <TrendingDown size={11} />}
        {deltaType === "up" && <TrendingUp size={11} />}
        {delta}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: "rgba(255,255,255,0.3)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform() {
  const [bars, setBars] = useState<WaveBar[]>(() =>
    Array.from({ length: 16 }, () => ({
      height: Math.random() * 48 + 4,
      delay: Math.random() * 0.8,
      duration: 0.5 + Math.random() * 0.6,
      color:
        Math.random() > 0.7
          ? DANGER
          : Math.random() > 0.5
          ? WARN
          : SONAR,
    }))
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setBars(
        Array.from({ length: 16 }, () => {
          const h = Math.random() * 48 + 4;
          return {
            height: h,
            delay: Math.random() * 0.8,
            duration: 0.5 + Math.random() * 0.6,
            color: h > 38 ? DANGER : h > 22 ? WARN : SONAR,
          };
        })
      );
    }, 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 56 }}>
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: b.height,
            borderRadius: 2,
            background: b.color,
            opacity: 0.7,
            animation: `aletheiaWave ${b.duration}s ease-in-out ${b.delay}s infinite alternate`,
            transformOrigin: "bottom",
            transition: "height 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Truth Meter (horizontal bar) ─────────────────────────────────────────────

function TruthMeter({ score }: { score: number }) {
  const color = score < 40 ? DANGER : score < 65 ? WARN : SUCCESS;
  const status =
    score < 40 ? "DECEPTIVE" : score < 65 ? "UNCERTAIN" : "TRUTHFUL";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: TEXT_MUTED,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Aletheia Truth Score
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {score}
        </span>
      </div>
      {/* Gradient bar */}
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 999,
          background:
            "linear-gradient(to right, #f87171 0%, #fbbf24 45%, #4ade80 100%)",
          marginBottom: 8,
        }}
      >
        {/* Indicator */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${score}%`,
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: color,
            border: "2px solid #020202",
            boxShadow: `0 0 8px ${color}`,
            transition: "left 0.6s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.3)",
        }}
      >
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
      <div
        style={{
          marginTop: 12,
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: 13,
          fontWeight: 700,
          color,
          letterSpacing: "0.12em",
        }}
      >
        {status}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: TEXT_MUTED,
          marginTop: 4,
        }}
      >
        Confidence: 87% · 14 signals weighted
      </div>
    </div>
  );
}

// ─── Tab: Live Session ────────────────────────────────────────────────────────

function TabLive() {
  const [score, setScore] = useState(34);
  const [showAlert, setShowAlert] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setScore((prev) => Math.max(20, Math.min(45, prev + (Math.random() * 6 - 3))));
    }, 2200);
    return () => clearInterval(iv);
  }, []);

  const roundedScore = Math.round(score);

  const signals = [
    {
      label: "Expression",
      sub: "Hume AI",
      score: 28,
      color: DANGER,
      icon: <Eye size={14} />,
      cue: "Contempt micro-expression peaked 0.78",
    },
    {
      label: "Acoustic",
      sub: "Prosody",
      score: 45,
      color: WARN,
      icon: <Mic size={14} />,
      cue: "Pitch rose 83% above baseline during budget claim",
    },
    {
      label: "Linguistic",
      sub: "NLP",
      score: 22,
      color: DANGER,
      icon: <MessageSquare size={14} />,
      cue: "74% non-answer ratio, hedging index 0.78",
    },
    {
      label: "Behavioral",
      sub: "Timing",
      score: 38,
      color: DANGER,
      icon: <Activity size={14} />,
      cue: "Gaze aversion 71%, self-touch events increased 3×",
    },
  ];

  const exprCells = [
    { name: "CONTEMPT", val: "0.78", pct: 78, color: DANGER },
    { name: "SUPPRESSION", val: "0.64", pct: 64, color: DANGER },
    { name: "DISGUST", val: "0.52", pct: 52, color: WARN },
    { name: "JOY", val: "0.08", pct: 8, color: SUCCESS },
    { name: "PITCH RISE", val: "0.83", pct: 83, color: DANGER },
    { name: "SPEECH RATE", val: "+55%", pct: 55, color: WARN },
    { name: "PAUSE INDEX", val: "1.9s", pct: 71, color: WARN },
    { name: "EYE CONTACT", val: "22%", pct: 22, color: ACCENT },
  ];

  const transcript = [
    {
      speaker: "ATOM",
      text: "Great — what does your timeline look like for implementation?",
      time: "0:15",
      flags: [],
    },
    {
      speaker: "PROSPECT",
      text: null,
      time: "0:28",
      flags: [
        { text: "Well, we'd need to run it by a few people... ", type: "normal" },
        { text: "probably Q3 or Q4 maybe", type: "amber" },
        { text: ".", type: "normal" },
      ],
    },
    {
      speaker: "ATOM",
      text: "Who specifically would need to approve this?",
      time: "0:45",
      flags: [],
    },
    {
      speaker: "PROSPECT",
      text: null,
      time: "0:52",
      flags: [
        { text: "Oh, ", type: "normal" },
        { text: "it's kind of a committee thing", type: "red" },
        { text: "... ", type: "normal" },
        { text: "I can't really say exactly", type: "amber" },
        { text: ".", type: "normal" },
      ],
    },
    {
      speaker: "ATOM",
      text: "What budget range are you working with?",
      time: "1:10",
      flags: [],
    },
    {
      speaker: "PROSPECT",
      text: null,
      time: "1:18",
      flags: [
        { text: "We have budget, ", type: "normal" },
        { text: "that's not really the issue", type: "red" },
        { text: "...", type: "normal" },
      ],
    },
  ];

  const cues = [
    {
      level: "critical" as const,
      title: "Budget fabrication detected — prospect deflected 3×",
      desc: "Contempt micro-expression peaked 0.78 during 'budget' claim. Pitch rose 83% above baseline.",
      time: "1:18",
    },
    {
      level: "critical" as const,
      title: "Authority claim suspicious — no named decision maker",
      desc: '"Committee thing" — evasive hedge pattern. 1.9s pause before response. Suppression high.',
      time: "0:52",
    },
    {
      level: "warn" as const,
      title: "Timeline vague and shifting — Q3/Q4 non-committal",
      desc: '"Q3... maybe Q4" — ambiguity stacking with topic deflection. Repeated 3× across session.',
      time: "0:28",
    },
    {
      level: "warn" as const,
      title: "Verbal agreement contradicted by body language",
      desc: "22% gaze time (baseline: 61%). Consistent downward-left breaks during objection statements.",
      time: "Ongoing",
    },
    {
      level: "ok" as const,
      title: "Genuine interest signal at 0:00",
      desc: "Authentic engagement expressed (joy 0.41) when prospect said 'definitely interested'. Follow this thread.",
      time: "0:00",
    },
  ];

  const cueColor = { critical: DANGER, warn: WARN, ok: SUCCESS };

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 16,
          flexWrap: "wrap" as const,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 20,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              letterSpacing: "-0.01em",
            }}
          >
            Live Session
          </div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
            Real-time multimodal truth analysis · APEX CORP · Michael Torres
            (VP Sales)
          </div>
        </div>
        <LiveTag />
      </div>

      {/* Alert banner */}
      {showAlert && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(248,113,113,0.07)",
            border: "1px solid rgba(248,113,113,0.25)",
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={16} color={DANGER} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, flex: 1, color: TEXT_PRIMARY }}>
            <strong>HIGH DECEPTION SIGNAL DETECTED</strong> — Micro-expression
            cluster (contempt + suppression) at 0:52. Budget objection flagged
            as LIKELY FABRICATED. See Playbook for counter.
          </div>
          <button
            onClick={() => setShowAlert(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: TEXT_MUTED,
              fontSize: 14,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Aletheia Truth Score"
          value={String(roundedScore)}
          valueColor={DANGER}
          delta="DECEPTION RISK: HIGH"
          deltaType="down"
        />
        <KpiCard
          label="Stress Index"
          value="71"
          valueColor={WARN}
          delta="Elevated above baseline"
          deltaType="neutral"
        />
        <KpiCard
          label="Deal Probability"
          value="38%"
          valueColor={WARN}
          delta="Was 62% last week"
          deltaType="down"
        />
        <KpiCard
          label="Signals Fired"
          value="14"
          valueColor={SONAR}
          delta="11 deceptive · 3 genuine"
          deltaType="neutral"
        />
      </div>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 12,
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Multimodal Signal Dashboard */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                  }}
                >
                  Multimodal Signal Dashboard
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                  Hume AI Expressions · Acoustic Prosody · NLP Semantics ·
                  Behavioral Timing
                </div>
              </div>
              <LiveTag />
            </div>

            {/* 4-col signal bars */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {signals.map((s) => (
                <div
                  key={s.label}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 10,
                        color: TEXT_PRIMARY,
                        fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: TEXT_MUTED,
                      marginBottom: 6,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {s.sub}
                  </div>
                  <ScoreBar value={s.score} color={s.color} />
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 18,
                      fontWeight: 700,
                      color: s.color,
                      marginTop: 4,
                    }}
                  >
                    {s.score}
                    <span
                      style={{
                        fontSize: 10,
                        color: TEXT_MUTED,
                        fontWeight: 400,
                      }}
                    >
                      /100
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>
                    {s.cue}
                  </div>
                </div>
              ))}
            </div>

            {/* Expression micro-grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8,1fr)",
                gap: 6,
                marginBottom: 14,
              }}
            >
              {exprCells.map((e) => (
                <div
                  key={e.name}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    textAlign: "center" as const,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 8,
                      color: TEXT_MUTED,
                      marginBottom: 4,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {e.name}
                  </div>
                  <ScoreBar value={e.pct} color={e.color} />
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: e.color,
                      marginTop: 4,
                    }}
                  >
                    {e.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Waveform */}
            <div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: TEXT_MUTED,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase" as const,
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Mic size={10} color={VOICE} />
                VOICE PROSODY STREAM
              </div>
              <Waveform />
            </div>
          </Card>

          {/* Transcript */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Live Transcript &amp; Flag Analysis
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Tag
                  color={DANGER}
                  bg="rgba(248,113,113,0.08)"
                  border="rgba(248,113,113,0.2)"
                >
                  4 FLAGS
                </Tag>
                <LiveTag />
              </div>
            </div>
            <div
              style={{
                maxHeight: 280,
                overflowY: "auto" as const,
                display: "flex",
                flexDirection: "column" as const,
                gap: 10,
              }}
            >
              {transcript.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 64,
                      paddingTop: 1,
                      color:
                        line.speaker === "ATOM"
                          ? SONAR
                          : WARN,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {line.speaker}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      flex: 1,
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {line.flags && line.flags.length > 0
                      ? line.flags.map((f, fi) => {
                          if (f.type === "red") {
                            return (
                              <mark
                                key={fi}
                                style={{
                                  background: "rgba(248,113,113,0.15)",
                                  color: DANGER,
                                  borderRadius: 3,
                                  padding: "0 3px",
                                  fontWeight: 500,
                                }}
                              >
                                {f.text}
                              </mark>
                            );
                          }
                          if (f.type === "amber") {
                            return (
                              <span
                                key={fi}
                                style={{
                                  background: "rgba(251,191,36,0.12)",
                                  color: WARN,
                                  borderRadius: 3,
                                  padding: "0 3px",
                                  fontWeight: 500,
                                }}
                              >
                                {f.text}
                              </span>
                            );
                          }
                          return <span key={fi}>{f.text}</span>;
                        })
                      : line.text}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                      paddingTop: 1,
                      flexShrink: 0,
                    }}
                  >
                    {line.time}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              <span>
                <mark
                  style={{
                    background: "rgba(248,113,113,0.15)",
                    color: DANGER,
                    borderRadius: 2,
                    padding: "0 4px",
                  }}
                >
                  RED
                </mark>{" "}
                = Deception Signal
              </span>
              <span>
                <span
                  style={{
                    background: "rgba(251,191,36,0.12)",
                    color: WARN,
                    borderRadius: 2,
                    padding: "0 4px",
                  }}
                >
                  AMBER
                </span>{" "}
                = Evasion/Stall
              </span>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Truth Meter */}
          <Card glow={ACCENT}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                marginBottom: 16,
              }}
            >
              Truth Meter
            </div>
            <TruthMeter score={roundedScore} />
          </Card>

          {/* Deception Cue Timeline */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Deception Cue Timeline
              </div>
              <Tag
                color={WARN}
                bg="rgba(251,191,36,0.08)"
                border="rgba(251,191,36,0.2)"
              >
                11 ACTIVE
              </Tag>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cues.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 7,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: cueColor[c.level],
                      marginTop: 4,
                      flexShrink: 0,
                      boxShadow:
                        c.level === "critical"
                          ? `0 0 6px ${DANGER}`
                          : undefined,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: TEXT_PRIMARY,
                        marginBottom: 2,
                      }}
                    >
                      {c.title}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                      {c.desc}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                      flexShrink: 0,
                    }}
                  >
                    {c.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Playbook */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                AI Counter Suggestions
              </div>
              <Tag
                color={SONAR}
                bg="rgba(34,211,238,0.08)"
                border="rgba(34,211,238,0.2)"
              >
                LIVE AI
              </Tag>
            </div>
            {[
              {
                cat: "Objection Rebuttal",
                text: '"If budget is the constraint, let\'s lock the scope at your guaranteed approval threshold and phase the rest. What\'s the number you CAN move on today?"',
              },
              {
                cat: "Authority Test",
                text: '"What specifically would the board need to see to move this forward before Q4? Can we get them on the next call?"',
              },
              {
                cat: "Redirect to Genuine Interest",
                text: "Return to initial interest expressed at 0:00 — authentic engagement was real. Anchor on ROI from that angle.",
              },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderLeft: `2px solid ${SONAR}`,
                  borderRadius: 6,
                  padding: "8px 10px",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: SONAR,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 4,
                  }}
                >
                  {p.cat}
                </div>
                <div style={{ fontSize: 12, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes aletheiaWave {
          from { opacity: 0.45; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Tab: Text Analyzer ───────────────────────────────────────────────────────

function TabText() {
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<TextAnalysisResult | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  function analyzeText() {
    const text = inputText.trim();
    if (!text) {
      toast({ title: "Please enter text to analyze", variant: "destructive" });
      return;
    }
    const lower = text.toLowerCase();
    const hedgeCount = HEDGES.filter((h) => lower.includes(h)).length;
    const evasionCount = EVASIONS.filter((e) => lower.includes(e)).length;
    const urgencyCount = URGENCY_WORDS.filter((u) => lower.includes(u)).length;
    const wordCount = text.split(/\s+/).length;
    const sentCount = (text.match(/[.!?]+/g) || []).length + 1;
    const hedgePct = Math.min(95, hedgeCount * 18);
    const evasionPct = Math.min(95, evasionCount * 15);
    const dealRisk = Math.min(
      95,
      Math.round(hedgePct * 0.4 + evasionPct * 0.5 + 10)
    );
    const truthScore = Math.max(
      5,
      100 - dealRisk - Math.round(Math.random() * 8)
    );
    const riskLevel =
      dealRisk > 60 ? "HIGH RISK" : dealRisk > 35 ? "MEDIUM RISK" : "LOW RISK";

    let highlighted = text;
    HEDGES.forEach((h) => {
      const re = new RegExp(`(${h})`, "gi");
      highlighted = highlighted.replace(
        re,
        `<mark style="background:rgba(248,113,113,0.15);color:#f87171;border-radius:3px;padding:0 3px;">$1</mark>`
      );
    });
    EVASIONS.forEach((e) => {
      const re = new RegExp(`(${e})`, "gi");
      highlighted = highlighted.replace(
        re,
        `<span style="background:rgba(251,191,36,0.12);color:#fbbf24;border-radius:3px;padding:0 3px;">$1</span>`
      );
    });
    highlighted = highlighted.replace(/\n/g, "<br>");

    setResult({
      truthScore,
      hedgePct,
      evasionPct,
      urgency: urgencyCount > 0 ? "HIGH" : "LOW",
      dealRisk,
      riskLevel,
      highlightedHtml: highlighted,
      hedgeCount,
      evasionCount,
      wordCount,
      sentCount,
    });
    setAnalyzed(true);
  }

  const r = result;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          Text Analyzer
        </div>
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
          Paste any SMS, email, or chat message. Get deception and intent
          scoring in seconds.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Input */}
        <Card>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              marginBottom: 12,
            }}
          >
            Input Message
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Paste an email, SMS, or prospect message here...\n\nExample: "We're still very much interested but the decision has been pushed to next quarter. Will definitely circle back soon!"`}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: 14,
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              color: TEXT_PRIMARY,
              resize: "none" as const,
              minHeight: 180,
              lineHeight: 1.6,
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap" as const,
              marginTop: 12,
            }}
          >
            <button
              onClick={analyzeText}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "monospace",
                fontSize: 12,
                fontWeight: 600,
                padding: "8px 18px",
                borderRadius: 999,
                background: VOICE,
                color: "#fff",
                border: "none",
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              <Search size={13} />
              ANALYZE DECEPTION
            </button>
            <button
              onClick={() => setInputText(SAMPLE_SMS)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                fontSize: 12,
                color: TEXT_MUTED,
                cursor: "pointer",
              }}
            >
              Load SMS Sample
            </button>
            <button
              onClick={() => setInputText(SAMPLE_EMAIL)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                fontSize: 12,
                color: TEXT_MUTED,
                cursor: "pointer",
              }}
            >
              Load Email Sample
            </button>
          </div>
        </Card>

        {/* Results */}
        {analyzed && r ? (
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Deception Analysis
              </div>
              <Tag
                color={
                  r.dealRisk > 60 ? DANGER : r.dealRisk > 35 ? WARN : SUCCESS
                }
                bg={
                  r.dealRisk > 60
                    ? "rgba(248,113,113,0.08)"
                    : r.dealRisk > 35
                    ? "rgba(251,191,36,0.08)"
                    : "rgba(74,222,128,0.08)"
                }
                border={
                  r.dealRisk > 60
                    ? "rgba(248,113,113,0.2)"
                    : r.dealRisk > 35
                    ? "rgba(251,191,36,0.2)"
                    : "rgba(74,222,128,0.2)"
                }
              >
                {r.riskLevel}
              </Tag>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                {
                  label: "Aletheia Truth Score",
                  value: String(r.truthScore),
                  color:
                    r.truthScore < 40
                      ? DANGER
                      : r.truthScore < 65
                      ? WARN
                      : SUCCESS,
                },
                { label: "Hedging %", value: `${r.hedgePct}%`, color: r.hedgePct > 50 ? DANGER : WARN },
                { label: "Evasion %", value: `${r.evasionPct}%`, color: r.evasionPct > 40 ? DANGER : WARN },
                {
                  label: "Urgency",
                  value: r.urgency,
                  color: r.urgency === "HIGH" ? SUCCESS : TEXT_MUTED,
                },
                {
                  label: "Deal Risk",
                  value: `${r.dealRisk}%`,
                  color:
                    r.dealRisk > 60
                      ? DANGER
                      : r.dealRisk > 35
                      ? WARN
                      : SUCCESS,
                },
              ].map((chip) => (
                <div
                  key={chip.label}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 7,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 8,
                      color: TEXT_MUTED,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.08em",
                      marginBottom: 4,
                    }}
                  >
                    {chip.label}
                  </div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 18,
                      fontWeight: 700,
                      color: chip.color,
                    }}
                  >
                    {chip.value}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.8,
                color: TEXT_PRIMARY,
              }}
              dangerouslySetInnerHTML={{ __html: r.highlightedHtml }}
            />
          </Card>
        ) : (
          <Card>
            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                height: 260,
                gap: 12,
                color: "rgba(255,255,255,0.2)",
                textAlign: "center" as const,
              }}
            >
              <MessageSquare size={36} strokeWidth={1} />
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                }}
              >
                PASTE MESSAGE → ANALYZE
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Phrase Breakdown + Playbook */}
      {analyzed && r && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                marginBottom: 12,
              }}
            >
              Phrase-Level Breakdown
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.hedgeCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 7,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: DANGER,
                      marginTop: 4,
                      flexShrink: 0,
                      boxShadow: `0 0 6px ${DANGER}`,
                    }}
                  />
                  <div>
                    <div
                      style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 2 }}
                    >
                      Over-assurance Hedging Detected ({r.hedgeCount} phrases)
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                      Phrases like "definitely," "absolutely," "100%" spike in deceptive communication. Genuine commitment rarely needs this volume of affirmation.
                    </div>
                  </div>
                </div>
              )}
              {r.evasionCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 7,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: WARN,
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 2 }}
                    >
                      Stall/Delay Language Detected ({r.evasionCount} phrases)
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                      Temporal deflection ("circle back," "few months," "pause") signals low intent to proceed. This is ghosting architecture being laid.
                    </div>
                  </div>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 7,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: SONAR,
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{ fontSize: 12, fontWeight: 500, color: TEXT_PRIMARY, marginBottom: 2 }}
                  >
                    Message Length Analysis ({r.wordCount} words, ~{r.sentCount} sentences)
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                    Longer-than-necessary explanations in rejections/stalls suggest guilt compensation — over-explaining to soften the real message.
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Playbook Response Suggestions
              </div>
              <Tag color={SONAR} bg="rgba(34,211,238,0.08)" border="rgba(34,211,238,0.2)">
                AI GENERATED
              </Tag>
            </div>
            {r.dealRisk > 60 ? (
              <>
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: `2px solid ${DANGER}`,
                    borderRadius: 6,
                    padding: "10px 12px",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: DANGER,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase" as const,
                      marginBottom: 6,
                    }}
                  >
                    🚨 BREAK-UP EMAIL RESPONSE
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
                    "Hey — totally understand the reprioritization. Before I let this go, I want to make sure I understand: is this a timing issue, a budget issue, or is this project genuinely not moving forward? I'd rather know now so I don't waste your inbox."
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
                    Signal: Forces binary response. Real buyers clarify. Ghosts confirm exit.
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    borderLeft: `2px solid ${WARN}`,
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      color: WARN,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase" as const,
                      marginBottom: 6,
                    }}
                  >
                    ⚠ WHAT THIS MESSAGE REALLY MEANS
                  </div>
                  <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
                    High hedging + stall language = this deal is over or never was. "Keeping you top of mind" is a soft rejection. The deal is dead unless you create a forcing function now.
                  </div>
                </div>
              </>
            ) : r.dealRisk > 35 ? (
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderLeft: `2px solid ${ACCENT}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: ACCENT,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  💡 FLUSH THE REAL BLOCKER
                </div>
                <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
                  "It sounds like there might be something specific making this harder to move on right now — is it internal alignment, budget timing, or something else I should know about?"
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>
                  Signal: Evasion patterns often mask a specific hidden objection. Ask directly.
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderLeft: `2px solid ${SUCCESS}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: SUCCESS,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  ✅ GENUINE SIGNAL — ADVANCE THE DEAL
                </div>
                <div style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.5 }}>
                  Low deception signals in this message. Prospect appears aligned. Recommend scheduling next step immediately and getting a specific commitment on calendar.
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Tab: Deal Pipeline ───────────────────────────────────────────────────────

function TabPipeline() {
  const deals = [
    {
      name: "Acme Corp",
      contact: "Sarah Chen",
      stage: "NEGOTIATION",
      stageColor: DANGER,
      stageBg: "rgba(248,113,113,0.08)",
      value: "$420K",
      score: 34,
      risk: "HIGH",
      riskColor: DANGER,
      riskPct: 82,
      signals: "Budget fabrication, contempt cluster",
      channels: "VIDEO · EMAIL",
      last: "14m ago",
    },
    {
      name: "Globex Inc",
      contact: "Marcus Webb",
      stage: "DISCOVERY",
      stageColor: SUCCESS,
      stageBg: "rgba(74,222,128,0.08)",
      value: "$180K",
      score: 88,
      risk: "LOW",
      riskColor: SUCCESS,
      riskPct: 12,
      signals: "None detected",
      channels: "VIDEO · SMS",
      last: "2h ago",
    },
    {
      name: "Initech",
      contact: "Paul Lyman",
      stage: "PROPOSAL",
      stageColor: WARN,
      stageBg: "rgba(251,191,36,0.08)",
      value: "$95K",
      score: 52,
      risk: "MEDIUM",
      riskColor: WARN,
      riskPct: 52,
      signals: "Hedging ×4, timeline ambiguity",
      channels: "EMAIL",
      last: "1d ago",
    },
    {
      name: "Umbrella Ltd",
      contact: "Dana Reyes",
      stage: "VERBAL YES",
      stageColor: ACCENT,
      stageBg: "rgba(105,106,172,0.12)",
      value: "$310K",
      score: 22,
      risk: "GHOST",
      riskColor: DANGER,
      riskPct: 91,
      signals: "Ghost pattern, non-answer 74%",
      channels: "EMAIL · SMS",
      last: "8d ago",
    },
    {
      name: "Stark Industries",
      contact: "James Potts",
      stage: "TECHNICAL EVAL",
      stageColor: SUCCESS,
      stageBg: "rgba(74,222,128,0.08)",
      value: "$750K",
      score: 81,
      risk: "LOW",
      riskColor: SUCCESS,
      riskPct: 18,
      signals: "None detected",
      channels: "VIDEO",
      last: "3h ago",
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 20,
                fontWeight: 700,
                color: TEXT_PRIMARY,
              }}
            >
              Deal Pipeline Intelligence
            </div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
              Truth-adjusted deal scoring across all active opportunities
            </div>
          </div>
          <Tag color={WARN} bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.2)">
            3 At-Risk Deals
          </Tag>
        </div>
      </div>

      {/* KPI Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Pipeline Value"
          value="$1.76M"
          valueColor={TEXT_PRIMARY}
          delta="5 active deals"
          deltaType="neutral"
        />
        <KpiCard
          label="Truth-Adjusted Value"
          value="$680K"
          valueColor={WARN}
          delta="Risk discount applied"
          deltaType="down"
        />
        <KpiCard
          label="High Risk Deals"
          value="3"
          valueColor={DANGER}
          delta="Based on signal patterns"
          deltaType="down"
        />
        <KpiCard
          label="Ghost Probability"
          value="2 deals"
          valueColor={DANGER}
          delta="Umbrella + Acme at risk"
          deltaType="down"
        />
      </div>

      {/* Deal Table */}
      <Card style={{ overflowX: "auto" as const }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            marginBottom: 16,
          }}
        >
          Active Deals — Aletheia-Adjusted Scoring
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              {[
                "DEAL",
                "CONTACT",
                "STAGE",
                "VALUE",
                "ALETHEIA SCORE",
                "RISK",
                "SIGNALS",
                "CHANNELS",
                "LAST",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: TEXT_MUTED,
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "8px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    textAlign: "left" as const,
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((d, i) => (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < deals.length - 1
                      ? "1px solid rgba(255,255,255,0.04)"
                      : "none",
                }}
              >
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ fontWeight: 600, color: TEXT_PRIMARY }}>
                    {d.name}
                  </div>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {d.contact}
                  </div>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      padding: "2px 7px",
                      borderRadius: 999,
                      color: d.stageColor,
                      background: d.stageBg,
                      border: `1px solid ${d.stageColor}33`,
                    }}
                  >
                    {d.stage}
                  </span>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <strong style={{ color: TEXT_PRIMARY }}>{d.value}</strong>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      color: d.score < 40 ? DANGER : d.score < 65 ? WARN : SUCCESS,
                      background:
                        d.score < 40
                          ? "rgba(248,113,113,0.08)"
                          : d.score < 65
                          ? "rgba(251,191,36,0.08)"
                          : "rgba(74,222,128,0.08)",
                    }}
                  >
                    {d.score} / {d.risk}
                  </span>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div
                    style={{ width: 80, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}
                  >
                    <div
                      style={{
                        width: `${d.riskPct}%`,
                        height: "100%",
                        background: d.riskColor,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, maxWidth: 160 }}>
                    {d.signals}
                  </div>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: TEXT_MUTED,
                    }}
                  >
                    {d.channels}
                  </div>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.25)",
                    }}
                  >
                    {d.last}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Deal probability bars */}
      <div style={{ marginTop: 16 }}>
        <Card>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              fontWeight: 600,
              color: TEXT_PRIMARY,
              marginBottom: 16,
            }}
          >
            Deal Close Probability — Truth-Adjusted
          </div>
          {[
            { name: "Stark Industries", prob: 85, color: SUCCESS },
            { name: "Globex Inc", prob: 78, color: SUCCESS },
            { name: "Initech", prob: 44, color: WARN },
            { name: "Acme Corp", prob: 38, color: DANGER },
            { name: "Umbrella Ltd", prob: 11, color: DANGER },
          ].map((d) => (
            <div
              key={d.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: TEXT_MUTED,
                  width: 140,
                  flexShrink: 0,
                }}
              >
                {d.name}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${d.prob}%`,
                    height: "100%",
                    background: d.color,
                    borderRadius: 999,
                    transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: d.color,
                  width: 36,
                  textAlign: "right" as const,
                  flexShrink: 0,
                }}
              >
                {d.prob}%
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Playbook ────────────────────────────────────────────────────────────

function TabPlaybook() {
  const tactics = [
    {
      cat: "BUDGET REALITY CHECK",
      catColor: DANGER,
      move: "Kill the Budget Objection",
      text: '"I hear budget — let me make that easier. What if we right-sized this to start at a phase-1 scope and built in a Phase 2 trigger once results are proven? What number clears today?"',
      signal:
        "Bypasses the stall. Forces them to name a real number or expose the real blocker. Fabricated objections collapse under specificity.",
    },
    {
      cat: "TIMELINE & AUTHORITY VERIFICATION",
      catColor: WARN,
      move: "Authority Flush",
      text: '"You mentioned the board — I\'d love to give them a 15-minute direct brief. I can tailor it to exactly what they care about. Can we get 15 minutes on the calendar this week?"',
      signal:
        "Exposes whether the authority claim was real. A genuine buyer will welcome it. A staller will deflect again — confirming the signal.",
    },
    {
      cat: "COMPETITION / ALTERNATIVE REALITY CHECK",
      catColor: ACCENT,
      move: "Competitive Intelligence Play",
      text: '"Are you looking at other vendors in this space right now? I ask because I want to make sure I\'m comparing apples to apples for you and can address any specific gaps."',
      signal:
        "Surfaces competing bids. Contempt signal often appears when prospect is already leaning toward a competitor. Gets hidden info into the open.",
    },
    {
      cat: "COMMITMENT TESTING",
      catColor: SONAR,
      move: "Deal or No Deal",
      text: '"Look — I want to be straight with you. I\'m reading this as not the right moment, and I don\'t want to waste your time or mine. Is this actually in scope for this year, or should we revisit in Q1?"',
      signal:
        "Pattern interrupt. Genuine prospects will re-engage hard. Ghost prospects will confirm they were never real — saving you weeks of follow-up.",
    },
    {
      cat: "ANCHOR ON GENUINE INTEREST",
      catColor: SUCCESS,
      move: "Return to the Real Hook",
      text: '"Earlier you said \'We\'re definitely interested in moving forward\' — let\'s build the ROI case around that specifically. If we shaved 6 months off your implementation timeline, what does that mean in revenue?"',
      signal:
        "Returns to the only moment of authentic engagement. Builds urgency from real value, not external pressure.",
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          Playbook Coach
        </div>
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
          Strategic questioning tactics tuned to detected deception signals ·
          APEX CORP active session
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Signal summary */}
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Deception Patterns — Apex Corp
              </div>
              <Tag color={DANGER} bg="rgba(248,113,113,0.08)" border="rgba(248,113,113,0.2)">
                HIGH RISK
              </Tag>
            </div>
            <SectionLabel>Active Signals</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 16 }}>
              {[
                { label: "Budget Fabrication", color: DANGER },
                { label: "Authority Stalling", color: DANGER },
                { label: "Contempt Cluster", color: WARN },
                { label: "Timeline Evasion", color: WARN },
                { label: "Gaze Avoidance", color: WARN },
                { label: "Non-Answer 74%", color: WARN },
              ].map((s) => (
                <span
                  key={s.label}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    padding: "2px 8px",
                    borderRadius: 999,
                    color: s.color,
                    background: `${s.color}14`,
                    border: `1px solid ${s.color}33`,
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <SectionLabel>Signal Intensity</SectionLabel>
            {[
              { label: "Budget Objection (Fabricated)", pct: 92, color: DANGER },
              { label: "Authority Deflection", pct: 78, color: DANGER },
              { label: "Timeline Stalling", pct: 71, color: WARN },
              { label: "Genuine Interest at 0:00", pct: 41, color: SONAR },
            ].map((p) => (
              <div
                key={p.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: TEXT_MUTED,
                    width: 180,
                    flexShrink: 0,
                  }}
                >
                  {p.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 5,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${p.pct}%`,
                      height: "100%",
                      background: p.color,
                      borderRadius: 999,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: p.color,
                    width: 32,
                    textAlign: "right" as const,
                  }}
                >
                  {p.pct}%
                </span>
              </div>
            ))}
          </Card>
          <Card>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                marginBottom: 12,
              }}
            >
              Pattern Recognition
            </div>
            <div
              style={{
                fontSize: 13,
                color: TEXT_MUTED,
                lineHeight: 1.7,
              }}
            >
              <p style={{ marginBottom: 8 }}>
                ⚠ This prospect is{" "}
                <strong style={{ color: TEXT_PRIMARY }}>
                  not a genuine buyer right now
                </strong>
                . Multiple fabricated objections + contempt signals suggest:
              </p>
              <ul
                style={{
                  paddingLeft: 18,
                  display: "flex",
                  flexDirection: "column" as const,
                  gap: 4,
                }}
              >
                <li>They are using you as competitive leverage in another negotiation</li>
                <li>Budget was never real — a true stall or political cover</li>
                <li>Decision authority is above their stated contact level</li>
                <li>There's a competing vendor they're already leaning toward</li>
              </ul>
              <p style={{ marginTop: 12, color: TEXT_PRIMARY }}>
                The system identified genuine engagement at 0:00 around{" "}
                <strong>moving forward</strong> — that's your real hook.
              </p>
            </div>
          </Card>
        </div>

        {/* Tactics */}
        <div>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                }}
              >
                Strategic Playbook
              </div>
              <Tag color={SONAR} bg="rgba(34,211,238,0.08)" border="rgba(34,211,238,0.2)">
                5 TACTICS
              </Tag>
            </div>
            {tactics.map((t, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderLeft: `2px solid ${t.catColor}`,
                  borderRadius: 7,
                  padding: "10px 14px",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: t.catColor,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    marginBottom: 4,
                  }}
                >
                  {t.cat}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                    marginBottom: 6,
                  }}
                >
                  {t.move}
                </div>
                <div style={{ fontSize: 12, color: TEXT_PRIMARY, lineHeight: 1.55, marginBottom: 6 }}>
                  {t.text}
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: TEXT_MUTED,
                  }}
                >
                  Signal: {t.signal}
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Architecture ────────────────────────────────────────────────────────

function TabArchitecture() {
  const layers = [
    {
      num: "L1",
      name: "Capture Layer",
      sub: "All Channels",
      desc: "4K video · 48kHz audio · text · metadata",
      color: SONAR,
      components: [
        { name: "Video Capture", detail: "4K 60fps face + body. WebRTC overlay for video calls." },
        { name: "Audio Capture", detail: "48kHz dual-channel. Close-talk + room mic separation." },
        { name: "Text / SMS / Email", detail: "Paste, import, or API hook to CRM/Gmail/SMS." },
        { name: "Session Metadata", detail: "Timestamps, pause durations, response latency, turn-taking." },
        { name: "Baseline Collection", detail: "Known-truth calibration at session start. Personal deviation scoring." },
      ],
    },
    {
      num: "L2",
      name: "Expression Engine",
      sub: "Hume AI",
      desc: "Hume EVI + Expression API",
      color: VOICE,
      components: [
        { name: "Micro-Expression Detection", detail: "48+ expression dimensions. Sub-200ms latency. AU-based feature extraction." },
        { name: "Voice Expression", detail: "Prosodic tone, emotional valence, arousal from audio stream." },
        { name: "Suppression Detection", detail: "Identifies masked/suppressed expressions — key deception signal." },
        { name: "Hume EVI (Real-Time)", detail: "Empathic Voice Interface for live session coaching cues." },
      ],
    },
    {
      num: "L3",
      name: "Acoustic Prosody Engine",
      sub: "Vocal Analysis",
      desc: "Custom ASR + Praat-based features",
      color: ACCENT,
      components: [
        { name: "Pitch Analysis", detail: "F0 deviation from personal baseline. Jitter & shimmer coefficients." },
        { name: "Speech Rate Dynamics", detail: "WPM delta, tempo acceleration, micro-stutter detection." },
        { name: "Pause Behavior", detail: "Pre-response latency, filled/unfilled pause ratio, repair initiations." },
        { name: "Voice Stress Index", detail: "Layered tremor, breathiness, laryngeal tension markers." },
      ],
    },
    {
      num: "L4",
      name: "NLP Semantic Engine",
      sub: "Language Intelligence",
      desc: "GPT-4o + custom deception fine-tune",
      color: SONAR,
      components: [
        { name: "Linguistic Deception Cues", detail: "Hedging density, distancing language, passive constructions, overqualification." },
        { name: "Cross-Turn Contradiction", detail: "Tracks narrative inconsistencies across full session history." },
        { name: "Evasion Pattern Scoring", detail: "Non-answer ratio, topic deflection, question redirection frequency." },
        { name: "Adaptive Questioning", detail: "Generates real-time follow-up questions to probe detected evasions." },
        { name: "Text/Email Analysis", detail: "Async analysis of written comms: SMS, email, chat, proposals." },
      ],
    },
    {
      num: "L5",
      name: "Behavioral Dynamics Engine",
      sub: "Non-Verbal Analysis",
      desc: "Computer vision + pose estimation",
      color: SUCCESS,
      components: [
        { name: "Gaze Tracking", detail: "Eye contact ratio, gaze direction (truth vs. fabrication correlates)." },
        { name: "Body Language", detail: "Self-touch, posture shifts, shoulder orientation, hand concealment." },
        { name: "Cross-Session Memory", detail: "Compares today vs. prior sessions for narrative drift and baseline deviation." },
        { name: "Response Latency", detail: "Per-question timing, hesitation clusters, turn-taking anomalies." },
      ],
    },
    {
      num: "L6",
      name: "Fusion Engine",
      sub: "Calibrated Ensemble",
      desc: "SambaNova inference + custom model",
      color: DANGER,
      components: [
        { name: "Late Fusion Classifier", detail: "Weighted ensemble from all 4 specialist models. Per-channel attribution." },
        { name: "Bayesian Confidence", detail: "Outputs probability distributions, not binary verdicts. Uncertainty flagged." },
        { name: "SambaNova Inference", detail: "Low-latency ensemble scoring for real-time overlay. <80ms E2E target." },
        { name: "Baseline Normalization", detail: "All scores deviance-adjusted against individual's established truth baseline." },
      ],
    },
    {
      num: "L7",
      name: "Sales Intelligence Engine",
      sub: "Deal Forecasting",
      desc: "GPT-4o orchestration layer",
      color: SONAR,
      components: [
        { name: "Deal Probability Model", detail: "Truth-adjusted close probability. Pattern-matches against historical closes/losses." },
        { name: "Objection Classifier", detail: "Real vs. fabricated objection scoring. Auto-generates specific rebuttals." },
        { name: "Playbook Coach", detail: "Real-time counter-strategy via live overlay. Session-specific, not generic." },
        { name: "Ghost Detection", detail: "Pattern recognizes deals that will go dark before rep realizes it." },
        { name: "Pipeline Risk Scores", detail: "Truth-adjusted CRM forecasting. Integrates with Salesforce/HubSpot." },
      ],
    },
    {
      num: "L8",
      name: "Governance + Audit Layer",
      sub: "Compliance",
      desc: "No black boxes. Full audit trail.",
      color: TEXT_MUTED,
      components: [
        { name: "Session Replay", detail: "Full annotated replay with signal overlay at every timestamp." },
        { name: "Explainability Trace", detail: "Every score traceable to source features. No opaque verdicts." },
        { name: "Adversarial Hardening", detail: "Trained against coached liars, cultural variance, and expression masking." },
        { name: "Compliance Controls", detail: "Consent capture, data residency, GDPR/CCPA/SOC2 hooks." },
      ],
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          System Architecture
        </div>
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
          Multimodal truth intelligence stack — 8 layers, 6 AI engines,
          real-time fusion
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: 10,
          background: "rgba(251,191,36,0.07)",
          border: "1px solid rgba(251,191,36,0.2)",
          marginBottom: 20,
          fontSize: 13,
          color: TEXT_PRIMARY,
        }}
      >
        <AlertTriangle size={15} color={WARN} style={{ flexShrink: 0 }} />
        <span>
          This architecture integrates with{" "}
          <strong>Hume AI</strong> (expression), GPT-4o (reasoning), SambaNova
          (low-latency inference), and custom trained fusion models. No single
          vendor dependency — always a multi-model stack.
        </span>
      </div>

      {/* Pipeline flow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
          overflowX: "auto" as const,
          padding: "12px 0",
        }}
      >
        {[
          "Capture",
          "Hume AI",
          "Acoustic",
          "NLP",
          "Behavioral",
          "Fusion",
          "Sales Intel",
          "UX",
        ].map((step, i, arr) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(105,106,172,0.15)",
                border: `1px solid ${ACCENT}44`,
                fontFamily: "monospace",
                fontSize: 10,
                color: ACCENT,
                letterSpacing: "0.06em",
                whiteSpace: "nowrap" as const,
              }}
            >
              {step}
            </div>
            {i < arr.length - 1 && (
              <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
            )}
          </div>
        ))}
      </div>

      {/* Architecture layers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {layers.map((layer) => (
          <div
            key={layer.num}
            style={{
              background: "#111114",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  width: 24,
                  fontWeight: 500,
                }}
              >
                {layer.num}
              </span>
              <div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 13,
                    fontWeight: 600,
                    color: layer.color,
                  }}
                >
                  {layer.name}
                  <span
                    style={{
                      color: TEXT_MUTED,
                      fontWeight: 400,
                      fontSize: 11,
                      marginLeft: 8,
                    }}
                  >
                    — {layer.sub}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: TEXT_MUTED,
                }}
              >
                {layer.desc}
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 8,
                padding: "12px 16px",
              }}
            >
              {layer.components.map((c) => (
                <div
                  key={c.name}
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 7,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                      marginBottom: 3,
                    }}
                  >
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.4 }}>
                    {c.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function TabHistory() {
  const events = [
    {
      level: "critical" as const,
      date: "Today 12:18 PM",
      prospect: "Apex Corp",
      title: "LIVE SESSION · Aletheia Truth Score: 34 · HIGH RISK",
      detail:
        "11 deception signals. Budget objection flagged fabricated. Contempt cluster at 0:52. Deal probability revised to 38%.",
      type: "VIDEO",
    },
    {
      level: "ok" as const,
      date: "Today 10:00 AM",
      prospect: "Stark Industries",
      title: "VIDEO CALL · Truth Score: 81 · LOW RISK",
      detail:
        "Genuine excitement confirmed. Joy expression dominant. Timeline and authority clear. Technical evaluation progressing.",
      type: "VIDEO",
    },
    {
      level: "ok" as const,
      date: "Today 9:15 AM",
      prospect: "Globex Inc",
      title: "VIDEO CALL · Truth Score: 88 · LOW RISK",
      detail:
        "High engagement, no suppression, clear authority confirmation. Discovery stage complete. Proposal sent.",
      type: "VIDEO",
    },
    {
      level: "warn" as const,
      date: "Yesterday 3:30 PM",
      prospect: "Initech",
      title: "EMAIL THREAD · Truth Score: 52 · MEDIUM RISK",
      detail:
        "4× hedging phrases detected. Timeline ambiguity. Recommend direct call to flush out real blocker.",
      type: "EMAIL",
    },
    {
      level: "critical" as const,
      date: "Apr 14",
      prospect: "Umbrella Ltd",
      title: "EMAIL + SMS · Truth Score: 22 · GHOST RISK",
      detail:
        "Non-answer ratio 74%. Last 3 replies show suppression pattern. Ghost probability 89%. Recommend break-up email.",
      type: "EMAIL",
    },
  ];

  const typeIcon: Record<string, React.ReactNode> = {
    VIDEO: <Phone size={12} />,
    EMAIL: <Mail size={12} />,
    SMS: <MessageSquare size={12} />,
  };
  const cueColor = { critical: DANGER, warn: WARN, ok: SUCCESS };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 20,
            fontWeight: 700,
            color: TEXT_PRIMARY,
          }}
        >
          Session History
        </div>
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>
          All analyzed sessions with truth scores and outcome tracking
        </div>
      </div>

      {/* Summary row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KpiCard
          label="Sessions Analyzed"
          value="5"
          valueColor={TEXT_PRIMARY}
          delta="This week"
          deltaType="neutral"
        />
        <KpiCard
          label="High Risk Flagged"
          value="2"
          valueColor={DANGER}
          delta="Apex + Umbrella"
          deltaType="down"
        />
        <KpiCard
          label="Genuine Buyers"
          value="2"
          valueColor={SUCCESS}
          delta="Stark + Globex confirmed"
          deltaType="up"
        />
        <KpiCard
          label="Avg Truth Score"
          value="54.6"
          valueColor={WARN}
          delta="Portfolio avg this week"
          deltaType="neutral"
        />
      </div>

      <Card>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 600,
            color: TEXT_PRIMARY,
            marginBottom: 16,
          }}
        >
          Recent Sessions
        </div>
        {/* Timeline */}
        <div
          style={{
            position: "relative" as const,
            paddingLeft: 24,
          }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: "absolute" as const,
              left: 7,
              top: 0,
              bottom: 0,
              width: 1,
              background: "rgba(255,255,255,0.06)",
            }}
          />
          {events.map((ev, i) => (
            <div
              key={i}
              style={{ position: "relative" as const, marginBottom: 20 }}
            >
              {/* Dot */}
              <div
                style={{
                  position: "absolute" as const,
                  left: -21,
                  top: 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: cueColor[ev.level],
                  border: `1px solid ${cueColor[ev.level]}`,
                  boxShadow:
                    ev.level === "critical"
                      ? `0 0 8px ${DANGER}`
                      : undefined,
                }}
              />
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  marginBottom: 3,
                }}
              >
                {ev.date} — {ev.prospect}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                  }}
                >
                  {ev.title}
                </span>
                <span style={{ color: TEXT_MUTED }}>
                  {typeIcon[ev.type]}
                </span>
              </div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>
                {ev.detail}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AtomAletheia() {
  const [activeTab, setActiveTab] = useState<TabId>("live");
  const [sessionSec, setSessionSec] = useState(872);

  useEffect(() => {
    const iv = setInterval(() => setSessionSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const sessionTime = `${String(Math.floor(sessionSec / 3600)).padStart(2, "0")}:${String(
    Math.floor((sessionSec % 3600) / 60)
  ).padStart(2, "0")}:${String(sessionSec % 60).padStart(2, "0")}`;

  const navItems: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[] = [
    { id: "live", label: "Live Session", icon: <Radio size={15} />, badge: "LIVE" },
    { id: "text", label: "Text Analyzer", icon: <MessageSquare size={15} /> },
    { id: "pipeline", label: "Deal Pipeline", icon: <BarChart3 size={15} />, badge: "3 ⚠" },
    { id: "playbook", label: "Playbook Coach", icon: <Layers size={15} /> },
    { id: "architecture", label: "Architecture", icon: <GitBranch size={15} /> },
    { id: "history", label: "Session History", icon: <History size={15} /> },
  ];

  const signalHealth = [
    { label: "VIDEO", pct: 92, color: SONAR },
    { label: "AUDIO", pct: 87, color: SONAR },
    { label: "NLP", pct: 100, color: SUCCESS },
    { label: "FUSION", pct: 89, color: SONAR },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "52px 1fr",
        gridTemplateColumns: "220px 1fr",
        height: "100dvh",
        background: "#020202",
        fontFamily: FONT_FAMILY,
        color: TEXT_PRIMARY,
        overflow: "hidden",
      }}
    >
      {/* ── Topbar ── */}
      <header
        style={{
          gridColumn: "1 / -1",
          gridRow: "1",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 16,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "#0d0d10",
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <svg
            viewBox="0 0 28 28"
            fill="none"
            width={28}
            height={28}
            aria-label="ATOM Aletheia"
          >
            <polygon
              points="14,2 26,22 2,22"
              stroke={ACCENT}
              strokeWidth="1.5"
              fill="none"
            />
            <polygon
              points="14,7 21,20 7,20"
              stroke={ACCENT}
              strokeWidth="0.8"
              fill={`${ACCENT}10`}
            />
            <circle cx="14" cy="14" r="2.5" fill={ACCENT} />
            <line
              x1="14"
              y1="5.5"
              x2="14"
              y2="11.5"
              stroke={ACCENT}
              strokeWidth="1"
              opacity="0.5"
            />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: TEXT_PRIMARY,
              }}
            >
              ATOM Aletheia
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: ACCENT,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              Truth Intelligence
            </div>
          </div>
        </div>

        {/* Separator */}
        <div
          style={{
            width: 1,
            height: 28,
            background: "rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        />

        {/* Session info */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: SONAR,
              boxShadow: `0 0 0 0 ${SONAR}`,
              animation: "aletheiaPulse 2s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: TEXT_MUTED,
              letterSpacing: "0.04em",
            }}
          >
            SESSION ACTIVE · PROSPECT: APEX CORP · {sessionTime}
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.06em",
            marginLeft: 4,
          }}
        >
          Multimodal Deception Intelligence · Powered by Hume AI
        </div>

        <div style={{ flex: 1 }} />

        {/* Channel pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {["VIDEO", "VOICE", "TEXT/SMS", "EMAIL"].map((ch, i) => (
            <button
              key={ch}
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${i === 0 ? ACCENT : "rgba(255,255,255,0.1)"}`,
                background: i === 0 ? `${ACCENT}15` : "transparent",
                color: i === 0 ? ACCENT : TEXT_MUTED,
                cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        {/* Rec button */}
        <button
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 10,
            padding: "5px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: TEXT_MUTED,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: DANGER,
            }}
          />
          REC
        </button>

        {/* Live session button */}
        <button
          onClick={() => setActiveTab("live")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 600,
            padding: "5px 14px",
            borderRadius: 999,
            background: ACCENT,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#fff",
              opacity: 0.8,
            }}
          />
          LIVE SESSION
        </button>
      </header>

      {/* ── Sidebar ── */}
      <nav
        style={{
          gridColumn: "1",
          gridRow: "2",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "#0d0d10",
          overflowY: "auto" as const,
          display: "flex",
          flexDirection: "column" as const,
        }}
      >
        <div style={{ padding: "12px 12px 8px" }}>
          <SectionLabel>Analysis</SectionLabel>
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 8px",
                borderRadius: 6,
                background:
                  activeTab === item.id
                    ? "rgba(105,106,172,0.12)"
                    : "transparent",
                border: "none",
                color: activeTab === item.id ? TEXT_PRIMARY : TEXT_MUTED,
                cursor: "pointer",
                fontSize: 13,
                position: "relative" as const,
                textAlign: "left" as const,
                marginBottom: 2,
              }}
            >
              {activeTab === item.id && (
                <div
                  style={{
                    position: "absolute" as const,
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: 2,
                    background: ACCENT,
                    borderRadius: "0 2px 2px 0",
                  }}
                />
              )}
              <span
                style={{
                  color: activeTab === item.id ? ACCENT : TEXT_MUTED,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    background: `${ACCENT}15`,
                    color: ACCENT,
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.06)",
            margin: "4px 12px",
          }}
        />

        <div style={{ padding: "8px 12px" }}>
          <SectionLabel>Intelligence</SectionLabel>
          {navItems.slice(4).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 8px",
                borderRadius: 6,
                background:
                  activeTab === item.id
                    ? "rgba(105,106,172,0.12)"
                    : "transparent",
                border: "none",
                color: activeTab === item.id ? TEXT_PRIMARY : TEXT_MUTED,
                cursor: "pointer",
                fontSize: 13,
                position: "relative" as const,
                textAlign: "left" as const,
                marginBottom: 2,
              }}
            >
              {activeTab === item.id && (
                <div
                  style={{
                    position: "absolute" as const,
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: 2,
                    background: ACCENT,
                    borderRadius: "0 2px 2px 0",
                  }}
                />
              )}
              <span
                style={{
                  color: activeTab === item.id ? ACCENT : TEXT_MUTED,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.06)",
            margin: "4px 12px",
          }}
        />

        {/* Signal Health */}
        <div style={{ padding: 12 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                color: TEXT_MUTED,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Signal Health
            </div>
            {signalHealth.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: TEXT_MUTED,
                    fontFamily: "monospace",
                    width: 44,
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 3,
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${s.pct}%`,
                      height: "100%",
                      background: s.color,
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 9,
                    color: TEXT_MUTED,
                    width: 24,
                    textAlign: "right" as const,
                  }}
                >
                  {s.pct === 100 ? "OK" : s.pct}
                </span>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main
        style={{
          gridColumn: "2",
          gridRow: "2",
          overflowY: "auto" as const,
          background: "#020202",
        }}
      >
        {activeTab === "live" && <TabLive />}
        {activeTab === "text" && <TabText />}
        {activeTab === "pipeline" && <TabPipeline />}
        {activeTab === "playbook" && <TabPlaybook />}
        {activeTab === "architecture" && <TabArchitecture />}
        {activeTab === "history" && <TabHistory />}
      </main>

      {/* Global keyframes */}
      <style>{`
        @keyframes aletheiaPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 ${SONAR}66; }
          50%       { opacity: 0.7; box-shadow: 0 0 0 6px ${SONAR}00; }
        }
        @keyframes aletheiaWave {
          from { opacity: 0.45; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
