import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { loadDeals, onWarRoomEvent, type Deal } from "@/lib/warroom-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Loader2,
  CheckCircle2,
  Circle,
  PhoneCall,
  Phone,
  Mail,
  Building2,
  User,
  ChevronRight,
  BarChart3,
  Pause,
  Play,
  X,
  Zap,
  Target,
  Users,
  TrendingUp,
  Signal,
  Clock,
  CheckCheck,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Activity,
  MessageSquare,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  DollarSign,
  Cpu,
  Tag,
  Briefcase,
  Search,
  Download,
  Link,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ListFilter,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_URL = "https://45-79-202-76.sslip.io";

const GEO_OPTIONS = [
  "All US", "US South (TX, FL, GA, NC, TN...)", "US Northeast (NY, NJ, MA, CT...)",
  "US Midwest (IL, OH, MI, IN, MN...)", "US West (CA, WA, OR, CO, AZ...)",
  "US Southeast (FL, GA, NC, SC, VA...)", "Texas", "California", "New York",
  "Florida", "Illinois", "Georgia", "North Carolina", "Washington",
  "Massachusetts", "Colorado", "EU", "UK", "Canada", "Global",
];

const GEO_VALUES: Record<string, string> = {
  "All US": "All US",
  "US South (TX, FL, GA, NC, TN...)": "US South",
  "US Northeast (NY, NJ, MA, CT...)": "US Northeast",
  "US Midwest (IL, OH, MI, IN, MN...)": "US Midwest",
  "US West (CA, WA, OR, CO, AZ...)": "US West",
  "US Southeast (FL, GA, NC, SC, VA...)": "US Southeast",
  "Texas": "Texas",
  "California": "California",
  "New York": "New York",
  "Florida": "Florida",
  "Illinois": "Illinois",
  "Georgia": "Georgia",
  "North Carolina": "North Carolina",
  "Washington": "Washington",
  "Massachusetts": "Massachusetts",
  "Colorado": "Colorado",
  "EU": "EU",
  "UK": "UK",
  "Canada": "Canada",
  "Global": "Global",
};

const INDUSTRIES = [
  "All Industries", "Technology & SaaS", "Healthcare & Life Sciences",
  "Financial Services & Banking", "Real Estate & PropTech", "Manufacturing",
  "Retail & E-Commerce", "Insurance", "Defense & Government", "Energy & Utilities",
  "Education & EdTech", "Transportation & Logistics", "Media & Entertainment",
  "Telecommunications", "Legal Services", "Construction & Engineering",
  "Agriculture & Food Tech", "Hospitality & Travel", "Non-Profit & NGO",
  "Automotive", "Aerospace", "Cybersecurity", "Biotech & Pharma",
];

const EMPLOYEE_SIZES = [
  { value: "", label: "Any Size" },
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "501-1000", label: "501–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5001-10000", label: "5,001–10,000 employees" },
  { value: "10001+", label: "10,000+ employees" },
];

const REVENUE_RANGES = [
  { value: "", label: "Any Revenue" },
  { value: "under-1m", label: "Under $1M" },
  { value: "1m-10m", label: "$1M – $10M" },
  { value: "10m-50m", label: "$10M – $50M" },
  { value: "50m-100m", label: "$50M – $100M" },
  { value: "100m-500m", label: "$100M – $500M" },
  { value: "500m-1b", label: "$500M – $1B" },
  { value: "1b+", label: "$1B+" },
];

const JOB_TITLE_PRESETS = [
  "CEO", "CTO", "CIO", "CISO", "CFO", "COO",
  "VP Engineering", "VP Sales", "VP Operations", "VP IT",
  "Director of IT", "Director of Engineering",
  "Head of AI", "Head of Technology",
  "Chief Digital Officer", "Owner", "Founder",
];

const MAX_TARGET_OPTIONS = [
  { value: 25, label: "25 targets" },
  { value: 50, label: "50 targets" },
  { value: 100, label: "100 targets" },
  { value: 250, label: "250 targets" },
  { value: 500, label: "500 targets" },
  { value: 1000, label: "1,000 targets" },
  { value: 5000, label: "5,000 targets" },
  { value: 10000, label: "10,000 targets" },
];

// ─── Phone formatter ──────────────────────────────────────────────────────────

