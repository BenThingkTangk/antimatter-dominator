import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Search,
  Loader2,
  Copy,
  CheckCircle2,
  Shield,
  TrendingUp,
  Users,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Building2,
  Zap,
  Clock,
  BarChart3,
  Phone,
  Mail,
  Linkedin,
  Target,
  History,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Cpu,
  Newspaper,
  Crosshair,
  MessageSquare,
  Activity,
  X,
  PhoneCall,
  Swords,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
  Signal,
  Eye,
  ArrowRight,
  Radar,
  Mic,
  Radio,
  Briefcase,
  User,
  FileText,
  Flame,
  Database,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyOverview {
  description: string;
  industry: string;
  founded: string;
  headquarters: string;
  employeeCount: string;
  revenue: string;
  website: string;
  stockTicker: string | null;
}

interface Competitor {
  name: string;
  threat: "high" | "medium" | "low";
  differentiator: string;
  yourAdvantages?: string[];
  theirWeaknesses?: string[];
  howToBeat?: string;
  marketShare?: string;
}

interface PainPoint {
  pain: string;
  severity: "critical" | "high" | "medium";
  opportunity: string;
  impact?: string;
  evidence?: string;
  urgencyScore?: number;
}

interface BuyingSignal {
  signal: string;
  strength: "strong" | "moderate" | "weak";
  source: string;
  category?: string;
  intentScore?: number;
  recency?: string;
  actionableInsight?: string;
}

interface NewsItem {
  headline: string;
  date: string;
  relevance: string;
  category?: string;
  impactScore?: number;
  salesAngle?: string;
}

interface ObjectionPrediction {
  objection: string;
  probability: "high" | "medium" | "low";
  counterStrategy: string;
  followUp?: string;
}

interface PitchAngle {
  angle: string;
  targetPersona: string;
  openingLine: string;
  proofPoints?: string[];
}

interface CallStrategy {
  bestTimeToCall: string;
  gatekeeperTips: string;
  toneRecommendation: string;
  keyQuestions: string[];
}

interface EmailSequenceItem {
  day: number;
  subject: string;
  angle: string;
}

interface BattleCard {
  pricingModel: string;
  contractTerms: string;
  switchingCost: string;
  winRate: string;
  knownWeaknesses: string[];
  customerComplaints: string[];
  featureGaps: string[];
  talkingPoints: string[];
  salesProcessWeaknesses: string[];
  strengthsVsUs?: string[];
  decisionCriteria?: string[];
  landmines?: string[];
  vendorLockIn?: string[];
}

interface BattlePlan {
  objectionPredictions: ObjectionPrediction[];
  pitchAngles: PitchAngle[];
  callStrategy: CallStrategy;
  emailSequence?: EmailSequenceItem[];
  multiThreadStrategy?: string;
  timingPlaybook?: string;
  competitiveTraps?: string[];
}

interface WarBook {
  overview: CompanyOverview;
  executiveSummary: string;
  techStack: string[];
  competitors: Competitor[];
  painPoints: PainPoint[];
  buyingSignals: BuyingSignal[];
  recentNews: NewsItem[];
  battleCard: BattleCard;
  battlePlan: BattlePlan;
  sentimentScore: number;
  buyerIntentScore: number;
  priorityLevel: "high" | "medium" | "low";
  objectionPredictions?: ObjectionPrediction[];
  pitchAngles?: PitchAngle[];
  callStrategy?: CallStrategy;
}

interface Contact {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  city?: string | null;
  state?: string | null;
  department?: string | null;
  seniority?: string | null;
}

interface WarBookResult {
  company: string;
  warbook: WarBook;
  contacts: Contact[];
  companyProfile: any;
  citations: string[];
  sources: { perplexity: boolean; apollo: boolean; pdl: boolean };
  generatedAt: string;
}

interface HistoryEntry {
  id: string;
  company: string;
  website?: string;
  result: WarBookResult;
  timestamp: number;
}

