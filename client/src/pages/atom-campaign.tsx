import { useState, useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

// ─── Phone formatter ──────────────────────────────────────────────────────────

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
  contactName: string;
  title: string;
  phone: string;
  email: string;
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
    case "queued": return "text-white/30 border-white/10 bg-white/5";
    case "calling": return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "connected": return "text-violet-400 border-violet-500/30 bg-violet-500/10";
    case "completed": return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    case "failed": return "text-rose-400 border-rose-500/30 bg-rose-500/10";
    case "skipped": return "text-white/20 border-white/[0.06] bg-white/[0.03]";
    default: return "text-white/30 border-white/10 bg-white/5";
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
                "bg-white/5 border-white/10 text-white/30"
              }`}>
                {done ? <CheckCheck className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              </div>
              <span className={`text-xs font-medium ${active ? "text-violet-300" : done ? "text-white/50" : "text-white/25"}`}
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className={`w-4 h-4 mx-1 ${i < idx ? "text-white/30" : "text-white/10"}`} />
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
    <div className="space-y-4 pt-3 border-t border-white/[0.06]">
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/30">
        Advanced Targeting — override AI filters
      </p>

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />Industry
          </label>
          <Select value={filters.industry} onValueChange={(v) => set("industry", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.08] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any industry" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80 max-h-64">
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="text-xs hover:bg-violet-500/10">{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <MapPin className="w-3 h-3" />Geography
          </label>
          <Select value={filters.geography} onValueChange={(v) => set("geography", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.08] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any geo" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80 max-h-64">
              {GEO_OPTIONS.map((g) => (
                <SelectItem key={g} value={GEO_VALUES[g] || g} className="text-xs hover:bg-violet-500/10">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <Users className="w-3 h-3" />Company Size
          </label>
          <Select value={filters.companySize} onValueChange={(v) => set("companySize", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.08] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any size" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80">
              {EMPLOYEE_SIZES.map((s) => <SelectItem key={s.value} value={s.value || "_any"} className="text-xs hover:bg-violet-500/10">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />Revenue
          </label>
          <Select value={filters.revenueRange} onValueChange={(v) => set("revenueRange", v)}>
            <SelectTrigger className="h-8 text-xs bg-[#161618] border-white/[0.08] text-white/60 hover:border-violet-500/30">
              <SelectValue placeholder="Any revenue" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80">
              {REVENUE_RANGES.map((r) => <SelectItem key={r.value} value={r.value || "_any"} className="text-xs hover:bg-violet-500/10">{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <Cpu className="w-3 h-3" />Tech Stack
          </label>
          <input
            type="text"
            value={filters.techStack}
            onChange={(e) => set("techStack", e.target.value)}
            placeholder="e.g. Salesforce, AWS, HubSpot"
            className="w-full h-8 px-3 text-xs rounded-md border border-white/[0.08] bg-[#161618] text-white/60 placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
            <Search className="w-3 h-3" />Keywords
          </label>
          <input
            type="text"
            value={filters.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="e.g. digital transformation, cloud migration"
            className="w-full h-8 px-3 text-xs rounded-md border border-white/[0.08] bg-[#161618] text-white/60 placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Job Titles */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
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
                    : "bg-white/[0.03] text-white/35 border-white/[0.08] hover:border-white/20 hover:text-white/55"
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

  // Step flow
  const [step, setStep] = useState<Step>("brief");

  // Step 1 — Campaign Brief
  const [brief, setBrief] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED);

  // Step 2 — AI-built targets
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [campaignId] = useState(() => `camp_${Date.now()}`);
  const [targetStats, setTargetStats] = useState<{ companies: number; contacts: number } | null>(null);

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
      const lo = parseInt(match[1]);
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
      // Step 2a: Parse brief into targeting parameters using the brief text directly
      setBuildProgress(["Analyzing campaign brief..."]);
      
      // Extract key info from the brief for targeting
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

      // ── Build scan payload, merging AI analysis + manual overrides ──
      const buildPayload = (broadFallback = false) => {
        const payload: any = {};

        // Product focus
        const product = analysisData.product || analysisData.productFocus || brief.split("\n")[0].slice(0, 80);
        if (product) payload.productFocus = product;

        // Industry — prefer manual override, then AI
        const industry = (advancedFilters.industry && advancedFilters.industry !== "All Industries")
          ? advancedFilters.industry
          : analysisData.industry;
        if (industry && industry !== "All Industries") payload.industry = industry;

        if (!broadFallback) {
          // Geography — prefer manual override, then AI (normalized)
          const geoRaw = (advancedFilters.geography && advancedFilters.geography !== "All US")
            ? advancedFilters.geography
            : analysisData.geography;
          const geo = geoRaw ? normalizeGeo(geoRaw) : null;
          if (geo && geo !== "All US") payload.geo = geo;

          // Company size — prefer manual override, then AI (normalized)
          const sizeRaw = (advancedFilters.companySize && advancedFilters.companySize !== "_any")
            ? advancedFilters.companySize
            : analysisData.companySize;
          const size = sizeRaw ? normalizeCompanySize(sizeRaw) : null;
          if (size) payload.employeeSize = size;

          // Revenue
          if (advancedFilters.revenueRange && advancedFilters.revenueRange !== "_any") {
            payload.revenueRange = advancedFilters.revenueRange;
          }
        }

        // Job titles — prefer manual selection, then AI
        const titles = advancedFilters.jobTitles.length > 0
          ? advancedFilters.jobTitles
          : (analysisData.jobTitles || analysisData.targetPersonas || ["CEO", "CTO", "CIO", "VP Engineering", "VP IT"]);
        if (titles.length > 0) payload.jobTitles = titles;

        // Tech stack
        const tech = advancedFilters.techStack || analysisData.techStack;
        if (tech) payload.techStack = tech;

        // Keywords
        const kw = advancedFilters.keywords || analysisData.keywords;
        if (kw) payload.keywords = kw;

        return payload;
      };

      // ── First attempt: with all filters ──
      setBuildProgress((p) => [...p, "ATOM Intelligence scanning for matching companies..."]);

      let prospects: any[] = [];
      try {
        const payload = buildPayload(false);
        const scanRes = await apiRequest("POST", "/api/prospects/scan", payload);
        const scanData = await scanRes.json();
        prospects = Array.isArray(scanData) ? scanData : (scanData.prospects || []);
      } catch {}

      // ── Fallback: remove geo & size constraints if no results ──
      if (prospects.length === 0) {
        setBuildProgress((p) => [...p, "Broadening search..."]);
        try {
          const broadPayload = buildPayload(true);
          const scanRes = await apiRequest("POST", "/api/prospects/scan", broadPayload);
          const scanData = await scanRes.json();
          prospects = Array.isArray(scanData) ? scanData : (scanData.prospects || []);
        } catch {}
      }

      // ── Ultra-broad fallback: just industry + job titles ──
      if (prospects.length === 0) {
        setBuildProgress((p) => [...p, "Trying broader industry search..."]);
        try {
          const ultraBroad: any = { 
            product: brief.slice(0, 100),
            jobTitles: ["CTO", "CIO", "VP Engineering", "VP IT", "Director of IT"],
          };
          if (analysisData.industry) ultraBroad.industry = analysisData.industry;
          const scanRes = await apiRequest("POST", "/api/prospects/scan", ultraBroad);
          const scanData = await scanRes.json();
          prospects = Array.isArray(scanData) ? scanData : (scanData.prospects || []);
        } catch {}
      }

      const companiesFound = prospects.length;

      setBuildProgress((p) => [...p, `Found ${companiesFound} matching companies. Extracting contacts...`]);

      // Flatten prospects → targets
      const built: Target[] = [];
      let totalContacts = 0;
      for (const p of prospects) {
        const contacts = JSON.parse(p.contacts || "[]");
        totalContacts += contacts.length;
        if (contacts.length > 0) {
          for (const c of contacts.slice(0, 2)) {
            if (c.phone) {
              built.push({
                id: `${p.id || p.companyName}_${c.firstName}_${c.lastName}`,
                companyName: p.companyName,
                contactName: `${c.firstName} ${c.lastName}`.trim(),
                title: c.position || "",
                phone: c.phone,
                email: c.email || "",
                selected: true,
              });
            }
          }
        } else if (p.domain) {
          // Company without contacts — add as placeholder
          built.push({
            id: `${p.id || p.companyName}_co`,
            companyName: p.companyName,
            contactName: "Decision Maker",
            title: "Unknown",
            phone: "",
            email: "",
            selected: false,
          });
        }
      }

      setTargets(built);
      setTargetStats({ companies: companiesFound, contacts: totalContacts });
      setBuildProgress((p) => [...p, `✓ ${built.length} callable targets ready · ${companiesFound} companies · ${totalContacts} contacts`]);
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

  const selectAll = () => setTargets((prev) => prev.map((t) => ({ ...t, selected: !!t.phone })));
  const deselectAll = () => setTargets((prev) => prev.map((t) => ({ ...t, selected: false })));

  const selectedTargets = targets.filter((t) => t.selected && t.phone);

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
        } catch {}
      };

      ws.onerror = () => ws.close();
    } catch {}
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
    if (selectedTargets.length === 0) return;
    setIsLaunching(true);
    setStep("launch");

    // Init all as queued
    const initialMap = new Map<string, CallRecord>();
    for (const t of selectedTargets) {
      initialMap.set(t.id, {
        targetId: t.id,
        companyName: t.companyName,
        contactName: t.contactName,
        phone: t.phone,
        status: "queued",
      });
    }
    setCalls(initialMap);

    callQueueRef.current = [...selectedTargets];

    // Process sequentially with pause support
    for (const target of selectedTargets) {
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
    return {
      total: recs.length,
      completed,
      connected,
      failed,
      meetings,
      avgSentiment,
    };
  })();

  const completedCount = Array.from(calls.values()).filter((r) => r.status === "completed" || r.status === "failed").length;
  const progress = calls.size > 0 ? Math.round((completedCount / calls.size) * 100) : 0;

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
            className="h-8 text-xs border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 bg-transparent">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />New Campaign
          </Button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="overflow-x-auto pb-1">
        <StepIndicator current={step} />
      </div>

      {/* ── STEP 1: Brief ──────────────────────────────────────────────────── */}
      {step === "brief" && (
        <Card className="bg-[#111113] border-white/[0.08]">
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
                placeholder={`Cloudflare CDN takeout for Akamai. Akamai will match and beat Cloudflare pricing and eat up to 6 months of remaining contract to switch to Akamai.

