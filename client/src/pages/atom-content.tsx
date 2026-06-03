import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, PenSquare, FolderKanban, Mic2, Activity, ShieldCheck, History,
  Loader2, Copy, Download, Check, AlertTriangle, Sparkles, Gauge, Zap,
  CheckCircle2, XCircle, Database, RefreshCw, ArrowRight, Newspaper,
  BookOpen, Linkedin, Twitter, Youtube, Rocket, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type ContentType =
  | "blog" | "case-study" | "whitepaper" | "linkedin" | "x-thread" | "youtube"
  | "launch" | "founder-pov" | "investor-insight" | "product-update"
  | "customer-success" | "seo-landing";

interface LiveMetric {
  metricKey: string; metricLabel: string; value: number; unit: string; display: string;
  sourceSystem: string; sourceRecordId: string | null; confidence: string;
  capturedAt: string; isDemo: boolean; usableInFinal: boolean; suggestableOnly: boolean;
}
interface LiveNumbersResult {
  metrics: LiveMetric[]; usable: LiveMetric[]; suggestable: LiveMetric[]; unusable: LiveMetric[];
  hasUsable: boolean; fallbackMessage: string | null; demoMode: boolean;
}
interface Evidence {
  provider: string; isDemo: boolean;
  liveNumbersUsed: Array<{ metric_key: string; label: string; value: string; source: string }>;
  availableMetrics: LiveMetric[];
  claims: Array<{ claimText: string; claimType: string; verified: string; riskLevel: string; note: string; sourceSystem: string | null; confidence: string | null }>;
  claimsNeedingVerification: any[];
  suggestedProofPoints: string[]; riskFlags: string[]; complianceWarnings: string[];
  ctaRecommendations: string[];
  voice: { score: number; summary: string; violations: any[]; bannedPhrasesFound: string[]; weakFillerFound: string[]; approvedPhrasesUsed: string[]; suggestedRewrites: string[] };
  claimReport: { score: number; summary: string };
  fallbackMessage: string | null;
  providerFallback: { requestedProvider: string; reason: string } | null;
}
interface GenerationRow { id: number; projectId: number; generatedOutput: string; voiceScore: number; claimScore: number; status: string; provider: string; createdAt: string; }
interface GenerateResponse { project: { id: number; title: string; contentType: string }; generation: GenerationRow; evidence: Evidence; }

const CONTENT_TYPES: Array<{ value: ContentType; label: string; icon: any; desc: string }> = [
  { value: "blog", label: "Blog", icon: BookOpen, desc: "900-1,500 word executive blog" },
  { value: "case-study", label: "Case Study", icon: FileText, desc: "Before/after with live numbers" },
  { value: "whitepaper", label: "Whitepaper", icon: Newspaper, desc: "Market shift + architecture + ROI" },
  { value: "linkedin", label: "LinkedIn Post", icon: Linkedin, desc: "Founder/exec single-idea post" },
  { value: "x-thread", label: "X Thread", icon: Twitter, desc: "Hook + 6-10 tweets + CTA" },
  { value: "youtube", label: "YouTube Description", icon: Youtube, desc: "Hook + learn + CTA + tags" },
  { value: "launch", label: "Launch Announcement", icon: Rocket, desc: "Capability + shift + next step" },
  { value: "founder-pov", label: "Founder POV", icon: Mic2, desc: "First-person conviction" },
  { value: "investor-insight", label: "Investor Insight", icon: Gauge, desc: "Market thesis + positioning" },
  { value: "product-update", label: "Product Update", icon: Zap, desc: "What shipped + why it matters" },
  { value: "customer-success", label: "Customer Success", icon: CheckCircle2, desc: "Outcome-first win story" },
  { value: "seo-landing", label: "SEO Landing", icon: Sparkles, desc: "Headline + proof + FAQ + CTA" },
];

const FUNNEL_STAGES = ["awareness", "consideration", "conversion", "retention", "investor", "partner"] as const;
const INTENSITIES: Array<{ value: string; label: string; hint: string }> = [
  { value: "calm", label: "Calm", hint: "Executive, polished, restrained" },
  { value: "sharp", label: "Sharp", hint: "Direct, competitive, conversion-focused" },
  { value: "war_mode", label: "War Mode", hint: "Aggressive, market-taking, high-conviction" },
];

type View = "dashboard" | "new" | "result" | "projects" | "voice" | "live" | "claims" | "approvals";

