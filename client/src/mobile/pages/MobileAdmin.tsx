/**
 * MobileAdmin — tenant spin-up + list.
 *
 * Minimal mobile-optimized wrapper around the existing /api/tenants CRUD.
 * Enterprise-only badge visible to users whose tenant.plan === "enterprise".
 */
import { useEffect, useState } from "react";
import { Plus, Building2, Check, X } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { useTenant } from "../../lib/useTenant";

interface TenantRow {
  slug: string;
  name: string;
  plan: string;
  primary_hex?: string;
}

export default function MobileAdmin() {
  const { tenant } = useTenant();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState("standard");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    setLoading(true);
    try {
      const r = await fetch("/api/tenants");
      const d = r.ok ? await r.json() : { tenants: [] };
      setTenants(d.tenants || d || []);
    } catch { setTenants([]); }
    finally { setLoading(false); }
  }

  async function create() {
    if (!newSlug.trim() || !newName.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim().toLowerCase(), name: newName.trim(), plan: newPlan }),
      });
      if (!r.ok) throw new Error(await r.text());
      setNewSlug(""); setNewName(""); setNewPlan("standard");
      setShowNew(false);
      await reload();
    } catch (e: any) { setErr(e?.message || "Failed to create tenant"); }
    finally { setSaving(false); }
  }

  const canManage = tenant?.plan === "enterprise" || tenant?.slug === "antimatter";

  return (
    <MobileShell title="Admin">
      <div className="m-stack-lg">
        <div className="m-row-btw">
          <span className="m-eyebrow">Tenants</span>
          {canManage && (
            <button className="m-icon-btn" onClick={() => setShowNew(true)} aria-label="New tenant">
              <Plus size={18} />
            </button>
          )}
        </div>

        {!canManage && (
          <div className="m-card">
            <div className="m-text-muted" style={{ fontSize: 14 }}>
              You're viewing as a tenant user. Ask your admin for elevated access to spin up new tenants.
            </div>
          </div>
        )}

        {loading && <div className="m-skel" style={{ height: 80, borderRadius: 20 }} />}
        {!loading && tenants.length === 0 && (
          <div className="m-card">
            <div className="m-text-muted" style={{ fontSize: 14 }}>No tenants yet. Tap + to spin one up.</div>
          </div>
        )}

        {tenants.map((t) => (
          <div key={t.slug} className="m-card">
            <div className="m-row" style={{ gap: 12 }}>
              <span style={{
                width: 40, height: 40, borderRadius: 10,
                background: (t.primary_hex || "rgba(0,230,211,0.1)") + "22",
                border: `1px solid ${(t.primary_hex || "#00e6d3")}33`,
                display: "grid", placeItems: "center",
                color: t.primary_hex || "#00e6d3",
              }}><Building2 size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="m-text-muted" style={{ fontSize: 12 }}>
                  <span className="m-mono">{t.slug}</span> · {t.plan}
                </div>
              </div>
              {t.plan === "enterprise" && (
                <span className="m-pill m-pill-live" style={{ textTransform: "none", letterSpacing: "0.04em" }}>GPT-5</span>
              )}
            </div>
          </div>
        ))}

        {/* New tenant sheet */}
        {showNew && (
          <>
            <div className="m-sheet-backdrop" onClick={() => setShowNew(false)} />
            <div className="m-sheet">
              <div className="m-sheet-handle" />
              <div className="m-card-title">Spin up tenant</div>
              <div className="m-stack" style={{ marginTop: 14 }}>
                <div>
                  <label className="m-label">Slug (subdomain)</label>
                  <input className="m-input" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="acme" />
                </div>
                <div>
                  <label className="m-label">Display name</label>
                  <input className="m-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="m-label">Plan</label>
                  <select className="m-input" value={newPlan} onChange={(e) => setNewPlan(e.target.value)}>
                    <option value="standard">Standard</option>
                    <option value="enterprise">Enterprise (GPT-5)</option>
                  </select>
                </div>
                {err && <div className="m-pill m-pill-danger">{err}</div>}
                <div className="m-row" style={{ gap: 10 }}>
                  <button className="m-btn m-btn-ghost" onClick={() => setShowNew(false)}><X size={16} /> Cancel</button>
                  <button className="m-btn m-btn-primary" onClick={create} disabled={saving || !newSlug || !newName}>
                    {saving ? "Creating…" : <><Check size={16} /> Create</>}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
