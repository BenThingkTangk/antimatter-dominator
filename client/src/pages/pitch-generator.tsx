import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, usePitches } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Loader2, Copy, Sparkles, History, Mail, Phone,
  Presentation, FileText, Plus, Trash2, ChevronDown, ChevronUp,
  RefreshCw, ArrowRight, Target, Zap, Brain, MessageCircle, Check,
  BarChart3, AlertCircle
} from "lucide-react";
import type { Product } from "@shared/schema";
import { useLocation } from "wouter";

// ─── Types ─────────────────────────────────────────────────────────────────

interface EmotionScores {
  confidence: number;
  urgency: number;
  empathy: number;
  authority: number;
  enthusiasm: number;
}

interface PitchAlternative {
  type: string;
  text: string;
}

interface PitchResult {
  mainPitch: string;
  powerPhrases: string[];
  alternatives: PitchAlternative[];
  emotions: EmotionScores;
  confidenceScore: number;
  confidenceReasoning: string;
  detectedObjections: string[];
  suggestedFollowUp: string;
  category: string;
  product: string;
  persona: string;
  tone: string;
  content?: string;
  hasRagContext?: boolean;
}

interface LocalPitchEntry {
  id: string;
  product: string;
  pitchType: string;
  persona: string;
  industry: string;
  tone: string;
  companyName: string;
  result: PitchResult;
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
  { value: "custom", label: "Custom Product" },
];

const PITCH_TYPES = [
  { value: "Cold Call Opening", label: "Cold Call Opening", icon: Phone, desc: "Phone opener that hooks in 10 sec" },
  { value: "Email Intro", label: "Email Intro", icon: Mail, desc: "Cold outreach that gets replies" },
  { value: "LinkedIn DM", label: "LinkedIn DM", icon: MessageCircle, desc: "Social selling message" },
  { value: "Follow-Up", label: "Follow-Up", icon: RefreshCw, desc: "Re-engage a cold prospect" },
  { value: "Demo Setup", label: "Demo Setup", icon: Presentation, desc: "Qualify and book the demo" },
  { value: "Executive Summary", label: "Executive Summary", icon: FileText, desc: "C-suite talking points" },
  { value: "Pain Point Probe", label: "Pain Point Probe", icon: Target, desc: "Discovery questions pitch" },
];

const PERSONAS = [
  "CEO / Founder", "CTO / VP Engineering", "CIO / IT Director", "CISO / Security Director",
  "VP Sales / Revenue", "CFO / Finance Director", "Head of Product", "Director of Operations",
  "Real Estate Broker / Team Lead", "Healthcare Administrator", "Chief Medical Officer",
  "RCM / Billing Manager", "Head of Digital Transformation",
];

const TONES = [
  { value: "Professional", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "Casual", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "Aggressive", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  { value: "Consultative", color: "bg-[#696aac]/20 text-[#a2a3e9] border-[#696aac]/30" },
];

const EMOTION_COLORS: Record<string, { bar: string; text: string }> = {
  confidence: { bar: "bg-[#696aac]", text: "text-[#a2a3e9]" },
  urgency: { bar: "bg-rose-500", text: "text-rose-400" },
  empathy: { bar: "bg-emerald-500", text: "text-emerald-400" },
  authority: { bar: "bg-amber-500", text: "text-amber-400" },
  enthusiasm: { bar: "bg-cyan-500", text: "text-cyan-400" },
};

const STORAGE_KEY = "atom_pitch_history";

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatTs(ts: number): string {
  const diff = Date.now() - ts;
  const h = diff / 3600000;
  if (h < 0.017) return "just now";
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function loadHistory(): LocalPitchEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveHistory(e: LocalPitchEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(e)); } catch {}
}

function highlightPowerPhrases(text: string, phrases: string[]): React.ReactNode {
  if (!phrases || phrases.length === 0) return <span>{text}</span>;

  const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const isPhrase = phrases.some(p => p.toLowerCase() === part.toLowerCase());
        return isPhrase ? (
          <mark key={i} className="bg-[#696aac]/25 text-[#c5c6f0] rounded px-0.5 not-italic font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function CircularGauge({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? "#696aac" : score >= 60 ? "#a3b845" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="text-[9px] text-white/40 uppercase tracking-wider">/ 100</span>
        </div>
      </div>
      {label && <span className="text-[11px] text-white/50 text-center">{label}</span>}
    </div>
  );
}

