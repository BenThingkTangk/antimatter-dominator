import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useIntel } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Loader2, Copy, Brain, Zap, History,
  Plus, ChevronDown, ChevronUp, Trash2, Check,
  TrendingUp, TrendingDown, Minus,
  AlertCircle, Target, Lightbulb, ArrowRight,
  Globe, BarChart3, Activity, Swords
} from "lucide-react";
import type { Product } from "@shared/schema";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MarketSentiment {
  score: number;
  label: string;
  direction: "bullish" | "bearish" | "neutral";
  reasoning: string;
}

interface KeySignal {
  title: string;
  description: string;
  urgency: "critical" | "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  category: string;
}

interface CompetitiveMove {
  competitor: string;
  move: string;
  threat: "high" | "medium" | "low";
  opportunity: string;
}

interface Opportunity {
  rank: number;
  title: string;
  description: string;
  score: number;
  effort: "low" | "medium" | "high";
  timeframe: string;
}

interface ActionItem {
  priority: number;
  action: string;
  owner: string;
  deadline: string;
}

interface MarketResult {
  title: string;
  summary: string;
  marketSentiment: MarketSentiment;
  keySignals: KeySignal[];
  competitiveMoves: CompetitiveMove[];
  opportunities: Opportunity[];
  actionItems: ActionItem[];
  talkingPoints: string[];
  impactLevel: string;
  category: string;
  relevantProducts?: string;
  id?: number;
  createdAt?: string;
  hasRagContext?: boolean;
}

