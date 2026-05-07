/**
 * Admin → Tenants
 *
 * Cross-tenant overview (KPIs, MRR stack, growth, plan mix, health) PLUS a
 * full Manage Tenants panel — create / edit / soft-delete tenants. Backed by
 * /api/tenant (action: create | update | delete | list) which has been part
 * of the platform since the original Platinum sprint but was never surfaced
 * in the admin UI.
 *
 * Auth: X-Admin-Key (auto-attached by adminFetch via localStorage).
 */
import { useEffect, useMemo, useState } from "react";
import { Building2, TrendingUp, DollarSign, AlertTriangle, Plus, Pencil, Trash2, X, Check, Loader2, ExternalLink, Upload, Image as ImageIcon, Eye, BarChart3 } from "lucide-react";
import { adminFetch, useAdminQuery } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix, BarStack,
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_MUTED, EmptyState,
} from "../charts";

interface TenantsData {
  kpis: { activeTenants: number; newThisMonth: number; mrrCents: number; atRisk: number };
  growth: { month: string; new_tenants: number; churned: number }[];
  mrrStack: { month: string; trial: number; starter: number; growth: number; advisory: number; enterprise: number }[];
  planMix: { name: string; value: number }[];
  tenantHealth: {
    slug: string; name: string; plan: string; dials30d: number; actions7d: number;
    seatsUsed: number; trial_ends_at: string | null; subscription_status: string;
    kill_switch: boolean; compliance_blocks_30d: number;
  }[];
}

interface TenantRow {
  id?: string;
  slug: string;
  name: string;
  logo_url?: string | null;
  primary_hex?: string | null;
  accent_hex?: string | null;
  plan?: string | null;
  admin_email?: string | null;
  hume_config_id?: string | null;
  twilio_subaccount_sid?: string | null;
  created_at?: string;
  subscription_status?: string;
  trial_ends_at?: string | null;
  deleted_at?: string | null;
}

const PLAN_OPTIONS = ["trial", "starter", "growth", "advisory", "enterprise"];

function money(cents: number) {
  if (cents >= 100_000_00) return `$${(cents / 100_000_00).toFixed(1)}M`;
  if (cents >= 100_00) return `$${Math.round(cents / 100_00)}K`;
  return `$${(cents / 100).toFixed(0)}`;
}

