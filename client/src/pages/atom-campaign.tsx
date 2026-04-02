import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BRIDGE_URL = "https://45-79-202-76.sslip.io";

const PRODUCTS = [
  "Antimatter AI Platform",
  "ATOM Enterprise",
  "Vidzee",
  "Clinix Agent",
  "Red Team ATOM",
];

const GEO_OPTIONS = ["US", "EU", "US + EU", "Global"];

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = "setup" | "researching" | "review" | "active" | "paused" | "complete";
type TargetStatus = "queued" | "calling" | "connected" | "completed" | "failed" | "skipped";
type Disposition = "qualified" | "not_interested" | "no_answer" | "callback" | "hot_lead";

interface CampaignForm {
  brief: string;
  targetIndustry: string;
  targetGeo: string;
  targetCount: number;
  productSlug: string;
  alertEmail: string;
}

interface DecisionMaker {
  name: string;
  title: string;
  linkedin?: string;
}

interface Target {
  id: string;
  rank: number;
  companyName: string;
  industry: string;
  size: string;
  location: string;
  decisionMaker: DecisionMaker;
  email?: string;
  phone?: string;
  tags: string[];
  status: TargetStatus;
}

interface TranscriptLine {
  speaker: "ATOM" | "Prospect";
  text: string;
  ts: number;
}

interface CallHistoryEntry {
  targetId: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  duration: number; // seconds
  sentiment: number;
  intent: number;
  disposition: Disposition;
  transcript: TranscriptLine[];
  expanded: boolean;
}

interface HotLead {
  targetId: string;
  companyName: string;
  contactName: string;
  sentiment: number;
  intent: number;
  buyingSignals: string[];
}

interface LiveCallState {
  targetId: string | null;
  companyName: string;
  contactName: string;
  contactTitle: string;
  sentiment: number;
  intent: number;
  callStage: string;
  transcript: TranscriptLine[];
}

interface CampaignStats {
  dialed: number;
  connected: number;
  qualified: number;
  hotLeads: number;
  remaining: number;
  total: number;
  avgSentiment: number;
  avgIntent: number;
}

