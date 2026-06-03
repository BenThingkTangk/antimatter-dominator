import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Radar, Building2, Globe, User, Briefcase, Target, Swords, FileText,
  Crosshair, Sparkles, Play, Trash2, FlaskConical, Copy, Download,
  FileJson, FileDown, ExternalLink, ShieldCheck, AlertTriangle, Brain,
  Activity, CheckCircle2, Circle, Loader2, Zap, TrendingUp, Building,
  Rocket, Scale, GitBranch, UserCog, HeartCrack, Globe2, History,
  Mail, MessageSquare, ClipboardList, Phone, Hash, ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// ─── Types (mirror api/_lib/atom-researcher.ts) ─────────────────────────────────

type ResearchMode = "fast_scan" | "pro_dossier" | "deep_research" | "vibranium_war_room";

interface SourceMapEntry {
  index: number;
  url: string;
  title: string;
  domain: string;
  quality: number;
  tier: "primary" | "credible" | "secondary";
}

interface Dossier {
  company: string;
  mode: ResearchMode;
  confidence: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  sourceThin: boolean;
  executiveBrief: string;
  sections: { id: string; title: string; markdown: string }[];
  buyingSignals: { category: string; detected: boolean; detail: string }[];
  sourceMap: SourceMapEntry[];
  generatedAt: string;
}

interface ResearchResponse {
  ok: boolean;
  researchId?: string;
  mode?: ResearchMode;
  dossier?: Dossier;
  rawMarkdown?: string;
  model?: string;
  latencyMs?: number;
  error?: string;
  details?: string;
}

interface FormState {
  companyName: string;
  domain: string;
  contactName: string;
  contactTitle: string;
  linkedinUrl: string;
  salesObjective: string;
  offering: string;
  competitor: string;
  notes: string;
  mode: ResearchMode;
}

interface HistoryItem {
  researchId: string;
  company: string;
  mode: ResearchMode;
  at: string;
  form: FormState;
  response: ResearchResponse;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MODES: { value: ResearchMode; label: string; tagline: string; icon: any; tier: string }[] = [
  { value: "fast_scan", label: "Fast Scan", tagline: "Rapid identity + top signals", icon: Activity, tier: "~30s" },
  { value: "pro_dossier", label: "Pro Dossier", tagline: "Full 12-section sales dossier", icon: FileText, tier: "~60s" },
  { value: "deep_research", label: "Deep Research", tagline: "Multi-angle, high search depth", icon: Brain, tier: "~90s" },
  { value: "vibranium_war_room", label: "Vibranium War Room", tagline: "Maximum-depth pre-call war room", icon: Swords, tier: "~110s" },
];

const STATUS_STAGES = [
  "Initializing ATOM Researcher",
  "Validating target identity",
  "Searching official sources",
  "Reading recent news",
  "Detecting buying signals",
  "Mapping pain points",
  "Building competitive context",
  "Creating call strategy",
  "Verifying citations",
  "Generating Vibranium dossier",
];

const SIGNAL_ICONS: Record<string, any> = {
  "Funding": TrendingUp,
  "Hiring": User,
  "Expansion": Building,
  "Product launch": Rocket,
  "Compliance pressure": Scale,
  "Tech migration": GitBranch,
  "Competitor weakness": Swords,
  "Leadership change": UserCog,
  "Customer pain": HeartCrack,
  "Market event": Globe2,
};

const DOSSIER_TABS = [
  { id: "executive", label: "Executive Brief", match: ["executive"] },
  { id: "company", label: "Company Intel", match: ["company snapshot", "recent develop", "pain point"] },
  { id: "signals", label: "Buying Signals", match: ["buying signal"] },
  { id: "contact", label: "Contact Strategy", match: ["contact", "persona", "call strategy", "outreach"] },
  { id: "battlecard", label: "Competitor Battlecard", match: ["competitive", "strategic fit"] },
  { id: "confidence", label: "Confidence", match: ["confidence"] },
  { id: "sources", label: "Sources", match: ["source map"] },
];

const EMPTY_FORM: FormState = {
  companyName: "", domain: "", contactName: "", contactTitle: "",
  linkedinUrl: "", salesObjective: "", offering: "", competitor: "",
  notes: "", mode: "pro_dossier",
};

// Demo input — Cloudflare Vibranium War Room (exact per build brief).
const DEMO_FORM: FormState = {
  companyName: "Cloudflare",
  domain: "cloudflare.com",
  contactName: "Matthew Prince",
  contactTitle: "Co-founder & CEO",
  linkedinUrl: "https://www.linkedin.com/in/mjprince/",
  salesObjective: "Position ATOM as the edge-native AI voice & deep-research layer for Cloudflare's enterprise GTM motion",
  offering: "ATOM Sales OS — autonomous AI voice agent + Vibranium deep-research intelligence on Akamai/edge inference",
  competitor: "Akamai (edge), incumbent SDR tooling (11x.ai, Bland AI)",
  notes: "Pre-call brief for a strategic partnership conversation. Emphasize edge inference, security posture, and developer-platform fit.",
  mode: "vibranium_war_room",
};

const HISTORY_KEY = "atom_research_dossiers_v1";

// ─── Safe local history (degrades to in-memory if storage blocked) ──────────────

let memoryHistory: HistoryItem[] = [];

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable — fall through to memory */ }
  return memoryHistory;
}

