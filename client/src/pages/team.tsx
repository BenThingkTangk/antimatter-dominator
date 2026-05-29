/**
 * /team — Workspace seats, roles, and invitations.
 * Graceful empty-state-aware view that pulls from /api/tenant/team when
 * available and degrades to a clear empty state with an invite CTA.
 */
import { useQuery } from "@tanstack/react-query";
import { useSessionContext } from "@/auth/AuthGate";
import {
  UserPlus,
  Shield,
  User,
  Crown,
  MoreHorizontal,
  Mail,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: "owner" | "admin" | "manager" | "member" | string;
  status: "active" | "invited" | "suspended" | string;
  lastActiveAt?: string | null;
}

interface TeamResponse {
  members: TeamMember[];
  seatsUsed: number;
  seatLimit: number | null;
}

function roleIcon(role: string) {
  if (role === "owner" || role === "admin") return Crown;
  if (role === "manager") return Shield;
  return User;
}

export default function TeamPage() {
  const { user } = useSessionContext();
  const { data, isLoading, error } = useQuery<TeamResponse>({
    queryKey: ["/api/tenant/team"],
    retry: false,
  });

  const canInvite = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/40 mb-2">
            ATOM · Team
          </p>
          <h1
            className="text-2xl font-bold"
            style={{
              color: "var(--color-text, #f6f6fd)",
              fontFamily: "var(--font-display, inherit)",
              letterSpacing: "-0.4px",
            }}
          >
            Team & Seats
          </h1>
          <p className="text-sm text-white/55 mt-1">
            Manage who can dial, coach, and command-center with you.
          </p>
        </div>
        {canInvite && (
          <a
            href="/#/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: "rgba(0,200,200,0.16)",
              border: "1px solid rgba(0,200,200,0.45)",
              color: "#7fe7e7",
            }}
          >
            <UserPlus size={14} /> Invite teammate
          </a>
        )}
      </div>

      {/* Seat summary */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <Stat label="Seats used" value={String(data.seatsUsed)} />
          <Stat label="Seat limit" value={data.seatLimit ? String(data.seatLimit) : "Unlimited"} />
          <Stat
            label="Active in last 7d"
            value={String(data.members.filter((m) => m.status === "active").length)}
          />
        </div>
      )}

      <section
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {isLoading && (
          <div className="p-8 text-center text-sm text-white/50">Loading teammates…</div>
        )}

        {error && (
          <EmptyState
            title="Team directory standing by"
            body="We're spinning up your workspace. Invite your first teammate to get the roster live."
            canInvite={canInvite}
          />
        )}

        {data && data.members.length === 0 && (
          <EmptyState
            title="You're flying solo — for now."
            body="Invite a manager or rep to share pipelines, call coaching, and live dashboards."
            canInvite={canInvite}
          />
        )}

        {data && data.members.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-wider text-white/40 text-left">
                <th className="px-5 py-3 font-medium">Member</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => {
                const RoleIcon = roleIcon(m.role);
                return (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="px-5 py-3">
                      <div className="text-sm text-white/90">{m.fullName || m.email}</div>
                      <div className="text-xs text-white/50">{m.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/75">
                        <RoleIcon size={12} /> {m.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={m.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-white/5 text-white/55"
                        aria-label="More actions"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; border: string; color: string }> = {
    active: { bg: "rgba(0,200,140,0.12)", border: "rgba(0,200,140,0.35)", color: "#7fe7c0" },
    invited: { bg: "rgba(255,200,80,0.12)", border: "rgba(255,200,80,0.35)", color: "#ffd78a" },
    suspended: { bg: "rgba(255,90,90,0.12)", border: "rgba(255,90,90,0.35)", color: "#ff9a9a" },
  };
  const m = map[status] || { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", color: "#cfcfdc" };
  return (
    <span
      className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}
    >
      {status}
    </span>
  );
}

function EmptyState({
  title,
  body,
  canInvite,
}: {
  title: string;
  body: string;
  canInvite: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-4">
      <Mail size={28} className="text-white/25" />
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/55 mt-1 max-w-md">{body}</p>
      </div>
      {canInvite && (
        <a
          href="/#/settings"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: "rgba(0,200,200,0.16)",
            border: "1px solid rgba(0,200,200,0.45)",
            color: "#7fe7e7",
          }}
        >
          <UserPlus size={14} /> Send first invite
        </a>
      )}
    </div>
  );
}
