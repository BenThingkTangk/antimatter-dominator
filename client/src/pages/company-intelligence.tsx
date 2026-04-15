import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
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
  BookOpen,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Building2,
  Zap,
  Database,
  Clock,
  BarChart3,
  Phone,
  Mail,
  Linkedin,
  RefreshCw,
  Target,
  Flame,
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
  ArrowLeft,
  PhoneCall,
  Swords,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
  Signal,
  Eye,
  EyeOff,
  ArrowRight,
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
  // Legacy flat fields
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

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_URL = "/api/warbook/research";
const STORAGE_KEY = "atom_warbook_history";

type Tab = "intel" | "people" | "competitive" | "pain" | "signals" | "news" | "battlecard" | "battleplan";
type BattleCardSubTab = "pricing" | "vulnerabilities" | "features" | "ammo" | "landmines";

const LOADING_STEPS = [
  { label: "Searching the web for company intel...", icon: Search },
  { label: "Analyzing competitors & market position...", icon: Shield },
  { label: "Finding decision makers...", icon: Users },
  { label: "Identifying pain points & opportunities...", icon: Target },
  { label: "Building battle plan & objection handlers...", icon: Crosshair },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {}
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return mins <= 1 ? "just now" : `${mins}m ago`;
  }
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function priorityColor(level: string): string {
  if (level === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (level === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-violet-500/15 text-violet-400 border-violet-500/25";
}

function threatColor(t: string): string {
  if (t === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (t === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
}

function severityColor(s: string): string {
  if (s === "critical") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (s === "high") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-violet-500/15 text-violet-400 border-violet-500/25";
}

function strengthColor(s: string): string {
  if (s === "strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  if (s === "moderate") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-white/5 text-white/40 border-white/10";
}

function probColor(p: string): string {
  if (p === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (p === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-white/5 text-white/40 border-white/10";
}

function seniorityAvatarColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("chief") || t.includes("cto") || t.includes("ceo") || t.includes("coo") || t.includes("cfo") || t.includes("ciso") || t.includes("c-")) {
    return "bg-violet-500/15 border-violet-500/30 text-violet-300";
  }
  if (t.includes("vp") || t.includes("vice president")) {
    return "bg-blue-500/15 border-blue-500/30 text-blue-300";
  }
  if (t.includes("director")) {
    return "bg-purple-500/15 border-purple-500/30 text-purple-300";
  }
  return "bg-white/5 border-white/10 text-white/50";
}

function getSeniorityLabel(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("chief") || t.includes("cto") || t.includes("ceo") || t.includes("coo") || t.includes("cfo") || t.includes("ciso")) return "c-suite";
  if (t.includes("vp") || t.includes("vice president")) return "vp";
  if (t.includes("director")) return "director";
  if (t.includes("manager")) return "manager";
  return "senior";
}

function formatCategory(cat: string): string {
  if (!cat) return "Other";
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    product_launch: "emerald",
    funding: "blue",
    funding_round: "blue",
    partnership: "purple",
    leadership: "amber",
    leadership_change: "amber",
    leadership_hire: "amber",
    disruption: "rose",
    market_disruption: "rose",
    earnings: "teal",
    acquisition: "indigo",
    regulatory: "orange",
    customer_win: "green",
    customer_loss: "red",
    user_sentiment: "violet",
    tech_adoption: "cyan",
    expansion: "blue",
    budget_increase: "emerald",
    vendor_switch: "amber",
    contract_renewal: "purple",
    pain_trigger: "rose",
  };
  return map[cat] || "white";
}

function categoryDot(cat: string): string {
  const color = categoryColor(cat);
  const map: Record<string, string> = {
    emerald: "bg-emerald-400",
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    teal: "bg-teal-400",
    indigo: "bg-indigo-400",
    orange: "bg-orange-400",
    green: "bg-green-400",
    red: "bg-red-400",
    violet: "bg-violet-400",
    cyan: "bg-cyan-400",
    white: "bg-white/30",
  };
  return map[color] || "bg-white/30";
}

function categoryBadge(cat: string): string {
  const color = categoryColor(cat);
  const map: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    white: "bg-white/5 text-white/40 border-white/10",
  };
  return map[color] || "bg-white/5 text-white/40 border-white/10";
}

function intentBarColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function urgencyBarColor(score: number): string {
  if (score >= 8) return "bg-rose-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-emerald-500";
}

function impactBarColor(score: number): string {
  if (score >= 8) return "bg-rose-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-emerald-500";
}

// ─── Gauge Component ──────────────────────────────────────────────────────────

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums" style={{ color, fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
            {value}
          </span>
          <span className="text-[9px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

// ─── History Drawer ───────────────────────────────────────────────────────────

function HistoryDrawer({
  open,
  onClose,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => { if (open) setHistory(loadHistory()); }, [open]);

  const deleteEntry = (id: string) => {
    const updated = history.filter((e) => e.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 bottom-0 w-96 z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "#111113", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              WarBook History
            </span>
            {history.length > 0 && (
              <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/20 text-[10px] font-mono">{history.length}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <History className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30">No WarBooks built yet</p>
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-[#161618] p-3 hover:border-violet-500/20 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 text-left" onClick={() => { onRestore(entry); onClose(); }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-sm font-semibold text-[#e8e8ea]">{entry.company}</span>
                      <Badge className={`text-[9px] font-mono ml-auto ${priorityColor(entry.result.warbook?.priorityLevel || "low")}`}>
                        {entry.result.warbook?.priorityLevel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-white/20" />
                      <span className="text-[10px] text-white/30 font-mono">{formatTimestamp(entry.timestamp)}</span>
                      {entry.website && <span className="text-[10px] text-white/20 truncate">{entry.website}</span>}
                    </div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}
                    className="h-6 w-6 p-0 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <button className="mt-2 w-full text-[10px] text-violet-400/60 hover:text-violet-400 transition-colors text-left flex items-center gap-1"
                  onClick={() => { onRestore(entry); onClose(); }}>
                  <ArrowLeft className="w-3 h-3 rotate-180" />View WarBook
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Empty State Helper ───────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Card className="bg-[#111113] border-white/[0.08]">
      <CardContent className="py-12 flex flex-col items-center gap-2">
        <Icon className="w-10 h-10 text-white/10" />
        <p className="text-sm text-white/25">{label}</p>
      </CardContent>
    </Card>
  );
}

// Briefcase icon fix
function Briefcase(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

// ─── WarBook Display ──────────────────────────────────────────────────────────

function WarBookDisplay({ result }: { result: WarBookResult }) {
  const [tab, setTab] = useState<Tab>("intel");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wb = result.warbook;
  const cp = result.companyProfile;

  // Tab-specific states
  const [newsCategory, setNewsCategory] = useState<string>("all");
  const [signalCategory, setSignalCategory] = useState<string>("all");
  const [battleCardSubTab, setBattleCardSubTab] = useState<BattleCardSubTab>("pricing");
  const [expandedCompetitors, setExpandedCompetitors] = useState<Set<number>>(new Set());
  const [expandedObjections, setExpandedObjections] = useState<Set<number>>(new Set());

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "intel", label: "Intel Overview", icon: Database },
    { id: "people", label: "Decision Makers", icon: Users },
    { id: "competitive", label: "Competitive", icon: Shield },
    { id: "pain", label: "Pain Points", icon: AlertCircle },
    { id: "signals", label: "Buying Signals", icon: Activity },
    { id: "news", label: "News", icon: Newspaper },
    { id: "battlecard", label: "Battle Card", icon: Swords },
    { id: "battleplan", label: "Battle Plan", icon: Crosshair },
  ];

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const callWithAtom = (contact: Contact) => {
    const params = new URLSearchParams({
      company: result.company,
      contact: contact.name,
      title: contact.title,
      ...(contact.phone ? { phone: contact.phone } : {}),
    });
    navigate(`/atom-leadgen?${params.toString()}`);
  };

  const toggleCompetitor = (i: number) => {
    setExpandedCompetitors((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const toggleObjection = (i: number) => {
    setExpandedObjections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  // Resolve objections from battlePlan or legacy flat fields
  const objections: ObjectionPrediction[] = wb?.battlePlan?.objectionPredictions ?? wb?.objectionPredictions ?? [];
  const pitchAngles: PitchAngle[] = wb?.battlePlan?.pitchAngles ?? wb?.pitchAngles ?? [];
  const callStrategy: CallStrategy | undefined = wb?.battlePlan?.callStrategy ?? wb?.callStrategy;

  // Unique categories for news & signals
  const newsCategories = ["all", ...Array.from(new Set((wb?.recentNews ?? []).map((n) => n.category).filter(Boolean) as string[]))];
  const signalCategories = ["all", ...Array.from(new Set((wb?.buyingSignals ?? []).map((s) => s.category).filter(Boolean) as string[]))];

  const filteredNews = newsCategory === "all" ? (wb?.recentNews ?? []) : (wb?.recentNews ?? []).filter((n) => n.category === newsCategory);
  const filteredSignals = signalCategory === "all" ? (wb?.buyingSignals ?? []) : (wb?.buyingSignals ?? []).filter((s) => s.category === signalCategory);

  // Average intent score for buying signals header
  const signalsWithIntent = (wb?.buyingSignals ?? []).filter((s) => s.intentScore != null);
  const avgIntent = signalsWithIntent.length > 0
    ? Math.round(signalsWithIntent.reduce((sum, s) => sum + (s.intentScore ?? 0), 0) / signalsWithIntent.length)
    : null;

  return (
    <div className="space-y-5">
      {/* ─── Header Card ─────────────────────────────────────────────────── */}
      <Card className="bg-[#111113] border-white/[0.08]">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            {/* Left: Company info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#e8e8ea]"
                    style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", letterSpacing: "-0.03em" }}>
                    {result.company}
                  </h2>
                  {wb?.overview?.stockTicker && (
                    <span className="text-xs font-mono text-white/30">{wb.overview.stockTicker}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <Badge className={`text-xs font-mono border ${priorityColor(wb?.priorityLevel || "medium")}`}>
                    {wb?.priorityLevel === "high" && <Flame className="w-3 h-3 mr-1" />}
                    {wb?.priorityLevel?.toUpperCase()} PRIORITY
                  </Badge>
                  {wb?.overview?.industry && (
                    <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs font-mono">
                      {wb.overview.industry}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { icon: MapPin, label: wb?.overview?.headquarters || cp?.location || "—" },
                  { icon: Users, label: wb?.overview?.employeeCount || cp?.employeeCount || "—" },
                  { icon: DollarSign, label: wb?.overview?.revenue || cp?.revenue || "—" },
                  { icon: Calendar, label: wb?.overview?.founded || cp?.founded || "—" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-xs text-white/50 truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>

              {wb?.overview?.website && (
                <a href={wb.overview.website.startsWith("http") ? wb.overview.website : `https://${wb.overview.website}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  <Globe className="w-3.5 h-3.5" />{wb.overview.website}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}

              {/* ATOM source badges */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-white/25 font-mono">DATA SOURCES:</span>
                {result.sources?.perplexity && <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[9px] font-mono">ATOM Web Intel</Badge>}
                {result.sources?.apollo && <Badge className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-[9px] font-mono">ATOM Contacts</Badge>}
                {result.sources?.pdl && <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] font-mono">ATOM Enrich</Badge>}
              </div>
            </div>

            {/* Right: Gauges */}
            <div className="flex items-center gap-6 lg:border-l lg:border-white/[0.06] lg:pl-5">
              <Gauge value={wb?.sentimentScore || 0} label="Sentiment" color="#696aac" />
              <Gauge value={wb?.buyerIntentScore || 0} label="Buyer Intent" color="#a855f7" />
            </div>
          </div>

          {/* Executive Summary */}
          {wb?.executiveSummary && (
            <div className="mt-4 p-4 rounded-xl border border-violet-500/15 bg-violet-500/[0.04]">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-violet-400/60 mb-1.5">Executive Summary</p>
                  <p className="text-sm text-white/70 leading-relaxed">{wb.executiveSummary}</p>
                </div>
                <button onClick={() => copyText(wb.executiveSummary)} className="ml-auto shrink-0 p-1 text-white/20 hover:text-violet-400 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl bg-[#111113] border border-white/[0.08] w-fit min-w-full">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                  active ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ──────────────────────────────────────────────────── */}

      {/* TAB 1: INTEL OVERVIEW */}
      {tab === "intel" && (
        <div className="space-y-4">
          {wb?.overview?.description && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-2">About</p>
                <p className="text-sm text-white/65 leading-relaxed">{wb.overview.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Industry", value: wb?.overview?.industry, icon: Briefcase },
              { label: "Founded", value: wb?.overview?.founded, icon: Calendar },
              { label: "HQ", value: wb?.overview?.headquarters, icon: MapPin },
              { label: "Ticker", value: wb?.overview?.stockTicker || "Private", icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon as React.ComponentType<{ className?: string }>;
              return (
                <Card key={item.label} className="bg-[#111113] border-white/[0.08]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-white/25" />
                      <p className="text-[9px] font-mono uppercase tracking-wider text-white/25">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                      {item.value || "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {wb?.techStack && wb.techStack.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Tech Stack
                  </span>
                  <Badge className="bg-white/5 text-white/30 border-white/10 text-[9px] font-mono">{wb.techStack.length} tools</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wb.techStack.map((t, i) => (
                    <Badge key={i} className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[10px] font-mono px-2">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: DECISION MAKERS — ENHANCED */}
      {tab === "people" && (
        <div className="space-y-3">
          {/* Header summary */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">
              {result.contacts.length} contacts found
            </p>
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[9px] font-mono">ATOM Verified</Badge>
          </div>

          {result.contacts.length === 0 ? (
            <EmptyState icon={Users} label="No contacts found" />
          ) : (
            result.contacts.map((c, i) => {
              const avatarColor = seniorityAvatarColor(c.title);
              const seniorityLabel = getSeniorityLabel(c.title);
              return (
                <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-violet-500/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0 ${avatarColor}`}>
                          <span className="text-base font-bold">{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Name + verified */}
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>{c.name}</p>
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[9px] px-1.5 py-0 h-4 font-mono">✓ verified</Badge>
                          </div>
                          {/* Title */}
                          <p className="text-xs text-white/55 mb-2">{c.title}</p>
                          {/* Department + seniority badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            {c.department && (
                              <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px] font-mono px-1.5 py-0 h-4">
                                {c.department}
                              </Badge>
                            )}
                            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[9px] font-mono px-1.5 py-0 h-4">
                              {c.seniority || seniorityLabel}
                            </Badge>
                          </div>
                          {/* Contact details */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            {c.email ? (
                              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-violet-400 transition-colors">
                                <Mail className="w-3.5 h-3.5 shrink-0" />{c.email}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-white/20 italic">
                                <Mail className="w-3.5 h-3.5 shrink-0" />No email
                              </span>
                            )}
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-violet-400 transition-colors">
                                <Phone className="w-3.5 h-3.5 shrink-0" />{c.phone}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-white/20 italic">
                                <Phone className="w-3.5 h-3.5 shrink-0" />No phone
                              </span>
                            )}
                            {c.linkedin && (
                              <a href={c.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400/70 hover:text-blue-400 transition-colors">
                                <Linkedin className="w-3.5 h-3.5 shrink-0" />LinkedIn
                                <ExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}
                          </div>
                          {/* Location */}
                          {(c.city || c.state) && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <MapPin className="w-3 h-3 text-white/20" />
                              <span className="text-[10px] text-white/25">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Call with ATOM button */}
                      <Button
                        size="sm"
                        onClick={() => callWithAtom(c)}
                        className="h-8 text-xs px-3 gap-1.5 bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 border border-violet-500/20 shrink-0"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />Call with ATOM
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: COMPETITIVE — COMPLETE REDESIGN */}
      {tab === "competitive" && (
        <div className="space-y-3">
          {(!wb?.competitors || wb.competitors.length === 0) ? (
            <EmptyState icon={Shield} label="No competitive data available" />
          ) : (
            <>
              <div className="flex items-center justify-between px-1 mb-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">{wb.competitors.length} competitors analyzed</p>
              </div>
              {wb.competitors.map((comp, i) => {
                const expanded = expandedCompetitors.has(i);
                return (
                  <Card key={i} className={`bg-[#111113] border-white/[0.08] transition-all ${expanded ? "border-violet-500/20" : "hover:border-white/15"}`}>
                    <CardContent className="p-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Shield className="w-4 h-4 text-white/30 shrink-0" />
                          <span className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>{comp.name}</span>
                          {comp.marketShare && (
                            <span className="text-[10px] text-white/30 font-mono ml-1">{comp.marketShare}</span>
                          )}
                        </div>
                        <Badge className={`text-[10px] font-mono border shrink-0 ${threatColor(comp.threat)}`}>
                          {comp.threat.toUpperCase()} THREAT
                        </Badge>
                      </div>
                      {/* Differentiator */}
                      <p className="text-xs text-white/55 leading-relaxed mb-3">{comp.differentiator}</p>

                      {/* Expand/collapse button */}
                      <button
                        onClick={() => toggleCompetitor(i)}
                        className="flex items-center gap-1.5 text-[11px] text-violet-400/70 hover:text-violet-400 transition-colors font-mono"
                      >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {expanded ? "Hide Intel ▲" : "Show Intel ▼"}
                      </button>

                      {/* Expanded intel */}
                      {expanded && (
                        <div className="mt-3 space-y-3 pt-3 border-t border-white/[0.06]">
                          {/* Your Advantages */}
                          {comp.yourAdvantages && comp.yourAdvantages.length > 0 && (
                            <div className="rounded-lg bg-emerald-500/[0.04] border border-emerald-500/15 p-3">
                              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/60 mb-2">Your Advantages</p>
                              <ul className="space-y-1.5">
                                {comp.yourAdvantages.map((adv, j) => (
                                  <li key={j} className="flex items-start gap-2 text-xs text-emerald-300/80">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    {adv}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Their Weaknesses */}
                          {comp.theirWeaknesses && comp.theirWeaknesses.length > 0 && (
                            <div className="rounded-lg bg-rose-500/[0.04] border border-rose-500/15 p-3">
                              <p className="text-[10px] font-mono uppercase tracking-wider text-rose-400/60 mb-2">Their Weaknesses</p>
                              <ul className="space-y-1.5">
                                {comp.theirWeaknesses.map((w, j) => (
                                  <li key={j} className="flex items-start gap-2 text-xs text-rose-300/80">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* How to Beat Them */}
                          {comp.howToBeat && (
                            <div className="rounded-lg bg-violet-500/[0.04] border border-violet-500/15 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <Swords className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-[10px] font-mono uppercase tracking-wider text-violet-400/60 mb-1">How to Beat Them</p>
                                    <p className="text-xs text-violet-300/80 leading-relaxed">{comp.howToBeat}</p>
                                  </div>
                                </div>
                                <button onClick={() => copyText(comp.howToBeat!)} className="shrink-0 p-1 text-white/20 hover:text-violet-400 transition-colors">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* TAB 4: PAIN POINTS — ENHANCED */}
      {tab === "pain" && (
        <div className="space-y-3">
          {(!wb?.painPoints || wb.painPoints.length === 0) ? (
            <EmptyState icon={AlertCircle} label="No pain points identified" />
          ) : (
            wb.painPoints.map((pp, i) => (
              <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-white/15 transition-all">
                <CardContent className="p-4 space-y-3">
                  {/* Header: severity + pain */}
                  <div className="flex items-start gap-3">
                    <Badge className={`text-[10px] font-mono border shrink-0 mt-0.5 ${severityColor(pp.severity)}`}>
                      {pp.severity.toUpperCase()}
                    </Badge>
                    <p className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>{pp.pain}</p>
                  </div>

                  {/* Urgency meter */}
                  {pp.urgencyScore != null && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">Urgency</span>
                        <span className="text-[10px] font-mono text-white/40">{pp.urgencyScore}/10</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${urgencyBarColor(pp.urgencyScore)}`}
                          style={{ width: `${(pp.urgencyScore / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Impact */}
                  {pp.impact && (
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/50 mr-1">Business Impact:</span>
                        <span className="text-xs text-white/60">{pp.impact}</span>
                      </div>
                    </div>
                  )}

                  {/* Evidence */}
                  {pp.evidence && (
                    <div className="flex items-start gap-2">
                      <Search className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white/25 mr-1">Evidence:</span>
                        <span className="text-[11px] text-white/40">{pp.evidence}</span>
                      </div>
                    </div>
                  )}

                  {/* How We Help */}
                  <div className="flex items-start gap-2 bg-violet-500/[0.04] border border-violet-500/12 rounded-lg p-2.5">
                    <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400/60 mr-1">How We Help:</span>
                      <span className="text-xs text-violet-300/80 leading-relaxed">{pp.opportunity}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 5: BUYING SIGNALS — COMPLETE REDESIGN */}
      {tab === "signals" && (
        <div className="space-y-4">
          {(!wb?.buyingSignals || wb.buyingSignals.length === 0) ? (
            <EmptyState icon={Activity} label="No buying signals detected" />
          ) : (
            <>
              {/* Summary bar */}
              <Card className="bg-[#111113] border-white/[0.08]">
                <CardContent className="p-3">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Signal className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                        {wb.buyingSignals.length}
                      </span>
                      <span className="text-xs text-white/40">signals detected</span>
                    </div>
                    {avgIntent != null && (
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-[#e8e8ea]">{avgIntent}</span>
                        <span className="text-xs text-white/40">avg. intent score</span>
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      {wb.buyingSignals.filter(s => s.strength === "strong").length > 0 && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[9px] font-mono">
                          {wb.buyingSignals.filter(s => s.strength === "strong").length} STRONG
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category filter pills */}
              {signalCategories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {signalCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSignalCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                        signalCategory === cat
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {cat === "all" ? "All" : formatCategory(cat)}
                    </button>
                  ))}
                </div>
              )}

              {/* Signal cards */}
              <div className="space-y-3">
                {filteredSignals.map((sig, i) => (
                  <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-white/15 transition-all">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Activity className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-[#e8e8ea]">{sig.signal}</p>
                        </div>
                        <Badge className={`text-[10px] font-mono border shrink-0 ${strengthColor(sig.strength)}`}>
                          {sig.strength.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Intent meter */}
                      {sig.intentScore != null && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">Buyer Intent</span>
                            <span className="text-[10px] font-mono text-white/40">{sig.intentScore}/100</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${intentBarColor(sig.intentScore)}`}
                              style={{ width: `${sig.intentScore}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2">
                        {sig.category && (
                          <Badge className={`text-[9px] font-mono border ${categoryBadge(sig.category)}`}>
                            {formatCategory(sig.category)}
                          </Badge>
                        )}
                        {sig.recency && (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Clock className="w-3 h-3" />{sig.recency}
                          </span>
                        )}
                        {sig.source && (
                          <span className="text-[10px] text-white/25 font-mono">SRC: {sig.source}</span>
                        )}
                      </div>

                      {/* Actionable Insight */}
                      {sig.actionableInsight && (
                        <div className="flex items-start gap-2 bg-violet-500/[0.04] border border-violet-500/12 rounded-lg p-2.5">
                          <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400/60 mr-1">Action:</span>
                            <span className="text-xs text-violet-300/80">{sig.actionableInsight}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {filteredSignals.length === 0 && (
                  <p className="text-sm text-white/30 text-center py-6">No signals in this category</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 6: NEWS — COMPLETE REDESIGN */}
      {tab === "news" && (
        <div className="space-y-4">
          {(!wb?.recentNews || wb.recentNews.length === 0) ? (
            <EmptyState icon={Newspaper} label="No recent news found" />
          ) : (
            <>
              {/* Category filter pills */}
              {newsCategories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {newsCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setNewsCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
                        newsCategory === cat
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/[0.03] text-white/35 border border-white/[0.06] hover:text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {cat === "all" ? "All" : formatCategory(cat)}
                    </button>
                  ))}
                </div>
              )}

              {/* News cards */}
              <div className="space-y-3">
                {filteredNews.map((n, i) => (
                  <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-violet-500/20 transition-all">
                    <CardContent className="p-4 space-y-3">
                      {/* Headline row */}
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.category ? categoryDot(n.category) : "bg-violet-400/60"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>{n.headline}</p>
                            {n.date && (
                              <span className="text-[10px] text-white/30 font-mono shrink-0">{n.date}</span>
                            )}
                          </div>
                          {n.relevance && (
                            <p className="text-xs text-white/45 leading-relaxed mt-1">{n.relevance}</p>
                          )}
                        </div>
                      </div>

                      {/* Impact meter */}
                      {n.impactScore != null && (
                        <div className="pl-5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">Impact</span>
                            <span className="text-[10px] font-mono text-white/40">{n.impactScore}/10</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${impactBarColor(n.impactScore)}`}
                              style={{ width: `${(n.impactScore / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer row: category + sales angle */}
                      <div className="pl-5 space-y-2">
                        {n.category && (
                          <Badge className={`text-[9px] font-mono border ${categoryBadge(n.category)}`}>
                            {formatCategory(n.category)}
                          </Badge>
                        )}
                        {n.salesAngle && (
                          <div className="flex items-start justify-between gap-2 bg-violet-500/[0.04] border border-violet-500/12 rounded-lg p-2.5">
                            <div className="flex items-start gap-2">
                              <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400/60 mr-1">Sales Angle:</span>
                                <span className="text-xs text-violet-300/80">{n.salesAngle}</span>
                              </div>
                            </div>
                            <button onClick={() => copyText(n.salesAngle!)} className="shrink-0 p-1 text-white/20 hover:text-violet-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredNews.length === 0 && (
                  <p className="text-sm text-white/30 text-center py-6">No news in this category</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 7: BATTLE CARD — COMPLETE REDESIGN with sub-tabs */}
      {tab === "battlecard" && (
        <div className="space-y-4">
          {!wb?.battleCard ? (
            <p className="text-sm text-white/40 p-4">No battle card data available. Run a new WarBook to generate competitive intel.</p>
          ) : (
            <>
              {/* Sub-tab navigation */}
              <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[#0d0d0f] border border-white/[0.06]">
                {([
                  { id: "pricing" as BattleCardSubTab, label: "Pricing & Contracts", icon: DollarSign },
                  { id: "vulnerabilities" as BattleCardSubTab, label: "Vulnerabilities", icon: Target },
                  { id: "features" as BattleCardSubTab, label: "Feature Gaps", icon: Zap },
                  { id: "ammo" as BattleCardSubTab, label: "Competitive Ammo", icon: Swords },
                  { id: "landmines" as BattleCardSubTab, label: "Landmines & Lock-In", icon: AlertTriangle },
                ] as { id: BattleCardSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map((st) => {
                  const Icon = st.icon;
                  const active = battleCardSubTab === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setBattleCardSubTab(st.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                        active ? "bg-violet-500/20 text-violet-300 border border-violet-500/25" : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                      }`}
                      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />{st.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-tab: Pricing & Contracts */}
              {battleCardSubTab === "pricing" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Pricing Model</p>
                        </div>
                        <p className="text-sm text-white/75">{wb.battleCard.pricingModel || "Unknown"}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Contract Terms</p>
                        </div>
                        <p className="text-sm text-white/75">{wb.battleCard.contractTerms || "Unknown"}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {wb.battleCard.switchingCost && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-3.5 h-3.5 text-purple-400" />
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Switching Cost</p>
                        </div>
                        <p className="text-sm text-white/75">{wb.battleCard.switchingCost}</p>
                      </CardContent>
                    </Card>
                  )}

                  {wb.battleCard.winRate && (
                    <Card className="bg-[#111113] border-violet-500/20">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-wider text-white/30 mb-1">Estimated Win Rate vs. This Company</p>
                            <p className="text-3xl font-bold text-violet-400" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                              {wb.battleCard.winRate}
                            </p>
                          </div>
                          <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 flex items-center justify-center">
                            <BarChart3 className="w-7 h-7 text-violet-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Sub-tab: Vulnerabilities */}
              {battleCardSubTab === "vulnerabilities" && (
                <div className="space-y-4">
                  {wb.battleCard.knownWeaknesses && wb.battleCard.knownWeaknesses.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-4 h-4 text-rose-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Known Weaknesses</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.knownWeaknesses.map((w, i) => (
                            <div key={i} className="flex items-start gap-3 bg-rose-500/[0.05] border border-rose-500/12 rounded-lg p-3">
                              <span className="text-xs font-mono text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded-full shrink-0">{i + 1}</span>
                              <span className="text-sm text-[#e8e8ea] flex-1">{w}</span>
                              <button onClick={() => copyText(w)} className="shrink-0 p-0.5 text-white/15 hover:text-rose-400 transition-colors">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {wb.battleCard.customerComplaints && wb.battleCard.customerComplaints.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Flame className="w-4 h-4 text-amber-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Customer Complaints</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.customerComplaints.map((c, i) => (
                            <div key={i} className="flex items-start gap-3 bg-amber-500/[0.05] border border-amber-500/12 rounded-lg p-3">
                              <Flame className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea] flex-1">{c}</span>
                              <button onClick={() => copyText(c)} className="shrink-0 p-0.5 text-white/15 hover:text-amber-400 transition-colors">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {wb.battleCard.salesProcessWeaknesses && wb.battleCard.salesProcessWeaknesses.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-blue-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Their Sales Process Weaknesses</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.salesProcessWeaknesses.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 bg-blue-500/[0.05] border border-blue-500/12 rounded-lg p-3">
                              <ChevronRight className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea]">{w}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Sub-tab: Feature Gaps */}
              {battleCardSubTab === "features" && (
                <div className="space-y-4">
                  {wb.battleCard.featureGaps && wb.battleCard.featureGaps.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {wb.battleCard.featureGaps.map((gap, i) => (
                        <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-purple-500/20 transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[#e8e8ea] leading-relaxed">{gap}</p>
                                <button
                                  onClick={() => copyText(gap)}
                                  className="mt-2 text-[10px] text-purple-400/60 hover:text-purple-400 transition-colors flex items-center gap-1 font-mono"
                                >
                                  <Copy className="w-3 h-3" />Use in Pitch &gt;
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <EmptyState icon={Zap} label="No feature gaps identified" />
                  )}
                </div>
              )}

              {/* Sub-tab: Competitive Ammo */}
              {battleCardSubTab === "ammo" && (
                <div className="space-y-4">
                  {/* Talking Points */}
                  {wb.battleCard.talkingPoints && wb.battleCard.talkingPoints.length > 0 && (
                    <Card className="bg-[#111113] border-violet-500/20">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Swords className="w-4 h-4 text-violet-400" />
                          <h4 className="text-sm font-bold text-violet-400" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Competitive Talking Points</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.talkingPoints.map((tp, i) => (
                            <div key={i} className="flex items-start gap-3 bg-violet-500/[0.05] border border-violet-500/12 rounded-lg p-3">
                              <span className="text-xs font-mono text-violet-400 bg-violet-500/20 px-2 py-0.5 rounded-full shrink-0 mt-0.5">{i + 1}</span>
                              <span className="text-sm text-[#e8e8ea] flex-1">{tp}</span>
                              <button onClick={() => copyText(tp)} className="shrink-0 text-white/20 hover:text-violet-400 transition-colors p-0.5">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Strengths vs Us */}
                  {wb.battleCard.strengthsVsUs && wb.battleCard.strengthsVsUs.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-orange-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>What They Do Well — Handle With Care</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.strengthsVsUs.map((s, i) => (
                            <div key={i} className="flex items-start gap-2 bg-orange-500/[0.05] border border-orange-500/12 rounded-lg p-3">
                              <Shield className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea]">{s}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Decision Criteria */}
                  {wb.battleCard.decisionCriteria && wb.battleCard.decisionCriteria.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-4 h-4 text-teal-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Their Buyer Decision Criteria</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.decisionCriteria.map((dc, i) => (
                            <div key={i} className="flex items-start gap-2 bg-teal-500/[0.05] border border-teal-500/12 rounded-lg p-3">
                              <Target className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea]">{dc}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Sub-tab: Landmines & Lock-In */}
              {battleCardSubTab === "landmines" && (
                <div className="space-y-4">
                  {wb.battleCard.landmines && wb.battleCard.landmines.length > 0 ? (
                    <Card className="bg-[#111113] border-rose-500/20">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <h4 className="text-sm font-bold text-rose-400" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Never Do This</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.landmines.map((lm, i) => (
                            <div key={i} className="flex items-start gap-2 bg-rose-500/[0.05] border border-rose-500/20 rounded-lg p-3">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea]">{lm}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <EmptyState icon={AlertTriangle} label="No landmines identified" />
                  )}

                  {wb.battleCard.vendorLockIn && wb.battleCard.vendorLockIn.length > 0 && (
                    <Card className="bg-[#111113] border-white/[0.08]">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="w-4 h-4 text-amber-400" />
                          <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Vendor Lock-In Factors</h4>
                        </div>
                        <div className="space-y-2">
                          {wb.battleCard.vendorLockIn.map((li, i) => (
                            <div key={i} className="flex items-start gap-2 bg-amber-500/[0.05] border border-amber-500/12 rounded-lg p-3">
                              <Lock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <span className="text-sm text-[#e8e8ea]">{li}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 8: BATTLE PLAN — COMPLETE REDESIGN */}
      {tab === "battleplan" && (
        <div className="space-y-5">

          {/* Predicted Objections */}
          {objections.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Predicted Objections
                  </span>
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] font-mono ml-auto">{objections.length}</Badge>
                </div>
                <div className="space-y-2">
                  {objections.map((obj, i) => {
                    const expanded = expandedObjections.has(i);
                    return (
                      <div key={i} className={`rounded-lg border transition-all ${expanded ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                        <button
                          className="w-full flex items-start gap-3 p-3 text-left"
                          onClick={() => toggleObjection(i)}
                        >
                          <Badge className={`text-[9px] font-mono border shrink-0 mt-0.5 ${probColor(obj.probability)}`}>
                            {obj.probability.toUpperCase()} PROB
                          </Badge>
                          <p className="text-xs font-medium text-white/80 flex-1">"{obj.objection}"</p>
                          <span className="text-white/20 shrink-0">
                            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Shield className="w-3 h-3 text-violet-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-violet-300/70 leading-relaxed">{obj.counterStrategy}</p>
                            </div>
                            {obj.followUp && (
                              <div className="flex items-start gap-2">
                                <ChevronRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-300/70 leading-relaxed">{obj.followUp}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => copyText(`Objection: ${obj.objection}\n\nCounter: ${obj.counterStrategy}${obj.followUp ? `\n\nFollow Up: ${obj.followUp}` : ""}`)}
                                className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-violet-400 transition-colors font-mono border border-white/[0.08] rounded px-2 py-1"
                              >
                                <Copy className="w-3 h-3" />Copy Counter
                              </button>
                              <button
                                onClick={() => { copyText(obj.counterStrategy); toast({ title: "Counter copied for pitch" }); }}
                                className="flex items-center gap-1.5 text-[10px] text-violet-400/60 hover:text-violet-400 transition-colors font-mono border border-violet-500/15 rounded px-2 py-1"
                              >
                                <ArrowRight className="w-3 h-3" />Use in Pitch
                              </button>
                              <button
                                onClick={() => navigate("/atom-leadgen")}
                                className="flex items-center gap-1.5 text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors font-mono border border-blue-500/15 rounded px-2 py-1"
                              >
                                <PhoneCall className="w-3 h-3" />Use in Call Script
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Pitch Angles */}
          {pitchAngles.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Recommended Pitch Angles
                  </span>
                </div>
                <div className="space-y-3">
                  {pitchAngles.map((pa, i) => (
                    <div key={i} className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04] p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-violet-300" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>{pa.angle}</p>
                        <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] font-mono shrink-0">
                          {pa.targetPersona}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3 h-3 text-white/25 shrink-0 mt-0.5" />
                        <p className="text-xs text-white/55 italic flex-1">"{pa.openingLine}"</p>
                      </div>
                      {pa.proofPoints && pa.proofPoints.length > 0 && (
                        <ul className="space-y-1 pl-5">
                          {pa.proofPoints.map((pp, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-[11px] text-white/45">
                              <ChevronRight className="w-3 h-3 text-violet-400/40 shrink-0 mt-0.5" />{pp}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => copyText(pa.openingLine)}
                          className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-violet-400 transition-colors font-mono border border-white/[0.08] rounded px-2 py-1"
                        >
                          <Copy className="w-3 h-3" />Copy Opening
                        </button>
                        <button
                          onClick={() => navigate("/pitch")}
                          className="flex items-center gap-1.5 text-[10px] text-violet-400/60 hover:text-violet-400 transition-colors font-mono border border-violet-500/15 rounded px-2 py-1"
                        >
                          <ArrowRight className="w-3 h-3" />Build Full Pitch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Call Strategy */}
          {callStrategy && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Call Strategy
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Best Time to Call", value: callStrategy.bestTimeToCall, icon: Clock },
                    { label: "Gatekeeper Tips", value: callStrategy.gatekeeperTips, icon: Shield },
                    { label: "Tone Recommendation", value: callStrategy.toneRecommendation, icon: Activity },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3 h-3 text-white/25" />
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">{item.label}</p>
                        </div>
                        <p className="text-xs text-white/65">{item.value || "—"}</p>
                      </div>
                    );
                  })}
                </div>

                {callStrategy.keyQuestions && callStrategy.keyQuestions.length > 0 && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Key Discovery Questions</p>
                      <button
                        onClick={() => copyText(callStrategy.keyQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"))}
                        className="flex items-center gap-1 text-[10px] text-white/25 hover:text-violet-400 transition-colors font-mono"
                      >
                        <Copy className="w-3 h-3" />Copy All
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {callStrategy.keyQuestions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                          <span className="text-violet-400/60 font-mono shrink-0">{i + 1}.</span>
                          <span className="flex-1">{q}</span>
                          <button onClick={() => copyText(q)} className="ml-auto shrink-0 p-0.5 text-white/10 hover:text-violet-400 transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Email Sequence */}
          {wb?.battlePlan?.emailSequence && wb.battlePlan.emailSequence.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Email Sequence
                  </span>
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-mono">{wb.battlePlan.emailSequence.length} emails</Badge>
                </div>
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/[0.06]" />
                  <div className="space-y-3">
                    {wb.battlePlan.emailSequence.map((email, i) => (
                      <div key={i} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-6 top-3 w-2.5 h-2.5 rounded-full bg-blue-500/60 border border-blue-500/40" />
                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-mono">
                                  Day {email.day}
                                </Badge>
                              </div>
                              <p className="text-sm font-semibold text-[#e8e8ea] mb-1" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                                {email.subject}
                              </p>
                              <p className="text-xs text-white/45">{email.angle}</p>
                            </div>
                            <button onClick={() => copyText(`Day ${email.day}\nSubject: ${email.subject}\nAngle: ${email.angle}`)}
                              className="shrink-0 p-1 text-white/20 hover:text-blue-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Strategy */}
          {(wb?.battlePlan?.multiThreadStrategy || wb?.battlePlan?.timingPlaybook || (wb?.battlePlan?.competitiveTraps && wb.battlePlan.competitiveTraps.length > 0)) && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crosshair className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Advanced Strategy
                  </span>
                </div>

                {wb?.battlePlan?.multiThreadStrategy && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Multi-Thread Strategy</p>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{wb.battlePlan.multiThreadStrategy}</p>
                  </div>
                )}

                {wb?.battlePlan?.timingPlaybook && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Timing Playbook</p>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{wb.battlePlan.timingPlaybook}</p>
                  </div>
                )}

                {wb?.battlePlan?.competitiveTraps && wb.battlePlan.competitiveTraps.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Crosshair className="w-3.5 h-3.5 text-violet-400" />
                      <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">Competitive Traps to Set</p>
                    </div>
                    <div className="space-y-2">
                      {wb.battlePlan.competitiveTraps.map((trap, i) => (
                        <div key={i} className="flex items-start gap-2 bg-violet-500/[0.04] border border-violet-500/12 rounded-lg p-3">
                          <Crosshair className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-violet-300/80">{trap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state if no battle plan data */}
          {objections.length === 0 && pitchAngles.length === 0 && !callStrategy && (
            <EmptyState icon={Crosshair} label="No battle plan data. Run a new WarBook to generate it." />
          )}
        </div>
      )}

      {/* ─── Citations ─────────────────────────────────────────────────────── */}
      {result.citations && result.citations.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer p-3 bg-[#111113] border border-white/[0.08] rounded-xl hover:border-white/[0.12] transition-colors list-none [&::-webkit-details-marker]:hidden">
            <BookOpen className="w-4 h-4 text-white/30" />
            <span className="text-xs font-semibold text-white/50">Sources & Citations</span>
            <Badge className="bg-white/5 text-white/25 border-white/[0.06] text-[9px] font-mono">{result.citations.length}</Badge>
            <ChevronRight className="w-3.5 h-3.5 text-white/20 ml-auto transition-transform duration-200 group-open:rotate-90" />
          </summary>
          <div className="mt-1 p-3 bg-[#111113] border border-white/[0.08] rounded-xl space-y-1">
            {result.citations.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-[11px] text-white/30 hover:text-violet-400 transition-colors truncate">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </details>
      )}

      {/* Footer */}
      <div className="pt-2 pb-4 text-center">
        <p className="text-[10px] font-mono text-white/15">ATOM · Nirmata Holdings · © 2026</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyIntelligence() {
  const { toast } = useToast();
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<WarBookResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Animate loading steps
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const interval = setInterval(() => {
      setLoadStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  const buildWarBook = useCallback(async () => {
    if (!company.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(BRIDGE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), website: website.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: WarBookResult = await res.json();

      setResult(data);

      // Save to history
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company: company.trim(),
        website: website.trim() || undefined,
        result: data,
        timestamp: Date.now(),
      };
      const history = loadHistory();
      saveHistory([entry, ...history]);

      toast({ title: `WarBook built for ${company}`, description: `Priority: ${data.warbook?.priorityLevel?.toUpperCase()}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Failed to build WarBook", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [company, website, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") buildWarBook();
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setCompany(entry.company);
    setWebsite(entry.website || "");
    setResult(entry.result);
  };

  return (
    <div className="space-y-6 min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#e8e8ea] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", letterSpacing: "-0.03em" }}>
              ATOM WarBook
            </h1>
          </div>
          <p className="text-sm text-[#8a8a96] ml-12">
            ATOM Deep Intelligence Engine
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result && (
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setCompany(""); setWebsite(""); }}
              className="h-8 text-xs border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 bg-transparent">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />New Research
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}
            className="h-8 text-xs gap-1.5 border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 bg-transparent">
            <History className="w-3.5 h-3.5" />History
          </Button>
        </div>
      </div>

      {/* Input Card — always visible */}
      <Card className={`border transition-all ${result ? "border-violet-500/15 bg-violet-500/[0.02]" : "border-white/[0.08] bg-[#111113]"}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
                <Building2 className="w-3 h-3" />Company Name
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Cloudflare, Akamai, Salesforce..."
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/[0.08] bg-[#161618] text-[#e8e8ea] placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-colors"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
                <Globe className="w-3 h-3" />Website URL <span className="text-white/20">(optional)</span>
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://cloudflare.com"
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/[0.08] bg-[#161618] text-[#e8e8ea] placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-colors"
              />
            </div>
            <div className="sm:self-end">
              <Button
                onClick={buildWarBook}
                disabled={!company.trim() || loading}
                className="h-10 px-6 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white gap-2 w-full sm:w-auto transition-all"
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Building...</>
                ) : (
                  <><BookOpen className="w-4 h-4" />Build WarBook</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="bg-[#111113] border-violet-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-r-transparent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                  Building WarBook for {company}
                </p>
                <p className="text-xs text-white/30">ATOM Intelligence scanning...</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {LOADING_STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i < loadStep;
                const active = i === loadStep;
                return (
                  <div key={i} className={`flex items-center gap-3 transition-all ${done ? "opacity-50" : active ? "opacity-100" : "opacity-20"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      done ? "bg-emerald-500/20 border-emerald-500/30" :
                      active ? "bg-violet-500/20 border-violet-500/30" :
                      "bg-white/5 border-white/10"
                    }`}>
                      {done
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        : active
                        ? <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                        : <Icon className="w-3 h-3 text-white/25" />
                      }
                    </div>
                    <p className={`text-xs ${done ? "text-white/40" : active ? "text-white/80" : "text-white/20"}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Skeleton preview */}
            <div className="mt-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WarBook Result */}
      {result && !loading && <WarBookDisplay result={result} />}

      {/* Empty state */}
      {!result && !loading && (
        <Card className="bg-[#111113] border-white/[0.08]">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/5 border border-violet-500/10 flex items-center justify-center mb-2">
              <Brain className="w-8 h-8 text-violet-400/40" />
            </div>
            <p className="text-base font-semibold text-white/30" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              Enter a company to build their WarBook
            </p>
            <p className="text-sm text-white/20 text-center max-w-sm">
              ATOM will compile a full intelligence package on this company,
              including decision makers, pain points, buying signals, and a complete battle plan.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {["Cloudflare", "Akamai", "Salesforce", "HubSpot", "Snowflake"].map((ex) => (
                <button key={ex} onClick={() => setCompany(ex)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/30 hover:text-violet-400 hover:border-violet-500/20 hover:bg-violet-500/5 transition-all font-mono">
                  {ex}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
      />
    </div>
  );
}
