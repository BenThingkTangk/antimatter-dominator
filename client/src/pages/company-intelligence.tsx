import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Search,
  Loader2,
  Copy,
  CheckCircle2,
  Circle,
  Sparkles,
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface LoadedCompany {
  company: string;
  status: string;
  chunk_count?: number;
  loaded_at?: string;
}

// ─── Loading Steps ─────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { label: "Gathering firmographics & company profile", icon: Building2 },
  { label: "Building objection playbook", icon: Shield },
  { label: "Analyzing market intent signals", icon: TrendingUp },
  { label: "Generating call scripts & playbooks", icon: Phone },
  { label: "Indexing into vector database", icon: Database },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "pitch", label: "Pitch Generator", icon: Sparkles },
  { id: "objection", label: "Objection Handler", icon: Shield },
  { id: "intent", label: "Market Intent", icon: TrendingUp },
  { id: "prospects", label: "Prospects & Signals", icon: Users },
  { id: "playbook", label: "Call Playbook", icon: BookOpen },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        copied
          ? "border-green-500/40 bg-green-500/10 text-green-400"
          : "border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] text-[rgba(246,246,253,0.4)] hover:text-[rgba(246,246,253,0.7)] hover:border-[rgba(246,246,253,0.15)]"
      } ${className}`}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  title,
  content,
  meta,
  children,
}: {
  title?: string;
  content?: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-5 space-y-3">
      {title && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-[rgba(246,246,253,0.4)] uppercase tracking-wider">{title}</p>
          {content && <CopyButton text={content} />}
        </div>
      )}
      {content && (
        <div className="text-sm leading-relaxed text-[rgba(246,246,253,0.85)] whitespace-pre-wrap">{content}</div>
      )}
      {meta && <p className="text-xs text-[rgba(246,246,253,0.3)]">{meta}</p>}
      {children}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[rgba(246,246,253,0.25)] space-y-3">
      <Icon className="w-10 h-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Tab: Pitch Generator ─────────────────────────────────────────────────────

function PitchTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [prospectTitle, setProspectTitle] = useState("");
  const [productToPitch, setProductToPitch] = useState("");
  const [dealStage, setDealStage] = useState("Discovery");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pitch?: string; chunk_count?: number; confidence?: number } | null>(null);

  const generate = async () => {
    if (!prospectTitle.trim()) {
      toast({ title: "Enter a prospect title", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag?action=pitch", {
        company_name: activeCompany,
        prospect_title: prospectTitle,
        product_to_pitch: productToPitch || undefined,
        deal_stage: dealStage,
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to generate pitch", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)]">
            Prospect Title
          </label>
          <Input
            placeholder="e.g. VP of Infrastructure"
            value={prospectTitle}
            onChange={(e) => setProspectTitle(e.target.value)}
            className="bg-[rgba(246,246,253,0.03)] border-[rgba(246,246,253,0.08)] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)]">
            Product to Pitch (optional)
          </label>
          <Input
            placeholder="e.g. CX Cloud"
            value={productToPitch}
            onChange={(e) => setProductToPitch(e.target.value)}
            className="bg-[rgba(246,246,253,0.03)] border-[rgba(246,246,253,0.08)] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)]">
            Deal Stage
          </label>
          <Select value={dealStage} onValueChange={setDealStage}>
            <SelectTrigger className="bg-[rgba(246,246,253,0.03)] border-[rgba(246,246,253,0.08)] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Discovery">Discovery</SelectItem>
              <SelectItem value="Evaluation">Evaluation</SelectItem>
              <SelectItem value="Close">Close</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <button
        onClick={generate}
        disabled={loading || !prospectTitle.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
          boxShadow: loading || !prospectTitle.trim() ? "none" : "0 0 20px rgba(105,106,172,0.35)",
        }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Generating..." : "Generate Pitch"}
      </button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-[rgba(246,246,253,0.4)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#a2a3e9]" />
          <p className="text-sm">Retrieving intelligence and crafting your pitch...</p>
        </div>
      )}

      {result && !loading && (
        <ResultCard
          title={`RAG Pitch — ${prospectTitle} at ${activeCompany}`}
          content={result.pitch}
          meta={
            result.chunk_count !== undefined
              ? `Based on ${result.chunk_count} intelligence chunks${result.confidence !== undefined ? ` · Confidence ${Math.round((result.confidence ?? 0) * 100)}%` : ""}`
              : undefined
          }
        />
      )}

      {!result && !loading && (
        <EmptyState icon={Sparkles} message="Fill in the prospect title and click Generate Pitch" />
      )}
    </div>
  );
}

// ─── Tab: Objection Handler ───────────────────────────────────────────────────

function ObjectionTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [objectionText, setObjectionText] = useState("");
  const [productToPitch, setProductToPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    acknowledge?: string;
    reframe?: string;
    prove?: string;
    full_response?: string;
  } | null>(null);

  const handle = async () => {
    if (!objectionText.trim()) {
      toast({ title: "Enter the objection text", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag?action=objection", {
        company_name: activeCompany,
        objection_text: objectionText,
        product_to_pitch: productToPitch || undefined,
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to handle objection", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasStructured = result && (result.acknowledge || result.reframe || result.prove);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)]">
            The Objection
          </label>
          <Textarea
            placeholder="Enter the exact objection the prospect just said..."
            value={objectionText}
            onChange={(e) => setObjectionText(e.target.value)}
            rows={3}
            className="bg-[rgba(246,246,253,0.03)] border-[rgba(246,246,253,0.08)] text-sm resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)]">
            Product (optional)
          </label>
          <Input
            placeholder="e.g. Avocor AVW-6555"
            value={productToPitch}
            onChange={(e) => setProductToPitch(e.target.value)}
            className="bg-[rgba(246,246,253,0.03)] border-[rgba(246,246,253,0.08)] text-sm"
          />
        </div>
      </div>

      <button
        onClick={handle}
        disabled={loading || !objectionText.trim()}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
          boxShadow: loading || !objectionText.trim() ? "none" : "0 0 20px rgba(105,106,172,0.35)",
        }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        {loading ? "Handling..." : "Handle Objection"}
      </button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-[rgba(246,246,253,0.4)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#a2a3e9]" />
          <p className="text-sm">Building your counter-argument from company intel...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {hasStructured ? (
            <>
              {result.acknowledge && (
                <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Acknowledge</p>
                    <CopyButton text={result.acknowledge} />
                  </div>
                  <p className="text-sm leading-relaxed text-[rgba(246,246,253,0.85)]">{result.acknowledge}</p>
                </div>
              )}
              {result.reframe && (
                <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#a2a3e9]">Reframe</p>
                    <CopyButton text={result.reframe} />
                  </div>
                  <p className="text-sm leading-relaxed text-[rgba(246,246,253,0.85)]">{result.reframe}</p>
                </div>
              )}
              {result.prove && (
                <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Prove</p>
                    <CopyButton text={result.prove} />
                  </div>
                  <p className="text-sm leading-relaxed text-[rgba(246,246,253,0.85)]">{result.prove}</p>
                </div>
              )}
            </>
          ) : (
            <ResultCard
              title="Counter-Argument"
              content={result.full_response}
            />
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={Shield} message="Enter the objection and click Handle Objection" />
      )}
    </div>
  );
}

// ─── Tab: Market Intent ───────────────────────────────────────────────────────

function IntentGauge({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? "#4ade80" : pct >= 40 ? "#a2a3e9" : "#f87171";
  const label = pct >= 70 ? "High Intent" : pct >= 40 ? "Moderate Intent" : "Low Intent";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(246,246,253,0.05)" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(pct / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{pct}</span>
          <span className="text-[10px] text-[rgba(246,246,253,0.4)]">/ 100</span>
        </div>
      </div>
      <Badge
        className="text-xs font-medium"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {label}
      </Badge>
    </div>
  );
}

function IntentTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    intent_score?: number;
    signals?: string[];
    recommended_action?: string;
    context?: string;
  } | null>(null);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag?action=context", {
        company_name: activeCompany,
        module: "market_intent",
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to analyze intent", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={analyze}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
        style={{
          background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
          boxShadow: loading ? "none" : "0 0 20px rgba(105,106,172,0.35)",
        }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
        {loading ? "Analyzing..." : "Analyze Intent Signals"}
      </button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-[rgba(246,246,253,0.4)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#a2a3e9]" />
          <p className="text-sm">Scanning for buying signals from vectorized intel...</p>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)] mb-4">
              Intent Score
            </p>
            <IntentGauge score={result.intent_score ?? 0} />
          </div>

          <div className="md:col-span-2 space-y-3">
            {result.signals && result.signals.length > 0 && (
              <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)] mb-3">
                  Top Signals
                </p>
                <ul className="space-y-2">
                  {result.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[rgba(246,246,253,0.7)]">
                      <ChevronRight className="w-4 h-4 text-[#a2a3e9] shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommended_action && (
              <div className="rounded-xl border border-[#696aac]/30 bg-[#696aac]/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-[#a2a3e9] mb-2">
                  Recommended Action
                </p>
                <p className="text-sm text-[rgba(246,246,253,0.85)]">{result.recommended_action}</p>
              </div>
            )}

            {result.context && !result.signals && (
              <ResultCard title="Intelligence Excerpt" content={result.context} />
            )}
          </div>
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={TrendingUp} message="Click Analyze Intent Signals to scan the intelligence" />
      )}
    </div>
  );
}

// ─── Tab: Prospects & Signals ─────────────────────────────────────────────────

function ProspectsTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    company_size?: string;
    industry?: string;
    tech_stack?: string[];
    decision_makers?: Array<{ name?: string; title?: string; signal?: string }>;
    context?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag?action=context", {
        company_name: activeCompany,
        module: "prospects",
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to load prospects", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany]);

  const prospectUrl = `#/prospects`;

  return (
    <div className="space-y-5">
      {loading && (
        <div className="flex items-center gap-3 py-8 text-[rgba(246,246,253,0.4)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#a2a3e9]" />
          <p className="text-sm">Loading firmographic & prospect intelligence...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {(result.company_size || result.industry) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {result.company_size && (
                <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                  <p className="text-xs text-[rgba(246,246,253,0.4)] uppercase tracking-wider mb-1">Company Size</p>
                  <p className="text-sm font-medium text-[rgba(246,246,253,0.85)]">{result.company_size}</p>
                </div>
              )}
              {result.industry && (
                <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
                  <p className="text-xs text-[rgba(246,246,253,0.4)] uppercase tracking-wider mb-1">Industry</p>
                  <p className="text-sm font-medium text-[rgba(246,246,253,0.85)]">{result.industry}</p>
                </div>
              )}
            </div>
          )}

          {result.tech_stack && result.tech_stack.length > 0 && (
            <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)] mb-3">
                Tech Stack
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.tech_stack.map((tech, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs border-[rgba(246,246,253,0.1)] text-[rgba(246,246,253,0.6)]"
                  >
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.decision_makers && result.decision_makers.length > 0 && (
            <div className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.4)] mb-3">
                Key Decision Makers
              </p>
              <div className="space-y-2.5">
                {result.decision_makers.map((dm, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-[rgba(246,246,253,0.05)] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-[#696aac]/15 border border-[#696aac]/20 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-[#a2a3e9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {dm.name && <p className="text-sm font-medium text-[rgba(246,246,253,0.85)]">{dm.name}</p>}
                      {dm.title && <p className="text-xs text-[rgba(246,246,253,0.5)]">{dm.title}</p>}
                      {dm.signal && <p className="text-xs text-[#a2a3e9] mt-1">{dm.signal}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.context && !result.decision_makers && (
            <ResultCard title="Firmographic Intelligence" content={result.context} />
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={Users} message="Firmographic intelligence will appear here" />
      )}

      <div className="pt-2">
        <a href={prospectUrl}>
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
              boxShadow: "0 0 20px rgba(105,106,172,0.35)",
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Build Prospect List in Prospect Engine
          </button>
        </a>
      </div>
    </div>
  );
}

// ─── Tab: Call Playbook ───────────────────────────────────────────────────────

interface PlaybookSection {
  key: string;
  label: string;
  icon: React.ElementType;
  content: string;
}

function PlaybookTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    opener?: string;
    pitch_30sec?: string;
    discovery_questions?: string;
    meeting_close?: string;
    voicemail?: string;
    followup_email?: string;
    linkedin_message?: string;
    full_playbook?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag?action=context", {
        company_name: activeCompany,
        module: "call_playbook",
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to load playbook", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const campaignUrl = `#/atom-campaign`;

  const sections: PlaybookSection[] = result
    ? [
        { key: "opener", label: "Opener", icon: Phone, content: result.opener || "" },
        { key: "pitch_30sec", label: "30-Second Pitch", icon: Zap, content: result.pitch_30sec || "" },
        { key: "discovery_questions", label: "Discovery Questions", icon: Search, content: result.discovery_questions || "" },
        { key: "meeting_close", label: "Meeting Close", icon: CheckCircle2, content: result.meeting_close || "" },
        { key: "voicemail", label: "Voicemail Script", icon: Phone, content: result.voicemail || "" },
        { key: "followup_email", label: "Follow-Up Email", icon: Mail, content: result.followup_email || "" },
        { key: "linkedin_message", label: "LinkedIn Message", icon: Linkedin, content: result.linkedin_message || "" },
      ].filter((s) => s.content)
    : [];

  return (
    <div className="space-y-5">
      <button
        onClick={load}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
        style={{
          background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
          boxShadow: loading ? "none" : "0 0 20px rgba(105,106,172,0.35)",
        }}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
        {loading ? "Loading..." : "Load Call Playbook"}
      </button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-[rgba(246,246,253,0.4)]">
          <Loader2 className="w-5 h-5 animate-spin text-[#a2a3e9]" />
          <p className="text-sm">Retrieving complete call playbook from intelligence...</p>
        </div>
      )}

      {result && !loading && (
        <>
          {sections.length > 0 ? (
            <div className="space-y-3">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.key}
                    className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#a2a3e9]" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-[rgba(246,246,253,0.5)]">
                          {section.label}
                        </p>
                      </div>
                      <CopyButton text={section.content} />
                    </div>
                    <p className="text-sm leading-relaxed text-[rgba(246,246,253,0.8)] whitespace-pre-wrap">
                      {section.content}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : result.full_playbook ? (
            <ResultCard title="Full Call Playbook" content={result.full_playbook} />
          ) : (
            <EmptyState icon={BookOpen} message="No playbook sections returned" />
          )}

          <div className="pt-2">
            <a href={campaignUrl}>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
                  boxShadow: "0 0 20px rgba(105,106,172,0.35)",
                }}
              >
                <Zap className="w-4 h-4" />
                Start Campaign with ATOM
              </button>
            </a>
          </div>
        </>
      )}

      {!result && !loading && (
        <EmptyState icon={BookOpen} message="Click Load Call Playbook to retrieve the full script" />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyIntelligence() {
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState("");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeCompany, setActiveCompany] = useState("");
  const [activeTab, setActiveTab] = useState("pitch");
  const [loadedCompanies, setLoadedCompanies] = useState<LoadedCompany[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch loaded companies ─────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await apiGet("/api/rag?action=companies");
      if (Array.isArray(data)) setLoadedCompanies(data);
      else if (data.companies) setLoadedCompanies(data.companies);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ── Poll status ────────────────────────────────────────────────────────────

  const startPolling = useCallback(
    (company: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const data = await apiGet(`/api/rag?action=status&company=${encodeURIComponent(company)}`);
          if (data.status === "ready") {
            clearInterval(pollRef.current!);
            if (stepRef.current) clearInterval(stepRef.current);
            setLoadStatus("ready");
            setActiveCompany(company);
            fetchCompanies();
            toast({
              title: "Intelligence loaded",
              description: `${company} is ready — 24h cache active`,
            });
          } else if (data.status === "error") {
            clearInterval(pollRef.current!);
            if (stepRef.current) clearInterval(stepRef.current);
            setLoadStatus("error");
            toast({ title: "Load failed", description: data.message || "Unknown error", variant: "destructive" });
          }
        } catch {
          // keep polling
        }
      }, 3000);
    },
    [fetchCompanies, toast]
  );

  const stopIntervals = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (stepRef.current) clearInterval(stepRef.current);
  }, []);

  useEffect(() => () => stopIntervals(), [stopIntervals]);

  // ── Load company ───────────────────────────────────────────────────────────

  const loadIntelligence = async () => {
    const name = companyName.trim();
    if (!name) {
      toast({ title: "Enter a company name", variant: "destructive" });
      return;
    }

    stopIntervals();
    setLoadStatus("loading");
    setLoadingStep(0);

    // Animate through steps
    let step = 0;
    stepRef.current = setInterval(() => {
      step++;
      if (step < LOADING_STEPS.length) {
        setLoadingStep(step);
      } else {
        clearInterval(stepRef.current!);
      }
    }, 6000);

    try {
      await apiPost("/api/rag?action=load", {
        company_name: name,
        force_refresh: false,
      });
      // POST responds when queued; now poll for status
      startPolling(name);
    } catch (e: unknown) {
      stopIntervals();
      setLoadStatus("error");
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to start load", description: msg, variant: "destructive" });
    }
  };

  const selectCompany = (company: LoadedCompany) => {
    if (company.status === "ready") {
      setActiveCompany(company.company);
      setLoadStatus("ready");
      setCompanyName(company.company);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-full space-y-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(133,135,227,0.15) 0%, rgba(76,77,172,0.15) 100%)",
            border: "1px solid rgba(105,106,172,0.25)",
            boxShadow: "0 0 24px rgba(105,106,172,0.15)",
          }}
        >
          <Brain className="w-6 h-6 text-[#a2a3e9]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[rgba(246,246,253,0.95)]">
            Company Intelligence Engine
          </h1>
          <p className="text-sm text-[rgba(246,246,253,0.4)] mt-0.5">
            Type any company → instant sales intelligence
          </p>
        </div>
      </div>

      {/* ── Search / Load ────────────────────────────────────────────────────── */}
      <Card
        className="border-0"
        style={{
          background: "rgba(246,246,253,0.03)",
          border: "1px solid rgba(246,246,253,0.08)",
          borderRadius: "16px",
        }}
      >
        <CardContent className="p-6 space-y-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(246,246,253,0.25)]" />
              <input
                type="text"
                placeholder="Enter any company name (Five9, TierPoint, Akamai, your target...)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadStatus !== "loading" && loadIntelligence()}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-[rgba(246,246,253,0.2)] text-[rgba(246,246,253,0.9)]"
                style={{
                  background: "rgba(246,246,253,0.04)",
                  border: "1px solid rgba(246,246,253,0.1)",
                }}
              />
            </div>
            <button
              onClick={loadIntelligence}
              disabled={loadStatus === "loading" || !companyName.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                background:
                  loadStatus === "loading" || !companyName.trim()
                    ? "rgba(105,106,172,0.2)"
                    : "linear-gradient(135deg, #8587e3 0%, #4c4dac 50%, #696aac 100%)",
                boxShadow:
                  loadStatus !== "loading" && companyName.trim()
                    ? "0 0 24px rgba(105,106,172,0.4)"
                    : "none",
              }}
            >
              {loadStatus === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {loadStatus === "loading" ? "Loading..." : "Load Intelligence"}
            </button>
          </div>

          {/* Loading Progress */}
          {loadStatus === "loading" && (
            <div className="space-y-2.5 pt-2">
              {LOADING_STEPS.map((step, idx) => {
                const done = idx < loadingStep;
                const active = idx === loadingStep;
                const Icon = step.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 transition-all"
                    style={{ opacity: done ? 0.5 : active ? 1 : 0.25 }}
                  >
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : active ? (
                        <div className="w-2 h-2 rounded-full bg-[#a2a3e9] animate-pulse" />
                      ) : (
                        <Circle className="w-4 h-4 text-[rgba(246,246,253,0.2)]" />
                      )}
                    </div>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        done ? "text-green-400" : active ? "text-[#a2a3e9]" : "text-[rgba(246,246,253,0.2)]"
                      }`}
                    />
                    <p
                      className={`text-sm ${
                        done
                          ? "text-green-400 line-through"
                          : active
                          ? "text-[rgba(246,246,253,0.9)] font-medium"
                          : "text-[rgba(246,246,253,0.3)]"
                      }`}
                    >
                      {step.label}
                    </p>
                    {active && (
                      <div className="flex gap-1 ml-auto">
                        {[0, 1, 2].map((d) => (
                          <div
                            key={d}
                            className="w-1 h-1 rounded-full bg-[#a2a3e9]"
                            style={{
                              animation: "pulse 1.2s ease-in-out infinite",
                              animationDelay: `${d * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Success State */}
          {loadStatus === "ready" && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(74,222,128,0.07)",
                border: "1px solid rgba(74,222,128,0.2)",
              }}
            >
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                ✓ Intelligence loaded — 24h cache active
              </p>
              <Badge
                className="ml-auto text-xs"
                style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}
              >
                {activeCompany}
              </Badge>
            </div>
          )}

          {/* Error State */}
          {loadStatus === "error" && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(248,113,113,0.07)",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">Failed to load intelligence. Try again.</p>
            </div>
          )}

          {/* Previously Loaded Chips */}
          {loadedCompanies.length > 0 && loadStatus !== "loading" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <p className="text-xs text-[rgba(246,246,253,0.3)] w-full uppercase tracking-wider">
                Previously loaded
              </p>
              {loadedCompanies.map((c) => (
                <button
                  key={c.company}
                  onClick={() => selectCompany(c)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background:
                      activeCompany === c.company
                        ? "rgba(105,106,172,0.15)"
                        : "rgba(246,246,253,0.04)",
                    border:
                      activeCompany === c.company
                        ? "1px solid rgba(105,106,172,0.4)"
                        : "1px solid rgba(246,246,253,0.08)",
                    color:
                      activeCompany === c.company
                        ? "#a2a3e9"
                        : "rgba(246,246,253,0.5)",
                    boxShadow:
                      c.status === "ready" && activeCompany === c.company
                        ? "0 0 12px rgba(105,106,172,0.2)"
                        : "none",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: c.status === "ready" ? "#4ade80" : "#f87171",
                      boxShadow: c.status === "ready" ? "0 0 6px #4ade80" : "none",
                    }}
                  />
                  {c.company}
                  {c.chunk_count !== undefined && (
                    <span className="text-[rgba(246,246,253,0.3)]">{c.chunk_count} chunks</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5-Tab Dashboard ──────────────────────────────────────────────────── */}
      {loadStatus === "ready" && activeCompany && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(246,246,253,0.02)",
            border: "1px solid rgba(246,246,253,0.08)",
          }}
        >
          {/* Tab bar */}
          <div
            className="flex overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(246,246,253,0.08)" }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-all shrink-0"
                  style={{
                    color: isActive ? "#a2a3e9" : "rgba(246,246,253,0.35)",
                    borderBottom: isActive ? "2px solid #696aac" : "2px solid transparent",
                    background: isActive ? "rgba(105,106,172,0.05)" : "transparent",
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === "pitch" && <PitchTab activeCompany={activeCompany} />}
            {activeTab === "objection" && <ObjectionTab activeCompany={activeCompany} />}
            {activeTab === "intent" && <IntentTab activeCompany={activeCompany} />}
            {activeTab === "prospects" && <ProspectsTab activeCompany={activeCompany} />}
            {activeTab === "playbook" && <PlaybookTab activeCompany={activeCompany} />}
          </div>
        </div>
      )}

      {/* ── Placeholder when no company loaded ───────────────────────────────── */}
      {loadStatus === "idle" && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 space-y-3"
          style={{
            background: "rgba(246,246,253,0.02)",
            border: "1px solid rgba(246,246,253,0.05)",
          }}
        >
          <Brain className="w-12 h-12 text-[rgba(246,246,253,0.1)]" />
          <p className="text-sm text-[rgba(246,246,253,0.25)]">
            Enter a company name above to begin
          </p>
          <p className="text-xs text-[rgba(246,246,253,0.15)]">
            Pitch · Objections · Intent · Prospects · Playbook — all from one search
          </p>
        </div>
      )}

      {/* ── Recently Loaded Grid (bottom) ────────────────────────────────────── */}
      {loadedCompanies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[rgba(246,246,253,0.3)]">
            Recently Loaded Companies
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loadedCompanies.map((c) => (
              <button
                key={c.company}
                onClick={() => selectCompany(c)}
                className="flex flex-col gap-2.5 p-4 rounded-xl text-left transition-all group"
                style={{
                  background:
                    activeCompany === c.company
                      ? "rgba(105,106,172,0.1)"
                      : "rgba(246,246,253,0.03)",
                  border:
                    activeCompany === c.company
                      ? "1px solid rgba(105,106,172,0.3)"
                      : "1px solid rgba(246,246,253,0.07)",
                  boxShadow:
                    c.status === "ready" && activeCompany === c.company
                      ? "0 0 20px rgba(105,106,172,0.15)"
                      : "none",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-[#a2a3e9] shrink-0" />
                    <span className="text-sm font-medium text-[rgba(246,246,253,0.85)] truncate">
                      {c.company}
                    </span>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                    style={{
                      background:
                        c.status === "ready"
                          ? "rgba(74,222,128,0.1)"
                          : "rgba(248,113,113,0.1)",
                      color: c.status === "ready" ? "#4ade80" : "#f87171",
                      border: `1px solid ${c.status === "ready" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
                    }}
                  >
                    {c.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-[rgba(246,246,253,0.3)]">
                  {c.chunk_count !== undefined && (
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {c.chunk_count} chunks
                    </span>
                  )}
                  {c.loaded_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(c.loaded_at)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
