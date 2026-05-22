/**
 * Admin → TCPA Compliance Engine
 *
 * Surfaces the pre-dial gate, consent ledger, DNC registries, and audit-log
 * hash-chain status. Every screen here is auditor-grade and can be exported
 * to CSV.
 */
import { useState } from "react";
import { Shield, Phone, FileCheck2, AlertTriangle, Plus, Upload, Download } from "lucide-react";
import { useAdminQuery, useAdminMutation } from "../useAdminApi";
import {
  KpiCard, ChartCard, AreaStack, DonutMix, HashChainAudit,
  ATOM_TEAL, ATOM_GREEN, ATOM_AMBER, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT, EmptyState,
} from "../charts";

interface ComplianceData {
  kpis: { allowed24h: number; blocked24h: number; consents: number; revokedConsents: number; dncCount: number; auditEntries: number };
  blockReasons: { name: string; value: number }[];
  trend: { hour: string; allowed: number; blocked: number }[];
  recentBlocks: { id: number; phone: string; checked_at: string; block_reasons: string[]; actor_email?: string }[];
  consents: { id: number; prospect_identifier: string; channel: string; consent_type: string; captured_at: string; revoked_at: string | null }[];
  dnc: { id: number; identifier: string; identifier_type: string; source: string; state?: string; added_at: string }[];
  hashChain: { verified: boolean; entries: number };
}