const NAV: Array<{ key: View; label: string; icon: any }> = [
  { key: "dashboard", label: "Dashboard", icon: FolderKanban },
  { key: "new", label: "New Content", icon: PenSquare },
  { key: "projects", label: "Projects", icon: FileText },
  { key: "voice", label: "Voice Profile", icon: Mic2 },
  { key: "live", label: "Live Numbers", icon: Activity },
  { key: "claims", label: "Claims Review", icon: ShieldCheck },
  { key: "approvals", label: "Approval Log", icon: History },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIMARY = "var(--color-primary, #2DD4D4)";
function scoreColor(s: number) { return s >= 85 ? "#34d399" : s >= 65 ? "#2DD4D4" : s >= 45 ? "#fbbf24" : "#f87171"; }
// apiRequest throws Error("<status>: <body>"); pull the publish-guard reasons out of the body.
function parseGuardError(err: any): string | null {
  const msg = String(err?.message || err || "");
  const m = msg.match(/^\d+:\s*(\{[\s\S]*\})$/);
  if (!m) return null;
  try {
    const body = JSON.parse(m[1]);
    const reasons: string[] = body?.guard?.reasons || [];
    const remediation: string[] = body?.guard?.remediation || [];
    if (!reasons.length) return null;
    return [...reasons, ...remediation].join(" ");
  } catch { return null; }
}
function confidenceBadge(c: string) {
  const map: Record<string, string> = {
    verified: "#34d399", high: "#2DD4D4", medium: "#fbbf24", low: "#fb923c", unverified: "#f87171",
  };
  return map[c] || "#94a3b8";
}
function panel(extra?: React.CSSProperties): React.CSSProperties {
  return { background: "#0c0c12", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, ...extra };
}

// ─── Component ──────────────────────────────────────────────────────────────────
export default function AtomContent() {
  const [view, setView] = useState<View>("dashboard");
  const [activeGenId, setActiveGenId] = useState<number | null>(null);
  const { toast } = useToast();

  return (
    <div className="min-h-full" style={{ color: "var(--color-text, #e8e8ec)" }}>
      {/* Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in oklab, var(--color-primary) 16%, transparent)", border: `1px solid color-mix(in oklab, var(--color-primary) 32%, transparent)` }}>
            <FileText className="w-5 h-5" style={{ color: PRIMARY }} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>ATOM Content</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted, #9aa0aa)" }}>
              Long-form revenue content with live proof and locked brand voice.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex flex-wrap gap-1.5 mb-6 p-1.5 rounded-xl" style={panel()}>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = view === n.key;
          return (
            <button key={n.key} onClick={() => setView(n.key)} data-testid={`content-nav-${n.key}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={active
                ? { background: "color-mix(in oklab, var(--color-primary) 14%, transparent)", color: PRIMARY }
                : { color: "var(--color-text-muted, #9aa0aa)" }}>
              <Icon className="w-4 h-4" /> {n.label}
            </button>
          );
        })}
      </div>

      {view === "dashboard" && <DashboardView onNew={() => setView("new")} onOpen={(id) => { setActiveGenId(id); setView("result"); }} onLive={() => setView("live")} onVoice={() => setView("voice")} onClaims={() => setView("claims")} />}
      {view === "new" && <NewContentView onGenerated={(id) => { setActiveGenId(id); setView("result"); }} />}
      {view === "result" && <ResultView generationId={activeGenId} onBack={() => setView("dashboard")} onOpen={(id) => setActiveGenId(id)} />}
      {view === "projects" && <ProjectsView onOpen={(id) => { setActiveGenId(id); setView("result"); }} />}
      {view === "voice" && <VoiceView />}
      {view === "live" && <LiveNumbersView />}
      {view === "claims" && <ClaimsView onOpen={(id) => { setActiveGenId(id); setView("result"); }} />}
      {view === "approvals" && <ApprovalLogView />}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardView({ onNew, onOpen, onLive, onVoice, onClaims }: { onNew: () => void; onOpen: (id: number) => void; onLive: () => void; onVoice: () => void; onClaims: () => void; }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/content/summary"] });

  const quick = CONTENT_TYPES.slice(0, 6);
  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Projects" value={data?.projectCount ?? "—"} icon={FolderKanban} onClick={onNew} />
        <StatCard label="Generations" value={data?.generationCount ?? "—"} icon={FileText} />
        <StatCard label="Approved" value={data?.approvedCount ?? "—"} icon={CheckCircle2} />
        <StatCard label="Usable Metrics" value={data?.metrics?.usable ?? "—"} icon={Activity} onClick={onLive} sub={`${data?.metrics?.total ?? 0} total`} />
      </div>

      {/* Quick actions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>Quick Start</h2>
          <Button size="sm" onClick={onNew} style={{ background: PRIMARY, color: "#06121a" }} data-testid="content-new-cta">
            <PenSquare className="w-4 h-4 mr-1.5" /> New Content
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quick.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={onNew} data-testid={`content-quick-${t.value}`}
                className="text-left p-4 rounded-xl transition-all hover:-translate-y-0.5"
                style={panel()}>
                <Icon className="w-5 h-5 mb-2" style={{ color: PRIMARY }} />
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{t.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {/* Voice status */}
        <button onClick={onVoice} className="text-left p-4 rounded-xl" style={panel()} data-testid="content-voice-status">
          <div className="flex items-center gap-2 mb-1"><Mic2 className="w-4 h-4" style={{ color: PRIMARY }} /><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Voice Profile</span></div>
          <div className="font-semibold text-sm">{data?.voiceProfile?.name || "No active profile"}</div>
          <div className="text-xs mt-1" style={{ color: scoreColor(90) }}>Brand voice locked <Check className="w-3 h-3 inline" /></div>
        </button>
        {/* Metric availability */}
        <button onClick={onLive} className="text-left p-4 rounded-xl" style={panel()} data-testid="content-metric-status">
          <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4" style={{ color: PRIMARY }} /><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Live Numbers</span></div>
          <div className="font-semibold text-sm">{data?.metrics?.usable ?? 0} usable · {data?.metrics?.suggestable ?? 0} review</div>
          <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{data?.metrics?.demoCount ?? 0} demo metrics seeded</div>
        </button>
        {/* Claim risk */}
        <button onClick={onClaims} className="text-left p-4 rounded-xl" style={panel()} data-testid="content-claim-status">
          <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4" style={{ color: PRIMARY }} /><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Claim Risk</span></div>
          <div className="font-semibold text-sm">Verification active</div>
          <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Every numeric claim checked vs. live data</div>
        </button>
      </div>

      {/* Recent generations */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: "var(--color-text-muted)" }}>Recent Generations</h2>
        <div className="rounded-xl overflow-hidden" style={panel()}>
          {isLoading ? (
            <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" style={{ color: PRIMARY }} /></div>
          ) : !data?.recent?.length ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
              No content generated yet. Start with <button onClick={onNew} className="underline" style={{ color: PRIMARY }}>New Content</button>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr style={{ color: "var(--color-text-muted)" }} className="text-left text-xs uppercase tracking-wider">
                <th className="px-4 py-2.5">Title</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Voice</th><th className="px-4 py-2.5">Claims</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {data.recent.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-white/[0.02] cursor-pointer" style={{ borderColor: "rgba(255,255,255,0.06)" }} onClick={() => onOpen(r.id)} data-testid={`content-recent-${r.id}`}>
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{r.contentType}</Badge></td>
                    <td className="px-4 py-3"><span style={{ color: scoreColor(r.voiceScore) }}>{Math.round(r.voiceScore)}</span></td>
                    <td className="px-4 py-3"><span style={{ color: scoreColor(r.claimScore) }}>{Math.round(r.claimScore)}</span></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{r.status}</Badge></td>
                    <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 inline" style={{ color: "var(--color-text-muted)" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, onClick, sub }: { label: string; value: any; icon: any; onClick?: () => void; sub?: string }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="text-left p-4 rounded-xl transition-all" style={panel()}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{label}</span>
        <Icon className="w-4 h-4" style={{ color: PRIMARY }} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{sub}</div>}
    </button>
  );
}

// ─── New Content ─────────────────────────────────────────────────────────────────
function NewContentView({ onGenerated }: { onGenerated: (id: number) => void }) {
  const { toast } = useToast();
  const [contentType, setContentType] = useState<ContentType>("linkedin");
  const [title, setTitle] = useState("");
  const [targetAudience, setTargetAudience] = useState("Founders and VP Sales leaders");
  const [funnelStage, setFunnelStage] = useState<string>("consideration");
  const [intensity, setIntensity] = useState<string>("sharp");
  const [primaryCta, setPrimaryCta] = useState("Book a live walkthrough.");
  const [productFocus, setProductFocus] = useState("ATOM Sales OS");
  const [sourceFrom, setSourceFrom] = useState("");
  const [sourceTo, setSourceTo] = useState("");
  const [allowDemoData, setAllowDemoData] = useState(false);
  const [notes, setNotes] = useState("");

  const { data: live } = useQuery<LiveNumbersResult>({
    queryKey: ["/api/content/live-numbers", allowDemoData ? "demo" : "prod"],
    queryFn: async () => (await apiRequest("GET", `/api/content/live-numbers?allowDemoData=${allowDemoData}`)).json(),
  });

  const gen = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/content/generate", {
        title: title || `${CONTENT_TYPES.find((c) => c.value === contentType)?.label} draft`,
        contentType, targetAudience, funnelStage, intensity, primaryCta, productFocus,
        sourceFrom: sourceFrom || null, sourceTo: sourceTo || null, allowDemoData, notes,
      });
      return (await r.json()) as GenerateResponse;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] });
      toast({ title: "Asset generated", description: `Voice ${Math.round(d.generation.voiceScore)} · Claims ${Math.round(d.generation.claimScore)}${d.evidence.isDemo ? " · DEMO" : ""}` });
      onGenerated(d.generation.id);
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card style={panel()}>
          <CardHeader><CardTitle className="text-base">Content Brief</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
                {CONTENT_TYPES.map((t) => {
                  const Icon = t.icon; const active = contentType === t.value;
                  return (
                    <button key={t.value} onClick={() => setContentType(t.value)} data-testid={`content-type-${t.value}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-left transition-all"
                      style={active ? { background: "color-mix(in oklab, var(--color-primary) 14%, transparent)", color: PRIMARY, border: `1px solid color-mix(in oklab, var(--color-primary) 40%, transparent)` } : { color: "var(--color-text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Icon className="w-4 h-4 shrink-0" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div><Label>Title / Campaign Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Why sales teams don't need more dashboards" className="mt-1.5" data-testid="content-title" /></div>
            <div><Label>Target Audience</Label><Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="mt-1.5" data-testid="content-audience" /></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Funnel Stage</Label>
                <Select value={funnelStage} onValueChange={setFunnelStage}>
                  <SelectTrigger className="mt-1.5" data-testid="content-funnel"><SelectValue /></SelectTrigger>
                  <SelectContent>{FUNNEL_STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intensity</Label>
                <Select value={intensity} onValueChange={setIntensity}>
                  <SelectTrigger className="mt-1.5" data-testid="content-intensity"><SelectValue /></SelectTrigger>
                  <SelectContent>{INTENSITIES.map((i) => <SelectItem key={i.value} value={i.value}>{i.label} — {i.hint}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Primary CTA</Label><Input value={primaryCta} onChange={(e) => setPrimaryCta(e.target.value)} className="mt-1.5" data-testid="content-cta" /></div>
              <div><Label>Product / Module Focus</Label><Input value={productFocus} onChange={(e) => setProductFocus(e.target.value)} className="mt-1.5" data-testid="content-focus" /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Source Activity From</Label><Input type="date" value={sourceFrom} onChange={(e) => setSourceFrom(e.target.value)} className="mt-1.5" /></div>
              <div><Label>Source Activity To</Label><Input type="date" value={sourceTo} onChange={(e) => setSourceTo(e.target.value)} className="mt-1.5" /></div>
            </div>
            <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" rows={2} data-testid="content-notes" /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text-muted)" }}>
              <input type="checkbox" checked={allowDemoData} onChange={(e) => setAllowDemoData(e.target.checked)} data-testid="content-demo-toggle" />
              Allow demo data (non-production drafts only)
            </label>
            <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="w-full" style={{ background: PRIMARY, color: "#06121a" }} data-testid="content-generate">
              {gen.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate Asset</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Live numbers panel */}
      <div className="space-y-4">
        <Card style={panel()}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" style={{ color: PRIMARY }} /> Live Numbers Available</CardTitle></CardHeader>
          <CardContent>
            {!live ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: PRIMARY }} /> : (
              <>
                {live.fallbackMessage && (
                  <div className="text-xs p-2.5 rounded-lg mb-3" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
                    <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> {live.fallbackMessage}
                  </div>
                )}
                <div className="space-y-2">
                  {live.metrics.length === 0 && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>No metrics in this window.</div>}
                  {live.metrics.map((m) => <MetricRow key={m.metricKey + m.sourceSystem} m={m} />)}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ m }: { m: LiveMetric }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{m.metricLabel} {m.isDemo && <span className="text-[10px] px-1 rounded" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>DEMO</span>}</div>
        <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>{m.sourceSystem} · {m.capturedAt.slice(0, 10)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold tabular-nums" style={{ color: PRIMARY }}>{m.display}</div>
        <div className="text-[10px] uppercase font-semibold" style={{ color: confidenceBadge(m.confidence) }}>{m.confidence}</div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{children}</label>;
}

// ─── Result / Evidence ─────────────────────────────────────────────────────────
function ResultView({ generationId, onBack, onOpen }: { generationId: number | null; onBack: () => void; onOpen: (id: number) => void }) {
  const { toast } = useToast();
  const [edited, setEdited] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/content/generations", generationId],
    queryFn: async () => (await apiRequest("GET", `/api/content/generations/${generationId}`)).json(),
    enabled: !!generationId,
  });

  const refine = useMutation({
    mutationFn: async (mode: string) => (await apiRequest("POST", "/api/content/refine", { generationId, mode })).json(),
    onSuccess: () => { setEdited(null); refetch(); queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] }); toast({ title: "Refined" }); },
    onError: (e: any) => toast({ title: "Refine failed", description: e.message, variant: "destructive" }),
  });
  const derive = useMutation({
    mutationFn: async (derivativeType: string) => (await apiRequest("POST", "/api/content/derivative", { generationId, derivativeType })).json() as Promise<GenerateResponse>,
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] }); toast({ title: "Derivative created" }); onOpen(d.generation.id); },
    onError: (e: any) => toast({ title: "Derivative failed", description: e.message, variant: "destructive" }),
  });
  const verify = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/content/generations/${generationId}/verify`, {})).json(),
    onSuccess: () => { refetch(); toast({ title: "Claims re-verified" }); },
  });
  const save = useMutation({
    mutationFn: async (content: string) => (await apiRequest("POST", `/api/content/generations/${generationId}/save`, { content })).json(),
    onSuccess: () => { setEdited(null); refetch(); queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] }); toast({ title: "Saved & re-scored" }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
  const approve = useMutation({
    mutationFn: async (action: string) => (await apiRequest("POST", "/api/content/approve", { generationId, action })).json(),
    onSuccess: (_d, action) => { refetch(); queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] }); toast({ title: `Marked ${action}` }); },
    onError: (err: any) => {
      // Surface the server-side publish guard's structured 422 block reason.
      const detail = parseGuardError(err);
      toast({
        title: detail ? "Blocked by claim guard" : "Action failed",
        description: detail || String(err?.message || err),
        variant: "destructive",
      });
    },
  });

  if (!generationId) return <Empty msg="Select a generation to view." />;
  if (isLoading || !data) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" style={{ color: PRIMARY }} /></div>;

  const gen = data.generation as GenerationRow;
  const ev = data.evidence as Evidence;
  const project = data.project;
  const content = edited ?? gen.generatedOutput;
  const dirty = edited !== null && edited !== gen.generatedOutput;
  const busy = refine.isPending || derive.isPending || approve.isPending || save.isPending;

  const exportAs = (kind: "md" | "json" | "html") => {
    if (dirty) { toast({ title: "Unsaved edits", description: "Save & re-score before exporting so the export reflects verified content.", variant: "destructive" }); return; }
    let blob: Blob; let name: string;
    if (kind === "md") { blob = new Blob([content], { type: "text/markdown" }); name = `atom-content-${gen.id}.md`; }
    else if (kind === "json") { blob = new Blob([JSON.stringify({ generation: gen, evidence: ev }, null, 2)], { type: "application/json" }); name = `atom-content-${gen.id}.json`; }
    else { blob = new Blob([`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:760px;margin:40px auto;white-space:pre-wrap">${content.replace(/</g, "&lt;")}</body>`], { type: "text/html" }); name = `atom-content-${gen.id}.html`; }
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    apiRequest("POST", "/api/content/approve", { generationId, action: "exported" }).catch(() => {});
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Content */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm flex items-center gap-1" style={{ color: "var(--color-text-muted)" }}>← Back</button>
          <div className="flex items-center gap-2">
            {ev?.isDemo && <Badge style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>DEMO OUTPUT</Badge>}
            <Badge variant="outline" className="capitalize">{project?.contentType}</Badge>
            <Badge variant="outline" className="capitalize">{gen.status}</Badge>
          </div>
        </div>

        {ev?.providerFallback && (
          <div className="text-xs p-2.5 rounded-lg" style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }} data-testid="content-provider-fallback">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Provider fallback: {ev.providerFallback.reason} This output is demo content, not AI-authored production proof.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ScoreCard label="Voice Compliance" score={gen.voiceScore} summary={ev?.voice?.summary} />
          <ScoreCard label="Claim Verification" score={gen.claimScore} summary={ev?.claimReport?.summary} />
        </div>

        <Card style={panel()}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{project?.title}</CardTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(content); toast({ title: "Copied" }); }} data-testid="content-copy"><Copy className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => exportAs("md")} title="Markdown">.md</Button>
              <Button size="sm" variant="outline" onClick={() => exportAs("json")} title="JSON">.json</Button>
              <Button size="sm" variant="outline" onClick={() => exportAs("html")} title="HTML">.html</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea value={content} onChange={(e) => setEdited(e.target.value)} rows={20} className="font-mono text-[13px] leading-relaxed" data-testid="content-output" />
            {dirty && (
              <div className="flex items-center justify-between gap-2 mt-2 text-xs p-2 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}>
                <span><AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Unsaved edits — scores below are stale. Save to re-score before exporting or approving.</span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => save.mutate(content)} disabled={save.isPending} style={{ background: PRIMARY, color: "#06121a" }} data-testid="content-save">{save.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save & Re-score"}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdited(null)} disabled={save.isPending}>Discard</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => refine.mutate("tighten")}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tighten Tone</Button>
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => refine.mutate("executive")}><Gauge className="w-3.5 h-3.5 mr-1.5" /> More Executive</Button>
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => refine.mutate("technical")}><Zap className="w-3.5 h-3.5 mr-1.5" /> More Technical</Button>
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => derive.mutate("linkedin")}><Linkedin className="w-3.5 h-3.5 mr-1.5" /> → LinkedIn</Button>
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => derive.mutate("x-thread")}><Twitter className="w-3.5 h-3.5 mr-1.5" /> → X Thread</Button>
          <Button size="sm" variant="outline" disabled={busy || dirty} onClick={() => derive.mutate("youtube")}><Youtube className="w-3.5 h-3.5 mr-1.5" /> → YouTube</Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => approve.mutate("approved")} disabled={busy || dirty} style={{ background: "#34d399", color: "#06121a" }} data-testid="content-approve"><Check className="w-4 h-4 mr-1.5" /> Approve</Button>
          <Button variant="outline" onClick={() => approve.mutate("revised")} disabled={busy || dirty}>Send for Revision</Button>
          <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending || dirty}>{verify.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-verify Claims"}</Button>
        </div>
      </div>

      {/* Evidence panel */}
      <div className="space-y-3">
        <EvidenceSection title="Live Numbers Used" icon={Activity}>
          {ev?.liveNumbersUsed?.length ? ev.liveNumbersUsed.map((n, i) => (
            <div key={i} className="text-xs flex justify-between gap-2 py-1"><span className="truncate">{n.label}</span><span style={{ color: PRIMARY }} className="font-bold shrink-0">{n.value}</span></div>
          )) : <Muted>No numeric claims — none invented.</Muted>}
        </EvidenceSection>

        <EvidenceSection title="Claims Needing Verification" icon={AlertTriangle}>
          {ev?.claimsNeedingVerification?.length ? ev.claimsNeedingVerification.map((c: any, i: number) => (
            <div key={i} className="text-xs py-1" style={{ color: "#fbbf24" }}>{c.claimText}</div>
          )) : <Muted>None.</Muted>}
        </EvidenceSection>

        <EvidenceSection title="Risk Flags" icon={XCircle}>
          {ev?.riskFlags?.length ? ev.riskFlags.map((r, i) => <div key={i} className="text-xs py-1" style={{ color: "#f87171" }}>{r}</div>) : <Muted>No risk flags.</Muted>}
        </EvidenceSection>

        <EvidenceSection title="Compliance Warnings" icon={ShieldCheck}>
          {ev?.complianceWarnings?.length ? ev.complianceWarnings.map((c, i) => <div key={i} className="text-xs py-1" style={{ color: "#fb923c" }}>{c}</div>) : <Muted>Clear.</Muted>}
        </EvidenceSection>

        <EvidenceSection title="Suggested Proof Points" icon={Database}>
          {ev?.suggestedProofPoints?.length ? ev.suggestedProofPoints.map((p, i) => <div key={i} className="text-xs py-1" style={{ color: "var(--color-text-muted)" }}>{p}</div>) : <Muted>None available.</Muted>}
        </EvidenceSection>

        <EvidenceSection title="CTA Recommendations" icon={ArrowRight}>
          {ev?.ctaRecommendations?.map((c, i) => <div key={i} className="text-xs py-1" style={{ color: "var(--color-text-muted)" }}>{c}</div>)}
        </EvidenceSection>

        <EvidenceSection title="Voice Notes" icon={Mic2}>
          {ev?.voice?.bannedPhrasesFound?.length ? <div className="text-xs py-1" style={{ color: "#f87171" }}>Banned: {ev.voice.bannedPhrasesFound.join(", ")}</div> : null}
          {ev?.voice?.weakFillerFound?.length ? <div className="text-xs py-1" style={{ color: "#fbbf24" }}>Filler: {ev.voice.weakFillerFound.join(", ")}</div> : null}
          {ev?.voice?.approvedPhrasesUsed?.length ? <div className="text-xs py-1" style={{ color: "#34d399" }}>Approved phrases: {ev.voice.approvedPhrasesUsed.join(", ")}</div> : null}
          {ev?.voice?.suggestedRewrites?.map((r, i) => <div key={i} className="text-xs py-1" style={{ color: "var(--color-text-muted)" }}>{r}</div>)}
          {!ev?.voice?.violations?.length && <Muted>On-voice. No violations.</Muted>}
        </EvidenceSection>
      </div>
    </div>
  );
}