export default function Tenants() {
  const { data } = useAdminQuery<TenantsData>(["admin","tenants"], "/api/admin/data?view=tenants-overview", { refetchInterval: 60_000 });
  const k = data?.kpis ?? { activeTenants: 0, newThisMonth: 0, mrrCents: 0, atRisk: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Active tenants" value={k.activeTenants} sub="Non-churned workspaces" tone="default" icon={Building2} />
        <KpiCard label="New · this month" value={k.newThisMonth} sub="Signups" tone="success" icon={TrendingUp} />
        <KpiCard label="MRR" value={money(k.mrrCents)} sub="Monthly recurring" tone="default" icon={DollarSign} />
        <KpiCard label="At risk" value={k.atRisk} sub="Churn indicators" tone={k.atRisk > 0 ? "warn" : "default"} icon={AlertTriangle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="MRR by plan · 12 months" subtitle="Trial / Starter / Growth / Advisory / Enterprise" height={280}>
          <AreaStack
            data={data?.mrrStack ?? []}
            xKey="month"
            series={[
              { key: "trial",      label: "Trial",      color: ATOM_MUTED },
              { key: "starter",    label: "Starter",    color: ATOM_TEAL_2 },
              { key: "growth",     label: "Growth",     color: ATOM_TEAL },
              { key: "advisory",   label: "Advisory",   color: ATOM_PURPLE },
              { key: "enterprise", label: "Enterprise", color: ATOM_AMBER },
            ]}
            valueFormatter={(v: number) => money(v)}
          />
        </ChartCard>
        <ChartCard title="Plan mix" height={280}>
          <DonutMix data={data?.planMix ?? []} />
        </ChartCard>
      </div>

      <ChartCard title="Tenant growth" subtitle="New vs churned, monthly" height={240}>
        <BarStack
          data={data?.growth ?? []}
          xKey="month"
          series={[
            { key: "new_tenants", label: "New", color: ATOM_GREEN },
            { key: "churned",     label: "Churned", color: "#ff6b8b" },
          ]}
        />
      </ChartCard>

      {/* ── Manage Tenants — CRUD panel ───────────────────────────────────────── */}
      <ManageTenantsPanel />

      <SectionCard title="Tenant health" subtitle="Sorted by 30d dial activity">
        {!data?.tenantHealth?.length ? <EmptyState /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.tenantHealth.map((t) => (
              <div key={t.slug} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: t.kill_switch ? "rgba(255,107,139,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${t.kill_switch ? "rgba(255,107,139,0.2)" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{t.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED }}>{t.slug} · {t.plan}</div>
                </div>
                <Cell label="Seats" value={t.seatsUsed} />
                <Cell label="Dials 30d" value={t.dials30d} />
                <Cell label="Actions 7d" value={t.actions7d} />
                <Cell label="Blocks 30d" value={t.compliance_blocks_30d} tone={t.compliance_blocks_30d > 0 ? "warn" : "default"} />
                <StatusPill status={t.subscription_status} trial={t.trial_ends_at} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── SectionCard: identical visual to ChartCard but height grows with content ───
function SectionCard({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      padding: 18,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 14,
        gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: ATOM_MUTED,
            marginBottom: 4,
          }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: "var(--color-text)" }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Cell({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: tone === "warn" ? ATOM_AMBER : "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
function StatusPill({ status, trial }: { status: string; trial: string | null }) {
  const color = status === "active" ? ATOM_GREEN : status === "trialing" ? ATOM_TEAL_2 : status === "past_due" ? ATOM_AMBER : "#ff6b8b";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
      <span style={{
        padding: "3px 10px", borderRadius: 999,
        background: `${color}14`, color,
        fontFamily: "var(--font-mono)", fontSize: 10,
        letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
      }}>{status}</span>
      {trial && status === "trialing" && (
        <span style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
          ends {new Date(trial).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

// ─── Manage Tenants Panel ──────────────────────────────────────────────────────

function ManageTenantsPanel() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await adminFetch("/api/tenant", { method: "POST", body: JSON.stringify({ action: "list" }) });
      setTenants(r?.tenants || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <SectionCard
      title="Manage tenants"
      subtitle="Create, edit, or revoke tenant workspaces · backed by /api/tenant"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED }}>
            {loading ? "Loading…" : `${tenants.length} tenant${tenants.length === 1 ? "" : "s"}`}
            {error && <span style={{ color: "#ff6b8b", marginLeft: 12 }}>· {error}</span>}
          </span>
          <button
            onClick={() => { setShowCreate(true); setEditingSlug(null); }}
            style={btnPrimary}
          >
            <Plus size={14} /> New tenant
          </button>
        </div>

        {showCreate && (
          <TenantForm
            mode="create"
            onCancel={() => setShowCreate(false)}
            onSaved={() => { setShowCreate(false); refresh(); }}
          />
        )}

        {tenants.length === 0 && !loading && !showCreate && (
          <div style={{
            padding: "28px 14px", textAlign: "center",
            color: ATOM_MUTED, fontSize: 13, fontFamily: "var(--font-mono)",
            border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10,
          }}>
            No tenants yet. Click "New tenant" to provision one.
          </div>
        )}

        {tenants.map((t) =>
          editingSlug === t.slug ? (
            <TenantForm
              key={t.slug}
              mode="edit"
              initial={t}
              onCancel={() => setEditingSlug(null)}
              onSaved={() => { setEditingSlug(null); refresh(); }}
              onDeleted={() => { setEditingSlug(null); refresh(); }}
            />
          ) : (
            <TenantRowCard
              key={t.slug}
              tenant={t}
              onEdit={() => setEditingSlug(t.slug)}
            />
          )
        )}
      </div>
    </SectionCard>
  );
}

function TenantRowCard({ tenant, onEdit }: { tenant: TenantRow; onEdit: () => void }) {
  const swatch = tenant.primary_hex || "#06b6d4";
  const hasLogo = !!tenant.logo_url;
  // "View as tenant" — opens the actual app in a new tab with the tenant's
  // brand colors / logo / name applied via the ?tenant=<slug> URL override
  // implemented in client/src/lib/useTenant.ts.
  const previewUrl = `/?tenant=${encodeURIComponent(tenant.slug)}#/pitch`;
  // "Open analytics" — the operator-side detail dashboard for this tenant.
  const analyticsUrl = `#/admin/t/${tenant.slug}`;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr auto auto auto",
      gap: 10, alignItems: "center",
      padding: "10px 14px", borderRadius: 10,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Brand swatch / logo thumbnail */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: hasLogo ? "rgba(255,255,255,0.04)" : swatch,
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, overflow: "hidden",
        opacity: hasLogo ? 1 : 0.85,
      }}>
        {hasLogo ? (
          <img
            src={tenant.logo_url || ""}
            alt={`${tenant.name} logo`}
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
          />
        ) : null}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{tenant.name}</span>
          <span style={{
            padding: "1px 8px", borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            fontFamily: "var(--font-mono)", fontSize: 9,
            letterSpacing: "0.10em", textTransform: "uppercase",
            color: ATOM_TEAL_2, border: "1px solid rgba(34,211,238,0.18)",
          }}>{tenant.plan || "trial"}</span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED, marginTop: 2 }}>
          {tenant.slug}
          {tenant.admin_email && <> · {tenant.admin_email}</>}
        </div>
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the tenant's branded app in a new tab"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 8,
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
          color: "#0c1014",
          background: ATOM_TEAL,
          border: `1px solid ${ATOM_TEAL}`,
          boxShadow: `0 0 18px color-mix(in oklab, ${ATOM_TEAL} 22%, transparent)`,
          textDecoration: "none",
        }}
      >
        <Eye size={12} /> View as tenant
      </a>
      <a
        href={analyticsUrl}
        title="Operator analytics for this tenant"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 8,
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: ATOM_TEAL, background: "rgba(34,211,238,0.06)",
          border: "1px solid rgba(34,211,238,0.18)",
          textDecoration: "none",
        }}
      >
        <BarChart3 size={12} /> analytics
      </a>
      <button onClick={onEdit} style={btnGhost}>
        <Pencil size={12} /> edit
      </button>
    </div>
  );
}