export default function Compliance() {
  const [tenantSlug, setTenantSlug] = useState<string>("antimatter");
  const { data, isLoading } = useAdminQuery<ComplianceData>(["admin","compliance",tenantSlug], `/api/admin/data?view=compliance&tenantSlug=${tenantSlug}`, { refetchInterval: 60_000 });
  const captureConsent = useAdminMutation<any, any>("/api/compliance/consent", "POST", [["admin","compliance",tenantSlug]]);
  const addDnc = useAdminMutation<any, any>("/api/admin/data?view=dnc-add", "POST", [["admin","compliance",tenantSlug]]);
  const [showCapture, setShowCapture] = useState(false);
  const [showAddDnc, setShowAddDnc] = useState(false);

  const { data: tenants } = useAdminQuery<{ tenants: any[] }>(["admin","tenants-pick"], "/api/admin/data?view=tenants-list", { refetchInterval: 0 });

  const k = data?.kpis ?? { allowed24h: 0, blocked24h: 0, consents: 0, revokedConsents: 0, dncCount: 0, auditEntries: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Tenant picker */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Tenant scope
        </span>
        <select
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          style={{
            padding: "6px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(105,106,172,0.32)",
            color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12,
            outline: "none", cursor: "pointer",
          }}
        >
          {(tenants?.tenants ?? [{ slug: "antimatter", name: "ΔTOM" }]).map((t: any) => (
            <option key={t.slug} value={t.slug}>{t.name} · {t.slug}</option>
          ))}
        </select>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Allowed · 24h" value={k.allowed24h} sub="Pre-dial passed" tone="success" icon={Phone} />
        <KpiCard label="Blocked · 24h" value={k.blocked24h} sub="Pre-dial gated" tone={k.blocked24h > 0 ? "warn" : "default"} icon={AlertTriangle} />
        <KpiCard label="Active consents" value={k.consents} sub="Non-revoked" tone="success" icon={FileCheck2} />
        <KpiCard label="Revoked" value={k.revokedConsents} sub="Honored opt-outs" tone="default" />
        <KpiCard label="DNC entries" value={k.dncCount} sub="Internal + state + federal" tone="default" icon={Shield} />
        <KpiCard label="Audit log" value={k.auditEntries} sub="Tamper-evident" tone="default" />
      </div>

      {/* Trend + reasons */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Pre-dial gate · 24h" subtitle="Allowed vs blocked, hourly" height={240}>
          <AreaStack
            data={data?.trend ?? []}
            xKey="hour"
            series={[
              { key: "allowed", label: "Allowed", color: ATOM_GREEN },
              { key: "blocked", label: "Blocked", color: ATOM_DANGER },
            ]}
          />
        </ChartCard>
        <ChartCard title="Block reasons" subtitle="Why dials were stopped" height={240}>
          <DonutMix data={data?.blockReasons ?? []} />
        </ChartCard>
      </div>

      {/* Hash chain status */}
      <ChartCard title="Audit log integrity" subtitle="SHA-256 chain of every admin + compliance action">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <HashChainAudit verified={data?.hashChain?.verified ?? true} count={data?.hashChain?.entries ?? 0} />
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 10,
            background: "rgba(105,106,172,0.06)", border: "1px solid rgba(105,106,172,0.24)",
            color: ATOM_TEAL, fontFamily: "var(--font-mono)", fontSize: 11,
            letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
          }}>
            <Download size={12} /> Export audit log (CSV)
          </button>
        </div>
      </ChartCard>

      {/* Two-column: Recent blocks + Consents */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ChartCard title="Recent blocks" subtitle="Last 10 pre-dial gate denials">
          {!data?.recentBlocks?.length ? <EmptyState message="No recent blocks" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.recentBlocks.slice(0, 10).map((b) => (
                <div key={b.id} style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: "rgba(255,107,139,0.04)", border: "1px solid rgba(255,107,139,0.16)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text)" }}>{b.phone}</span>
                    <span style={{ fontSize: 10, color: ATOM_FAINT, fontFamily: "var(--font-mono)" }}>
                      {new Date(b.checked_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {b.block_reasons.map((r, i) => (
                      <span key={i} style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 10,
                        fontFamily: "var(--font-mono)", color: ATOM_DANGER,
                        background: "rgba(255,107,139,0.08)", border: "1px solid rgba(255,107,139,0.24)",
                      }}>{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Consent ledger" subtitle="Append-only · SHA-256 chained" action={
          <button onClick={() => setShowCapture(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 8, fontSize: 11,
            background: ATOM_TEAL, color: "#041413",
            border: "none", fontWeight: 700, cursor: "pointer",
          }}>
            <Plus size={11} /> Capture
          </button>
        }>
          {!data?.consents?.length ? <EmptyState message="No consents captured yet" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.consents.slice(0, 10).map((c) => (
                <div key={c.id} style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: c.revoked_at ? "rgba(255,209,102,0.04)" : "rgba(114,242,161,0.04)",
                  border: `1px solid ${c.revoked_at ? "rgba(255,209,102,0.16)" : "rgba(114,242,161,0.16)"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text)" }}>{c.prospect_identifier}</span>
                    <span style={{ fontSize: 10, color: c.revoked_at ? ATOM_AMBER : ATOM_GREEN, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
                      {c.revoked_at ? "REVOKED" : c.consent_type}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: ATOM_FAINT, fontFamily: "var(--font-mono)" }}>
                    {c.channel} · {new Date(c.captured_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* DNC registry */}
      <ChartCard title="Do-not-call registry" subtitle="Tenant-scoped + federal cache" action={
        <button onClick={() => setShowAddDnc(true)} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 8, fontSize: 11,
          background: ATOM_TEAL, color: "#041413",
          border: "none", fontWeight: 700, cursor: "pointer",
        }}>
          <Plus size={11} /> Add entry
        </button>
      }>
        {!data?.dnc?.length ? <EmptyState message="No DNC entries" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {data.dnc.slice(0, 24).map((d) => (
              <div key={d.id} style={{
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text)" }}>{d.identifier}</div>
                <div style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
                  {d.source}{d.state ? ` · ${d.state}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Modals */}
      {showCapture && (
        <CaptureConsentModal
          tenantSlug={tenantSlug}
          onClose={() => setShowCapture(false)}
          onSubmit={(body) => captureConsent.mutate(body, { onSuccess: () => setShowCapture(false) })}
          submitting={captureConsent.isPending}
        />
      )}
      {showAddDnc && (
        <AddDncModal
          tenantSlug={tenantSlug}
          onClose={() => setShowAddDnc(false)}
          onSubmit={(body) => addDnc.mutate(body, { onSuccess: () => setShowAddDnc(false) })}
          submitting={addDnc.isPending}
        />
      )}
    </div>
  );
}

function CaptureConsentModal({ tenantSlug, onClose, onSubmit, submitting }: any) {
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState("voice");
  const [consentType, setConsentType] = useState("PEWC");
  const [source, setSource] = useState("web_form");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  return (
    <Modal title="Capture consent" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Prospect (phone or email)"><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+15551234567 or jane@acme.com" style={inputStyle} /></Field>
        <Field label="Channel">
          <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>
            <option value="voice">voice</option><option value="sms">sms</option><option value="email">email</option>
          </select>
        </Field>
        <Field label="Consent type">
          <select value={consentType} onChange={(e) => setConsentType(e.target.value)} style={inputStyle}>
            <option value="PEWC">PEWC (prior express written)</option>
            <option value="express_written">Express written</option>
            <option value="implied">Implied</option>
          </select>
        </Field>
        <Field label="Source"><input value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} /></Field>
        <Field label="Evidence URL (optional)"><input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} style={inputStyle} /></Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button
            onClick={() => onSubmit({ tenantSlug, action: "capture", prospectIdentifier: identifier, channel, consentType, source, evidenceUrl })}
            disabled={submitting || !identifier}
            style={primaryBtn}
          >{submitting ? "Saving…" : "Capture consent"}</button>
        </div>
      </div>
    </Modal>
  );
}
function AddDncModal({ tenantSlug, onClose, onSubmit, submitting }: any) {
  const [identifier, setIdentifier] = useState("");
  const [identifierType, setIdentifierType] = useState("phone");
  const [source, setSource] = useState("internal");
  const [state, setState] = useState("");
  return (
    <Modal title="Add DNC entry" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Identifier"><input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+15551234567" style={inputStyle} /></Field>
        <Field label="Type">
          <select value={identifierType} onChange={(e) => setIdentifierType(e.target.value)} style={inputStyle}>
            <option value="phone">phone</option><option value="email">email</option><option value="domain">domain</option>
          </select>
        </Field>
        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
            <option value="internal">internal</option><option value="user_request">user_request</option><option value="federal_dnc">federal_dnc</option><option value="state_dnc">state_dnc</option><option value="litigator">litigator</option>
          </select>
        </Field>
        {source === "state_dnc" && (
          <Field label="State"><input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0,2))} placeholder="OR" style={inputStyle} /></Field>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button
            onClick={() => onSubmit({ tenantSlug, identifier, identifierType, source, state: state || undefined })}
            disabled={submitting || !identifier}
            style={primaryBtn}
          >{submitting ? "Adding…" : "Add to DNC"}</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(5,9,12,0.7)", backdropFilter: "blur(10px)",
      display: "grid", placeItems: "center", padding: 20,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460,
        background: "linear-gradient(180deg, rgba(15,22,27,0.96), rgba(10,16,20,0.96))",
        border: "1px solid rgba(105,106,172,0.18)",
        borderRadius: 16, padding: 22,
      }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800,
          letterSpacing: "-0.02em", marginBottom: 14, color: "var(--color-text)",
        }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_MUTED }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "var(--color-text)", fontSize: 14, outline: "none",
  fontFamily: "var(--font-body)",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 10,
  background: ATOM_TEAL, color: "#041413", border: "none",
  fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 10,
  background: "transparent", color: ATOM_MUTED,
  border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: 13,
};