function ScoreCard({ label, score, summary }: { label: string; score: number; summary?: string }) {
  const c = scoreColor(score);
  return (
    <div className="p-4 rounded-xl" style={panel()}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-text-muted)" }}>{label}</div>
      <div className="flex items-end gap-2"><div className="text-3xl font-bold tabular-nums" style={{ color: c }}>{Math.round(score)}</div><div className="text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>/100</div></div>
      <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}><div style={{ width: `${score}%`, height: "100%", background: c }} /></div>
      {summary && <div className="text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>{summary}</div>}
    </div>
  );
}
function EvidenceSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="p-3.5 rounded-xl" style={panel()}>
      <div className="flex items-center gap-2 mb-2"><Icon className="w-3.5 h-3.5" style={{ color: PRIMARY }} /><span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{title}</span></div>
      {children}
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) { return <div className="text-xs" style={{ color: "var(--color-text-faint, #6b7280)" }}>{children}</div>; }
function Empty({ msg }: { msg: string }) { return <div className="p-12 text-center text-sm rounded-xl" style={{ ...panel(), color: "var(--color-text-muted)" }}>{msg}</div>; }

// ─── Projects ───────────────────────────────────────────────────────────────────
function ProjectsView({ onOpen }: { onOpen: (id: number) => void }) {
  const { data: projects } = useQuery<any[]>({ queryKey: ["/api/content/projects"] });
  const { data: gens } = useQuery<GenerationRow[]>({ queryKey: ["/api/content/generations"] });
  if (!projects) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" style={{ color: PRIMARY }} /></div>;
  if (!projects.length) return <Empty msg="No projects yet." />;
  return (
    <div className="space-y-2">
      {projects.map((p) => {
        const latest = gens?.find((g) => g.projectId === p.id);
        return (
          <div key={p.id} className="p-4 rounded-xl flex items-center justify-between gap-3" style={panel()}>
            <div className="min-w-0">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{p.contentType} · {p.funnelStage} · {p.intensity} · {p.generations} generation(s)</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="capitalize">{p.status}</Badge>
              {latest && <Button size="sm" variant="outline" onClick={() => onOpen(latest.id)}>Open</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Voice Profile editor ─────────────────────────────────────────────────────────
function VoiceView() {
  const { toast } = useToast();
  const { data, refetch } = useQuery<any>({
    queryKey: ["/api/content/voice-profiles/active"],
    queryFn: async () => (await apiRequest("GET", "/api/content/voice-profiles/active")).json(),
  });
  const [yaml, setYaml] = useState<string | null>(null);
  const value = yaml ?? data?.profile?.yamlContent ?? "";

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/content/voice-profiles/${data.profile.id}`, { yamlContent: value, setActive: true })).json(),
    onSuccess: () => { setYaml(null); refetch(); toast({ title: "Voice profile saved", description: "Brand voice locked for all new generations." }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const parsed = data?.parsed;
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card style={panel()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">voice.yaml — {data?.profile?.name}</CardTitle>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !data?.profile} style={{ background: PRIMARY, color: "#06121a" }} data-testid="voice-save">
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Activate"}
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea value={value} onChange={(e) => setYaml(e.target.value)} rows={28} className="font-mono text-[12px] leading-relaxed" data-testid="voice-yaml" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Card style={panel()}>
          <CardHeader><CardTitle className="text-base">Parsed Voice Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {parsed ? (
              <>
                <div><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Brand</span><div>{parsed.brand_name} — {parsed.core_identity}</div></div>
                <div><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tone</span><div className="flex flex-wrap gap-1.5 mt-1">{parsed.tone.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}</div></div>
                <div><span className="text-xs uppercase tracking-wider" style={{ color: "#34d399" }}>Approved Phrases</span><ul className="text-xs mt-1 space-y-0.5" style={{ color: "var(--color-text-muted)" }}>{parsed.approved_phrases.map((p: string) => <li key={p}>✓ {p}</li>)}</ul></div>
                <div><span className="text-xs uppercase tracking-wider" style={{ color: "#f87171" }}>Banned Phrases</span><ul className="text-xs mt-1 space-y-0.5" style={{ color: "var(--color-text-muted)" }}>{parsed.banned_phrases.map((p: string) => <li key={p}>✕ {p}</li>)}</ul></div>
                <div><span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Compliance</span>
                  <ul className="text-xs mt-1 space-y-0.5" style={{ color: "var(--color-text-muted)" }}>
                    <li>Require metric verification: {String(parsed.compliance.require_metric_verification)}</li>
                    <li>Mark unverified claims: {String(parsed.compliance.mark_unverified_claims)}</li>
                    <li>Avoid absolute guarantees: {String(parsed.compliance.avoid_absolute_guarantees)}</li>
                  </ul>
                </div>
              </>
            ) : <Loader2 className="w-4 h-4 animate-spin" style={{ color: PRIMARY }} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Live Numbers ─────────────────────────────────────────────────────────────────
interface IngestedMetric {
  metricKey: string; metricLabel: string; value: number; unit: string;
  sourceSystem: string; sourceRecordId: string; confidence: string;
  capturedAt: string; metadata: Record<string, unknown>;
}
interface IngestionResponse {
  window: { from: string | null; to: string | null; windowId: string };
  metrics: IngestedMetric[];
  totalMetrics: number; availableSources: number; emptySources: string[];
  persisted?: number;
  adapters: Array<{ sourceSystem: string; description: string; available: boolean; metrics: IngestedMetric[] }>;
}

function LiveNumbersView() {
  const { toast } = useToast();
  const [demo, setDemo] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data } = useQuery<LiveNumbersResult>({
    queryKey: ["/api/content/live-numbers", "panel", demo],
    queryFn: async () => (await apiRequest("GET", `/api/content/live-numbers?allowDemoData=${demo}`)).json(),
  });

  const body = () => ({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  });
  const [preview, setPreview] = useState<IngestionResponse | null>(null);

  const previewMut = useMutation({
    mutationFn: async () => {
      const p = new URLSearchParams();
      const b = body();
      if (b.from) p.set("from", b.from);
      if (b.to) p.set("to", b.to);
      return (await apiRequest("GET", `/api/content/live-metrics/preview?${p.toString()}`)).json() as Promise<IngestionResponse>;
    },
    onSuccess: (d) => { setPreview(d); toast({ title: `Preview: ${d.totalMetrics} production metric(s)`, description: d.emptySources.length ? `Empty sources: ${d.emptySources.join(", ")}` : "All sources produced data." }); },
    onError: (e: any) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const ingestMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/content/live-metrics/ingest", body())).json() as Promise<IngestionResponse>,
    onSuccess: (d) => {
      setPreview(d);
      queryClient.invalidateQueries({ queryKey: ["/api/content/live-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content/summary"] });
      toast({ title: `Ingested ${d.persisted ?? d.totalMetrics} production metric(s)`, description: "Written as demo=false. Demo metrics untouched." });
    },
    onError: (e: any) => toast({ title: "Ingest failed", description: e.message, variant: "destructive" }),
  });

  const win = preview?.window;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Only verified & high-confidence metrics can back factual claims. Each carries source, timestamp, and confidence.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} data-testid="live-demo-toggle" /> Show demo data</label>
      </div>

      {/* ── Production ingestion control ─────────────────────────────────── */}
      <div className="p-4 rounded-xl" style={panel()}>
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4" style={{ color: PRIMARY }} />
          <span className="text-sm font-semibold">Ingest production proof</span>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          Derives real metrics from persisted production data (prospects, campaigns). Writes <code>demo=false</code> rows only — seeded demo metrics are never overwritten or promoted.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>From (optional)</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 mt-1" data-testid="ingest-from" /></div>
          <div><Label>To (optional)</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 mt-1" data-testid="ingest-to" /></div>
          <Button variant="outline" size="sm" onClick={() => previewMut.mutate()} disabled={previewMut.isPending} data-testid="ingest-preview">
            {previewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Preview"}
          </Button>
          <Button size="sm" onClick={() => ingestMut.mutate()} disabled={ingestMut.isPending} data-testid="ingest-run" style={{ background: PRIMARY, color: "#04201d" }}>
            {ingestMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ingest now"}
          </Button>
        </div>
        {preview && (
          <div className="mt-3 text-xs space-y-2">
            <div style={{ color: "var(--color-text-muted)" }}>
              Window: <span className="font-mono">{win?.from?.slice(0, 10) || "all-time"}</span> → <span className="font-mono">{win?.to?.slice(0, 10) || "now"}</span>
              {typeof preview.persisted === "number" && <> · <span style={{ color: "#34d399" }}>persisted {preview.persisted}</span></>}
              · {preview.availableSources} source(s) with data
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {preview.metrics.map((m) => (
                <div key={m.metricKey + m.sourceSystem} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.metricLabel}</div>
                    <div className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>{m.sourceSystem} · {m.confidence}</div>
                  </div>
                  <div className="font-bold tabular-nums shrink-0" style={{ color: PRIMARY }}>{m.value}{m.unit === "%" ? "%" : m.unit ? ` ${m.unit}` : ""}</div>
                </div>
              ))}
              {preview.metrics.length === 0 && <Muted>No production rows in this window — nothing fabricated.</Muted>}
            </div>
          </div>
        )}
      </div>

      <ActivityEventsCard />

      {data?.fallbackMessage && <div className="text-xs p-3 rounded-lg" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24" }}><AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> {data.fallbackMessage}</div>}
      <div className="grid md:grid-cols-3 gap-3">
        <Bucket title="Usable (final content)" color="#34d399" items={data?.usable || []} />
        <Bucket title="Suggestable (needs review)" color="#fbbf24" items={data?.suggestable || []} />
        <Bucket title="Unusable (low / unverified)" color="#f87171" items={data?.unusable || []} />
      </div>
    </div>
  );
}
// First-class event feed — read-only operator/debug view of recent production
// event counts by type. Demo events are reported separately and never counted
// as production proof. No test-event ingestion from the UI (production-safe).
interface RecentEventsResponse {
  countsByType: Record<string, number>;
  totalProduction: number;
  demoTotal: number;
  sample: Array<{ id: number; eventType: string; sourceSystem: string; occurredAt: string; isDemo: boolean }>;
}
interface WebhookStatusResponse {
  tokenConfigured: boolean;
  failClosedInProduction: boolean;
  channels: Array<{ channel: string; path: string; description: string; emits: string[] }>;
}
const EVENT_LABELS: Record<string, string> = {
  email_sent: "Emails sent", outreach_sent: "Outreach sent", reply_received: "Replies",
  meeting_booked: "Meetings booked", conversation_event: "Conversations",
  followup_completed: "Follow-ups", lead_captured: "Leads captured",
};
function ActivityEventsCard() {
  const { data } = useQuery<RecentEventsResponse>({
    queryKey: ["/api/content/activity-events/recent"],
    queryFn: async () => (await apiRequest("GET", "/api/content/activity-events/recent")).json(),
  });
  const { data: webhooks } = useQuery<WebhookStatusResponse>({
    queryKey: ["/api/content/activity-events/webhooks/status"],
    queryFn: async () => (await apiRequest("GET", "/api/content/activity-events/webhooks/status")).json(),
  });
  const entries = Object.entries(data?.countsByType || {});
  return (
    <div className="p-4 rounded-xl" style={panel()}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: PRIMARY }} />
          <span className="text-sm font-semibold">First-class event feed</span>
          <Badge variant="outline" className="text-[10px]">source: atom-activity-events</Badge>
        </div>
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {data?.totalProduction ?? 0} production event(s){data?.demoTotal ? ` · ${data.demoTotal} demo (excluded)` : ""}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
        Raw production events (email/outreach sent, replies, meetings, conversations, follow-ups, leads) posted by product systems via <code>POST /api/content/activity-events</code>. The <code>atom-activity-events</code> adapter derives verified metrics directly from these counts.
      </p>
      {entries.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {entries.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-xs truncate">{EVENT_LABELS[type] || type}</span>
              <span className="font-bold tabular-nums shrink-0" style={{ color: PRIMARY }}>{count}</span>
            </div>
          ))}
        </div>
      ) : (
        <Muted>No production events ingested yet. Connect a product system or POST to the activity-events endpoint — nothing is fabricated.</Muted>
      )}
      {webhooks && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">Provider webhook layer</span>
            <Badge variant="outline" className="text-[10px]" style={webhooks.tokenConfigured ? { color: "#34d399", borderColor: "#34d39955" } : { color: "#f59e0b", borderColor: "#f59e0b55" }}>
              {webhooks.tokenConfigured ? "auth configured" : "auth not set (dev only)"}
            </Badge>
          </div>
          <p className="text-[11px] mb-2" style={{ color: "var(--color-text-muted)" }}>
            Real external producers POST native payloads here; each is normalized into the event feed above, idempotent on the provider's own event id. Bearer-token guarded, fails closed in production. No secrets shown.
          </p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {webhooks.channels.map((c) => (
              <div key={c.channel} className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <code className="text-[10px] truncate">…/webhooks/{c.channel}</code>
                <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-muted)" }}>{c.emits.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Bucket({ title, color, items }: { title: string; color: string; items: LiveMetric[] }) {
  return (
    <div className="p-4 rounded-xl" style={panel()}>
      <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color }}>{title} · {items.length}</div>
      <div className="space-y-2">{items.length ? items.map((m) => <MetricRow key={m.metricKey + m.sourceSystem} m={m} />) : <Muted>None.</Muted>}</div>
    </div>
  );
}

// ─── Claims Review ───────────────────────────────────────────────────────────────
function ClaimsView({ onOpen }: { onOpen: (id: number) => void }) {
  const { data } = useQuery<any[]>({ queryKey: ["/api/content/claims"] });
  if (!data) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" style={{ color: PRIMARY }} /></div>;
  if (!data.length) return <Empty msg="No claims recorded yet. Generate content to populate this." />;
  return (
    <div className="rounded-xl overflow-hidden" style={panel()}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
          <th className="px-4 py-2.5">Claim</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Verdict</th><th className="px-4 py-2.5">Risk</th><th className="px-4 py-2.5">Source</th><th className="px-4 py-2.5"></th>
        </tr></thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <td className="px-4 py-3 max-w-md truncate">{c.claimText}</td>
              <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{c.claimType}</Badge></td>
              <td className="px-4 py-3"><span className="text-xs font-semibold" style={{ color: c.verified === "verified" ? "#34d399" : c.verified === "rejected" ? "#f87171" : "#fbbf24" }}>{c.verified}</span></td>
              <td className="px-4 py-3"><span className="text-xs" style={{ color: c.riskLevel === "high" ? "#f87171" : c.riskLevel === "medium" ? "#fbbf24" : "#34d399" }}>{c.riskLevel}</span></td>
              <td className="px-4 py-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{c.sourceSystem || "—"}{c.confidence ? ` (${c.confidence})` : ""}</td>
              <td className="px-4 py-3 text-right"><button onClick={() => onOpen(c.generationId)} className="text-xs underline" style={{ color: PRIMARY }}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Approval Log ─────────────────────────────────────────────────────────────────
function ApprovalLogView() {
  const { data } = useQuery<any[]>({ queryKey: ["/api/content/approval-log"] });
  if (!data) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" style={{ color: PRIMARY }} /></div>;
  if (!data.length) return <Empty msg="No approvals logged yet." />;
  return (
    <div className="space-y-2">
      {data.map((e) => (
        <div key={e.id} className="p-3.5 rounded-xl flex items-center gap-3" style={panel()}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in oklab, var(--color-primary) 14%, transparent)" }}>
            {e.action === "approved" ? <Check className="w-4 h-4" style={{ color: "#34d399" }} /> : e.action === "exported" ? <Download className="w-4 h-4" style={{ color: PRIMARY }} /> : <History className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-mono">{e.outcome}</div>
            {e.notes && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{e.notes}</div>}
          </div>
          <Badge variant="outline" className="capitalize shrink-0">{e.action}</Badge>
        </div>
      ))}
    </div>
  );
}