// Auto-derive a URL-safe slug from the company name. Examples:
//   "Thingk Tangk"      → "thingk-tangk"
//   "Bob & Co."          → "bob-co"
//   "3M"                 → "3m"
function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function TenantForm({
  mode, initial, onCancel, onSaved, onDeleted,
}: {
  mode: "create" | "edit";
  initial?: TenantRow;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [plan, setPlan] = useState(initial?.plan || "trial");
  const [primary_hex, setPrimary] = useState(initial?.primary_hex || "#06b6d4");
  const [accent_hex, setAccent] = useState(initial?.accent_hex || "#a78bfa");
  const [logo_url, setLogo] = useState(initial?.logo_url || "");
  const [admin_email, setAdminEmail] = useState(initial?.admin_email || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [logoErr, setLogoErr] = useState<string>("");

  const slug = useMemo(
    () => mode === "edit" ? (initial?.slug || "") : deriveSlug(name),
    [name, mode, initial?.slug]
  );

  const canSubmit = useMemo(() =>
    name.trim().length >= 2 && slug.length >= 2,
  [name, slug]);

  function handleLogoFile(file: File) {
    setLogoErr("");
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setLogoErr("Please choose an image file (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 500 * 1024) {
      setLogoErr(`Image is ${Math.round(file.size / 1024)}KB — please use a logo under 500KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = String(e.target?.result || "");
      setLogo(dataUrl);
    };
    reader.onerror = () => setLogoErr("Couldn't read that file. Try a different image.");
    reader.readAsDataURL(file);
  }

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const payload: Record<string, any> = {
        action: mode === "create" ? "create" : "update",
        slug,
        name: name.trim(),
        plan,
        primary_hex,
        accent_hex,
        logo_url: logo_url || null,
        admin_email: admin_email.trim() || null,
      };
      await adminFetch("/api/tenant", { method: "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!initial?.slug) return;
    if (!confirm(`Soft-delete tenant "${initial.slug}"? Their data is preserved but the workspace becomes inaccessible.`)) return;
    setBusy(true);
    setErr("");
    try {
      await adminFetch("/api/tenant", { method: "POST", body: JSON.stringify({ action: "delete", slug: initial.slug }) });
      onDeleted?.();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 14,
      padding: "18px", borderRadius: 12,
      background: "rgba(34,211,238,0.03)",
      border: "1px solid rgba(34,211,238,0.20)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: ATOM_TEAL,
        }}>
          {mode === "create" ? "New tenant" : `Edit · ${initial?.slug}`}
        </span>
        <button onClick={onCancel} style={btnGhost}><X size={12} /> cancel</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <Field label="Company name" hint={mode === "create" && name ? `URL slug: ${slug || "…"}` : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" style={input} autoFocus={mode === "create"} />
        </Field>
        <Field label="Plan">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} style={input}>
            {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Admin email" hint="They'll receive a sign-up invite">
          <input value={admin_email} onChange={(e) => setAdminEmail(e.target.value)} placeholder="founder@acme.com" style={input} type="email" />
        </Field>
        <Field label="Primary color">
          <ColorInput value={primary_hex} onChange={setPrimary} />
        </Field>
        <Field label="Accent color">
          <ColorInput value={accent_hex} onChange={setAccent} />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <LogoUploader value={logo_url} onChange={setLogo} onFile={handleLogoFile} error={logoErr} />
        </div>
      </div>

      {err && (
        <div style={{
          padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,107,139,0.06)", color: "#ff6b8b",
          fontFamily: "var(--font-mono)", fontSize: 11,
          border: "1px solid rgba(255,107,139,0.20)",
        }}>{err}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          {mode === "edit" && (
            <button onClick={handleDelete} disabled={busy} style={{
              ...btnGhost,
              color: "#ff6b8b",
              borderColor: "rgba(255,107,139,0.25)",
              background: "rgba(255,107,139,0.05)",
            }}>
              <Trash2 size={12} /> Soft-delete
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={!canSubmit || busy} style={{
            ...btnPrimary,
            opacity: !canSubmit || busy ? 0.5 : 1,
            cursor: !canSubmit || busy ? "not-allowed" : "pointer",
          }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {mode === "create" ? "Create tenant" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: ATOM_MUTED,
      }}>{label}</span>
      {children}
      {hint && (
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.30)" }}>{hint}</span>
      )}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 38, height: 32, borderRadius: 6,
          background: "transparent", border: "1px solid rgba(255,255,255,0.10)",
          padding: 0, cursor: "pointer",
        }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#06b6d4"
        style={{ ...input, flex: 1 }}
      />
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  color: "var(--color-text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 10,
  background: `color-mix(in oklab, ${ATOM_TEAL} 12%, transparent)`,
  color: ATOM_TEAL,
  border: `1px solid color-mix(in oklab, ${ATOM_TEAL} 32%, transparent)`,
  boxShadow: `0 0 18px color-mix(in oklab, ${ATOM_TEAL} 14%, transparent)`,
  fontFamily: "var(--font-mono)", fontSize: 11,
  fontWeight: 700, cursor: "pointer",
  letterSpacing: "0.06em",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  color: "var(--color-text)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontFamily: "var(--font-mono)", fontSize: 11,
  cursor: "pointer",
};

// ─── LogoUploader ──────────────────────────────────────────────────────────────
// File-picker + drag-drop logo input. Stores the uploaded image as a data URL
// (so it survives one round-trip through /api/tenant without needing S3). The
// preview rounds, sizes, and optionally clears.
function LogoUploader({
  value, onChange, onFile, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onFile: (file: File) => void;
  error?: string;
}) {
  const inputId = "tenant-logo-input";
  const has = !!value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: ATOM_MUTED,
      }}>Company logo</span>
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const f = e.dataTransfer?.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.025)",
          border: "1px dashed rgba(255,255,255,0.14)",
          cursor: "pointer",
          minHeight: 64,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: has ? "rgba(255,255,255,0.04)" : "rgba(34,211,238,0.06)",
          border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden",
        }}>
          {has ? (
            <img
              src={value}
              alt="logo preview"
              style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
            />
          ) : (
            <ImageIcon size={20} style={{ color: ATOM_TEAL }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            {has ? "Logo selected" : "Click to upload or drop a file"}
          </div>
          <div style={{ color: ATOM_MUTED, fontSize: 11, fontFamily: "var(--font-mono)" }}>
            PNG, JPG, SVG, or WebP · up to 500KB
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); document.getElementById(inputId)?.click(); }}
            style={{
              ...btnGhost,
              borderColor: "rgba(34,211,238,0.25)",
              color: ATOM_TEAL,
              background: "rgba(34,211,238,0.05)",
            }}
          >
            <Upload size={12} /> {has ? "Replace" : "Upload"}
          </button>
          {has && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(""); }}
              style={btnGhost}
            >
              <X size={12} /> Remove
            </button>
          )}
        </div>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            // reset so picking the same file again still triggers
            e.currentTarget.value = "";
          }}
        />
      </label>
      {error && (
        <span style={{
          color: "#ff6b8b", fontSize: 11, fontFamily: "var(--font-mono)",
        }}>{error}</span>
      )}
    </div>
  );
}
