import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useCalls, type CallRecord } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  PhoneCall, Phone, PhoneOff, Mic, MicOff, User, Building2,
  TrendingUp, Brain, Zap, Clock, CheckCircle2, AlertTriangle,
  MessageSquare, Users, BarChart3, Target, Radio, ArrowRight,
  ChevronDown, ChevronUp, Download, Flag, UserCheck, Activity,
  Loader2, Circle
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import type { Product } from "@shared/schema";
import { HumeVoiceCallWrapper } from "@/components/HumeVoiceCall";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptMessage {
  speaker: "ATOM" | "Contact";
  text: string;
  timestamp: number;
}

interface SentimentPoint {
  time: number;
  score: number;
}

interface EmotionalTones {
  curious: number;
  interested: number;
  skeptical: number;
  frustrated: number;
  excited: number;
  neutral: number;
}

interface Qualification {
  qualified: boolean;
  score: number;
  keySignals: string[];
  objections: string[];
}

interface SimulateResponse {
  transcript: TranscriptMessage[];
  sentimentTimeline: SentimentPoint[];
  intentTimeline: SentimentPoint[];
  emotionalTones: EmotionalTones;
  qualification: Qualification;
  outcome: "qualified" | "follow-up" | "no-interest" | "callback";
  duration: number;
  aiRecommendations: string[];
}

interface QueuedCall {
  id: number;
  companyName: string;
  contactName: string;
  contactTitle: string;
  productSlug: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  result?: SimulateResponse;
}

// ─── Radial Gauge Component ────────────────────────────────────────────────────

function RadialGauge({
  value,
  label,
  size = 120,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const radius = (size - 16) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const color =
    value >= 70
      ? "#10b981"
      : value >= 40
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size / 2 + 12 }}>
        <svg
          width={size}
          height={size / 2 + 12}
          viewBox={`0 0 ${size} ${size / 2 + 12}`}
        >
          {/* Background arc */}
          <path
            d={`M ${8} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <path
            d={`M ${8} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
          />
          {/* Value text */}
          <text
            x={size / 2}
            y={size / 2 - 4}
            textAnchor="middle"
            fill={color}
            fontSize="18"
            fontWeight="bold"
            style={{ transition: "fill 0.5s ease" }}
          >
            {Math.round(value)}
          </text>
        </svg>
      </div>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

// ─── Qualification Badge ───────────────────────────────────────────────────────

function QualBadge({ score }: { score: number }) {
  if (score >= 80)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
        <Zap className="w-3 h-3 mr-1" /> Hot Lead
      </Badge>
    );
  if (score >= 60)
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30">
        <TrendingUp className="w-3 h-3 mr-1" /> Qualified
      </Badge>
    );
  if (score >= 35)
    return (
      <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30">
        <Activity className="w-3 h-3 mr-1" /> Warming
      </Badge>
    );
  return (
    <Badge className="bg-muted text-muted-foreground">
      <Circle className="w-3 h-3 mr-1" /> Unqualified
    </Badge>
  );
}

// ─── Outcome Badge ─────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    qualified: "bg-emerald-500/15 text-emerald-500",
    "follow-up": "bg-blue-500/15 text-blue-500",
    "no-interest": "bg-muted text-muted-foreground",
    callback: "bg-amber-500/15 text-amber-500",
  };
  const labels: Record<string, string> = {
    qualified: "Qualified",
    "follow-up": "Follow-up",
    "no-interest": "No Interest",
    callback: "Callback",
  };
  return (
    <Badge className={`text-[10px] ${styles[outcome] || "bg-muted text-muted-foreground"}`}>
      {labels[outcome] || outcome}
    </Badge>
  );
}

// ─── Format seconds ────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Live Call Dashboard ───────────────────────────────────────────────────────

