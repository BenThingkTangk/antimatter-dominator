/**
 * AdminShell — tab-based admin layer.
 *
 * Tabs: Overview / System / Compliance / Team / Tenants / Billing / Integrations / API Keys.
 * Each tab is its own panel component lazy-loaded below; AdminShell handles
 * routing-by-hash (`#/admin?tab=compliance`) plus the consistent chrome
 * (header, breadcrumbs, key-state alert when admin key is missing).
 */
import { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import {
  Shield, Activity, Users, Building2, CreditCard, Plug, KeyRound, BarChart3, Mail,
  HeartPulse,
} from "lucide-react";
import { ATOM_TEAL, ATOM_MUTED, EmptyState } from "./charts";

const TABS = [
  { id: "overview",     label: "Overview",       icon: BarChart3 },
  { id: "system",       label: "System Control", icon: Activity },
  { id: "compliance",   label: "TCPA Compliance", icon: Shield },
  { id: "team",         label: "Team",           icon: Users },
  { id: "tenants",      label: "Tenants",        icon: Building2 },
  { id: "emails",       label: "Email Log",      icon: Mail },
  { id: "billing",      label: "Billing",        icon: CreditCard },
  { id: "integrations", label: "Integrations",   icon: Plug },
  { id: "apikeys",      label: "API Keys",       icon: KeyRound },
] as const;

const TabOverview     = lazy(() => import("./tabs/Overview"));
const TabSystem       = lazy(() => import("./tabs/System"));
const TabCompliance   = lazy(() => import("./tabs/Compliance"));
const TabTeam         = lazy(() => import("./tabs/Team"));
const TabTenants      = lazy(() => import("./tabs/Tenants"));
const TabEmailLog     = lazy(() => import("./tabs/EmailLog"));
const TabBilling      = lazy(() => import("./tabs/Billing"));
const TabIntegrations = lazy(() => import("./tabs/Integrations"));
const TabApiKeys      = lazy(() => import("./tabs/ApiKeys"));
const TabQa           = lazy(() => import("./QaPanel"));

const ADMIN_KEY_LS = "atom_admin_key";

export function useAdminKey() {
  const [key, setKey] = useState<string>(() => {
    try { return localStorage.getItem(ADMIN_KEY_LS) || ""; } catch { return ""; }
  });
  function save(k: string) {
    try { localStorage.setItem(ADMIN_KEY_LS, k); } catch {}
    setKey(k);
  }
  return { key, save };
}

export default function AdminShell() {
  const [location] = useLocation();
  const { key, save } = useAdminKey();
  const [tab, setTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    return params.get("tab") || "overview";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const t = params.get("tab") || "overview";
    setTab(t);
  }, [location]);

  function setTabUrl(id: string) {
    const url = new URL(window.location.href);
    const hash = url.hash || "#/admin";
    const [path] = hash.split("?");
    url.hash = `${path}?tab=${id}`;
    window.history.replaceState(null, "", url.toString());
    setTab(id);
  }

  const Body = ({ id }: { id: string }) => {
    switch (id) {
      case "system":       return <TabQa />;
      case "qa":           return <TabQa />;
      case "compliance":   return <TabCompliance />;
      case "team":         return <TabTeam />;
      case "tenants":      return <TabTenants />;
      case "emails":       return <TabEmailLog />;
      case "billing":      return <TabBilling />;
      case "integrations": return <TabIntegrations />;
      case "apikeys":      return <TabApiKeys />;
      default:             return <TabOverview />;
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
          }}>ΔTOM · Admin</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800,
            letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)",
          }}>System Control · {TABS.find(t => t.id === tab)?.label}</h1>
        </div>
        <AdminKeyControl currentKey={key} onSave={save} />
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

      {/* No key fallback */}
      {!key ? (
        <div style={{
          padding: 28,
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(255,209,102,0.06), rgba(255,209,102,0.02))",
          border: "1px solid rgba(255,209,102,0.32)",
          color: "var(--color-text)",
        }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em",
            textTransform: "uppercase", color: "#ffd166", marginBottom: 6,
          }}>Admin key required</div>
          <p style={{ marginTop: 0, marginBottom: 12, color: "var(--color-text-muted)" }}>
            The admin layer accesses tenant data, compliance audits, and billing. Paste your <code>ADMIN_API_KEY</code> above to unlock the panels. The key stays in your browser only.
          </p>
        </div>
      ) : (
        <Suspense fallback={<EmptyState message="Loading panel…" />}>
          <Body id={tab} />
        </Suspense>
      )}
    </div>
  );
}

function AdminKeyControl({ currentKey, onSave }: { currentKey: string; onSave: (k: string) => void }) {
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
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        style={{
          padding: "8px 14px", borderRadius: 10,
          background: "transparent", color: ATOM_MUTED,
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer", fontSize: 12,
        }}
      >
        Cancel
      </button>
    </div>
  );
}
