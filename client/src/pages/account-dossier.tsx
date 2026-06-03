import { useState, useCallback, useRef, useEffect } from "react";
import {
  Crosshair, Building2, Globe, User, Briefcase, Link2, Target,
  Sparkles, Play, Copy, Check, AlertTriangle, Loader2, Brain,
  TrendingUp, Zap, Clock, Flag, FileJson, ChevronDown, ScrollText,
  ShieldCheck, Lightbulb, MessageSquare, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCachedTenant } from "@/lib/useTenant";

// ─── Types (mirror api/atom/researcher/dossiers.ts response shape) ──────────────

interface DossierSnapshot {
  company_one_liner?: string;
  contact_one_liner?: string;
  best_buyer_persona_if_no_contact?: string;
  why_reach_out_now?: string;
  recommended_solution_angle?: string;
  solution_routing_rationale?: string;
  pitch_hook?: string;
  top_pain_hypothesis?: string;
  strongest_trigger_event?: string;
  best_opener?: string;
  confidence_score?: string;
  confidence_rationale?: string;
  recommended_call_duration?: string;
  deal_potential?: string;
  next_best_action?: string;
}

interface DossierRow {
  id?: string;
  dossier_id?: string;
  target_company?: string;
  confidence_score?: string | null;
  deal_potential?: string | null;
  model_used?: string;
  dossier_json?: any;
}

interface DossierResponse {
  ok: boolean;
  persisted?: boolean;
  dossier?: DossierRow;
  snapshot?: DossierSnapshot;
  sources_saved?: number;
  error?: string;
  details?: string | string[];
}

interface FormState {
  target_company: string;
  target_domain: string;
  target_contact_name: string;
  target_contact_title: string;
  contact_linkedin_url: string;
  company_website: string;
  solution_being_positioned: string;
  call_type: string;
  relationship_stage: string;
  primary_goal: string;
  known_context: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SOLUTIONS = [
  "Auto", "ATOM", "AntimatterAI", "ClinixAI", "HumanOS", "RRG.bio",
  "Thingk Tangk", "Nirmata Holdings",
];

const CALL_TYPES = [
  "Cold Outreach", "Discovery", "Demo", "Follow-up", "Re-engagement",
  "Customer Success", "Partnership", "Investor", "Renewal", "Expansion", "Other",
];

const RELATIONSHIP_STAGES = [
  "Net New", "Existing Customer", "Former Customer", "Partner", "Investor", "Unknown",
];

const EMPTY_FORM: FormState = {
  target_company: "",
  target_domain: "",
  target_contact_name: "",
  target_contact_title: "",
  contact_linkedin_url: "",
  company_website: "",
  solution_being_positioned: "Auto",
  call_type: "",
  relationship_stage: "",
  primary_goal: "",
  known_context: "",
};

const LOADING_STAGES = [
  "Dispatching ATOM Researcher",
  "Validating target identity",
  "Scanning official + recent sources",
  "Detecting active buying signals",
  "Mapping pain to solution fit",
  "Drafting call strategy + opener",
  "Verifying citations",
  "Compiling account dossier",
];

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/35">{children}</span>;
}

function CopyButton({ value, label, testId }: { value: string; label?: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Copy failed", description: "Clipboard unavailable in this context.", variant: "destructive" });
    }
  }, [value, toast]);
  return (
    <button
      type="button"
      onClick={onCopy}
      data-testid={testId}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/45 border border-white/[0.08] hover:border-white/25 hover:text-white/80 transition-colors shrink-0"
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      {copied ? "Copied" : (label || "Copy")}
    </button>
  );
}

function Field({
  label, icon: Icon, value, onChange, placeholder, type = "text", required, testId,
}: {
  label: string; icon: any; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; testId: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5">
        <Icon size={11} className="text-cyan-400/60" />
        <Mono>{label}{required ? " *" : ""}</Mono>
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text)",
        }}
      />
    </label>
  );
}

function SelectField({
  label, icon: Icon, value, onChange, options, placeholder, testId,
}: {
  label: string; icon: any; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; testId: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5">
        <Icon size={11} className="text-cyan-400/60" />
        <Mono>{label}</Mono>
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className="w-full appearance-none rounded-lg px-3 py-2 pr-8 text-[13px] outline-none transition-colors"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: value ? "var(--color-text)" : "var(--color-text-faint)",
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o} value={o} style={{ background: "#0b0e10", color: "#eef6f5" }}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
      </div>
    </label>
  );
}

function confidenceColor(c?: string | null): string {
  switch ((c || "").toUpperCase()) {
    case "HIGH": return "#34d399";
    case "MEDIUM": return "#fbbf24";
    case "LOW": return "#f87171";
    default: return "#9ca3af";
  }
}