interface ToastMsg {
  id: number;
  message: string;
  type: "error" | "info" | "success";
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const S = {
  card: {
    backgroundColor: "rgba(246,246,253,0.03)",
    border: "1px solid rgba(246,246,253,0.10)",
    borderRadius: 12,
    padding: "20px 24px",
  } as React.CSSProperties,

  cardSmall: {
    backgroundColor: "rgba(246,246,253,0.03)",
    border: "1px solid rgba(246,246,253,0.10)",
    borderRadius: 12,
    padding: "14px 18px",
  } as React.CSSProperties,

  primaryBtn: {
    background: "linear-gradient(93.92deg, #8587e3 -13.51%, #4c4dac 40.91%, #696aac 113.69%)",
    boxShadow: "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)",
    border: "none",
    borderRadius: 40,
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    transition: "box-shadow 0.2s ease",
    fontFamily: "inherit",
  } as React.CSSProperties,

  secondaryBtn: {
    background: "transparent",
    border: "2px solid #8587e3",
    borderRadius: 40,
    color: "#a2a3e9",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s ease",
  } as React.CSSProperties,

  input: {
    width: "100%",
    backgroundColor: "rgba(246,246,253,0.04)",
    border: "1px solid rgba(246,246,253,0.12)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 14,
    color: "#f6f6fd",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: "rgba(246,246,253,0.5)",
    marginBottom: 6,
  } as React.CSSProperties,

  accentText: { color: "#a2a3e9" } as React.CSSProperties,
  highlightText: { color: "#c7c8f2" } as React.CSSProperties,
  mutedText: { color: "rgba(246,246,253,0.5)" } as React.CSSProperties,
};

function getGaugeColor(score: number): string {
  if (score >= 60) return "#696aac";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

function getStatusColor(status: TargetStatus): string {
  switch (status) {
    case "queued": return "#6b7280";
    case "calling": return "#f59e0b";
    case "connected": return "#3b82f6";
    case "completed": return "#22c55e";
    case "failed": return "#ef4444";
    case "skipped": return "#4b5563";
    default: return "#6b7280";
  }
}

function getDispositionColor(d: Disposition): string {
  switch (d) {
    case "qualified": return "#22c55e";
    case "hot_lead": return "#696aac";
    case "not_interested": return "#ef4444";
    case "no_answer": return "#6b7280";
    case "callback": return "#f59e0b";
    default: return "#6b7280";
  }
}

function getDispositionLabel(d: Disposition): string {
  switch (d) {
    case "qualified": return "Qualified";
    case "hot_lead": return "Hot Lead";
    case "not_interested": return "Not Interested";
    case "no_answer": return "No Answer";
    case "callback": return "Callback";
    default: return d;
  }
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getPhaseLabel(phase: Phase): string {
  switch (phase) {
    case "setup": return "Idle";
    case "researching": return "Researching";
    case "review": return "Ready";
    case "active": return "Active";
    case "paused": return "Paused";
    case "complete": return "Complete";
  }
}

function getPhaseBadgeStyle(phase: Phase): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
  };
  switch (phase) {
    case "setup": return { ...base, background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.3)" };
    case "researching": return { ...base, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" };
    case "review": return { ...base, background: "rgba(105,106,172,0.18)", color: "#a2a3e9", border: "1px solid rgba(105,106,172,0.4)" };
    case "active": return { ...base, background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" };
    case "paused": return { ...base, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" };
    case "complete": return { ...base, background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: ToastMsg[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 10,
            backgroundColor: t.type === "error" ? "rgba(239,68,68,0.12)" : t.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(105,106,172,0.15)",
            border: `1px solid ${t.type === "error" ? "rgba(239,68,68,0.35)" : t.type === "success" ? "rgba(34,197,94,0.35)" : "rgba(105,106,172,0.4)"}`,
            color: t.type === "error" ? "#fca5a5" : t.type === "success" ? "#86efac" : "#c7c8f2",
            fontSize: 13, maxWidth: 360,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 18, opacity: 0.6, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

function GaugeBar({ value, label }: { value: number; label: string }) {
  const color = getGaugeColor(value);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(246,246,253,0.5)" }}>{label}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(246,246,253,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, backgroundColor: color, borderRadius: 3, transition: "width 0.5s ease, background-color 0.4s ease" }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "rgba(246,246,253,0.4)" }}>
        {value >= 60 ? "Positive" : value >= 30 ? "Neutral" : "Resistant"}
      </div>
    </div>
  );
}

function StatusDot({ status, pulse }: { status: TargetStatus; pulse?: boolean }) {
  const color = getStatusColor(status);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10, flexShrink: 0 }}>
      {pulse && status === "calling" && (
        <span style={{
          position: "absolute", width: 10, height: 10, borderRadius: "50%",
          backgroundColor: color, opacity: 0.4,
          animation: "pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite",
        }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "block", position: "relative" }} />
    </span>
  );
}

// ─── Phase 1: Campaign Setup ──────────────────────────────────────────────────

function PhaseSetup({
  form, setForm, onSubmit, loading,
}: {
  form: CampaignForm;
  setForm: (f: CampaignForm) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const handleChange = (field: keyof CampaignForm, value: string | number) =>
    setForm({ ...form, [field]: value });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={S.card}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#c7c8f2", marginBottom: 4, marginTop: 0 }}>
          New Campaign
        </h2>
        <p style={{ ...S.mutedText, fontSize: 14, marginTop: 0, marginBottom: 28 }}>
          Describe your target and ATOM will research prospects and auto-dial them.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Brief */}
          <div>
            <label style={S.label}>Campaign Brief</label>
            <textarea
              value={form.brief}
              onChange={(e) => handleChange("brief", e.target.value)}
              placeholder="Describe your campaign objective, target companies, and product to pitch..."
              rows={5}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Industry + Geo row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={S.label}>Target Industry</label>
              <input
                type="text"
                value={form.targetIndustry}
                onChange={(e) => handleChange("targetIndustry", e.target.value)}
                placeholder="e.g. information technology, healthcare, financial services"
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Target Geography</label>
              <select
                value={form.targetGeo}
                onChange={(e) => handleChange("targetGeo", e.target.value)}
                style={{ ...S.input }}
              >
                {GEO_OPTIONS.map((g) => (
                  <option key={g} value={g} style={{ backgroundColor: "#111" }}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Count + Product row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={S.label}>Target Count</label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.targetCount}
                onChange={(e) => handleChange("targetCount", Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                style={S.input}
              />
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.35)", marginTop: 4 }}>Max 50 targets</div>
            </div>
            <div>
              <label style={S.label}>Product to Pitch</label>
              <select
                value={form.productSlug}
                onChange={(e) => handleChange("productSlug", e.target.value)}
                style={{ ...S.input }}
              >
                {PRODUCTS.map((p) => (
                  <option key={p} value={p} style={{ backgroundColor: "#111" }}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Alert email */}
          <div>
            <label style={S.label}>Alert Email</label>
            <input
              type="email"
              value={form.alertEmail}
              onChange={(e) => handleChange("alertEmail", e.target.value)}
              placeholder="Get notified when hot leads are found"
              style={S.input}
            />
          </div>

          {/* Submit */}
          <button
            onClick={onSubmit}
            disabled={loading || !form.brief.trim()}
            style={{
              ...S.primaryBtn,
              padding: "14px 32px",
              fontSize: 15,
              marginTop: 4,
              opacity: loading || !form.brief.trim() ? 0.6 : 1,
              cursor: loading || !form.brief.trim() ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => { if (!loading && form.brief.trim()) e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
          >
            {loading ? "Researching…" : "Research Targets"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 1b: Researching loading state ─────────────────────────────────────

function PhaseResearching() {
  const [dots, setDots] = useState("...");
  useEffect(() => {
    const t = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Animated atom icon */}
        <div style={{ width: 72, height: 72, margin: "0 auto 28px", position: "relative" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "2px solid rgba(105,106,172,0.4)",
            position: "absolute", inset: 0,
            animation: "spin 3s linear infinite",
          }} />
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "2px solid transparent",
            borderTopColor: "#8587e3",
            position: "absolute", inset: 0,
            animation: "spin 1.5s linear infinite",
          }} />
          <div style={{
            position: "absolute", inset: "22px",
            borderRadius: "50%",
            backgroundColor: "rgba(105,106,172,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#8587e3", fontSize: 14, fontWeight: 700 }}>AI</span>
          </div>
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#c7c8f2", margin: "0 0 10px" }}>
          ATOM is analyzing sources and building your target list{dots}
        </h3>
        <p style={{ color: "rgba(246,246,253,0.5)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Scanning industry databases, LinkedIn signals, funding data, and tech stack indicators to surface the highest-intent prospects.
        </p>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            "Scanning industry databases",
            "Enriching with Hunter.io contact data",
            "Scoring by buyer intent signals",
            "Ranking targets by fit score",
          ].map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 16px",
              backgroundColor: "rgba(246,246,253,0.03)",
              border: "1px solid rgba(246,246,253,0.08)",
              borderRadius: 8,
              fontSize: 13, color: "rgba(246,246,253,0.6)",
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%",
                border: "1.5px solid rgba(105,106,172,0.5)",
                borderTopColor: "#8587e3",
                display: "inline-block",
                animation: `spin ${1 + i * 0.2}s linear infinite`,
                flexShrink: 0,
              }} />
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2: Target Review ───────────────────────────────────────────────────

function TargetCard({ target }: { target: Target }) {
  return (
    <div style={{
      ...S.cardSmall,
      position: "relative",
      display: "flex",
      gap: 14,
      alignItems: "flex-start",
    }}>
      {/* Rank badge */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "linear-gradient(135deg, #8587e3, #4c4dac)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
      }}>
        #{target.rank}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <StatusDot status={target.status} pulse />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f6f6fd" }}>{target.companyName}</span>
        </div>

        <div style={{ fontSize: 12, color: "rgba(246,246,253,0.5)", marginBottom: 8 }}>
          {target.industry} · {target.size} · {target.location}
        </div>

        {/* Decision maker */}
        <div style={{ fontSize: 13, color: "rgba(246,246,253,0.75)", marginBottom: 6 }}>
          <span style={{ color: "#c7c8f2", fontWeight: 600 }}>{target.decisionMaker.name}</span>
          {" · "}{target.decisionMaker.title}
          {target.decisionMaker.linkedin && (
            <a
              href={target.decisionMaker.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginLeft: 8, color: "#a2a3e9", fontSize: 11, textDecoration: "none" }}
            >
              LinkedIn ↗
            </a>
          )}
        </div>

        {/* Contact info */}
        <div style={{ fontSize: 12, color: "rgba(246,246,253,0.5)", marginBottom: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {target.email && <span>✉ {target.email}</span>}
          <span>{target.phone ? `📞 ${target.phone}` : <span style={{ color: "rgba(246,246,253,0.3)" }}>No phone — will skip</span>}</span>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {target.tags.map((tag) => (
            <span key={tag} style={{
              padding: "2px 9px", borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              backgroundColor: "rgba(105,106,172,0.15)",
              border: "1px solid rgba(105,106,172,0.3)",
              color: "#a2a3e9",
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhaseReview({
  targets, form, campaignId,
  onLaunch, onEditCampaign,
}: {
  targets: Target[];
  form: CampaignForm;
  campaignId: string;
  onLaunch: () => void;
  onEditCampaign: () => void;
}) {
  const withPhone = targets.filter((t) => t.phone).length;
  const estMinutes = withPhone * 4;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, padding: "32px 24px", alignItems: "start" }}>
      {/* Left: target list */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#c7c8f2", margin: "0 0 16px" }}>
          {targets.length} Targets Identified
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {targets.map((t) => <TargetCard key={t.id} target={t} />)}
        </div>
      </div>

      {/* Right: summary + launch */}
      <div style={{ position: "sticky", top: 24 }}>
        <div style={S.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#c7c8f2", marginTop: 0, marginBottom: 14 }}>Campaign Summary</h3>

          <div style={{ fontSize: 13, color: "rgba(246,246,253,0.65)", marginBottom: 16, lineHeight: 1.6 }}>
            {form.brief.slice(0, 140)}{form.brief.length > 140 ? "…" : ""}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Total Targets", value: targets.length },
              { label: "With Phone Numbers", value: withPhone },
              { label: "Est. Call Time", value: `~${estMinutes} min` },
              { label: "Product", value: form.productSlug },
              { label: "Geography", value: form.targetGeo },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(246,246,253,0.45)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c7c8f2" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "rgba(246,246,253,0.35)", marginBottom: 6 }}>Campaign ID: {campaignId}</div>

          <button
            onClick={onLaunch}
            style={{ ...S.primaryBtn, width: "100%", padding: "13px", fontSize: 15, marginBottom: 10 }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
          >
            Launch Campaign
          </button>

          <button
            onClick={onEditCampaign}
            style={{ ...S.secondaryBtn, width: "100%", padding: "11px", fontSize: 14 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(133,135,227,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Edit Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: Live Dashboard ──────────────────────────────────────────────────

function LiveCallPanel({ live }: { live: LiveCallState }) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [live.transcript]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Currently calling */}
      <div style={S.cardSmall}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(246,246,253,0.4)", marginBottom: 8 }}>Currently Calling</div>
        {live.targetId ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f6f6fd", marginBottom: 2 }}>{live.companyName}</div>
            <div style={{ fontSize: 14, color: "#a2a3e9" }}>
              {live.contactName} · <span style={{ color: "rgba(246,246,253,0.5)" }}>{live.contactTitle}</span>
            </div>
            {live.callStage && (
              <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, backgroundColor: "rgba(105,106,172,0.15)", border: "1px solid rgba(105,106,172,0.3)", fontSize: 12, color: "#a2a3e9" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block", animation: "pulse 1.5s ease infinite" }} />
                {live.callStage}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "rgba(246,246,253,0.4)", fontSize: 14 }}>Waiting to connect…</div>
        )}
      </div>

      {/* Gauges */}
      <div style={{ ...S.cardSmall, display: "flex", gap: 24 }}>
        <GaugeBar value={live.sentiment} label="Sentiment" />
        <GaugeBar value={live.intent} label="Buyer Intent" />
      </div>

      {/* Live transcript */}
      <div style={{ ...S.card, flex: 1, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(246,246,253,0.08)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(246,246,253,0.4)" }}>
          Live Transcript
        </div>
        <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {live.transcript.length === 0 ? (
            <div style={{ color: "rgba(246,246,253,0.3)", fontSize: 13, textAlign: "center", paddingTop: 24 }}>
              Transcript will appear here…
            </div>
          ) : (
            live.transcript.map((line, i) => {
              const isAtom = line.speaker === "ATOM";
              return (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: isAtom ? "rgba(105,106,172,0.12)" : "rgba(246,246,253,0.03)",
                  border: `1px solid ${isAtom ? "rgba(105,106,172,0.3)" : "rgba(246,246,253,0.08)"}`,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: isAtom ? "#a2a3e9" : "rgba(246,246,253,0.4)",
                    marginBottom: 5,
                  }}>{line.speaker}</div>
                  <div style={{ fontSize: 13, color: "#f6f6fd", lineHeight: 1.6 }}>{line.text}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CallHistoryFeed({
  history,
  onToggleExpand,
}: {
  history: CallHistoryEntry[];
  onToggleExpand: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 620 }}>
      {history.length === 0 && (
        <div style={{ color: "rgba(246,246,253,0.3)", fontSize: 13, textAlign: "center", paddingTop: 40 }}>
          Completed calls will appear here
        </div>
      )}
      {[...history].reverse().map((entry) => {
        const borderColor = entry.disposition === "qualified" || entry.disposition === "hot_lead"
          ? "rgba(34,197,94,0.35)"
          : entry.disposition === "not_interested"
          ? "rgba(239,68,68,0.25)"
          : "rgba(246,246,253,0.1)";

        return (
          <div
            key={entry.targetId}
            style={{
              backgroundColor: "rgba(246,246,253,0.03)",
              border: `1px solid ${borderColor}`,
              borderRadius: 10,
              padding: "12px 16px",
              cursor: "pointer",
            }}
            onClick={() => onToggleExpand(entry.targetId)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#f6f6fd" }}>{entry.companyName}</span>
                <span style={{ fontSize: 12, color: "rgba(246,246,253,0.5)", marginLeft: 8 }}>{entry.contactName}</span>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                backgroundColor: `${getDispositionColor(entry.disposition)}20`,
                border: `1px solid ${getDispositionColor(entry.disposition)}50`,
                color: getDispositionColor(entry.disposition),
              }}>{getDispositionLabel(entry.disposition)}</span>
            </div>

            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(246,246,253,0.4)" }}>
              <span>{formatDuration(entry.duration)}</span>
              <span>Sentiment: <span style={{ color: getGaugeColor(entry.sentiment) }}>{entry.sentiment}</span></span>
              <span>Intent: <span style={{ color: getGaugeColor(entry.intent) }}>{entry.intent}</span></span>
            </div>

            {entry.expanded && entry.transcript.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid rgba(246,246,253,0.08)", paddingTop: 12 }}>
                {entry.transcript.map((line, i) => {
                  const isAtom = line.speaker === "ATOM";
                  return (
                    <div key={i} style={{
                      padding: "8px 12px", borderRadius: 6,
                      backgroundColor: isAtom ? "rgba(105,106,172,0.1)" : "rgba(246,246,253,0.03)",
                      fontSize: 12,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: isAtom ? "#a2a3e9" : "rgba(246,246,253,0.4)", marginBottom: 3 }}>{line.speaker}</div>
                      <div style={{ color: "#f6f6fd", lineHeight: 1.55 }}>{line.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HotLeadsPanel({ hotLeads }: { hotLeads: HotLead[] }) {
  if (hotLeads.length === 0) return null;

  return (
    <div style={{
      ...S.card,
      borderColor: "rgba(105,106,172,0.4)",
      boxShadow: "0 0 24px rgba(105,106,172,0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>🔥</span>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#c7c8f2", margin: 0 }}>
          Hot Leads — Score 75+
        </h3>
        <span style={{
          padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: "linear-gradient(93.92deg, #8587e3, #4c4dac)",
          color: "#fff",
        }}>{hotLeads.length}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {hotLeads.map((lead) => (
          <div key={lead.targetId} style={{
            padding: "14px 16px", borderRadius: 10,
            backgroundColor: "rgba(105,106,172,0.08)",
            border: "1px solid rgba(105,106,172,0.35)",
            boxShadow: "0 0 12px rgba(105,106,172,0.08)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f6f6fd", marginBottom: 2 }}>{lead.companyName}</div>
            <div style={{ fontSize: 13, color: "#a2a3e9", marginBottom: 10 }}>{lead.contactName}</div>

            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: getGaugeColor(lead.sentiment) }}>{lead.sentiment}</div>
                <div style={{ fontSize: 10, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sentiment</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: getGaugeColor(lead.intent) }}>{lead.intent}</div>
                <div style={{ fontSize: 10, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Intent</div>
              </div>
            </div>

            {lead.buyingSignals.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "rgba(246,246,253,0.4)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Key Signals</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {lead.buyingSignals.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: "rgba(246,246,253,0.7)", display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ color: "#696aac", flexShrink: 0 }}>›</span>
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...S.primaryBtn, padding: "7px 14px", fontSize: 12 }}>
                Review
              </button>
              <button style={{ ...S.secondaryBtn, padding: "6px 12px", fontSize: 12 }}>
                Send Follow-up
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseLiveDashboard({
  targets, stats, live, history, hotLeads, phase,
  onPause, onResume, onToggleHistoryExpand,
}: {
  targets: Target[];
  stats: CampaignStats;
  live: LiveCallState;
  history: CallHistoryEntry[];
  hotLeads: HotLead[];
  phase: "active" | "paused";
  onPause: () => void;
  onResume: () => void;
  onToggleHistoryExpand: (id: string) => void;
}) {
  const pct = stats.total > 0 ? Math.round(((stats.total - stats.remaining) / stats.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px" }}>
      {/* Progress bar row */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#c7c8f2" }}>
            Calling {stats.total - stats.remaining} of {stats.total}…
          </div>
          <button
            onClick={phase === "active" ? onPause : onResume}
            style={{
              ...S.secondaryBtn,
              padding: "8px 20px",
              fontSize: 13,
              borderColor: phase === "active" ? "#f59e0b" : "#22c55e",
              color: phase === "active" ? "#f59e0b" : "#22c55e",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = phase === "active" ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {phase === "active" ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(246,246,253,0.08)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg, #8587e3, #696aac)",
            borderRadius: 3,
            transition: "width 0.8s ease",
          }} />
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "Dialed", value: stats.dialed, color: "#c7c8f2" },
            { label: "Connected", value: stats.connected, color: "#a2a3e9" },
            { label: "Qualified", value: stats.qualified, color: "#22c55e" },
            { label: "Hot Leads", value: stats.hotLeads, color: "#8587e3" },
            { label: "Remaining", value: stats.remaining, color: "rgba(246,246,253,0.4)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Middle split view */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20, minHeight: 0 }}>
        {/* Live call panel */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(246,246,253,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 0, marginBottom: 12 }}>Live Call</h3>
          <LiveCallPanel live={live} />
        </div>

        {/* Call history */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "rgba(246,246,253,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 0, marginBottom: 12 }}>
            Call History ({history.length})
          </h3>
          <CallHistoryFeed history={history} onToggleExpand={onToggleHistoryExpand} />
        </div>
      </div>

      {/* Hot leads panel */}
      <HotLeadsPanel hotLeads={hotLeads} />
    </div>
  );
}

// ─── Phase 4: Campaign Complete ───────────────────────────────────────────────

function PhaseComplete({
  stats, hotLeads, history, form,
  onNewCampaign,
}: {
  stats: CampaignStats;
  hotLeads: HotLead[];
  history: CallHistoryEntry[];
  form: CampaignForm;
  onNewCampaign: () => void;
}) {
  const handleExport = () => {
    const rows = [
      ["Company", "Contact", "Title", "Duration", "Sentiment", "Intent", "Disposition"],
      ...history.map((e) => [
        e.companyName, e.contactName, e.contactTitle,
        formatDuration(e.duration), String(e.sentiment), String(e.intent),
        getDispositionLabel(e.disposition),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atom-campaign-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#c7c8f2", margin: "0 0 8px" }}>Campaign Complete</h2>
        <p style={{ color: "rgba(246,246,253,0.5)", margin: 0, fontSize: 15 }}>
          {form.productSlug} · {form.targetGeo}
        </p>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total Calls", value: stats.dialed },
          { label: "Connected", value: stats.connected },
          { label: "Qualified", value: stats.qualified },
          { label: "Hot Leads", value: stats.hotLeads },
          { label: "Avg Sentiment", value: stats.avgSentiment },
          { label: "Avg Intent", value: stats.avgIntent },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#c7c8f2", marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: "rgba(246,246,253,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Hot leads */}
      {hotLeads.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <HotLeadsPanel hotLeads={hotLeads} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        <button
          onClick={handleExport}
          style={{ ...S.primaryBtn, padding: "13px 32px", fontSize: 15 }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0px 0px 25px #696aac, inset 0px 0px 6.7px rgba(255,255,255,0.9)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0px 0px 10px #696aac, inset 0px 0px 2px rgba(255,255,255,0.61)"; }}
        >
          Export Results CSV
        </button>
        <button
          onClick={onNewCampaign}
          style={{ ...S.secondaryBtn, padding: "13px 32px", fontSize: 15 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(133,135,227,0.1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          New Campaign
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AtomCampaign() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [campaignId, setCampaignId] = useState<string>("");
  const [form, setForm] = useState<CampaignForm>({
    brief: "",
    targetIndustry: "",
    targetGeo: "US",
    targetCount: 10,
    productSlug: PRODUCTS[0],
    alertEmail: "",
  });
  const [targets, setTargets] = useState<Target[]>([]);
  const [live, setLive] = useState<LiveCallState>({
    targetId: null,
    companyName: "",
    contactName: "",
    contactTitle: "",
    sentiment: 0,
    intent: 0,
    callStage: "",
    transcript: [],
  });
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [stats, setStats] = useState<CampaignStats>({
    dialed: 0, connected: 0, qualified: 0, hotLeads: 0, remaining: 0, total: 0, avgSentiment: 0, avgIntent: 0,
  });
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addToast = useCallback((message: string, type: ToastMsg["type"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const connectWs = useCallback((id: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = `wss://${BRIDGE_URL.replace(/^https?:\/\//, "")}/campaign/${id}/events`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      addToast("Unable to open WebSocket connection.", "error");
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (wsReconnectRef.current) {
        clearTimeout(wsReconnectRef.current);
        wsReconnectRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        handleWsEvent(msg);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Attempt reconnect if campaign still active
      setPhase((ph) => {
        if (ph === "active" || ph === "paused") {
          wsReconnectRef.current = setTimeout(() => connectWs(id), 3000);
        }
        return ph;
      });
    };

    ws.onerror = () => {
      addToast("WebSocket connection error — reconnecting…", "error");
    };
  }, [addToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWsEvent = useCallback((msg: Record<string, unknown>) => {
    const type = msg.type as string;

    switch (type) {
      case "target_calling": {
        const targetId = msg.targetId as string;
        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "calling" as TargetStatus } : t));
        setLive({
          targetId,
          companyName: (msg.companyName as string) ?? "",
          contactName: (msg.contactName as string) ?? "",
          contactTitle: (msg.contactTitle as string) ?? "",
          sentiment: 0,
          intent: 0,
          callStage: "Initiating call…",
          transcript: [],
        });
        break;
      }

      case "call_connected": {
        const targetId = msg.targetId as string;
        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "connected" as TargetStatus } : t));
        setLive((prev) => ({ ...prev, callStage: "Connected" }));
        break;
      }

      case "call_transcript": {
        const line: TranscriptLine = {
          speaker: (msg.speaker as "ATOM" | "Prospect"),
          text: (msg.text as string) ?? "",
          ts: Date.now(),
        };
        setLive((prev) => ({ ...prev, transcript: [...prev.transcript, line] }));
        break;
      }

      case "call_metrics": {
        setLive((prev) => ({
          ...prev,
          sentiment: (msg.sentiment as number) ?? prev.sentiment,
          intent: (msg.intent as number) ?? prev.intent,
          callStage: (msg.callStage as string) ?? prev.callStage,
        }));
        break;
      }

      case "call_complete": {
        const targetId = msg.targetId as string;
        const disposition = (msg.disposition as Disposition) ?? "no_answer";
        const sentiment = (msg.sentiment as number) ?? 0;
        const intent = (msg.intent as number) ?? 0;
        const duration = (msg.duration as number) ?? 0;

        setTargets((prev) => prev.map((t) => t.id === targetId ? { ...t, status: "completed" as TargetStatus } : t));

        setLive((curr) => {
          const entry: CallHistoryEntry = {
            targetId,
            companyName: curr.companyName,
            contactName: curr.contactName,
            contactTitle: curr.contactTitle,
            duration,
            sentiment,
            intent,
            disposition,
            transcript: curr.transcript,
            expanded: false,
          };
          setHistory((h) => [...h, entry]);
          return { ...curr, callStage: "" };
        });

        setStats((prev) => {
          const newDialed = prev.dialed + 1;
          const newConnected = msg.connected ? prev.connected + 1 : prev.connected;
          const newQualified = disposition === "qualified" || disposition === "hot_lead" ? prev.qualified + 1 : prev.qualified;
          const newRemaining = Math.max(0, prev.remaining - 1);
          const sentimentSum = prev.avgSentiment * prev.dialed + sentiment;
          const intentSum = prev.avgIntent * prev.dialed + intent;
          return {
            ...prev,
            dialed: newDialed,
            connected: newConnected,
            qualified: newQualified,
            remaining: newRemaining,
            avgSentiment: newDialed ? Math.round(sentimentSum / newDialed) : 0,
            avgIntent: newDialed ? Math.round(intentSum / newDialed) : 0,
          };
        });
        break;
      }

      case "hot_lead": {
        const lead: HotLead = {
          targetId: (msg.targetId as string) ?? "",
          companyName: (msg.companyName as string) ?? "",
          contactName: (msg.contactName as string) ?? "",
          sentiment: (msg.sentiment as number) ?? 0,
          intent: (msg.intent as number) ?? 0,
          buyingSignals: (msg.buyingSignals as string[]) ?? [],
        };
        setHotLeads((prev) => [...prev, lead]);
        setStats((prev) => ({ ...prev, hotLeads: prev.hotLeads + 1 }));
        addToast(`🔥 Hot lead: ${lead.companyName} — ${lead.contactName}`, "success");
        break;
      }

      case "campaign_progress": {
        const current = (msg.current as number) ?? 0;
        const total = (msg.total as number) ?? 0;
        setStats((prev) => ({ ...prev, total, remaining: total - current }));
        break;
      }

      case "campaign_complete": {
        setPhase("complete");
        wsRef.current?.close();
        wsRef.current = null;
        addToast("Campaign complete!", "success");
        break;
      }
    }
  }, [addToast]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
    };
  }, []);

  // ── API calls ─────────────────────────────────────────────────────────────

  const handleResearch = useCallback(async () => {
    setPhase("researching");

    try {
      // Create campaign
      const createRes = await fetch(`${BRIDGE_URL}/campaign/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: form.brief,
          targetIndustry: form.targetIndustry,
          targetGeo: form.targetGeo,
          targetCount: form.targetCount,
          productSlug: form.productSlug,
          alertEmail: form.alertEmail,
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text().catch(() => "");
        throw new Error(`Create failed: ${createRes.status}${text ? ` — ${text}` : ""}`);
      }

      const createData = await createRes.json();
      const id: string = createData.id ?? createData.campaignId ?? `cam-${Date.now()}`;
      setCampaignId(id);

      // Research targets
      const researchRes = await fetch(`${BRIDGE_URL}/campaign/${id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!researchRes.ok) {
        const text = await researchRes.text().catch(() => "");
        throw new Error(`Research failed: ${researchRes.status}${text ? ` — ${text}` : ""}`);
      }

      const researchData = await researchRes.json();
      const fetchedTargets: Target[] = (researchData.targets ?? []).map((t: Record<string, unknown>, i: number) => ({
        id: (t.id as string) ?? `t-${i}`,
        rank: i + 1,
        companyName: (t.companyName as string) ?? (t.company as string) ?? `Company ${i + 1}`,
        industry: (t.industry as string) ?? "",
        size: (t.size as string) ?? "",
        location: (t.location as string) ?? "",
        decisionMaker: {
          name: ((t.decisionMaker as Record<string, unknown>)?.name as string) ?? (t.contactName as string) ?? "",
          title: ((t.decisionMaker as Record<string, unknown>)?.title as string) ?? (t.contactTitle as string) ?? "",
          linkedin: ((t.decisionMaker as Record<string, unknown>)?.linkedin as string) ?? undefined,
        },
        email: (t.email as string) ?? undefined,
        phone: (t.phone as string) ?? undefined,
        tags: (t.tags as string[]) ?? [],
        status: "queued" as TargetStatus,
      }));

      setTargets(fetchedTargets);
      setStats((prev) => ({
        ...prev,
        total: fetchedTargets.length,
        remaining: fetchedTargets.length,
      }));
      setPhase("review");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Research failed. Please try again.", "error");
      setPhase("setup");
    }
  }, [form, addToast]);

  const handleLaunch = useCallback(async () => {
    try {
      const res = await fetch(`${BRIDGE_URL}/campaign/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Launch failed: ${res.status}${text ? ` — ${text}` : ""}`);
      }

      setPhase("active");
      connectWs(campaignId);
      addToast("Campaign launched — ATOM is dialing.", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Launch failed. Please try again.", "error");
    }
  }, [campaignId, connectWs, addToast]);

  const handlePause = useCallback(async () => {
    try {
      await fetch(`${BRIDGE_URL}/campaign/${campaignId}/pause`, { method: "POST" });
      setPhase("paused");
    } catch {
      addToast("Failed to pause campaign.", "error");
    }
  }, [campaignId, addToast]);

  const handleResume = useCallback(async () => {
    try {
      await fetch(`${BRIDGE_URL}/campaign/${campaignId}/resume`, { method: "POST" });
      setPhase("active");
    } catch {
      addToast("Failed to resume campaign.", "error");
    }
  }, [campaignId, addToast]);

  const handleNewCampaign = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setCampaignId("");
    setTargets([]);
    setHistory([]);
    setHotLeads([]);
    setLive({ targetId: null, companyName: "", contactName: "", contactTitle: "", sentiment: 0, intent: 0, callStage: "", transcript: [] });
    setStats({ dialed: 0, connected: 0, qualified: 0, hotLeads: 0, remaining: 0, total: 0, avgSentiment: 0, avgIntent: 0 });
    setForm({ brief: "", targetIndustry: "", targetGeo: "US", targetCount: 10, productSlug: PRODUCTS[0], alertEmail: "" });
    setPhase("setup");
  }, []);

  const handleToggleHistoryExpand = useCallback((id: string) => {
    setHistory((prev) => prev.map((e) => e.targetId === id ? { ...e, expanded: !e.expanded } : e));
  }, []);

  // Poll status while active (in case WS misses events)
  useEffect(() => {
    if (phase !== "active" || !campaignId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/campaign/${campaignId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "complete") {
            setPhase("complete");
            clearInterval(interval);
          }
        }
      } catch {
        // silent
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [phase, campaignId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(2); opacity: 0; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(105,106,172,0.35); border-radius: 3px; }
        input, select, textarea { color-scheme: dark; }
        input:focus, select:focus, textarea:focus {
          border-color: rgba(105,106,172,0.6) !important;
          outline: none;
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        backgroundColor: "#020202",
        color: "#f6f6fd",
        fontFamily: "'Plus Jakarta Sans', 'Arial', 'Helvetica', sans-serif",
      }}>
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          borderBottom: "1px solid rgba(246,246,253,0.08)",
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          backgroundColor: "rgba(2,2,2,0.9)",
          backdropFilter: "blur(12px)",
          zIndex: 100,
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 3px", color: "#f6f6fd", letterSpacing: "-0.02em" }}>
              ATOM Campaign Engine
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(246,246,253,0.45)" }}>
              Autonomous outbound prospecting powered by AI
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Phase badge */}
            <div style={getPhaseBadgeStyle(phase)}>
              {(phase === "active") && (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#4ade80", display: "inline-block", animation: "pulse 2s ease infinite" }} />
              )}
              {getPhaseLabel(phase)}
            </div>

            {/* Campaign ID chip */}
            {campaignId && (
              <div style={{ fontSize: 11, color: "rgba(246,246,253,0.3)", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(246,246,253,0.1)" }}>
                {campaignId}
              </div>
            )}
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <main>
          {phase === "setup" && (
            <PhaseSetup form={form} setForm={setForm} onSubmit={handleResearch} loading={false} />
          )}

          {phase === "researching" && (
            <PhaseResearching />
          )}

          {phase === "review" && (
            <PhaseReview
              targets={targets}
              form={form}
              campaignId={campaignId}
              onLaunch={handleLaunch}
              onEditCampaign={() => setPhase("setup")}
            />
          )}

          {(phase === "active" || phase === "paused") && (
            <PhaseLiveDashboard
              targets={targets}
              stats={stats}
              live={live}
              history={history}
              hotLeads={hotLeads}
              phase={phase}
              onPause={handlePause}
              onResume={handleResume}
              onToggleHistoryExpand={handleToggleHistoryExpand}
            />
          )}

          {phase === "complete" && (
            <PhaseComplete
              stats={stats}
              hotLeads={hotLeads}
              history={history}
              form={form}
              onNewCampaign={handleNewCampaign}
            />
          )}
        </main>
      </div>
    </>
  );
}