function LiveCallDashboard({
  queuedCall,
  result,
  onCallEnd,
}: {
  queuedCall: QueuedCall;
  result: SimulateResponse;
  onCallEnd: (result: SimulateResponse) => void;
}) {
  const [visibleMessages, setVisibleMessages] = useState<TranscriptMessage[]>([]);
  const [currentSentiment, setCurrentSentiment] = useState(result.sentimentTimeline[0]?.score ?? 30);
  const [currentIntent, setCurrentIntent] = useState(result.intentTimeline[0]?.score ?? 10);
  const [currentTones, setCurrentTones] = useState<EmotionalTones>({
    curious: 10,
    interested: 10,
    skeptical: 20,
    frustrated: 5,
    excited: 5,
    neutral: 50,
  });
  const [qualScore, setQualScore] = useState(15);
  const [aiRec, setAiRec] = useState("Initiating call...");
  const [elapsed, setElapsed] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [callEnded, setCallEnded] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const msgIndexRef = useRef(0);
  const { toast } = useToast();

  const totalMessages = result.transcript.length;
  const sentTimeline = result.sentimentTimeline;
  const intentTimeline = result.intentTimeline;

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  // Call timer
  useEffect(() => {
    if (!isActive) return;
    timerRef.current = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Playback messages
  useEffect(() => {
    if (!isActive) return;

    const playNext = () => {
      const idx = msgIndexRef.current;
      if (idx >= totalMessages) {
        // Call complete
        clearInterval(intervalRef.current!);
        clearInterval(timerRef.current!);
        setIsTyping(false);
        setIsActive(false);
        setCallEnded(true);
        // Final state
        setCurrentSentiment(sentTimeline[sentTimeline.length - 1]?.score ?? 70);
        setCurrentIntent(intentTimeline[intentTimeline.length - 1]?.score ?? 70);
        setCurrentTones(result.emotionalTones);
        setQualScore(result.qualification.score);
        setAiRec(result.aiRecommendations[result.aiRecommendations.length - 1] || "Call complete");
        return;
      }

      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setVisibleMessages((prev) => [...prev, result.transcript[idx]]);
        msgIndexRef.current = idx + 1;

        // Update metrics proportionally
        const progress = (idx + 1) / totalMessages;

        // Interpolate sentiment
        const sentIdx = Math.min(
          Math.floor(progress * sentTimeline.length),
          sentTimeline.length - 1
        );
        setCurrentSentiment(sentTimeline[sentIdx]?.score ?? currentSentiment);

        // Interpolate intent
        const intIdx = Math.min(
          Math.floor(progress * intentTimeline.length),
          intentTimeline.length - 1
        );
        setCurrentIntent(intentTimeline[intIdx]?.score ?? currentIntent);

        // Gradually update emotional tones
        const toneProgress = Math.min(progress * 1.5, 1);
        setCurrentTones((prev) => {
          const target = result.emotionalTones;
          return {
            curious: prev.curious + (target.curious - prev.curious) * toneProgress * 0.3,
            interested: prev.interested + (target.interested - prev.interested) * toneProgress * 0.3,
            skeptical: prev.skeptical + (target.skeptical - prev.skeptical) * toneProgress * 0.3,
            frustrated: prev.frustrated + (target.frustrated - prev.frustrated) * toneProgress * 0.3,
            excited: prev.excited + (target.excited - prev.excited) * toneProgress * 0.3,
            neutral: prev.neutral + (target.neutral - prev.neutral) * toneProgress * 0.3,
          };
        });

        // Update qual score
        const targetQual = result.qualification.score;
        setQualScore((prev) => prev + (targetQual - prev) * 0.15);

        // Update AI recommendation
        const recIdx = Math.floor((progress * result.aiRecommendations.length));
        if (result.aiRecommendations[recIdx]) {
          setAiRec(result.aiRecommendations[recIdx]);
        }
      }, 1200);
    };

    intervalRef.current = window.setInterval(playNext, 2800);
    playNext(); // Play first message immediately

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsActive(false);
    setCallEnded(true);
    onCallEnd(result);
  };

  const toneData = [
    { name: "Curious", value: Math.round(currentTones.curious), color: "#06b6d4" },
    { name: "Interested", value: Math.round(currentTones.interested), color: "#10b981" },
    { name: "Skeptical", value: Math.round(currentTones.skeptical), color: "#f59e0b" },
    { name: "Frustrated", value: Math.round(currentTones.frustrated), color: "#ef4444" },
    { name: "Excited", value: Math.round(currentTones.excited), color: "#8b5cf6" },
    { name: "Neutral", value: Math.round(currentTones.neutral), color: "#6b7280" },
  ];

  return (
    <div className="space-y-4">
      {/* Call header */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isActive ? "bg-rose-500 animate-pulse" : "bg-muted"}`} />
          <div>
            <p className="font-semibold text-sm">
              {callEnded ? "Call Complete" : `ATOM calling ${queuedCall.contactName} at ${queuedCall.companyName}`}
            </p>
            <p className="text-xs text-muted-foreground">{queuedCall.contactTitle || "Decision Maker"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">{formatDuration(elapsed)}</span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Recording
            </div>
          )}
          {callEnded && (
            <OutcomeBadge outcome={result.outcome} />
          )}
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Transcript */}
        <div className="lg:col-span-1">
          <Card className="border-border/50 h-full">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div
                ref={transcriptRef}
                className="space-y-3 overflow-y-auto"
                style={{ maxHeight: "340px" }}
              >
                {visibleMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${msg.speaker === "ATOM" ? "" : "flex-row-reverse"}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${msg.speaker === "ATOM" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {msg.speaker === "ATOM" ? "A" : "C"}
                    </div>
                    <div
                      className={`max-w-[85%] p-2.5 rounded-xl text-xs leading-relaxed ${msg.speaker === "ATOM" ? "bg-primary/10 text-foreground" : "bg-muted/50 text-foreground"}`}
                    >
                      <p className={`text-[9px] font-semibold mb-1 ${msg.speaker === "ATOM" ? "text-primary" : "text-muted-foreground"}`}>
                        {msg.speaker === "ATOM" ? "ATOM" : queuedCall.contactName} · {formatDuration(msg.timestamp)}
                      </p>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary/20 text-primary text-[10px] font-bold">A</div>
                    <div className="bg-primary/10 p-2.5 rounded-xl">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                {visibleMessages.length === 0 && !isTyping && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Connecting call...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER: Metrics */}
        <div className="lg:col-span-1 space-y-3">
          {/* Gauges */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex justify-around">
                <RadialGauge value={currentSentiment} label="Sentiment" />
                <RadialGauge value={currentIntent} label="Buyer Intent" />
              </div>
            </CardContent>
          </Card>

          {/* Emotional Tones */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Emotional Tones</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {toneData.map((tone) => (
                <div key={tone.name} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16 shrink-0">{tone.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${tone.value}%`, backgroundColor: tone.color }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">{tone.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Qualification + AI Rec */}
          <Card className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Qualification</span>
                <QualBadge score={qualScore} />
              </div>
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> AI Recommendation
                </p>
                <p className="text-xs text-foreground leading-relaxed">{aiRec}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Contact info + signals */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Contact Intel
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              <div className="p-2.5 rounded-lg bg-card border border-border/50 space-y-1">
                <p className="text-xs font-semibold">{queuedCall.companyName}</p>
                <p className="text-[10px] text-muted-foreground">Target account</p>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium">{queuedCall.contactName}</p>
                </div>
                {queuedCall.contactTitle && (
                  <p className="text-[10px] text-muted-foreground">{queuedCall.contactTitle}</p>
                )}
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-0.5">Product</p>
                <p className="text-xs font-medium capitalize">{queuedCall.productSlug.replace(/-/g, " ")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Objections detected */}
          {callEnded && result.qualification.objections.length > 0 && (
            <Card className="border-border/50 border-l-2 border-l-amber-500">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Objections Detected
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                {result.qualification.objections.map((obj, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{obj}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Key signals */}
          {callEnded && result.qualification.keySignals.length > 0 && (
            <Card className="border-border/50 border-l-2 border-l-emerald-500">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Key Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1.5">
                {result.qualification.keySignals.map((sig, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{sig}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50">
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndCall}
            disabled={callEnded}
            className="gap-1.5"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End Call
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!callEnded}>
            <UserCheck className="w-3.5 h-3.5" />
            Transfer
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Flag className="w-3.5 h-3.5" />
            Flag
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {callEnded
            ? `Call ended · ${formatDuration(result.duration)}`
            : `${visibleMessages.length}/${totalMessages} messages`}
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Dashboard ───────────────────────────────────────────────────────

function AnalyticsDashboard({ calls }: { calls: CallRecord[] }) {
  const [expandedCall, setExpandedCall] = useState<number | null>(null);

  const completedCalls = calls.filter((c) => c.status === "completed");
  const avgSentiment =
    completedCalls.length > 0
      ? completedCalls.reduce((sum, c) => {
          const st = JSON.parse(c.sentimentTimeline || "[]") as SentimentPoint[];
          const last = st[st.length - 1]?.score ?? 50;
          return sum + last;
        }, 0) / completedCalls.length
      : 0;
  const avgIntent =
    completedCalls.length > 0
      ? completedCalls.reduce((sum, c) => {
          const it = JSON.parse(c.intentTimeline || "[]") as SentimentPoint[];
          const last = it[it.length - 1]?.score ?? 50;
          return sum + last;
        }, 0) / completedCalls.length
      : 0;
  const qualifiedCalls = completedCalls.filter((c) => {
    const q = JSON.parse(c.qualification || "{}") as Qualification;
    return q.score > 70;
  });
  const qualRate =
    completedCalls.length > 0
      ? Math.round((qualifiedCalls.length / completedCalls.length) * 100)
      : 0;

  const outcomeCounts = completedCalls.reduce(
    (acc, c) => {
      acc[c.outcome] = (acc[c.outcome] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const outcomeData = [
    { name: "Qualified", value: outcomeCounts["qualified"] || 0, color: "#10b981" },
    { name: "Follow-up", value: outcomeCounts["follow-up"] || 0, color: "#06b6d4" },
    { name: "No Interest", value: outcomeCounts["no-interest"] || 0, color: "#6b7280" },
    { name: "Callback", value: outcomeCounts["callback"] || 0, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  // Aggregate emotional tones
  const avgTones =
    completedCalls.length > 0
      ? completedCalls.reduce(
          (acc, c) => {
            const t = JSON.parse(c.emotionalTones || "{}") as EmotionalTones;
            return {
              curious: acc.curious + t.curious / completedCalls.length,
              interested: acc.interested + t.interested / completedCalls.length,
              skeptical: acc.skeptical + t.skeptical / completedCalls.length,
              frustrated: acc.frustrated + t.frustrated / completedCalls.length,
              excited: acc.excited + t.excited / completedCalls.length,
              neutral: acc.neutral + t.neutral / completedCalls.length,
            };
          },
          { curious: 0, interested: 0, skeptical: 0, frustrated: 0, excited: 0, neutral: 0 }
        )
      : null;

  const toneChartData = avgTones
    ? [
        { name: "Curious", value: Math.round(avgTones.curious) },
        { name: "Interested", value: Math.round(avgTones.interested) },
        { name: "Skeptical", value: Math.round(avgTones.skeptical) },
        { name: "Frustrated", value: Math.round(avgTones.frustrated) },
        { name: "Excited", value: Math.round(avgTones.excited) },
        { name: "Neutral", value: Math.round(avgTones.neutral) },
      ]
    : [];

  // Use last call's timelines for charts
  const lastCall = completedCalls[0];
  const sentChartData = lastCall
    ? (JSON.parse(lastCall.sentimentTimeline || "[]") as SentimentPoint[]).map((p) => ({
        time: `${p.time}s`,
        Sentiment: p.score,
      }))
    : [];
  const intentChartData = lastCall
    ? (JSON.parse(lastCall.intentTimeline || "[]") as SentimentPoint[]).map((p) => ({
        time: `${p.time}s`,
        Intent: p.score,
      }))
    : [];

  if (completedCalls.length === 0) {
    return (
      <Card className="border-border/50">
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BarChart3 className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No completed calls yet</p>
          <p className="text-xs mt-1">Run your first ATOM call to see analytics</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold">{completedCalls.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total Calls</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold">{Math.round(avgSentiment)}</p>
              <p className="text-xs text-muted-foreground mb-0.5">/100</p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg Sentiment</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold">{Math.round(avgIntent)}</p>
              <p className="text-xs text-muted-foreground mb-0.5">/100</p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg Buyer Intent</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-2xl font-bold text-emerald-500">{qualRate}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Qualification Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Sentiment Over Time (Last Call)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={sentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="Sentiment" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Buyer Intent Progression (Last Call)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={intentChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="Intent" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Emotional Tones Distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={toneChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Call Outcomes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center justify-center">
            {outcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground">No outcome data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call Log Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Call Log
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {completedCalls.map((call) => {
              const qual = JSON.parse(call.qualification || "{}") as Qualification;
              const sentTL = JSON.parse(call.sentimentTimeline || "[]") as SentimentPoint[];
              const intTL = JSON.parse(call.intentTimeline || "[]") as SentimentPoint[];
              const lastSent = sentTL[sentTL.length - 1]?.score ?? 0;
              const lastInt = intTL[intTL.length - 1]?.score ?? 0;
              const transcript = JSON.parse(call.transcript || "[]") as TranscriptMessage[];
              const recs = JSON.parse(call.aiRecommendations || "[]") as string[];
              const isExpanded = expandedCall === call.id;

              return (
                <div key={call.id} className="rounded-lg border border-border/50 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                  >
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-xs">
                      <div>
                        <p className="font-medium truncate">{call.companyName}</p>
                        <p className="text-muted-foreground truncate">{call.contactName}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-muted-foreground">{formatDuration(call.duration)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">S:</span>
                          <span className={lastSent >= 60 ? "text-emerald-500" : lastSent >= 40 ? "text-amber-500" : "text-rose-500"}>
                            {Math.round(lastSent)}
                          </span>
                          <span className="text-muted-foreground ml-1">I:</span>
                          <span className={lastInt >= 60 ? "text-emerald-500" : lastInt >= 40 ? "text-amber-500" : "text-rose-500"}>
                            {Math.round(lastInt)}
                          </span>
                        </div>
                      </div>
                      <div>
                        <OutcomeBadge outcome={call.outcome} />
                      </div>
                      <div className="hidden sm:block text-muted-foreground">
                        {new Date(call.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50 p-3 space-y-3 bg-muted/20">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Transcript</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {transcript.map((msg, i) => (
                              <div key={i} className={`text-xs ${msg.speaker === "ATOM" ? "text-primary" : "text-foreground"}`}>
                                <span className="font-semibold">{msg.speaker === "ATOM" ? "ATOM" : call.contactName}: </span>
                                {msg.text}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Signals</p>
                            {qual.keySignals?.map((s, i) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{s}
                              </p>
                            ))}
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Recommendations</p>
                            {recs.map((r, i) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                <Brain className="w-3 h-3 text-primary mt-0.5 shrink-0" />{r}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AtomLeadGen() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const calls = useCalls();

  // Parse URL params for pre-fill from prospect engine
  const urlParams = new URLSearchParams(location.split("?")[1] || "");
  const prefillCompany = urlParams.get("company") || "";
  const prefillContact = urlParams.get("contact") || "";
  const prefillTitle = urlParams.get("title") || "";
  const prefillProduct = urlParams.get("product") || "";

  const [activeTab, setActiveTab] = useState(prefillCompany ? "campaign" : "campaign");
  const [companyName, setCompanyName] = useState(prefillCompany);
  const [contactName, setContactName] = useState(prefillContact);
  const [contactTitle, setContactTitle] = useState(prefillTitle);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [productSlug, setProductSlug] = useState(prefillProduct);
  const [isLoading, setIsLoading] = useState(false);
  const [queue, setQueue] = useState<QueuedCall[]>([]);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [activeResult, setActiveResult] = useState<SimulateResponse | null>(null);

  const activeQueuedCall = queue.find((q) => q.id === activeCallId) || null;

  const handleStartCall = useCallback(async () => {
    if (!companyName || !contactName || !productSlug) {
      toast({
        title: "Missing info",
        description: "Please fill in company name, contact name, and select a product",
        variant: "destructive",
      });
      return;
    }

    const callId = Date.now();
    const newCall: QueuedCall = {
      id: callId,
      companyName,
      contactName,
      contactTitle,
      productSlug,
      status: "in-progress",
    };
    setQueue((prev) => [newCall, ...prev]);
    setIsLoading(true);

    // Add to store as pending
    store.addCall({
      id: callId,
      companyName,
      contactName,
      contactTitle,
      productSlug,
      transcript: "[]",
      sentimentTimeline: "[]",
      intentTimeline: "[]",
      emotionalTones: "{}",
      qualification: "{}",
      outcome: "pending",
      duration: 0,
      aiRecommendations: "[]",
      createdAt: new Date().toISOString(),
      status: "in-progress",
    });

    try {
      const res = await apiRequest("POST", "/api/atom-leadgen/simulate", {
        companyName,
        contactName,
        contactTitle,
        productSlug,
      });
      const data: SimulateResponse = await res.json();

      setQueue((prev) =>
        prev.map((q) => (q.id === callId ? { ...q, status: "in-progress", result: data } : q))
      );
      setActiveCallId(callId);
      setActiveResult(data);
      setActiveTab("live");
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) => (q.id === callId ? { ...q, status: "failed" } : q))
      );
      store.updateCall(callId, { status: "failed" });
      toast({
        title: "Call failed",
        description: err.message || "Failed to simulate call",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyName, contactName, contactTitle, productSlug, toast]);

  const handleCallEnd = useCallback(
    (result: SimulateResponse) => {
      if (!activeCallId) return;

      setQueue((prev) =>
        prev.map((q) => (q.id === activeCallId ? { ...q, status: "completed" } : q))
      );

      store.updateCall(activeCallId, {
        transcript: JSON.stringify(result.transcript),
        sentimentTimeline: JSON.stringify(result.sentimentTimeline),
        intentTimeline: JSON.stringify(result.intentTimeline),
        emotionalTones: JSON.stringify(result.emotionalTones),
        qualification: JSON.stringify(result.qualification),
        outcome: result.outcome,
        duration: result.duration,
        aiRecommendations: JSON.stringify(result.aiRecommendations),
        status: "completed",
      });

      toast({
        title: "Call complete",
        description: `${companyName} · Outcome: ${result.outcome} · Intent: ${result.intentTimeline[result.intentTimeline.length - 1]?.score ?? 0}%`,
      });
    },
    [activeCallId, companyName, toast]
  );

  const queueStatusColors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    "in-progress": "bg-primary/15 text-primary",
    completed: "bg-emerald-500/15 text-emerald-500",
    failed: "bg-rose-500/15 text-rose-500",
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <PhoneCall className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">ATOM Lead Gen</h1>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
              BETA
            </span>
          </div>
          <p className="text-sm text-muted-foreground">AI-powered voice cold caller with live sentiment analysis</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="campaign">Campaign</TabsTrigger>
          <TabsTrigger value="voice">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3" />
              Live Voice
            </span>
          </TabsTrigger>
          <TabsTrigger value="live" disabled={!activeResult}>
            <span className="flex items-center gap-1.5">
              Sim Call
              {activeResult && !queue.find((q) => q.id === activeCallId && q.status === "completed") && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ── TAB: Live Voice (Hume EVI) ── */}
        <TabsContent value="voice" className="mt-4">
          <HumeVoiceCallWrapper
            companyName={companyName || "Target Company"}
            contactName={contactName || "Decision Maker"}
            productName={products.find(p => p.slug === productSlug)?.name || "Antimatter AI"}
            productSlug={productSlug || "antimatter-ai"}
          />
        </TabsContent>

        {/* ── TAB 1: Campaign ── */}
        <TabsContent value="campaign" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input form */}
            <Card className="border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Start New Call
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Company Name *</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Corp"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Contact Name *</Label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Smith"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Title / Role</Label>
                    <Input
                      value={contactTitle}
                      onChange={(e) => setContactTitle(e.target.value)}
                      placeholder="VP of Engineering"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Phone (optional)</Label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 555-0100"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Product to Pitch *</Label>
                  <Select value={productSlug} onValueChange={setProductSlug}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select a product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="w-full gap-2"
                    onClick={handleStartCall}
                    disabled={isLoading || !companyName || !contactName || !productSlug}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Simulating...</>
                    ) : (
                      <><Brain className="w-4 h-4" />AI Simulate</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                    onClick={async () => {
                      if (!phoneNumber) {
                        toast({ title: "Phone required", description: "Enter a phone number to dial", variant: "destructive" });
                        return;
                      }
                      try {
                        const res = await apiRequest("POST", "/api/atom-leadgen/call", {
                          phoneNumber,
                          contactName,
                          companyName,
                          productSlug,
                        });
                        const data = await res.json();
                        toast({ title: "Call initiated", description: `Dialing ${contactName || phoneNumber}... SID: ${data.callSid?.slice(-6)}` });
                      } catch (err: any) {
                        toast({ title: "Call failed", description: err.message, variant: "destructive" });
                      }
                    }}
                    disabled={!phoneNumber || !companyName}
                  >
                    <Phone className="w-4 h-4" />Dial (Twilio)
                  </Button>
                </div>

                {isLoading && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Brain className="w-4 h-4 animate-pulse" />
                      <span className="font-medium">ATOM generating realistic cold call simulation...</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Campaign queue */}
            <Card className="border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Campaign Queue
                  {queue.length > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px]">{queue.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <PhoneCall className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs">No calls queued yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queue.map((q) => (
                      <div
                        key={q.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${q.id === activeCallId ? "border-primary/40 bg-primary/5" : "border-border/50"}`}
                        onClick={() => {
                          if (q.result) {
                            setActiveCallId(q.id);
                            setActiveResult(q.result);
                            setActiveTab("live");
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{q.companyName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{q.contactName} · {q.productSlug.replace(/-/g, " ")}</p>
                        </div>
                        <Badge className={`text-[10px] ${queueStatusColors[q.status]}`}>
                          {q.status === "in-progress" && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                          {q.status}
                        </Badge>
                        {q.result && (
                          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: Live Call ── */}
        <TabsContent value="live" className="mt-4">
          {activeQueuedCall && activeResult ? (
            <LiveCallDashboard
              key={activeCallId!}
              queuedCall={activeQueuedCall}
              result={activeResult}
              onCallEnd={handleCallEnd}
            />
          ) : (
            <Card className="border-border/50">
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Phone className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">No active call</p>
                <p className="text-xs mt-1">Start a call from the Campaign tab</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveTab("campaign")}
                >
                  Go to Campaign
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 3: Analytics ── */}
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsDashboard calls={calls} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
