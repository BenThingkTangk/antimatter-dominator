/**
 * VibraniumShell — GA Readiness Console
 *
 * Standalone 7-tab shell for the /admin/vibranium-ga route.
 * Tabs: Roadmap · Voice Realism · Akamai Blackwell · Telephony Upgrade
 *       Multi-Channel · Competitive Intel · GA Earnings Forecast
 *
 * Architecture mirrors AdminShell.tsx but is self-contained (no lazy
 * sub-modules) to keep the bundle clean. Uses identical chart primitives,
 * color tokens, and tab-strip chrome as the existing admin layer.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Map, Mic, Cpu, Phone, Layers, Crosshair, TrendingUp, KeyRound,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  ATOM_TEAL, ATOM_AMBER, ATOM_GREEN, ATOM_DANGER, ATOM_PURPLE,
  ATOM_MUTED, ATOM_FAINT, ATOM_TEXT,
  KpiCard, ChartCard, AreaStack, BarStack, EmptyState,
} from "./charts";
import { useAdminKey } from "./AdminShell";
import { useAdminQuery } from "./useAdminApi";
import { useSessionContext } from "../auth/AuthGate";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ATOM_GOLD = "#ffd166";

const TABS = [
  { id: "roadmap",       label: "Roadmap",            icon: Map },
  { id: "voice",         label: "Voice Realism",       icon: Mic },
  { id: "blackwell",     label: "Akamai Blackwell",    icon: Cpu },
  { id: "telephony",     label: "Telephony Upgrade",   icon: Phone },
  { id: "multichannel",  label: "Multi-Channel",       icon: Layers },
  { id: "competitive",   label: "Competitive Intel",   icon: Crosshair },
  { id: "forecast",      label: "GA Earnings Forecast",icon: TrendingUp },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "done" | "in-progress" | "pending" | "blocked" }) {
  const map: Record<string, { label: string; color: string }> = {
    "done":        { label: "DONE",        color: ATOM_GREEN },
    "in-progress": { label: "IN-PROGRESS", color: ATOM_AMBER },
    "pending":     { label: "PENDING",     color: ATOM_MUTED },
    "blocked":     { label: "BLOCKED",     color: ATOM_DANGER },
  };
  const { label, color } = map[status] ?? map["pending"];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      fontWeight: 700,
      color,
      background: `${color}18`,
      border: `1px solid ${color}44`,
    }}>{label}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Effort badge
// ─────────────────────────────────────────────────────────────────────────────
function EffortBadge({ effort }: { effort: "S" | "M" | "L" | "XL" }) {
  const col = effort === "S" ? ATOM_GREEN : effort === "M" ? ATOM_TEAL : effort === "L" ? ATOM_AMBER : ATOM_PURPLE;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 6,
      fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700,
      color: col, background: `${col}18`, border: `1px solid ${col}44`,
    }}>{effort}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card shell
// ─────────────────────────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: 18, ...style,
    }}>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
      textTransform: "uppercase", color: ATOM_MUTED, marginBottom: 14,
    }}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table helpers
// ─────────────────────────────────────────────────────────────────────────────
const TH_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em",
  textTransform: "uppercase", color: ATOM_FAINT, padding: "8px 12px",
  textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
};
const TD_STYLE: React.CSSProperties = {
  padding: "9px 12px", fontSize: 12, color: ATOM_TEXT, verticalAlign: "middle",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Roadmap
// ─────────────────────────────────────────────────────────────────────────────
type RoadmapItem = {
  title: string; effort: "S" | "M" | "L" | "XL"; owner: string; eta: string;
  status: "done" | "in-progress" | "pending" | "blocked";
};

const ROADMAP_ITEMS: { sprint: string; items: RoadmapItem[] }[] = [
  {
    sprint: "Sprint 1",
    items: [
      { title: "Hume Octave → Octave 2",         effort: "S", owner: "Voice Team",   eta: "Q2 2026", status: "done" },
      { title: "pplx-embed-v1 integration",       effort: "S", owner: "RAG Team",    eta: "Q2 2026", status: "done" },
      { title: "Arize Phoenix + Langfuse setup",  effort: "S", owner: "Infra Team",  eta: "Q2 2026", status: "done" },
      { title: "Sonar best practices",            effort: "S", owner: "AI Team",     eta: "Q2 2026", status: "done" },
      { title: "GPT-5 routing for enrichment",    effort: "S", owner: "AI Team",     eta: "Q2 2026", status: "done" },
    ],
  },
  {
    sprint: "Sprint 2",
    items: [
      { title: "Twilio → Telnyx migration",       effort: "M", owner: "Telephony",   eta: "Q3 2026", status: "in-progress" },
      { title: "Pinecone → Turbopuffer",          effort: "M", owner: "RAG Team",    eta: "Q3 2026", status: "in-progress" },
      { title: "Agent API integration",           effort: "M", owner: "AI Team",     eta: "Q3 2026", status: "in-progress" },
      { title: "MCP servers (Apollo/Hunter/PDL)", effort: "M", owner: "Integrations",eta: "Q3 2026", status: "in-progress" },
      { title: "Trestle + Numeracle compliance",  effort: "M", owner: "Compliance",  eta: "Q3 2026", status: "in-progress" },
    ],
  },
  {
    sprint: "Sprint 3",
    items: [
      { title: "Nemotron 3 Nano NIM on Akamai",   effort: "L", owner: "Infra Team",  eta: "Q4 2026", status: "pending" },
      { title: "Pipecat voice pipeline refactor",  effort: "L", owner: "Voice Team",  eta: "Q4 2026", status: "pending" },
      { title: "LangGraph orchestration (eval)",   effort: "L", owner: "AI Team",     eta: "Q4 2026", status: "pending" },
    ],
  },
  {
    sprint: "Sprint 4",
    items: [
      { title: "EVI 3 unified STT+LLM+TTS spine",    effort: "XL", owner: "Voice Team", eta: "Q1 2027", status: "pending" },
      { title: "LangGraph full checkpointing deploy", effort: "XL", owner: "AI Team",    eta: "Q1 2027", status: "pending" },
    ],
  },
];

const SPRINT_COLORS: Record<string, string> = {
  "Sprint 1": ATOM_GREEN,
  "Sprint 2": ATOM_TEAL,
  "Sprint 3": ATOM_AMBER,
  "Sprint 4": ATOM_PURPLE,
};

function TabRoadmap() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {ROADMAP_ITEMS.map(({ sprint, items }) => {
          const accentColor = SPRINT_COLORS[sprint] ?? ATOM_TEAL;
          return (
            <Panel key={sprint} style={{ borderTop: `2px solid ${accentColor}` }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
                textTransform: "uppercase", color: accentColor, marginBottom: 14, fontWeight: 700,
              }}>{sprint}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((item) => (
                  <div key={item.title} style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: ATOM_TEXT, marginBottom: 8 }}>
                      {item.title}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <EffortBadge effort={item.effort} />
                      <StatusBadge status={item.status} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT, marginLeft: "auto" }}>
                        {item.owner} · {item.eta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Voice Realism
// ─────────────────────────────────────────────────────────────────────────────
const VOICE_BEHAVIORS = [
  { behavior: "Pickup detection",           status: "done",        driver: "Hume EVI vocal end-of-turn",         param: "pickup_gate=true in Hume config 3c6f8a5b" },
  { behavior: "Background noise recovery",  status: "in-progress", driver: "ASR confidence threshold",           param: "confidence < 0.4 → say('sorry, what was that?')" },
  { behavior: "Sub-200ms barge-in",         status: "done",        driver: "Hume EVI 4 turn detection",          param: "built-in" },
  { behavior: "Voicemail drop",             status: "done",        driver: "AMD → leave_voicemail() trigger",    param: "amd_timeout=3200ms" },
  { behavior: "Tone naturalness (prosody)", status: "in-progress", driver: "Octave 2 TTS prosody controls",      param: "speed=0.98, pitch_variance=1.1" },
  { behavior: "Emotion-aware pacing",       status: "done",        driver: "Hume EVI emotion scores",            param: "if anger > 0.6 → slow_down()" },
  { behavior: "Objection interruption",     status: "done",        driver: "Custom barge-in handler",            param: "ATOM_OBJECTION_GATE=true" },
  { behavior: "Multi-lingual switch",       status: "pending",     driver: "Deepgram Nova-3 language detection", param: "lang_detect=auto, fallback=en" },
  { behavior: "DTMF keypress handling",     status: "done",        driver: "Telnyx media fork",                  param: "dtmf_mode=RFC 2833" },
  { behavior: "Echo cancellation",          status: "done",        driver: "Telnyx + WebRTC AEC",                param: "echo_cancel=true" },
  { behavior: "Hold music / transfer",      status: "in-progress", driver: "Telnyx TeXML <Play> + <Transfer>",   param: "hold_music_url=s3://atom-hold/loop.mp3" },
  { behavior: "Post-call transcript",       status: "done",        driver: "Deepgram Nova-3 async batch",        param: "transcript_format=vtt, min_confidence=0.75" },
] as const;

function TabVoice() {
  return (
    <Panel>
      <PanelTitle>Voice Realism — API Behavior Matrix (12 behaviors)</PanelTitle>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Behavior</th>
              <th style={TH_STYLE}>Status</th>
              <th style={TH_STYLE}>Driver</th>
              <th style={TH_STYLE}>Tunable Parameter</th>
            </tr>
          </thead>
          <tbody>
            {VOICE_BEHAVIORS.map((row) => (
              <tr key={row.behavior} style={{ transition: "background 120ms" }}>
                <td style={{ ...TD_STYLE, fontWeight: 600 }}>{row.behavior}</td>
                <td style={TD_STYLE}><StatusBadge status={row.status as any} /></td>
                <td style={{ ...TD_STYLE, color: ATOM_MUTED }}>{row.driver}</td>
                <td style={{ ...TD_STYLE }}>
                  <code style={{
                    fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_TEAL,
                    background: "rgba(0,230,211,0.06)", borderRadius: 4, padding: "2px 5px",
                  }}>{row.param}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Akamai Blackwell
// ─────────────────────────────────────────────────────────────────────────────
const DEPLOYMENT_MANIFEST = {
  linode_type: "g8g-rtx-pro-6000",
  model: "nemotron-3-nano:latest",
  image: "nvcr.io/nim/nvidia/nemotron-3-nano:latest",
  region: "us-lax",
  autoscale: {
    min_nodes: 1,
    max_nodes: 8,
    scale_up_threshold_gpu_pct: 70,
    scale_down_threshold_gpu_pct: 20,
    cooldown_seconds: 120,
  },
  caddy_upstream: "http://localhost:8000",
  cert_provider: "sslip.io",
};

const RUNBOOK_STEPS = [
  "Provision Akamai Linode GPU instance with RTX PRO 6000 Blackwell",
  "Install NVIDIA drivers + Docker + nvidia-container-toolkit",
  "Pull `nvcr.io/nim/nvidia/nemotron-3-nano:latest` from NGC",
  "Mount fine-tuning volume at /mnt/models",
  "Configure Caddy reverse proxy with sslip.io TLS certificate",
  "Update RAG_URL env var on Vercel deployment settings",
  "Add Vercel Edge Config entry routing to nearest Linode GPU node",
  "Smoke-test with `curl /api/atom-leadgen/call` to a test number",
];

function TabBlackwell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* GPU Spec cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <KpiCard label="GDDR7 VRAM" value="96 GB" sub="RTX PRO 6000 Blackwell" tone="success" />
        <KpiCard label="vs H100 Throughput" value="1.63×" sub="NVFP4 on Blackwell" tone="success" />
        <KpiCard label="Edge Nodes" value="4,400+" sub="Akamai global PoPs" tone="default" />
        <KpiCard label="Cost Reduction" value="86%" sub="vs hyperscaler GPU" tone="success" />
      </div>

      {/* Deployment manifest */}
      <Panel>
        <PanelTitle>Deployment Manifest — Linode GPU Instance</PanelTitle>
        <pre style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_TEAL,
          background: "rgba(0,230,211,0.04)", borderRadius: 10,
          padding: 16, margin: 0, overflowX: "auto",
          border: "1px solid rgba(0,230,211,0.12)", lineHeight: 1.7,
        }}>
          {JSON.stringify(DEPLOYMENT_MANIFEST, null, 2)}
        </pre>
      </Panel>

      {/* Runbook */}
      <Panel>
        <PanelTitle>Provisioning Runbook — 8 Steps</PanelTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RUNBOOK_STEPS.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                display: "grid", placeItems: "center",
                background: "rgba(0,230,211,0.1)", border: "1px solid rgba(0,230,211,0.2)",
                color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              }}>{i + 1}</div>
              <span style={{ fontSize: 13, color: ATOM_TEXT, lineHeight: 1.5 }}>
                {step.replace(/`([^`]+)`/g, (_, code) => code).split("`").map((part, j) =>
                  j % 2 === 0
                    ? <span key={j}>{part}</span>
                    : <code key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_TEAL, background: "rgba(0,230,211,0.06)", borderRadius: 4, padding: "0 4px" }}>{part}</code>
                )}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — Telephony Upgrade
