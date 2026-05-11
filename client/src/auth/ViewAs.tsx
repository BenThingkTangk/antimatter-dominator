/**
 * View-As — Overlord / Manager / Rep preview toggle (super-admin only).
 *
 * Lets the real super-admin (Ben) temporarily see the app exactly as a
 * tenant manager or sales rep would. NOTHING about the underlying session
 * changes — we just override the effective `role` and `isSuperAdmin` flag
 * that the rest of the UI reads.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Crown, Shield, User, X } from "lucide-react";
import { useSessionContext } from "./AuthGate";
import type { SessionData } from "./useSession";

export type ViewAsRole = "overlord" | "manager" | "rep";

const STORAGE_KEY = "atom_view_as_v1";

interface ViewAsContextValue {
  activeView: ViewAsRole;
  isRealSuperAdmin: boolean;
  setView: (v: ViewAsRole) => void;
  exitPreview: () => void;
}

const ViewAsContext = createContext<ViewAsContextValue>({
  activeView: "overlord",
  isRealSuperAdmin: false,
  setView: () => {},
  exitPreview: () => {},
});

export function useViewAs() {
  return useContext(ViewAsContext);
}

/**
 * The composed view-aware session every gate / sidebar / route should read.
 * Real super-admin who has flipped to 'manager' sees role: manager,
 * isSuperAdmin: false here — exactly as if they logged in as a manager.
 */
export function useEffectiveSession(): SessionData & {
  effectiveView: ViewAsRole;
  isRealSuperAdmin: boolean;
} {
  const session = useSessionContext();
  const { activeView, isRealSuperAdmin } = useViewAs();

  return useMemo(() => {
    if (!isRealSuperAdmin || activeView === "overlord") {
      return { ...session, effectiveView: activeView, isRealSuperAdmin };
    }
    return {
      ...session,
      role: activeView,
      isSuperAdmin: false,
      effectiveView: activeView,
      isRealSuperAdmin,
    };
  }, [session, activeView, isRealSuperAdmin]);
}

function loadView(): ViewAsRole {
  if (typeof window === "undefined") return "overlord";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "manager" || v === "rep" || v === "overlord") return v;
  } catch {}
  return "overlord";
}

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionContext();
  const isRealSuperAdmin = session.isSuperAdmin;
  const [activeView, setActiveView] = useState<ViewAsRole>("overlord");

  useEffect(() => {
    if (isRealSuperAdmin) setActiveView(loadView());
    else setActiveView("overlord");
  }, [isRealSuperAdmin]);

  const setView = (v: ViewAsRole) => {
    setActiveView(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
  };

  const exitPreview = () => setView("overlord");

  return (
    <ViewAsContext.Provider value={{ activeView, isRealSuperAdmin, setView, exitPreview }}>
      {children}
    </ViewAsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// UI — the floating chip + the preview banner
// ─────────────────────────────────────────────────────────────────────

const VIEW_META: Record<ViewAsRole, { label: string; icon: any; color: string; rgba: string; desc: string }> = {
  overlord: {
    label: "Overlord",
    icon: Crown,
    color: "#ffd166",
    rgba: "255,209,102",
    desc: "Full Nirmata HQ · Seat Costs · Vibranium GA · every module",
  },
  manager: {
    label: "Manager",
    icon: Shield,
    color: "#00e6d3",
    rgba: "0,230,211",
    desc: "Tenant admin view — all 8 ATOM weapons, no platform surfaces",
  },
  rep: {
    label: "Rep",
    icon: User,
    color: "#b987ff",
    rgba: "185,135,255",
    desc: "Sales rep view — day-to-day modules only",
  },
};

export function ViewAsToggle() {
  const { activeView, isRealSuperAdmin, setView } = useViewAs();
  const [open, setOpen] = useState(false);

  if (!isRealSuperAdmin) return null;

  const current = VIEW_META[activeView];
  const CurrentIcon = current.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Switch view"
        className="fixed z-[60] flex items-center gap-2 transition-all"
        style={{
          bottom: 24,
          right: 96,
          padding: "8px 14px",
          borderRadius: 999,
          background: `rgba(${current.rgba}, 0.12)`,
          border: `1px solid rgba(${current.rgba}, 0.45)`,
          color: current.color,
          boxShadow: open
            ? `0 0 0 4px rgba(${current.rgba}, 0.12), 0 12px 36px rgba(0,0,0,0.5)`
            : `0 0 18px rgba(${current.rgba}, 0.25), 0 6px 18px rgba(0,0,0,0.4)`,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <CurrentIcon size={13} />
        <span>{`View as · ${current.label}`}</span>
      </button>

      {open && (
        <div
          className="fixed z-[60] rounded-2xl"
          style={{
            bottom: 76,
            right: 96,
            width: 320,
            padding: 16,
            background: "rgba(11, 13, 16, 0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.58)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="text-[10px] font-mono uppercase"
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}
            >
              Preview the app as
            </div>
            <button
              onClick={() => setOpen(false)}
              className="opacity-60 hover:opacity-100 transition"
              aria-label="Close view-as panel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(Object.keys(VIEW_META) as ViewAsRole[]).map((role) => {
              const meta = VIEW_META[role];
              const Icon = meta.icon;
              const active = role === activeView;
              return (
                <button
                  key={role}
                  onClick={() => {
                    setView(role);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{
                    background: active ? `rgba(${meta.rgba}, 0.12)` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? `rgba(${meta.rgba}, 0.45)` : "rgba(255,255,255,0.08)"}`,
                    color: "var(--color-text, #edf8f8)",
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `rgba(${meta.rgba}, 0.18)`,
                      border: `1px solid rgba(${meta.rgba}, 0.45)`,
                    }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-sm font-semibold"
                      style={{ color: active ? meta.color : "var(--color-text)" }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="block text-[11px] mt-0.5"
                      style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.35 }}
                    >
                      {meta.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 pt-3 text-[10px] font-mono"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Persists across reloads. Only you see this.
          </div>
        </div>
      )}
    </>
  );
}

export function ViewAsBanner() {
  const { activeView, isRealSuperAdmin, exitPreview } = useViewAs();
  if (!isRealSuperAdmin) return null;
  if (activeView === "overlord") return null;

  const meta = VIEW_META[activeView];
  const Icon = meta.icon;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[55] flex items-center justify-center gap-3 px-4 py-1.5"
      style={{
        background: `linear-gradient(90deg, rgba(${meta.rgba},0.18), rgba(${meta.rgba},0.05), rgba(${meta.rgba},0.18))`,
        borderBottom: `1px solid rgba(${meta.rgba}, 0.35)`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Icon size={12} style={{ color: meta.color }} />
      <span
        className="text-[10px] font-mono uppercase"
        style={{ letterSpacing: "0.22em", color: meta.color, fontWeight: 700 }}
      >
        Preview · viewing as {meta.label}
      </span>
      <button
        onClick={exitPreview}
        className="text-[10px] font-mono uppercase transition-opacity hover:opacity-100"
        style={{
          letterSpacing: "0.18em",
          color: meta.color,
          opacity: 0.7,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        Exit preview
      </button>
    </div>
  );
}