function saveHistory(items: HistoryItem[]) {
  memoryHistory = items;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 25)));
  } catch { /* ignore quota / privacy mode */ }
}

// ─── Minimal markdown renderer (no heavy deps; resolves [n] citation links) ─────

function renderInline(text: string, sources: SourceMapEntry[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Tokenize on bold, links, and [n] citations.
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\[\d+\]|https?:\/\/[^\s)]+)/g;
  let last = 0; let m: RegExpExecArray | null; let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={key++} className="text-[#f6f6fd] font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (/^\[\d+\]$/.test(tok)) {
      const n = parseInt(tok.slice(1, -1), 10);
      const src = sources.find((s) => s.index === n);
      out.push(
        <a key={key++} href={src?.url || "#"} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center align-middle mx-0.5 px-1 rounded text-[10px] font-mono"
          style={{ background: "rgba(34,230,214,0.12)", color: "#22e6d6", border: "1px solid rgba(34,230,214,0.25)" }}>
          {n}
        </a>
      );
    } else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) out.push(<a key={key++} href={lm[2]} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{lm[1]}</a>);
      else out.push(tok);
    } else {
      out.push(<a key={key++} href={tok} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">{tok}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ md, sources }: { md: string; sources: SourceMapEntry[] }) {
  const blocks = md.split("\n");
  const nodes: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = (key: number) => {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={`ul-${key}`} className="space-y-1.5 my-2 pl-1">
        {listBuf.map((li, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-white/70 leading-relaxed">
            <ChevronRight size={13} className="text-cyan-400/50 mt-1 shrink-0" />
            <span>{renderInline(li, sources)}</span>
          </li>
        ))}
      </ul>
    );
    listBuf = [];
  };
  blocks.forEach((line, i) => {
    const t = line.trim();
    if (/^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t)) {
      listBuf.push(t.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
      return;
    }
    flushList(i);
    if (!t) { nodes.push(<div key={i} className="h-1.5" />); return; }
    if (t.startsWith("### ")) {
      nodes.push(<h4 key={i} className="text-[12px] font-semibold uppercase tracking-wide text-cyan-300/80 mt-3 mb-1">{renderInline(t.slice(4), sources)}</h4>);
    } else if (t.startsWith("## ")) {
      nodes.push(<h3 key={i} className="text-[14px] font-bold text-[#f6f6fd] mt-3 mb-1">{renderInline(t.replace(/^##\s+/, ""), sources)}</h3>);
    } else {
      nodes.push(<p key={i} className="text-[13px] text-white/70 leading-relaxed my-1">{renderInline(t, sources)}</p>);
    }
  });
  flushList(9999);
  return <div>{nodes}</div>;
}

// ─── Small UI atoms ─────────────────────────────────────────────────────────────

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">{children}</span>;
}

function Field({
  icon: Icon, label, value, onChange, placeholder, textarea = false,
}: { icon: any; label: string; value: string; onChange: (v: string) => void; placeholder: string; textarea?: boolean }) {
  const base = "w-full rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/25 outline-none transition-colors";
  const style: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" };
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5"><Icon size={11} className="text-cyan-400/60" /><Mono>{label}</Mono></span>
      {textarea ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2}
          aria-label={label}
          className={`${base} px-3 py-2 resize-none`} style={style}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,230,214,0.35)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
      ) : (
        <div className="relative">
          <input
            value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            aria-label={label}
            className={`${base} px-3 py-2`} style={style}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,230,214,0.35)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
      )}
    </label>
  );
}

