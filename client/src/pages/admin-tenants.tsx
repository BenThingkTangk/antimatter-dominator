/**
 * Admin → Tenants
 *
 * Spin up a new white-labeled tenant in 30 seconds:
 *   1. Type customer name (e.g. "Acme Corp")
 *   2. Pick subdomain slug ("acme") — preview shows acme.atomdominator.com
 *   3. Upload/paste logo URL
 *   4. Pick brand primary + accent hex colors
 *   5. Pick plan tier (Trial / Growth / Advisory / Enterprise)
 *   6. Enter admin email — that user becomes the tenant's first admin
 *   7. Click "Spin up tenant" → tenant row inserted, branded site live
 *
 * Auth: requires X-Admin-Key header. The page reads from localStorage
 * (atom_admin_key). If not set, prompts on first action.
 */
import { useState, useEffect } from "react";
import { Plus, ExternalLink, Trash2, Edit2, Check, AlertCircle, Sparkles } from "lucide-react";

interface Tenant {
  slug: string;
  name: string;
  logo_url: string | null;
  primary_hex: string;
  accent_hex: string;
  plan: string;
  admin_email?: string;
  hume_config_id?: string | null;
  twilio_subaccount_sid?: string | null;
  created_at?: string;
}

const PLAN_TIERS = [
  { value: "trial",      label: "Trial — 14 days free" },
  { value: "growth",     label: "Growth — $499/mo" },
  { value: "advisory",   label: "Advisory — $1,499/mo" },
  { value: "enterprise", label: "Enterprise — Custom" },
];

// V4 brand-coordinated palette — first option is the canonical ATOM teal.
// Tenants can pick from these or use the color pickers for full custom.
const PRESET_COLORS = [
  { primary: "#00e6d3", accent: "#00a7ff", label: "ATOM teal" },
  { primary: "#0ea5e9", accent: "#b987ff", label: "Cyan / violet" },
  { primary: "#10b981", accent: "#ffd166", label: "Emerald / amber" },
  { primary: "#a78bfa", accent: "#00e6d3", label: "Violet / teal" },
  { primary: "#ff7569", accent: "#ffd166", label: "Coral / amber" },
];