interface VoiceBrief {
  opener: string;
  objections: string[];
  discoveryQs: string[];
  talkTrack: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_URL = "https://45-79-202-76.sslip.io/research";
const STORAGE_KEY = "atom_warbook_history";

type Section = "sonar" | "synthesis" | "voicebrief" | "battlecard" | "people";

const SONAR_STEPS = [
  { label: "Deploying sonar deep-scan across the web...", icon: Radar },
  { label: "Scanning news, filings, and press releases...", icon: Newspaper },
  { label: "Analyzing LinkedIn, Glassdoor, and job posts...", icon: Users },
  { label: "Detecting tech stack signals...", icon: Cpu },
  { label: "Mapping org structure and decision makers...", icon: Target },
  { label: "AI synthesizing pain points and buying signals...", icon: Brain },
  { label: "Building objection map and competitive intel...", icon: Crosshair },
  { label: "Generating voice brief and call strategy...", icon: Mic },
];

const SECTIONS: { key: Section; label: string; icon: any }[] = [
  { key: "sonar", label: "Sonar Scans", icon: Radar },
  { key: "synthesis", label: "AI Synthesis", icon: Brain },
  { key: "voicebrief", label: "Voice Brief", icon: Mic },
  { key: "battlecard", label: "Battle Card", icon: Swords },
  { key: "people", label: "Decision Makers", icon: Users },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20))); } catch {}
}
function fmtTimestamp(ts: number): string {
  const h = (Date.now() - ts) / 3.6e6;
  if (h < 1) { const m = Math.floor((Date.now() - ts) / 60000); return m <= 1 ? "just now" : `${m}m ago`; }
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function generateVoiceBrief(result: WarBookResult): VoiceBrief {
  const wb = result.warbook;
  const pp = wb?.painPoints?.slice(0, 3).map(p => p.pain) || [];
  const init = wb?.buyingSignals?.[0]?.signal || "digital transformation";
  const painRef = pp.length > 0 ? ` I noticed you may be dealing with ${pp[0].toLowerCase()}.` : "";
  return {
    opener: `Hey there — this is ADAM from Antimatter AI. I was doing some research on ${result.company} and saw you're leading the push${init ? ` around ${init.toLowerCase()}` : " in your space"}.${painRef} How's that effort going with your current setup?`,
    objections: (wb?.battlePlan?.objectionPredictions || wb?.objectionPredictions || []).slice(0, 5).map(o => typeof o === "string" ? o : o.objection),
    discoveryQs: wb?.battlePlan?.callStrategy?.keyQuestions?.slice(0, 6) || [
      `What does your current stack look like for ${result.company}'s core workflows?`,
      "What's your biggest operational bottleneck right now?",
      "Who else is involved in evaluating solutions like this?",
      "What would success look like in 90 days if we partnered?",
      "What's your timeline for making a decision?",
    ],
    talkTrack: [
      `Open with pain: "${pp[0] || "infrastructure challenges"}" — show you've done homework`,
      `Pivot to value: Connect their ${init || "initiative"} to ATOM's capabilities`,
      `Social proof: Reference similar companies in their vertical that switched to ATOM`,
      `Discovery: Ask open-ended questions about their decision timeline and stakeholders`,
      `Close: Propose a 15-min deep dive with their technical lead`,
    ],
  };
}

// Color helpers
const sevColor = (s: string) => s === "critical" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : s === "high" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-teal-500/15 text-teal-400 border-teal-500/25";
const threatColor = (t: string) => t === "high" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : t === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
const strengthColor = (s: string) => s === "strong" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : s === "moderate" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/40 border-white/10";
const probColor = (p: string) => p === "high" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : p === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/40 border-white/10";
const priorityColor = (l: string) => l === "high" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : l === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-teal-500/15 text-teal-400 border-teal-500/25";

function catBadge(cat: string): string {
  const m: Record<string, string> = {
    product_launch: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    funding: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    partnership: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    leadership: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    leadership_change: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    disruption: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    acquisition: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    tech_adoption: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    earnings: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };
  return m[cat] || "bg-white/5 text-white/40 border-white/10";
}
function fmtCat(cat: string): string {
  return (cat || "Other").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
function seniorityStyle(title: string): string {
  const t = title.toLowerCase();
  if (/chief|cto|ceo|coo|cfo|ciso|c-/.test(t)) return "bg-teal-500/15 border-teal-500/30 text-teal-300";
  if (/vp|vice president/.test(t)) return "bg-blue-500/15 border-blue-500/30 text-blue-300";
  if (/director/.test(t)) return "bg-purple-500/15 border-purple-500/30 text-purple-300";
  return "bg-white/5 border-white/10 text-white/50";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">{children}</span>;
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36, c = 2 * Math.PI * r, filled = (value / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
          <span className="text-[9px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

function StatCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-cyan-400/60" />
        <MonoLabel>{label}</MonoLabel>
      </div>
      <div className="text-[13px] font-semibold text-[#f6f6fd] leading-tight">{value || "—"}</div>
    </div>
  );
}

function PipelineFlow() {
  const nodes = [
    { label: "Company Input", icon: Building2 },
    { label: "Sonar Deep Research", icon: Radar },
    { label: "ATOM AI Context Builder", icon: Brain },
    { label: "ATOM Voice Brief", icon: Mic },
  ];
  const cards = [
    { icon: Radar, title: "SONAR SCANS", body: "News, filings, LinkedIn, Glassdoor, job posts, press releases, tech stack signals", color: "text-cyan-400", border: "border-cyan-500/20" },
    { icon: Brain, title: "AI SYNTHESIZES", body: "Pain points, purchase triggers, buying signals, org structure, objection map", color: "text-teal-400", border: "border-teal-500/20" },
    { icon: Mic, title: "VOICE BRIEF", body: "Personalized call script, live objection handling, talk track, discovery Qs", color: "text-emerald-400", border: "border-emerald-500/20" },
  ];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-5">
      <MonoLabel>WarBook Intelligence Pipeline</MonoLabel>
      <div className="flex items-center gap-1 flex-wrap">
        {nodes.map((n, i) => (
          <div key={n.label} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <n.icon size={11} className="text-white/40" />
              <span className="text-[11px] text-white/50 whitespace-nowrap">{n.label}</span>
            </div>
            {i < nodes.length - 1 && <ArrowRight size={12} className="text-white/20 shrink-0" />}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.title} className={`rounded-lg border ${c.border} bg-white/[0.02] p-3 space-y-1.5`}>
            <div className="flex items-center gap-1.5"><c.icon size={12} className={c.color} /><MonoLabel>{c.title}</MonoLabel></div>
            <p className="text-[11px] text-white/40 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History Drawer ──────────────────────────────────────────────────────────

function HistoryDrawer({ open, onClose, onRestore }: { open: boolean; onClose: () => void; onRestore: (e: HistoryEntry) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => { if (open) setHistory(loadHistory()); }, [open]);
  const del = (id: string) => { const u = history.filter(e => e.id !== id); setHistory(u); saveHistory(u); };
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />}
      <div className={`fixed top-0 right-0 bottom-0 w-96 z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`} style={{ background: "#111113", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-semibold text-[#e8e8ea]">WarBook History</span>
            {history.length > 0 && <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/20 text-[10px] font-mono">{history.length}</Badge>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <History className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30">No WarBooks built yet</p>
            </div>
          ) : history.map(entry => (
            <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-[#161618] p-3 hover:border-teal-500/20 transition-all group">
              <div className="flex items-start justify-between gap-2">
                <button className="flex-1 text-left" onClick={() => { onRestore(entry); onClose(); }}>
                  <div className="flex items-center gap-2 mb-1"><Building2 className="w-3.5 h-3.5 text-teal-400" /><span className="text-sm font-semibold text-[#e8e8ea]">{entry.company}</span></div>
                  <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-white/20" /><span className="text-[10px] text-white/30 font-mono">{fmtTimestamp(entry.timestamp)}</span></div>
                </button>
                <Button variant="ghost" size="sm" onClick={() => del(entry.id)} className="h-6 w-6 p-0 text-white/20 hover:text-rose-400 opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Section: SONAR SCANS ────────────────────────────────────────────────────

function SonarScansSection({ wb, citations }: { wb: WarBook; citations: string[] }) {
  const news = wb.recentNews || [];
  const techStack = wb.techStack || [];
  const signals = wb.buyingSignals || [];

  return (
    <div className="space-y-5 fade-in">
      {/* News & Press Releases */}
      <div className="rounded-xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.03] to-transparent p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-cyan-400" />
          <MonoLabel>News, Filings & Press Releases</MonoLabel>
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-mono ml-auto">{news.length} signals</Badge>
        </div>
        {news.length > 0 ? (
          <div className="space-y-2">
            {news.map((n, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/15 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.impactScore && n.impactScore >= 7 ? "bg-cyan-400" : "bg-white/20"}`} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[13px] font-medium text-[#e8e8ea] leading-snug">{n.headline}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.category && <Badge className={`text-[9px] font-mono ${catBadge(n.category)}`}>{fmtCat(n.category)}</Badge>}
                    {n.date && <span className="text-[10px] text-white/25 font-mono">{n.date}</span>}
                    {n.impactScore && <span className="text-[10px] text-white/20 font-mono">Impact: {n.impactScore}/10</span>}
                  </div>
                  {n.salesAngle && <p className="text-[11px] text-teal-400/70 mt-1"><Zap size={9} className="inline mr-1" />{n.salesAngle}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/25">No recent news detected</p>}
      </div>

      {/* Tech Stack Detection */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-cyan-400" />
          <MonoLabel>Tech Stack Signals</MonoLabel>
        </div>
        {techStack.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {techStack.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/15 text-[11px] px-3 py-1.5 rounded-lg font-medium">
                <Database size={10} />{t}
              </span>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/25">No tech stack data available</p>}
      </div>

      {/* Buying Signals */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <MonoLabel>Buying Signals Detected</MonoLabel>
          {wb.buyerIntentScore > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono ml-auto" style={{ background: "rgba(250,204,21,0.1)", color: "#fbbf24", border: "1px solid rgba(250,204,21,0.2)" }}>
              Intent: {wb.buyerIntentScore}/10
            </span>
          )}
        </div>
        {signals.length > 0 ? (
          <div className="space-y-2">
            {signals.map((sig, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: sig.intentScore && sig.intentScore >= 7 ? "#22d3ee" : "#00c8c8" }} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[13px] text-[#e8e8ea]">{sig.signal}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[9px] font-mono ${strengthColor(sig.strength)}`}>{sig.strength}</Badge>
                    {sig.category && <Badge className={`text-[9px] font-mono ${catBadge(sig.category)}`}>{fmtCat(sig.category)}</Badge>}
                    {sig.recency && <span className="text-[10px] text-white/20 font-mono">{sig.recency}</span>}
                  </div>
                  {sig.actionableInsight && <p className="text-[11px] text-teal-400/60 mt-1"><Target size={9} className="inline mr-1" />{sig.actionableInsight}</p>}
                </div>
                {sig.intentScore && <span className="text-[11px] text-white/30 font-mono shrink-0 tabular-nums">{sig.intentScore}/10</span>}
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/25">No buying signals detected</p>}
      </div>

      {/* Sources */}
      {citations.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2">
          <div className="flex items-center gap-1.5"><Globe size={11} className="text-white/20" /><MonoLabel>Sonar Sources ({citations.length})</MonoLabel></div>
          <div className="space-y-1">
            {citations.slice(0, 8).map((c, i) => (
              <a key={i} href={c} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-cyan-400/70 transition-colors truncate">
                <ExternalLink size={9} className="shrink-0" /><span className="truncate">{c}</span>
              </a>
            ))}
            {citations.length > 8 && <p className="text-[10px] text-white/20 font-mono">+{citations.length - 8} more</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: AI SYNTHESIS ───────────────────────────────────────────────────

function AISynthesisSection({ wb, company }: { wb: WarBook; company: string }) {
  const painPoints = wb.painPoints || [];
  const competitors = wb.competitors || [];

  return (
    <div className="space-y-5 fade-in">
      {/* Pain Points */}
      <div className="rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.03] to-transparent p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Flame size={14} className="text-rose-400" />
          <MonoLabel>Pain Points & Purchase Triggers</MonoLabel>
          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] font-mono ml-auto">{painPoints.length} identified</Badge>
        </div>
        {painPoints.length > 0 ? (
          <div className="space-y-2">
            {painPoints.map((pp, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#e8e8ea] leading-snug flex-1">{pp.pain}</p>
                  <Badge className={`text-[9px] font-mono shrink-0 ${sevColor(pp.severity)}`}>{pp.severity}</Badge>
                </div>
                {pp.opportunity && <p className="text-[11px] text-teal-400/70"><Target size={9} className="inline mr-1" />{pp.opportunity}</p>}
                {pp.evidence && <p className="text-[11px] text-white/30"><Eye size={9} className="inline mr-1" />{pp.evidence}</p>}
                {pp.urgencyScore && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${pp.urgencyScore >= 8 ? "bg-rose-500" : pp.urgencyScore >= 5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pp.urgencyScore * 10}%` }} />
                    </div>
                    <span className="text-[10px] text-white/25 font-mono">{pp.urgencyScore}/10</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/25">No pain points identified</p>}
      </div>

      {/* Competitive Landscape */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Swords size={14} className="text-amber-400" />
          <MonoLabel>Competitive Landscape</MonoLabel>
        </div>
        {competitors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {competitors.map((c, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#e8e8ea]">{c.name}</span>
                  <Badge className={`text-[9px] font-mono ${threatColor(c.threat)}`}>{c.threat} threat</Badge>
                </div>
                {c.differentiator && <p className="text-[11px] text-white/40">{c.differentiator}</p>}
                {c.howToBeat && <p className="text-[11px] text-teal-400/70"><Crosshair size={9} className="inline mr-1" />How to beat: {c.howToBeat}</p>}
                {c.theirWeaknesses && c.theirWeaknesses.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {c.theirWeaknesses.slice(0, 3).map((w, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/15">{w}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <p className="text-[12px] text-white/25">No competitive data available</p>}
      </div>

      {/* Objection Map */}
      {(wb.battlePlan?.objectionPredictions || wb.objectionPredictions || []).length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-400" />
            <MonoLabel>Objection Map</MonoLabel>
          </div>
          <div className="space-y-2">
            {(wb.battlePlan?.objectionPredictions || wb.objectionPredictions || []).map((obj, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#e8e8ea] flex-1">{typeof obj === "string" ? obj : obj.objection}</p>
                  {typeof obj !== "string" && <Badge className={`text-[9px] font-mono shrink-0 ${probColor(obj.probability)}`}>{obj.probability}</Badge>}
                </div>
                {typeof obj !== "string" && obj.counterStrategy && (
                  <p className="text-[11px] text-teal-400/70"><Shield size={9} className="inline mr-1" />{obj.counterStrategy}</p>
                )}
                {typeof obj !== "string" && obj.followUp && (
                  <p className="text-[11px] text-white/30"><ArrowRight size={9} className="inline mr-1" />{obj.followUp}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: VOICE BRIEF ────────────────────────────────────────────────────

function VoiceBriefSection({ brief, company, callStrategy }: { brief: VoiceBrief; company: string; callStrategy?: CallStrategy }) {
  return (
    <div className="space-y-5 fade-in">
      {/* Call Script */}
      <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.03] to-transparent p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic size={14} className="text-emerald-400" />
            <MonoLabel>Personalized Call Script</MonoLabel>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>ADAM VOICE READY</span>
        </div>
        <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.12)" }}>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(0,200,200,0.15)", color: "#00c8c8" }}>ADAM</span>
            <p className="text-[13px] text-white/70 leading-relaxed">{brief.opener}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>THEM</span>
            <p className="text-[12px] text-white/25 leading-relaxed italic">[Listen for signals: current tooling, team size, pain points, decision timeline]</p>
          </div>
        </div>
      </div>

      {/* Talk Track */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-teal-400" />
          <MonoLabel>Talk Track</MonoLabel>
        </div>
        <div className="space-y-2">
          {brief.talkTrack.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ background: "rgba(0,200,200,0.1)", color: "#00c8c8", border: "1px solid rgba(0,200,200,0.2)" }}>{i + 1}</div>
              <p className="text-[12px] text-white/55 leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Discovery Questions */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-cyan-400" />
          <MonoLabel>Discovery Questions</MonoLabel>
        </div>
        <div className="space-y-1.5">
          {brief.discoveryQs.map((q, i) => (
            <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
              <ChevronRight size={12} className="text-teal-400/60 mt-0.5 shrink-0" />
              <p className="text-[12px] text-white/55">{q}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Objection Handling */}
      {brief.objections.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-400" />
            <MonoLabel>Live Objection Handling</MonoLabel>
          </div>
          <div className="space-y-2">
            {brief.objections.map((obj, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <AlertTriangle size={11} className="text-amber-400/60 mt-0.5 shrink-0" />
                <p className="text-[12px] text-white/55">{obj}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Strategy */}
      {callStrategy && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <PhoneCall size={14} className="text-teal-400" />
            <MonoLabel>Call Strategy</MonoLabel>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCell icon={Clock} label="Best Time" value={callStrategy.bestTimeToCall || "—"} />
            <StatCell icon={Shield} label="Gatekeeper Tips" value={callStrategy.gatekeeperTips || "—"} />
            <StatCell icon={MessageSquare} label="Tone" value={callStrategy.toneRecommendation || "—"} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: BATTLE CARD ────────────────────────────────────────────────────

function BattleCardSection({ wb }: { wb: WarBook }) {
  const bc = wb.battleCard;
  const bp = wb.battlePlan;
  if (!bc && !bp) return <p className="text-[12px] text-white/25 py-8 text-center">No battle card data available</p>;

  return (
    <div className="space-y-5 fade-in">
      {/* Pricing & Terms */}
      {bc && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2"><DollarSign size={14} className="text-teal-400" /><MonoLabel>Pricing & Lock-In</MonoLabel></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCell icon={DollarSign} label="Pricing Model" value={bc.pricingModel || "—"} />
            <StatCell icon={FileText} label="Contract Terms" value={bc.contractTerms || "—"} />
            <StatCell icon={Lock} label="Switching Cost" value={bc.switchingCost || "—"} />
          </div>
        </div>
      )}

      {/* Vulnerabilities */}
      {bc && (bc.knownWeaknesses?.length > 0 || bc.customerComplaints?.length > 0) && (
        <div className="rounded-xl border border-rose-500/10 bg-gradient-to-br from-rose-500/[0.02] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-rose-400" /><MonoLabel>Vulnerabilities</MonoLabel></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bc.knownWeaknesses?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-rose-400/80">Known Weaknesses</p>
                {bc.knownWeaknesses.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-white/50"><AlertCircle size={10} className="text-rose-400/50 mt-0.5 shrink-0" />{w}</div>
                ))}
              </div>
            )}
            {bc.customerComplaints?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-amber-400/80">Customer Complaints</p>
                {bc.customerComplaints.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-[12px] text-white/50"><MessageSquare size={10} className="text-amber-400/50 mt-0.5 shrink-0" />{c}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competitive Talking Points */}
      {bc?.talkingPoints?.length > 0 && (
        <div className="rounded-xl border border-teal-500/15 bg-gradient-to-br from-teal-500/[0.03] to-transparent p-5 space-y-4">
          <div className="flex items-center gap-2"><Crosshair size={14} className="text-teal-400" /><MonoLabel>Competitive Talking Points</MonoLabel></div>
          <div className="space-y-2">
            {bc.talkingPoints.map((tp, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] text-[12px] text-white/55"><Zap size={10} className="text-teal-400/60 mt-0.5 shrink-0" />{tp}</div>
            ))}
          </div>
        </div>
      )}

      {/* Pitch Angles */}
      {(bp?.pitchAngles || wb.pitchAngles || []).length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          <div className="flex items-center gap-2"><TrendingUp size={14} className="text-teal-400" /><MonoLabel>Pitch Angles</MonoLabel></div>
          <div className="space-y-2">
            {(bp?.pitchAngles || wb.pitchAngles || []).map((pa, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-1.5">
                <p className="text-[13px] font-medium text-[#e8e8ea]">{typeof pa === "string" ? pa : pa.angle}</p>
                {typeof pa !== "string" && pa.targetPersona && <p className="text-[11px] text-teal-400/60"><User size={9} className="inline mr-1" />{pa.targetPersona}</p>}
                {typeof pa !== "string" && pa.openingLine && <p className="text-[11px] text-white/35 italic">"{pa.openingLine}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: PEOPLE ─────────────────────────────────────────────────────────

function PeopleSection({ contacts }: { contacts: Contact[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (val: string) => { navigator.clipboard.writeText(val); setCopied(val); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-teal-400" />
        <MonoLabel>Org Structure & Decision Makers</MonoLabel>
        <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-[10px] font-mono ml-auto">{contacts.length} contacts</Badge>
      </div>
      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/[0.06] bg-[#111113] hover:border-teal-500/15 transition-all space-y-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold border shrink-0 ${seniorityStyle(c.title)}`}>
                  {c.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#e8e8ea] truncate">{c.name}</p>
                  <p className="text-[11px] text-white/40 truncate">{c.title}</p>
                  {c.department && <p className="text-[10px] text-white/20">{c.department}{c.seniority ? ` · ${c.seniority}` : ""}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {c.email && (
                  <button onClick={() => copy(c.email!)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-teal-400 bg-white/[0.03] border border-white/[0.06] hover:border-teal-500/20 transition-all">
                    {copied === c.email ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Mail size={10} />}
                    <span className="truncate max-w-[140px]">{c.email}</span>
                  </button>
                )}
                {c.phone && (
                  <button onClick={() => copy(c.phone!)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-teal-400 bg-white/[0.03] border border-white/[0.06] hover:border-teal-500/20 transition-all">
                    {copied === c.phone ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Phone size={10} />}
                    {c.phone}
                  </button>
                )}
                {c.linkedin && (
                  <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-blue-400 bg-white/[0.03] border border-white/[0.06] hover:border-blue-500/20 transition-all">
                    <Linkedin size={10} />LinkedIn
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 text-center">
          <Users className="w-10 h-10 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No contacts found for this company</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyIntelligence() {
  const { toast } = useToast();

  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [depth, setDepth] = useState<"standard" | "enterprise">("enterprise");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<WarBookResult | null>(null);
  const [voiceBrief, setVoiceBrief] = useState<VoiceBrief | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("sonar");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sonarStep, setSonarStep] = useState(0);

  const stepRef = useRef<NodeJS.Timeout | null>(null);

  // Sonar loading animation
  useEffect(() => {
    if (!isLoading) return;
    setSonarStep(0);
    let idx = 0;
    stepRef.current = setInterval(() => {
      idx = (idx + 1) % SONAR_STEPS.length;
      setSonarStep(idx);
    }, 2200);
    return () => { if (stepRef.current) clearInterval(stepRef.current); };
  }, [isLoading]);

  async function handleBuild() {
    if (!company.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResult(null);
    setVoiceBrief(null);
    setActiveSection("sonar");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), website: website.trim() || undefined, depth }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Research failed (${res.status})`);
      const data: WarBookResult = await res.json();
      setResult(data);

      // Auto-generate voice brief
      const brief = generateVoiceBrief(data);
      setVoiceBrief(brief);

      // Save to history
      const entry: HistoryEntry = { id: crypto.randomUUID(), company: company.trim(), website: website.trim(), result: data, timestamp: Date.now() };
      const hist = loadHistory();
      hist.unshift(entry);
      saveHistory(hist);

      toast({ title: "WarBook Complete", description: `Full intelligence dossier loaded for ${company}.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Research failed", description: "Could not complete research. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      if (stepRef.current) clearInterval(stepRef.current);
    }
  }

  function handleRestore(entry: HistoryEntry) {
    setResult(entry.result);
    setCompany(entry.company);
    setWebsite(entry.website || "");
    const brief = generateVoiceBrief(entry.result);
    setVoiceBrief(brief);
    setActiveSection("sonar");
  }

  const wb = result?.warbook;
  const overview = wb?.overview;
  const profile = result?.companyProfile;

  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif" }}>
      <style>{`
        @keyframes sonarPulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.08); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scanLine { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .fade-in { animation: fadeIn 0.5s ease-out both; }
      `}</style>

      <div className="space-y-5">

        {/* ── Header Bar ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "rgba(0,200,200,0.08)", border: "1px solid rgba(0,200,200,0.2)" }}>
              <Brain size={20} className="text-teal-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#f6f6fd] leading-tight">ATOM WarBook</h1>
              <p className="text-[12px] text-white/30">ATOM Deep Intelligence Engine</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-1.5 text-[12px] border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 bg-transparent" data-testid="button-history">
            <History size={14} />History
          </Button>
        </div>

        {/* ── Input Section ── */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
          {/* Depth toggle */}
          <div className="flex items-center gap-3">
            <MonoLabel>Research Depth:</MonoLabel>
            <div className="flex gap-1.5">
              {(["standard", "enterprise"] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-wide transition-all ${depth === d
                    ? "text-[#00c8c8] border-[#00c8c8]/40"
                    : "text-white/35 border-white/10 hover:border-white/20"
                  }`}
                  style={{
                    background: depth === d ? "rgba(0,200,200,0.08)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${depth === d ? "rgba(0,200,200,0.4)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {d === "standard" ? "Standard (3 queries · ~20s)" : "Enterprise (5 queries · ~40s)"}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleBuild()}
                placeholder="e.g. Cloudflare, Akamai, Salesforce..."
                className="w-full pl-8 pr-3 py-2.5 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/25 outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(0,200,200,0.3)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                data-testid="input-company"
              />
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-white/15 font-mono pointer-events-none select-none" style={{ display: company ? "none" : undefined }}>COMPANY NAME</span>
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://cloudflare.com"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/25 outline-none transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                data-testid="input-website"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-white/15 font-mono pointer-events-none">(OPTIONAL)</span>
            </div>
            <Button
              onClick={handleBuild}
              disabled={isLoading}
              className="gap-2 px-5 py-2.5 rounded-lg font-semibold text-[13px] transition-all disabled:opacity-50"
              style={{ background: "#00c8c8", color: "#0b0b0c" }}
              data-testid="button-build-warbook"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
              {isLoading ? "Building..." : `Build WarBook (${depth === "enterprise" ? "5" : "3"} queries)`}
            </Button>
          </div>

          {/* Quick suggestions */}
          {!result && !isLoading && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-white/20 font-mono">QUICK:</span>
              {["Cloudflare", "Akamai", "Salesforce", "HubSpot", "Snowflake"].map(c => (
                <button key={c} onClick={() => setCompany(c)} className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-white/35 hover:text-white/60 hover:border-white/20 bg-white/[0.02] transition-all">{c}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── Sonar Loading Animation ── */}
        {isLoading && (
          <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.04] to-transparent p-5 space-y-4 fade-in">
            <div className="flex items-center gap-3">
              <div className="relative w-5 h-5 shrink-0">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30" />
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              </div>
              <span className="text-[13px] text-cyan-400/80 font-mono">{SONAR_STEPS[sonarStep].label}</span>
            </div>
            {/* Scan line animation */}
            <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" style={{ animation: "scanLine 1.5s ease-in-out infinite" }} />
            </div>
            {/* Step indicators */}
            <div className="flex gap-1.5">
              {SONAR_STEPS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= sonarStep ? "bg-cyan-400/50" : "bg-white/[0.04]"}`} />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!result && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="flex items-center justify-center w-20 h-20 rounded-full" style={{ background: "rgba(0,200,200,0.06)", border: "1px solid rgba(0,200,200,0.15)" }}>
              <Brain size={36} className="text-teal-400/50" style={{ animation: "sonarPulse 2.5s ease-in-out infinite" }} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-base font-semibold text-white/40">Enter a company to build their WarBook</h2>
              <p className="text-[13px] text-white/20 max-w-md">
                ATOM will compile a full intelligence package on this company, including decision makers, pain points, buying signals, and a complete battle plan.
              </p>
            </div>
            <div className="mt-6 w-full max-w-3xl">
              <PipelineFlow />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {result && wb && (
          <div className="space-y-5 fade-in">

            {/* Company Command Header */}
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-6 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold text-[#f6f6fd] leading-tight">{result.company}</h2>
                    <Badge className={`text-[10px] font-mono ${priorityColor(wb.priorityLevel || "low")}`}>{wb.priorityLevel || "—"} priority</Badge>
                    {overview?.stockTicker && <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px] font-mono">{overview.stockTicker}</Badge>}
                  </div>
                  {overview?.industry && <p className="text-[12px] text-teal-400/70 font-mono uppercase tracking-wider">{overview.industry}</p>}
                  {(overview?.description || wb.executiveSummary) && (
                    <p className="text-[13px] text-white/50 leading-relaxed max-w-2xl">{overview?.description || wb.executiveSummary}</p>
                  )}
                </div>
                <div className="flex items-center gap-5">
                  <Gauge value={wb.sentimentScore || 0} label="Sentiment" color="#00c8c8" />
                  <Gauge value={wb.buyerIntentScore ? wb.buyerIntentScore * 10 : 0} label="Intent" color="#22d3ee" />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                <StatCell icon={DollarSign} label="Revenue" value={overview?.revenue || profile?.revenue || "—"} />
                <StatCell icon={Users} label="Employees" value={String(overview?.employeeCount || profile?.employeeCount || "—")} />
                <StatCell icon={MapPin} label="HQ" value={overview?.headquarters || profile?.location || "—"} />
                <StatCell icon={Calendar} label="Founded" value={overview?.founded || "—"} />
                <StatCell icon={Globe} label="Website" value={overview?.website || "—"} />
                <StatCell icon={Signal} label="Tech Stack" value={`${(wb.techStack || []).length} detected`} />
              </div>
            </div>

            {/* Section Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveSection(s.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${isActive ? "text-[#00c8c8]" : "text-white/35 hover:text-white/55"}`}
                    style={{
                      background: isActive ? "rgba(0,200,200,0.08)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isActive ? "rgba(0,200,200,0.25)" : "rgba(255,255,255,0.06)"}`,
                    }}
                    data-testid={`tab-${s.key}`}
                  >
                    <Icon size={14} />
                    {s.label}
                    {s.key === "sonar" && (wb.recentNews?.length || 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-mono">{wb.recentNews.length}</span>
                    )}
                    {s.key === "people" && (result.contacts?.length || 0) > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400 font-mono">{result.contacts.length}</span>
                    )}
                  </button>
                );
              })}

              {/* Export button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                  toast({ title: "Copied", description: "WarBook data copied to clipboard." });
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/15 bg-white/[0.02] transition-all ml-auto"
              >
                <Copy size={12} />Export
              </button>
            </div>

            {/* Active Section Content */}
            <div className="min-h-[400px]">
              {activeSection === "sonar" && <SonarScansSection wb={wb} citations={result.citations || []} />}
              {activeSection === "synthesis" && <AISynthesisSection wb={wb} company={result.company} />}
              {activeSection === "voicebrief" && voiceBrief && <VoiceBriefSection brief={voiceBrief} company={result.company} callStrategy={wb.battlePlan?.callStrategy || wb.callStrategy} />}
              {activeSection === "battlecard" && <BattleCardSection wb={wb} />}
              {activeSection === "people" && <PeopleSection contacts={result.contacts || []} />}
            </div>
          </div>
        )}
      </div>

      {/* History Drawer */}
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} onRestore={handleRestore} />
    </div>
  );
}
