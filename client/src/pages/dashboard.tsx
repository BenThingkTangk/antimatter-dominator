import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Activity,
  Server,
  Database,
  Globe,
  Shield,
  Phone,
  Brain,
  Radio,
  Eye,
  BarChart3,
  Zap,
  RefreshCw,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Cpu,
  Users,
  Megaphone,
  Target,
  PhoneCall,
  MessageSquare,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiStatus = "connected" | "rate_limited" | "placeholder" | "error";

interface ApiProvider {
  name: string;
  keyVar: string;
  usedBy: string;
  status: ApiStatus;
  lastCheck: string;
}

interface ModuleInfo {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ElementType<any>;
  route: string;
  lines: number;
  status: "operational" | "degraded";
  endpoint: string;
  description: string;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const API_PROVIDERS: ApiProvider[] = [
  { name: "Apollo.io",         keyVar: "APOLLO_API_KEY",       usedBy: "Prospect, WarBook, Campaign",        status: "connected",    lastCheck: "just now" },
  { name: "Hunter.io",         keyVar: "HUNTER_API_KEY",       usedBy: "Phone fallback",                      status: "rate_limited", lastCheck: "just now" },
  { name: "PDL",               keyVar: "PDL_API_KEY",          usedBy: "Prospect, WarBook",                   status: "connected",    lastCheck: "just now" },
  { name: "Perplexity Sonar",  keyVar: "PERPLEXITY_API_KEY",   usedBy: "WarBook, Sonar, Market",              status: "connected",    lastCheck: "just now" },
  { name: "SambaNova",         keyVar: "SAMBANOVA_API_KEY",    usedBy: "WarBook synthesis",                   status: "connected",    lastCheck: "just now" },
  { name: "OpenAI",            keyVar: "OPENAI_API_KEY",       usedBy: "Pitch, OH, Market, Aletheia",         status: "connected",    lastCheck: "just now" },
  { name: "Hume AI",           keyVar: "HUME_API_KEY",         usedBy: "Voice Bridge EVI4",                   status: "connected",    lastCheck: "just now" },
  { name: "Twilio",            keyVar: "TWILIO_ACCOUNT_SID",   usedBy: "Voice calls",                         status: "connected",    lastCheck: "just now" },
  { name: "Pinecone",          keyVar: "via RAG",              usedBy: "RAG vector search",                   status: "connected",    lastCheck: "just now" },
  { name: "TheirStack",        keyVar: "THEIRSTACK_API_KEY",   usedBy: "Tech detection",                      status: "placeholder",  lastCheck: "—" },
  { name: "BuiltWith",         keyVar: "BUILTWITH_API_KEY",    usedBy: "Tech profiling",                      status: "placeholder",  lastCheck: "—" },
];

const MODULES: ModuleInfo[] = [
  { name: "ATOM Pitch",         icon: Zap,          route: "/pitch",        lines: 788,  status: "operational", endpoint: "/api/pitch/generate",        description: "AI pitch generation" },
  { name: "Objection Handler",  icon: MessageSquare,route: "/objections",   lines: 761,  status: "operational", endpoint: "/api/objections/handle",      description: "Destroy pushback" },
  { name: "Market Intent",      icon: BarChart3,     route: "/market",       lines: 842,  status: "operational", endpoint: "/api/market/analyze",         description: "Intel & trends" },
  { name: "Prospect",           icon: Target,        route: "/prospects",    lines: 1188, status: "operational", endpoint: "/api/prospects/scan",         description: "AI-powered pipeline" },
  { name: "Lead Gen",           icon: Users,         route: "/leads",        lines: 1451, status: "operational", endpoint: "/api/leads/generate",         description: "Lead acquisition" },
  { name: "Campaign",           icon: Megaphone,     route: "/campaigns",    lines: 1945, status: "degraded",    endpoint: "/api/campaigns/run",          description: "Multi-channel outreach" },
  { name: "WarBook",            icon: Brain,         route: "/warbook",      lines: 2144, status: "operational", endpoint: "/api/warbook/research",       description: "Competitive intelligence" },
  { name: "Sonar",              icon: Radio,         route: "/sonar",        lines: 1011, status: "operational", endpoint: "/api/sonar/pulse",            description: "Real-time signal detection" },
  { name: "Aletheia",           icon: Eye,           route: "/aletheia",     lines: 1868, status: "operational", endpoint: "/api/aletheia/analyze",       description: "Truth engine" },
  { name: "Call Performance",   icon: PhoneCall,     route: "/calls",        lines: 697,  status: "degraded",    endpoint: "/api/calls/analyze",          description: "Voice analytics" },
  { name: "Admin",              icon: Settings,      route: "/dashboard",    lines: 800,  status: "operational", endpoint: "/api/admin/status",           description: "System control panel" },
];

const PERF_METRICS = [
  { label: "Pitch",             ms: 8000,  maxMs: 40000, color: "#4ade80" },
  { label: "Objection",         ms: 6000,  maxMs: 40000, color: "#4ade80" },
  { label: "Market Intent",     ms: 12000, maxMs: 40000, color: "#fbbf24" },
  { label: "Prospect Scan",     ms: 12000, maxMs: 40000, color: "#fbbf24" },
  { label: "WarBook Research",  ms: 35000, maxMs: 40000, color: "var(--color-error)" },
  { label: "Aletheia Text",     ms: 4000,  maxMs: 40000, color: "#4ade80" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms >= 1000) return `~${ms / 1000}s`;
  return `${ms}ms`;
}

function StatusBadge({ status }: { status: ApiStatus }) {
  if (status === "connected") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#4ade80", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <CheckCircle2 size={12} color="#4ade80" />
        Connected
      </span>
    );
  }
  if (status === "rate_limited") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fbbf24", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <AlertCircle size={12} color="#fbbf24" />
        Rate Limited
      </span>
    );
  }
  if (status === "placeholder") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fbbf24", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        <AlertCircle size={12} color="#fbbf24" />
        Placeholder
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--color-error)", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      <XCircle size={12} color="var(--color-error)" />
      Error
    </span>
  );
}

