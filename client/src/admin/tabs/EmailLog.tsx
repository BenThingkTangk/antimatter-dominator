/**
 * Admin → Email Log
 *
 * Diagnostic view for transactional email. Lists the latest 50 invites and
 * 20 signup welcomes with status, recipient, tenant, timestamps, and a copy
 * button for the accept URL. Also surfaces the FROM address and a deep link
 * to the Resend dashboard for live delivered/bounced/held state.
 */
import { useEffect, useState } from "react";
import { Mail, Copy, ExternalLink, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Clock, X as XIcon } from "lucide-react";
import { adminFetch } from "../useAdminApi";
import { ATOM_TEAL, ATOM_TEAL_2, ATOM_GREEN, ATOM_AMBER, ATOM_MUTED, EmptyState } from "../charts";

interface InviteRow {
  id: string;
  type: "invite";
  to: string;
  role: string;
  sentAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  invitedBy: string | null;
  tenant: { slug: string; name: string } | null;
  acceptUrl: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}
interface UserRow {
  id: string;
  type: "signup";
  to: string;
  role: string;
  sentAt: string;
  acceptedAt: string | null;
  lastLoginAt: string | null;
  tenant: { slug: string; name: string } | null;
  status: "signed-up" | "active";
}
interface Payload {
  from: string;
  resendDashboard: string;
  invites: InviteRow[];
  users: UserRow[];
}

function relTime(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
    pending:     { color: ATOM_AMBER,  bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.32)", icon: Clock },
    accepted:    { color: ATOM_GREEN,  bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.32)", icon: CheckCircle2 },
    expired:     { color: ATOM_MUTED,  bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", icon: Clock },
    revoked:     { color: "#ff6b8b",   bg: "rgba(255,107,139,0.10)", border: "rgba(255,107,139,0.32)", icon: XIcon },
    "signed-up": { color: ATOM_TEAL_2, bg: "rgba(34,211,238,0.10)", border: "rgba(34,211,238,0.32)", icon: CheckCircle2 },
    active:      { color: ATOM_GREEN,  bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.32)", icon: CheckCircle2 },
  };
  const tone = map[status] || { color: ATOM_MUTED, bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", icon: Clock };
  const Icon = tone.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 999,
      background: tone.bg, color: tone.color, border: `1px solid ${tone.border}`,
      fontFamily: "var(--font-mono)", fontSize: 9,
      letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
    }}>
      <Icon size={10} /> {status.replace("-", " ")}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      title="Copy invite link"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 9px", borderRadius: 6,
        background: done ? "rgba(74,222,128,0.10)" : "rgba(255,255,255,0.03)",
        color: done ? ATOM_GREEN : ATOM_MUTED,
        border: `1px solid ${done ? "rgba(74,222,128,0.30)" : "rgba(255,255,255,0.08)"}`,
        fontFamily: "var(--font-mono)", fontSize: 10, cursor: "pointer",
      }}
    >
      {done ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      {done ? "copied" : "copy"}
    </button>
  );
}

export default function EmailLog() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await adminFetch("/api/admin/email-log");
      setData(r);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header card with FROM + Resend dashboard link */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 18px", borderRadius: 14,
        background: "color-mix(in oklab, var(--color-primary) 4%, var(--color-surface))",
        border: "1px solid color-mix(in oklab, var(--color-primary) 18%, transparent)",
        gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: ATOM_MUTED, marginBottom: 4,
          }}>Sender · Resend</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)", display: "flex", gap: 8, alignItems: "center" }}>
            <Mail size={14} style={{ color: ATOM_TEAL }} />
            <code style={{ fontFamily: "var(--font-mono)", color: ATOM_TEAL }}>{data?.from || "—"}</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={data?.resendDashboard || "https://resend.com/logs"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              background: `color-mix(in oklab, ${ATOM_TEAL} 10%, transparent)`,
              border: `1px solid color-mix(in oklab, ${ATOM_TEAL} 32%, transparent)`,
              color: ATOM_TEAL,
              fontFamily: "var(--font-mono)", fontSize: 11,
              textDecoration: "none", fontWeight: 700,
            }}
          >
            <ExternalLink size={12} /> Resend Logs ↗
          </a>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--color-text)",
              fontFamily: "var(--font-mono)", fontSize: 11,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            refresh
          </button>
        </div>
      </div>

      {/* Deliverability tip */}
      <div style={{
        padding: "12px 16px", borderRadius: 12,
        background: "rgba(251,191,36,0.04)",
        border: "1px solid rgba(251,191,36,0.18)",
        color: "rgba(255,255,255,0.65)",
        fontSize: 12, lineHeight: 1.6,
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={14} style={{ color: ATOM_AMBER, marginTop: 1, flexShrink: 0 }} />
          <div>
            <strong style={{ color: "var(--color-text)" }}>If a recipient says they didn't get the email:</strong>
            {" "}check Resend Logs (above) for the actual delivered / bounced / held state. Brand-new sender domains often land in Spam for the first ~50 messages — ask the recipient to mark one "Not spam" to train their filter. For Gmail recipients especially, this is normal until trust is established.
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,107,139,0.08)", color: "#ff6b8b",
          fontFamily: "var(--font-mono)", fontSize: 11,
          border: "1px solid rgba(255,107,139,0.25)",
        }}>{error}</div>
      )}

      {/* Invites */}
      <Section title="Latest invites" subtitle="Last 50 · click copy to grab the accept link">
        {!data?.invites?.length ? <EmptyState /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.invites.map((row) => (
              <div key={row.id} style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 2fr) 1fr 1fr 1fr auto",
                gap: 10, alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: row.status === "pending" ? "rgba(251,191,36,0.03)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${row.status === "pending" ? "rgba(251,191,36,0.14)" : "rgba(255,255,255,0.06)"}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.to}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED }}>
                    role: {row.role}{row.invitedBy ? ` · by ${row.invitedBy}` : ""}
                  </div>
                </div>
                <Cell label="Tenant" value={row.tenant ? row.tenant.name : "—"} sub={row.tenant?.slug} />
                <Cell label="Sent" value={relTime(row.sentAt)} />
                <Cell
                  label={row.status === "accepted" ? "Accepted" : row.status === "revoked" ? "Revoked" : "Expires"}
                  value={
                    row.status === "accepted" ? relTime(row.acceptedAt) :
                    row.status === "revoked" ? relTime(row.revokedAt) :
                    relTime(row.expiresAt)
                  }
                />
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <StatusPill status={row.status} />
                  {row.status === "pending" && <CopyButton text={row.acceptUrl} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Signups */}
      <Section title="Latest signups" subtitle="Last 20 users — including welcome emails">
        {!data?.users?.length ? <EmptyState /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.users.map((row) => (
              <div key={row.id} style={{
                display: "grid",
                gridTemplateColumns: "minmax(180px, 2fr) 1fr 1fr 1fr auto",
                gap: 10, alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.to}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED }}>
                    role: {row.role}
                  </div>
                </div>
                <Cell label="Tenant" value={row.tenant ? row.tenant.name : "—"} sub={row.tenant?.slug} />
                <Cell label="Joined" value={relTime(row.acceptedAt || row.sentAt)} />
                <Cell label="Last login" value={relTime(row.lastLoginAt)} />
                <StatusPill status={row.status} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: 18,
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        letterSpacing: "0.16em", textTransform: "uppercase",
        color: ATOM_MUTED, marginBottom: 4,
      }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--color-text)", marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: ATOM_MUTED,
      }}>{label}</div>
      <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED }}>{sub}</div>}
    </div>
  );
}