interface LocalMarketEntry {
  id: string;
  product: string;
  industry: string;
  analysisType: string;
  region: string;
  timeHorizon: string;
  result: MarketResult;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const PRODUCTS = [
  { value: "all", label: "All Products" },
  { value: "antimatter-ai-platform", label: "Antimatter AI Platform" },
  { value: "atom-enterprise-ai", label: "ATOM Enterprise AI" },
  { value: "vidzee", label: "Vidzee" },
  { value: "clinix-agent", label: "Clinix Agent" },
  { value: "clinix-ai", label: "Clinix AI" },
  { value: "red-team-atom", label: "Red Team ATOM" },
];

const INDUSTRIES = [
  "Healthcare", "Financial Services", "Real Estate", "Cybersecurity / Defense",
  "Technology / SaaS", "Government / Public Sector", "Manufacturing",
  "Retail / E-Commerce", "Insurance", "Education", "Energy & Utilities",
  "Legal & Professional Services", "Life Sciences / Pharma", "Telecommunications",
  "Transportation & Logistics", "Media & Entertainment", "Hospitality",
  "Construction & Real Estate Dev", "Non-Profit / NGO", "Aerospace & Defense",
];

const ANALYSIS_TYPES = [
  { value: "Trend Analysis", icon: TrendingUp, desc: "Emerging trends & market shifts" },
  { value: "Competitive Landscape", icon: Swords, desc: "Competitor moves & positioning" },
  { value: "Buying Intent Signals", icon: Target, desc: "Active purchase signals" },
  { value: "Technology Adoption", icon: Activity, desc: "Tech adoption curves" },
  { value: "Market Sizing", icon: BarChart3, desc: "TAM / SAM / SOM analysis" },
];

const REGIONS = [
  "North America", "United States", "Canada", "Europe", "United Kingdom",
  "APAC", "Latin America", "Middle East", "Global",
];

const TIME_HORIZONS = [
  { value: "30 days", label: "30 Days" },
  { value: "90 days", label: "90 Days" },
  { value: "6 months", label: "6 Months" },
  { value: "1 year", label: "1 Year" },
];

const URGENCY_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    dot: "bg-red-500" },
  high:     { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/20",   dot: "bg-rose-400" },
  medium:   { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  dot: "bg-amber-400" },
  low:      { bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/20",dot: "bg-emerald-400" },
};

const THREAT_COLORS: Record<string, string> = {
  high:   "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const EFFORT_COLORS: Record<string, string> = {
  low:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high:   "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const OWNER_COLORS: Record<string, string> = {
  "AE":         "bg-teal-500/15 text-teal-300 border-teal-500/25",
  "SDR":        "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "CSM":        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Leadership": "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const STORAGE_KEY = "atom_market_history";

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const diff = Date.now() - ts;
  const h = diff / 3600000;
  if (h < 0.017) return "just now";
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadHistory(): LocalMarketEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(e: LocalMarketEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SentimentGauge({ sentiment }: { sentiment: MarketSentiment }) {
  const score = sentiment?.score || 50;
  // Map 0-100 to gauge angle (-90 to +90 degrees, center is 0 = 50)
  const angle = ((score / 100) * 180) - 90;

  const color = score >= 65 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label = sentiment?.label || (score >= 65 ? "Bullish" : score >= 45 ? "Neutral" : "Bearish");
  const DirectionIcon = score >= 65 ? TrendingUp : score >= 45 ? Minus : TrendingDown;

  // Semi-circle SVG gauge
  const cx = 100, cy = 90, r = 72;
  const circumference = Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[200px] mx-auto">
        <svg width="100%" height="auto" viewBox="0 0 200 110" style={{ aspectRatio: "200/110" }}>
          {/* Background track */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} strokeLinecap="round" />

          {/* Gradient segments */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="url(#sentGradient)" strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}
          />

          <defs>
            <linearGradient id="sentGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Needle */}
          <g transform={`rotate(${angle}, ${cx}, ${cy})`}>
            <line x1={cx} y1={cy} x2={cx} y2={cy - r + 8}
              stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.6}
              style={{ transition: "all 1.2s cubic-bezier(0.4,0,0.2,1)" }}
            />
            <circle cx={cx} cy={cy} r={4} fill="white" opacity={0.8} />
          </g>

          {/* Score center */}
          <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize={22} fontWeight="bold"
            style={{ transition: "fill 0.5s" }}>
            {score}
          </text>
          <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={10}>/ 100</text>
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <DirectionIcon className="w-4 h-4" style={{ color }} />
        <span className="text-base font-semibold" style={{ color }}>{label}</span>
      </div>

      {sentiment?.reasoning && (
        <p className="text-xs text-white/40 text-center max-w-[280px] leading-relaxed">{sentiment.reasoning}</p>
      )}
    </div>
  );
}

function OpportunityBar({ opportunity }: { opportunity: Opportunity }) {
  const score = opportunity.score;
  const color = score >= 80 ? "#0d9488" : score >= 60 ? "#22c55e" : "#f59e0b";
  return (
    <div className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white/40 border border-white/10">
        {opportunity.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm text-white/70 truncate font-medium">{opportunity.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${EFFORT_COLORS[opportunity.effort] || EFFORT_COLORS["medium"]}`}>
              {opportunity.effort} effort
            </span>
            <span className="text-[10px] text-white/30 border border-white/10 px-1.5 py-0.5 rounded">{opportunity.timeframe}</span>
          </div>
        </div>
        <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${score}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
        </div>
        <p className="text-[11px] text-white/40 mt-1 line-clamp-1">{opportunity.description}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className="text-base font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-48 h-24 rounded-full bg-white/[0.04]" />
        <div className="w-24 h-4 rounded bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
      </div>
      <div className="space-y-2">
        {[100, 90, 75, 85, 60].map((w, i) => (
          <div key={i} className="h-3 rounded bg-white/[0.04]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function MarketIntent() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const { toast } = useToast();

  // Form state
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("North America");
  const [analysisType, setAnalysisType] = useState("Trend Analysis");
  const [timeHorizon, setTimeHorizon] = useState("90 days");
  const [customQuery, setCustomQuery] = useState(params.get("query") || "");

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalMarketEntry[]>([]);
  const [activeResult, setActiveResult] = useState<MarketResult | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"signals" | "competition" | "opportunities" | "actions">("signals");

  useEffect(() => { setLocalHistory(loadHistory()); }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const allProducts = [
    ...PRODUCTS,
    ...products.filter(p => !PRODUCTS.find(sp => sp.value === p.slug)).map(p => ({ value: p.slug, label: p.name })),
  ];

  const analyzeIntent = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/market-intent/analyze", {
        productSlug: selectedProduct === "all" ? undefined : selectedProduct,
        industry: selectedIndustry || undefined,
        region: selectedRegion || undefined,
        analysisType,
        timeHorizon,
        customQuery: customQuery || undefined,
      });
      return res.json();
    },
    onSuccess: (data: MarketResult) => {
      setActiveResult(data);
      setActiveTab("signals");

      // Store in global store (legacy)
      store.addIntel({
        id: Date.now(),
        title: data.title,
        summary: data.summary,
        relevantProducts: data.relevantProducts || selectedProduct,
        impactLevel: data.impactLevel || "high",
        source: "AI Analysis",
        category: data.category || "market-shift",
        createdAt: new Date().toISOString(),
      });

      const productLabel = allProducts.find(p => p.value === selectedProduct)?.label || "All Products";
      const entry: LocalMarketEntry = {
        id: `${Date.now()}-${Math.random()}`,
        product: productLabel,
        industry: selectedIndustry,
        analysisType,
        region: selectedRegion,
        timeHorizon,
        result: data,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);

      toast({ title: "Intel ready", description: "Market intelligence complete." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Auto-generate when navigated from another module with query
  const autoGenRef = useRef(false);
  useEffect(() => {
    if (!autoGenRef.current && params.get("query")) {
      autoGenRef.current = true;
      setTimeout(() => analyzeIntent.mutate(), 400);
    }
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Copied" });
  };

  const loadFromHistory = (entry: LocalMarketEntry) => {
    const productObj = allProducts.find(p => p.label === entry.product);
    if (productObj) setSelectedProduct(productObj.value);
    setSelectedIndustry(entry.industry || "");
    setAnalysisType(entry.analysisType || "Trend Analysis");
    setSelectedRegion(entry.region || "North America");
    setTimeHorizon(entry.timeHorizon || "90 days");
    setActiveResult(entry.result);
    setShowHistory(false);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  const OUTPUT_TABS = [
    { key: "signals" as const, label: "Key Signals", count: activeResult?.keySignals?.length },
    { key: "competition" as const, label: "Competition", count: activeResult?.competitiveMoves?.length },
    { key: "opportunities" as const, label: "Opportunities", count: activeResult?.opportunities?.length },
    { key: "actions" as const, label: "Action Items", count: activeResult?.actionItems?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/15">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">ATOM Market Intent</h1>
          <p className="text-sm text-white/40">AI-powered market intelligence and buying signal detection</p>
        </div>
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 border-white/10 hover:border-emerald-500/30"
              onClick={() => { setShowHistory(false); setActiveResult(null); }}>
              <Plus className="w-3.5 h-3.5" />New Analysis
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className={`h-8 text-xs gap-1.5 border-white/10 transition-colors ${showHistory ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "hover:border-white/20"}`}
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-history">
            <History className="w-3.5 h-3.5" />
            History
            {localHistory.length > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] rounded-full px-1.5 leading-4 py-0">{localHistory.length}</span>
            )}
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory ? (
        <div className="space-y-2">
          {localHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30">
              <History className="w-8 h-8 mb-3 opacity-40" />
              <p className="text-sm">No market intel history yet</p>
            </div>
          ) : (
            <>
              {localHistory.map(entry => (
                <div key={entry.id}
                  className="rounded-xl bg-black/30 border border-white/[0.07] overflow-hidden backdrop-blur-sm hover:bg-black/40 transition-colors"
                  style={{ borderLeftWidth: 2, borderLeftColor: "#22c55e" }}>
                  <button className="w-full text-left p-4"
                    onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/80 truncate">{entry.result?.title || entry.analysisType}</p>
                        <p className="text-xs text-white/30 mt-0.5">{entry.industry || "All Industries"} · {entry.timeHorizon} · {formatTs(entry.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.result?.impactLevel || "high"} impact</Badge>
                        {expandedHistoryId === entry.id
                          ? <ChevronUp className="w-4 h-4 text-white/30" />
                          : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </div>
                    {expandedHistoryId !== entry.id && (
                      <p className="text-xs text-white/30 mt-2 line-clamp-2">{entry.result?.summary?.slice(0, 120)}...</p>
                    )}
                  </button>
                  {expandedHistoryId === entry.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{entry.product}</Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.industry || "All Industries"}</Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.analysisType}</Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.timeHorizon}</Badge>
                      </div>
                      <div className="text-sm text-white/60 leading-relaxed">{entry.result?.summary}</div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-white/10 hover:border-emerald-500/30"
                          onClick={() => loadFromHistory(entry)}>
                          <Plus className="w-3 h-3" />Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-white/40 hover:text-white/70"
                          onClick={() => copyToClipboard(entry.result?.summary || "", entry.id)}>
                          {copiedSection === entry.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <button onClick={clearHistory} className="text-xs text-red-400/60 hover:text-red-400 transition-colors flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />Clear History
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Config Panel */}
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5 space-y-4">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Analysis Parameters</h2>

              {/* Product Focus */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Product Focus</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-product">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Industry */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Industry</label>
                <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-industry">
                    <SelectValue placeholder="All industries" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Region */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Region</label>
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-region">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Analysis Type */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Analysis Type</label>
                <div className="space-y-1">
                  {ANALYSIS_TYPES.map(at => {
                    const Icon = at.icon;
                    const isActive = analysisType === at.value;
                    return (
                      <button key={at.value} onClick={() => setAnalysisType(at.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all border ${
                          isActive
                            ? "bg-emerald-500/10 border-emerald-500/20 text-white"
                            : "border-transparent hover:bg-white/[0.03] text-white/40 hover:text-white/70"
                        }`}
                        data-testid={`button-analysis-type-${at.value}`}>
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
                        <div>
                          <p className="text-xs font-medium">{at.value}</p>
                          <p className="text-[10px] text-white/25">{at.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Horizon */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Time Horizon</label>
                <div className="flex gap-1.5">
                  {TIME_HORIZONS.map(th => (
                    <button key={th.value} onClick={() => setTimeHorizon(th.value)}
                      className={`flex-1 text-[11px] py-1.5 rounded-lg border font-medium transition-all ${
                        timeHorizon === th.value
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "border-white/[0.07] text-white/30 hover:text-white/50 hover:border-white/15"
                      }`}
                      data-testid={`button-time-horizon-${th.value}`}>
                      {th.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Query */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Custom Query <span className="text-white/20 normal-case">(optional)</span></label>
                <Textarea
                  placeholder="e.g. Focus on HIPAA compliance spending trends in mid-market hospitals..."
                  value={customQuery}
                  onChange={e => setCustomQuery(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm min-h-[60px] resize-none"
                  data-testid="textarea-custom-query"
                />
              </div>

              <Button
                className="w-full bg-emerald-500/80 hover:bg-emerald-500 text-white font-medium transition-all"
                onClick={() => analyzeIntent.mutate()}
                disabled={analyzeIntent.isPending}
                data-testid="button-generate-intel">
                {analyzeIntent.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning signals...</>
                  : <><Brain className="w-4 h-4 mr-2" />Generate Intelligence</>}
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-3 space-y-3">
            {analyzeIntent.isPending ? (
              <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <p className="text-sm text-white/50">Scanning market signals and competitive intelligence...</p>
                </div>
                <SkeletonLoader />
              </div>
            ) : activeResult ? (
              <>
                {/* Market Sentiment Gauge */}
                <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Market Sentiment</p>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {activeResult.impactLevel} impact
                      </Badge>
                      <Button variant="ghost" size="sm"
                        className="h-7 text-xs text-white/40 hover:text-white/70 gap-1.5"
                        onClick={() => copyToClipboard(activeResult.summary, "summary")}
                        data-testid="button-copy-summary">
                        {copiedSection === "summary"
                          ? <><Check className="w-3 h-3 text-emerald-400" />Copied</>
                          : <><Copy className="w-3 h-3" />Copy</>}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                    {/* Gauge */}
                    <div className="sm:col-span-1 flex items-center justify-center">
                      {activeResult.marketSentiment && (
                        <SentimentGauge sentiment={activeResult.marketSentiment} />
                      )}
                    </div>

                    {/* Summary + Title */}
                    <div className="sm:col-span-2">
                      <h3 className="text-base font-semibold text-white/90 mb-2 leading-snug">{activeResult.title}</h3>
                      <p className="text-sm text-white/50 leading-relaxed">{activeResult.summary}</p>

                      {activeResult.talkingPoints?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.05]">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Key Talking Points</p>
                          <div className="space-y-1">
                            {activeResult.talkingPoints.map((tp, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className="text-emerald-400/40 text-[10px] mt-0.5 shrink-0">▸</span>
                                <p className="text-xs text-white/50">{tp}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tab Navigator */}
                <div className="flex gap-1.5 overflow-x-auto tabs-scroll pb-1">
                  {OUTPUT_TABS.map(tab => (
                    <button key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex-1 text-[11px] py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === tab.key
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                          : "text-white/30 border border-transparent hover:text-white/50 hover:border-white/[0.07]"
                      }`}
                      data-testid={`button-tab-${tab.key}`}>
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className={`text-[9px] rounded-full px-1.5 leading-4 ${activeTab === tab.key ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/20"}`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === "signals" && (
                  <div className="space-y-2">
                    {activeResult.keySignals?.length > 0 ? activeResult.keySignals.map((signal, i) => {
                      const cfg = URGENCY_CONFIG[signal.urgency] || URGENCY_CONFIG["medium"];
                      return (
                        <div key={i} className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4 hover:border-white/[0.12] transition-all">
                          <div className="flex items-start gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot}`}
                              style={{ boxShadow: `0 0 6px currentColor` }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-white/80">{signal.title}</p>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                    {signal.urgency}
                                  </span>
                                  <span className="text-[10px] text-white/25 capitalize">{signal.category}</span>
                                </div>
                              </div>
                              <p className="text-xs text-white/50 leading-relaxed">{signal.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-10 text-white/25 text-sm">No signals detected</div>
                    )}
                  </div>
                )}

                {activeTab === "competition" && (
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] overflow-hidden">
                    {activeResult.competitiveMoves?.length > 0 ? (
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px]">
                        <thead>
                          <tr className="border-b border-white/[0.05]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Competitor</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Move</th>
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider w-16">Threat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeResult.competitiveMoves.map((move, i) => (
                            <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-white/70">{move.competitor}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-white/50">{move.move}</p>
                                {move.opportunity && (
                                  <p className="text-[10px] text-emerald-400/60 mt-1 flex items-center gap-1">
                                    <Lightbulb className="w-2.5 h-2.5" />{move.opportunity}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium capitalize ${THREAT_COLORS[move.threat] || THREAT_COLORS["medium"]}`}>
                                  {move.threat}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-white/25 text-sm">No competitive moves detected</div>
                    )}
                  </div>
                )}

                {activeTab === "opportunities" && (
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4 space-y-1">
                    {activeResult.opportunities?.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[11px] text-white/30 uppercase tracking-wider">Scored Opportunities</p>
                          <p className="text-[10px] text-white/20">Ranked by opportunity score</p>
                        </div>
                        {activeResult.opportunities.map((opp, i) => (
                          <OpportunityBar key={i} opportunity={opp} />
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-10 text-white/25 text-sm">No opportunities identified</div>
                    )}
                  </div>
                )}

                {activeTab === "actions" && (
                  <div className="space-y-2">
                    {activeResult.actionItems?.length > 0 ? activeResult.actionItems.map((item, i) => (
                      <div key={i} className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4 flex items-start gap-3 hover:border-teal-500/15 transition-all group">
                        <div className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-teal-300">
                          {item.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80">{item.action}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${OWNER_COLORS[item.owner] || "bg-white/5 text-white/40 border-white/10"}`}>
                              {item.owner}
                            </span>
                            <span className="text-[10px] text-white/25 border border-white/[0.07] px-1.5 py-0.5 rounded">{item.deadline}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm"
                          className="h-6 text-[9px] text-white/20 hover:text-white/50 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => copyToClipboard(item.action, `action-${i}`)}>
                          {copiedSection === `action-${i}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        </Button>
                      </div>
                    )) : (
                      <div className="text-center py-10 text-white/25 text-sm">No action items generated</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-black/30 backdrop-blur-sm border border-white/[0.05] flex flex-col items-center justify-center py-20 text-white/20">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/15">
                  <Globe className="w-7 h-7 text-emerald-500/40" />
                </div>
                <p className="text-sm font-medium text-white/30">Configure analysis parameters</p>
                <p className="text-xs text-white/15 mt-1">Select industry, type, and time horizon to generate intelligence</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