function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? "#22e6d6" : value >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Mono>Confidence</Mono>
        <span className="text-[11px] font-mono" style={{ color }}>{value}% · {label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function CopyBtn({ text, label = "Copy", title }: { text: string; label?: string; title?: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => toast({ title: `Copied${title ? `: ${title}` : ""}` }))}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/45 border border-white/[0.08] hover:border-white/25 hover:text-white/70 transition-colors"
    >
      <Copy size={10} />{label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AtomResearcher() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [running, setRunning] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [response, setResponse] = useState<ResearchResponse | null>(null);
  const [activeTab, setActiveTab] = useState("executive");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dossier = response?.ok ? response.dossier : undefined;
  const configError = response && !response.ok && response.error === "perplexity_not_configured";
  const runError = response && !response.ok && !configError ? response : null;

  // Live status stage cycling while running.
  useEffect(() => {
    if (!running) { if (stageTimer.current) clearInterval(stageTimer.current); return; }
    setStageIdx(0);
    let i = 0;
    stageTimer.current = setInterval(() => {
      i = Math.min(i + 1, STATUS_STAGES.length - 1);
      setStageIdx(i);
    }, 2600);
    return () => { if (stageTimer.current) clearInterval(stageTimer.current); };
  }, [running]);

  const researchPlan = useMemo(() => {
    const t = form.companyName || form.domain || "the target";
    const steps = [
      `Validate identity of ${t}${form.domain ? ` via ${form.domain}` : ""}`,
      "Pull official sources, filings, leadership & product pages",
      "Scan recent news, funding, hiring, launches & partnerships",
      `Detect buying signals${form.offering ? ` relevant to ${form.offering}` : ""}`,
      `Build competitive context${form.competitor ? ` vs ${form.competitor}` : ""}`,
      `Craft call strategy${form.contactName ? ` for ${form.contactName}` : ""}${form.salesObjective ? ` toward: ${form.salesObjective}` : ""}`,
      "Verify citations & score source quality",
    ];
    return steps;
  }, [form]);

  const handleRun = useCallback(async () => {
    if (!form.companyName.trim() && !form.domain.trim()) {
      toast({ title: "Target required", description: "Enter a company name or domain to run ATOM research.", variant: "destructive" });
      return;
    }
    setRunning(true);
    setResponse(null);
    setShowPlan(false);
    try {
      const r = await fetch("/api/atom-researcher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: ResearchResponse = await r.json().catch(() => ({ ok: false, error: "bad_response", details: "Malformed response from server." }));
      setResponse(data);
      if (data.ok && data.dossier) {
        setActiveTab("executive");
        const item: HistoryItem = {
          researchId: data.researchId || `local_${Date.now()}`,
          company: data.dossier.company,
          mode: data.dossier.mode,
          at: data.dossier.generatedAt,
          form,
          response: data,
        };
        const next = [item, ...history.filter((h) => h.researchId !== item.researchId)].slice(0, 25);
        setHistory(next); saveHistory(next);
        toast({ title: "Dossier ready", description: `${data.dossier.company} · ${data.dossier.confidence}% confidence` });
      } else if (data.error === "perplexity_not_configured") {
        // Configuration state surfaces inline — no error toast noise.
      } else {
        toast({ title: "Research failed", description: data.details || data.error || "Unknown error.", variant: "destructive" });
      }
    } catch (err: any) {
      setResponse({ ok: false, error: "network_error", details: err?.message || "Network request failed." });
      toast({ title: "Network error", description: err?.message || "Could not reach the research worker.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }, [form, history, toast]);

  function loadDemo() {
    setForm(DEMO_FORM);
    setResponse(null);
    toast({ title: "Demo loaded", description: "Cloudflare Vibranium War Room input ready. Run ATOM Research to generate the live dossier." });
  }
  function clearAll() {
    setForm(EMPTY_FORM); setResponse(null); setShowPlan(false);
  }
  function loadFromHistory(h: HistoryItem) {
    setForm(h.form); setResponse(h.response); setActiveTab("executive");
  }

  // Export helpers.
  function exportMarkdown() {
    if (!response?.rawMarkdown) return;
    download(`atom-dossier-${slug(dossier?.company)}.md`, response.rawMarkdown, "text/markdown");
  }
  function exportJSON() {
    if (!response) return;
    download(`atom-dossier-${slug(dossier?.company)}.json`, JSON.stringify(response, null, 2), "application/json");
  }
  function copyFull() {
    if (!response?.rawMarkdown) return;
    navigator.clipboard.writeText(response.rawMarkdown).then(() => toast({ title: "Full dossier copied" }));
  }

  const tabSections = useMemo(() => {
    if (!dossier) return [];
    const tab = DOSSIER_TABS.find((t) => t.id === activeTab);
    if (!tab) return dossier.sections;
    return dossier.sections.filter((s) => tab.match.some((kw) => s.title.toLowerCase().includes(kw)));
  }, [dossier, activeTab]);

  // Pre-call 3-minute brief — synthesized from current dossier sections.
  const callBrief = useMemo(() => {
    if (!dossier) return null;
    const sec = (kw: string) => dossier.sections.find((s) => s.title.toLowerCase().includes(kw))?.markdown || "";
    const firstBullets = (md: string, n: number) =>
      (md.match(/^[-*]\s+.+$/gm) || md.split("\n").filter(Boolean)).slice(0, n).map((l) => l.replace(/^[-*]\s+/, "").trim());
    return {
      hook: firstBullets(sec("outreach"), 1)[0] || firstBullets(sec("executive"), 1)[0] || "",
      signals: dossier.buyingSignals.filter((s) => s.detected).slice(0, 3),
      pains: firstBullets(sec("pain point"), 3),
      questions: firstBullets(sec("call strategy"), 3),
    };
  }, [dossier]);

  return (
    <TooltipProvider>
      <div style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }} className="space-y-5">
        <style>{`
          @keyframes atomrPulse { 0%,100%{opacity:.45;transform:scale(1)} 50%{opacity:.95;transform:scale(1.08)} }
          @keyframes atomrFade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes atomrGrad { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
          .atomr-fade{animation:atomrFade .4s ease-out both}
          .atomr-glass{background:linear-gradient(135deg,rgba(34,230,214,0.05),rgba(14,14,20,0.96));border:1px solid rgba(34,230,214,0.16);border-radius:14px;backdrop-filter:blur(8px)}
          .atomr-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:12px}
          .atomr-anim-bar{background:linear-gradient(90deg,#22e6d6,#8b5cf6,#3b82f6,#22e6d6);background-size:300% 100%;animation:atomrGrad 6s ease infinite}
        `}</style>

        {/* ── Header ── */}
        <div className="atomr-card px-5 py-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] atomr-anim-bar" />
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl" style={{ background: "rgba(34,230,214,0.1)", border: "1px solid rgba(34,230,214,0.28)" }}>
                <Radar size={22} className="text-[#22e6d6]" style={{ animation: "atomrPulse 2.6s ease-in-out infinite" }} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-[18px] font-bold text-[#f6f6fd] leading-tight">ATOM Researcher Pro / Sonar</h1>
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded-full"
                    style={{ background: "linear-gradient(90deg,rgba(139,92,246,0.2),rgba(34,230,214,0.2))", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.35)" }}>
                    Vibranium
                  </span>
                </div>
                <p className="text-[12px] text-white/40 mt-0.5">Deep-research intelligence agent — citation-backed executive dossiers, buying-signal detection & call strategy.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono"
              style={{ background: "rgba(34,230,214,0.08)", border: "1px solid rgba(34,230,214,0.22)", color: "#22e6d6" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22e6d6]" style={{ animation: "atomrPulse 1.8s ease-in-out infinite" }} />
              SONAR
            </div>
          </div>
        </div>

        {/* ── Mode selector cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MODES.map((mode) => {
            const active = form.mode === mode.value;
            const Icon = mode.icon;
            return (
              <button key={mode.value} onClick={() => setForm((f) => ({ ...f, mode: mode.value }))}
                aria-pressed={active}
                className="text-left p-3 rounded-xl transition-all"
                style={{
                  background: active ? "rgba(34,230,214,0.08)" : "rgba(255,255,255,0.025)",
                  border: active ? "1px solid rgba(34,230,214,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: active ? "inset 0 0 20px rgba(34,230,214,0.08)" : "none",
                }}>
                <div className="flex items-center justify-between">
                  <Icon size={16} className={active ? "text-[#22e6d6]" : "text-white/40"} />
                  <span className="text-[9px] font-mono text-white/30">{mode.tier}</span>
                </div>
                <div className={`text-[13px] font-semibold mt-2 ${active ? "text-[#f6f6fd]" : "text-white/70"}`}>{mode.label}</div>
                <div className="text-[11px] text-white/35 leading-snug mt-0.5">{mode.tagline}</div>
              </button>
            );
          })}
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-5 items-start">

          {/* LEFT — input form */}
          <div className="atomr-card p-4 space-y-3 lg:sticky lg:top-4">
            <div className="flex items-center gap-2"><Crosshair size={13} className="text-[#22e6d6]" /><Mono>Target Brief</Mono></div>
            <Field icon={Building2} label="Company name" value={form.companyName} onChange={set("companyName")} placeholder="e.g. Cloudflare" />
            <Field icon={Globe} label="Domain" value={form.domain} onChange={set("domain")} placeholder="cloudflare.com" />
            <div className="grid grid-cols-2 gap-3">
              <Field icon={User} label="Contact name" value={form.contactName} onChange={set("contactName")} placeholder="Matthew Prince" />
              <Field icon={UserCog} label="Contact title" value={form.contactTitle} onChange={set("contactTitle")} placeholder="CEO" />
            </div>
            <Field icon={ExternalLink} label="LinkedIn URL" value={form.linkedinUrl} onChange={set("linkedinUrl")} placeholder="linkedin.com/in/…" />
            <Field icon={Target} label="Sales objective" value={form.salesObjective} onChange={set("salesObjective")} placeholder="What outcome are you driving?" textarea />
            <Field icon={Briefcase} label="Offering" value={form.offering} onChange={set("offering")} placeholder="What are you selling?" textarea />
            <Field icon={Swords} label="Competitor / strategic angle" value={form.competitor} onChange={set("competitor")} placeholder="Who are you up against?" />
            <Field icon={FileText} label="Notes" value={form.notes} onChange={set("notes")} placeholder="Anything else ATOM should weigh…" textarea />

            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleRun} disabled={running}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "rgba(34,230,214,0.14)", color: "#22e6d6", border: "1px solid rgba(34,230,214,0.35)" }}>
                {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {running ? "Researching…" : "Run ATOM Research"}
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowPlan((s) => !s)} aria-label="Preview research plan"
                    className="px-2.5 py-2.5 rounded-lg border border-white/[0.08] text-white/45 hover:text-white/70 hover:border-white/25 transition-colors">
                    <Sparkles size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Research plan preview</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadDemo} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-white/55 border border-white/[0.08] hover:border-white/25 hover:text-white/80 transition-colors">
                <FlaskConical size={13} /> Load Demo
              </button>
              <button onClick={clearAll} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] text-white/55 border border-white/[0.08] hover:border-white/25 hover:text-white/80 transition-colors">
                <Trash2 size={13} /> Clear
              </button>
            </div>

            {showPlan && (
              <div className="atomr-fade rounded-lg p-3 space-y-2" style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.18)" }}>
                <div className="flex items-center gap-1.5"><Sparkles size={11} className="text-violet-300" /><Mono>Research Plan Preview</Mono></div>
                <ol className="space-y-1">
                  {researchPlan.map((step, i) => (
                    <li key={i} className="flex gap-2 text-[11.5px] text-white/55">
                      <span className="text-violet-300/70 font-mono shrink-0">{i + 1}.</span>{step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {history.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                <div className="flex items-center gap-1.5"><History size={11} className="text-white/30" /><Mono>Recent Dossiers</Mono></div>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {history.map((h) => (
                    <button key={h.researchId} onClick={() => loadFromHistory(h)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors">
                      <span className="text-[12px] text-white/65 truncate">{h.company}</span>
                      <span className="text-[9px] font-mono text-white/25 shrink-0">{MODES.find((m) => m.value === h.mode)?.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — status + dossier */}
          <div className="space-y-4 min-w-0">

            {/* Live status */}
            {running && (
              <div className="atomr-glass p-4 atomr-fade">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 size={14} className="text-[#22e6d6] animate-spin" />
                  <Mono>ATOM Researcher · Live</Mono>
                  <div className="flex-1 h-px bg-gradient-to-r from-[#22e6d6]/25 to-transparent" />
                </div>
                <div className="space-y-1">
                  {STATUS_STAGES.map((stage, i) => {
                    const done = i < stageIdx, current = i === stageIdx;
                    return (
                      <div key={stage} className="flex items-center gap-2 text-[12px]"
                        style={{ color: done ? "rgba(34,230,214,0.7)" : current ? "#f6f6fd" : "rgba(255,255,255,0.3)" }}>
                        {done ? <CheckCircle2 size={13} className="text-[#22e6d6]" />
                          : current ? <Loader2 size={13} className="animate-spin text-[#22e6d6]" />
                            : <Circle size={13} className="text-white/15" />}
                        {stage}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Configuration state */}
            {configError && (
              <div className="atomr-glass p-6 atomr-fade text-center space-y-3" style={{ borderColor: "rgba(251,191,36,0.3)" }}>
                <AlertTriangle size={28} className="text-amber-400 mx-auto" />
                <h3 className="text-[15px] font-semibold text-[#f6f6fd]">Sonar research not yet activated</h3>
                <p className="text-[13px] text-white/55 max-w-md mx-auto">
                  {response?.details || "PERPLEXITY_API_KEY is not configured. Add it to your server environment to activate live Sonar research."}
                </p>
                <code className="inline-block text-[11px] font-mono px-3 py-1.5 rounded-md text-amber-200/80" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  PERPLEXITY_API_KEY=pplx-…
                </code>
              </div>
            )}

            {/* Run error */}
            {runError && (
              <div className="atomr-glass p-6 atomr-fade text-center space-y-3" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
                <AlertTriangle size={26} className="text-red-400 mx-auto" />
                <h3 className="text-[14px] font-semibold text-[#f6f6fd]">Research could not complete</h3>
                <p className="text-[12px] text-white/50 max-w-md mx-auto break-words">{runError.details || runError.error}</p>
                <button onClick={handleRun} className="text-[12px] px-3 py-1.5 rounded-lg text-[#22e6d6] border border-[#22e6d6]/30 hover:bg-[#22e6d6]/5 transition-colors">Retry</button>
              </div>
            )}

            {/* Empty state */}
            {!running && !response && (
              <div className="atomr-card p-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(34,230,214,0.06)", border: "1px solid rgba(34,230,214,0.15)" }}>
                  <Brain size={30} className="text-[#22e6d6]/50" style={{ animation: "atomrPulse 2.8s ease-in-out infinite" }} />
                </div>
                <h2 className="text-[15px] font-semibold text-white/55">Enter a target and run ATOM Research</h2>
                <p className="text-[13px] text-white/30 max-w-md mx-auto">
                  ATOM Researcher Pro builds a source-backed, 12-section executive dossier with buying-signal detection, competitive context, and a ready-to-use call strategy.
                </p>
                <button onClick={loadDemo} className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg text-white/55 border border-white/[0.1] hover:text-white/80 hover:border-white/25 transition-colors">
                  <FlaskConical size={13} /> Load Cloudflare War Room demo
                </button>
              </div>
            )}

            {/* Dossier */}
            {dossier && (
              <div className="space-y-4 atomr-fade">
                {/* Summary bar */}
                <div className="atomr-glass p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-[20px] font-bold text-[#f6f6fd] leading-tight">{dossier.company}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.14)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}>
                          {MODES.find((m) => m.value === dossier.mode)?.label}
                        </span>
                        <span className="text-[10px] font-mono text-white/30">{dossier.sourceMap.length} sources</span>
                        {response?.model && <span className="text-[10px] font-mono text-white/25">· {response.model}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <CopyBtn text={response?.rawMarkdown || ""} label="Copy" />
                      <button onClick={exportMarkdown} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/45 border border-white/[0.08] hover:border-white/25 hover:text-white/70 transition-colors"><FileDown size={10} /> .md</button>
                      <button onClick={exportJSON} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/45 border border-white/[0.08] hover:border-white/25 hover:text-white/70 transition-colors"><FileJson size={10} /> .json</button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button disabled className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/25 border border-white/[0.06] cursor-not-allowed"><Download size={10} /> PDF</button>
                        </TooltipTrigger>
                        <TooltipContent side="top">PDF export coming soon</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <ConfidenceMeter value={dossier.confidence} label={dossier.confidenceLabel} />
                  {dossier.sourceThin && (
                    <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", color: "#fcd34d" }}>
                      <AlertTriangle size={13} /> Source-thin: fewer than 3 sources verified. Treat figures as provisional.
                    </div>
                  )}
                </div>

                {/* Buying Signal Radar */}
                <div className="atomr-card p-4 space-y-3">
                  <div className="flex items-center gap-1.5"><Zap size={13} className="text-amber-400/70" /><Mono>Buying Signal Radar</Mono></div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {dossier.buyingSignals.map((sig) => {
                      const Icon = SIGNAL_ICONS[sig.category] || Circle;
                      return (
                        <Tooltip key={sig.category}>
                          <TooltipTrigger asChild>
                            <div className="p-2 rounded-lg text-center cursor-default transition-colors"
                              style={{
                                background: sig.detected ? "rgba(34,230,214,0.08)" : "rgba(255,255,255,0.02)",
                                border: sig.detected ? "1px solid rgba(34,230,214,0.3)" : "1px solid rgba(255,255,255,0.06)",
                              }}>
                              <Icon size={14} className={`mx-auto ${sig.detected ? "text-[#22e6d6]" : "text-white/25"}`} />
                              <div className={`text-[9.5px] font-medium mt-1 leading-tight ${sig.detected ? "text-white/75" : "text-white/35"}`}>{sig.category}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px]">
                            <span className="text-xs">{sig.detected ? "✅ Detected — " : "Not detected — "}{sig.detail}</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Call Brief Card */}
                {callBrief && (
                  <div className="atomr-card p-4 space-y-3" style={{ borderColor: "rgba(139,92,246,0.2)" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><Phone size={13} className="text-violet-300" /><Mono>ATOM Call Brief · 3-min pre-call</Mono></div>
                      <CopyBtn text={callBriefText(dossier, callBrief)} label="Copy brief" title="Call Brief" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Mono>Opening Hook</Mono>
                        <p className="text-[12px] text-white/70 leading-relaxed">{callBrief.hook || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <Mono>Live Signals</Mono>
                        <div className="flex flex-wrap gap-1">
                          {callBrief.signals.length ? callBrief.signals.map((s) => (
                            <span key={s.category} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,230,214,0.1)", color: "#22e6d6", border: "1px solid rgba(34,230,214,0.25)" }}>{s.category}</span>
                          )) : <span className="text-[11px] text-white/30">No strong signals yet</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Mono>Top Pains</Mono>
                        <ul className="space-y-0.5">{callBrief.pains.length ? callBrief.pains.map((p, i) => <li key={i} className="text-[11.5px] text-white/55 flex gap-1.5"><HeartCrack size={11} className="text-red-400/50 mt-0.5 shrink-0" />{p}</li>) : <li className="text-[11px] text-white/30">—</li>}</ul>
                      </div>
                      <div className="space-y-1">
                        <Mono>Discovery Qs</Mono>
                        <ul className="space-y-0.5">{callBrief.questions.length ? callBrief.questions.map((q, i) => <li key={i} className="text-[11.5px] text-white/55 flex gap-1.5"><ChevronRight size={11} className="text-violet-300/50 mt-0.5 shrink-0" />{q}</li>) : <li className="text-[11px] text-white/30">—</li>}</ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI follow-up actions */}
                <div className="atomr-card p-4 space-y-2">
                  <div className="flex items-center gap-1.5"><Sparkles size={13} className="text-[#22e6d6]" /><Mono>AI Follow-up Actions</Mono></div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FOLLOWUPS.map((fu) => (
                      <button key={fu.id} onClick={() => copyFollowup(fu.id, dossier, form, toast)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11.5px] text-white/60 border border-white/[0.08] hover:border-[#22e6d6]/30 hover:text-white/85 transition-colors">
                        <fu.icon size={13} className="text-[#22e6d6]/70 shrink-0" /> {fu.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/25">Generates a draft from the current dossier and copies it to your clipboard.</p>
                </div>

                {/* Dossier tabs */}
                <div className="atomr-card overflow-hidden">
                  <div className="flex gap-1 px-3 pt-3 overflow-x-auto border-b border-white/[0.06]">
                    {DOSSIER_TABS.map((tab) => {
                      const active = activeTab === tab.id;
                      return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          className="px-3 py-2 text-[12px] font-medium whitespace-nowrap rounded-t-lg transition-colors"
                          style={{ color: active ? "#22e6d6" : "rgba(255,255,255,0.4)", borderBottom: active ? "2px solid #22e6d6" : "2px solid transparent" }}>
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-4">
                    {activeTab === "sources" ? (
                      <SourceMap sources={dossier.sourceMap} />
                    ) : tabSections.length ? (
                      tabSections.map((s) => (
                        <div key={s.id} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-[14px] font-bold text-[#f6f6fd]">{s.title}</h3>
                            <CopyBtn text={`## ${s.title}\n\n${s.markdown}`} label="Copy" title={s.title} />
                          </div>
                          <Markdown md={s.markdown} sources={dossier.sourceMap} />
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-white/35 py-4 text-center">No content for this tab.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Source Map view ────────────────────────────────────────────────────────────

function SourceMap({ sources }: { sources: SourceMapEntry[] }) {
  if (!sources.length) return <p className="text-[13px] text-white/35 py-4 text-center">No sources returned. Treat this dossier as inferred.</p>;
  const tierColor = (t: SourceMapEntry["tier"]) => t === "primary" ? "#22e6d6" : t === "credible" ? "#8b5cf6" : "#94a3b8";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2"><ShieldCheck size={13} className="text-[#22e6d6]" /><Mono>Source Map · Quality Scored</Mono></div>
      {sources.map((s) => (
        <a key={s.index} href={s.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
          <span className="text-[10px] font-mono w-5 text-center shrink-0" style={{ color: tierColor(s.tier) }}>{s.index}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-white/70 truncate group-hover:text-[#22e6d6] transition-colors">{s.domain}</div>
            <div className="text-[10px] text-white/30 truncate">{s.url}</div>
          </div>
          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: tierColor(s.tier), background: `${tierColor(s.tier)}1a`, border: `1px solid ${tierColor(s.tier)}40` }}>{s.tier}</span>
          <div className="w-14 shrink-0">
            <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.quality}%`, background: tierColor(s.tier) }} />
            </div>
          </div>
          <ExternalLink size={11} className="text-white/20 group-hover:text-white/50 shrink-0" />
        </a>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slug(s?: string) { return (s || "target").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function callBriefText(d: Dossier, b: { hook: string; signals: { category: string }[]; pains: string[]; questions: string[] }) {
  return [
    `ATOM CALL BRIEF — ${d.company} (${d.confidence}% confidence)`,
    ``, `OPENING HOOK:`, b.hook || "—",
    ``, `LIVE SIGNALS: ${b.signals.map((s) => s.category).join(", ") || "none"}`,
    ``, `TOP PAINS:`, ...b.pains.map((p) => `- ${p}`),
    ``, `DISCOVERY QUESTIONS:`, ...b.questions.map((q) => `- ${q}`),
  ].join("\n");
}

const FOLLOWUPS = [
  { id: "cold_email", label: "Cold Email", icon: Mail },
  { id: "linkedin_dm", label: "LinkedIn DM", icon: MessageSquare },
  { id: "discovery", label: "Discovery Script", icon: ClipboardList },
  { id: "objections", label: "Objection Battlecard", icon: ShieldCheck },
  { id: "slack", label: "Internal Slack Brief", icon: Hash },
  { id: "crm", label: "CRM Note", icon: FileText },
];

function sectionMd(d: Dossier, kw: string) { return d.sections.find((s) => s.title.toLowerCase().includes(kw))?.markdown || ""; }

function copyFollowup(
  id: string, d: Dossier, form: FormState,
  toast: ReturnType<typeof useToast>["toast"],
) {
  const c = d.company;
  const offering = form.offering || "our solution";
  const contact = form.contactName || "there";
  let text = "";
  switch (id) {
    case "cold_email":
      text = `Subject: ${c} × ${offering}\n\nHi ${contact},\n\n${firstLine(sectionMd(d, "outreach")) || firstLine(d.executiveBrief)}\n\n${firstLine(sectionMd(d, "strategic fit")) || ""}\n\nWorth a 15-minute call this week?\n\n— Sent via ATOM Researcher Pro`;
      break;
    case "linkedin_dm":
      text = `Hi ${contact} — ${firstLine(sectionMd(d, "outreach")) || firstLine(d.executiveBrief)} Given ${c}'s current priorities, thought ${offering} could be relevant. Open to connecting?`;
      break;
    case "discovery":
      text = `DISCOVERY SCRIPT — ${c}\n\n${sectionMd(d, "call strategy") || "Lead with current-state, gap, and impact questions."}`;
      break;
    case "objections":
      text = `OBJECTION BATTLECARD — ${c}\n\nLikely competitive angle: ${form.competitor || "incumbent / status quo"}\n\n${sectionMd(d, "competitive") || sectionMd(d, "strategic fit")}`;
      break;
    case "slack":
      text = `*ATOM dossier — ${c}* (${d.confidence}% confidence)\n\n${firstLine(d.executiveBrief)}\n\nSignals: ${d.buyingSignals.filter((s) => s.detected).map((s) => s.category).join(", ") || "none"}\nNext step: ${form.salesObjective || "qualify + book call"}`;
      break;
    case "crm":
      text = `[ATOM Researcher] ${c} — ${new Date().toLocaleDateString()}\nMode: ${d.mode} · Confidence: ${d.confidence}%\nObjective: ${form.salesObjective || "—"}\nSummary: ${firstLine(d.executiveBrief)}\nSources: ${d.sourceMap.length}`;
      break;
  }
  navigator.clipboard.writeText(text).then(() => toast({ title: "Draft copied", description: `${FOLLOWUPS.find((f) => f.id === id)?.label} generated from dossier.` }));
}

function firstLine(md: string) {
  const line = md.split("\n").map((l) => l.replace(/^[-*]\s+/, "").trim()).find((l) => l.length > 20);
  return line || md.trim().slice(0, 180);
}
