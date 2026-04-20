import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Radar,
  Search,
  Phone,
  PhoneCall,
  User,
  Building2,
  DollarSign,
  Users,
  MapPin,
  Target,
  Zap,
  Brain,
  Activity,
  ArrowRight,
  ExternalLink,
  Copy,
  Globe,
  Radio,
  Mic,
  Shield,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Clock,
  Cpu,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  description?: string;
  industry?: string;
  founded?: string;
  headquarters?: string;
  employeeCount?: string | number;
  revenue?: string;
  website?: string;
  stockTicker?: string;
}

interface WarbookData {
  overview?: OverviewData;
  executiveSummary?: string;
  techStack?: string[];
  competitors?: { name: string; threat?: string; howToBeat?: string; marketShare?: string }[];
  painPoints?: { pain: string; severity?: string; opportunity?: string; impact?: string; evidence?: string; urgencyScore?: number }[];
  buyingSignals?: { signal: string; strength?: string; category?: string; intentScore?: number }[];
  battleCard?: Record<string, unknown>;
  battlePlan?: {
    objectionPredictions?: string[];
    pitchAngles?: string[];
    callStrategy?: { keyQuestions?: string[]; openingStatement?: string };
    emailSequence?: unknown[];
  };
  sentimentScore?: number;
  buyerIntentScore?: number;
}

interface ResearchResult {
  company: string;
  warbook?: WarbookData;
  contacts?: { name: string; title: string; email?: string; phone?: string; linkedin?: string; department?: string; seniority?: string }[];
  companyProfile?: { employeeCount?: string | number; revenue?: string; industry?: string; founded?: string; location?: string; techStack?: string[]; tags?: string[] };
  citations?: string[];
}