function MetricChip({ label, value, color, testId }: { label: string; value: string; color?: string; testId: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
    >
      <Mono>{label}</Mono>
      <span className="text-[13px] font-semibold" style={{ color: color || "var(--color-text)" }} data-testid={testId}>
        {value || "—"}
      </span>
    </div>
  );
}

function SnapshotCard({
  title, icon: Icon, body, copyable, testId,
}: {
  title: string; icon: any; body?: string; copyable?: boolean; testId: string;
}) {
  if (!body || !body.trim()) return null;
  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} className="text-cyan-400/70" />
          <Mono>{title}</Mono>
        </div>
        {copyable && <CopyButton value={body} testId={`${testId}-copy`} />}
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-text)" }} data-testid={testId}>
        {body}
      </p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AccountDossier() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<DossierResponse | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const set = useCallback((k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  // Cycle through loading stages while the LLM works.
  useEffect(() => {
    if (running) {
      setStageIdx(0);
      stageTimer.current = setInterval(() => {
        setStageIdx((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
      }, 4000);
    } else if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [running]);

  const handleRun = useCallback(async () => {
    if (!form.target_company.trim()) {
      toast({ title: "Target company required", description: "Enter the company you're researching.", variant: "destructive" });
      return;
    }
    setRunning(true);
    setResponse(null);

    // Only send non-empty fields; the route validates URLs and rejects empties.
    const body: Record<string, string> = { target_company: form.target_company.trim() };
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
      const v = form[k].trim();
      if (k === "target_company") return;
      if (k === "solution_being_positioned" && v === "Auto") return; // route defaults to auto
      if (v) body[k] = v;
    });

    try {
      const tenantSlug = getCachedTenant().slug;
      const r = await fetch("/api/atom/researcher/dossiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tenantSlug ? { "X-Tenant-Slug": tenantSlug } : {}),
        },
        body: JSON.stringify(body),
      });
      const data: DossierResponse = await r.json().catch(() => ({
        ok: false, error: "bad_response", details: "Malformed response from the dossier service.",
      }));
      setResponse(data);
      if (data.ok) {
        const company = data.dossier?.target_company || form.target_company;
        toast({ title: "Dossier ready", description: `${company} · ${data.dossier?.confidence_score || "?"} confidence` });
      } else {
        toast({
          title: "Dossier failed",
          description: formatError(data) || "Unknown error.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setResponse({ ok: false, error: "network_error", details: err?.message || "Network request failed." });
      toast({ title: "Network error", description: err?.message || "Could not reach the researcher.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }, [form, toast]);

  const snapshot = response?.ok ? (response.snapshot || {}) : {};
  const dossier = response?.ok ? response.dossier : undefined;
  const dossierId = dossier?.dossier_id || "";

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }} className="space-y-5">
      <style>{`
        .atomr-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:12px}
        .atomr-anim-bar{background:linear-gradient(90deg,#22e6d6,#8b5cf6,#3b82f6,#22e6d6);background-size:300% 100%;animation:atomrGrad 6s ease infinite}
        @keyframes atomrGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .atomr-cta{color:var(--color-text-inverse);background:linear-gradient(96deg,var(--color-primary),var(--color-primary-2));border:1px solid color-mix(in oklab,var(--color-primary) 60%,transparent);transition:filter .15s ease}
        .atomr-cta:not(:disabled):hover{filter:brightness(1.08)}
      `}</style>
      {/* Header */}
      <div className="atomr-card px-5 py-4 relative overflow-hidden">
        {running && <div className="absolute top-0 left-0 right-0 h-[2px] atomr-anim-bar" />}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl"
              style={{ background: "rgba(34,230,214,0.1)", border: "1px solid rgba(34,230,214,0.28)" }}
            >
              <Crosshair size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight" style={{ color: "var(--color-text)" }} data-testid="dossier-title">
                ΔTOM Account Dossier
              </h1>
              <p className="text-[12px] text-white/45">
                Tactical, source-backed account intelligence before the call.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5 items-start">
        {/* ── Input panel ── */}
        <div className="atomr-card p-5 space-y-4">
          <div className="flex items-center gap-1.5">
            <Target size={13} className="text-cyan-400/70" />
            <Mono>Target Briefing</Mono>
          </div>

          <Field label="Target Company" icon={Building2} value={form.target_company}
            onChange={(v) => set("target_company", v)} placeholder="Acme Robotics" required testId="input-target-company" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain" icon={Globe} value={form.target_domain}
              onChange={(v) => set("target_domain", v)} placeholder="acme.com" testId="input-target-domain" />
            <Field label="Company Website" icon={Link2} value={form.company_website}
              onChange={(v) => set("company_website", v)} placeholder="https://acme.com" testId="input-company-website" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Name" icon={User} value={form.target_contact_name}
              onChange={(v) => set("target_contact_name", v)} placeholder="Jane Doe" testId="input-contact-name" />
            <Field label="Contact Title" icon={Briefcase} value={form.target_contact_title}
              onChange={(v) => set("target_contact_title", v)} placeholder="VP Sales" testId="input-contact-title" />
          </div>

          <Field label="Contact LinkedIn URL" icon={Link2} value={form.contact_linkedin_url}
            onChange={(v) => set("contact_linkedin_url", v)} placeholder="https://linkedin.com/in/…" testId="input-linkedin" />

          <SelectField label="Solution Being Positioned" icon={Sparkles} value={form.solution_being_positioned}
            onChange={(v) => set("solution_being_positioned", v)} options={SOLUTIONS} testId="select-solution" />

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Call Type" icon={MessageSquare} value={form.call_type}
              onChange={(v) => set("call_type", v)} options={CALL_TYPES} placeholder="Select…" testId="select-call-type" />
            <SelectField label="Relationship Stage" icon={Flag} value={form.relationship_stage}
              onChange={(v) => set("relationship_stage", v)} options={RELATIONSHIP_STAGES} placeholder="Select…" testId="select-relationship" />
          </div>

          <Field label="Primary Goal" icon={Target} value={form.primary_goal}
            onChange={(v) => set("primary_goal", v)} placeholder="Book a discovery call" testId="input-primary-goal" />

          <label className="block space-y-1">
            <span className="flex items-center gap-1.5">
              <ScrollText size={11} className="text-cyan-400/60" />
              <Mono>Known Context</Mono>
            </span>
            <textarea
              value={form.known_context}
              onChange={(e) => set("known_context", e.target.value)}
              rows={4}
              placeholder="Anything you already know — prior touches, intel, constraints…"
              data-testid="input-known-context"
              className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-y"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
            />
          </label>

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            data-testid="button-generate-dossier"
            className="w-full atomr-cta inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {running ? "Researching…" : "Generate Dossier"}
          </button>
        </div>

        {/* ── Output panel ── */}
        <div className="space-y-5 min-w-0">
          {/* Loading state */}
          {running && (
            <div className="atomr-card p-6 flex flex-col items-center text-center gap-3" data-testid="dossier-loading">
              <div className="relative">
                <Brain size={34} className="text-cyan-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-[14px] font-semibold" style={{ color: "var(--color-text)" }}>
                  {LOADING_STAGES[stageIdx]}…
                </p>
                <p className="text-[12px] text-white/45 max-w-sm">
                  ATOM Researcher is running live LLM research. This can take 30–90 seconds — sit tight, the dossier is worth it.
                </p>
              </div>
              <div className="flex gap-1 mt-1">
                {LOADING_STAGES.map((_, i) => (
                  <div key={i} className="h-1 w-6 rounded-full transition-colors"
                    style={{ background: i <= stageIdx ? "var(--color-primary)" : "rgba(255,255,255,0.1)" }} />
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {!running && response && !response.ok && (
            <div
              className="atomr-card p-5 space-y-2"
              style={{ borderColor: "rgba(248,113,113,0.4)" }}
              data-testid="dossier-error"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-[14px] font-semibold text-red-300">Dossier generation failed</span>
              </div>
              <p className="text-[12px] text-white/60 leading-relaxed" data-testid="dossier-error-detail">
                {formatError(response)}
              </p>
              <p className="text-[12px] text-white/40">{errorHint(response.error)}</p>
            </div>
          )}

          {/* Empty state */}
          {!running && !response && (
            <div className="atomr-card p-8 flex flex-col items-center text-center gap-2" data-testid="dossier-empty">
              <Crosshair size={28} className="text-white/20" />
              <p className="text-[13px] text-white/50">
                Enter a target company and generate a tactical account dossier.
              </p>
            </div>
          )}

          {/* Success state */}
          {!running && response?.ok && (
            <div className="space-y-5" data-testid="dossier-result">
              {/* Metrics bar */}
              <div className="atomr-card p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={15} className="text-cyan-400 shrink-0" />
                    <span className="text-[15px] font-bold truncate" style={{ color: "var(--color-text)" }} data-testid="result-company">
                      {dossier?.target_company || form.target_company}
                    </span>
                    {!response.persisted && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-300/80 shrink-0">
                        not saved
                      </span>
                    )}
                  </div>
                  {dossierId && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-white/40" data-testid="result-dossier-id">{dossierId}</span>
                      <CopyButton value={dossierId} label="ID" testId="copy-dossier-id" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricChip label="Confidence" value={(dossier?.confidence_score || snapshot.confidence_score || "—") as string}
                    color={confidenceColor(dossier?.confidence_score || snapshot.confidence_score)} testId="result-confidence" />
                  <MetricChip label="Deal Potential" value={(dossier?.deal_potential || snapshot.deal_potential || "—") as string} testId="result-deal-potential" />
                  <MetricChip label="Model" value={dossier?.model_used || "—"} testId="result-model" />
                  <MetricChip label="Sources Saved" value={String(response.sources_saved ?? 0)} testId="result-sources-saved" />
                </div>
                {snapshot.recommended_call_duration && (
                  <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                    <Clock size={11} /> Recommended call duration: <span className="text-white/70">{snapshot.recommended_call_duration}</span>
                  </div>
                )}
              </div>

              {/* Snapshot cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SnapshotCard title="Company One-Liner" icon={Building2} body={snapshot.company_one_liner} testId="card-company-one-liner" />
                <SnapshotCard title="Why Reach Out Now" icon={Zap} body={snapshot.why_reach_out_now} testId="card-why-now" />
                <SnapshotCard title="Recommended Solution Angle" icon={Sparkles} body={snapshot.recommended_solution_angle} testId="card-solution-angle" />
                <SnapshotCard title="Top Pain Hypothesis" icon={AlertTriangle} body={snapshot.top_pain_hypothesis} testId="card-pain" />
                <SnapshotCard title="Strongest Trigger Event" icon={TrendingUp} body={snapshot.strongest_trigger_event} testId="card-trigger" />
                <SnapshotCard title="Pitch Hook" icon={Lightbulb} body={snapshot.pitch_hook} copyable testId="card-pitch-hook" />
                <SnapshotCard title="Best Opener" icon={MessageSquare} body={snapshot.best_opener} copyable testId="card-best-opener" />
                <SnapshotCard title="Next Best Action" icon={ArrowRight} body={snapshot.next_best_action} copyable testId="card-next-action" />
              </div>

              {/* Supporting snapshot context */}
              {(snapshot.contact_one_liner || snapshot.best_buyer_persona_if_no_contact || snapshot.solution_routing_rationale || snapshot.confidence_rationale) && (
                <div className="atomr-card p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-cyan-400/70" />
                    <Mono>Supporting Intelligence</Mono>
                  </div>
                  <div className="space-y-2.5">
                    {snapshot.contact_one_liner && <KV label="Contact" value={snapshot.contact_one_liner} testId="kv-contact" />}
                    {snapshot.best_buyer_persona_if_no_contact && <KV label="Buyer Persona" value={snapshot.best_buyer_persona_if_no_contact} testId="kv-persona" />}
                    {snapshot.solution_routing_rationale && <KV label="Routing Rationale" value={snapshot.solution_routing_rationale} testId="kv-routing" />}
                    {snapshot.confidence_rationale && <KV label="Confidence Rationale" value={snapshot.confidence_rationale} testId="kv-confidence-rationale" />}
                  </div>
                </div>
              )}

              {/* Raw JSON (collapsible) */}
              {dossier?.dossier_json && (
                <details className="atomr-card p-4 group" data-testid="dossier-json">
                  <summary className="flex items-center gap-1.5 cursor-pointer list-none">
                    <FileJson size={13} className="text-cyan-400/70" />
                    <Mono>Full Dossier JSON</Mono>
                    <ChevronDown size={14} className="text-white/35 ml-auto group-open:rotate-180 transition-transform" />
                  </summary>
                  <pre className="mt-3 text-[11px] leading-relaxed overflow-auto max-h-96 rounded-lg p-3 font-mono"
                    style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                    {JSON.stringify(dossier.dossier_json, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="space-y-0.5">
      <Mono>{label}</Mono>
      <p className="text-[12px] leading-relaxed text-white/70" data-testid={testId}>{value}</p>
    </div>
  );
}

function formatError(r: DossierResponse): string {
  if (Array.isArray(r.details)) return r.details.join("; ");
  return (r.details as string) || r.error || "Unexpected error.";
}

function errorHint(code?: string): string {
  switch (code) {
    case "ai_not_configured": return "The server is missing an AI provider key. Contact an admin to configure ANTHROPIC_API_KEY.";
    case "invalid_request": return "Check the highlighted fields — URLs must be fully-qualified (https://…).";
    case "timeout": return "Deep research timed out. Try again, or narrow the target.";
    case "dossier_schema_mismatch":
    case "invalid_dossier_json": return "The model returned an unexpected shape. Re-run to retry generation.";
    default: return "Try again. If this persists, capture the dossier ID and notify an admin.";
  }
}
