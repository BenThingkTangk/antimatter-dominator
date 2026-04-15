import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useObjections } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquareWarning, Loader2, Copy, Zap, History,
  ShieldCheck, DollarSign, Clock, Users, AlertTriangle, Lock,
  Plus, ChevronDown, ChevronUp, Trash2, Check, Brain,
  TrendingUp, MessageCircle, BarChart3, Target, RefreshCw,
  ArrowRight, Sparkles, PhoneCall, Mail, Megaphone
} from "lucide-react";
import { useLocation } from "wouter";
import type { Product } from "@shared/schema";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ObjectionSentiment {
  hostility: number;
  curiosity: number;
  buyingSignalStrength: number;
  recommendedTone: string;
}

interface ObjectionStrategy {
  type: string;
  headline: string;
  response: string;
}

interface ObjectionResult {
  primaryResponse: string;
  detectedCategory: string;
  categoryConfidence: number;
  sentiment: ObjectionSentiment;
  strategies: ObjectionStrategy[];
  followUpQuestions: string[];
  urgencyLevel: string;
  closingProbability: number;
  keyInsight: string;
  response?: string;
  content?: string;
  category?: string;
  hasRagContext?: boolean;
}

interface LocalObjectionEntry {
  id: string;
  product: string;
  objectionText: string;
  context: string;
  result: ObjectionResult;
  timestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const PRODUCTS = [
  { value: "antimatter-ai-platform", label: "Antimatter AI Platform" },
  { value: "atom-enterprise-ai", label: "ATOM Enterprise AI" },
  { value: "vidzee", label: "Vidzee" },
  { value: "clinix-agent", label: "Clinix Agent" },
  { value: "clinix-ai", label: "Clinix AI" },
  { value: "red-team-atom", label: "Red Team ATOM" },
];

const QUICK_OBJECTIONS = [
  "We already have something in place",
  "It's too expensive",
  "We're not ready for AI yet",
  "I need to check with my boss",
  "We've been burned by vendors before",
  "Quantum threats aren't real yet",
  "Our team won't adopt new tools",
  "Can you prove ROI?",
  "We're mid-contract with a competitor",
  "Our security team will block this",
];

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  price:       { icon: DollarSign,        color: "text-amber-400",   bg: "bg-amber-500/10",  border: "border-amber-500/20",  label: "Price" },
  competition: { icon: ShieldCheck,       color: "text-blue-400",    bg: "bg-blue-500/10",   border: "border-blue-500/20",   label: "Competition" },
  timing:      { icon: Clock,             color: "text-purple-400",  bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Timing" },
  authority:   { icon: Users,             color: "text-emerald-400", bg: "bg-emerald-500/10",border: "border-emerald-500/20",label: "Authority" },
  need:        { icon: AlertTriangle,     color: "text-rose-400",    bg: "bg-rose-500/10",   border: "border-rose-500/20",   label: "Need" },
  trust:       { icon: Lock,              color: "text-cyan-400",    bg: "bg-cyan-500/10",   border: "border-cyan-500/20",   label: "Trust" },
  general:     { icon: MessageSquareWarning, color: "text-white/50", bg: "bg-white/5",       border: "border-white/10",      label: "General" },
};

const TONE_COLORS: Record<string, string> = {
  "Empathetic":   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "Direct":       "bg-rose-500/15 text-rose-400 border-rose-500/25",
  "Educational":  "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "Reassuring":   "bg-violet-500/15 text-violet-300 border-violet-500/25",
};

const URGENCY_COLORS: Record<string, string> = {
  "high":   "text-rose-400 bg-rose-500/10 border-rose-500/20",
  "medium": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "low":    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

const STORAGE_KEY = "atom_objection_history";

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const diff = Date.now() - ts;
  const h = diff / 3600000;
  if (h < 0.017) return "just now";
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadHistory(): LocalObjectionEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(e: LocalObjectionEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); } catch {}
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SentimentMeter({ label, value, low, high }: { label: string; value: number; low: string; high: string }) {
  const leftPct = Math.max(0, Math.min(100, 100 - value));
  const rightPct = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-white/30">
        <span>{low}</span>
        <span>{high}</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden bg-white/5">
        <div
          className="absolute left-0 h-full rounded-l-full transition-all duration-1000"
          style={{
            width: `${leftPct}%`,
            background: "linear-gradient(to right, #22c55e20, #22c55e60)",
          }}
        />
        <div
          className="absolute right-0 h-full rounded-r-full transition-all duration-1000"
          style={{
            width: `${rightPct}%`,
            background: "linear-gradient(to left, #ef444420, #ef444460)",
          }}
        />
        {/* Indicator needle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full bg-white/60 transition-all duration-1000"
          style={{ left: `${value}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>
      <div className="text-center text-[10px] text-white/40">{label}: <span className="text-white/60">{value}%</span></div>
    </div>
  );
}

function BuyingSignalGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const radius = 32;
  const circumference = Math.PI * radius; // half circle
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-12 overflow-hidden">
        <svg width={96} height={64} viewBox="0 0 96 64" className="absolute top-0 left-0">
          {/* Background track */}
          <path
            d="M 8 56 A 40 40 0 0 1 88 56"
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d="M 8 56 A 40 40 0 0 1 88 56"
            fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 125.66} 125.66`}
            style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">Buying Signal</span>
    </div>
  );
}

function CircularClosingProb({ score }: { score: number }) {
  const color = score >= 65 ? "#0d9488" : score >= 40 ? "#f59e0b" : "#ef4444";
  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg width={64} height={64} viewBox="0 0 64 64" className="-rotate-90">
          <circle cx={32} cy={32} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
          <circle
            cx={32} cy={32} r={radius} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (score / 100) * circumference}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 5px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <span className="text-[10px] text-white/40">Close Prob.</span>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-white/[0.04]" />)}
      </div>
      <div className="space-y-2">
        {[100, 90, 75, 85, 60].map((w, i) => (
          <div key={i} className="h-3.5 rounded bg-white/[0.04]" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function ObjectionHandler() {
  const { toast } = useToast();

  // Form state
  const [, navigate] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [objectionText, setObjectionText] = useState("");
  const [context, setContext] = useState("");

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalObjectionEntry[]>([]);
  const [activeResult, setActiveResult] = useState<ObjectionResult | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeStrategyTab, setActiveStrategyTab] = useState(0);

  useEffect(() => { setLocalHistory(loadHistory()); }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const allProducts = [
    ...PRODUCTS,
    ...products.filter(p => !PRODUCTS.find(sp => sp.value === p.slug)).map(p => ({ value: p.slug, label: p.name })),
  ];

  const handleObjection = useMutation({
    mutationFn: async () => {
      const productLabel = allProducts.find(p => p.value === selectedProduct)?.label || selectedProduct;
      const res = await apiRequest("POST", "/api/objection/handle", {
        productSlug: selectedProduct,
        selectedProduct: productLabel,
        objection: objectionText,
        objectionText,
        context: context || undefined,
      });
      return res.json();
    },
    onSuccess: (data: ObjectionResult) => {
      setActiveResult(data);
      setActiveStrategyTab(0);

      // Store in global store (legacy)
      store.addObjection({
        id: Date.now(),
        productId: 0,
        objection: objectionText,
        response: data.primaryResponse || data.response || "",
        category: data.detectedCategory || data.category || "general",
        createdAt: new Date().toISOString(),
      });

      const productLabel = allProducts.find(p => p.value === selectedProduct)?.label || selectedProduct;
      const entry: LocalObjectionEntry = {
        id: `${Date.now()}-${Math.random()}`,
        product: productLabel,
        objectionText,
        context,
        result: data,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);

      toast({ title: "Response ready", description: "Counter-objection crafted." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Copied" });
  };

  const loadFromHistory = (entry: LocalObjectionEntry) => {
    const productObj = allProducts.find(p => p.label === entry.product || p.value === entry.product);
    if (productObj) setSelectedProduct(productObj.value);
    setObjectionText(entry.objectionText);
    setContext(entry.context || "");
    setActiveResult(entry.result);
    setShowHistory(false);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  const category = activeResult?.detectedCategory || "general";
  const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG["general"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/15">
          <MessageSquareWarning className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">ATOM Objection Handler</h1>
          <p className="text-sm text-white/40">Counter any pushback with AI-precision responses</p>
        </div>
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="outline" size="sm"
              className="h-8 text-xs gap-1.5 border-white/10 hover:border-amber-500/30"
              onClick={() => { setShowHistory(false); setActiveResult(null); }}>
              <Plus className="w-3.5 h-3.5" />New Objection
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className={`h-8 text-xs gap-1.5 border-white/10 transition-colors ${showHistory ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "hover:border-white/20"}`}
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-history">
            <History className="w-3.5 h-3.5" />
            History
            {localHistory.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 leading-4 py-0">{localHistory.length}</span>
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
              <p className="text-sm">No objections handled yet</p>
            </div>
          ) : (
            <>
              {localHistory.map(entry => {
                const cat = entry.result?.detectedCategory || entry.result?.category || "general";
                const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG["general"];
                const CatIcon = cfg.icon;
                return (
                  <div key={entry.id}
                    className="rounded-xl bg-black/30 border border-white/[0.07] overflow-hidden backdrop-blur-sm hover:bg-black/40 transition-colors"
                    style={{ borderLeftWidth: 2, borderLeftColor: "#f59e0b" }}>
                    <button className="w-full text-left p-4"
                      onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white/80 truncate">{entry.product}</p>
                          <p className="text-xs text-white/30 mt-0.5">{formatTs(entry.timestamp)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                          {expandedHistoryId === entry.id
                            ? <ChevronUp className="w-4 h-4 text-white/30" />
                            : <ChevronDown className="w-4 h-4 text-white/30" />}
                        </div>
                      </div>
                      {expandedHistoryId !== entry.id && (
                        <p className="text-xs text-white/30 mt-2 line-clamp-2 italic">"{entry.objectionText}"</p>
                      )}
                    </button>
                    {expandedHistoryId === entry.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
                          <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-1">Objection</p>
                          <p className="text-sm italic text-white/60">"{entry.objectionText}"</p>
                        </div>
                        <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                          {entry.result?.primaryResponse || entry.result?.response}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-white/10 hover:border-amber-500/30"
                            onClick={() => loadFromHistory(entry)}>
                            <Plus className="w-3 h-3" />Restore
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-white/40 hover:text-white/70"
                            onClick={() => copyToClipboard(entry.result?.primaryResponse || entry.result?.response || "", entry.id)}>
                            {copiedSection === entry.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-3">
            <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5 space-y-4">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Objection Details</h2>

              {/* Product */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Product</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-product">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Objection */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">The Objection</label>
                <Textarea
                  placeholder='Type what the prospect said, e.g. "We already have a solution in place..."'
                  value={objectionText}
                  onChange={e => setObjectionText(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm min-h-[100px] resize-none"
                  data-testid="textarea-objection"
                />
              </div>

              {/* Quick Select */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Quick Select</label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_OBJECTIONS.map(obj => (
                    <button key={obj}
                      onClick={() => setObjectionText(obj)}
                      className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                        objectionText === obj
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                          : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15"
                      }`}
                      data-testid={`button-quick-objection-${obj.slice(0, 10)}`}>
                      {obj}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Context <span className="text-white/20 normal-case">(optional)</span></label>
                <Textarea
                  placeholder="e.g. 200-bed hospital, currently using Epic, budget review in Q3..."
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm min-h-[60px] resize-none"
                  data-testid="textarea-context"
                />
              </div>

              <Button
                className="w-full bg-amber-500/80 hover:bg-amber-500 text-white font-medium transition-all"
                onClick={() => handleObjection.mutate()}
                disabled={!selectedProduct || !objectionText || handleObjection.isPending}
                data-testid="button-handle-objection">
                {handleObjection.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Crafting response...</>
                  : <><Zap className="w-4 h-4 mr-2" />Destroy This Objection</>}
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-3 space-y-3">
            {handleObjection.isPending ? (
              <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <p className="text-sm text-white/50">Analyzing objection and crafting counter-response...</p>
                </div>
                <SkeletonLoader />
              </div>
            ) : activeResult ? (
              <>
                {/* Sentiment Dashboard */}
                <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Sentiment Analysis</p>
                    <div className="flex items-center gap-2">
                      {/* Category Badge */}
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium flex items-center gap-1.5 ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}>
                        <catConfig.icon className="w-3 h-3" />
                        {catConfig.label} Objection
                      </span>
                      {/* Urgency */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize ${URGENCY_COLORS[activeResult.urgencyLevel] || URGENCY_COLORS["medium"]}`}>
                        {activeResult.urgencyLevel} urgency
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    {/* Hostility vs Curiosity meter */}
                    <div className="sm:col-span-2 space-y-4">
                      <SentimentMeter
                        label="Hostility vs Curiosity"
                        value={activeResult.sentiment?.hostility || 40}
                        low="Curious"
                        high="Hostile"
                      />
                      {/* Recommended tone */}
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Recommended Tone</p>
                        <span className={`text-[11px] px-3 py-1 rounded-full border font-medium ${TONE_COLORS[activeResult.sentiment?.recommendedTone] || TONE_COLORS["Empathetic"]}`}>
                          {activeResult.sentiment?.recommendedTone || "Empathetic"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 flex flex-row sm:flex-col items-center justify-center gap-6 sm:gap-3">
                      <BuyingSignalGauge score={activeResult.sentiment?.buyingSignalStrength || 50} />
                      <CircularClosingProb score={activeResult.closingProbability || 50} />
                    </div>
                  </div>

                  {/* Key Insight */}
                  {activeResult.keyInsight && (
                    <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-start gap-2">
                      <Brain className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
                      <p className="text-xs text-white/50 italic">{activeResult.keyInsight}</p>
                    </div>
                  )}
                </div>

                {/* Primary Response */}
                <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" style={{ boxShadow: "0 0 6px #f59e0b" }} />
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Primary Response</p>
                    </div>
                    <Button variant="ghost" size="sm"
                      className="h-7 text-xs text-white/40 hover:text-white/70 gap-1.5"
                      onClick={() => copyToClipboard(activeResult.primaryResponse || activeResult.response || "", "primary")}
                      data-testid="button-copy-primary">
                      {copiedSection === "primary"
                        ? <><Check className="w-3 h-3 text-emerald-400" />Copied</>
                        : <><Copy className="w-3 h-3" />Copy</>}
                    </Button>
                  </div>

                  {/* Objection quote */}
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 mb-4">
                    <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-1">Their Objection</p>
                    <p className="text-sm italic text-white/60">"{objectionText}"</p>
                  </div>

                  <div className="text-sm leading-[1.8] text-white/80 font-light whitespace-pre-wrap">
                    {activeResult.primaryResponse || activeResult.response}
                  </div>

                  {activeResult.hasRagContext && (
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-emerald-400">
                      <Brain className="w-3 h-3" />RAG-enhanced with company intelligence
                    </div>
                  )}
                </div>

                {/* Response Strategies */}
                {activeResult.strategies?.length > 0 && (
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">Response Strategies</p>

                    {/* Strategy tabs */}
                    <div className="flex gap-1.5 mb-4 overflow-x-auto tabs-scroll pb-1">
                      {activeResult.strategies.map((s, i) => (
                        <button key={i}
                          onClick={() => setActiveStrategyTab(i)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all ${
                            activeStrategyTab === i
                              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              : "text-white/30 hover:text-white/50 border border-transparent"
                          }`}
                          data-testid={`button-strategy-tab-${i}`}>
                          {s.type}
                        </button>
                      ))}
                    </div>

                    {activeResult.strategies[activeStrategyTab] && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white/80">
                            {activeResult.strategies[activeStrategyTab].headline}
                          </p>
                          <Button variant="ghost" size="sm"
                            className="h-6 text-[10px] text-white/30 hover:text-white/60 gap-1"
                            onClick={() => copyToClipboard(activeResult.strategies[activeStrategyTab].response, `strat-${activeStrategyTab}`)}>
                            {copiedSection === `strat-${activeStrategyTab}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            Copy
                          </Button>
                        </div>
                        <p className="text-sm text-white/60 leading-relaxed">{activeResult.strategies[activeStrategyTab].response}</p>
                        {/* Action buttons — turn this strategy into action */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05]">
                          <Button variant="outline" size="sm"
                            className="h-7 text-[10px] gap-1.5 border-violet-500/20 text-violet-400 hover:bg-violet-500/10 bg-transparent"
                            onClick={() => navigate(`/pitch?context=${encodeURIComponent(`Rebuild pitch using this objection handling strategy: ${activeResult.strategies[activeStrategyTab].type} — ${activeResult.strategies[activeStrategyTab].response}`)}&product=${encodeURIComponent(selectedProduct)}`)}
                          >
                            <Sparkles className="w-3 h-3" />Build Pitch from This
                          </Button>
                          <Button variant="outline" size="sm"
                            className="h-7 text-[10px] gap-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 bg-transparent"
                            onClick={() => navigate(`/atom-leadgen?script=${encodeURIComponent(activeResult.strategies[activeStrategyTab].response)}&product=${encodeURIComponent(selectedProduct)}`)}
                          >
                            <PhoneCall className="w-3 h-3" />Use in Call Script
                          </Button>
                          <Button variant="outline" size="sm"
                            className="h-7 text-[10px] gap-1.5 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 bg-transparent"
                            onClick={() => navigate(`/atom-campaign?brief=${encodeURIComponent(`Objection: ${objectionText}. Counter-strategy: ${activeResult.strategies[activeStrategyTab].response}`)}`)}
                          >
                            <Megaphone className="w-3 h-3" />Use in Campaign
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-Up Questions — clickable to deep-dive */}
                {activeResult.followUpQuestions?.length > 0 && (
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                      <MessageCircle className="w-3 h-3" />Follow-Up Questions <span className="text-violet-400/40">· click to prepare response</span>
                    </p>
                    <div className="space-y-2">
                      {activeResult.followUpQuestions.map((q, i) => (
                        <div key={i}
                          className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-violet-500/[0.06] hover:border-violet-500/20 transition-all cursor-pointer"
                          onClick={() => {
                            // Pre-fill objection with the follow-up question as the new scenario
                            setObjectionText(q);
                            setContext(`Previous objection was: "${objectionText}". The prospect then asked: "${q}". Generate a response that continues the conversation and moves toward closing.`);
                            setTimeout(() => {
                              const btn = document.querySelector('[data-testid="button-destroy-objection"]') as HTMLButtonElement;
                              btn?.click();
                            }, 200);
                          }}>
                          <span className="text-violet-400/50 text-xs shrink-0 font-mono group-hover:text-violet-400">{i + 1}.</span>
                          <p className="text-sm text-white/60 flex-1 group-hover:text-white/85 transition-colors">{q}</p>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm"
                              className="h-5 text-[9px] text-white/40 hover:text-white/70 gap-0.5"
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(q, `fq-${i}`); }}>
                              {copiedSection === `fq-${i}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            </Button>
                            <span className="text-[9px] text-violet-400/50 flex items-center gap-0.5">
                              <ArrowRight className="w-2.5 h-2.5" />Prepare
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Additional tactical follow-ups */}
                    <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium">Tactical Moves</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm"
                          className="h-7 text-[10px] gap-1 border-violet-500/15 text-violet-400/70 hover:bg-violet-500/10 bg-transparent"
                          onClick={() => navigate(`/pitch?context=${encodeURIComponent(`They said: "${objectionText}". Build a pitch that directly addresses this concern and turns it into a reason to buy.`)}&product=${encodeURIComponent(selectedProduct)}`)}
                        >
                          <Sparkles className="w-3 h-3" />Rebuild Pitch Around This
                        </Button>
                        <Button variant="outline" size="sm"
                          className="h-7 text-[10px] gap-1 border-emerald-500/15 text-emerald-400/70 hover:bg-emerald-500/10 bg-transparent"
                          onClick={() => navigate(`/company-intelligence?query=${encodeURIComponent(objectionText)}`)}
                        >
                          <Brain className="w-3 h-3" />Research Their Pain Point
                        </Button>
                        <Button variant="outline" size="sm"
                          className="h-7 text-[10px] gap-1 border-amber-500/15 text-amber-400/70 hover:bg-amber-500/10 bg-transparent"
                          onClick={() => navigate(`/market?query=${encodeURIComponent(objectionText)}`)}
                        >
                          <TrendingUp className="w-3 h-3" />Market Intel on This
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-black/30 backdrop-blur-sm border border-white/[0.05] flex flex-col items-center justify-center py-20 text-white/20">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/15">
                  <Zap className="w-7 h-7 text-amber-500/40" />
                </div>
                <p className="text-sm font-medium text-white/30">Enter an objection to get your counter-response</p>
                <p className="text-xs text-white/15 mt-1">Select product and paste what the prospect said</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