interface VoiceBrief {
  opener: string;
  objections: string[];
  discoveryQs: string[];
  competitiveMap: { name: string; winRate: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateVoiceBrief(data: ResearchResult, contactTitle: string, _product: string): VoiceBrief {
  const company = data.company;
  const wb = data.warbook;
  const painPoints = wb?.painPoints?.slice(0, 3).map((p) => p.pain) || [];
  const keyInitiative = wb?.buyingSignals?.[0]?.signal || "digital transformation";

  const openerPain = painPoints.length > 0 ? ` I noticed you may be dealing with ${painPoints[0].toLowerCase()}.` : "";

  return {
    opener: `Hey ${contactTitle.split("/")[0].trim()} — this is ADAM from Antimatter AI. I was doing some research on ${company} and saw you're leading the push${keyInitiative ? ` to ${keyInitiative.toLowerCase()}` : " in your space"}.${openerPain} How's that effort going with your current infrastructure?`,
    objections: wb?.battlePlan?.objectionPredictions?.slice(0, 3) || [
      "We already have a solution in place.",
      "Our budget is locked for this quarter.",
      "Send me some information and I'll review it.",
    ],
    discoveryQs: wb?.battlePlan?.callStrategy?.keyQuestions?.slice(0, 5) || [
      `What does your current stack look like for ${company}'s core workflows?`,
      "What's your biggest operational bottleneck right now?",
      "Who else is involved in evaluating solutions like this?",
      "What would success look like in 90 days if we partnered?",
      "What's your timeline for making a decision?",
    ],
    competitiveMap:
      wb?.competitors?.slice(0, 4).map((c) => ({
        name: c.name,
        winRate: parseInt(c.marketShare || "0") || Math.floor(Math.random() * 30 + 50),
      })) || [],
  };
}

const SONAR_STEPS = [
  "Scanning news feeds and press releases...",
  "Analyzing LinkedIn and Glassdoor signals...",
  "Mapping organizational structure...",
  "Identifying pain points and purchase triggers...",
  "Building AI context profile...",
  "Sonar research complete",
];

const CONTACT_TITLES = [
  "CTO / VP Technology",
  "CEO / President",
  "CIO / IT Director",
  "VP Sales",
  "VP Operations",
  "CFO / VP Finance",
  "CISO / VP Security",
  "CMO / VP Marketing",
  "COO / VP Engineering",
];

const PRODUCTS = [
  { value: "atom-enterprise", label: "ATOM Enterprise" },
  { value: "atom-voice", label: "ATOM Voice" },
  { value: "atom-intelligence", label: "ATOM Intelligence" },
  { value: "atom-cx", label: "ATOM CX Platform" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function WaveformAnimation() {
  const heights = [40, 65, 80, 55, 70, 85, 60, 45];
  return (
    <div className="flex items-end gap-[3px] h-8">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-teal-400/70"
          style={{
            height: `${h}%`,
            animation: `sonarWave 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

function PainPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-300 border border-red-500/[0.18] text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
      <AlertCircle size={9} />
      {label}
    </span>
  );
}

function TechPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 bg-cyan-500/[0.08] text-cyan-400 border border-cyan-500/15 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
      <Cpu size={9} />
      {label}
    </span>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">
      {children}
    </span>
  );
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-3 rounded-lg border border-white/[0.06]"
      style={{ background: "rgba(255,255,255,0.025)" }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-cyan-400/60" />
        <MonoLabel>{label}</MonoLabel>
      </div>
      <div className="text-[13px] font-semibold text-[#f6f6fd] leading-tight">
        {value || "—"}
      </div>
    </div>
  );
}

function CompetitorBar({ name, winRate }: { name: string; winRate: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[11px] text-white/55 truncate shrink-0">{name}</div>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${winRate}%`, background: "#00c8c8" }}
        />
      </div>
      <div className="text-[11px] text-white/40 w-8 text-right shrink-0">{winRate}%</div>
    </div>
  );
}

function ArchitectureFlow() {
  const nodes = [
    { label: "Company Input", icon: Building2 },
    { label: "Sonar Deep Research", icon: Radar },
    { label: "ATOM AI Context Builder", icon: Brain },
    { label: "ATOM Voice Brief", icon: Mic },
    { label: "Live Call", icon: PhoneCall },
  ];

  const cards = [
    {
      icon: Radar,
      title: "SONAR SCANS",
      body: "News, filings, LinkedIn, Glassdoor, job posts, press releases, tech stack signals",
      color: "text-cyan-400",
      border: "border-cyan-500/20",
    },
    {
      icon: Brain,
      title: "AI SYNTHESIZES",
      body: "Pain points, purchase triggers, buying signals, org structure, objection map",
      color: "text-teal-400",
      border: "border-teal-500/20",
    },
    {
      icon: Mic,
      title: "VOICE BRIEF",
      body: "Personalized call script, live objection handling, talk track, discovery Qs",
      color: "text-emerald-400",
      border: "border-emerald-500/20",
    },
  ];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <MonoLabel>Lead Gen Intelligence Architecture</MonoLabel>
      </div>

      {/* Flow nodes */}
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

      {/* Detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.title} className={`rounded-lg border ${c.border} bg-white/[0.02] p-3 space-y-1.5`}>
            <div className="flex items-center gap-1.5">
              <c.icon size={12} className={c.color} />
              <MonoLabel>{c.title}</MonoLabel>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SonarLoadingBar({ step }: { step: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-cyan-500/20 mb-4"
      style={{ background: "rgba(34,211,238,0.04)" }}
    >
      <div className="relative w-3.5 h-3.5 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30" />
        <div
          className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
      </div>
      <span className="text-[12px] text-cyan-400/80 font-mono">{step}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AtomSonar() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [company, setCompany] = useState("");
  const [contactTitle, setContactTitle] = useState("CTO / VP Technology");
  const [product, setProduct] = useState("atom-enterprise");
  const [isResearching, setIsResearching] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [voiceBrief, setVoiceBrief] = useState<VoiceBrief | null>(null);
  const [sonarStep, setSonarStep] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [barsVisible, setBarsVisible] = useState(false);

  const stepRef = useRef<NodeJS.Timeout | null>(null);

  // Cycle through loading steps
  useEffect(() => {
    if (!isResearching) return;
    setBarsVisible(true);
    setSonarStep(SONAR_STEPS[0]);
    setStepIndex(0);

    let idx = 0;
    stepRef.current = setInterval(() => {
      idx = (idx + 1) % (SONAR_STEPS.length - 1);
      setSonarStep(SONAR_STEPS[idx]);
      setStepIndex(idx);
    }, 1800);

    return () => {
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, [isResearching]);

  async function handleRunSonar() {
    if (!company.trim()) {
      toast({ title: "Company name required", description: "Enter a company name to run Sonar research.", variant: "destructive" });
      return;
    }

    setIsResearching(true);
    setResult(null);
    setVoiceBrief(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min max
      const res = await fetch("https://45-79-202-76.sslip.io/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), website: "", depth: "standard" }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Research failed (${res.status}): ${errBody.slice(0, 100)}`);
      }
      const data = await res.json();
      setResult(data);
      setSonarStep(SONAR_STEPS[SONAR_STEPS.length - 1]);

      setTimeout(() => {
        setBarsVisible(false);
        setSonarStep("");
      }, 1500);

      toast({ title: "Sonar Research Complete", description: `Intelligence report loaded for ${company}.` });
    } catch (err) {
      console.error(err);
      toast({ title: "Research failed", description: "Could not complete Sonar research. Please try again.", variant: "destructive" });
      setBarsVisible(false);
      setSonarStep("");
    } finally {
      setIsResearching(false);
      if (stepRef.current) clearInterval(stepRef.current);
    }
  }

  function handleVoiceBrief() {
    if (!result) {
      toast({ title: "Run Sonar first", description: "Load a company intelligence report before generating a Voice Brief.", variant: "destructive" });
      return;
    }
    const brief = generateVoiceBrief(result, contactTitle, product);
    setVoiceBrief(brief);
    toast({ title: "ATOM Voice Brief Ready", description: "Personalized call script generated." });
  }

  const wb = result?.warbook;
  const overview = wb?.overview;
  const profile = result?.companyProfile;

  const displayRevenue = overview?.revenue || profile?.revenue || "—";
  const displayEmployees = overview?.employeeCount || profile?.employeeCount || "—";
  const displayHQ = overview?.headquarters || profile?.location || "—";
  const displayIndustry = overview?.industry || profile?.industry || "";
  const displayTicker = overview?.stockTicker || "";
  const keyInitiative = wb?.buyingSignals?.[0]?.signal || "";
  const recentEvent = wb?.buyingSignals?.[1]?.signal || "";
  const growthRate = profile?.tags?.[0] || (wb?.buyerIntentScore ? `Intent Score: ${wb.buyerIntentScore}/10` : "—");

  const techStack = (wb?.techStack || profile?.techStack || []).slice(0, 10);
  const painPoints = (wb?.painPoints || []).slice(0, 8);
  const contacts = (result?.contacts || []).slice(0, 1)[0];

  return (
    <div
      style={{
        background: "#0b0b0c",
        minHeight: "100vh",
        fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif",
        color: "#f6f6fd",
      }}
    >
      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes sonarWave {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sonarPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sonar-panel {
          background: linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(14,14,20,0.95) 100%);
          border: 1px solid rgba(34,211,238,0.2);
          border-radius: 12px;
        }
        .voice-panel {
          background: linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(10,10,18,0.98) 100%);
          border: 1px solid rgba(167,139,250,0.2);
          border-radius: 12px;
        }
        .fade-in { animation: fadeIn 0.4s ease-out both; }
        .sonar-badge-pulse {
          animation: sonarPulse 2s ease-in-out infinite;
        }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-5">

        {/* ── Top Bar ── */}
        <div className="rounded-xl border border-white/[0.08] bg-[#111114] px-5 py-4 space-y-4">
          {/* Breadcrumb row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)" }}
              >
                <Radar size={18} className="text-cyan-400" style={{ animation: "sonarPulse 2.5s ease-in-out infinite" }} />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-[#f6f6fd] leading-tight">ATOM Sonar</h1>
                <div className="flex items-center gap-1.5 text-[11px] text-white/30 mt-0.5">
                  <span>Company Intelligence</span>
                  <ArrowRight size={10} />
                  <span>Voice Brief</span>
                  <ArrowRight size={10} />
                  <span>Call</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-400"
                  style={{ animation: "sonarPulse 1.8s ease-in-out infinite" }}
                />
                SONAR ACTIVE
              </div>
              {result && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 border border-white/[0.08] hover:border-white/20 hover:text-white/70 transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onClick={() => {
                    const text = JSON.stringify(result, null, 2);
                    navigator.clipboard.writeText(text).then(() =>
                      toast({ title: "Copied to clipboard", description: "Research data copied." })
                    );
                  }}
                >
                  <Copy size={11} />
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Company input */}
            <div className="relative flex-1 min-w-[200px]">
              <Building2
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunSonar()}
                placeholder="Company name (e.g. Salesforce, Five9, Twilio...)"
                className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/25 outline-none transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Contact title */}
            <div className="relative">
              <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <select
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                className="pl-7 pr-7 py-2 rounded-lg text-[12px] text-white/70 outline-none appearance-none cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {CONTACT_TITLES.map((t) => (
                  <option key={t} value={t} style={{ background: "#111114" }}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Product — free text */}
            <div className="relative">
              <Briefcase size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="What are you pitching? (e.g. Five9, Akamai CDN, Cloudflare...)"
                className="pl-7 pr-3 py-2 rounded-lg text-[12px] text-white/70 outline-none w-[260px]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
            </div>

            {/* Run Sonar button */}
            <button
              onClick={handleRunSonar}
              disabled={isResearching}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(34,211,238,0.12)",
                color: "#22d3ee",
                border: "1px solid rgba(34,211,238,0.3)",
              }}
            >
              <Radar size={14} />
              {isResearching ? "Scanning..." : "Run Sonar Deep Research"}
            </button>

            {/* Voice Brief button */}
            <button
              onClick={handleVoiceBrief}
              disabled={!result}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "rgba(167,139,250,0.12)",
                color: "#a78bfa",
                border: "1px solid rgba(167,139,250,0.3)",
              }}
            >
              <Mic size={14} />
              ATOM Voice Brief
            </button>
          </div>
        </div>

        {/* ── Sonar loading bar ── */}
        {barsVisible && <SonarLoadingBar step={sonarStep} />}

        {/* ── Main Content ── */}
        {!result && !isResearching && (
          // Empty state
          <div className="flex flex-col items-center justify-center py-28 space-y-4">
            <div
              className="flex items-center justify-center w-20 h-20 rounded-full"
              style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}
            >
              <Radar size={36} className="text-cyan-400/50" style={{ animation: "sonarPulse 2.5s ease-in-out infinite" }} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-[16px] font-semibold text-white/40">Enter a company name and run Sonar Deep Research</h2>
              <p className="text-[13px] text-white/20 max-w-md">
                ATOM Sonar builds a full intelligence profile — pain points, tech stack, buying signals, and a personalized voice brief.
              </p>
            </div>

            {/* Architecture preview in empty state */}
            <div className="mt-8 w-full max-w-3xl">
              <ArchitectureFlow />
            </div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 fade-in">

            {/* ═══════════════════════════════════════════════════════════
                LEFT COLUMN — Sonar Intelligence Report
            ═══════════════════════════════════════════════════════════ */}
            <div className="space-y-4">

              {/* Sonar Intelligence Report card */}
              <div className="sonar-panel p-5 space-y-5">

                {/* Card header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Radar size={14} className="text-cyan-400" />
                    <MonoLabel>Sonar Intelligence Report</MonoLabel>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}
                    >
                      {result.company}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-white/25 text-[10px]">
                    <Clock size={9} />
                    <span>Last synced: just now</span>
                  </div>
                </div>

                {/* Company name + badges */}
                <div className="space-y-2">
                  <h2 className="text-[22px] font-bold text-[#f6f6fd] leading-tight">{result.company}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    {displayIndustry && (
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-mono uppercase tracking-wide"
                        style={{ background: "rgba(34,211,238,0.08)", color: "#67e8f9", border: "1px solid rgba(34,211,238,0.2)" }}
                      >
                        {displayIndustry}
                      </span>
                    )}
                    {displayTicker && (
                      <span
                        className="text-[10px] px-2.5 py-1 rounded-full font-mono uppercase tracking-wide"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        {displayTicker}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {(overview?.description || wb?.executiveSummary) && (
                  <p className="text-[13px] text-white/55 leading-relaxed">
                    {overview?.description || wb?.executiveSummary}
                  </p>
                )}

                {/* Stat grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <StatCell icon={DollarSign} label="Annual Revenue" value={displayRevenue} />
                  <StatCell icon={Users} label="Employees" value={String(displayEmployees)} />
                  <StatCell icon={MapPin} label="HQ" value={String(displayHQ)} />
                  <StatCell icon={Target} label="Key Initiative" value={keyInitiative || "—"} />
                  <StatCell icon={TrendingUp} label="Recent Event" value={recentEvent || "—"} />
                  <StatCell icon={Activity} label="Growth Rate" value={String(growthRate)} />
                </div>

                {/* Pain points */}
                {painPoints.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle size={11} className="text-red-400/60" />
                      <MonoLabel>Pain Points (Sonar Identified)</MonoLabel>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {painPoints.map((pp, i) => (
                        <PainPill key={i} label={pp.pain} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tech stack */}
                {techStack.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Cpu size={11} className="text-cyan-400/60" />
                      <MonoLabel>Tech Stack (Detected)</MonoLabel>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {techStack.map((tech, i) => (
                        <TechPill key={i} label={tech} />
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Architecture flow */}
              <ArchitectureFlow />

            </div>

            {/* ═══════════════════════════════════════════════════════════
                RIGHT COLUMN — ATOM Voice Intelligence
            ═══════════════════════════════════════════════════════════ */}
            <div className="space-y-4">

              {/* Voice panel */}
              <div className="voice-panel p-5 space-y-5">

                {/* Card header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: "#a78bfa", animation: "sonarPulse 2s ease-in-out infinite" }}
                    />
                    <MonoLabel>ATOM Voice Intelligence</MonoLabel>
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}
                  >
                    {voiceBrief ? "BRIEF READY" : "READY TO BRIEF"}
                  </span>
                </div>

                {/* Contact info */}
                <div className="space-y-1">
                  <div className="text-[14px] font-semibold text-[#f6f6fd]">
                    {result.company} — {contactTitle} Call
                  </div>
                  {contacts ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                      <User size={10} />
                      <span>{contacts.name}</span>
                      {contacts.phone && (
                        <>
                          <span className="text-white/20">·</span>
                          <Phone size={10} />
                          <span>{contacts.phone}</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                      <User size={10} />
                      <span>Contact · Direct Line via ATOM Contacts</span>
                    </div>
                  )}
                </div>

                {/* Waveform */}
                <div className="flex items-center gap-3 py-2">
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-full"
                    style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)" }}
                  >
                    <Radio size={12} className="text-teal-400" />
                  </div>
                  <WaveformAnimation />
                  <span className="text-[10px] text-white/25 font-mono uppercase tracking-wider">ATOM Voice Active</span>
                </div>

                {/* Call script */}
                {!voiceBrief ? (
                  <div className="space-y-3">
                    <MonoLabel>Sonar-Personalized Call Script</MonoLabel>
                    <div
                      className="rounded-lg p-4 space-y-3"
                      style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)" }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>ATOM</span>
                        <p className="text-[12px] text-white/50 italic">
                          Click "ATOM Voice Brief" to generate your personalized call script based on Sonar research data for {result.company}.
                        </p>
                      </div>
                    </div>

                    {/* Discovery questions preview */}
                    <MonoLabel>Discovery Questions</MonoLabel>
                    <ul className="space-y-1.5">
                      {["What does your current infrastructure look like?", "What's your biggest operational challenge?", "Who else is evaluating this decision?"].map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px] text-white/35">
                          <ChevronRight size={12} className="text-teal-400/40 mt-0.5 shrink-0" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-4 fade-in">
                    {/* Opener */}
                    <div>
                      <MonoLabel>Sonar-Personalized Call Script</MonoLabel>
                      <div
                        className="mt-2 rounded-lg p-4 space-y-3"
                        style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)" }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>ATOM</span>
                          <p className="text-[12px] text-white/70 leading-relaxed">{voiceBrief.opener}</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>THEM</span>
                          <p className="text-[12px] text-white/35 leading-relaxed italic">
                            [Prospect response — listen for signals around current tooling, team size, and decision timeline]
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Discovery questions */}
                    {voiceBrief.discoveryQs.length > 0 && (
                      <div>
                        <MonoLabel>Discovery Questions</MonoLabel>
                        <ul className="mt-2 space-y-1.5">
                          {voiceBrief.discoveryQs.map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-white/55">
                              <ChevronRight size={12} className="text-teal-400/60 mt-0.5 shrink-0" />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Objection handlers */}
                    {voiceBrief.objections.length > 0 && (
                      <div>
                        <MonoLabel>Objection Handlers</MonoLabel>
                        <ul className="mt-2 space-y-1.5">
                          {voiceBrief.objections.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12px] text-white/45">
                              <Shield size={11} className="text-teal-400/50 mt-0.5 shrink-0" />
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Competitive map card */}
              <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={13} className="text-white/30" />
                    <MonoLabel>Warbook: {result.company} Competitive Map</MonoLabel>
                  </div>
                  <MonoLabel>WIN/LOSS VS. KEY PLAYERS</MonoLabel>
                </div>

                {voiceBrief && voiceBrief.competitiveMap.length > 0 ? (
                  <div className="space-y-3">
                    {voiceBrief.competitiveMap.map((comp, i) => (
                      <CompetitorBar key={i} name={comp.name} winRate={comp.winRate} />
                    ))}
                  </div>
                ) : wb?.competitors && wb.competitors.length > 0 ? (
                  <div className="space-y-3">
                    {wb.competitors.slice(0, 4).map((comp, i) => (
                      <CompetitorBar
                        key={i}
                        name={comp.name}
                        winRate={parseInt(comp.marketShare || "0") || Math.floor(Math.random() * 30 + 50)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[12px] text-white/25 py-2">
                    <BarChart3 size={13} />
                    <span>Run Sonar research to load competitive intelligence</span>
                  </div>
                )}

                {/* Pitch angles */}
                {wb?.battlePlan?.pitchAngles && wb.battlePlan.pitchAngles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <MonoLabel>ATOM Pitch Angles</MonoLabel>
                    <ul className="space-y-1.5">
                      {wb.battlePlan.pitchAngles.slice(0, 3).map((angle, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-white/40">
                          <Zap size={10} className="text-yellow-400/50 mt-0.5 shrink-0" />
                          {angle}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-1 border-t border-white/[0.06]">
                  <button
                    onClick={() => setLocation("/company-intelligence")}
                    className="flex items-center gap-1.5 text-[12px] text-white/35 hover:text-white/60 transition-colors group"
                  >
                    <span>Open Full Warbook</span>
                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Buying signals */}
              {wb?.buyingSignals && wb.buyingSignals.length > 0 && (
                <div className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap size={13} className="text-yellow-400/60" />
                    <MonoLabel>Buying Signals Detected</MonoLabel>
                    {wb.buyerIntentScore && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: "rgba(250,204,21,0.1)", color: "#fbbf24", border: "1px solid rgba(250,204,21,0.2)" }}
                      >
                        Intent: {wb.buyerIntentScore}/10
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {wb.buyingSignals.slice(0, 4).map((sig, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{
                            background: sig.intentScore && sig.intentScore >= 7 ? "#22d3ee" : "#00c8c8",
                          }}
                        />
                        <div className="space-y-0.5">
                          <p className="text-[12px] text-white/60">{sig.signal}</p>
                          {sig.category && <MonoLabel>{sig.category}</MonoLabel>}
                        </div>
                        {sig.intentScore && (
                          <span className="ml-auto text-[10px] text-white/25 font-mono shrink-0">{sig.intentScore}/10</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {result.citations && result.citations.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Globe size={11} className="text-white/20" />
                    <MonoLabel>Sonar Sources ({result.citations.length})</MonoLabel>
                  </div>
                  <div className="space-y-1">
                    {result.citations.slice(0, 5).map((cite, i) => (
                      <a
                        key={i}
                        href={cite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-cyan-400/70 transition-colors truncate group"
                      >
                        <ExternalLink size={9} className="shrink-0" />
                        <span className="truncate">{cite}</span>
                      </a>
                    ))}
                    {result.citations.length > 5 && (
                      <p className="text-[10px] text-white/20 font-mono">+{result.citations.length - 5} more sources</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* end right col */}

          </div>
        )}
      </div>
    </div>
  );
}