// ─────────────────────────────────────────────────────────────────────────────
const TELEPHONY_CARDS = [
  {
    name: "Twilio Current",
    accent: ATOM_MUTED,
    latency: ">3 000ms AI voice",
    perMin: "$0.014",
    perMsg: "$0.0075",
    sipToHume: "❌ Requires SIP trunk config",
    addons: "Voice Intelligence, STIR/SHAKEN, Trust Hub",
  },
  {
    name: "Twilio Upgraded",
    accent: ATOM_AMBER,
    latency: "~2 000ms (optimised)",
    perMin: "$0.013",
    perMsg: "$0.0075",
    sipToHume: "⚠ Possible via SIP trunk",
    addons: "Voice Intelligence Premium, Flex Plug-in, Studio",
  },
  {
    name: "Telnyx Target",
    accent: ATOM_TEAL,
    latency: "<1 000ms (private IP)",
    perMin: "$0.008",
    perMsg: "$0.005",
    sipToHume: "✅ Native SIP → Hume SIP URI",
    addons: "STIR/SHAKEN, CNAM, TeXML (TwiML-compat)",
  },
];

const TWILIO_CHECKLIST = [
  { item: "Voice Intelligence Premium",        cost: "$0.05/min",  url: "https://www.twilio.com/en-us/voice/intelligence" },
  { item: "Trust Hub Business Profile",        cost: "$0/mo",      url: "https://www.twilio.com/en-us/trust-hub" },
  { item: "Verified by Twilio CNAM",           cost: "$1.50/DID",  url: "https://help.twilio.com/articles/1260803225389" },
  { item: "A2P 10DLC Standard Brand",          cost: "$4/mo",      url: "https://www.twilio.com/en-us/sms/a2p-10dlc" },
  { item: "Conversations API",                 cost: "Usage-based",url: "https://www.twilio.com/en-us/conversations" },
  { item: "Flex Plug-in (AI assist)",          cost: "$150/seat",  url: "https://www.twilio.com/en-us/flex" },
  { item: "Twilio SendGrid Essentials (email)",cost: "$19.95/mo",  url: "https://sendgrid.com/en-us/pricing" },
  { item: "Studio IVR Flow Builder",           cost: "$0.001/exec",url: "https://www.twilio.com/en-us/studio" },
];

