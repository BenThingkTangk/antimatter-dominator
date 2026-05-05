import { useState, useRef } from "react";
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
  FileText,
  History,
  Loader2,
  Phone,
  Linkedin,
  Copy,
  CheckCircle2,
  Trash2,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Crosshair,
  Ghost,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Lightbulb,
  BookOpen,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "analyzer" | "pipeline" | "playbook" | "history";
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

interface LinguisticCues {
  passiveVoice: number;
  distancingLanguage: number;
  overCertainty: number;
  nonAnswerRatio: number;
  fillerWords: number;
}

interface Playbook {
  move: string;
  tactic: string;
  signal: string;
}

interface AnalysisResult {
  aletheiaTruthScore: number;
  overallRisk: string;
  hedgePct: number;
  evasionPct: number;
  urgency: string;
  dealRisk: string;
  flags: Flag[];
  highlightedPhrases: HighlightedPhrase[];
  linguisticCues: LinguisticCues;
  buyerIntentState: string;
  ghostProbability: number;
  suggestedReplies: string[];
  playbook: Playbook;
  summary: string;
  channel: string;
  analyzedAt: string;
}

interface HistoryEntry {
  id: string;
  text: string;
  channel: ChannelId;
  result: AnalysisResult;
  timestamp: number;
}

interface DealEntry {
  id: string;
  company: string;
  contact: string;
  truthScore: number;
  risk: string;
  intent: string;
  lastAnalyzed: number;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "atom_aletheia_history";
const DEALS_KEY = "atom_aletheia_deals";

const CHANNELS: { id: ChannelId; label: string; icon: any }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "call_transcript", label: "Call Transcript", icon: Mic },
  { id: "sms", label: "SMS / Text", icon: MessageSquare },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
];

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "analyzer", label: "Text Analyzer", icon: Eye },
  { id: "pipeline", label: "Deal Pipeline", icon: BarChart3 },
  { id: "playbook", label: "Playbook", icon: BookOpen },
  { id: "history", label: "History", icon: History },
];

const SAMPLE_EMAIL = `Hi,

Thank you for the proposal. The team believes there is a strong fit. However, due to some internal reprioritization we need to pause the evaluation for now. We would love to revisit in a few months when things settle down. Definitely keeping you top of mind.

Best,
James`;

const SAMPLE_TRANSCRIPT = `Yeah absolutely, we're very interested. The CEO is very bullish on this. It's definitely a top priority for us right now. We just need to circle back after next quarter when things settle down. Our VP of Engineering thinks it's a strong fit but we have some internal reprioritization happening. We'll definitely get back to you soon — no question about it.`;