function EmotionBar({ label, value }: { label: string; value: number }) {
  const colors = EMOTION_COLORS[label.toLowerCase()] || { bar: "bg-white/20", text: "text-white/60" };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[11px] capitalize text-white/60">{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${colors.text}`}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${colors.bar} transition-all duration-1000`}
          style={{ width: `${value}%`, boxShadow: `0 0 6px currentColor` }}
        />
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-28 h-28 rounded-full bg-white/5 shrink-0 mx-auto" />
        <div className="flex-1 space-y-2 pt-2">
          {[80, 60, 90, 45, 70].map((w, i) => (
            <div key={i} className="h-3 rounded bg-white/5" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {[100, 95, 88, 72].map((w, i) => (
          <div key={i} className="h-4 rounded bg-white/5" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function PitchGenerator() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");

  // Form state
  const [selectedProduct, setSelectedProduct] = useState(params.get("product") || "");
  const [pitchType, setPitchType] = useState("Cold Call Opening");
  const [persona, setPersona] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tone, setTone] = useState("Professional");
  const [customContext, setCustomContext] = useState("");

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalPitchEntry[]>([]);
  const [activeResult, setActiveResult] = useState<PitchResult | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => { setLocalHistory(loadHistory()); }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const allProducts = [
    ...PRODUCTS,
    ...products.filter(p => !PRODUCTS.find(sp => sp.value === p.slug)).map(p => ({ value: p.slug, label: p.name })),
  ];

  const generatePitch = useMutation({
    mutationFn: async () => {
      const productLabel = allProducts.find(p => p.value === selectedProduct)?.label || selectedProduct;
      const res = await apiRequest("POST", "/api/pitch/generate", {
        productSlug: selectedProduct,
        product: productLabel,
        pitchType,
        persona,
        industry: industry || undefined,
        company: companyName || undefined,
        tone,
        customContext: customContext || undefined,
      });
      return res.json();
    },
    onSuccess: (data: PitchResult) => {
      setActiveResult(data);

      // Store in global store (legacy compatibility)
      store.addPitch({
        id: Date.now(),
        productId: 0,
        pitchType,
        targetPersona: persona,
        content: data.mainPitch || data.content || "",
        createdAt: new Date().toISOString(),
      });

      // Save to localStorage
      const productLabel = allProducts.find(p => p.value === selectedProduct)?.label || selectedProduct;
      const entry: LocalPitchEntry = {
        id: `${Date.now()}-${Math.random()}`,
        product: productLabel,
        pitchType,
        persona,
        industry,
        tone,
        companyName,
        result: data,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);

      toast({ title: "Pitch generated", description: "Your lethal pitch is ready." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const loadFromHistory = (entry: LocalPitchEntry) => {
    const productObj = allProducts.find(p => p.label === entry.product || p.value === entry.product);
    if (productObj) setSelectedProduct(productObj.value);
    setPitchType(entry.pitchType);
    setPersona(entry.persona);
    setIndustry(entry.industry || "");
    setTone(entry.tone || "Professional");
    setCompanyName(entry.companyName || "");
    setActiveResult(entry.result);
    setShowHistory(false);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  const canGenerate = selectedProduct && persona && !generatePitch.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#696aac]/15 flex items-center justify-center border border-[#696aac]/20">
          <TrendingUp className="w-5 h-5 text-[#a2a3e9]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">Pitch Generator</h1>
          <p className="text-sm text-white/40">AI-powered precision pitching for the Antimatter ecosystem</p>
        </div>
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-white/10 hover:border-[#696aac]/40"
              onClick={() => { setShowHistory(false); setActiveResult(null); }}>
              <Plus className="w-3.5 h-3.5" />New Pitch
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            className={`h-8 text-xs gap-1.5 border-white/10 transition-colors ${showHistory ? "bg-[#696aac]/10 border-[#696aac]/40 text-[#a2a3e9]" : "hover:border-white/20"}`}
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-history"
          >
            <History className="w-3.5 h-3.5" />
            History
            {localHistory.length > 0 && (
              <span className="bg-[#696aac] text-white text-[10px] rounded-full px-1.5 leading-4 py-0">{localHistory.length}</span>
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
              <p className="text-sm">No pitch history yet</p>
            </div>
          ) : (
            <>
              {localHistory.map((entry) => (
                <div key={entry.id}
                  className="rounded-xl bg-black/30 border border-white/[0.07] border-l-2 border-l-[#696aac] overflow-hidden backdrop-blur-sm hover:bg-black/40 transition-colors"
                  style={{ borderLeftColor: "#696aac" }}>
                  <button className="w-full text-left p-4"
                    onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/80 truncate">
                          {entry.pitchType} — {entry.product}
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">{entry.persona} · {formatTs(entry.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {entry.result?.confidenceScore && (
                          <span className="text-[10px] font-semibold text-[#a2a3e9] bg-[#696aac]/10 px-2 py-0.5 rounded-full">
                            {entry.result.confidenceScore}% conf.
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.tone}</Badge>
                        {expandedHistoryId === entry.id
                          ? <ChevronUp className="w-4 h-4 text-white/30" />
                          : <ChevronDown className="w-4 h-4 text-white/30" />}
                      </div>
                    </div>
                    {expandedHistoryId !== entry.id && (
                      <p className="text-xs text-white/30 mt-2 line-clamp-2">
                        {entry.result?.mainPitch?.slice(0, 120)}...
                      </p>
                    )}
                  </button>
                  {expandedHistoryId === entry.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge className="text-[10px] bg-[#696aac]/20 text-[#a2a3e9] border-[#696aac]/30">{entry.product}</Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.pitchType}</Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{entry.persona}</Badge>
                      </div>
                      <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]">
                        {entry.result?.mainPitch}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-white/10 hover:border-[#696aac]/40"
                          onClick={() => loadFromHistory(entry)}>
                          <Plus className="w-3 h-3" />Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-white/40 hover:text-white/70"
                          onClick={() => copyToClipboard(entry.result?.mainPitch || "", entry.id)}>
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
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Configuration</h2>

              {/* Product */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Product</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-product">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Company Name */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Company Name <span className="text-white/20 normal-case">(optional)</span></label>
                <Input
                  placeholder="e.g. Acme Health Systems"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm h-9"
                  data-testid="input-company-name"
                />
              </div>

              {/* Persona */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Target Persona</label>
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger className="bg-white/[0.03] border-white/10 text-sm" data-testid="select-persona">
                    <SelectValue placeholder="Who are you pitching?" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Industry */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Industry Context <span className="text-white/20 normal-case">(optional)</span></label>
                <Input
                  placeholder="e.g. Healthcare, Finance, Real Estate"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm h-9"
                  data-testid="input-industry"
                />
              </div>

              {/* Pitch Type */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Pitch Type</label>
                <div className="space-y-1">
                  {PITCH_TYPES.map(pt => {
                    const Icon = pt.icon;
                    const isActive = pitchType === pt.value;
                    return (
                      <button key={pt.value} onClick={() => setPitchType(pt.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all border ${
                          isActive
                            ? "bg-[#696aac]/10 border-[#696aac]/30 text-white"
                            : "border-transparent hover:bg-white/[0.03] text-white/40 hover:text-white/70"
                        }`}
                        data-testid={`button-pitch-type-${pt.value}`}>
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#a2a3e9]" : ""}`} />
                        <div>
                          <p className="text-xs font-medium">{pt.label}</p>
                          <p className="text-[10px] text-white/25">{pt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Tone</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => setTone(t.value)}
                      className={`text-[11px] px-3 py-1 rounded-full border font-medium transition-all ${
                        tone === t.value ? t.color : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/50"
                      }`}
                      data-testid={`button-tone-${t.value}`}>
                      {t.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Context */}
              <div>
                <label className="text-xs font-medium text-white/40 mb-1.5 block uppercase tracking-wider">Extra Context <span className="text-white/20 normal-case">(optional)</span></label>
                <Textarea
                  placeholder="e.g. They just had a data breach, using legacy Epic system..."
                  value={customContext}
                  onChange={e => setCustomContext(e.target.value)}
                  className="bg-white/[0.03] border-white/10 text-sm min-h-[72px] resize-none"
                  data-testid="textarea-context"
                />
              </div>

              <Button
                className="w-full bg-[#696aac] hover:bg-[#7b7cb8] text-white font-medium transition-all"
                onClick={() => generatePitch.mutate()}
                disabled={!canGenerate}
                data-testid="button-generate-pitch"
              >
                {generatePitch.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                  : <><Sparkles className="w-4 h-4 mr-2" />Generate Pitch</>}
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-3 space-y-3">
            {generatePitch.isPending ? (
              <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Loader2 className="w-4 h-4 animate-spin text-[#a2a3e9]" />
                  <p className="text-sm text-white/50">AI is crafting your precision pitch...</p>
                </div>
                <SkeletonLoader />
              </div>
            ) : activeResult ? (
              <>
                {/* Confidence + Emotion Analysis Row */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Confidence Gauge */}
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">AI Confidence Score</p>
                    <div className="flex items-center gap-4">
                      <CircularGauge score={activeResult.confidenceScore || 72} size={100} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/50 leading-relaxed">
                          {activeResult.confidenceReasoning || "Based on available context and pitch parameters."}
                        </p>
                        {activeResult.hasRagContext && (
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400">
                            <Brain className="w-3 h-3" />RAG-enhanced
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Emotion Analysis */}
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">Emotional Tone</p>
                    <div className="space-y-2">
                      {activeResult.emotions && Object.entries(activeResult.emotions).map(([key, val]) => (
                        <EmotionBar key={key} label={key} value={val as number} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main Pitch Card */}
                <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#696aac]" style={{ boxShadow: "0 0 6px #696aac" }} />
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Generated Pitch</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Badge className="text-[10px] bg-[#696aac]/15 text-[#a2a3e9] border-[#696aac]/25">
                          {activeResult.persona || persona}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                          {activeResult.tone || tone}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm"
                        className="h-7 text-xs text-white/40 hover:text-white/70 gap-1.5"
                        onClick={() => copyToClipboard(activeResult.mainPitch, "main")}
                        data-testid="button-copy-pitch">
                        {copiedSection === "main"
                          ? <><Check className="w-3 h-3 text-emerald-400" />Copied</>
                          : <><Copy className="w-3 h-3" />Copy</>}
                      </Button>
                    </div>
                  </div>

                  {/* Pitch text with highlighted power phrases */}
                  <div className="text-sm leading-[1.8] text-white/80 font-light">
                    {highlightPowerPhrases(activeResult.mainPitch, activeResult.powerPhrases)}
                  </div>

                  {/* Power phrases legend */}
                  {activeResult.powerPhrases?.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/[0.05]">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Power Phrases</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeResult.powerPhrases.map((phrase, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#696aac]/15 text-[#a2a3e9] border border-[#696aac]/20">
                            {phrase}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-white/[0.05]">
                    <Button size="sm"
                      className="text-xs h-7 bg-[#696aac]/20 hover:bg-[#696aac]/30 text-[#a2a3e9] border border-[#696aac]/25 gap-1.5"
                      onClick={() => generatePitch.mutate()}
                      disabled={!canGenerate}
                      data-testid="button-refine">
                      <RefreshCw className="w-3 h-3" />Refine
                    </Button>
                    <Button size="sm"
                      className="text-xs h-7 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 gap-1.5"
                      onClick={() => navigate(`/atom-campaign?pitch=${encodeURIComponent(activeResult.mainPitch.slice(0, 200))}`)}
                      data-testid="button-use-campaign">
                      <ArrowRight className="w-3 h-3" />Use in Campaign
                    </Button>
                  </div>
                </div>

                {/* Alternative Approaches */}
                {activeResult.alternatives?.length > 0 && (
                  <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-5">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-3">Alternative Approaches</p>
                    <div className="space-y-2">
                      {activeResult.alternatives.map((alt, i) => (
                        <div key={i} className="group rounded-lg bg-white/[0.02] border border-white/[0.05] p-3 hover:bg-white/[0.04] hover:border-[#696aac]/20 transition-all">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-[#a2a3e9] uppercase tracking-wider">{alt.type}</span>
                            <Button variant="ghost" size="sm"
                              className="h-6 text-[10px] text-white/20 hover:text-white/60 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(alt.text, `alt-${i}`)}>
                              {copiedSection === `alt-${i}` ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                              Copy
                            </Button>
                          </div>
                          <p className="text-sm text-white/60 leading-relaxed">{alt.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up + Objections Row */}
                <div className="grid grid-cols-2 gap-3">
                  {activeResult.suggestedFollowUp && (
                    <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4">
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                        <MessageCircle className="w-3 h-3" />Suggested Follow-Up
                      </p>
                      <p className="text-xs text-white/60 leading-relaxed italic">"{activeResult.suggestedFollowUp}"</p>
                    </div>
                  )}
                  {activeResult.detectedObjections?.length > 0 && (
                    <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.07] p-4">
                      <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3" />Likely Objections
                      </p>
                      <div className="space-y-1">
                        {activeResult.detectedObjections.map((obj, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400/60 text-[10px] mt-0.5">▸</span>
                            <p className="text-xs text-white/50">{obj}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-black/30 backdrop-blur-sm border border-white/[0.05] flex flex-col items-center justify-center py-20 text-white/20">
                <div className="w-16 h-16 rounded-2xl bg-[#696aac]/10 flex items-center justify-center mb-4 border border-[#696aac]/15">
                  <Sparkles className="w-7 h-7 text-[#696aac]/50" />
                </div>
                <p className="text-sm font-medium text-white/30">Configure your pitch parameters</p>
                <p className="text-xs text-white/15 mt-1">Select product, persona, and type to get started</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