function TabTelephony() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {TELEPHONY_CARDS.map((card) => (
          <Panel key={card.name} style={{ borderTop: `2px solid ${card.accent}` }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
              textTransform: "uppercase", color: card.accent, marginBottom: 14, fontWeight: 700,
            }}>{card.name}</div>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Latency",        card.latency],
                ["$/min",          card.perMin],
                ["$/SMS",          card.perMsg],
                ["SIP→Hume",       card.sipToHume],
                ["Required addons",card.addons],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <dt style={{ color: ATOM_MUTED, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</dt>
                  <dd style={{ color: ATOM_TEXT, textAlign: "right", margin: 0, maxWidth: "60%" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelTitle>What to Buy from Twilio (if not migrating) — 8 Items</PanelTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Add-On</th>
                <th style={TH_STYLE}>Est. $/month</th>
                <th style={TH_STYLE}>Docs</th>
              </tr>
            </thead>
            <tbody>
              {TWILIO_CHECKLIST.map((row) => (
                <tr key={row.item}>
                  <td style={{ ...TD_STYLE, fontWeight: 600 }}>{row.item}</td>
                  <td style={{ ...TD_STYLE, fontFamily: "var(--font-mono)", color: ATOM_AMBER }}>{row.cost}</td>
                  <td style={TD_STYLE}>
                    <a href={row.url} target="_blank" rel="noreferrer" style={{
                      color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontSize: 10,
                      letterSpacing: "0.06em", textDecoration: "none",
                    }}>docs →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 5 — Multi-Channel
// ─────────────────────────────────────────────────────────────────────────────
const CHANNELS = [
  {
    label: "Voice", vendor: "Telnyx + Hume EVI 3", status: "CONNECTED",
    deliverability: "98%", volume: "1,240 dials", statusColor: ATOM_GREEN,
  },
  {
    label: "Text (SMS)", vendor: "Telnyx A2P 10DLC", status: "CONNECTED",
    deliverability: "94%", volume: "856 texts", statusColor: ATOM_GREEN,
  },
  {
    label: "Email", vendor: "SendGrid Essentials", status: "CONNECTED",
    deliverability: "87%", volume: "4,321 emails", statusColor: ATOM_GREEN,
  },
  {
    label: "LinkedIn", vendor: "Phantom Buster / MCP", status: "PENDING",
    deliverability: "72%", volume: "89 LI msgs", statusColor: ATOM_AMBER,
  },
];

const ORCHESTRATOR_TREE = [
  { trigger: "Cold prospect — never contacted",            action: "→ Voice dial (day 0)" },
  { trigger: "No pickup × 2 dials",                        action: "→ SMS follow-up within 30 min" },
  { trigger: "Positive sentiment on last call",            action: "→ Email detailed proposal" },
  { trigger: "Negative sentiment (frustration > 0.6)",     action: "→ Pause 3 days, restart with LinkedIn" },
  { trigger: "Email bounced",                              action: "→ SMS fallback immediately" },
  { trigger: "LinkedIn connected",                         action: "→ InMail drip (T+0, T+3, T+7)" },
  { trigger: "Meeting booked",                             action: "→ Email calendar invite + reminder SMS" },
  { trigger: "Unsubscribe signal detected",                action: "→ DNC all channels, tag in CRM" },
];

function TabMultiChannel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {CHANNELS.map((ch) => (
          <Panel key={ch.label} style={{ borderLeft: `3px solid ${ch.statusColor}` }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: ATOM_TEXT, marginBottom: 6 }}>
              {ch.label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, marginBottom: 12 }}>
              {ch.vendor}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{
                display: "inline-block", padding: "2px 8px", borderRadius: 6,
                fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
                fontWeight: 700, color: ch.statusColor,
                background: `${ch.statusColor}18`, border: `1px solid ${ch.statusColor}44`,
              }}>{ch.status}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED }}>{ch.deliverability}</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: ATOM_TEXT, marginBottom: 12 }}>
              {ch.volume}
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: ATOM_FAINT, marginLeft: 6 }}>last 30d</span>
            </div>
            <button style={{
              padding: "7px 14px", borderRadius: 8, border: `1px solid rgba(0,230,211,0.24)`,
              background: "rgba(0,230,211,0.06)", color: ATOM_TEAL,
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", cursor: "pointer", fontWeight: 700,
            }}>Configure</button>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelTitle>ATOM Orchestrator — Channel Decision Tree</PanelTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ORCHESTRATOR_TREE.map((row, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ flex: 1, fontSize: 12, color: ATOM_MUTED }}>{row.trigger}</div>
              <div style={{ fontSize: 12, color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {row.action}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 6 — Competitive Intel
// ─────────────────────────────────────────────────────────────────────────────
const FEATURE_MATRIX_COLS = [
  { key: "atom",      label: "ATOM",       color: ATOM_TEAL },
  { key: "gong",      label: "Gong",       color: ATOM_MUTED },
  { key: "outreach",  label: "Outreach",   color: ATOM_MUTED },
  { key: "salesloft", label: "SalesLoft",  color: ATOM_MUTED },
  { key: "apollo",    label: "Apollo.io",  color: ATOM_MUTED },
];

const FEATURE_ROWS = [
  { feature: "AI Voice Agent",          atom: "✅", gong: "❌", outreach: "❌", salesloft: "❌", apollo: "❌" },
  { feature: "Real-time Emotion AI",    atom: "✅", gong: "Partial", outreach: "❌", salesloft: "❌", apollo: "❌" },
  { feature: "Multi-channel orchestr.", atom: "✅", gong: "❌", outreach: "✅", salesloft: "✅", apollo: "Partial" },
  { feature: "Embedded RAG",            atom: "✅", gong: "❌", outreach: "❌", salesloft: "❌", apollo: "❌" },
  { feature: "TCPA-native compliance",  atom: "✅", gong: "❌", outreach: "Partial", salesloft: "Partial", apollo: "Partial" },
  { feature: "Self-hosted LLM option",  atom: "✅", gong: "❌", outreach: "❌", salesloft: "❌", apollo: "❌" },
  { feature: "Per-seat pricing",        atom: "✅", gong: "✅", outreach: "✅", salesloft: "✅", apollo: "✅" },
  { feature: "Open-source components",  atom: "✅", gong: "❌", outreach: "❌", salesloft: "❌", apollo: "❌" },
];

const FUNDING_DATA = [
  { name: "Gong",      funding: 583 },
  { name: "Outreach",  funding: 489 },
  { name: "SalesLoft", funding: 245 },
  { name: "Apollo.io", funding: 251 },
  { name: "ATOM",      funding: 12 },
];

const COMP_TABLE = [
  { company: "Gong",       arr: "$200M+",  round: "Series E · $250M",  pricing: "$140/seat/mo",  notes: "Strong call intelligence, no native voice agent" },
  { company: "Outreach",   arr: "$150M+",  round: "Series F · $200M",  pricing: "$120/seat/mo",  notes: "Sequences-focused, no AI voice" },
  { company: "SalesLoft",  arr: "$100M+",  round: "Acquired by Vista", pricing: "$125/seat/mo",  notes: "CRM-native, weak AI" },
  { company: "Apollo.io",  arr: "$100M+",  round: "Series D · $100M",  pricing: "$49/seat/mo",   notes: "Data-rich, shallow voice layer" },
  { company: "ATOM",       arr: "Pre-GA",  round: "Seed",              pricing: "From $299/mo",  notes: "Voice-first AI, open-weights, Vibranium stack" },
];

function TabCompetitive() {
  const { data, isLoading, error } = useAdminQuery(
    ["vibranium", "competitive"],
    "/api/vibranium/competitive",
    { refetchInterval: 6 * 60 * 60 * 1000 }
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Feature Heatmap */}
      <Panel>
        <PanelTitle>Feature Heatmap — ATOM vs Competitors</PanelTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Feature</th>
                {FEATURE_MATRIX_COLS.map((col) => (
                  <th key={col.key} style={{
                    ...TH_STYLE,
                    color: col.color,
                    borderBottom: col.key === "atom" ? `2px solid ${ATOM_TEAL}` : TH_STYLE.borderBottom,
                  }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td style={{ ...TD_STYLE, fontWeight: 600 }}>{row.feature}</td>
                  {FEATURE_MATRIX_COLS.map((col) => {
                    const val = (row as any)[col.key];
                    const isAtom = col.key === "atom";
                    return (
                      <td key={col.key} style={{
                        ...TD_STYLE,
                        textAlign: "center",
                        background: isAtom ? "rgba(0,230,211,0.04)" : undefined,
                        color: val === "✅" ? ATOM_GREEN : val === "❌" ? ATOM_DANGER : ATOM_AMBER,
                      }}>{val}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Funding chart */}
      <ChartCard title="Total Funding ($M)" height={220}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={FUNDING_DATA} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: ATOM_FAINT }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: ATOM_FAINT }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: "rgba(8,11,14,0.96)", border: "1px solid rgba(0,230,211,0.18)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_TEXT }} />
            <Bar dataKey="funding" name="Funding ($M)" radius={[4, 4, 0, 0]}>
              {FUNDING_DATA.map((entry, i) => (
                <rect key={i} fill={entry.name === "ATOM" ? ATOM_TEAL : ATOM_MUTED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Competitor table */}
      <Panel>
        <PanelTitle>Competitor Overview</PanelTitle>
        {isLoading && <EmptyState message="Fetching competitive data…" />}
        {error && (
          <div style={{ fontSize: 12, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
            Live feed unavailable — showing static snapshot.
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr>
                <th style={TH_STYLE}>Company</th>
                <th style={TH_STYLE}>ARR Est.</th>
                <th style={TH_STYLE}>Last Round</th>
                <th style={TH_STYLE}>Pricing</th>
                <th style={TH_STYLE}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(data?.competitors ?? COMP_TABLE).map((row: any) => (
                <tr key={row.company}>
                  <td style={{ ...TD_STYLE, fontWeight: 700, color: row.company === "ATOM" ? ATOM_TEAL : ATOM_TEXT }}>{row.company}</td>
                  <td style={{ ...TD_STYLE, fontFamily: "var(--font-mono)" }}>{row.arr}</td>
                  <td style={{ ...TD_STYLE, color: ATOM_MUTED }}>{row.round}</td>
                  <td style={{ ...TD_STYLE, color: ATOM_AMBER, fontFamily: "var(--font-mono)" }}>{row.pricing}</td>
                  <td style={{ ...TD_STYLE, color: ATOM_MUTED, fontSize: 11 }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT }}>
          Sources: Crunchbase · PitchBook · vendor pricing pages · auto-refresh every 6h
        </div>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 7 — GA Earnings Forecast
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PROJECTION_DATA = [
  { q: "Q3 '26", conservative: 80,  base: 120,  wild: 200,  saas: 60,  voice: 40,  redteam: 20  },
  { q: "Q4 '26", conservative: 160, base: 260,  wild: 480,  saas: 140, voice: 80,  redteam: 40  },
  { q: "Q1 '27", conservative: 290, base: 480,  wild: 940,  saas: 260, voice: 150, redteam: 70  },
  { q: "Q2 '27", conservative: 460, base: 820,  wild: 1700, saas: 440, voice: 260, redteam: 120 },
];

const DEFAULT_YEAR_END = {
  conservative: "$460K",
  base: "$820K",
  wild: "$1.7M",
};

const LINE_COLORS = {
  conservative: ATOM_MUTED,
  base: ATOM_TEAL,
  wild: ATOM_GOLD,
};

function TabForecast() {
  const [assumptions, setAssumptions] = useState({
    newTenantsPerQ: 8,
    voiceAttachRate: 0.65,
    churnRateQ: 0.04,
  });

  const { data, isLoading } = useAdminQuery(
    ["vibranium", "projection", assumptions],
    "/api/vibranium/projection",
    { enabled: true }
  );

  const projection = data?.quarters ?? DEFAULT_PROJECTION_DATA;
  const yearEnd = data?.yearEnd ?? DEFAULT_YEAR_END;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <KpiCard label="Year-End ARR — Conservative" value={yearEnd.conservative} sub="Risk-adjusted" tone="default" />
        <KpiCard label="Year-End ARR — Base" value={yearEnd.base} sub="Expected case" tone="success" />
        <KpiCard label="Year-End ARR — Wild" value={yearEnd.wild} sub="Upside scenario" tone="warn" />
      </div>

      {/* 3-line ARR forecast */}
      <ChartCard title="Total ARR by Quarter — All Scenarios" subtitle="Thousands USD" height={260}>
        {isLoading
          ? <EmptyState message="Loading projection…" />
          : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projection} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="q" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: ATOM_FAINT }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: ATOM_FAINT }} axisLine={false} tickLine={false} width={42} />
                <Tooltip contentStyle={{ background: "rgba(8,11,14,0.96)", border: "1px solid rgba(0,230,211,0.18)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_TEXT }} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: ATOM_MUTED }} />
                <Line type="monotone" dataKey="conservative" name="Conservative" stroke={LINE_COLORS.conservative} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="base" name="Base" stroke={LINE_COLORS.base} strokeWidth={2.5} dot={false} style={{ filter: `drop-shadow(0 0 6px ${ATOM_TEAL}88)` }} />
                <Line type="monotone" dataKey="wild" name="Wild" stroke={LINE_COLORS.wild} strokeWidth={1.5} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          )
        }
      </ChartCard>

      {/* Sliders */}
      <Panel>
        <PanelTitle>Assumption Sliders — Base Scenario</PanelTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {[
            {
              key: "newTenantsPerQ" as const,
              label: "New Tenants / Quarter",
              min: 1, max: 40, step: 1,
              display: assumptions.newTenantsPerQ.toString(),
            },
            {
              key: "voiceAttachRate" as const,
              label: "Voice Attach Rate",
              min: 0.1, max: 1, step: 0.05,
              display: `${Math.round(assumptions.voiceAttachRate * 100)}%`,
            },
            {
              key: "churnRateQ" as const,
              label: "Churn Rate / Quarter",
              min: 0.01, max: 0.2, step: 0.01,
              display: `${Math.round(assumptions.churnRateQ * 100)}%`,
            },
          ].map(({ key, label, min, max, step, display }) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: ATOM_MUTED }}>{label}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: ATOM_TEAL, fontSize: 16 }}>{display}</span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={assumptions[key]}
                onChange={(e) => setAssumptions((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                style={{ width: "100%", accentColor: ATOM_TEAL }}
              />
            </div>
          ))}
        </div>
      </Panel>

      {/* Stack chart — base scenario by revenue stream */}
      <ChartCard title="Revenue Mix by Quarter — Base Scenario" subtitle="SaaS MRR · Voice MRR · Red Team MRR ($K)" height={240}>
        <BarStack
          data={projection}
          xKey="q"
          series={[
            { key: "saas",    label: "SaaS MRR",     color: ATOM_TEAL },
            { key: "voice",   label: "Voice MRR",    color: ATOM_AMBER },
            { key: "redteam", label: "Red Team MRR", color: ATOM_PURPLE },
          ]}
        />
      </ChartCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main shell
// ─────────────────────────────────────────────────────────────────────────────
export default function VibraniumShell() {
  const [location] = useLocation();
  const { key, save } = useAdminKey();
  const session = useSessionContext();

  const [tab, setTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    return params.get("vtab") || "roadmap";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const t = params.get("vtab") || "roadmap";
    setTab(t);
  }, [location]);

  function setTabUrl(id: string) {
    const url = new URL(window.location.href);
    const hash = url.hash || "#/admin/vibranium-ga";
    const [path] = hash.split("?");
    url.hash = `${path}?vtab=${id}`;
    window.history.replaceState(null, "", url.toString());
    setTab(id);
  }

  const renderBody = () => {
    switch (tab) {
      case "roadmap":      return <TabRoadmap />;
      case "voice":        return <TabVoice />;
      case "blackwell":    return <TabBlackwell />;
      case "telephony":    return <TabTelephony />;
      case "multichannel": return <TabMultiChannel />;
      case "competitive":  return <TabCompetitive />;
      case "forecast":     return <TabForecast />;
      default:             return <TabRoadmap />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 18, flexWrap: "wrap", paddingBottom: 4,
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_MUTED,
            marginBottom: 4,
          }}>ΔTOM · Vibranium GA Review</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800,
            letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)",
          }}>GA Readiness Console</h1>
        </div>
        <VibraniumAdminKeyControl currentKey={key} onSave={save} />
      </header>

      {/* Tab strip */}
      <nav style={{
        display: "flex", gap: 4, padding: 4,
        borderRadius: 14,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTabUrl(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 10,
                background: active ? "rgba(0,230,211,0.08)" : "transparent",
                border: "1px solid " + (active ? "rgba(0,230,211,0.32)" : "transparent"),
                color: active ? ATOM_TEAL : ATOM_MUTED,
                fontFamily: "var(--font-mono)", fontSize: 11,
                letterSpacing: "0.12em", textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 160ms cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </nav>

      {/* Guard: key required */}
      {!key ? (
        <div style={{
          padding: 28, borderRadius: 14,
          background: `linear-gradient(180deg, rgba(255,209,102,0.06), rgba(255,209,102,0.02))`,
          border: "1px solid rgba(255,209,102,0.32)",
          color: "var(--color-text)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em",
            textTransform: "uppercase", color: ATOM_GOLD, marginBottom: 6,
          }}>Admin key required</div>
          <p style={{ marginTop: 0, marginBottom: 0, color: "var(--color-text-muted)" }}>
            The Vibranium GA console accesses strategic roadmap, competitive intel, and earnings projections.
            Paste your <code>ADMIN_API_KEY</code> above to unlock.
          </p>
        </div>
      ) : !session.isSuperAdmin ? (
        <div style={{
          padding: 28, borderRadius: 14,
          background: "linear-gradient(180deg, rgba(255,107,139,0.06), rgba(255,107,139,0.02))",
          border: "1px solid rgba(255,107,139,0.32)", color: "var(--color-text)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em",
            textTransform: "uppercase", color: ATOM_DANGER, marginBottom: 6,
          }}>Super Admin required</div>
          <p style={{ marginTop: 0, marginBottom: 0, color: "var(--color-text-muted)" }}>
            This console is restricted to super_admin accounts. Contact Nirmata Holdings to request access.
          </p>
        </div>
      ) : (
        renderBody()
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline key control (mirrors AdminShell's AdminKeyControl)
// ─────────────────────────────────────────────────────────────────────────────
function VibraniumAdminKeyControl({ currentKey, onSave }: { currentKey: string; onSave: (k: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(currentKey);
  const masked = currentKey ? `${currentKey.slice(0, 6)}…${currentKey.slice(-4)}` : "(unset)";

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: ATOM_MUTED,
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em",
          cursor: "pointer",
        }}
      >
        <KeyRound size={12} /> ADMIN_KEY · {masked}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        autoFocus
        type="password"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Paste ADMIN_API_KEY"
        style={{
          padding: "8px 12px", borderRadius: 10, minWidth: 280,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(0,230,211,0.32)",
          color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12,
          outline: "none",
        }}
      />
      <button
        onClick={() => { onSave(val.trim()); setEditing(false); }}
        style={{
          padding: "8px 14px", borderRadius: 10,
          background: ATOM_TEAL, color: "#041413",
          fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 12,
          border: "none", cursor: "pointer",
        }}
      >Save</button>
      <button
        onClick={() => setEditing(false)}
        style={{
          padding: "8px 14px", borderRadius: 10,
          background: "transparent", color: ATOM_MUTED,
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer", fontSize: 12,
        }}
      >Cancel</button>
    </div>
  );
}