const SAMPLE_SMS = `Hey, just wanted to check in. We are still very interested but the decision has been pushed to next quarter. Our CEO is very bullish on this and thinks it's a great fit. We will definitely circle back soon.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 50))); } catch {}
}
function loadDeals(): DealEntry[] {
  try { return JSON.parse(localStorage.getItem(DEALS_KEY) || "[]"); } catch { return []; }
}
function saveDeals(d: DealEntry[]) {
  try { localStorage.setItem(DEALS_KEY, JSON.stringify(d)); } catch {}
}
function fmtTime(ts: number): string {
  const h = (Date.now() - ts) / 3.6e6;
  if (h < 1) { const m = Math.floor((Date.now() - ts) / 60000); return m <= 1 ? "just now" : `${m}m ago`; }
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Color helpers
const riskColor = (r: string) => {
  const l = r?.toLowerCase();
  if (l === "high" || l === "ghost" || l === "dead" || l === "at_risk") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (l === "medium" || l === "caution") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
};
const sevColor = (s: string) => s === "high" ? "text-rose-400" : s === "medium" ? "text-amber-400" : "text-emerald-400";
const scoreColor = (n: number) => n >= 70 ? "#1dd1a1" : n >= 40 ? "#fbbf24" : "var(--color-error)";
const intentLabel = (s: string) => (s || "unknown").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const phraseColor = (c: string) => c === "red" ? "bg-rose-500/20 border-rose-500/30" : c === "amber" ? "bg-amber-500/20 border-amber-500/30" : "bg-emerald-500/20 border-emerald-500/30";

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">{children}</span>;
}

// ─── Gauge ───────────────────────────────────────────────────────────────────

function TruthGauge({ score }: { score: number }) {
  const r = 50, c = 2 * Math.PI * r, filled = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="text-[10px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[11px] font-mono uppercase tracking-wider text-white/40">Truth Score</p>
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 font-mono">{label}</span>
        <span className="text-[10px] font-mono tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Text Analyzer Tab ───────────────────────────────────────────────────────

function TextAnalyzerTab() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<ChannelId>("email");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedReply, setCopiedReply] = useState<number | null>(null);
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
      // Save to history
      const entry: HistoryEntry = { id: crypto.randomUUID(), text: text.trim(), channel, result: data, timestamp: Date.now() };
      const hist = loadHistory();
      hist.unshift(entry);
      saveHistory(hist);
      toast({ title: "Analysis Complete", description: `Truth Score: ${data.aletheiaTruthScore}/100 · Risk: ${data.overallRisk}` });
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
    textRef.current?.focus();
  }

  function copyReply(reply: string, idx: number) {
    navigator.clipboard.writeText(reply);
    setCopiedReply(idx);
    setTimeout(() => setCopiedReply(null), 2000);
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Input Area */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        {/* Channel selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <MonoLabel>Channel:</MonoLabel>
          {CHANNELS.map(ch => {
            const Icon = ch.icon;
            const active = channel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setChannel(ch.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${active ? "text-[#a78bfa]" : "text-white/35 hover:text-white/55"}`}
                style={{ background: active ? "rgba(105,106,172,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}` }}
              >
                <Icon size={12} />{ch.label}
              </button>
            );
          })}
        </div>

        {/* Text input */}
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste an email, call transcript, SMS, or LinkedIn message to analyze for truth signals..."
          className="w-full h-40 rounded-lg p-4 text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none resize-y leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          data-testid="textarea-analyze"
        />

        {/* Actions row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MonoLabel>Try sample:</MonoLabel>
            <button onClick={() => loadSample(SAMPLE_EMAIL, "email")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Email</button>
            <button onClick={() => loadSample(SAMPLE_TRANSCRIPT, "call_transcript")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Call Transcript</button>
            <button onClick={() => loadSample(SAMPLE_SMS, "sms")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">SMS</button>
          </div>
          <div className="flex items-center gap-2">
            {text && <button onClick={() => { setText(""); setResult(null); }} className="text-[11px] px-3 py-2 rounded-lg text-white/30 hover:text-white/50 transition-all">Clear</button>}
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || text.trim().length < 10}
              className="gap-2 w-full md:w-auto px-8 py-3 rounded-full font-semibold text-[14px] disabled:opacity-50 transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(93.92deg, #a78bfa -13.51%, #8b5cf6 40.91%, #7c3aed 113.69%)", color: "#fff", boxShadow: "0 0 15px rgba(139,92,246,0.4), inset 0 0 2px rgba(255,255,255,0.3)" }}
              data-testid="button-analyze"
            >
              {isAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              {isAnalyzing ? "Analyzing..." : "Analyze Truth Signals"}
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isAnalyzing && (
        <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.04] to-transparent p-5 flex items-center gap-3 fade-in">
          <div className="relative w-5 h-5 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-violet-400/30" />
            <div className="absolute inset-0 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          </div>
          <span className="text-[13px] text-violet-400/80 font-mono">ATOM Aletheia scanning for deception patterns, hedging, evasion signals...</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5 fade-in">

          {/* Score Header */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-6">
            <div className="flex items-start gap-6 flex-wrap">
              <TruthGauge score={result.aletheiaTruthScore} />
              <div className="flex-1 min-w-[250px] space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] font-mono ${riskColor(result.overallRisk)}`}>Risk: {result.overallRisk}</Badge>
                  <Badge className={`text-[10px] font-mono ${riskColor(result.dealRisk)}`}>Deal: {result.dealRisk}</Badge>
                  <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/25 text-[10px] font-mono">Intent: {intentLabel(result.buyerIntentState)}</Badge>
                  {result.ghostProbability > 40 && (
                    <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/25 text-[10px] font-mono gap-1"><Ghost size={10} />Ghost: {result.ghostProbability}%</Badge>
                  )}
                </div>
                <p className="text-[13px] text-white/60 leading-relaxed">{result.summary}</p>

                {/* Linguistic Cues */}
                {result.linguisticCues && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <MiniBar label="Passive Voice" value={result.linguisticCues.passiveVoice} color="#a2a3e9" />
                    <MiniBar label="Distancing" value={result.linguisticCues.distancingLanguage} color="var(--color-error)" />
                    <MiniBar label="Over-Certainty" value={result.linguisticCues.overCertainty} color="#fbbf24" />
                    <MiniBar label="Non-Answer" value={result.linguisticCues.nonAnswerRatio} color="var(--color-error)" />
                    <MiniBar label="Filler Words" value={result.linguisticCues.fillerWords} color="#a2a3e9" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flags */}
          {result.flags?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <MonoLabel>Deception Flags ({result.flags.length})</MonoLabel>
              </div>
              <div className="space-y-2">
                {result.flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <AlertCircle size={12} className={`mt-0.5 shrink-0 ${sevColor(f.severity)}`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] font-mono ${riskColor(f.severity)}`}>{f.severity}</Badge>
                        <span className="text-[10px] text-white/25 font-mono">{f.type.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[12px] text-white/60">"{f.phrase}"</p>
                      <p className="text-[11px] text-white/35">{f.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlighted Phrases */}
          {result.highlightedPhrases?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-violet-400" />
                <MonoLabel>Key Phrases Detected</MonoLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.highlightedPhrases.map((hp, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg border text-[11px] ${phraseColor(hp.color)}`} title={hp.reason}>
                    "{hp.phrase}" <span className="text-white/25 ml-1">— {hp.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playbook Move + Suggested Replies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Playbook */}
            {result.playbook && (
              <div className="rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.03] to-transparent p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Lightbulb size={14} className="text-violet-400" />
                  <MonoLabel>Recommended Play</MonoLabel>
                </div>
                <div className="space-y-2">
                  <p className="text-[14px] font-semibold text-[#f6f6fd]">{result.playbook.move}</p>
                  <p className="text-[12px] text-white/50"><Target size={10} className="inline mr-1" />{result.playbook.tactic}</p>
                  <p className="text-[11px] text-violet-400/70"><Zap size={10} className="inline mr-1" />{result.playbook.signal}</p>
                </div>
              </div>
            )}

            {/* Suggested Replies */}
            {result.suggestedReplies?.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-emerald-400" />
                  <MonoLabel>Suggested Replies</MonoLabel>
                </div>
                <div className="space-y-2">
                  {result.suggestedReplies.map((reply, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] group">
                      <ChevronRight size={11} className="text-emerald-400/60 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-white/50 flex-1">{reply}</p>
                      <button onClick={() => copyReply(reply, i)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {copiedReply === i ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} className="text-white/20 hover:text-white/50" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deal Pipeline Tab ───────────────────────────────────────────────────────

function DealPipelineTab() {
  const [deals, setDeals] = useState<DealEntry[]>(() => loadDeals());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", contact: "", notes: "" });

  function addDeal() {
    if (!form.company.trim()) return;
    const d: DealEntry = {
      id: crypto.randomUUID(), company: form.company.trim(), contact: form.contact.trim(),
      truthScore: 0, risk: "—", intent: "—", lastAnalyzed: Date.now(), notes: form.notes.trim(),
    };
    const updated = [d, ...deals];
    setDeals(updated);
    saveDeals(updated);
    setForm({ company: "", contact: "", notes: "" });
    setShowForm(false);
  }

  function removeDeal(id: string) {
    const updated = deals.filter(d => d.id !== id);
    setDeals(updated);
    saveDeals(updated);
  }

  // Pull latest scores from history
  const history = loadHistory();
  const dealsWithScores = deals.map(d => {
    const match = history.find(h => h.text.toLowerCase().includes(d.company.toLowerCase()) || h.text.toLowerCase().includes(d.contact.toLowerCase()));
    if (match) return { ...d, truthScore: match.result.aletheiaTruthScore, risk: match.result.overallRisk, intent: match.result.buyerIntentState, lastAnalyzed: match.timestamp };
    return d;
  });

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-400" />
          <MonoLabel>Active Deals ({deals.length})</MonoLabel>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="text-[11px] gap-1 border-white/10 text-white/40 hover:text-white/70 bg-transparent">
          {showForm ? <X size={12} /> : <TrendingUp size={12} />}{showForm ? "Cancel" : "Track Deal"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-violet-500/15 bg-[#111113] p-4 space-y-3 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company name" className="px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Contact name" className="px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <Button onClick={addDeal} disabled={!form.company.trim()} size="sm" className="text-[12px]" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "#fff", boxShadow: "0 0 10px rgba(139,92,246,0.3)" }}>Add to Pipeline</Button>
        </div>
      )}

      {dealsWithScores.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BarChart3 className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No deals tracked yet</p>
          <p className="text-[12px] text-white/20 mt-1">Add deals and analyze their communications to track truth scores over time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dealsWithScores.map(d => (
            <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111113] hover:border-violet-500/15 transition-all group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: `rgba(${d.truthScore >= 70 ? "29,209,161" : d.truthScore >= 40 ? "251,191,36" : "248,113,113"},0.15)`, color: scoreColor(d.truthScore) }}>
                {d.truthScore || "—"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#f6f6fd] truncate">{d.company}</p>
                <div className="flex items-center gap-2">
                  {d.contact && <span className="text-[11px] text-white/35">{d.contact}</span>}
                  {d.risk !== "—" && <Badge className={`text-[9px] font-mono ${riskColor(d.risk)}`}>{d.risk}</Badge>}
                  {d.intent !== "—" && <span className="text-[10px] text-white/20 font-mono">{intentLabel(d.intent)}</span>}
                </div>
              </div>
              <span className="text-[10px] text-white/20 font-mono shrink-0">{fmtTime(d.lastAnalyzed)}</span>
              <button onClick={() => removeDeal(d.id)} className="opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13} className="text-white/20 hover:text-rose-400" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Playbook Tab ────────────────────────────────────────────────────────────

const PLAYBOOK_ENTRIES = [
  { pattern: "Timeline Vagueness", signal: '"Next quarter", "when things settle down", "circle back"', counter: "Pin to a specific date: \"Got it — if I block 15 minutes on March 3rd to revisit, does that work?\" Forces commitment or reveals the stall.", icon: Clock, color: "text-amber-400" },
  { pattern: "Authority Deflection", signal: '"Need to check with my boss", "CEO has to approve", "not my decision"', counter: "Go multi-threaded: \"Totally understand — would it be helpful if I sent a one-pager directly to [name]? Sometimes that speeds things up.\"", icon: Shield, color: "text-rose-400" },
  { pattern: "Over-Enthusiasm", signal: '"Absolutely love it", "definitely a strong fit", "100% on board"', counter: "Test sincerity with a commitment ask: \"Great to hear! Should we get the contract over today so you can start next week?\" Watch for backpedaling.", icon: Flame, color: "text-violet-400" },
  { pattern: "Budget Fabrication", signal: '"Budget is tight right now", "need to find the budget", "not in this cycle"', counter: "Isolate the objection: \"If budget weren't a factor, would this be a priority for your team right now?\" Separates real budget issues from polite no's.", icon: BarChart3, color: "text-cyan-400" },
  { pattern: "Ghosting Signals", signal: 'Decreasing response times, shorter messages, delegating to junior contacts', counter: "Pattern interrupt: Send something unexpected — a relevant article, a competitor insight, or a direct \"Is this dead?\" text. Honesty resets the dynamic.", icon: Ghost, color: "text-rose-400" },
  { pattern: "Competitive Leverage", signal: '"We are also looking at [competitor]", "your pricing is higher"', counter: "Don't discount immediately. Instead: \"What specifically about [competitor] appeals to you?\" Understand the real criteria before negotiating.", icon: Target, color: "text-emerald-400" },
  { pattern: "Internal Reprioritization", signal: '"Restructuring", "new leadership", "strategic shift"', counter: "Validate and reframe: \"That makes sense. When orgs go through that, [specific pain] usually gets worse. Is that something you're seeing?\" Ties your solution to their chaos.", icon: Brain, color: "text-violet-400" },
  { pattern: "Fake Objection", signal: 'Surface-level concerns that shift each conversation', counter: "Call it out gently: \"I've noticed the concern has shifted a few times. Help me understand — what's the real blocker here?\" Prospects respect directness.", icon: AlertTriangle, color: "text-amber-400" },
];

function PlaybookTab() {
  return (
    <div className="space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={14} className="text-violet-400" />
        <MonoLabel>Deception Pattern Playbook</MonoLabel>
        <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-mono ml-auto">{PLAYBOOK_ENTRIES.length} patterns</Badge>
      </div>
      {PLAYBOOK_ENTRIES.map((p, i) => {
        const Icon = p.icon;
        return (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#111113] p-4 space-y-3 hover:border-violet-500/10 transition-all">
            <div className="flex items-center gap-2">
              <Icon size={14} className={p.color} />
              <span className="text-[14px] font-semibold text-[#f6f6fd]">{p.pattern}</span>
            </div>
            <div className="pl-5 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={10} className="text-amber-400/50 mt-0.5 shrink-0" />
                <p className="text-[12px] text-white/40">{p.signal}</p>
              </div>
              <div className="flex items-start gap-2">
                <Zap size={10} className="text-emerald-400/50 mt-0.5 shrink-0" />
                <p className="text-[12px] text-white/55">{p.counter}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ onRestore }: { onRestore: (text: string, channel: ChannelId) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  function remove(id: string) {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }

  return (
    <div className="space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <History size={14} className="text-violet-400" />
        <MonoLabel>Analysis History ({history.length})</MonoLabel>
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <History className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No analyses yet</p>
          <p className="text-[12px] text-white/20 mt-1">Analyze text in the Text Analyzer tab to build your history.</p>
        </div>
      ) : (
        history.map(h => (
          <div key={h.id} className="rounded-xl border border-white/[0.06] bg-[#111113] p-4 hover:border-violet-500/10 transition-all group">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ background: `rgba(${h.result.aletheiaTruthScore >= 70 ? "29,209,161" : h.result.aletheiaTruthScore >= 40 ? "251,191,36" : "248,113,113"},0.15)`, color: scoreColor(h.result.aletheiaTruthScore) }}>
                {h.result.aletheiaTruthScore}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] font-mono ${riskColor(h.result.overallRisk)}`}>{h.result.overallRisk}</Badge>
                  <Badge className="bg-white/5 text-white/30 border-white/10 text-[9px] font-mono">{h.channel}</Badge>
                  <span className="text-[10px] text-white/20 font-mono">{fmtTime(h.timestamp)}</span>
                </div>
                <p className="text-[12px] text-white/40 line-clamp-2">{h.text.slice(0, 150)}...</p>
                <p className="text-[11px] text-white/25">{h.result.summary?.slice(0, 100)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onRestore(h.text, h.channel)} className="p-1.5 rounded hover:bg-white/5" title="Re-analyze"><ArrowRight size={12} className="text-white/30 hover:text-violet-400" /></button>
                <button onClick={() => remove(h.id)} className="p-1.5 rounded hover:bg-white/5" title="Delete"><Trash2 size={12} className="text-white/30 hover:text-rose-400" /></button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AtomAletheia() {
  const [activeTab, setActiveTab] = useState<TabId>("analyzer");
  const [restoreText, setRestoreText] = useState("");
  const [restoreChannel, setRestoreChannel] = useState<ChannelId>("email");

  function handleRestore(text: string, channel: ChannelId) {
    setRestoreText(text);
    setRestoreChannel(channel);
    setActiveTab("analyzer");
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease-out both; }
      `}</style>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <Eye size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f6f6fd] leading-tight">ATOM Aletheia</h1>
            <p className="text-[12px] text-white/30">Truth & Intent Engine</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 tabs-scroll">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${active ? "text-[#a78bfa]" : "text-white/35 hover:text-white/55"}`}
                style={{ background: active ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${active ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)"}` }}
                data-testid={`tab-${t.id}`}
              >
                <Icon size={14} />{t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "analyzer" && <TextAnalyzerTab />}
          {activeTab === "pipeline" && <DealPipelineTab />}
          {activeTab === "playbook" && <PlaybookTab />}
          {activeTab === "history" && <HistoryTab onRestore={handleRestore} />}
        </div>
      </div>
    </div>
  );
}
