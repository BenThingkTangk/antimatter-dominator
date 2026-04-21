import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Eye,
  Shield,
  Brain,
  AlertTriangle,
  Target,
  Zap,
  MessageSquare,
  Mail,
  Clock,
  TrendingUp,
  ChevronRight,
  Mic,
  History,
  Loader2,
  Linkedin,
  Copy,
  CheckCircle2,
  Trash2,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Crosshair,
  Ghost,
  Flame,
  Lightbulb,
  BookOpen,
  X,
  Swords,
  Activity,
  Signal,
  Users,
  FileText,
  UserPlus,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  Phone,
  Network,
  Radar,
  Check,
  Plus,
  Radio,
  Sparkles,
  RefreshCw,
  Send,
  Download,
  ChevronRight as ArrowRightIcon,
} from "lucide-react";
import {
  loadDeals,
  createDeal,
  updateDeal,
  deleteDeal,
  flagAsHVT,
  linkAnalysisToDeal,
  addStakeholder,
  updateStakeholder,
  removeStakeholder,
  addSignal,
  firePlay,
  acknowledgePlay,
  multithreadingScore,
  stallDays,
  canAdvanceStage,
  dealStats,
  findDealByCompany,
  getDeal,
  onWarRoomEvent,
  updatePackageSection,
  markPackageGenerating,
  addDailyBrief,
  updateTargetTier,
  type Deal,
  type Stakeholder,
  type CompanySignal,
  type IntelAnalysis,
  type Play,
  type DealStage,
  type StakeholderRole,
  type ThreatLevel,
  type SignalType,
  type TargetPackage,
  type PackageSection,
  type PackageStatus,
  type TargetTier,
} from "@/lib/warroom-store";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "command" | "intel" | "operator" | "pipeline" | "playbook" | "history" | "ghostops";
type ChannelId = "email" | "call_transcript" | "sms" | "linkedin";

interface Flag {
  type: string;
  severity: "high" | "medium" | "low";
  phrase: string;
  explanation: string;
}

interface HighlightedPhrase {
  phrase: string;
  color: "red" | "amber" | "green";
  reason: string;
}

interface DeceptionLayer {
  hedgePct: number;
  evasionPct: number;
  stallProbability: number;
  authorityDeflection: number;
  budgetFabrication: number;
  timelineVagueness: number;
  overEnthusiasm: number;
}

interface LinguisticCues {
  passiveVoice: number;
  distancingLanguage: number;
  overCertainty: number;
  nonAnswerRatio: number;
  commitmentLanguage: number;
  implementationLanguage: number;
  urgencyLanguage: number;
}

interface NegotiationPosture {
  powerScore: number;
  urgencyScore: number;
  commitmentScore: number;
  concessionPattern: string;
  leveragePosition: string;
}

interface CompetitiveRadar {
  competitorMentioned: boolean;
  competitors: string[];
  competitiveRiskLevel: string;
  competitiveTalkingPoints: string[];
}

interface IntentSignal {
  signal: string;
  type: string;
  strength: "strong" | "moderate" | "weak";
}

interface Playbook {
  move: string;
  tactic: string;
  signal: string;
  nextBestActions?: string[];
}

interface GhostResurrection {
  isGhosted: boolean;
  reEngagementMessage: string;
  reEngagementStrategy: string;
}

interface AnalysisResult {
  truthScore: number;
  aletheiaTruthScore?: number;
  overallRisk: string;
  dealRisk: string;
  urgency: string;
  deceptionLayer: DeceptionLayer;
  flags: Flag[];
  highlightedPhrases: HighlightedPhrase[];
  linguisticCues: LinguisticCues;
  negotiationPosture: NegotiationPosture;
  competitiveRadar: CompetitiveRadar;
  intentSignals: IntentSignal[];
  buyerIntentState: string;
  ghostProbability: number;
  suggestedReplies: string[];
  playbook: Playbook;
  ghostResurrection: GhostResurrection;
  summary: string;
  channel: string;
  analyzedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS: { id: ChannelId; label: string; icon: any }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "call_transcript", label: "Call Transcript", icon: Mic },
  { id: "sms", label: "SMS/Text", icon: MessageSquare },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
];

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "command", label: "Command Center", icon: Activity },
  { id: "intel", label: "Intel Analyzer", icon: Eye },
  { id: "operator", label: "Operator Intel", icon: Users },
  { id: "pipeline", label: "Deal Pipeline", icon: BarChart3 },
  { id: "playbook", label: "Playbook Engine", icon: BookOpen },
  { id: "history", label: "War History", icon: History },
  { id: "ghostops", label: "Ghost Ops", icon: Ghost },
];

const SAMPLE_EMAIL = `Hi,\n\nThank you for the proposal. The team believes there is a strong fit. However, due to some internal reprioritization we need to pause the evaluation for now. We would love to revisit in a few months when things settle down. Definitely keeping you top of mind.\n\nBest,\nJames`;
const SAMPLE_TRANSCRIPT = `Yeah absolutely, we're very interested. The CEO is very bullish on this. It's definitely a top priority for us right now. We just need to circle back after next quarter when things settle down. Our VP of Engineering thinks it's a strong fit but we have some internal reprioritization happening. We'll definitely get back to you soon — no question about it.`;
const SAMPLE_SMS = `Hey, just wanted to check in. We are still very interested but the decision has been pushed to next quarter. Our CEO is very bullish on this and thinks it's a great fit. We will definitely circle back soon.`;

const STAGE_ORDER: DealStage[] = ["discovery", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];

const STAKEHOLDER_ROLES: { id: StakeholderRole; label: string; icon: string }[] = [
  { id: "economic_buyer", label: "Economic Buyer", icon: "🏆" },
  { id: "technical", label: "Technical Gatekeeper", icon: "🧠" },
  { id: "champion", label: "Champion", icon: "💚" },
  { id: "blocker", label: "Blocker", icon: "🚨" },
  { id: "ghost", label: "Ghost", icon: "👻" },
  { id: "unknown", label: "Unknown", icon: "❓" },
];