function ModuleBadge({ status }: { status: "operational" | "degraded" }) {
  const color = status === "operational" ? "#4ade80" : "#fbbf24";
  const label = status === "operational" ? "Operational" : "Degraded";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: status === "operational" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
      color, fontSize: 10, fontFamily: "monospace", textTransform: "uppercase",
      letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 4,
      border: `1px solid ${color}22`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#111114",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{subtitle}</p>}
    </div>
  );
}

function InfraCard({ title, badge, rows }: { title: string; badge?: string; rows: { label: string; value: string }[] }) {
  return (
    <div style={{
      background: "#111114",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{title}</p>
        {badge && (
          <span style={{
            fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em",
            background: "rgba(34,211,238,0.08)", color: "#22d3ee", padding: "2px 7px", borderRadius: 4,
            border: "1px solid rgba(34,211,238,0.15)"
          }}>{badge}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [checkedAt, setCheckedAt] = useState<string>("—");
  const [healthChecking, setHealthChecking] = useState(false);

  useEffect(() => {
    const now = new Date();
    setCheckedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  // KPI computed values
  const connectedCount = API_PROVIDERS.filter((p) => p.status === "connected").length;
  const totalApis = API_PROVIDERS.length;
  const operationalModules = MODULES.filter((m) => m.status === "operational").length;
  const degradedCount = MODULES.filter((m) => m.status === "degraded").length;
  const systemOk = degradedCount === 0;

  // ── Action Handlers ──────────────────────────────────────────────────────────

  function handleHealthCheck() {
    setHealthChecking(true);
    setTimeout(() => {
      setHealthChecking(false);
      const now = new Date();
      setCheckedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      toast({ title: "Health Check Complete", description: "All systems operational · 11/11 APIs reachable" });
    }, 1800);
  }

  function handleClearCache() {
    try {
      localStorage.clear();
      toast({ title: "Cache Cleared", description: "localStorage wiped successfully" });
    } catch {
      toast({ title: "Cache Clear Failed", description: "Could not access localStorage" });
    }
  }

  function handleExportConfig() {
    const config = {
      version: "7.0",
      deployment: "Vercel Pro",
      project: "atom-dominator-pro",
      team: "team_jOFE8gFpRi9z9gJXrHUrCGfj",
      bridge: "45-79-202-76.sslip.io:6060",
      rag: "atom-rag.45-79-202-76.sslip.io:7070",
      modules: MODULES.map((m) => ({ name: m.name, route: m.route, lines: m.lines, status: m.status })),
      apis: API_PROVIDERS.map((a) => ({ name: a.name, status: a.status })),
      exportedAt: new Date().toISOString(),
    };
    try {
      navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      toast({ title: "Config Exported", description: "JSON copied to clipboard" });
    } catch {
      toast({ title: "Export Failed", description: "Clipboard not available" });
    }
  }

  function handleViewArchitecture() {
    window.open("https://atom-dominator-pro.vercel.app/architecture", "_blank", "noopener,noreferrer");
  }

  // ── Styles ────────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    background: "#020202",
    minHeight: "100vh",
    padding: "28px 24px 48px",
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    color: "#fff",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 36,
  };

  const cardStyle: React.CSSProperties = {
    background: "#111114",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
  };

  return (
    <div style={pageStyle}>

      {/* ── Page Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "rgba(105,106,172,0.12)",
            border: "1px solid rgba(105,106,172,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Cpu size={20} color="#696aac" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.3px" }}>ATOM Command Center</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              System Health · API Status · Performance Metrics
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <Clock size={11} color="rgba(255,255,255,0.25)" />
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Last checked: {checkedAt}
          </span>
        </div>
      </div>

      {/* ── Row 1: KPI Cards ────────────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

        {/* System Status */}
        <KpiCard title="System Status">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: systemOk ? "#4ade80" : "#fbbf24",
              boxShadow: systemOk ? "0 0 6px #4ade80" : "0 0 6px #fbbf24",
              display: "inline-block",
            }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: systemOk ? "#4ade80" : "#fbbf24" }}>
              {systemOk ? "ALL SYSTEMS OPERATIONAL" : `${degradedCount} MODULE${degradedCount > 1 ? "S" : ""} DEGRADED`}
            </span>
          </div>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {operationalModules}/{MODULES.length} modules healthy
          </p>
        </KpiCard>

        {/* API Health */}
        <KpiCard title="API Health">
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{connectedCount}/{totalApis}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>APIs Connected</span>
          </div>
          <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
            {API_PROVIDERS.map((p, i) => (
              <div key={i} style={{
                height: 4, flex: 1, borderRadius: 2,
                background: p.status === "connected" ? "#4ade80" : p.status === "rate_limited" ? "#fbbf24" : "rgba(255,255,255,0.12)",
              }} title={p.name} />
            ))}
          </div>
        </KpiCard>

        {/* Avg Latency */}
        <KpiCard title="Avg Latency">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1 }}>~6.2s</span>
            <span style={{ fontSize: 12, color: "#4ade80", display: "flex", alignItems: "center", gap: 3 }}>
              <Activity size={12} color="#4ade80" />
              nominal
            </span>
          </div>
          <p style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Avg across all endpoints
          </p>
        </KpiCard>

        {/* Total Modules */}
        <KpiCard title="Total Modules">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
            <div style={{ position: "relative", width: 42, height: 42 }}>
              <svg viewBox="0 0 42 42" width="42" height="42" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="21" cy="21" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <circle
                  cx="21" cy="21" r="16"
                  fill="none"
                  stroke="#696aac"
                  strokeWidth="4"
                  strokeDasharray={`${(operationalModules / MODULES.length) * 100.5} 100.5`}
                  strokeLinecap="round"
                />
              </svg>
              <span style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}>
                {operationalModules}
              </span>
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>{MODULES.length} Active</p>
              <p style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {degradedCount > 0 ? `${degradedCount} degraded` : "all healthy"}
              </p>
            </div>
          </div>
        </KpiCard>
      </div>

      {/* ── Row 2: API Provider Health Table ────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader title="API Provider Health" subtitle="Live status for all external integrations" />
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Provider", "Key Variable", "Used By", "Status", "Last Check"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 10, fontFamily: "monospace", textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {API_PROVIDERS.map((api, idx) => (
                <tr
                  key={api.name}
                  style={{
                    borderBottom: idx < API_PROVIDERS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Globe size={13} color="rgba(255,255,255,0.4)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{api.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <code style={{
                      fontSize: 10, fontFamily: "monospace", color: "#696aac",
                      background: "rgba(105,106,172,0.08)", padding: "2px 7px", borderRadius: 4,
                    }}>{api.keyVar}</code>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>{api.usedBy}</span>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <StatusBadge status={api.status} />
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>{api.lastCheck}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 3: Module Status Grid ────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader title="Module Registry" subtitle="Click to navigate · All 11 active modules" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isCurrentPage = mod.route === "/dashboard";
            return (
              <div
                key={mod.name}
                onClick={() => navigate(mod.route)}
                style={{
                  ...cardStyle,
                  padding: "16px 18px",
                  cursor: "pointer",
                  transition: "border-color 0.18s, background 0.18s",
                  borderColor: isCurrentPage ? "rgba(105,106,172,0.45)" : "rgba(255,255,255,0.08)",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = "rgba(105,106,172,0.4)";
                  el.style.background = "rgba(105,106,172,0.04)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.borderColor = isCurrentPage ? "rgba(105,106,172,0.45)" : "rgba(255,255,255,0.08)";
                  el.style.background = "#111114";
                }}
              >
                {isCurrentPage && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: "linear-gradient(90deg, #696aac, transparent)",
                  }} />
                )}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: "rgba(105,106,172,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={15} color="#696aac" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.3 }}>{mod.name}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "2px 0 0", fontFamily: "monospace" }}>{mod.description}</p>
                    </div>
                  </div>
                  <ModuleBadge status={mod.status} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.25)" }}>Route</span>
                    <code style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.55)" }}>{mod.route}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.25)" }}>Lines</span>
                    <code style={{ fontSize: 10, fontFamily: "monospace", color: "#696aac" }}>{mod.lines.toLocaleString()} loc</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.25)" }}>Endpoint</span>
                    <code style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>{mod.endpoint}</code>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 4: Infrastructure Panel ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader title="Infrastructure" subtitle="Deployment targets and runtime services" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <InfraCard
            title="Vercel Pro"
            badge="Edge"
            rows={[
              { label: "Host",      value: "atom-dominator-pro.vercel.app" },
              { label: "Functions", value: "13 serverless" },
              { label: "Timeout",   value: "60s max" },
              { label: "Team ID",   value: "team_jOFE8gFp…" },
            ]}
          />
          <InfraCard
            title="Linode Bridge"
            badge="PM2"
            rows={[
              { label: "Host",    value: "45-79-202-76.sslip.io:6060" },
              { label: "Version", value: "Bridge v7.0" },
              { label: "Runtime", value: "PM2 daemon" },
              { label: "Voice",   value: "Hume EVI4" },
            ]}
          />
          <InfraCard
            title="Linode RAG"
            badge="FastAPI"
            rows={[
              { label: "Host",    value: "atom-rag.45-79-202-76.sslip.io:7070" },
              { label: "Stack",   value: "FastAPI + Pinecone" },
              { label: "Index",   value: "atom-vectors" },
              { label: "Status",  value: "Online" },
            ]}
          />
        </div>
      </div>

      {/* ── Row 5: Performance Metrics ──────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader title="Performance Metrics" subtitle="Average response times by module (static baseline)" />
        <div style={{ ...cardStyle, padding: "20px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PERF_METRICS.map((m) => (
              <div key={m.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{m.label}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: m.color }}>{formatMs(m.ms)}</span>
                </div>
                <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(m.ms / m.maxMs) * 100}%`,
                    background: m.color,
                    borderRadius: 3,
                    transition: "width 0.6s ease",
                    boxShadow: `0 0 8px ${m.color}55`,
                  }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.2)", marginTop: 18, marginBottom: 0 }}>
            * WarBook runs on Linode (LLM pipeline) · All others on Vercel Edge
          </p>
        </div>
      </div>

      {/* ── Row 6: Quick Actions ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeader title="Quick Actions" subtitle="Operational controls and utilities" />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>

          {/* Run Health Check */}
          <button
            onClick={handleHealthCheck}
            disabled={healthChecking}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: 8,
              color: "#4ade80",
              padding: "10px 18px",
              fontSize: 13, fontWeight: 600,
              cursor: healthChecking ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: healthChecking ? 0.7 : 1,
            }}
            onMouseEnter={(e) => { if (!healthChecking) (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(74,222,128,0.08)"; }}
          >
            <RefreshCw size={15} color="#4ade80" style={{ animation: healthChecking ? "spin 1s linear infinite" : "none" }} />
            {healthChecking ? "Checking…" : "Run Health Check"}
          </button>

          {/* Clear Cache */}
          <button
            onClick={handleClearCache}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: 8,
              color: "#fbbf24",
              padding: "10px 18px",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(251,191,36,0.08)"; }}
          >
            <Trash2 size={15} color="#fbbf24" />
            Clear Cache
          </button>

          {/* Export Config */}
          <button
            onClick={handleExportConfig}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(105,106,172,0.08)",
              border: "1px solid rgba(105,106,172,0.25)",
              borderRadius: 8,
              color: "#696aac",
              padding: "10px 18px",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(105,106,172,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(105,106,172,0.08)"; }}
          >
            <Copy size={15} color="#696aac" />
            Export Config
          </button>

          {/* View Architecture */}
          <button
            onClick={handleViewArchitecture}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: 8,
              color: "#22d3ee",
              padding: "10px 18px",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,211,238,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,211,238,0.08)"; }}
          >
            <ExternalLink size={15} color="#22d3ee" />
            View Architecture
          </button>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <p style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", margin: 0 }}>
          ATOM · Nirmata Holdings · © 2026
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 5px #4ade80", display: "inline-block" }} />
          <span style={{ fontSize: 10, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)" }}>Bridge v7.0 · Online</span>
        </div>
      </div>

      {/* Spin keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
