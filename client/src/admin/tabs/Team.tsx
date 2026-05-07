/**
 * Admin → Team
 *
 * List tenant users + pending invites, role management, power-user leaderboard.
 */
import { useState } from "react";
import { Users, Mail, Plus, Trash2, Crown, UserCheck, UserX } from "lucide-react";
import { useAdminQuery, useAdminMutation } from "../useAdminApi";
import {
  KpiCard, ChartCard, DonutMix, LeaderboardRow,
  ATOM_TEAL, ATOM_MUTED, ATOM_FAINT, EmptyState,
} from "../charts";

interface TeamData {
  tenant: { id: string; slug: string; name: string };
  users: { id: string; email: string; full_name: string | null; role: string; invited_at: string; accepted_at: string | null; last_login_at: string | null }[];
  invites: { id: string; email: string; role: string; invited_by: string; invited_at: string; expires_at: string }[];
}
interface LeaderboardData {
  rows: { email: string; name: string; score: number; dials: number; conversion: number; tier: "top" | "mid" | "bottom" }[];
}

const ROLES = [
  { value: "admin",   label: "Admin",   description: "Full access" },
  { value: "manager", label: "Manager", description: "Team + reporting" },
  { value: "rep",     label: "Rep",     description: "Dial + use modules" },
  { value: "viewer",  label: "Viewer",  description: "Read-only" },
];

export default function Team() {
  const [tenantSlug, setTenantSlug] = useState("antimatter");
  const { data, refetch } = useAdminQuery<TeamData>(["admin","team",tenantSlug], `/api/admin/team?tenantSlug=${tenantSlug}`, { refetchInterval: 60_000 });
  const { data: tenants } = useAdminQuery<{ tenants: any[] }>(["admin","tenants-pick"], "/api/admin/data?view=tenants-list");
  const { data: leaderboard } = useAdminQuery<LeaderboardData>(["admin","leaderboard",tenantSlug], `/api/admin/data?view=leaderboard&tenantSlug=${tenantSlug}`);
  const invite = useAdminMutation<any, any>("/api/admin/team", "POST", [["admin","team",tenantSlug]]);
  const setRole = useAdminMutation<any, any>("/api/admin/team", "PATCH", [["admin","team",tenantSlug]]);
  const revoke = useAdminMutation<any, any>("/api/admin/team", "DELETE", [["admin","team",tenantSlug]]);

  const users = data?.users ?? [];
  const invites = data?.invites ?? [];
  const roleMix = ROLES.map(r => ({ name: r.label, value: users.filter(u => u.role === r.value).length })).filter(x => x.value > 0);
  const accepted = users.filter(u => u.accepted_at).length;
  const pending = invites.length;

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("rep");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Tenant
        </span>
        <select value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} style={selectStyle}>
          {(tenants?.tenants ?? [{ slug: "antimatter", name: "AntimatterAI" }]).map((t: any) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Total seats" value={users.length} sub="Active members" tone="default" icon={Users} />
        <KpiCard label="Onboarded" value={accepted} sub="Accepted invite" tone="success" icon={UserCheck} />
        <KpiCard label="Pending" value={pending} sub="Awaiting acceptance" tone={pending > 0 ? "warn" : "default"} icon={Mail} />
        <KpiCard label="Admins" value={users.filter(u => u.role === "admin").length} sub="Full access" tone="default" icon={Crown} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <ChartCard title="Power-user leaderboard" subtitle="Top reps by activity + conversion">
          {!leaderboard?.rows?.length ? <EmptyState message="Not enough activity yet" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {leaderboard.rows.slice(0, 8).map((r, i) => (
                <LeaderboardRow key={r.email} rank={i+1} name={r.name || r.email} email={r.email} score={r.score} dials={r.dials} conversion={r.conversion} tier={r.tier} />
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Role distribution" height={300}>
          <DonutMix data={roleMix} />
        </ChartCard>
      </div>

      <ChartCard title="Members" subtitle="Click any role to change · revoke removes seat" action={
        <button onClick={() => setShowInvite(true)} style={primaryBtn}>
          <Plus size={12} /> Invite member
        </button>
      }>
        {users.length === 0 ? <EmptyState message="No members yet — invite your first" /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {users.map((u) => (
              <div key={u.id} style={{
                display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center",
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text)" }}>{u.full_name || u.email}</div>
                  <div style={{ fontSize: 11, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>{u.email}</div>
                </div>
                <select value={u.role} onChange={(e) => setRole.mutate({ tenantSlug, userId: u.id, role: e.target.value })} style={miniSelectStyle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>
                  {u.last_login_at ? `Last seen ${new Date(u.last_login_at).toLocaleDateString()}` : u.accepted_at ? "Onboarded" : "Pending"}
                </span>
                <button onClick={() => { if (confirm("Revoke this seat?")) revoke.mutate({ tenantSlug, userId: u.id }); }} style={trashBtn}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ChartCard>

      {invites.length > 0 && (
        <ChartCard title="Pending invites" subtitle="Awaiting acceptance">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {invites.map((i) => (
              <div key={i.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10,
                background: "rgba(255,209,102,0.04)", border: "1px solid rgba(255,209,102,0.16)",
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{i.email}</div>
                  <div style={{ fontSize: 11, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
                    {i.role} · invited {new Date(i.invited_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  expires {new Date(i.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {showInvite && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(5,9,12,0.7)", backdropFilter: "blur(10px)",
          display: "grid", placeItems: "center", padding: 20,
        }} onClick={() => setShowInvite(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 420,
            background: "linear-gradient(180deg, rgba(15,22,27,0.96), rgba(10,16,20,0.96))",
            border: "1px solid rgba(0,230,211,0.18)", borderRadius: 16, padding: 22,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, marginBottom: 14, color: "var(--color-text)" }}>Invite member</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_MUTED }}>Email</span>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="alex@yourcompany.com" style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: ATOM_MUTED }}>Role</span>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={inputStyle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} · {r.description}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setShowInvite(false)} style={ghostBtn}>Cancel</button>
                <button
                  onClick={() => invite.mutate({ tenantSlug, email: inviteEmail, role: inviteRole }, {
                    onSuccess: () => { setShowInvite(false); setInviteEmail(""); }
                  })}
                  disabled={invite.isPending || !inviteEmail}
                  style={primaryBtn}
                >{invite.isPending ? "Sending…" : "Send invite"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--color-text)", fontSize: 14, outline: "none", fontFamily: "var(--font-body)" };
const selectStyle: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,230,211,0.32)", color: "var(--color-text)", fontFamily: "var(--font-mono)", fontSize: 12, outline: "none", cursor: "pointer" };
const miniSelectStyle: React.CSSProperties = { ...selectStyle, padding: "4px 8px", fontSize: 11 };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: ATOM_TEAL, color: "#041413", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: 10, background: "transparent", color: ATOM_MUTED, border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontSize: 13 };
const trashBtn: React.CSSProperties = { width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,107,139,0.2)", color: "#ff6b8b", cursor: "pointer" };