const SIGNAL_TYPES: { id: SignalType; label: string; color: string }[] = [
  { id: "funding", label: "Funding", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "leadership", label: "Leadership", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { id: "job_posting", label: "Job Posting", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  { id: "tech_change", label: "Tech Change", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  { id: "news", label: "News", color: "bg-white/10 text-white/60 border-white/20" },
  { id: "contract_win", label: "Contract Win", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { id: "earnings", label: "Earnings", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
];

// ─── useDeals hook ────────────────────────────────────────────────────────────

function useDeals() {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());
  useEffect(() => {
    const refresh = () => setDeals(loadDeals());
    const unsub = onWarRoomEvent(refresh);
    return unsub;
  }, []);
  return { deals, refresh: () => setDeals(loadDeals()) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts: number): string {
  if (!ts) return "—";
  const h = (Date.now() - ts) / 3.6e6;
  if (h < 1) { const m = Math.floor((Date.now() - ts) / 60000); return m <= 1 ? "just now" : `${m}m ago`; }
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTruthScore(r: AnalysisResult): number {
  return r.truthScore ?? r.aletheiaTruthScore ?? 0;
}

const riskColor = (r: string) => {
  const l = r?.toLowerCase();
  if (l === "high" || l === "ghost" || l === "dead" || l === "at_risk") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (l === "medium" || l === "caution") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
};

const sevColor = (s: string) => s === "high" ? "text-rose-400" : s === "medium" ? "text-amber-400" : "text-emerald-400";
const scoreColor = (n: number) => n >= 70 ? "#1dd1a1" : n >= 40 ? "#fbbf24" : "#f87171";
const intentLabel = (s: string) => (s || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const phraseColor = (c: string) => c === "red" ? "bg-rose-500/20 border-rose-500/30 text-rose-300" : c === "amber" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300";
const strengthColor = (s: string) => s === "strong" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : s === "moderate" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/40 border-white/10";

const CRIMSON_BTN_STYLE = {
  background: "linear-gradient(93.92deg, #f87171 -13.51%, #dc2626 40.91%, #b91c1c 113.69%)",
  boxShadow: "0 0 15px rgba(220,38,38,0.4), inset 0 0 2px rgba(255,255,255,0.3)",
  color: "#fff",
};

function stageLabel(s: DealStage): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function threatColor(t: ThreatLevel) {
  if (t === "critical") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (t === "elevated") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
}

function signalBadgeColor(type: SignalType): string {
  return SIGNAL_TYPES.find(s => s.id === type)?.color ?? "bg-white/10 text-white/50 border-white/20";
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">{children}</span>;
}

function TruthGauge({ score }: { score: number }) {
  const r = 50, c = 2 * Math.PI * r, filled = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={score >= 70 ? "#1dd1a1" : score >= 40 ? "#fbbf24" : "url(#gaugeGrad)"}
            strokeWidth="10"
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="text-[10px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Truth Score™</p>
    </div>
  );
}

function SmallScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 tabular-nums"
      style={{ background: `rgba(${score >= 70 ? "29,209,161" : score >= 40 ? "251,191,36" : "220,38,38"},0.12)`, color, border: `1.5px solid ${color}40` }}>
      {score || "—"}
    </div>
  );
}

function MiniScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 tabular-nums"
      style={{ background: `rgba(${score >= 70 ? "29,209,161" : score >= 40 ? "251,191,36" : "220,38,38"},0.12)`, color, border: `1.5px solid ${color}40` }}>
      {score}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 font-mono truncate pr-2">{label}</span>
        <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function EngagementBar({ value }: { value: number }) {
  const color = value >= 70 ? "#1dd1a1" : value >= 40 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#111113] shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <span className="text-[14px] font-semibold text-[#f6f6fd]">{title}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-all">
            <X size={14} className="text-white/40" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <MonoLabel>{label}</MonoLabel>
      {children}
    </div>
  );
}

const INPUT_CLS = "w-full px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none transition-colors";
const INPUT_STYLE = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

// ─── TAB 1: Command Center ────────────────────────────────────────────────────

function CommandCenterTab({ deals, onTabChange }: { deals: Deal[]; onTabChange: (t: TabId) => void }) {
  const { toast } = useToast();
  const stats = dealStats();
  const hvtDeals = deals.filter(d => d.isHVT);
  const allPlays = deals.flatMap(d => d.plays.map(p => ({ ...p, deal: d }))).filter(p => !p.acknowledged).sort((a, b) => b.firedAt - a.firedAt).slice(0, 5);
  const recentMovements = deals.filter(d => d.truthHistory.length >= 2).sort((a, b) => {
    const latestA = a.truthHistory[a.truthHistory.length - 1]?.at ?? 0;
    const latestB = b.truthHistory[b.truthHistory.length - 1]?.at ?? 0;
    return latestB - latestA;
  }).slice(0, 5);

  function handleAck(dealId: string, playId: string) {
    acknowledgePlay(dealId, playId);
    toast({ title: "Play acknowledged", description: "Order marked complete." });
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(220,38,38,0.08)", border: "1.5px solid rgba(220,38,38,0.2)" }}>
          <Swords size={28} className="text-red-500/60" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="text-[15px] font-semibold text-[#f6f6fd]">No active deals.</p>
          <p className="text-[13px] text-white/40 leading-relaxed">Flag an account as HVT from ATOM Prospect, Lead Gen, or Market Intent to deploy the Von Clausewitz Engine.</p>
        </div>
        <button
          onClick={() => onTabChange("pipeline")}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all hover:scale-[1.02]"
          style={CRIMSON_BTN_STYLE}
        >
          <Plus size={13} /> Add First Deal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Deals", value: stats.total, icon: Briefcase, color: "#f87171" },
          { label: "HVT Accounts", value: stats.hvt, icon: Target, color: "#dc2626" },
          { label: "Avg TRUTH Score", value: stats.avgTruth, icon: TrendingUp, color: scoreColor(stats.avgTruth) },
          { label: "Open Plays", value: stats.openPlays, icon: Zap, color: stats.openPlays > 0 ? "#fbbf24" : "#1dd1a1" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <MonoLabel>{card.label}</MonoLabel>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18` }}>
                  <Icon size={13} style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums" style={{ color: card.color }}>{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* HVT Accounts */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-red-400" />
              <span className="text-[13px] font-semibold text-[#f6f6fd]">HVT Accounts</span>
            </div>
            <MonoLabel>{hvtDeals.length} tracked</MonoLabel>
          </div>
          {hvtDeals.length === 0 ? (
            <p className="text-[12px] text-white/30 text-center py-6">No HVT accounts. Flag deals from the Pipeline.</p>
          ) : (
            <div className="space-y-2">
              {hvtDeals.map(deal => {
                const ms = multithreadingScore(deal);
                const sd = stallDays(deal);
                return (
                  <div key={deal.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <MiniScoreCircle score={deal.truthScore} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-[#f6f6fd] truncate">{deal.company}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.15)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>🎯 HVT</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${riskColor(deal.risk)}`}>{deal.risk}</span>
                        <span className="text-[10px] text-white/30">{ms.engaged}/{ms.required} engaged</span>
                        {sd > 0 && <span className={`text-[10px] font-mono ${sd > 7 ? "text-rose-400" : "text-white/30"}`}>{sd}d stall</span>}
                      </div>
                    </div>
                    <button onClick={() => onTabChange("operator")} className="text-white/20 hover:text-white/60 transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Plays Feed */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-[13px] font-semibold text-[#f6f6fd]">Active Plays</span>
            </div>
            {allPlays.length > 0 && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">{allPlays.length} pending</span>}
          </div>
          {allPlays.length === 0 ? (
            <p className="text-[12px] text-white/30 text-center py-6">No pending plays. Fire plays from the Pipeline or Playbook.</p>
          ) : (
            <div className="space-y-2">
              {allPlays.map(play => (
                <div key={play.id} className="p-3 rounded-lg space-y-2" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.12)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold text-amber-300">{play.name}</span>
                        <span className="text-[9px] font-mono text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">{play.deal.company}</span>
                      </div>
                      <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{play.tactic}</p>
                    </div>
                    <button
                      onClick={() => handleAck(play.deal.id, play.id)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                    >
                      <Check size={9} /> Ack
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-white/20 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">trigger: {play.trigger}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${play.urgency === "critical" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : play.urgency === "high" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/30 border-white/10"}`}>{play.urgency}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TRUTH Score Movements */}
      {recentMovements.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-[13px] font-semibold text-[#f6f6fd]">Recent TRUTH Score Movements</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentMovements.map(deal => {
              const history = deal.truthHistory;
              const prev = history[history.length - 2]?.score ?? history[0]?.score ?? deal.truthScore;
              const curr = history[history.length - 1]?.score ?? deal.truthScore;
              const delta = curr - prev;
              return (
                <div key={deal.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <MiniScoreCircle score={curr} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#f6f6fd] truncate">{deal.company}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[11px] font-mono font-bold ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-white/40"}`}>
                        {delta > 0 ? "+" : ""}{delta}
                      </span>
                      <span className="text-[10px] text-white/30">{prev} → {curr}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 2: Intel Analyzer ────────────────────────────────────────────────────

function IntelAnalyzerTab({
  deals,
  initialText,
  initialChannel,
}: {
  deals: Deal[];
  initialText?: string;
  initialChannel?: ChannelId;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(initialText || "");
  const [channel, setChannel] = useState<ChannelId>(initialChannel || "email");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedReply, setCopiedReply] = useState<number | null>(null);
  const [linkedDealId, setLinkedDealId] = useState<string>("");
  const [linkedDealName, setLinkedDealName] = useState<string>("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleAnalyze() {
    if (!text.trim() || text.trim().length < 10) {
      toast({ title: "Text too short", description: "Paste at least a few sentences to analyze.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", "/api/aletheia/analyze-text", { text: text.trim(), channel });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);

      const score = getTruthScore(data);

      // Link to deal if selected
      if (linkedDealId) {
        linkAnalysisToDeal(linkedDealId, {
          text: text.trim(),
          channel,
          truthScore: score,
          risk: data.overallRisk || "medium",
          dealRisk: data.dealRisk || "caution",
          intent: data.buyerIntentState || "unknown",
          ghostProb: data.ghostProbability || 0,
          competitors: data.competitiveRadar?.competitors || [],
          stakeholderMentions: [],
          summary: data.summary || "",
        });
        const deal = getDeal(linkedDealId);
        setLinkedDealName(deal?.company || "");
        toast({ title: "Von Clausewitz Analysis Complete", description: `TRUTH Score™: ${score}/100 · Intelligence fed to ${deal?.company}` });
      } else {
        toast({ title: "Von Clausewitz Analysis Complete", description: `TRUTH Score™: ${score}/100 · Risk: ${data.overallRisk}` });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze text.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }

  function loadSample(sample: string, ch: ChannelId) {
    setText(sample);
    setChannel(ch);
    setResult(null);
    setTimeout(() => textRef.current?.focus(), 50);
  }

  function copyReply(reply: string, idx: number) {
    navigator.clipboard.writeText(reply);
    setCopiedReply(idx);
    setTimeout(() => setCopiedReply(null), 2000);
  }

  const score = result ? getTruthScore(result) : 0;

  return (
    <div className="space-y-5">
      {/* Input Card */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        {/* Deal Link */}
        <div className="flex items-center gap-3 flex-wrap">
          <MonoLabel>Link to deal:</MonoLabel>
          <select
            value={linkedDealId}
            onChange={e => { setLinkedDealId(e.target.value); setLinkedDealName(""); }}
            className="flex-1 px-3 py-1.5 rounded-lg text-[12px] text-[#f6f6fd] outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", minWidth: "180px" }}
          >
            <option value="">— No deal link —</option>
            {deals.map(d => <option key={d.id} value={d.id}>{d.company}</option>)}
            <option value="__new__">+ New deal</option>
          </select>
        </div>

        {/* Channel Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <MonoLabel>Channel:</MonoLabel>
          {CHANNELS.map(ch => {
            const Icon = ch.icon;
            const active = channel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setChannel(ch.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: active ? "rgba(220,38,38,0.10)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#f87171" : "rgba(255,255,255,0.35)",
                }}
              >
                <Icon size={12} />{ch.label}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste an email, call transcript, SMS, or LinkedIn message to deploy the Von Clausewitz Engine..."
          className="w-full h-44 rounded-lg p-4 text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none resize-y leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        />

        {/* Actions Row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MonoLabel>Try sample:</MonoLabel>
            <button onClick={() => loadSample(SAMPLE_EMAIL, "email")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Email</button>
            <button onClick={() => loadSample(SAMPLE_TRANSCRIPT, "call_transcript")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Call Transcript</button>
            <button onClick={() => loadSample(SAMPLE_SMS, "sms")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">SMS</button>
            {text && (
              <button onClick={() => { setText(""); setResult(null); }} className="text-[10px] px-2 py-1 rounded border border-white/[0.06] text-white/20 hover:text-white/40 bg-white/[0.01] transition-all flex items-center gap-1">
                <X size={9} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Deploy Button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || text.trim().length < 10}
          className="w-full py-3.5 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={CRIMSON_BTN_STYLE}
        >
          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
          {isAnalyzing ? "Deploying Von Clausewitz Engine..." : "Deploy Von Clausewitz"}
        </button>
      </div>

      {/* Loading */}
      {isAnalyzing && (
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.04] to-transparent p-5 flex items-center gap-3">
          <div className="relative w-5 h-5 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-red-400/30" />
            <div className="absolute inset-0 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
          </div>
          <span className="text-[13px] font-mono" style={{ color: "rgba(248,113,113,0.8)" }}>
            Von Clausewitz scanning for deception patterns, behavioral signals, competitive intelligence...
          </span>
        </div>
      )}

      {/* Deal link success banner */}
      {result && linkedDealId && linkedDealName && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 flex items-center gap-3">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
          <span className="text-[12px] text-emerald-300">Intelligence fed to deal: <strong>{linkedDealName}</strong></span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score + Summary */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-6">
            <div className="flex items-start gap-6 flex-wrap">
              <TruthGauge score={score} />
              <div className="flex-1 min-w-[200px] space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[11px] font-mono px-2 py-1 rounded border ${riskColor(result.overallRisk)}`}>Risk: {result.overallRisk}</span>
                  <span className={`text-[11px] font-mono px-2 py-1 rounded border ${riskColor(result.dealRisk)}`}>Deal: {result.dealRisk}</span>
                  <span className={`text-[11px] font-mono px-2 py-1 rounded border bg-white/5 text-white/50 border-white/10`}>Intent: {intentLabel(result.buyerIntentState)}</span>
                  {result.ghostProbability > 40 && (
                    <span className="text-[11px] font-mono px-2 py-1 rounded border bg-rose-500/15 text-rose-400 border-rose-500/25">👻 Ghost {result.ghostProbability}%</span>
                  )}
                </div>
                {result.summary && (
                  <p className="text-[13px] text-white/60 leading-relaxed">{result.summary}</p>
                )}
              </div>
            </div>
          </div>

          {/* Deception Layer */}
          {result.deceptionLayer && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-red-400" />
                <MonoLabel>Deception Layer Analysis</MonoLabel>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(result.deceptionLayer).map(([key, val]) => {
                  const v = typeof val === "number" ? val : 0;
                  const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                  const color = v > 60 ? "#f87171" : v > 30 ? "#fbbf24" : "#1dd1a1";
                  return <MiniBar key={key} label={label} value={v} color={color} />;
                })}
              </div>
            </div>
          )}

          {/* Linguistic + Negotiation side by side */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.linguisticCues && (
              <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-amber-400" />
                  <MonoLabel>Linguistic Cues</MonoLabel>
                </div>
                <div className="space-y-3">
                  {Object.entries(result.linguisticCues).map(([key, val]) => {
                    const v = typeof val === "number" ? val : 0;
                    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                    const color = key.includes("Commitment") || key.includes("Implementation") || key.includes("Urgency") ? (v > 50 ? "#1dd1a1" : "#fbbf24") : v > 50 ? "#f87171" : "#1dd1a1";
                    return <MiniBar key={key} label={label} value={v} color={color} />;
                  })}
                </div>
              </div>
            )}
            {result.negotiationPosture && (
              <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Crosshair size={14} className="text-violet-400" />
                  <MonoLabel>Negotiation Posture</MonoLabel>
                </div>
                <div className="space-y-3">
                  {(["powerScore","urgencyScore","commitmentScore"] as const).map(key => {
                    const v = (result.negotiationPosture as any)[key] as number;
                    return <MiniBar key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} value={v} color={v > 60 ? "#1dd1a1" : v > 30 ? "#fbbf24" : "#f87171"} />;
                  })}
                  {result.negotiationPosture.concessionPattern && (
                    <div className="pt-1">
                      <MonoLabel>Concession Pattern</MonoLabel>
                      <p className="text-[12px] text-white/50 mt-1">{result.negotiationPosture.concessionPattern}</p>
                    </div>
                  )}
                  {result.negotiationPosture.leveragePosition && (
                    <div>
                      <MonoLabel>Leverage Position</MonoLabel>
                      <p className="text-[12px] text-white/50 mt-1">{result.negotiationPosture.leveragePosition}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Competitive Radar */}
          {result.competitiveRadar && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Radar size={14} className="text-cyan-400" />
                <MonoLabel>Competitive Radar</MonoLabel>
                <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded border ${riskColor(result.competitiveRadar.competitiveRiskLevel)}`}>{result.competitiveRadar.competitiveRiskLevel}</span>
              </div>
              {result.competitiveRadar.competitors?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.competitiveRadar.competitors.map((c, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{c}</span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-white/30">No competitors detected in this communication.</p>
              )}
              {result.competitiveRadar.competitiveTalkingPoints?.length > 0 && (
                <div className="space-y-2">
                  <MonoLabel>Talking Points</MonoLabel>
                  <ul className="space-y-1.5">
                    {result.competitiveRadar.competitiveTalkingPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-white/55">
                        <ChevronRight size={12} className="mt-0.5 text-cyan-400 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Flags */}
          {result.flags?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-rose-400" />
                <MonoLabel>Deception Flags ({result.flags.length})</MonoLabel>
              </div>
              <div className="space-y-2">
                {result.flags.map((flag, i) => (
                  <div key={i} className="p-3 rounded-lg space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold uppercase ${sevColor(flag.severity)}`}>{flag.severity}</span>
                      <span className="text-[11px] font-medium text-white/70">{flag.type}</span>
                    </div>
                    {flag.phrase && <p className="text-[11px] italic text-white/40">"{flag.phrase}"</p>}
                    {flag.explanation && <p className="text-[11px] text-white/50 leading-snug">{flag.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intent Signals */}
          {result.intentSignals?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Signal size={14} className="text-emerald-400" />
                <MonoLabel>Intent Signals</MonoLabel>
              </div>
              <div className="space-y-2">
                {result.intentSignals.map((sig, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 p-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex-1">
                      <p className="text-[12px] text-white/70">{sig.signal}</p>
                      {sig.type && <p className="text-[10px] font-mono text-white/30 mt-0.5">{sig.type}</p>}
                    </div>
                    <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${strengthColor(sig.strength)}`}>{sig.strength}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlighted Phrases */}
          {result.highlightedPhrases?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-amber-400" />
                <MonoLabel>Highlighted Phrases</MonoLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.highlightedPhrases.map((hp, i) => (
                  <div key={i} className={`inline-flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border text-[11px] max-w-xs ${phraseColor(hp.color)}`}>
                    <span className="font-medium">"{hp.phrase}"</span>
                    {hp.reason && <span className="text-[10px] opacity-70">{hp.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playbook Move */}
          {result.playbook && (
            <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.04] to-transparent p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-red-400" />
                <MonoLabel>Von Clausewitz Playbook Move</MonoLabel>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.playbook.move && (
                  <div>
                    <MonoLabel>Move</MonoLabel>
                    <p className="text-[14px] font-semibold text-red-300 mt-1">{result.playbook.move}</p>
                  </div>
                )}
                {result.playbook.tactic && (
                  <div>
                    <MonoLabel>Tactic</MonoLabel>
                    <p className="text-[12px] text-white/60 mt-1">{result.playbook.tactic}</p>
                  </div>
                )}
              </div>
              {result.playbook.nextBestActions?.length ? (
                <div>
                  <MonoLabel>Next Best Actions</MonoLabel>
                  <ul className="mt-2 space-y-1">
                    {result.playbook.nextBestActions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-white/55">
                        <ArrowRight size={12} className="mt-0.5 text-red-400 shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Suggested Replies */}
          {result.suggestedReplies?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-violet-400" />
                <MonoLabel>Suggested Replies ({result.suggestedReplies.length})</MonoLabel>
              </div>
              <div className="space-y-3">
                {result.suggestedReplies.map((reply, i) => (
                  <div key={i} className="relative group p-4 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[12px] text-white/65 leading-relaxed pr-8">{reply}</p>
                    <button
                      onClick={() => copyReply(reply, i)}
                      className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.08]"
                    >
                      {copiedReply === i ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/30" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ghost Resurrection */}
          {result.ghostResurrection?.isGhosted && (
            <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Ghost size={14} className="text-rose-400" />
                <MonoLabel>Ghost Resurrection Protocol</MonoLabel>
                <span className="ml-auto text-[10px] font-mono text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/25">GHOSTED</span>
              </div>
              {result.ghostResurrection.reEngagementStrategy && (
                <div>
                  <MonoLabel>Strategy</MonoLabel>
                  <p className="text-[12px] text-white/60 mt-1 leading-relaxed">{result.ghostResurrection.reEngagementStrategy}</p>
                </div>
              )}
              {result.ghostResurrection.reEngagementMessage && (
                <div className="p-4 rounded-lg relative group" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[12px] text-white/65 leading-relaxed pr-8">{result.ghostResurrection.reEngagementMessage}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(result.ghostResurrection.reEngagementMessage); toast({ title: "Copied resurrection message" }); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/[0.08]"
                  >
                    <Copy size={12} className="text-white/30" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB 3: Operator Intel ────────────────────────────────────────────────────

const PACKAGE_SECTIONS: { key: PackageSection; label: string; icon: any }[] = [
  { key: "market_intent", label: "Market Intent", icon: Shield },
  { key: "pitch", label: "Pitch", icon: TrendingUp },
  { key: "objections", label: "Objections", icon: AlertTriangle },
  { key: "warbook", label: "Warbook", icon: Brain },
  { key: "prospects", label: "Prospects", icon: Users },
];

const roleColor = (r: StakeholderRole) =>
  r === "economic_buyer" ? "#eab308" :
  r === "champion" ? "#22c55e" :
  r === "technical" ? "#22d3ee" :
  r === "blocker" ? "#ef4444" :
  r === "ghost" ? "#6b7280" : "#9ca3af";

const signalDotColor = (t: string) => {
  if (t === "funding" || t === "earnings" || t === "contract_win") return "bg-emerald-400";
  if (t === "leadership" || t === "new_c_suite") return "bg-amber-400";
  if (t === "competitor_mention") return "bg-rose-400";
  if (t === "tech_change") return "bg-violet-400";
  if (t === "hiring_surge" || t === "job_posting" || t === "job_post_matching") return "bg-cyan-400";
  if (t === "product_launch") return "bg-fuchsia-400";
  return "bg-white/20";
};

function TargetListCard({ deal, selected, onClick }: { deal: Deal; selected: boolean; onClick: () => void }) {
  const sigScore = deal.targetMeta?.signalScore ?? 0;
  const sigColor = sigScore >= 7 ? "#22d3ee" : sigScore >= 4 ? "#fbbf24" : "rgba(255,255,255,0.2)";
  const tier = deal.targetMeta?.tier ?? "Watch";
  const tierStyle = tier === "T1"
    ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
    : tier === "T2"
    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
    : "bg-white/[0.06] text-white/30 border-white/10";
  const lastBriefAt = deal.targetMeta?.lastBriefAt;
  const r = 12;
  const circumference = 2 * Math.PI * r;
  const truthFilled = (deal.truthScore / 100) * circumference;
  const sigFilled = (sigScore / 10) * circumference;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        selected
          ? "border-rose-500/40 bg-rose-500/[0.06] ring-2 ring-rose-500/40"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-[#f6f6fd] truncate">{deal.company}</span>
            {deal.isHVT && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
                style={{ background: "rgba(220,38,38,0.15)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>🎯 HVT</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tierStyle}`}>{tier}</span>
            <span className="text-[9px] font-mono text-white/25">
              {lastBriefAt ? fmtTime(lastBriefAt) : "No brief yet"}
            </span>
          </div>
        </div>
        {/* TRUTH ring */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
            <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="16" cy="16" r={r} fill="none"
              stroke={deal.truthScore >= 70 ? "#1dd1a1" : deal.truthScore >= 40 ? "#fbbf24" : "#f87171"}
              strokeWidth="3"
              strokeDasharray={`${truthFilled} ${circumference - truthFilled}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[8px] font-mono text-white/30">{deal.truthScore}</span>
        </div>
        {/* Signal ring */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
            <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle cx="16" cy="16" r={r} fill="none"
              stroke={sigColor}
              strokeWidth="3"
              strokeDasharray={`${sigFilled} ${circumference - sigFilled}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[8px] font-mono text-white/30">{sigScore.toFixed(1)}</span>
        </div>
      </div>
    </button>
  );
}

function OperatorIntelTab({ deals }: { deals: Deal[] }) {
  const { toast } = useToast();
  const [selectedDealId, setSelectedDealId] = useState<string>(deals[0]?.id || "");
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [showAddSignal, setShowAddSignal] = useState(false);
  const [activeSection, setActiveSection] = useState<PackageSection>("market_intent");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBriefing, setIsBriefing] = useState(false);

  // Stakeholder form state
  const [skName, setSkName] = useState("");
  const [skTitle, setSkTitle] = useState("");
  const [skEmail, setSkEmail] = useState("");
  const [skPhone, setSkPhone] = useState("");
  const [skLinkedin, setSkLinkedin] = useState("");
  const [skRole, setSkRole] = useState<StakeholderRole>("unknown");
  const [skEngagement, setSkEngagement] = useState(50);

  // Signal form state
  const [sigType, setSigType] = useState<SignalType>("news");
  const [sigHeadline, setSigHeadline] = useState("");
  const [sigDate, setSigDate] = useState(new Date().toISOString().split("T")[0]);
  const [sigSource, setSigSource] = useState("");
  const [sigImpact, setSigImpact] = useState(5);

  const deal = deals.find(d => d.id === selectedDealId);
  const ms = deal ? multithreadingScore(deal) : { engaged: 0, required: 0, fragile: false };

  const hvts = deals.filter(d => d.isHVT).sort((a, b) => (b.targetMeta?.signalScore || 0) - (a.targetMeta?.signalScore || 0));
  const others = deals.filter(d => !d.isHVT);

  const sortedSignals = deal ? [...deal.signals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  const latestBrief = deal?.dailyBriefs?.[0] ?? null;

  const activeSectionContent = deal?.targetPackage
    ? activeSection === "market_intent"
      ? deal.targetPackage.marketIntent
      : (deal.targetPackage as any)[activeSection]
    : undefined;

  const sourcesForSection: string[] = deal?.targetPackage?.sections?.[activeSection]?.sources ?? [];
  const sectionLabel = PACKAGE_SECTIONS.find(s => s.key === activeSection)?.label ?? activeSection;

  function resetSkForm() {
    setSkName(""); setSkTitle(""); setSkEmail(""); setSkPhone(""); setSkLinkedin(""); setSkRole("unknown"); setSkEngagement(50);
  }

  function handleAddStakeholder() {
    if (!deal || !skName.trim()) return;
    addStakeholder(deal.id, { name: skName.trim(), title: skTitle, email: skEmail, phone: skPhone, linkedin: skLinkedin, role: skRole, engagement: skEngagement });
    toast({ title: "Stakeholder added", description: `${skName} added to ${deal.company}` });
    resetSkForm();
    setShowAddStakeholder(false);
  }

  function handleAddSignal() {
    if (!deal || !sigHeadline.trim()) return;
    addSignal(deal.id, { type: sigType, headline: sigHeadline.trim(), date: sigDate, source: sigSource, impactScore: sigImpact });
    toast({ title: "Signal logged", description: `${sigType} signal added to ${deal.company}` });
    setSigHeadline(""); setSigDate(new Date().toISOString().split("T")[0]); setSigSource(""); setSigImpact(5);
    setShowAddSignal(false);
  }

  async function handleGenerateAll() {
    if (!deal) return;
    setIsGenerating(true);
    markPackageGenerating(deal.id);
    try {
      const res = await apiRequest("POST", "/api/targets/generate-package", {
        company: deal.company,
        website: deal.website,
        industry: deal.industry,
      });
      const data = await res.json();
      if (data.sections) {
        (Object.keys(data.sections) as PackageSection[]).forEach(key => {
          const s = data.sections[key];
          updatePackageSection(deal.id, key, {
            status: s.status,
            content: s.content,
            sources: s.sources,
          });
        });
        toast({ title: "🎯 Package ready", description: `Operator Intel for ${deal.company} deployed.` });
      }
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRegenSection() {
    if (!deal) return;
    updatePackageSection(deal.id, activeSection, { status: "generating" });
    try {
      const res = await apiRequest("POST", "/api/targets/generate-package", { company: deal.company, website: deal.website, industry: deal.industry });
      const data = await res.json();
      const s = data.sections?.[activeSection];
      if (s) {
        updatePackageSection(deal.id, activeSection, { status: s.status, content: s.content, sources: s.sources });
        toast({ title: "Section regenerated" });
      }
    } catch (e: any) {
      updatePackageSection(deal.id, activeSection, { status: "failed" });
      toast({ title: "Regen failed", description: e.message, variant: "destructive" });
    }
  }

  async function handleGenerateBrief() {
    if (!deal) return;
    setIsBriefing(true);
    try {
      const res = await apiRequest("POST", "/api/targets/daily-brief", { company: deal.company });
      const data = await res.json();
      addDailyBrief(deal.id, {
        briefDate: data.briefDate,
        summary: data.summary,
        overnightTriggers: data.overnightTriggers,
        whyNow: data.whyNow,
        pitchAngle: data.pitchAngle,
        recommendedAction: data.recommendedAction,
        dailySignalScore: data.dailySignalScore,
        sources: data.sources,
      });
      (data.signals || []).forEach((s: any) => {
        addSignal(deal.id, {
          type: s.type,
          headline: s.description,
          date: s.date || new Date().toISOString().slice(0, 10),
          source: s.source,
          impactScore: s.impactScore || 5,
        });
      });
      toast({ title: "📋 Daily Brief ready", description: `Score: ${data.dailySignalScore}/10` });
    } catch (e: any) {
      toast({ title: "Brief failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBriefing(false);
    }
  }

  function handleCopy() {
    if (!activeSectionContent) return;
    navigator.clipboard.writeText(activeSectionContent);
    toast({ title: "Copied to clipboard" });
  }

  function handlePushToCampaign() {
    if (!activeSectionContent || !deal) return;
    try {
      localStorage.setItem("atom_campaign_inject", JSON.stringify({
        company: deal.company,
        section: activeSection,
        content: activeSectionContent,
        at: Date.now(),
      }));
      toast({ title: "✅ Pushed to Campaign", description: "Open ATOM Campaign to use in your template." });
    } catch {}
  }

  return (
    <div className="grid grid-cols-12 gap-4">

      {/* ── LEFT: Target List ── */}
      <div className="col-span-12 md:col-span-3 space-y-2">
        <div className="flex items-center justify-between">
          <MonoLabel>Targets ({hvts.length + others.length})</MonoLabel>
        </div>
        {hvts.length > 0 && (
          <>
            <p className="text-[9px] font-mono uppercase tracking-wider text-rose-400/60 pl-1">🎯 HVT · {hvts.length}</p>
            {hvts.map(d => (
              <TargetListCard
                key={d.id}
                deal={d}
                selected={selectedDealId === d.id}
                onClick={() => setSelectedDealId(d.id)}
              />
            ))}
          </>
        )}
        {others.length > 0 && (
          <>
            <p className="text-[9px] font-mono uppercase tracking-wider text-white/25 pl-1 mt-3">Watch · {others.length}</p>
            {others.map(d => (
              <TargetListCard
                key={d.id}
                deal={d}
                selected={selectedDealId === d.id}
                onClick={() => setSelectedDealId(d.id)}
              />
            ))}
          </>
        )}
        {deals.length === 0 && (
          <div className="text-center py-10 text-white/25 text-[12px]">No targets. Add deals from the Pipeline.</div>
        )}
      </div>

      {/* ── CENTER: Target Package ── */}
      <div className="col-span-12 md:col-span-6 rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-4">
        {!deal ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Sparkles size={28} className="text-white/15" />
            <p className="text-[13px] text-white/25">Select a target to view the Operator Intel Package.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#f6f6fd]">{deal.company}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={deal.targetMeta?.tier ?? "Watch"}
                    onChange={e => updateTargetTier(deal.id, e.target.value as TargetTier)}
                    className="text-[10px] bg-white/[0.04] border border-white/10 rounded px-2 py-0.5 text-white/60 outline-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    <option value="T1">T1 Priority</option>
                    <option value="T2">T2 Watch</option>
                    <option value="Watch">Watch</option>
                  </select>
                  <span className="text-[10px] text-white/30">Package: {deal.targetPackage?.overallStatus || "idle"}</span>
                </div>
              </div>
              <Button
                onClick={handleGenerateAll}
                disabled={isGenerating}
                className="gap-1.5 px-4 py-2 rounded-full text-[11px] font-semibold"
                style={{
                  background: "linear-gradient(93.92deg, #f87171 -13.51%, #dc2626 40.91%, #b91c1c 113.69%)",
                  color: "#fff",
                  boxShadow: "0 0 12px rgba(220,38,38,0.3)",
                }}
              >
                {isGenerating
                  ? <><Loader2 size={12} className="animate-spin" />Generating...</>
                  : <><Sparkles size={12} />Regenerate All</>}
              </Button>
            </div>

            {/* Section tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {PACKAGE_SECTIONS.map(s => {
                const SIcon = s.icon;
                const sectionStatus = deal.targetPackage?.sections?.[s.key]?.status;
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-all"
                    style={{
                      background: isActive ? "rgba(220,38,38,0.10)" : "rgba(255,255,255,0.03)",
                      color: isActive ? "#f87171" : "rgba(255,255,255,0.35)",
                      border: isActive ? "1px solid rgba(220,38,38,0.25)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <SIcon size={12} />
                    {s.label}
                    {sectionStatus === "generating" && <Loader2 size={10} className="animate-spin" />}
                    {sectionStatus === "ready" && <Check size={10} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {/* Active section content */}
            <div className="min-h-[400px] rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              {activeSectionContent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <MonoLabel>Operator Intel: {sectionLabel}</MonoLabel>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleRegenSection}
                        className="text-[10px] text-white/30 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw size={10} />Regenerate
                      </button>
                      <button
                        onClick={handleCopy}
                        className="text-[10px] text-white/30 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <Copy size={10} />Copy
                      </button>
                      <button
                        onClick={handlePushToCampaign}
                        className="text-[10px] text-white/30 hover:text-rose-400 flex items-center gap-1 transition-colors"
                      >
                        <Send size={10} />Push to Campaign
                      </button>
                    </div>
                  </div>
                  <div className="text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap">{activeSectionContent}</div>
                  {sourcesForSection.length > 0 && (
                    <div className="pt-3 border-t border-white/[0.06]">
                      <MonoLabel>Sources ({sourcesForSection.length})</MonoLabel>
                      <div className="mt-1.5 space-y-1">
                        {sourcesForSection.slice(0, 6).map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                            className="block text-[10px] text-rose-400/60 hover:text-rose-400 truncate transition-colors">
                            {src}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[360px] gap-3 text-center">
                  {deal.targetPackage?.sections?.[activeSection]?.status === "generating" ? (
                    <>
                      <Loader2 size={24} className="animate-spin text-rose-400/50" />
                      <p className="text-[12px] text-white/30">Generating {sectionLabel}...</p>
                    </>
                  ) : (
                    <>
                      <Sparkles size={24} className="text-white/15" />
                      <p className="text-[12px] text-white/25">Click Regenerate All to build the full Operator Intel Package.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Signal Feed + Daily Brief ── */}
      <div className="col-span-12 md:col-span-3 space-y-4">

        {/* Daily Brief panel */}
        <div className="rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.04] to-transparent p-4 space-y-3">
          <div className="flex items-center justify-between">
            <MonoLabel>📋 Daily Brief</MonoLabel>
            <Button
              onClick={handleGenerateBrief}
              disabled={isBriefing || !deal}
              size="sm"
              className="h-6 text-[10px] gap-1 px-2 rounded border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
            >
              {isBriefing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Pull
            </Button>
          </div>
          {latestBrief ? (
            <div className="space-y-2">
              <p className="text-[11px] text-white/60">{latestBrief.summary}</p>
              <div className="rounded bg-white/[0.03] p-2 space-y-1.5">
                <MonoLabel>Why Now</MonoLabel>
                <p className="text-[11px] text-rose-400/80">{latestBrief.whyNow}</p>
              </div>
              <div className="rounded bg-white/[0.03] p-2 space-y-1.5">
                <MonoLabel>Pitch Angle</MonoLabel>
                <p className="text-[11px] text-emerald-400/80">{latestBrief.pitchAngle}</p>
              </div>
              <div className="rounded bg-white/[0.03] p-2 space-y-1.5">
                <MonoLabel>Action Today</MonoLabel>
                <p className="text-[11px] text-cyan-400/80">{latestBrief.recommendedAction}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] font-mono text-white/25">Signal Score: {latestBrief.dailySignalScore}/10</span>
                <span className="text-[9px] font-mono text-white/25">{fmtTime(latestBrief.generatedAt)}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-white/25">
              {deal ? "No brief yet. Click Pull to generate today's intel." : "Select a target to generate a brief."}
            </p>
          )}
        </div>

        {/* Signal Feed */}
        {deal && (
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <MonoLabel>🛰️ Signal Feed · {(deal.targetMeta?.signalScore ?? 0).toFixed(1)}/10</MonoLabel>
              <button
                onClick={() => setShowAddSignal(true)}
                className="text-[10px] text-white/30 hover:text-rose-400 transition-colors"
              >+ Add</button>
            </div>
            {sortedSignals.length > 0 ? sortedSignals.slice(0, 10).map(sig => (
              <div key={sig.id} className="flex items-start gap-2 text-[11px] py-1.5 border-b border-white/[0.04]">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${signalDotColor(sig.type)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 leading-snug">{sig.headline}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono text-white/25">{sig.type.replace(/_/g, " ")}</span>
                    <span className="text-[9px] font-mono text-white/25">{sig.date}</span>
                    {sig.impactScore >= 7 && <span className="text-[9px] font-mono text-rose-400">HIGH</span>}
                  </div>
                </div>
              </div>
            )) : <p className="text-[11px] text-white/25">No signals yet.</p>}
          </div>
        )}

        {/* Stakeholder Quick View */}
        {deal && (
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <MonoLabel>👥 Stakeholders · {ms.engaged}/{ms.required}</MonoLabel>
              <button
                onClick={() => setShowAddStakeholder(true)}
                className="text-[10px] text-white/30 hover:text-rose-400 transition-colors"
              >+ Add</button>
            </div>
            {ms.fragile && (
              <Badge className="text-[9px] bg-rose-500/15 text-rose-400 border-rose-500/25">FRAGILE · Single-threaded</Badge>
            )}
            {deal.stakeholders.length === 0 ? (
              <p className="text-[11px] text-white/25">No stakeholders yet.</p>
            ) : (
              deal.stakeholders.slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1 text-[11px]">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: roleColor(s.role), color: "#fff" }}
                  >
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 truncate">{s.name}</p>
                    <p className="text-[9px] text-white/30 truncate">{s.title || s.role}</p>
                  </div>
                  <span className="text-[9px] font-mono text-white/25">{s.engagement}%</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Add Stakeholder Modal ── */}
      {showAddStakeholder && deal && (
        <Modal title={`Add Stakeholder — ${deal.company}`} onClose={() => { setShowAddStakeholder(false); resetSkForm(); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name *">
                <input value={skName} onChange={e => setSkName(e.target.value)} placeholder="Full name" className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
              <FormField label="Title">
                <input value={skTitle} onChange={e => setSkTitle(e.target.value)} placeholder="VP Engineering" className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email">
                <input value={skEmail} onChange={e => setSkEmail(e.target.value)} placeholder="jane@co.com" className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
              <FormField label="Phone">
                <input value={skPhone} onChange={e => setSkPhone(e.target.value)} placeholder="+1 555..." className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
            </div>
            <FormField label="LinkedIn">
              <input value={skLinkedin} onChange={e => setSkLinkedin(e.target.value)} placeholder="linkedin.com/in/..." className={INPUT_CLS} style={INPUT_STYLE} />
            </FormField>
            <FormField label="Role">
              <select value={skRole} onChange={e => setSkRole(e.target.value as StakeholderRole)} className={INPUT_CLS} style={INPUT_STYLE}>
                {STAKEHOLDER_ROLES.map(r => <option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
              </select>
            </FormField>
            <FormField label={`Engagement: ${skEngagement}%`}>
              <input type="range" min={0} max={100} value={skEngagement} onChange={e => setSkEngagement(Number(e.target.value))} className="w-full accent-red-500" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowAddStakeholder(false); resetSkForm(); }} className="flex-1 py-2 rounded-lg text-[12px] text-white/40 border border-white/[0.08] hover:text-white/60 transition-colors">Cancel</button>
              <button onClick={handleAddStakeholder} className="flex-1 py-2 rounded-lg text-[12px] font-medium" style={CRIMSON_BTN_STYLE}>Add Stakeholder</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Signal Modal ── */}
      {showAddSignal && deal && (
        <Modal title={`Add Signal — ${deal.company}`} onClose={() => setShowAddSignal(false)}>
          <div className="space-y-3">
            <FormField label="Signal Type">
              <select value={sigType} onChange={e => setSigType(e.target.value as SignalType)} className={INPUT_CLS} style={INPUT_STYLE}>
                {SIGNAL_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </FormField>
            <FormField label="Headline *">
              <input value={sigHeadline} onChange={e => setSigHeadline(e.target.value)} placeholder="Company raised $50M Series B..." className={INPUT_CLS} style={INPUT_STYLE} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date">
                <input type="date" value={sigDate} onChange={e => setSigDate(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
              <FormField label="Source">
                <input value={sigSource} onChange={e => setSigSource(e.target.value)} placeholder="TechCrunch" className={INPUT_CLS} style={INPUT_STYLE} />
              </FormField>
            </div>
            <FormField label={`Impact Score: ${sigImpact}/10`}>
              <input type="range" min={0} max={10} value={sigImpact} onChange={e => setSigImpact(Number(e.target.value))} className="w-full accent-red-500" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAddSignal(false)} className="flex-1 py-2 rounded-lg text-[12px] text-white/40 border border-white/[0.08] hover:text-white/60 transition-colors">Cancel</button>
              <button onClick={handleAddSignal} className="flex-1 py-2 rounded-lg text-[12px] font-medium" style={CRIMSON_BTN_STYLE}>Log Signal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB 4: Deal Pipeline ─────────────────────────────────────────────────────

function DealPipelineTab({ deals, onTabChange, onSelectDeal }: { deals: Deal[]; onTabChange: (t: TabId) => void; onSelectDeal: (id: string) => void }) {
  const { toast } = useToast();
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newIsHVT, setNewIsHVT] = useState(false);

  function handleCreateDeal() {
    if (!newCompany.trim()) return;
    const deal = createDeal({ company: newCompany.trim(), website: newWebsite, industry: newIndustry, source: "manual", isHVT: newIsHVT });
    toast({ title: "Deal created", description: `${deal.company} added to pipeline.` });
    setNewCompany(""); setNewWebsite(""); setNewIndustry(""); setNewIsHVT(false);
    setShowNewDeal(false);
  }

  function handleDeleteDeal(id: string, company: string) {
    if (!confirm(`Delete ${company}? This cannot be undone.`)) return;
    deleteDeal(id);
    toast({ title: "Deal deleted", description: `${company} removed from pipeline.` });
  }

  function handleStageChange(deal: Deal, stage: DealStage) {
    const check = canAdvanceStage(deal, stage);
    if (!check.allowed) {
      toast({ title: "Stage blocked", description: check.reason, variant: "destructive" });
      return;
    }
    updateDeal(deal.id, { stage });
    toast({ title: "Stage updated", description: `${deal.company} → ${stageLabel(stage)}` });
  }

  function handleToggleHVT(deal: Deal) {
    updateDeal(deal.id, { isHVT: !deal.isHVT, hvtFlaggedAt: !deal.isHVT ? Date.now() : undefined });
    toast({ title: deal.isHVT ? "HVT flag removed" : "Flagged as HVT", description: deal.company });
  }

  const grouped = STAGE_ORDER.reduce<Record<DealStage, Deal[]>>((acc, stage) => {
    acc[stage] = deals.filter(d => d.stage === stage);
    return acc;
  }, {} as Record<DealStage, Deal[]>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-white/40" />
          <span className="text-[13px] font-semibold text-[#f6f6fd]">Deal Pipeline</span>
          <span className="text-[10px] font-mono text-white/30 ml-1">{deals.length} deals</span>
        </div>
        <button
          onClick={() => setShowNewDeal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-[1.02]"
          style={CRIMSON_BTN_STYLE}
        >
          <Plus size={11} /> New Deal
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-[13px]">No deals in pipeline. Create your first deal to begin tracking.</div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4" style={{ minWidth: "900px" }}>
            {STAGE_ORDER.map(stage => (
              <div key={stage} className="flex-1 min-w-[160px] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">{stageLabel(stage)}</span>
                  <span className="text-[10px] font-mono text-white/20">{grouped[stage].length}</span>
                </div>
                <div className="space-y-2">
                  {grouped[stage].map(deal => {
                    const ms = multithreadingScore(deal);
                    const sd = stallDays(deal);
                    return (
                      <div
                        key={deal.id}
                        className="p-3 rounded-xl space-y-2.5 cursor-pointer hover:border-white/[0.12] transition-all"
                        style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.07)" }}
                        onClick={() => { onSelectDeal(deal.id); onTabChange("operator"); }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            {deal.isHVT && (
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.15)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>🎯 HVT</span>
                              </div>
                            )}
                            <p className="text-[12px] font-semibold text-[#f6f6fd] leading-tight truncate">{deal.company}</p>
                          </div>
                          <MiniScoreCircle score={deal.truthScore} />
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${riskColor(deal.risk)}`}>{deal.risk}</span>
                          {deal.threatLevel !== "low" && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${threatColor(deal.threatLevel)}`}>⚠ {deal.threatLevel}</span>
                          )}
                        </div>

                        {sd > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={9} className={sd > 7 ? "text-rose-400" : "text-white/25"} />
                            <span className={`text-[9px] font-mono ${sd > 7 ? "text-rose-400" : "text-white/30"}`}>{sd}d buyer stall</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <Users size={9} className={ms.fragile ? "text-rose-400" : "text-white/25"} />
                          <span className={`text-[9px] font-mono ${ms.fragile ? "text-rose-400" : "text-white/30"}`}>{ms.engaged}/{ms.required} stakeholders</span>
                        </div>

                        <div className="pt-1 border-t border-white/[0.05]" onClick={e => e.stopPropagation()}>
                          <select
                            value={deal.stage}
                            onChange={e => handleStageChange(deal, e.target.value as DealStage)}
                            className="w-full text-[9px] font-mono px-1.5 py-1 rounded text-white/50 outline-none"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                          >
                            {STAGE_ORDER.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
                          </select>
                          <div className="flex items-center justify-between mt-1.5 gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleHVT(deal); }}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${deal.isHVT ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-white/25 hover:text-white/50 border border-white/[0.06]"}`}
                            >
                              🎯 HVT
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteDeal(deal.id, deal.company); }}
                              className="p-1 rounded hover:text-rose-400 text-white/20 transition-colors"
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Deal Modal */}
      {showNewDeal && (
        <Modal title="New Deal" onClose={() => setShowNewDeal(false)}>
          <div className="space-y-3">
            <FormField label="Company *">
              <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Acme Corp" className={INPUT_CLS} style={INPUT_STYLE} />
            </FormField>
            <FormField label="Website">
              <input value={newWebsite} onChange={e => setNewWebsite(e.target.value)} placeholder="acme.com" className={INPUT_CLS} style={INPUT_STYLE} />
            </FormField>
            <FormField label="Industry">
              <input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="SaaS / Fintech / etc." className={INPUT_CLS} style={INPUT_STYLE} />
            </FormField>
            <div className="flex items-center gap-3 py-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newIsHVT} onChange={e => setNewIsHVT(e.target.checked)} className="accent-red-500 w-4 h-4" />
                <span className="text-[12px] text-white/60">Flag as HVT (High-Value Target)</span>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowNewDeal(false)} className="flex-1 py-2 rounded-lg text-[12px] text-white/40 border border-white/[0.08] hover:text-white/60 transition-colors">Cancel</button>
              <button onClick={handleCreateDeal} className="flex-1 py-2 rounded-lg text-[12px] font-medium" style={CRIMSON_BTN_STYLE}>Create Deal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB 5: Playbook Engine ───────────────────────────────────────────────────

const DECEPTION_PATTERNS = [
  { id: "stall", title: "The Stall", icon: Clock, color: "#f87171", description: "Buyer delays without substance. Uses vague timelines and false urgency.", signals: ["circle back", "next quarter", "when things settle", "internal reprioritization"], tactics: ["Set hard deadline with value consequence", "Request exec sponsor meeting", "Deploy FOMO sequence"] },
  { id: "ghost", title: "The Ghost", icon: Ghost, color: "#a78bfa", description: "Buyer goes dark after positive signals. Engagement collapse.", signals: ["Unread emails >7 days", "Missed calls", "No calendar response", "Last read: 2+ weeks"], tactics: ["Resurrection sequence: CEO video", "Mutual connection bridge", "Value reframe with new case study"] },
  { id: "coach", title: "The False Champion", icon: Users, color: "#fbbf24", description: "Internal champion claims support but can't drive action.", signals: ["CEO is bullish", "Everyone loves it", "I just need to get approval", "Not in buying chair"], tactics: ["Map real economic buyer", "Skip-level executive bridge", "Demand org chart clarity"] },
  { id: "budget", title: "The Budget Fabrication", icon: DollarSign, color: "#34d399", description: "Buyer invents budget constraints that don't match signals.", signals: ["Budget is tight", "Spending freeze", "Not in this year's budget", "Next year maybe"], tactics: ["ROI proof of concept", "Phased deployment offer", "Finance sponsor meeting"] },
  { id: "competitive", title: "The Competitive Smokescreen", icon: Crosshair, color: "#38bdf8", description: "Buyer uses competitor mentions to negotiate, not evaluate.", signals: ["We're also looking at X", "X offered half the price", "X has more features", "Comparing options"], tactics: ["Competitive differentiation deck", "Win story for this exact profile", "POC head-to-head"] },
  { id: "authority", title: "The Authority Deflection", icon: Shield, color: "#fb923c", description: "Buyer claims no authority to prevent commitment.", signals: ["Need to check with team", "Board needs to approve", "Not my decision", "Legal needs to review"], tactics: ["Multi-thread to actual authority", "Executive alignment meeting", "Create internal champion toolkit"] },
  { id: "overenthusiasm", title: "The Over-Enthusiasm Trap", icon: Zap, color: "#e879f9", description: "Buyer is suspiciously positive — creating false safety.", signals: ["This is amazing", "We definitely want this", "100% moving forward", "Love everything about it"], tactics: ["Test commitment: ask for PO timeline", "Require documented next step", "Get executive verbal on record"] },
  { id: "timeline", title: "The Timeline Vagueness", icon: Calendar, color: "#4ade80", description: "Buyer gives elastic timelines to avoid commitment.", signals: ["Soon", "Q3 or Q4", "Maybe end of year", "When the time is right"], tactics: ["Reverse timeline anchor", "Cost of delay calculation", "Create mutual action plan with dates"] },
];

function PlaybookEngineTab({ deals }: { deals: Deal[] }) {
  const { toast } = useToast();
  const liveOrders = deals.flatMap(d => d.plays.filter(p => !p.acknowledged).map(p => ({ ...p, deal: d }))).sort((a, b) => b.firedAt - a.firedAt);

  function handleAck(dealId: string, playId: string, company: string) {
    acknowledgePlay(dealId, playId);
    toast({ title: "Play acknowledged", description: `Order filed for ${company}.` });
  }

  return (
    <div className="space-y-6">
      {/* Live Orders */}
      {liveOrders.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-amber-400" />
            <span className="text-[13px] font-semibold text-[#f6f6fd]">Live Orders</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">{liveOrders.length} active</span>
          </div>
          <div className="space-y-2">
            {liveOrders.map(order => (
              <div key={order.id} className="p-4 rounded-xl space-y-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-amber-300">{order.name}</span>
                      <span className="text-[9px] font-mono text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">{order.deal.company}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${order.urgency === "critical" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : order.urgency === "high" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/30 border-white/10"}`}>{order.urgency}</span>
                    </div>
                    <p className="text-[11px] text-white/50 mt-1">{order.tactic}</p>
                  </div>
                  <button
                    onClick={() => handleAck(order.deal.id, order.id, order.deal.company)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all"
                  >
                    <Check size={10} /> Acknowledge
                  </button>
                </div>
                <div className="text-[9px] font-mono text-white/20">trigger: {order.trigger} · fired {fmtTime(order.firedAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deception Patterns */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={14} className="text-white/40" />
          <span className="text-[13px] font-semibold text-[#f6f6fd]">Von Clausewitz Deception Pattern Library</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DECEPTION_PATTERNS.map(pattern => {
            const Icon = pattern.icon;
            return (
              <div key={pattern.id} className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${pattern.color}18`, border: `1px solid ${pattern.color}30` }}>
                    <Icon size={16} style={{ color: pattern.color }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: pattern.color }}>{pattern.title}</p>
                    <p className="text-[11px] text-white/40">{pattern.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <MonoLabel>Signals</MonoLabel>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pattern.signals.map((s, i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.06]">"{s}"</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <MonoLabel>Tactics</MonoLabel>
                    <ul className="mt-1 space-y-1">
                      {pattern.tactics.map((t, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-white/50">
                          <ArrowRight size={9} className="mt-0.5 shrink-0" style={{ color: pattern.color }} />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 6: War History ───────────────────────────────────────────────────────

function WarHistoryTab({ deals, onReAnalyze }: { deals: Deal[]; onReAnalyze: (text: string, channel: ChannelId) => void }) {
  const allAnalyses = deals
    .flatMap(d => d.analyses.map(a => ({ ...a, deal: d })))
    .sort((a, b) => b.timestamp - a.timestamp);

  if (allAnalyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <History size={32} className="text-white/20" />
        <p className="text-[14px] font-medium text-[#f6f6fd]">No intelligence history.</p>
        <p className="text-[12px] text-white/40">Run the Intel Analyzer on buyer communications to build your war record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History size={14} className="text-white/40" />
        <span className="text-[13px] font-semibold text-[#f6f6fd]">Intelligence History</span>
        <MonoLabel>{allAnalyses.length} records</MonoLabel>
      </div>
      {allAnalyses.map(entry => (
        <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-[#111113] p-4 space-y-3">
          <div className="flex items-start gap-3">
            <SmallScoreCircle score={entry.truthScore} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-[#f6f6fd]">{entry.deal.company}</span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-white/40 border border-white/[0.08]">{entry.channel}</span>
                <span className="text-[9px] font-mono text-white/25">{fmtTime(entry.timestamp)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.risk && <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${riskColor(entry.risk)}`}>{entry.risk}</span>}
                {entry.dealRisk && <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${riskColor(entry.dealRisk)}`}>deal: {entry.dealRisk}</span>}
                {entry.intent && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 border border-white/[0.08]">{intentLabel(entry.intent)}</span>}
                {entry.ghostProb > 40 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/25">👻 {entry.ghostProb}%</span>}
              </div>
              {entry.summary && <p className="text-[11px] text-white/40 leading-snug line-clamp-2">{entry.summary}</p>}
              {entry.text && <p className="text-[10px] text-white/25 italic leading-snug line-clamp-1">"{entry.text.slice(0, 120)}..."</p>}
            </div>
            <button
              onClick={() => onReAnalyze(entry.text, entry.channel as ChannelId)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
            >
              <ArrowRight size={10} /> Re-analyze
            </button>
          </div>
          {entry.competitors?.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
              <Crosshair size={10} className="text-amber-400" />
              <div className="flex flex-wrap gap-1">
                {entry.competitors.map((c, i) => <span key={i} className="text-[9px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">{c}</span>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TAB 7: Ghost Ops ─────────────────────────────────────────────────────────

function GhostOpsTab({ deals }: { deals: Deal[] }) {
  const { toast } = useToast();
  const ghosts = deals.filter(d => d.isGhost || d.ghostScore >= 40);

  function handleResurrection(deal: Deal) {
    const latestAnalysis = deal.analyses[0];
    const tactic = latestAnalysis
      ? `Re-engage with new value prop. Last signal: ${latestAnalysis.summary?.slice(0, 80) || "unknown"}`
      : "Send personalized 'Did we lose you?' message with ROI proof from similar accounts.";

    firePlay(deal.id, {
      name: "Ghost Resurrection",
      trigger: "cold_14_days",
      tactic,
      urgency: "high",
    });
    toast({ title: "Resurrection sequence fired", description: `Ghost Resurrection deployed for ${deal.company}` });
  }

  if (ghosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Ghost size={32} className="text-white/20" />
        <p className="text-[14px] font-medium text-[#f6f6fd]">No ghost deals.</p>
        <p className="text-[12px] text-white/40">Your pipeline is alive. Ghost Ops monitors for deals dark for 14+ days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Ghost size={14} className="text-rose-400" />
        <span className="text-[13px] font-semibold text-[#f6f6fd]">Ghost Ops</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">{ghosts.length} cold cases</span>
      </div>

      {ghosts.map(deal => {
        const latestAnalysis = deal.analyses[0];
        const sd = stallDays(deal);
        const ghostResurrection = (latestAnalysis as any)?.ghostResurrection;

        return (
          <div key={deal.id} className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/[0.05] to-transparent p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)" }}>
                  <Ghost size={18} className="text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#f6f6fd]">{deal.company}</span>
                    {deal.isHVT && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.15)", color: "#f87171", border: "1px solid rgba(220,38,38,0.3)" }}>🎯 HVT</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-rose-400">{sd}d dark</span>
                    <span className="text-[10px] text-white/30">Ghost Score: {deal.ghostScore}/100</span>
                  </div>
                </div>
              </div>
              <SmallScoreCircle score={deal.truthScore} />
            </div>

            {/* Timeline */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Created", value: fmtTime(deal.createdAt) },
                { label: "Last Analysis", value: latestAnalysis ? fmtTime(latestAnalysis.timestamp) : "None" },
                { label: "Days Dark", value: `${sd}d` },
                { label: "Ghost Score", value: `${deal.ghostScore}%` },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <MonoLabel>{item.label}</MonoLabel>
                  <p className="text-[12px] font-medium text-white/60">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Last known intel */}
            {latestAnalysis && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex flex-wrap gap-2">
                  {latestAnalysis.risk && <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${riskColor(latestAnalysis.risk)}`}>Last risk: {latestAnalysis.risk}</span>}
                  {deal.competitors[0] && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">⚠ {deal.competitors[0]}</span>}
                </div>
                {latestAnalysis.summary && (
                  <p className="text-[11px] text-white/40 leading-snug">{latestAnalysis.summary}</p>
                )}
              </div>
            )}

            {/* Resurrection Strategy */}
            <div className="p-3 rounded-lg space-y-2" style={{ background: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <div className="flex items-center gap-2">
                <Zap size={11} className="text-red-400" />
                <MonoLabel>Resurrection Strategy</MonoLabel>
              </div>
              <p className="text-[11px] text-white/55 leading-relaxed">
                {ghostResurrection?.reEngagementStrategy ||
                  deal.coldCaseReason ||
                  "Deploy personalized re-engagement with new value proof from a similar account. Reference their specific pain point from last interaction. Executive video from your CEO creates pattern interrupt at C-level."}
              </p>
              {ghostResurrection?.reEngagementMessage && (
                <div className="mt-2 p-2.5 rounded bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-[10px] text-white/40 italic leading-relaxed">"{ghostResurrection.reEngagementMessage}"</p>
                </div>
              )}
            </div>

            {/* Fire button */}
            <button
              onClick={() => handleResurrection(deal)}
              className="w-full py-2.5 rounded-full font-semibold text-[12px] flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={CRIMSON_BTN_STYLE}
            >
              <Flame size={13} /> Fire Resurrection Sequence
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AtomWarRoom() {
  const { deals, refresh } = useDeals();
  const [activeTab, setActiveTab] = useState<TabId>("command");
  const [reAnalyzeText, setReAnalyzeText] = useState<string>("");
  const [reAnalyzeChannel, setReAnalyzeChannel] = useState<ChannelId>("email");
  const [operatorDealId, setOperatorDealId] = useState<string>("");

  function handleReAnalyze(text: string, channel: ChannelId) {
    setReAnalyzeText(text);
    setReAnalyzeChannel(channel);
    setActiveTab("intel");
  }

  function handleSelectDeal(id: string) {
    setOperatorDealId(id);
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#0a0a0c" }}>
      {/* Header */}
      <div className="border-b border-white/[0.06]" style={{ background: "rgba(10,10,12,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", boxShadow: "0 0 12px rgba(220,38,38,0.4)" }}>
                <Swords size={14} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#f6f6fd]">ATOM War Room</span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.12)", color: "#f87171", border: "1px solid rgba(220,38,38,0.25)" }}>Von Clausewitz Engine</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-white/30">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06]" style={{ background: "rgba(10,10,12,0.9)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all shrink-0"
                  style={{
                    background: active ? "rgba(220,38,38,0.10)" : "transparent",
                    color: active ? "#f87171" : "rgba(255,255,255,0.35)",
                    borderBottom: active ? "2px solid #dc2626" : "2px solid transparent",
                  }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "command" && (
          <CommandCenterTab deals={deals} onTabChange={setActiveTab} />
        )}
        {activeTab === "intel" && (
          <IntelAnalyzerTab
            deals={deals}
            initialText={reAnalyzeText}
            initialChannel={reAnalyzeChannel}
          />
        )}
        {activeTab === "operator" && (
          <OperatorIntelTab deals={deals} />
        )}
        {activeTab === "pipeline" && (
          <DealPipelineTab deals={deals} onTabChange={setActiveTab} onSelectDeal={handleSelectDeal} />
        )}
        {activeTab === "playbook" && (
          <PlaybookEngineTab deals={deals} />
        )}
        {activeTab === "history" && (
          <WarHistoryTab deals={deals} onReAnalyze={handleReAnalyze} />
        )}
        {activeTab === "ghostops" && (
          <GhostOpsTab deals={deals} />
        )}
      </div>
    </div>
  );
}