Target mid-market tech companies on Cloudflare who are scaling fast and frustrated with costs. CTOs and VP Engineering at 50-500 person SaaS companies.`}
                rows={8}
                className="w-full px-4 py-3 text-sm rounded-xl border border-white/[0.08] bg-[#161618] text-[#e8e8ea] placeholder:text-white/20 focus:outline-none focus:border-violet-500/40 transition-colors resize-none leading-relaxed"
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
              />

              {/* Advanced Targeting toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-white/35 hover:text-violet-400 transition-colors"
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
                  <Badge className="bg-violet-500/10 text-violet-400/70 border-violet-500/15 text-[9px] font-mono">
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
                <p className="text-xs text-white/25">
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
            <div className="border-t border-white/[0.06] pt-4 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Example Briefs</p>
              <div className="grid gap-2">
                {[
                  "Cloudflare CDN takeout for Akamai. Match pricing + eat 6 months of contract to switch.",
                  "Security awareness training for companies still using KnowBe4. 50–500 employee tech companies.",
                  "Salesforce CPQ replacement pitch for companies overpaying. VP Sales and RevOps leaders.",
                ].map((ex) => (
                  <button key={ex} onClick={() => setBrief(ex)}
                    className="text-left text-xs text-white/30 hover:text-violet-400 transition-colors px-3 py-2 rounded-lg border border-white/[0.06] hover:border-violet-500/20 hover:bg-violet-500/5">
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
                    <Loader2 className="w-3 h-3 text-white/20 animate-spin shrink-0" />
                    <span className="text-white/25">Processing...</span>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 bg-white/[0.04]" />)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Brief Preview */}
          {!isBuilding && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
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
                    <p className="text-[10px] text-white/30 font-mono">{targetStats.contacts} contacts</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Target List */}
          {!isBuilding && targets.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-0">
                {/* Table Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <Target className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                      Campaign Targets
                    </span>
                    <Badge className="bg-violet-500/10 text-violet-400/70 border-violet-500/15 text-[10px] font-mono">
                      {selectedTargets.length} selected
                    </Badge>
                    {targetStats && (
                      <Badge className="bg-white/5 text-white/30 border-white/[0.08] text-[10px] font-mono">
                        {targetStats.companies} companies · {targetStats.contacts} contacts
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAll}
                      className="h-7 text-xs text-white/40 hover:text-white hover:bg-white/5">
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAll}
                      className="h-7 text-xs text-white/40 hover:text-white hover:bg-white/5">
                      Deselect All
                    </Button>
                  </div>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_1.5fr_auto] gap-3 items-center px-4 py-2 border-b border-white/[0.04]">
                  <div className="w-4" />
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Company</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Contact</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Phone</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">Email</p>
                  <div />
                </div>

                {/* Rows */}
                <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                  {targets.map((t) => (
                    <div
                      key={t.id}
                      className={`grid grid-cols-[auto_1fr_1fr_1fr_1.5fr_auto] gap-3 items-center px-4 py-2.5 transition-colors ${
                        t.selected && t.phone ? "bg-violet-500/[0.03] hover:bg-violet-500/[0.06]" : "hover:bg-white/[0.02]"
                      } ${!t.phone ? "opacity-40" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={t.selected && !!t.phone}
                        disabled={!t.phone}
                        onChange={() => toggleTarget(t.id)}
                        className="w-4 h-4 rounded border-white/20 bg-transparent accent-violet-400 cursor-pointer"
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <span className="text-xs text-white/80 truncate font-medium">{t.companyName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3 h-3 text-white/25 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-white/70 truncate">{t.contactName}</p>
                          <p className="text-[10px] text-white/30 truncate">{t.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        {t.phone ? (
                          <>
                            <Phone className="w-3 h-3 text-violet-400/60 shrink-0" />
                            <span className="text-[11px] text-violet-300/70 font-mono truncate">{t.phone}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-white/20 font-mono">No phone</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        {t.email ? (
                          <>
                            <Mail className="w-3 h-3 text-white/25 shrink-0" />
                            <span className="text-[11px] text-white/40 truncate">{t.email}</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-white/20">—</span>
                        )}
                      </div>
                      <Badge className={`text-[9px] font-mono px-1.5 shrink-0 ${t.phone ? "bg-violet-500/10 text-violet-400/60 border-violet-500/15" : "bg-white/5 text-white/20 border-white/[0.06]"}`}>
                        {t.phone ? "callable" : "no phone"}
                      </Badge>
                    </div>
                  ))}
                </div>

                {/* Launch CTA */}
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between gap-4">
                  <p className="text-xs text-white/40">
                    {selectedTargets.length} of {targets.length} targets selected ·{" "}
                    {targets.filter((t) => !t.phone).length} skipped (no phone)
                  </p>
                  <Button
                    onClick={launchCampaign}
                    disabled={selectedTargets.length === 0 || isLaunching}
                    className="h-9 px-5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white gap-2 transition-all disabled:opacity-40"
                    style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}
                  >
                    <Zap className="w-4 h-4" />
                    Launch Campaign ({selectedTargets.length} calls)
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isBuilding && targets.length === 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="py-16 flex flex-col items-center gap-3">
                <Target className="w-12 h-12 text-white/10" />
                <p className="text-sm text-white/30">No callable targets found</p>
                <p className="text-xs text-white/20 text-center max-w-xs">
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
              { label: "Total Calls", value: stats.total, icon: Phone, color: "text-white/70" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Connected", value: stats.connected, icon: PhoneCall, color: "text-violet-400" },
              { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-rose-400" },
              { label: "Meetings", value: stats.meetings, icon: TrendingUp, color: "text-amber-400" },
              { label: "Avg Sentiment", value: stats.avgSentiment ? `${stats.avgSentiment}%` : "—", icon: Activity, color: "text-purple-400" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="bg-[#111113] border-white/[0.08]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                      <span className="text-[10px] font-mono text-white/30">{stat.label}</span>
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
          <Card className="bg-[#111113] border-white/[0.08]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    Campaign Progress
                  </span>
                  <span className="text-xs text-white/30 font-mono">{completedCount}/{calls.size}</span>
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
              <p className="text-[11px] text-white/25 mt-1.5 font-mono">{progress}% complete</p>
            </CardContent>
          </Card>

          {/* Call Records */}
          <Card className="bg-[#111113] border-white/[0.08]">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Signal className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                  Live Call Feed
                </span>
              </div>

              {/* Table Headers */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-white/[0.04]">
                {["Company","Contact","Status","Duration","Sentiment","Disposition"].map((h) => (
                  <p key={h} className="text-[10px] font-mono uppercase tracking-wider text-white/25">{h}</p>
                ))}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-white/[0.04]">
                {Array.from(calls.values()).map((rec) => (
                  <div key={rec.targetId} className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3 h-3 text-white/25 shrink-0" />
                      <span className="text-xs text-white/70 truncate">{rec.companyName}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white/60 truncate">{rec.contactName}</p>
                      <p className="text-[10px] text-white/25 font-mono truncate">{rec.phone}</p>
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
                        <span className="text-[10px] text-white/20 font-mono">—</span>
                      )}
                    </div>
                    <div className="w-20">
                      {rec.disposition ? (
                        <Badge className={`text-[9px] font-mono px-1.5 ${
                          rec.disposition === "hot_lead" ? "bg-rose-500/15 text-rose-400 border-rose-500/20" :
                          rec.disposition === "callback" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                          rec.disposition === "qualified" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                          "bg-white/5 text-white/30 border-white/10"
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
                  <p className="text-sm text-white/25">Initializing campaign...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