export default function AdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminKey, setAdminKey] = useState<string>(() => {
    try { return localStorage.getItem("atom_admin_key") || ""; } catch { return ""; }
  });
  const [showNew, setShowNew] = useState(false);

  // New-tenant form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryHex, setPrimaryHex] = useState(PRESET_COLORS[0].primary);
  const [accentHex, setAccentHex] = useState(PRESET_COLORS[0].accent);
  const [plan, setPlan] = useState("trial");
  const [adminEmail, setAdminEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdMsg, setCreatedMsg] = useState<string | null>(null);

  // Auto-derive slug from name
  useEffect(() => {
    if (!name) return;
    const auto = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
    if (!slug || slug === auto.slice(0, slug.length)) setSlug(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function loadTenants() {
    if (!adminKey) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ action: "list" }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (e: any) {
      setError(e.message || "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminKey) loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function handleCreate() {
    if (!name || !slug) { setError("Name + slug required"); return; }
    if (!adminKey) { setError("Set admin key first"); return; }
    setCreating(true);
    setError(null);
    setCreatedMsg(null);
    try {
      const res = await fetch("/api/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({
          action: "create",
          slug, name,
          logo_url: logoUrl || null,
          primary_hex: primaryHex,
          accent_hex: accentHex,
          plan,
          admin_email: adminEmail || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      setCreatedMsg(`✓ Tenant '${slug}' live at https://${slug}.atomdominator.com`);
      setName(""); setSlug(""); setLogoUrl(""); setAdminEmail("");
      setShowNew(false);
      loadTenants();
    } catch (e: any) {
      setError(e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(slugToDelete: string) {
    if (!confirm(`Delete tenant '${slugToDelete}'? This is a soft-delete (deleted_at set).`)) return;
    try {
      const res = await fetch("/api/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ action: "delete", slug: slugToDelete }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadTenants();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    }
  }

  function saveAdminKey(k: string) {
    setAdminKey(k);
    try { localStorage.setItem("atom_admin_key", k); } catch {}
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: "#0a0a0c", color: "#f6f6fd" }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
              <Sparkles size={28} style={{ color: "var(--brand-primary, var(--color-error))" }} />
              Tenants
            </h1>
            <p className="mt-2 text-sm" style={{ color: "rgba(246,246,253,0.55)" }}>
              Spin up a white-labeled ATOM Sales Dominator deployment in 30 seconds. Each tenant gets their own subdomain, brand, and per-seat billing.
            </p>
          </div>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              background: `linear-gradient(93deg, ${primaryHex}, ${primaryHex}dd)`,
              boxShadow: `0 0 16px ${primaryHex}55`,
              color: "white",
            }}
          >
            <Plus size={16} />
            {showNew ? "Cancel" : "New tenant"}
          </button>
        </header>

        {/* Admin key */}
        {!adminKey && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-3"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)" }}
          >
            <AlertCircle size={18} style={{ color: "#fbbf24" }} />
            <div className="flex-1">
              <div className="text-sm font-medium">Admin key required</div>
              <input
                type="password"
                placeholder="Paste ADMIN_API_KEY"
                onBlur={(e) => saveAdminKey(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-md text-sm outline-none"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.15)", color: "#f6f6fd" }}
              />
            </div>
          </div>
        )}

        {/* New-tenant form */}
        {showNew && (
          <section
            className="rounded-2xl p-6 mb-8"
            style={{ background: "rgba(246,246,253,0.03)", border: "1px solid rgba(246,246,253,0.08)" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Customer name">
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.12)", color: "#f6f6fd" }}
                />
              </Field>
              <Field label="Subdomain slug">
                <div className="flex items-stretch gap-1">
                  <input
                    value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="acme"
                    className="flex-1 px-3 py-2 rounded-md text-sm outline-none"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.12)", color: "#f6f6fd" }}
                  />
                  <span
                    className="px-3 py-2 rounded-md text-xs flex items-center"
                    style={{ background: "rgba(246,246,253,0.05)", color: "rgba(246,246,253,0.6)" }}
                  >
                    .atomdominator.com
                  </span>
                </div>
              </Field>
              <Field label="Logo URL (optional)">
                <input
                  value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://acme.com/logo.svg"
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.12)", color: "#f6f6fd" }}
                />
              </Field>
              <Field label="Admin email">
                <input
                  value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                  type="email"
                  placeholder="ops@acme.com"
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.12)", color: "#f6f6fd" }}
                />
              </Field>
              <Field label="Plan">
                <select
                  value={plan} onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-sm outline-none"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(246,246,253,0.12)", color: "#f6f6fd" }}
                >
                  {PLAN_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Brand colors">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setPrimaryHex(p.primary); setAccentHex(p.accent); }}
                      title={p.label}
                      className="rounded-md flex items-center gap-1 px-1.5 py-1 text-[10px]"
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: primaryHex === p.primary ? `1.5px solid ${p.primary}` : "1px solid rgba(246,246,253,0.12)",
                        color: "rgba(246,246,253,0.8)",
                      }}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ background: p.primary }} />
                      <span className="w-3 h-3 rounded-full" style={{ background: p.accent }} />
                    </button>
                  ))}
                  <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="w-7 h-7 rounded" />
                  <input type="color" value={accentHex} onChange={(e) => setAccentHex(e.target.value)} className="w-7 h-7 rounded" />
                </div>
              </Field>
            </div>

            {/* Brand preview */}
            <div className="mt-5 rounded-xl p-4 flex items-center gap-4" style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${primaryHex}55` }}>
              <div className="rounded-full w-9 h-9 flex items-center justify-center" style={{ background: primaryHex, boxShadow: `0 0 12px ${primaryHex}88` }}>
                <Sparkles size={16} color="white" />
              </div>
              <div>
                <div className="text-base font-semibold">{name || "Your tenant"} <span style={{ color: accentHex }}>·</span> ATOM</div>
                <div className="text-xs" style={{ color: "rgba(246,246,253,0.55)" }}>{slug ? `${slug}.atomdominator.com` : "subdomain.atomdominator.com"}</div>
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm flex items-center gap-2" style={{ color: "var(--color-error)" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !name || !slug || !adminKey}
              className="mt-5 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              style={{
                background: `linear-gradient(93deg, ${primaryHex}, ${primaryHex}dd)`,
                boxShadow: `0 0 16px ${primaryHex}55`,
                color: "white",
              }}
            >
              {creating ? "Spinning up…" : "Spin up tenant"}
            </button>
          </section>
        )}

        {/* Created banner */}
        {createdMsg && (
          <div
            className="rounded-xl p-3 mb-6 text-sm flex items-center gap-2"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
          >
            <Check size={14} /> {createdMsg}
          </div>
        )}

        {/* Tenant list */}
        <section>
          <h2 className="text-xs uppercase tracking-wider mb-3" style={{ color: "rgba(246,246,253,0.5)" }}>
            Active tenants ({tenants.length})
          </h2>
          {loading ? (
            <div className="text-sm" style={{ color: "rgba(246,246,253,0.55)" }}>Loading…</div>
          ) : tenants.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: "rgba(246,246,253,0.03)", border: "1px solid rgba(246,246,253,0.08)" }}>
              <p className="text-sm" style={{ color: "rgba(246,246,253,0.55)" }}>
                No tenants yet. Click "New tenant" to spin up your first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tenants.map((t) => (
                <div
                  key={t.slug}
                  className="rounded-xl p-4 flex items-center gap-4 flex-wrap"
                  style={{ background: "rgba(246,246,253,0.03)", border: "1px solid rgba(246,246,253,0.08)" }}
                >
                  <div className="rounded-full w-10 h-10 flex items-center justify-center text-xs font-bold" style={{ background: t.primary_hex, color: "white", boxShadow: `0 0 10px ${t.primary_hex}66` }}>
                    {t.name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">{t.name}</div>
                    <div className="text-xs flex flex-wrap items-center gap-2" style={{ color: "rgba(246,246,253,0.55)" }}>
                      <a href={`https://${t.slug}.atomdominator.com`} target="_blank" rel="noopener" className="hover:underline flex items-center gap-1">
                        {t.slug}.atomdominator.com <ExternalLink size={11} />
                      </a>
                      <span>·</span>
                      <span className="capitalize">{t.plan}</span>
                      {t.admin_email && (<><span>·</span><span>{t.admin_email}</span></>)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(t.slug)}
                    className="p-2 rounded-md hover:bg-white/5"
                    title="Delete tenant"
                  >
                    <Trash2 size={14} style={{ color: "rgba(246,246,253,0.5)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(246,246,253,0.5)" }}>{label}</span>
      {children}
    </label>
  );
}
