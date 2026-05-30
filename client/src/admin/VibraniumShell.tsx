/**
 * VibraniumShell — Vibranium GA Console (rewrite · May 2026)
 *
 * Single-route command center for the path from where ATOM Sales Dominator
 * is today to general availability. Wired into:
 *   GET /api/vibranium/competitive  (Perplexity Sonar Pro, live, 6h cache)
 *   POST /api/vibranium/projection  (multi-scenario ARR + earnings model)
 *
 * Tabs (in execution order):
 *   1. GA Path        — the single quarter-by-quarter roadmap with health
 *   2. Infrastructure — Akamai Blackwell + telephony + edge readiness
 *   3. Voice Engine   — Hume + Telnyx + Deepgram capability matrix
 *   4. Channels       — voice / SMS / email / DM / chat coverage
 *   5. Competitive    — live competitive matrix + share-of-voice
 *   6. Forecast       — 3-scenario ARR projection with assumption knobs
 *   7. Risks          — what could blow us up + mitigations
 *
 * Visual: pure @nirmata/atom-design-system tokens, no hard-coded hex.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Rocket, Cpu, Mic, Layers, Crosshair, TrendingUp, ShieldAlert,
  KeyRound, RefreshCw, ArrowUpRight, Calendar, AlertTriangle, CheckCircle2,
  Clock, Circle, ChevronRight, BadgeCheck, Zap, Globe, MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { KpiCard, ChartCard, EmptyState } from "./charts";
import { useAdminKey } from "./AdminShell";
import { useAdminQuery } from "./useAdminApi";
import { useSessionContext } from "../auth/AuthGate";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical brand tokens — all read from @nirmata/atom-design-system
// (--atom-* are loaded globally in main.tsx). Keep these references named
// so the rest of the file reads cleanly.
// ─────────────────────────────────────────────────────────────────────────────
const t = {
  primary:  "var(--atom-primary, #00c8c8)",
  primaryDim: "var(--atom-primary-dim, #00989c)",
  text:     "var(--atom-text, #e8e8ea)",
  muted:    "var(--atom-text-muted, #8a8a96)",
  faint:    "var(--atom-text-faint, #4a4a55)",
  bg:       "var(--atom-bg, #0b0b0c)",
  surface1: "var(--atom-surface-1, #111113)",
  surface2: "var(--atom-surface-2, #161618)",
  border:   "var(--atom-border, rgba(255,255,255,0.08))",
  borderStrong: "var(--atom-border-strong, rgba(255,255,255,0.14))",
  claude:   "var(--atom-accent-claude, #c084fc)",
  hume:     "var(--atom-accent-hume,   #ff7b6b)",
  samba:    "var(--atom-accent-samba,  #f5c842)",
  gpt:      "var(--atom-accent-gpt,    #74c0fc)",
  success:  "var(--atom-success, #4ade80)",
  warning:  "var(--atom-warning, #f5c842)",
  danger:   "var(--atom-danger,  #ff7b6b)",
  grid:     "rgba(255,255,255,0.05)",
};

const FONT_MONO = "var(--atom-font-mono, 'JetBrains Mono', ui-monospace, monospace)";
const FONT_DISPLAY = "var(--atom-font-display, 'Cabinet Grotesk', system-ui, sans-serif)";

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "path",          label: "GA Path",       icon: Rocket },
  { id: "infra",         label: "Infrastructure", icon: Cpu },
  { id: "voice",         label: "Voice Engine",   icon: Mic },
  { id: "channels",      label: "Channels",       icon: Layers },
  { id: "competitive",   label: "Competitive",    icon: Crosshair },
  { id: "forecast",      label: "Forecast",       icon: TrendingUp },
  { id: "risks",         label: "Risks",          icon: ShieldAlert },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────
function Panel({
  children, style, accent, padded = true,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
  padded?: boolean;
}) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${t.surface1} 0%, ${t.bg} 100%)`,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        borderTop: accent ? `2px solid ${accent}` : undefined,
        padding: padded ? 18 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.18em",
        textTransform: "uppercase", fontWeight: 700,
        color: color || t.muted, marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700,
      color: t.text, marginBottom: 6, letterSpacing: "-0.01em",
    }}>{children}</div>
  );
}

const STATUS_TONES: Record<string, { color: string; label: string }> = {
  done:         { color: "var(--atom-success, #4ade80)", label: "DONE" },
  shipped:      { color: "var(--atom-success, #4ade80)", label: "SHIPPED" },
  on_track:     { color: "var(--atom-primary, #00c8c8)", label: "ON TRACK" },
  in_progress:  { color: "var(--atom-warning, #f5c842)", label: "IN PROGRESS" },
  at_risk:      { color: "var(--atom-warning, #f5c842)", label: "AT RISK" },
  pending:      { color: "var(--atom-text-muted, #8a8a96)", label: "PENDING" },
  blocked:      { color: "var(--atom-danger, #ff7b6b)", label: "BLOCKED" },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_TONES }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6,
      fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.08em",
      color: tone.color,
      background: `color-mix(in oklab, ${tone.color} 12%, transparent)`,
      border: `1px solid color-mix(in oklab, ${tone.color} 28%, transparent)`,
    }}>{tone.label}</span>
  );
}

function EffortBadge({ effort }: { effort: "S" | "M" | "L" | "XL" }) {
  const col = effort === "S" ? t.success : effort === "M" ? t.primary : effort === "L" ? t.warning : t.claude;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 6,
      fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
      color: col,
      background: `color-mix(in oklab, ${col} 12%, transparent)`,
      border: `1px solid color-mix(in oklab, ${col} 28%, transparent)`,
    }}>{effort}</span>
  );
}

function MiniKpi({
  label, value, sub, tone,
}: {
  label: string; value: string | number; sub?: string; tone?: string;
}) {
  return (
    <div style={{
      padding: "14px 16px",
      background: t.surface2,
      border: `1px solid ${t.border}`,
      borderRadius: 12,
    }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.18em", color: t.muted, marginBottom: 6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 24, lineHeight: 1,
        color: tone || t.text, letterSpacing: "-0.02em",
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: t.faint, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — GA Path (replaces old Roadmap)
// May 2026 reality: voice stack v2 live, app brand-system swap shipped,
// Blackwell GPU provisioning underway, target GA Q3 2026.
// ─────────────────────────────────────────────────────────────────────────────
const GA_QUARTERS = [
  {
    quarter: "Q2 2026",
    label: "Current — Pre-GA",
    timeframe: "Apr — Jun 2026",
    health: "on_track" as const,
    progress: 78,
    color: "var(--atom-primary, #00c8c8)",
    pillars: [
      { title: "ATOM module suite (Pitch, Objection, Market, Prospect, Lead Gen, Campaign, WarBook, War Room)", status: "shipped" as const, effort: "XL" as const },
      { title: "Voice Stack v2 (Hume EVI 4 + Claude Sonnet 4.5)", status: "shipped" as const, effort: "L" as const },
      { title: "@nirmata/atom-design-system v1.0 brand rollout", status: "shipped" as const, effort: "M" as const },
      { title: "Akamai EdgeWorker 6-layer scaffold", status: "shipped" as const, effort: "L" as const },
      { title: "Edge layer activation on Akamai staging", status: "in_progress" as const, effort: "M" as const },
      { title: "Blackwell GPU (RTX PRO 6000) on Linode 97453485 — provisioned, awaiting drivers", status: "in_progress" as const, effort: "L" as const },
      { title: "Apollo plan upgrade / mixed_people scope (unblocks Campaign + Prospect)", status: "blocked" as const, effort: "S" as const },
    ],
  },
  {
    quarter: "Q3 2026",
    label: "GA Launch",
    timeframe: "Jul — Sep 2026",
    health: "on_track" as const,
    progress: 12,
    color: "var(--atom-accent-samba, #f5c842)",
    pillars: [
      { title: "SOC 2 Type I audit kickoff (Vanta)", status: "pending" as const, effort: "L" as const },
      { title: "Apollo replacement evaluation (PDL primary + ZoomInfo enterprise fallback)", status: "in_progress" as const, effort: "M" as const },
      { title: "Multi-tenant Hume sub-config provisioning at scale", status: "in_progress" as const, effort: "M" as const },
      { title: "Self-serve onboarding + Stripe checkout for Starter/Growth tiers", status: "pending" as const, effort: "L" as const },
      { title: "Public ATOM Sales OS launch (PH, X, LinkedIn)", status: "pending" as const, effort: "M" as const },
      { title: "First 50 paying tenants milestone", status: "pending" as const, effort: "XL" as const },
    ],
  },
  {
    quarter: "Q4 2026",
    label: "Scale + Enterprise",
    timeframe: "Oct — Dec 2026",
    health: "pending" as const,
    progress: 0,
    color: "var(--atom-accent-claude, #c084fc)",
    pillars: [
      { title: "SOC 2 Type I report (covers SOC 2 Type II observation window start)", status: "pending" as const, effort: "L" as const },
      { title: "Enterprise self-serve SSO (Okta / Azure AD)", status: "pending" as const, effort: "L" as const },
      { title: "Federated multi-region deploy (Akamai EU)", status: "pending" as const, effort: "M" as const },
      { title: "Compliance addons: GDPR Article 32, CCPA, HIPAA BAA", status: "pending" as const, effort: "M" as const },
      { title: "Voice Foundry: custom-cloned voices per tenant", status: "pending" as const, effort: "L" as const },
      { title: "First Enterprise tier paying tenant ($120k+ ACV)", status: "pending" as const, effort: "XL" as const },
    ],
  },
  {
    quarter: "Q1 2027",
    label: "Mature GA",
    timeframe: "Jan — Mar 2027",
    health: "pending" as const,
    progress: 0,
    color: "var(--atom-accent-hume, #ff7b6b)",
    pillars: [
      { title: "SOC 2 Type II audit (6-month observation closes)", status: "pending" as const, effort: "L" as const },
      { title: "ISO 27001 readiness", status: "pending" as const, effort: "XL" as const },
      { title: "Partner channel program (Akamai, Twilio Build Partners, Vercel)", status: "pending" as const, effort: "M" as const },
      { title: "Industry verticals: healthcare (HIPAA), FSI (FINRA Rule 4511)", status: "pending" as const, effort: "L" as const },
      { title: "$5M ARR run-rate exit Q1 2027 (base scenario)", status: "pending" as const, effort: "XL" as const },
    ],
  },
];

function TabGaPath() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Top-line metric strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      }}>
        <MiniKpi label="GA Target"     value="Q3 2026" sub="Jul — Sep window" />
        <MiniKpi label="Days to GA"    value={daysUntil("2026-07-01")} sub="business + cal days" tone={t.warning} />
        <MiniKpi label="Pre-GA Health" value="78%" sub="weighted pillar completion" tone={t.success} />
        <MiniKpi label="Open Blockers" value="1" sub="Apollo people-search scope" tone={t.danger} />
        <MiniKpi label="Shipped This Q" value="5 / 7" sub="Q2 2026 pillars" />
      </div>

      {/* Quarter pillars */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
      }}>
        {GA_QUARTERS.map((q) => (
          <Panel key={q.quarter} accent={q.color}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <Eyebrow color={q.color}>{q.quarter}</Eyebrow>
              <StatusBadge status={q.health} />
            </div>
            <SectionTitle>{q.label}</SectionTitle>
            <div style={{ fontSize: 12, color: t.muted, marginBottom: 14 }}>{q.timeframe}</div>

            {/* Progress bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: t.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Progress</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: q.color, fontWeight: 700 }}>{q.progress}%</span>
              </div>
              <div style={{ height: 4, background: t.surface2, borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${q.progress}%`, height: "100%",
                  background: `linear-gradient(90deg, ${q.color} 0%, color-mix(in oklab, ${q.color} 60%, transparent) 100%)`,
                  transition: "width 600ms ease",
                }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {q.pillars.map((p) => (
                <div key={p.title} style={{
                  background: t.surface2,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10, padding: "10px 12px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>{p.title}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <StatusBadge status={p.status} />
                    <EffortBadge effort={p.effort} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function daysUntil(dateStr: string): string {
  const target = new Date(dateStr + "T00:00:00Z").getTime();
  const now = Date.now();
  const days = Math.max(0, Math.round((target - now) / 86400000));
  return `${days}d`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Infrastructure (Akamai Blackwell + telephony + edge)
// ─────────────────────────────────────────────────────────────────────────────
const INFRA_STACK = [
  {
    layer: "Edge",
    name: "Akamai EdgeWorker (6-layer)",
    purpose: "Bot defense · session affinity · signal streaming · GDPR geo · cache",
    status: "shipped" as const,
    detail: "feat/akamai-edge-workers branch · 54/54 tests · awaiting prod activation",
    color: "var(--atom-primary, #00c8c8)",
  },
  {
    layer: "Compute",
    name: "Linode 97453485 · Blackwell GPU",
    purpose: "Hume EVI inference + Voice Foundry custom TTS",
    status: "in_progress" as const,
    detail: "RTX PRO 6000 Blackwell · 192.155.92.4 · drivers + NCCL pending Akamai (Brandon)",
    color: "var(--atom-accent-samba, #f5c842)",
  },
  {
    layer: "Compute (fallback)",
    name: "Linode 95104461 · atom-voice-bridge",
    purpose: "Hume EVI bridge — stable production traffic",
    status: "shipped" as const,
    detail: "Live, do not touch — Twilio media fork landing zone",
    color: "var(--atom-success, #4ade80)",
  },
  {
    layer: "Storage / DB",
    name: "Supabase Postgres + pgvector",
    purpose: "Multi-tenant data + RAG memory · 1024-dim Perplexity embeddings",
    status: "shipped" as const,
    detail: "Project tzwpjxyqdlgcvgownxno · row-level security per tenant slug",
    color: "var(--atom-success, #4ade80)",
  },
  {
    layer: "Telephony",
    name: "Twilio Voice + Conversational Intelligence",
    purpose: "Outbound dialer + AMD + transcripts",
    status: "shipped" as const,
    detail: "+17707469853 · TwiML media fork to Hume",
    color: "var(--atom-success, #4ade80)",
  },
  {
    layer: "Telephony (eval)",
    name: "Telnyx Voice (alt)",
    purpose: "Cost-comp evaluation vs Twilio CI; A/B on Q3 cohort",
    status: "pending" as const,
    detail: "Spec drafted · sub-account creation Q3 first week",
    color: "var(--atom-text-muted, #8a8a96)",
  },
  {
    layer: "Hosting",
    name: "Vercel (Pro)",
    purpose: "Next-gen ATOM app + edge functions + serverless API",
    status: "shipped" as const,
    detail: "atom-dominator-pro.vercel.app · team_jOFE8gFpRi9z9gJXrHUrCGfj",
    color: "var(--atom-success, #4ade80)",
  },
];

const LATENCY_TARGETS = [
  { stage: "Twilio media in",        currentMs: 35,  targetMs: 50,  status: "on_track" as const },
  { stage: "Hume EVI ingest",        currentMs: 80,  targetMs: 120, status: "on_track" as const },
  { stage: "LLM token first",        currentMs: 240, targetMs: 250, status: "at_risk" as const },
  { stage: "TTS first chunk",        currentMs: 110, targetMs: 200, status: "on_track" as const },
  { stage: "Twilio media out",       currentMs: 55,  targetMs: 80,  status: "on_track" as const },
  { stage: "End-to-end (P50)",       currentMs: 520, targetMs: 700, status: "on_track" as const },
  { stage: "End-to-end (P95)",       currentMs: 890, targetMs: 1100, status: "on_track" as const },
];

function BridgeHealthCard() {
  const { data, isLoading } = useAdminQuery<{
    bridge: { url: string; status: string; latencyMs: number; error?: string };
    rag: { url: string; status: string; latencyMs: number; error?: string };
    ts: string;
  }>(["bridge-health"], "/api/admin/bridge-health", { refetchInterval: 30_000 });

  const statusColor = (s?: string) =>
    s === "ok" ? t.success : s === "degraded" ? t.warning : s === "down" ? t.danger : t.muted;
  const statusLabel = (s?: string) =>
    s === "ok" ? "HEALTHY" : s === "degraded" ? "DEGRADED" : s === "down" ? "DOWN" : "…";

  return (
    <Panel>
      <Eyebrow color={t.primary}>Bridge Health</Eyebrow>
      <SectionTitle>Voice bridge + RAG service status</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {[
          { label: "Voice Bridge", d: data?.bridge },
          { label: "RAG Service", d: data?.rag },
        ].map(({ label, d }) => (
          <div key={label} style={{
            padding: "14px 16px",
            background: t.surface2,
            border: `1px solid ${t.border}`,
            borderLeft: `3px solid ${statusColor(d?.status)}`,
            borderRadius: 10,
          }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", color: t.muted, textTransform: "uppercase", marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Circle size={8} fill={statusColor(d?.status)} stroke="none" />
              <span style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>
                {isLoading ? "Pinging…" : statusLabel(d?.status)}
              </span>
            </div>
            {d && (
              <>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: t.muted }}>
                  {d.latencyMs}ms latency
                </div>
                {d.error && (
                  <div style={{ fontSize: 11, color: t.danger, marginTop: 4 }}>{d.error}</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {data?.ts && (
        <div style={{ fontSize: 10, color: t.faint, marginTop: 8, fontFamily: FONT_MONO }}>
          Last checked: {new Date(data.ts).toLocaleTimeString()}
        </div>
      )}
    </Panel>
  );
}

function TabInfra() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <BridgeHealthCard />
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12,
      }}>
        <MiniKpi label="GPU Status"      value="Provisioning" sub="Blackwell drivers ETA Brandon" tone={t.warning} />
        <MiniKpi label="Edge Layers"     value="6/6" sub="Akamai EdgeWorker bundle" tone={t.success} />
        <MiniKpi label="P50 Voice E2E"   value="520ms" sub="target <700ms" tone={t.success} />
        <MiniKpi label="P95 Voice E2E"   value="890ms" sub="target <1100ms" tone={t.success} />
        <MiniKpi label="Telephony"       value="Twilio + Telnyx eval" sub="A/B starts Q3" />
      </div>

      <Panel>
        <Eyebrow color={t.primary}>Infrastructure Stack</Eyebrow>
        <SectionTitle>Production topology</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {INFRA_STACK.map((s) => (
            <div key={s.name} style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr auto",
              gap: 14,
              alignItems: "center",
              padding: "14px 16px",
              background: t.surface2,
              border: `1px solid ${t.border}`,
              borderLeft: `3px solid ${s.color}`,
              borderRadius: 10,
            }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", color: t.muted, textTransform: "uppercase" }}>
                {s.layer}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text, marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: t.muted, marginBottom: 4 }}>{s.purpose}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.faint }}>{s.detail}</div>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Eyebrow color={t.primary}>Voice Latency Budget</Eyebrow>
        <SectionTitle>Stage-by-stage measured vs target</SectionTitle>
        <div style={{ height: 280, marginTop: 14 }}>
          <ResponsiveContainer>
            <BarChart data={LATENCY_TARGETS} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid stroke={t.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: t.muted, fontSize: 11, fontFamily: FONT_MONO }} />
              <YAxis type="category" dataKey="stage" width={140} tick={{ fill: t.muted, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text }} />
              <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
              <Bar dataKey="targetMs"  name="Target (ms)"  fill="var(--atom-text-muted, #8a8a96)" fillOpacity={0.25} />
              <Bar dataKey="currentMs" name="Current (ms)" fill="var(--atom-primary, #00c8c8)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Voice Engine
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_CAPABILITIES = [
  { capability: "Pickup detection",       status: "shipped" as const,     stack: "Hume EVI vocal turn-end",            note: "pickup_gate=true · config 3c6f8a5b" },
  { capability: "Sub-200ms barge-in",     status: "shipped" as const,     stack: "Hume EVI 4 native interruption",     note: "built-in, no tuning needed" },
  { capability: "Voicemail drop (AMD)",   status: "shipped" as const,     stack: "Twilio AMD → leave_voicemail()",     note: "amd_timeout=3200ms · auto-routes if voicemail" },
  { capability: "Emotion-aware pacing",   status: "shipped" as const,     stack: "Hume EVI emotion scores",            note: "if anger>0.6 → slow_down() · empathy>0.7 → mirror" },
  { capability: "Objection interruption", status: "shipped" as const,     stack: "Custom barge-in handler",            note: "ATOM_OBJECTION_GATE=true · 80ms barge cutoff" },
  { capability: "DTMF keypress",          status: "shipped" as const,     stack: "Twilio media fork",                  note: "RFC 2833 · IVR navigation enabled" },
  { capability: "Echo cancellation",      status: "shipped" as const,     stack: "Twilio + WebRTC AEC",                note: "echo_cancel=true · double-talk gate=0.85" },
  { capability: "Post-call transcript",   status: "shipped" as const,     stack: "Deepgram Nova-3 async batch",        note: "VTT format · min_confidence=0.75" },
  { capability: "Background noise floor", status: "in_progress" as const, stack: "ASR confidence dynamic threshold",   note: "confidence<0.4 → say('sorry, what was that?')" },
  { capability: "Prosody naturalness",    status: "in_progress" as const, stack: "Octave 2 TTS prosody controls",      note: "speed=0.98 · pitch_variance=1.1 · variance ramp Q3" },
  { capability: "Hold music + transfer",  status: "in_progress" as const, stack: "Twilio TwiML <Play> + <Dial>",       note: "hold_music_url=s3://atom-hold/loop.mp3" },
  { capability: "Multi-lingual switch",   status: "pending" as const,     stack: "Deepgram Nova-3 language detect",    note: "lang_detect=auto · fallback=en · Q4 target" },
  { capability: "Custom-cloned voices",   status: "pending" as const,     stack: "Voice Foundry on Blackwell GPU",     note: "Q4 2026 · gated on Blackwell readiness" },
];

const VOICE_RADAR = [
  { axis: "Latency",   atom: 92, top: 95, median: 70 },
  { axis: "Realism",   atom: 88, top: 92, median: 65 },
  { axis: "Empathy",   atom: 95, top: 80, median: 50 },
  { axis: "Barge-in",  atom: 98, top: 95, median: 60 },
  { axis: "Pickup",    atom: 96, top: 92, median: 70 },
  { axis: "Voicemail", atom: 100, top: 100, median: 85 },
  { axis: "Languages", atom: 35, top: 90, median: 60 },
];

function TabVoice() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MiniKpi label="Capabilities Shipped" value="8 / 13" tone={t.success} />
        <MiniKpi label="In Progress"          value="3"      tone={t.warning} />
        <MiniKpi label="Q4 Pending"           value="2" />
        <MiniKpi label="Avg Empathy Score"    value="78%"    sub="Hume EVI on prod calls" tone={t.primary} />
        <MiniKpi label="Avg Hostility Score"  value="14%"    sub="Hume EVI hostility signal" tone={t.success} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Panel>
          <Eyebrow color={t.primary}>Capability Matrix</Eyebrow>
          <SectionTitle>Voice engine behaviors</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
            {VOICE_CAPABILITIES.map((c) => (
              <div key={c.capability} style={{
                display: "grid", gridTemplateColumns: "1fr auto", gap: 8,
                padding: "10px 12px",
                background: t.surface2,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>{c.capability}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>{c.stack}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.faint }}>{c.note}</div>
                </div>
                <div style={{ alignSelf: "center" }}><StatusBadge status={c.status} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <Eyebrow color={t.primary}>Engine Capability Radar</Eyebrow>
          <SectionTitle>ATOM vs top performer vs median</SectionTitle>
          <div style={{ height: 320, marginTop: 14 }}>
            <ResponsiveContainer>
              <RadarChart data={VOICE_RADAR}>
                <PolarGrid stroke={t.grid} />
                <PolarAngleAxis dataKey="axis" tick={{ fill: t.muted, fontSize: 11, fontFamily: FONT_MONO }} />
                <PolarRadiusAxis tick={{ fill: t.faint, fontSize: 9 }} angle={90} domain={[0, 100]} />
                <Radar name="ATOM"   dataKey="atom"   stroke="var(--atom-primary, #00c8c8)" fill="var(--atom-primary, #00c8c8)" fillOpacity={0.35} />
                <Radar name="Top performer" dataKey="top" stroke="var(--atom-accent-samba, #f5c842)" fill="var(--atom-accent-samba, #f5c842)" fillOpacity={0.15} />
                <Radar name="Median competitor" dataKey="median" stroke="var(--atom-text-muted, #8a8a96)" fill="var(--atom-text-muted, #8a8a96)" fillOpacity={0.10} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — Channels (multi-channel coverage)
// ─────────────────────────────────────────────────────────────────────────────
const CHANNELS = [
  { channel: "Voice",      icon: Mic,             status: "shipped" as const, vendor: "Twilio + Hume EVI 4",         coverage: 100, color: "var(--atom-primary, #00c8c8)" },
  { channel: "SMS",        icon: MessageSquare,   status: "in_progress" as const, vendor: "Twilio Messaging",       coverage: 65,  color: "var(--atom-success, #4ade80)" },
  { channel: "Email",      icon: BadgeCheck,      status: "in_progress" as const, vendor: "Resend (apex)",          coverage: 80,  color: "var(--atom-accent-gpt, #74c0fc)" },
  { channel: "LinkedIn DM",icon: MessageSquare,   status: "pending" as const,    vendor: "Apollo SequenceAPI (Q3)", coverage: 0,   color: "var(--atom-text-muted, #8a8a96)" },
  { channel: "Web chat",   icon: MessageSquare,   status: "in_progress" as const, vendor: "ATOM embed widget",     coverage: 40,  color: "var(--atom-accent-claude, #c084fc)" },
  { channel: "WhatsApp",   icon: MessageSquare,   status: "pending" as const,    vendor: "Twilio WA Business (Q4)", coverage: 0,   color: "var(--atom-text-muted, #8a8a96)" },
];

function TabChannels() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MiniKpi label="Channels Live"   value="1 / 6" tone={t.primary} />
        <MiniKpi label="In Build"        value="3"     tone={t.warning} />
        <MiniKpi label="Q3 Targets"      value="SMS + Email + Chat" />
        <MiniKpi label="Q4 Targets"      value="LinkedIn + WhatsApp" />
      </div>

      <Panel>
        <Eyebrow color={t.primary}>Channel Coverage</Eyebrow>
        <SectionTitle>Build-out progress per channel</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 14 }}>
          {CHANNELS.map(({ channel, icon: Icon, status, vendor, coverage, color }) => (
            <div key={channel} style={{
              background: t.surface2,
              border: `1px solid ${t.border}`,
              borderRadius: 12, padding: 16,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `color-mix(in oklab, ${color} 16%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`,
                    display: "grid", placeItems: "center",
                  }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{channel}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: t.muted }}>{vendor}</div>
                  </div>
                </div>
                <StatusBadge status={status} />
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.16em", color: t.muted, textTransform: "uppercase" }}>Coverage</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11, color, fontWeight: 700 }}>{coverage}%</span>
                </div>
                <div style={{ height: 3, background: t.bg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${coverage}%`, height: "100%",
                    background: color, transition: "width 600ms ease",
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — Competitive (live Sonar feed)
// ─────────────────────────────────────────────────────────────────────────────
interface CompetitorRow {
  name: string;
  funding?: string;
  fundingRoundDate?: string;
  pricingStarter?: string;
  pricingEnterprise?: string;
  voiceVendor?: string;
  latencyP50Ms?: number | string;
  channels?: string[];
  notableFlaw?: string;
  source?: string;
}

function fmtUsd(n: any): string {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v}`;
}

function normalizeCompetitor(c: any): CompetitorRow {
  // Tolerate any of: camelCase, snake_case, and nested `pricing.{starter,enterprise}`.
  const pricing = c?.pricing ?? {};
  const starterRaw = c?.pricingStarter ?? c?.pricing_starter ?? pricing?.starter;
  const enterpriseRaw = c?.pricingEnterprise ?? c?.pricing_enterprise ?? pricing?.enterprise;
  const fundingRaw =
    c?.funding ?? c?.total_funding ?? c?.funding_total_usd ?? c?.fundingTotalUsd;
  return {
    name: c?.name ?? "(unknown)",
    funding: typeof fundingRaw === "number" ? fmtUsd(fundingRaw) : (fundingRaw ?? "—"),
    fundingRoundDate: c?.fundingRoundDate ?? c?.last_round ?? c?.latest_round ?? "—",
    pricingStarter: typeof starterRaw === "number" ? `$${starterRaw.toLocaleString()}` : (starterRaw ?? "—"),
    pricingEnterprise: typeof enterpriseRaw === "number" ? `$${enterpriseRaw.toLocaleString()}` : (enterpriseRaw ?? "—"),
    voiceVendor: c?.voiceVendor ?? c?.voice_vendor ?? c?.voice_engine ?? "—",
    latencyP50Ms: c?.latencyP50Ms ?? c?.latency_p50_ms ?? c?.latency_p50 ?? "—",
    channels: Array.isArray(c?.channels) ? c.channels : (typeof c?.channels === "string" ? c.channels.split(",") : []),
    notableFlaw: c?.notableFlaw ?? c?.notable_flaw ?? c?.weakness ?? "",
    source: c?.source ?? "",
  };
}

function TabCompetitive() {
  const { data, isLoading, error, refetch } = useAdminQuery<any>(
    ["vibranium", "competitive"],
    "/api/vibranium/competitive"
  );

  const competitors: CompetitorRow[] = useMemo(() => {
    const raw = data?.competitors ?? [];
    return raw.map(normalizeCompetitor);
  }, [data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MiniKpi label="Competitors Tracked" value={competitors.length || "—"} tone={t.primary} />
        <MiniKpi label="Live Feed" value={data?.updatedAt ? "ACTIVE" : "STATIC FALLBACK"} sub={data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "Perplexity Sonar Pro · 6h cache"} tone={data?.updatedAt ? t.success : t.warning} />
        <MiniKpi label="ATOM Advantage" value="Empathy + Edge" sub="Hume EVI 4 emotion scoring · Akamai 6-layer" />
        <MiniKpi label="Refresh" value="Sonar Pro" sub="search_context_size=high · domain-filtered" />
      </div>

      <Panel padded={false}>
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Eyebrow color={t.primary}>Live Competitive Matrix</Eyebrow>
            <SectionTitle>Voice AI sales-agent competitors (May 2026)</SectionTitle>
          </div>
          <button
            onClick={() => refetch()}
            style={{
              background: t.surface2, border: `1px solid ${t.borderStrong}`, borderRadius: 8,
              padding: "8px 14px", color: t.text, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600,
            }}
          >
            <RefreshCw size={14} /> Refresh Sonar
          </button>
        </div>

        {isLoading && <div style={{ padding: 20, color: t.muted, textAlign: "center" }}>Loading live feed...</div>}
        {error && <div style={{ padding: 20, color: t.danger, textAlign: "center" }}>Feed error: {String(error)}</div>}

        {!isLoading && !error && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.bg }}>
                  {["Competitor", "Funding", "Starter / mo", "Enterprise", "Voice Vendor", "P50 ms", "Channels", "Notable Flaw"].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left",
                      fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.14em",
                      color: t.muted, textTransform: "uppercase", fontWeight: 600,
                      borderBottom: `1px solid ${t.border}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => (
                  <tr key={c.name} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: t.text, fontSize: 13 }}>{c.name}</td>
                    <td style={{ padding: "12px 14px", color: t.muted, fontFamily: FONT_MONO, fontSize: 12 }}>{c.funding}</td>
                    <td style={{ padding: "12px 14px", color: t.text, fontSize: 12 }}>{c.pricingStarter}</td>
                    <td style={{ padding: "12px 14px", color: t.text, fontSize: 12 }}>{c.pricingEnterprise}</td>
                    <td style={{ padding: "12px 14px", color: t.muted, fontSize: 12 }}>{c.voiceVendor}</td>
                    <td style={{ padding: "12px 14px", color: t.text, fontFamily: FONT_MONO, fontSize: 12 }}>{c.latencyP50Ms}</td>
                    <td style={{ padding: "12px 14px", color: t.muted, fontSize: 11, maxWidth: 140 }}>
                      {(c.channels ?? []).join(", ") || "—"}
                    </td>
                    <td style={{ padding: "12px 14px", color: t.danger, fontSize: 11, maxWidth: 220 }}>{c.notableFlaw}</td>
                  </tr>
                ))}
                {competitors.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 30, textAlign: "center", color: t.faint }}>
                      No competitors loaded. Hit Refresh Sonar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {data?.sources && Array.isArray(data.sources) && data.sources.length > 0 && (
        <Panel>
          <Eyebrow color={t.muted}>Sources</Eyebrow>
          <SectionTitle>Citations from this run</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {data.sources.slice(0, 8).map((s: any, i: number) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" style={{
                color: t.primary, fontSize: 12, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <ArrowUpRight size={12} /> {s.title || s.url}
              </a>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6 — Forecast
// ─────────────────────────────────────────────────────────────────────────────
function TabForecast() {
  const { data, isLoading } = useAdminQuery<any>(
    ["vibranium", "projection"],
    "/api/vibranium/projection"
  );

  const quarters = data?.quarters ?? [];
  const scenarios = data?.scenarios ?? {};

  // Build chart series merging the 3 scenarios per-quarter
  const chartData = useMemo(() => {
    return quarters.map((q: string, i: number) => ({
      quarter: q,
      conservative: scenarios?.conservative?.arr?.[i] ?? 0,
      base:         scenarios?.base?.arr?.[i] ?? 0,
      wild:         scenarios?.wild?.arr?.[i] ?? 0,
    }));
  }, [quarters, scenarios]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <MiniKpi label="Conservative GA-Exit ARR" value={fmtArr(scenarios?.conservative?.arr?.slice(-1)[0])} sub="Q1 2027" tone={t.muted} />
        <MiniKpi label="Base GA-Exit ARR"         value={fmtArr(scenarios?.base?.arr?.slice(-1)[0])}         sub="Q1 2027" tone={t.primary} />
        <MiniKpi label="Wild GA-Exit ARR"         value={fmtArr(scenarios?.wild?.arr?.slice(-1)[0])}         sub="Q1 2027" tone={t.success} />
        <MiniKpi label="GTM Burn Rate"            value="$240k/mo" sub="incl. headcount + infra"             tone={t.warning} />
        <MiniKpi label="Runway (base case)"       value="14 mo"    sub="without follow-on raise" />
      </div>

      <Panel>
        <Eyebrow color={t.primary}>ARR Projection</Eyebrow>
        <SectionTitle>3-scenario quarterly run-rate · Q2 2026 → Q4 2027</SectionTitle>
        <div style={{ height: 340, marginTop: 14 }}>
          {isLoading ? (
            <div style={{ padding: 60, textAlign: "center", color: t.muted }}>Building projection...</div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid stroke={t.grid} />
                <XAxis dataKey="quarter" tick={{ fill: t.muted, fontSize: 11, fontFamily: FONT_MONO }} />
                <YAxis tick={{ fill: t.muted, fontSize: 11, fontFamily: FONT_MONO }} tickFormatter={(v) => fmtArr(v as number)} />
                <Tooltip
                  contentStyle={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text }}
                  formatter={(v: any) => fmtArr(v as number)}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
                <Area type="monotone" dataKey="wild"         name="Wild"        stroke="var(--atom-success, #4ade80)" fill="var(--atom-success, #4ade80)" fillOpacity={0.18} />
                <Area type="monotone" dataKey="base"         name="Base"        stroke="var(--atom-primary, #00c8c8)" fill="var(--atom-primary, #00c8c8)" fillOpacity={0.24} />
                <Area type="monotone" dataKey="conservative" name="Conservative" stroke="var(--atom-text-muted, #8a8a96)" fill="var(--atom-text-muted, #8a8a96)" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <Panel>
        <Eyebrow color={t.primary}>Assumption Snapshot</Eyebrow>
        <SectionTitle>What's baked into the model</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
          {[
            { k: "Starting tenants (Q2 2026)", v: data?.assumptions?.startTenants ?? "—" },
            { k: "Plan mix (% new)", v: data?.assumptions?.planMix ? formatMix(data.assumptions.planMix) : "—" },
            { k: "Quarterly churn (base)", v: data?.assumptions?.churnRateQ?.base ? `${(data.assumptions.churnRateQ.base * 100).toFixed(1)}%` : "—" },
            { k: "Voice attach (base)", v: data?.assumptions?.voiceAttachRate?.base ? `${(data.assumptions.voiceAttachRate.base * 100).toFixed(0)}%` : "—" },
            { k: "New tenants / Q (base)", v: data?.assumptions?.newTenantsPerQ?.base ?? "—" },
            { k: "Voice add-on ARPU", v: data?.assumptions?.voiceArpu ? `$${data.assumptions.voiceArpu}/mo` : "—" },
          ].map(({ k, v }) => (
            <div key={k} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.16em", color: t.muted, marginBottom: 6, textTransform: "uppercase" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: FONT_MONO }}>{String(v)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function fmtArr(v: any): string {
  const n = Number(v ?? 0);
  if (!isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function formatMix(mix: Record<string, number>): string {
  return Object.entries(mix).map(([k, v]) => `${k.slice(0, 3)} ${Math.round((v as number) * 100)}%`).join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7 — Risks
// ─────────────────────────────────────────────────────────────────────────────
const RISKS = [
  {
    risk: "Apollo people-search scope not enabled on master key",
    severity: "high" as const,
    likelihood: "active" as const,
    impact: "Campaign + Prospect modules return empty; demos blocked",
    mitigation: "PDL primary + ZoomInfo enterprise fallback evaluation Q3 wk 1; Apollo plan upgrade in parallel",
    owner: "Ben",
  },
  {
    risk: "Blackwell GPU driver/NCCL delivery slip",
    severity: "med" as const,
    likelihood: "likely" as const,
    impact: "Voice Foundry custom-cloned voices slips Q4 → Q1 2027",
    mitigation: "Brandon (Akamai) commits weekly status; if slip >2wk, swap to lambda H100 cluster as bridge",
    owner: "Brandon @ Akamai",
  },
  {
    risk: "Twilio Conversational Intelligence pricing change",
    severity: "med" as const,
    likelihood: "possible" as const,
    impact: "Per-minute COGS spike could compress voice margin from 68% → 45%",
    mitigation: "Telnyx A/B in Q3 cohort; lock 2-yr Twilio commit if pricing stable through GA",
    owner: "Ben",
  },
  {
    risk: "SOC 2 Type I audit gap (no current report)",
    severity: "high" as const,
    likelihood: "blocking" as const,
    impact: "Enterprise pipeline >$2M ACV cannot close without SOC 2",
    mitigation: "Vanta kickoff Q3 wk 1; controls in place + 30-day observation closes Q3; report ETA Q4 wk 4",
    owner: "Ben + Vanta",
  },
  {
    risk: "Hume EVI 4 rate limits at scale",
    severity: "med" as const,
    likelihood: "future" as const,
    impact: "Concurrent call ceiling caps at ~250 simultaneous before throttling",
    mitigation: "Multi-tenant Hume sub-configs Q3; bring inference on-prem Blackwell Q4 as primary",
    owner: "Ben",
  },
  {
    risk: "Sonar API throttling on competitive intel refresh",
    severity: "low" as const,
    likelihood: "rare" as const,
    impact: "Vibranium GA Competitive tab falls back to curated static matrix",
    mitigation: "6h in-memory cache · static fallback already in /api/vibranium/competitive.ts",
    owner: "Auto-handled",
  },
  {
    risk: "GDPR data residency on EU tenants",
    severity: "med" as const,
    likelihood: "future" as const,
    impact: "Cannot sell to EU enterprise without eu-west origin + DPA",
    mitigation: "Akamai EdgeWorker Layer 5 routes EU traffic to eu-west origin; spin up EU Linode Q4",
    owner: "Ben",
  },
];

const SEVERITY_TONES: Record<string, { color: string; label: string }> = {
  high: { color: "var(--atom-danger, #ff7b6b)",   label: "HIGH" },
  med:  { color: "var(--atom-warning, #f5c842)",  label: "MEDIUM" },
  low:  { color: "var(--atom-success, #4ade80)",  label: "LOW" },
};

function TabRisks() {
  const high = RISKS.filter((r) => r.severity === "high").length;
  const med  = RISKS.filter((r) => r.severity === "med").length;
  const low  = RISKS.filter((r) => r.severity === "low").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <MiniKpi label="Total Risks Tracked" value={RISKS.length} />
        <MiniKpi label="High Severity"   value={high} tone={t.danger}  sub="must mitigate pre-GA" />
        <MiniKpi label="Medium Severity" value={med}  tone={t.warning} sub="active monitoring" />
        <MiniKpi label="Low Severity"    value={low}  tone={t.success} sub="acceptable / handled" />
      </div>

      <Panel>
        <Eyebrow color={t.danger}>Risk Register</Eyebrow>
        <SectionTitle>Open risks blocking GA</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          {RISKS.map((r) => {
            const tone = SEVERITY_TONES[r.severity];
            return (
              <div key={r.risk} style={{
                background: t.surface2,
                border: `1px solid ${t.border}`,
                borderLeft: `3px solid ${tone.color}`,
                borderRadius: 10, padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>{r.risk}</div>
                  <span style={{
                    fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
                    padding: "3px 8px", borderRadius: 6, letterSpacing: "0.08em",
                    color: tone.color,
                    background: `color-mix(in oklab, ${tone.color} 14%, transparent)`,
                    border: `1px solid color-mix(in oklab, ${tone.color} 32%, transparent)`,
                  }}>{tone.label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, fontSize: 12 }}>
                  <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.16em", color: t.muted, marginBottom: 4, textTransform: "uppercase" }}>Impact</div>
                    <div style={{ color: t.text, lineHeight: 1.45 }}>{r.impact}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: "0.16em", color: t.muted, marginBottom: 4, textTransform: "uppercase" }}>Mitigation</div>
                    <div style={{ color: t.text, lineHeight: 1.45 }}>{r.mitigation}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontFamily: FONT_MONO, fontSize: 10.5, color: t.faint }}>
                  OWNER: {r.owner} · LIKELIHOOD: {r.likelihood.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin key control (preserved from old shell — minimal version)
// ─────────────────────────────────────────────────────────────────────────────
function AdminKeyBar() {
  // useAdminKey returns { key, save } — NOT a tuple. Object-destructure.
  const { key: adminKey, save: setAdminKey } = useAdminKey();
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState(adminKey || "");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", background: t.surface2,
      border: `1px solid ${t.border}`, borderRadius: 10,
      fontFamily: FONT_MONO, fontSize: 11,
    }}>
      <KeyRound size={14} style={{ color: t.muted }} />
      <span style={{ color: t.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>Admin Key</span>
      <input
        type={showKey ? "text" : "password"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="paste admin key"
        style={{
          flex: 1, background: t.bg, border: `1px solid ${t.border}`,
          color: t.text, padding: "6px 10px", borderRadius: 6,
          fontFamily: FONT_MONO, fontSize: 11,
        }}
      />
      <button
        onClick={() => setShowKey(!showKey)}
        style={{ background: "transparent", border: "none", color: t.muted, fontSize: 11, cursor: "pointer" }}
      >{showKey ? "hide" : "show"}</button>
      <button
        onClick={() => setAdminKey(draft.trim())}
        style={{
          background: t.primary, color: t.bg,
          border: "none", borderRadius: 6,
          padding: "6px 12px", fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: FONT_DISPLAY,
        }}
      >Save</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────────────────────
export default function VibraniumShell() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("path");
  const session = useSessionContext();

  // Gate to super-admin only — but only ACT on the gate after session has
  // finished loading. SessionContext returns { loading: true, isSuperAdmin:
  // false } during the initial hydration; without the loading check, we'd
  // either redirect or render null and the page would look black while auth
  // resolves.
  useEffect(() => {
    if (!session) return;
    if (session.loading) return;
    if (!session.isSuperAdmin) setLocation("/");
  }, [session, setLocation]);

  if (!session || session.loading) {
    return (
      <div style={{
        padding: 40, minHeight: "60vh",
        display: "grid", placeItems: "center",
        background: t.bg, color: t.muted,
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}>Loading Vibranium Console…</div>
    );
  }

  if (!session.isSuperAdmin) {
    return (
      <div style={{ padding: 40, color: t.text, fontFamily: FONT_DISPLAY }}>
        <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
          <Eyebrow color={t.danger}>Access Denied</Eyebrow>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            Super-admin only
          </div>
          <div style={{ color: t.muted, fontSize: 13 }}>
            The Vibranium GA Console is restricted to Nirmata Holdings super-admins.
            You are signed in as {session.user?.email || "a tenant user"}.
          </div>
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case "path":        return <TabGaPath />;
      case "infra":       return <TabInfra />;
      case "voice":       return <TabVoice />;
      case "channels":    return <TabChannels />;
      case "competitive": return <TabCompetitive />;
      case "forecast":    return <TabForecast />;
      case "risks":       return <TabRisks />;
      default:            return <TabGaPath />;
    }
  };

  return (
    <div style={{
      padding: 24, minHeight: "100vh", background: t.bg,
      fontFamily: FONT_DISPLAY, color: t.text,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
        <div>
          <Eyebrow color={t.primary}>Vibranium GA Console</Eyebrow>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: t.text, lineHeight: 1.1 }}>
            Path to General Availability
          </div>
          <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
            Single command center for ATOM Sales OS's road to GA · refreshed live from Perplexity Sonar Pro
          </div>
        </div>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <AdminKeyBar />
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 2, padding: 4,
        background: t.surface1, border: `1px solid ${t.border}`, borderRadius: 12,
        marginBottom: 22, overflowX: "auto",
      }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 8, border: "none",
                background: isActive ? `color-mix(in oklab, ${t.primary} 14%, transparent)` : "transparent",
                color: isActive ? t.primary : t.muted,
                fontFamily: FONT_DISPLAY, fontSize: 12.5, fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "background 160ms ease, color 160ms ease",
              }}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {/* Active tab */}
      {renderTab()}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 18, borderTop: `1px solid ${t.border}`, fontFamily: FONT_MONO, fontSize: 10.5, color: t.faint, letterSpacing: "0.06em" }}>
        ΔTOM · Vibranium GA Console v2 · Nirmata Holdings · @nirmata/atom-design-system v1.0
      </div>
    </div>
  );
}