// ─── HVT Target Signal Panel (War Room Intel feed) ──────────────────────────
function HVTTargetSignalPanel() {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());
  const [, setLocation] = useLocation();

  useEffect(() => {
    const refresh = () => setDeals(loadDeals());
    const unsub = onWarRoomEvent(refresh);
    return unsub;
  }, []);

  // Filter to HVTs or active deals with strong signals
  const hotTargets = deals
    .filter(d => d.isHVT && d.stage !== "closed_won" && d.stage !== "closed_lost")
    .sort((a, b) => {
      const aHot = (a.targetMeta?.signalScore || 0) * 10 + a.truthScore;
      const bHot = (b.targetMeta?.signalScore || 0) * 10 + b.truthScore;
      return bHot - aHot;
    })
    .slice(0, 6);

  if (hotTargets.length === 0) return null;

  const scoreColor = (n: number) => n >= 7 ? "#22d3ee" : n >= 4 ? "#fbbf24" : "rgba(255,255,255,0.3)";
  const truthColor = (n: number) => n >= 70 ? "#1dd1a1" : n >= 40 ? "#fbbf24" : "var(--color-error)";

  return (
    <div className="rounded-xl border border-rose-500/15 p-4 bg-gradient-to-br from-rose-500/[0.04] to-transparent" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400/80">🎯 HVT Target Signals · War Room Intel</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 font-mono">{hotTargets.length} hot</span>
        </div>
        <button onClick={() => setLocation("/war-room")} className="text-[10px] text-rose-400/70 hover:text-rose-400 transition-colors flex items-center gap-1">
          Open War Room <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {hotTargets.map(d => (
          <button
            key={d.id}
            onClick={() => setLocation("/war-room")}
            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-rose-500/20 hover:bg-rose-500/[0.03] transition-all text-left"
          >
            <div className="flex flex-col gap-0.5 shrink-0">
              <span className="text-[9px] font-mono text-white/40">T</span>
              <span className="text-sm font-bold tabular-nums leading-none" style={{ color: truthColor(d.truthScore) }}>{d.truthScore}</span>
            </div>
            <div className="flex flex-col gap-0.5 shrink-0">
              <span className="text-[9px] font-mono text-white/40">S</span>
              <span className="text-sm font-bold tabular-nums leading-none" style={{ color: scoreColor(d.targetMeta?.signalScore || 0) }}>{(d.targetMeta?.signalScore || 0).toFixed(1)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                {d.isHVT && <span className="text-[8px] px-1 rounded bg-rose-500/15 text-rose-400 font-mono">HVT</span>}
                <span className="text-[12px] font-semibold text-white/80 truncate">{d.company}</span>
              </div>
              <p className="text-[10px] text-white/30 truncate">
                {d.dailyBriefs?.[0]?.summary ? d.dailyBriefs[0].summary.slice(0, 50) + "…" : (d.industry || "No brief yet")}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatPhoneNumber(raw: string): string {
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (stripped.startsWith("+")) return stripped;
  if (/^\d{10}$/.test(stripped)) return `+1${stripped}`;
  if (/^1\d{10}$/.test(stripped)) return `+${stripped}`;
  return `+${stripped}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "brief" | "targets" | "launch";
type CallStatus = "queued" | "calling" | "connected" | "completed" | "failed" | "skipped";
type SortField = "score" | "companyName" | "contactName";
type SortDir = "asc" | "desc";

interface AdvancedFilters {
  industry: string;
  geography: string;
  companySize: string;
  revenueRange: string;
  jobTitles: string[];
  techStack: string;
  keywords: string;
}

interface Target {
  id: string;
  companyName: string;
  domain: string;
  industry: string;
  contactName: string;
  title: string;
  phone: string;
  mobilePhone: string;
  email: string;
  linkedin: string;
  city: string;
  state: string;
  score: number;
  confidence: number;
  companySize: string;
  employeeCount: number;
  revenue: string;
  buyingSignals: string[];
  recentNews: string[];
  painPoints: string[];
  techStack: string[];
  seniority: string;
  department: string;
  selected: boolean;
}

interface CallRecord {
  targetId: string;
  companyName: string;
  contactName: string;
  phone: string;
  callSid?: string;
  status: CallStatus;
  duration?: number;
  sentiment?: number;
  transcript?: string;
  startedAt?: number;
  completedAt?: number;
  disposition?: string;
}

interface CampaignStats {
  total: number;
  completed: number;
  connected: number;
  failed: number;
  meetings: number;
  avgSentiment: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: CallStatus): string {
  switch (status) {
    case "queued": return "text-white/50 border-white/10 bg-white/5";
    case "calling": return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "connected": return "text-violet-400 border-violet-500/30 bg-violet-500/10";
    case "completed": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    case "failed": return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    case "skipped": return "text-white/35 border-white/[0.10] bg-white/[0.03]";
    default: return "text-white/50 border-white/10 bg-white/5";
  }
}

function statusIcon(status: CallStatus) {
  switch (status) {
    case "queued": return <Circle className="w-3 h-3" />;
    case "calling": return <Loader2 className="w-3 h-3 animate-spin" />;
    case "connected": return <PhoneCall className="w-3 h-3" />;
    case "completed": return <CheckCircle2 className="w-3 h-3" />;
    case "failed": return <AlertCircle className="w-3 h-3" />;
    case "skipped": return <X className="w-3 h-3" />;
  }
}

function formatDuration(sec?: number): string {
  if (!sec) return "--";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (score >= 50) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-rose-400 border-rose-500/30 bg-rose-500/10";
}

function scoreTextColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

function SentimentBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-mono tabular-nums ${score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-rose-400"}`}>
        {score}
      </span>
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string; icon: any }[] = [
    { id: "brief", label: "Campaign Brief", icon: Megaphone },
    { id: "targets", label: "Build Targets", icon: Target },
    { id: "launch", label: "Launch Campaign", icon: Zap },
  ];
  const idx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              active ? "bg-violet-500/15 border border-violet-500/30" :
              done ? "opacity-60" : "opacity-30"
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border ${
                active ? "bg-violet-500 border-violet-400 text-black" :
                done ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" :
                "bg-white/5 border-white/10 text-white/50"
              }`}>
                {done ? <CheckCheck className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              </div>
              <span className={`text-xs font-medium ${active ? "text-violet-300" : done ? "text-white/50" : "text-white/40"}`}
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className={`w-4 h-4 mx-1 ${i < idx ? "text-white/50" : "text-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Advanced Targeting Panel ─────────────────────────────────────────────────

function AdvancedTargetingPanel({
  filters,
  onChange,
}: {
  filters: AdvancedFilters;
  onChange: (f: AdvancedFilters) => void;
}) {
  const set = (key: keyof AdvancedFilters, val: any) => onChange({ ...filters, [key]: val });

  const toggleTitle = (t: string) => {
    const cur = filters.jobTitles;
    set("jobTitles", cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  };

  return (
    <div className="space-y-4 pt-3 border-t border-white/[0.10]">
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/50">
        Advanced Targeting — override AI filters
      </p>

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />Industry
          </label>
          <Select value={filters.industry} onValueChange={(v) => set("industry", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.12] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any industry" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.12] text-white/80 max-h-64">
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="text-xs hover:bg-violet-500/10">{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <MapPin className="w-3 h-3" />Geography
          </label>
          <Select value={filters.geography} onValueChange={(v) => set("geography", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.12] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any geo" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.12] text-white/80 max-h-64">
              {GEO_OPTIONS.map((g) => (
                <SelectItem key={g} value={GEO_VALUES[g] || g} className="text-xs hover:bg-violet-500/10">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <Users className="w-3 h-3" />Company Size
          </label>
          <Select value={filters.companySize} onValueChange={(v) => set("companySize", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.12] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any size" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.12] text-white/80">
              {EMPLOYEE_SIZES.map((s) => <SelectItem key={s.value} value={s.value || "_any"} className="text-xs hover:bg-violet-500/10">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />Revenue
          </label>
          <Select value={filters.revenueRange} onValueChange={(v) => set("revenueRange", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.12] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any revenue" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.12] text-white/80">
              {REVENUE_RANGES.map((r) => <SelectItem key={r.value} value={r.value || "_any"} className="text-xs hover:bg-violet-500/10">{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <Cpu className="w-3 h-3" />Tech Stack
          </label>
          <input
            type="text"
            value={filters.techStack}
            onChange={(e) => set("techStack", e.target.value)}
            placeholder="e.g. Salesforce, AWS, HubSpot"
            className="w-full h-8 px-3 text-xs rounded-md border border-white/[0.12] bg-[#161618] text-white/60 placeholder:text-white/35 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
            <Search className="w-3 h-3" />Keywords
          </label>
          <input
            type="text"
            value={filters.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="e.g. digital transformation, cloud migration"
            className="w-full h-8 px-3 text-xs rounded-md border border-white/[0.12] bg-[#161618] text-white/60 placeholder:text-white/35 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Job Titles */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
          <User className="w-3 h-3" />Job Titles
        </label>
        <div className="flex flex-wrap gap-1.5">
          {JOB_TITLE_PRESETS.map((t) => {
            const active = filters.jobTitles.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTitle(t)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                  active
                    ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                    : "bg-white/[0.03] text-white/55 border-white/[0.12] hover:border-white/20 hover:text-white/55"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Default advanced filters ─────────────────────────────────────────────────

const DEFAULT_ADVANCED: AdvancedFilters = {
  industry: "All Industries",
  geography: "All US",
  companySize: "",
  revenueRange: "",
  jobTitles: [],
  techStack: "",
  keywords: "",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AtomCampaign() {
  const { toast } = useToast();
  const campaignParams = new URLSearchParams(window.location.hash.split("?")[1] || "");

  // Step flow
  const [step, setStep] = useState<Step>("brief");

  // Step 1 — Campaign Brief (pre-fill from cross-module navigation)
  const [brief, setBrief] = useState(campaignParams.get("brief") || campaignParams.get("pitch") || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED);

  // Step 2 — AI-built targets
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [campaignId] = useState(() => `camp_${Date.now()}`);
  const [targetStats, setTargetStats] = useState<{ companies: number; contacts: number } | null>(null);

  // Step 2 — Max targets + sort
  const [maxTargets, setMaxTargets] = useState(25);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Step 3 — Live launch
  const [calls, setCalls] = useState<Map<string, CallRecord>>(new Map());
  const [isPaused, setIsPaused] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const wsRefs = useRef<Map<string, WebSocket>>(new Map());
  const callQueueRef = useRef<Target[]>([]);
  const pausedRef = useRef(false);

  pausedRef.current = isPaused;

  // ─── Step 2: Build Targets ─────────────────────────────────────────────────

  // Map free-text geography from AI output to known prospect-scan values
  function normalizeGeo(geo: string): string | null {
    if (!geo) return null;
    const lower = geo.toLowerCase();
    if (lower.includes("california") || lower === "ca") return "California";
    if (lower.includes("texas") || lower === "tx") return "Texas";
    if (lower.includes("new york") || lower === "ny") return "New York";
    if (lower.includes("florida") || lower === "fl") return "Florida";
    if (lower.includes("illinois") || lower === "il") return "Illinois";
    if (lower.includes("georgia") || lower === "ga") return "Georgia";
    if (lower.includes("washington") || lower === "wa") return "Washington";
    if (lower.includes("massachusetts") || lower === "ma") return "Massachusetts";
    if (lower.includes("colorado") || lower === "co") return "Colorado";
    if (lower.includes("north carolina") || lower === "nc") return "North Carolina";
    if (lower.includes("united states") || lower.includes("us") || lower.includes("usa")) return "All US";
    if (lower.includes("europe") || lower.includes("eu")) return "EU";
    if (lower.includes("united kingdom") || lower.includes("uk")) return "UK";
    if (lower.includes("canada")) return "Canada";
    if (lower.includes("global") || lower.includes("worldwide")) return "Global";
    // US regions
    if (lower.includes("northeast")) return "US Northeast";
    if (lower.includes("midwest")) return "US Midwest";
    if (lower.includes("south")) return "US South";
    if (lower.includes("west")) return "US West";
    if (lower.includes("southeast")) return "US Southeast";
    return null;
  }

  // Map free-text company size to known values
  function normalizeCompanySize(sz: string): string | null {
    if (!sz) return null;
    const lower = sz.toLowerCase();
    if (lower.includes("1-10") || lower.includes("1 to 10") || lower.includes("micro")) return "1-10";
    if (lower.includes("11-50") || lower.includes("11 to 50") || lower.includes("small")) return "11-50";
    if (lower.includes("51-200") || lower.includes("51 to 200")) return "51-200";
    if (lower.includes("201-500") || lower.includes("201 to 500") || lower.includes("mid-market")) return "201-500";
    if (lower.includes("501-1000") || lower.includes("501 to 1000")) return "501-1000";
    if (lower.includes("1001-5000") || lower.includes("1001 to 5000")) return "1001-5000";
    if (lower.includes("5001-10000") || lower.includes("5001 to 10000")) return "5001-10000";
    if (lower.includes("10001") || lower.includes("enterprise") || lower.includes("large")) return "10001+";
    // Number ranges like "50-500"
    const match = lower.match(/(\d+)[^\d]+(\d+)/);
    if (match) {
      const hi = parseInt(match[2]);
      if (hi <= 10) return "1-10";
      if (hi <= 50) return "11-50";
      if (hi <= 200) return "51-200";
      if (hi <= 500) return "201-500";
      if (hi <= 1000) return "501-1000";
      if (hi <= 5000) return "1001-5000";
      return "5001-10000";
    }
    return null;
  }

  // Parse a single prospect object into expanded Target entries
  function parseProspectToTargets(p: any): Target[] {
    const contacts = (() => {
      try { return JSON.parse(p.contacts || "[]"); } catch { return []; }
    })();
    const techStack = (() => {
      try {
        const raw = p.techStack;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();
    const signals = (() => {
      try {
        const raw = p.signals;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();
    const recentNews = (() => {
      try {
        const raw = p.recentNews;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();
    const painPoints = (() => {
      try {
        const raw = p.painPoints;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();

    const companyPhone = p.companyPhone || "";
    const baseScore = typeof p.score === "number" ? p.score : (typeof p.webIntelScore === "number" ? p.webIntelScore : Math.floor(Math.random() * 40 + 40));

    const result: Target[] = [];

    if (contacts.length > 0) {
      for (const c of contacts.slice(0, 3)) {
        const phone = c.phone || companyPhone;
        const mobilePhone = c.mobilePhone || "";
        result.push({
          id: `${p.id || p.companyName}_${c.firstName}_${c.lastName}_${Date.now()}_${Math.random()}`,
          companyName: p.companyName || "",
          domain: p.domain || "",
          industry: p.industry || "",
          contactName: `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Decision Maker",
          title: c.position || "",
          phone,
          mobilePhone,
          email: c.email || "",
          linkedin: c.linkedin || "",
          city: c.city || "",
          state: c.state || "",
          score: baseScore,
          confidence: typeof c.confidence === "number" ? c.confidence : Math.floor(Math.random() * 30 + 60),
          companySize: p.companySize || "",
          employeeCount: typeof p.employeeCount === "number" ? p.employeeCount : 0,
          revenue: p.revenue || "",
          buyingSignals: signals.slice(0, 5),
          recentNews: recentNews.slice(0, 3),
          painPoints: painPoints.slice(0, 4),
          techStack: techStack.slice(0, 8),
          seniority: c.seniority || "",
          department: c.department || "",
          selected: !!phone,
        });
      }
    } else {
      // No contacts — create a stub entry from company data
      result.push({
        id: `${p.id || p.companyName}_co_${Date.now()}_${Math.random()}`,
        companyName: p.companyName || "",
        domain: p.domain || "",
        industry: p.industry || "",
        contactName: "Decision Maker",
        title: "Main Line",
        phone: companyPhone,
        mobilePhone: "",
        email: "",
        linkedin: "",
        city: "",
        state: "",
        score: baseScore,
        confidence: 40,
        companySize: p.companySize || "",
        employeeCount: typeof p.employeeCount === "number" ? p.employeeCount : 0,
        revenue: p.revenue || "",
        buyingSignals: signals.slice(0, 5),
        recentNews: recentNews.slice(0, 3),
        painPoints: painPoints.slice(0, 4),
        techStack: techStack.slice(0, 8),
        seniority: "",
        department: "",
        selected: !!companyPhone,
      });
    }

    return result;
  }

  const buildTargets = async () => {
    if (!brief.trim()) {
      toast({ title: "Brief required", description: "Enter a campaign brief first.", variant: "destructive" });
      return;
    }
    setIsBuilding(true);
    setBuildProgress([]);
    setTargetStats(null);
    setStep("targets");

    try {
      setBuildProgress(["Analyzing campaign brief..."]);

      const briefLower = brief.toLowerCase();
      const analysisData: any = {
        product: brief.split("\n")[0].slice(0, 100),
      };

      // Auto-detect industry from brief
      if (briefLower.includes("cdn") || briefLower.includes("cloud") || briefLower.includes("saas") || briefLower.includes("tech") || briefLower.includes("software")) {
        analysisData.industry = "Technology";
      } else if (briefLower.includes("health") || briefLower.includes("medical") || briefLower.includes("pharma")) {
        analysisData.industry = "Healthcare";
      } else if (briefLower.includes("finance") || briefLower.includes("bank") || briefLower.includes("insurance")) {
        analysisData.industry = "Financial Services";
      }

      // Default job titles for campaigns
      analysisData.jobTitles = ["CTO", "CIO", "VP Engineering", "VP IT", "Director of IT", "Head of Technology"];

      setBuildProgress((p) => [...p, "Mapping targeting parameters..."]);

      // ── Build scan payload ──
      const buildPayload = (broadFallback = false, excludeCompanies: string[] = []) => {
        const payload: any = {};

        const product = analysisData.product || analysisData.productFocus || brief.split("\n")[0].slice(0, 80);
        if (product) payload.productFocus = product;

        const industry = (advancedFilters.industry && advancedFilters.industry !== "All Industries")
          ? advancedFilters.industry
          : analysisData.industry;
        if (industry && industry !== "All Industries") payload.industry = industry;

        if (!broadFallback) {
          const geoRaw = (advancedFilters.geography && advancedFilters.geography !== "All US")
            ? advancedFilters.geography
            : analysisData.geography;
          const geo = geoRaw ? normalizeGeo(geoRaw) : null;
          if (geo && geo !== "All US") payload.geo = geo;

          const sizeRaw = (advancedFilters.companySize && advancedFilters.companySize !== "_any")
            ? advancedFilters.companySize
            : analysisData.companySize;
          const size = sizeRaw ? normalizeCompanySize(sizeRaw) : null;
          if (size) payload.employeeSize = size;

          if (advancedFilters.revenueRange && advancedFilters.revenueRange !== "_any") {
            payload.revenueRange = advancedFilters.revenueRange;
          }
        }

        const titles = advancedFilters.jobTitles.length > 0
          ? advancedFilters.jobTitles
          : (analysisData.jobTitles || ["CEO", "CTO", "CIO", "VP Engineering", "VP IT"]);
        if (titles.length > 0) payload.jobTitles = titles;

        const tech = advancedFilters.techStack || analysisData.techStack;
        if (tech) payload.techStack = tech;

        const kw = advancedFilters.keywords || analysisData.keywords;
        if (kw) payload.keywords = kw;

        if (excludeCompanies.length > 0) payload.excludeCompanies = excludeCompanies;

        return payload;
      };

      // ── Multi-page scanning loop ──
      const allTargets: Target[] = [];
      const seenCompanyNames = new Set<string>();
      const MAX_PAGES = 10;
      let companiesScanned = 0;
      let broadMode = false;

      setBuildProgress((p) => [...p, `ATOM Intelligence scanning — target: ${maxTargets} contacts...`]);

      for (let page = 1; page <= MAX_PAGES; page++) {
        if (allTargets.length >= maxTargets) break;

        const excludeCompanies = Array.from(seenCompanyNames);

        setBuildProgress((prev) => {
          // Replace last "Scanning page..." line or append
          const lines = [...prev];
          const scanIdx = lines.findIndex((l) => l.startsWith("Scanning page"));
          const msg = `Scanning page ${page}... ${allTargets.length} contacts found so far`;
          if (scanIdx >= 0) { lines[scanIdx] = msg; return lines; }
          return [...lines, msg];
        });

        let prospects: any[] = [];

        try {
          const payload = buildPayload(broadMode, excludeCompanies);
          const scanRes = await apiRequest("POST", "/api/prospects/scan", payload);
          const scanData = await scanRes.json();
          prospects = Array.isArray(scanData) ? scanData : (scanData.prospects || []);
        } catch { /* swallow scan errors per-page */ }

        // If first page returns nothing, try broad fallback
        if (prospects.length === 0 && page === 1 && !broadMode) {
          setBuildProgress((prev) => [...prev, "Broadening search parameters..."]);
          broadMode = true;
          try {
            const broadPayload = buildPayload(true, excludeCompanies);
            const scanRes = await apiRequest("POST", "/api/prospects/scan", broadPayload);
            const scanData = await scanRes.json();
            prospects = Array.isArray(scanData) ? scanData : (scanData.prospects || []);
          } catch { }
        }

        if (prospects.length === 0) {
          // No more results — stop pagination
          setBuildProgress((prev) => [...prev, `No more results at page ${page}. Stopping.`]);
          break;
        }

        // Deduplicate by company name and parse into Target objects
        let newTargets = 0;
        const seenContactKeys = new Set(allTargets.map((t) => `${t.contactName.toLowerCase()}_${t.companyName.toLowerCase()}`));
        for (const p of prospects) {
          if (seenCompanyNames.has(p.companyName)) continue;
          seenCompanyNames.add(p.companyName);
          companiesScanned++;

          const parsed = parseProspectToTargets(p);
          for (const t of parsed) {
            // Deduplicate by contact name + company
            const key = `${t.contactName.toLowerCase()}_${t.companyName.toLowerCase()}`;
            if (seenContactKeys.has(key)) continue;
            seenContactKeys.add(key);
            if (allTargets.length < maxTargets) {
              allTargets.push(t);
              newTargets++;
            }
          }
        }

        if (newTargets === 0) {
          // All companies on this page already seen — stop
          break;
        }

        // Respect maxTargets cap
        if (allTargets.length >= maxTargets) break;

        // Small pause between pages to avoid hammering the API
        if (page < MAX_PAGES) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Hunter.io fallback for companies missing phones
      const domainsNeedingHunter = Array.from(seenCompanyNames)
        .map((name) => allTargets.find((t) => t.companyName === name && !t.phone && t.domain))
        .filter(Boolean)
        .map((t) => t!.domain)
        .filter((d) => d)
        .slice(0, 5);

      if (domainsNeedingHunter.length > 0) {
        setBuildProgress((p) => [...p, `Enriching ${domainsNeedingHunter.length} companies via secondary contact discovery...`]);
        const hunterResults = await Promise.allSettled(
          domainsNeedingHunter.map(async (domain) => {
            try {
              const res = await fetch(`/api/prospects/enrich`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain, mode: "hunter-only" }),
              });
              if (!res.ok) return { domain, contacts: [] };
              const data = await res.json();
              return { domain, contacts: data.contacts || [] };
            } catch { return { domain, contacts: [] }; }
          })
        );

        for (const result of hunterResults) {
          if (result.status !== "fulfilled" || !result.value.contacts?.length) continue;
          const { domain, contacts: hunterContacts } = result.value;
          const parentTarget = allTargets.find((t) => t.domain === domain);
          if (!parentTarget) continue;
          for (const hc of hunterContacts.slice(0, 2)) {
            if (!hc.phone_number && !hc.value) continue;
            const existingIds = new Set(allTargets.map((t) => t.id));
            const newId = `${parentTarget.companyName}_hunter_${hc.first_name}_${hc.last_name}`;
            if (existingIds.has(newId)) continue;
            allTargets.push({
              id: newId,
              companyName: parentTarget.companyName,
              domain: parentTarget.domain,
              industry: parentTarget.industry,
              contactName: `${hc.first_name || ""} ${hc.last_name || ""}`.trim() || "Contact",
              title: hc.position || hc.seniority || "",
              phone: hc.phone_number || "",
              mobilePhone: "",
              email: hc.value || "",
              linkedin: "",
              city: "",
              state: "",
              score: parentTarget.score,
              confidence: 50,
              companySize: parentTarget.companySize,
              employeeCount: parentTarget.employeeCount,
              revenue: parentTarget.revenue,
              buyingSignals: parentTarget.buyingSignals,
              recentNews: parentTarget.recentNews,
              painPoints: parentTarget.painPoints,
              techStack: parentTarget.techStack,
              seniority: hc.seniority || "",
              department: "",
              selected: !!hc.phone_number,
            });
          }
        }
      }

      const totalContacts = allTargets.length;
      setTargets(allTargets);
      setTargetStats({ companies: companiesScanned, contacts: totalContacts });
      setBuildProgress((p) => [...p, `✓ ${allTargets.length} targets ready · ${companiesScanned} companies scanned`]);
    } catch (err: any) {
      toast({ title: "Failed to build targets", description: err.message, variant: "destructive" });
      setStep("brief");
    } finally {
      setIsBuilding(false);
    }
  };

  // ─── Target selection ──────────────────────────────────────────────────────

  const toggleTarget = (id: string) => {
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, selected: !t.selected } : t));
  };

  const selectAll = () => setTargets((prev) => prev.map((t) => ({ ...t, selected: true })));

  const deselectAll = () => setTargets((prev) => prev.map((t) => ({ ...t, selected: false })));

  // ─── Email outreach per target ───────────────────────────────────────────────
  const [emailingTarget, setEmailingTarget] = useState<string | null>(null);

  const sendEmailOutreach = async (target: Target) => {
    if (!target.email) {
      toast({ title: "No email", description: `${target.contactName} has no email address.`, variant: "destructive" });
      return;
    }
    setEmailingTarget(target.id);
    try {
      // Step 1: Generate personalized email via AI
      const genRes = await fetch("/api/campaign/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: target.contactName,
          title: target.title,
          companyName: target.companyName,
          domain: target.domain,
          industry: target.industry,
          buyingSignals: target.buyingSignals,
          painPoints: target.painPoints,
          techStack: target.techStack,
          recentNews: target.recentNews,
          matchedProduct: target.techStack?.some((t: string) => t.toLowerCase().includes("aws") || t.toLowerCase().includes("cloud")) ? "atom-enterprise" : "antimatter-ai",
          brief,
        }),
      });
      if (!genRes.ok) throw new Error("Failed to generate email");
      const email = await genRes.json();

      // Step 2: Send via Outlook (the external tool handles this)
      // We'll open a mailto link as fallback, but the real send goes through the backend
      const mailtoUrl = `mailto:${target.email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
      window.open(mailtoUrl, "_blank");

      toast({
        title: "Email drafted",
        description: `Personalized email to ${target.contactName} at ${target.companyName} — check your email client.`,
      });
    } catch (err: any) {
      toast({ title: "Email failed", description: err.message, variant: "destructive" });
    } finally {
      setEmailingTarget(null);
    }
  };

  // ─── Sorting ───────────────────────────────────────────────────────────────

  const sortedTargets = [...targets].sort((a, b) => {
    let cmp = 0;
    if (sortField === "score") cmp = a.score - b.score;
    else if (sortField === "companyName") cmp = a.companyName.localeCompare(b.companyName);
    else if (sortField === "contactName") cmp = a.contactName.localeCompare(b.contactName);
    return sortDir === "desc" ? -cmp : cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "desc" ? <ArrowDown className="w-3 h-3 text-violet-400" /> : <ArrowUp className="w-3 h-3 text-violet-400" />;
  }

  // ─── Export targets to CSV ──────────────────────────────────────────────────
  const exportTargetsCSV = () => {
    if (targets.length === 0) return;
    const headers = [
      "Company", "Domain", "Industry", "Score", "Company Size", "Employees", "Revenue",
      "Contact Name", "Title", "Seniority", "Department", "Phone", "Mobile", "Email",
      "LinkedIn", "City", "State", "Confidence", "Buying Signals", "Pain Points",
      "Tech Stack", "Recent News", "Selected",
    ];
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const rows = targets.map((t) => [
      esc(t.companyName),
      esc(t.domain),
      esc(t.industry),
      t.score,
      esc(t.companySize),
      t.employeeCount || "",
      esc(t.revenue),
      esc(t.contactName),
      esc(t.title),
      esc(t.seniority),
      esc(t.department),
      t.phone || "",
      t.mobilePhone || "",
      t.email || "",
      t.linkedin || "",
      esc(t.city),
      esc(t.state),
      t.confidence,
      esc(t.buyingSignals.join("; ")),
      esc(t.painPoints.join("; ")),
      esc(t.techStack.join("; ")),
      esc(t.recentNews.join("; ")),
      t.selected ? "yes" : "no",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atom-campaign-targets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${targets.length} targets exported to CSV` });
  };

  const selectedTargets = targets.filter((t) => t.selected);
  const callableSelected = selectedTargets.filter((t) => t.phone);
  const emailableSelected = selectedTargets.filter((t) => t.email);

  // ─── Step 3: Launch Campaign ───────────────────────────────────────────────

  const connectWs = useCallback((callSid: string, targetId: string) => {
    if (wsRefs.current.has(callSid)) return;
    try {
      const ws = new WebSocket(`wss://45-79-202-76.sslip.io/events/${callSid}`);
      wsRefs.current.set(callSid, ws);

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          setCalls((prev) => {
            const updated = new Map(prev);
            const rec = updated.get(targetId);
            if (!rec) return prev;
            updated.set(targetId, {
              ...rec,
              sentiment: data.sentiment !== undefined ? data.sentiment : rec.sentiment,
              transcript: data.transcript || rec.transcript,
              status: data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : rec.status,
              duration: data.duration !== undefined ? data.duration : rec.duration,
              disposition: data.disposition || rec.disposition,
            });
            return updated;
          });
          if (data.status === "completed" || data.status === "failed") {
            ws.close();
            wsRefs.current.delete(callSid);
          }
        } catch { }
      };

      ws.onerror = () => ws.close();
    } catch { }
  }, []);

  const makeCall = useCallback(async (target: Target): Promise<void> => {
    const rec: CallRecord = {
      targetId: target.id,
      companyName: target.companyName,
      contactName: target.contactName,
      phone: target.phone,
      status: "calling",
      startedAt: Date.now(),
    };
    setCalls((prev) => new Map(prev).set(target.id, rec));

    try {
      const res = await fetch("/api/atom-leadgen/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: formatPhoneNumber(target.phone),
          firstName: target.contactName.split(" ")[0],
          companyName: target.companyName,
          product: brief.split("\n")[0].slice(0, 80),
          campaignId,
          brief,
        }),
      });

      if (!res.ok) throw new Error(`Call failed: ${res.status}`);
      const data = await res.json();
      const callSid = data.callSid || data.sid;

      setCalls((prev) => {
        const updated = new Map(prev);
        updated.set(target.id, { ...rec, callSid, status: "connected" });
        return updated;
      });

      if (callSid) connectWs(callSid, target.id);

      // Wait for completion (poll or timeout)
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          setCalls((prev) => {
            const r = prev.get(target.id);
            if (r && (r.status === "completed" || r.status === "failed")) {
              clearInterval(interval);
              resolve();
            }
            return prev;
          });
          if (attempts > 180) { clearInterval(interval); resolve(); } // 3 min max
        }, 1000);
      });

    } catch (err: any) {
      setCalls((prev) => {
        const updated = new Map(prev);
        updated.set(target.id, { ...rec, status: "failed", completedAt: Date.now() });
        return updated;
      });
    }
  }, [brief, campaignId, connectWs]);

  const launchCampaign = async () => {
    if (callableSelected.length === 0) {
      toast({ title: "No callable targets", description: "None of the selected targets have phone numbers. Use 'Email Selected' for email outreach.", variant: "destructive" });
      return;
    }
    setIsLaunching(true);
    setStep("launch");

    // Init all callable as queued, others as skipped
    const initialMap = new Map<string, CallRecord>();
    for (const t of selectedTargets) {
      initialMap.set(t.id, {
        targetId: t.id,
        companyName: t.companyName,
        contactName: t.contactName,
        phone: t.phone,
        status: t.phone ? "queued" : "failed",
        ...(t.phone ? {} : { completedAt: Date.now() }),
      });
    }
    setCalls(initialMap);

    callQueueRef.current = [...callableSelected];

    // Process only callable targets sequentially with pause support
    for (const target of callableSelected) {
      while (pausedRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
      await makeCall(target);
      // Small gap between calls
      await new Promise((r) => setTimeout(r, 1500));
    }

    setIsLaunching(false);
  };

  // ─── Stats calc ───────────────────────────────────────────────────────────

  const stats: CampaignStats = (() => {
    const recs = Array.from(calls.values());
    const completed = recs.filter((r) => r.status === "completed").length;
    const connected = recs.filter((r) => r.status === "connected" || r.status === "completed").length;
    const failed = recs.filter((r) => r.status === "failed").length;
    const meetings = recs.filter((r) => r.disposition === "hot_lead" || r.disposition === "callback").length;
    const withSentiment = recs.filter((r) => r.sentiment !== undefined);
    const avgSentiment = withSentiment.length > 0
      ? Math.round(withSentiment.reduce((a, r) => a + (r.sentiment || 0), 0) / withSentiment.length)
      : 0;
    return { total: recs.length, completed, connected, failed, meetings, avgSentiment };
  })();

  const completedCount = Array.from(calls.values()).filter((r) => r.status === "completed" || r.status === "failed").length;
  const progress = calls.size > 0 ? Math.round((completedCount / calls.size) * 100) : 0;

  // ─── Target table computed stats ──────────────────────────────────────────

  const callableCount = targets.filter((t) => !!t.phone).length;
  const noPhoneCount = targets.filter((t) => !t.phone).length;
  const avgScore = targets.length > 0
    ? Math.round(targets.reduce((sum, t) => sum + t.score, 0) / targets.length)
    : 0;

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wsRefs.current.forEach((ws) => ws.close());
    };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-violet-400" />
            </div>
            <h1
              className="text-2xl font-bold text-[#e8e8ea] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", letterSpacing: "-0.03em" }}
            >
              ATOM Campaign
            </h1>
          </div>
          <p className="text-sm text-[#8a8a96] ml-12">
            AI-powered voice campaign engine · brief → targets → launch
          </p>
        </div>
        {step !== "brief" && (
          <Button variant="outline" size="sm" onClick={() => { setStep("brief"); setTargets([]); setCalls(new Map()); setTargetStats(null); }}
            className="h-8 text-xs border-white/[0.12] text-white/40 hover:text-white hover:border-white/20 bg-transparent">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />New Campaign
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="overflow-x-auto pb-1">
        <StepIndicator current={step} />
      </div>

      {/* HVT Target Signal Panel — War Room Intel */}
      {step === "brief" && <HVTTargetSignalPanel />}

      {/* STEP 1: Campaign Brief */}
      {step === "brief" && (
        <Card className="bg-[#111113] border-white/[0.12]">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-base font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                Campaign Brief
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-white/50 leading-relaxed">
                Describe your campaign in plain English. ATOM AI will extract product focus, target industry,
                and ideal personas — then scan ATOM Intelligence to build your target list automatically.
              </p>

              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={`Cloudflare CDN takeout for Akamai. Akamai will match and beat Cloudflare pricing and eat up to 6 months of remaining contract to switch to Akamai.\n\nTarget mid-market tech companies on Cloudflare who are scaling fast and frustrated with costs. CTOs and VP Engineering at 50-500 person SaaS companies.`}
                rows={8}
                className="w-full px-4 py-3 text-sm rounded-xl border border-white/[0.12] bg-[#161618] text-[#e8e8ea] placeholder:text-white/35 focus:outline-none focus:border-violet-500/40 transition-colors resize-none leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
              />

              {/* Advanced Targeting toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-white/55 hover:text-violet-400 transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Advanced Targeting
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {(advancedFilters.industry !== "All Industries" ||
                  advancedFilters.geography !== "All US" ||
                  advancedFilters.companySize !== "" ||
                  advancedFilters.jobTitles.length > 0 ||
                  advancedFilters.techStack ||
                  advancedFilters.keywords) && (
                  <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/15 text-[9px] font-mono">
                    filters set
                  </Badge>
                )}
              </button>

              {showAdvanced && (
                <AdvancedTargetingPanel
                  filters={advancedFilters}
                  onChange={setAdvancedFilters}
                />
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  {brief.length} chars · the richer your brief, the better ATOM can target
                </p>
                <Button
                  onClick={buildTargets}
                  disabled={!brief.trim() || isBuilding}
                  className="h-10 px-6 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white gap-2 transition-all"
                  style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
                >
                  {isBuilding ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Building...</>
                  ) : (
                    <><Zap className="w-4 h-4" />Build Campaign</>
                  )}
                </Button>
              </div>
            </div>

            {/* Example briefs */}
            <div className="border-t border-white/[0.10] pt-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Example Briefs</p>
              <div className="grid gap-2">
                {[
                  "Cloudflare CDN takeout for Akamai. Match pricing + eat 6 months of contract to switch.",
                  "Security awareness training for companies still using KnowBe4. 50–500 employee tech companies.",
                  "Salesforce CPQ replacement pitch for companies overpaying. VP Sales and RevOps leaders.",
                ].map((ex) => (
                  <button key={ex} onClick={() => setBrief(ex)}
                    className="text-left text-xs text-white/50 hover:text-violet-400 transition-colors px-3 py-2 rounded-lg border border-white/[0.10] hover:border-violet-500/20 hover:bg-violet-500/5">
                    "{ex}"
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: Targets ────────────────────────────────────────────────── */}
      {step === "targets" && (
        <div className="space-y-4">
          {/* Build Progress */}
          {isBuilding && (
            <Card className="bg-[#111113] border-violet-500/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm font-medium text-violet-300">Building your campaign targets...</span>
                </div>
                <div className="space-y-1.5">
                  {buildProgress.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="text-white/60">{msg}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs">
                    <Loader2 className="w-3 h-3 text-white/35 animate-spin shrink-0" />
                    <span className="text-white/40">Processing...</span>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 bg-white/[0.07]" />)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Brief Preview + Max Targets selector */}
          {!isBuilding && (
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-0 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                <div className="flex items-start gap-2">
                  <Megaphone className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-violet-300 mb-1" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>Campaign Brief</p>
                    <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{brief}</p>
                  </div>
                  {targetStats && (
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-violet-300" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                        {targetStats.companies} companies
                      </p>
                      <p className="text-[10px] text-white/50 font-mono">{targetStats.contacts} contacts</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Max Targets selector */}
              <div className="shrink-0 flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/55 flex items-center gap-1">
                  <ListFilter className="w-3 h-3" />Max Targets
                </label>
                <Select value={String(maxTargets)} onValueChange={(v) => setMaxTargets(Number(v))}>
                  <SelectTrigger className="h-9 w-40 text-xs bg-[#161618] border-white/[0.12] text-white/60 hover:border-violet-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1c1c1f] border-white/[0.12] text-white/80">
                    {MAX_TARGET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)} className="text-xs hover:bg-violet-500/10">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targets.length === 0 && (
                  <Button
                    onClick={buildTargets}
                    disabled={isBuilding}
                    size="sm"
                    className="h-9 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />Rebuild
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Rich Target Table */}
          {!isBuilding && targets.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.12]">
              <CardContent className="p-0">

                {/* ── Stats Bar ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-white/[0.10]">
                  {[
                    {
                      label: "Total Targets",
                      value: targets.length,
                      icon: Target,
                      color: "text-white/85",
                      bg: "",
                    },
                    {
                      label: "Callable",
                      value: callableCount,
                      icon: Phone,
                      color: "text-emerald-400",
                      bg: "",
                    },
                    {
                      label: "Avg ATOM Score",
                      value: avgScore,
                      icon: BarChart3,
                      color: scoreTextColor(avgScore),
                      bg: "",
                    },
                    {
                      label: "Companies Scanned",
                      value: targetStats?.companies ?? 0,
                      icon: Building2,
                      color: "text-violet-400",
                      bg: "",
                    },
                  ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                      <div
                        key={stat.label}
                        className={`px-4 py-3 flex items-center gap-3 ${idx < 3 ? "border-r border-white/[0.10]" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                          <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div>
                          <p className={`text-lg font-bold tabular-nums leading-none ${stat.color}`}
                            style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                            {stat.value}
                          </p>
                          <p className="text-[10px] text-white/50 font-mono mt-0.5">{stat.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Table Controls ── */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.10] gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                      Campaign Targets
                    </span>
                    <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/15 text-[10px] font-mono">
                      {selectedTargets.length} selected
                    </Badge>
                  </div>

                  {/* Sort controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-white/40 mr-1">Sort:</span>
                    {([
                      { field: "score" as SortField, label: "Score" },
                      { field: "companyName" as SortField, label: "Company" },
                      { field: "contactName" as SortField, label: "Contact" },
                    ]).map(({ field, label }) => (
                      <button
                        key={field}
                        onClick={() => toggleSort(field)}
                        className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                          sortField === field
                            ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                            : "bg-white/[0.03] text-white/50 border-white/[0.10] hover:border-white/15 hover:text-white/50"
                        }`}
                      >
                        {label}
                        <SortIcon field={field} />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={selectAll}
                      className="h-7 text-xs text-white/40 hover:text-white hover:bg-white/5">
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}
                      className="h-7 text-xs text-white/40 hover:text-white hover:bg-white/5">
                      Deselect
                    </Button>
                    <Button
                      onClick={buildTargets}
                      disabled={isBuilding}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-white/40 hover:text-violet-400 hover:bg-violet-500/5 gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />Rescan
                    </Button>
                  </div>
                </div>

                {/* ── Column Headers ── */}
                <div className="grid grid-cols-[28px_52px_minmax(160px,1.8fr)_minmax(140px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_100px_80px] gap-2 items-center px-4 py-2 border-b border-white/[0.04] min-w-[900px]">
                  <div />
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Score</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Company</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Contact</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Phone</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Email / LinkedIn</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Signals</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Conf.</p>
                </div>

                {/* ── Target Rows ── */}
                <div className="max-h-[600px] overflow-y-auto overflow-x-auto divide-y divide-white/[0.04]">
                  <div className="min-w-[900px]">
                    {sortedTargets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => toggleTarget(t.id)}
                        className={`grid grid-cols-[28px_52px_minmax(160px,1.8fr)_minmax(140px,1.5fr)_minmax(120px,1fr)_minmax(120px,1fr)_100px_80px] gap-2 items-center px-4 py-2.5 transition-colors ${
                          t.phone ? "cursor-pointer" : "cursor-default"
                        } ${
                          t.selected && t.phone
                            ? "bg-violet-500/[0.10] hover:bg-violet-500/[0.10]"
                            : t.phone
                            ? "hover:bg-white/[0.025]"
                            : "opacity-70 hover:bg-white/[0.015]"
                        }`}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={t.selected}
                          
                          onChange={() => toggleTarget(t.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-transparent accent-violet-400 cursor-pointer"
                        />

                        {/* ATOM Score */}
                        <div className="flex items-center justify-center">
                          <span className={`text-xs font-bold font-mono tabular-nums px-1.5 py-0.5 rounded border ${scoreColor(t.score)}`}>
                            {t.score}
                          </span>
                        </div>

                        {/* Company */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="w-3 h-3 text-white/50 shrink-0" />
                            <span className="text-xs text-white truncate font-semibold">{t.companyName}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {t.domain && (
                              <span className="text-[10px] text-white/50 font-mono truncate">{t.domain}</span>
                            )}
                            {t.industry && (
                              <Badge className="bg-white/[0.07] text-white/55 border-white/[0.12] text-[9px] font-mono px-1 py-0 h-4 shrink-0">
                                {t.industry.split(" ")[0]}
                              </Badge>
                            )}
                            {t.companySize && (
                              <Badge className="bg-white/[0.07] text-white/40 border-white/[0.10] text-[9px] font-mono px-1 py-0 h-4 shrink-0">
                                {t.companySize}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <User className="w-3 h-3 text-white/40 shrink-0" />
                            <span className="text-xs text-white/90 truncate font-medium">{t.contactName}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-white/55 truncate">{t.title}</span>
                            {t.seniority && (
                              <Badge className="bg-violet-500/[0.10] text-violet-400/80 border-violet-500/[0.12] text-[9px] font-mono px-1 py-0 h-4 shrink-0">
                                {t.seniority}
                              </Badge>
                            )}
                          </div>
                          {(t.city || t.state) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-white/35 shrink-0" />
                              <span className="text-[10px] text-white/40 truncate">
                                {[t.city, t.state].filter(Boolean).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="min-w-0">
                          {t.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-violet-400 shrink-0" />
                              <span className="text-[11px] text-violet-300 font-mono truncate">{t.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-white/35 font-mono">No phone</span>
                          )}
                          {t.mobilePhone && t.mobilePhone !== t.phone && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-violet-400/70 shrink-0" />
                              <span className="text-[10px] text-violet-300/70 font-mono truncate">{t.mobilePhone}</span>
                            </div>
                          )}
                        </div>

                        {/* Email / LinkedIn */}
                        <div className="min-w-0 space-y-0.5">
                          {t.email ? (
                            <a
                              href={`mailto:${t.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 hover:text-violet-300 transition-colors group"
                            >
                              <Mail className="w-3 h-3 text-white/40 shrink-0 group-hover:text-violet-400" />
                              <span className="text-[11px] text-white/60 truncate group-hover:text-violet-300">{t.email}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-white/35">—</span>
                          )}
                          {t.linkedin && (
                            <a
                              href={t.linkedin.startsWith("http") ? t.linkedin : `https://${t.linkedin}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 hover:text-blue-400 transition-colors group"
                            >
                              <Link className="w-2.5 h-2.5 text-blue-400/70 shrink-0 group-hover:text-blue-400" />
                              <span className="text-[10px] text-blue-400/70 truncate group-hover:text-blue-400">LinkedIn</span>
                            </a>
                          )}
                        </div>

                        {/* Buying Signals (first 2) */}
                        <div className="min-w-0 space-y-0.5">
                          {t.buyingSignals.slice(0, 2).map((sig, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span className="text-[9px] text-white/55 truncate leading-tight">{sig}</span>
                            </div>
                          ))}
                          {t.buyingSignals.length === 0 && (
                            <span className="text-[9px] text-white/15 font-mono">—</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 justify-end">
                          {t.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); sendEmailOutreach(t); }}
                              disabled={emailingTarget === t.id}
                              className="h-6 text-[10px] px-2 gap-1 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 bg-transparent"
                            >
                              {emailingTarget === t.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Mail className="w-2.5 h-2.5" />}
                              Email
                            </Button>
                          )}
                          <Badge className={`text-[9px] font-mono px-1.5 shrink-0 ${
                            t.confidence >= 70
                              ? "bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20"
                              : t.confidence >= 50
                              ? "bg-amber-500/10 text-amber-400/70 border-amber-500/20"
                              : "bg-white/5 text-white/40 border-white/[0.12]"
                          }`}>
                            {t.confidence}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Summary Footer ── */}
                <div className="px-4 py-3 border-t border-white/[0.10] flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-white/40">
                    <span className="text-white/65 font-medium">{selectedTargets.length}</span> of {targets.length} targets selected
                    {" · "}
                    <span className="text-emerald-400/70">{callableCount} callable</span>
                    {" · "}
                    <span className="text-white/40">{noPhoneCount} without phone</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportTargetsCSV}
                      className="h-8 text-xs gap-1.5 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 bg-transparent"
                      data-testid="button-export-campaign-csv"
                    >
                      <Download className="w-3 h-3" />Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Bulk email all selected targets with email addresses
                        const emailTargets = selectedTargets.filter((t) => t.email);
                        if (emailTargets.length === 0) {
                          toast({ title: "No emails", description: "None of the selected targets have email addresses.", variant: "destructive" });
                          return;
                        }
                        // For bulk, just fire them sequentially with a small delay
                        toast({ title: "Drafting emails", description: `Generating ${emailTargets.length} personalized emails...` });
                        emailTargets.slice(0, 10).forEach((t, i) => {
                          setTimeout(() => sendEmailOutreach(t), i * 2000);
                        });
                      }}
                      className="h-8 text-xs gap-1.5 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 bg-transparent"
                    >
                      <Mail className="w-3 h-3" />Email Selected ({selectedTargets.filter((t) => t.email).length})
                    </Button>
                    <Button
                      onClick={launchCampaign}
                      disabled={selectedTargets.length === 0 || isLaunching}
                      className="h-8 px-5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white gap-2 transition-all disabled:opacity-40"
                      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
                    >
                      <Zap className="w-4 h-4" />
                      Launch Campaign ({callableSelected.length} calls)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isBuilding && targets.length === 0 && (
            <Card className="bg-[#111113] border-white/[0.12]">
              <CardContent className="py-16 flex flex-col items-center gap-3">
                <Target className="w-12 h-12 text-white/10" />
                <p className="text-sm text-white/50">No callable targets found</p>
                <p className="text-xs text-white/35 text-center max-w-xs">
                  Try broadening your brief or use the Advanced Targeting section to adjust filters.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("brief")}
                  className="mt-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 bg-transparent">
                  Edit Brief
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── STEP 3: Live Dashboard ─────────────────────────────────────────── */}
      {step === "launch" && (
        <div className="space-y-4">
          {/* Campaign Brief recap */}
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-4 py-2.5 flex items-center gap-3">
            <Megaphone className="w-4 h-4 text-violet-400 shrink-0" />
            <p className="text-xs text-white/50 leading-relaxed line-clamp-1 flex-1">{brief}</p>
            <Badge className={`text-[10px] font-mono shrink-0 ${isLaunching ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"}`}>
              {isLaunching ? "LIVE" : "COMPLETE"}
            </Badge>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Calls", value: stats.total, icon: Phone, color: "text-white/85" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Connected", value: stats.connected, icon: PhoneCall, color: "text-violet-400" },
              { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-rose-400" },
              { label: "Meetings", value: stats.meetings, icon: TrendingUp, color: "text-amber-400" },
              { label: "Avg Sentiment", value: stats.avgSentiment ? `${stats.avgSentiment}%` : "—", icon: Activity, color: "text-purple-400" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="bg-[#111113] border-white/[0.12]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                      <span className="text-[10px] font-mono text-white/50">{stat.label}</span>
                    </div>
                    <p className={`text-xl font-bold tabular-nums ${stat.color}`}
                      style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Progress Bar */}
          <Card className="bg-[#111113] border-white/[0.12]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Campaign Progress
                  </span>
                  <span className="text-xs text-white/50 font-mono">{completedCount}/{calls.size}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isLaunching && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setIsPaused((p) => !p)}
                      className={`h-7 text-xs gap-1.5 border transition-all ${
                        isPaused
                          ? "border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
                          : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      } bg-transparent`}
                    >
                      {isPaused ? <><Play className="w-3 h-3" />Resume</> : <><Pause className="w-3 h-3" />Pause</>}
                    </Button>
                  )}
                  <Badge className={`text-[10px] font-mono ${progress === 100 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : isPaused ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-violet-500/15 text-violet-400 border-violet-500/25"}`}>
                    {progress === 100 ? "Done" : isPaused ? "Paused" : "Running"}
                  </Badge>
                </div>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">{progress}% complete</p>
            </CardContent>
          </Card>

          {/* Call Records */}
          <Card className="bg-[#111113] border-white/[0.12]">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-white/[0.10] flex items-center gap-2">
                <Signal className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                  Live Call Feed
                </span>
              </div>

              {/* Table Headers */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-white/[0.04]">
                {["Company", "Contact", "Status", "Duration", "Sentiment", "Disposition"].map((h) => (
                  <p key={h} className="text-[10px] font-mono uppercase tracking-wider text-white/40">{h}</p>
                ))}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                {Array.from(calls.values()).map((rec) => (
                  <div key={rec.targetId} className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3 h-3 text-white/40 shrink-0" />
                      <span className="text-xs text-white/85 truncate">{rec.companyName}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white/60 truncate">{rec.contactName}</p>
                      <p className="text-[10px] text-white/40 font-mono truncate">{rec.phone}</p>
                    </div>
                    <Badge className={`text-[10px] font-mono gap-1 px-1.5 w-fit border ${statusColor(rec.status)}`}>
                      {statusIcon(rec.status)}{rec.status}
                    </Badge>
                    <span className="text-xs text-white/40 font-mono tabular-nums w-12 text-right">
                      {formatDuration(rec.duration)}
                    </span>
                    <div className="w-24">
                      {rec.sentiment !== undefined ? (
                        <SentimentBar score={rec.sentiment} />
                      ) : (
                        <span className="text-[10px] text-white/35 font-mono">—</span>
                      )}
                    </div>
                    <div className="w-20">
                      {rec.disposition ? (
                        <Badge className={`text-[9px] font-mono px-1.5 ${
                          rec.disposition === "hot_lead" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
                          rec.disposition === "callback" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                          rec.disposition === "qualified" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          "bg-white/5 text-white/50 border-white/10"
                        }`}>
                          {rec.disposition.replace("_", " ")}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-white/15 font-mono">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {calls.size === 0 && (
                <div className="py-12 flex flex-col items-center gap-2">
                  <Phone className="w-10 h-10 text-white/10" />
                  <p className="text-sm text-white/40">Initializing campaign...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
