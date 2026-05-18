import { useEffect, useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { useSession, type SessionData } from "./useSession";

export const SessionContext = createContext<SessionData>({
  user: null,
  tenant: null,
  role: null,
  isSuperAdmin: false,
  loading: true,
  demoMode: false,
  refresh: () => {},
  logout: async () => {},
});

export function useSessionContext() {
  return useContext(SessionContext);
}

// Atomic orbit splash screen — shows during auth loading, max 1500ms
function AtomSplash() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <svg
        className="atom-mark"
        style={{ width: 120, height: 120 }}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle className="atom-atmosphere" cx="32" cy="32" r="30" />
        <g className="atom-orbits">
          <ellipse className="atom-orbit atom-orbit-a" cx="32" cy="32" rx="12" ry="29" />
          <ellipse className="atom-orbit atom-orbit-b" cx="32" cy="32" rx="29" ry="12" />
          <ellipse className="atom-orbit atom-orbit-c" cx="32" cy="32" rx="23" ry="10" transform="rotate(45 32 32)" />
        </g>
        <circle className="atom-nucleus" cx="32" cy="32" r="4.25" />
        <circle className="atom-electron atom-electron-a" cx="32" cy="3" r="2.6" />
        <circle className="atom-electron atom-electron-b" cx="61" cy="32" r="2.4" />
        <circle className="atom-electron atom-electron-c" cx="15.5" cy="48.5" r="2.2" />
      </svg>
      {/* Canonical ΔTOM wordmark — geometric SVG, never relies on Unicode Δ font rendering */}
      <svg
        aria-label="ΔTOM"
        role="img"
        className="atom-wordmark mt-6"
        viewBox="0 0 640 160"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "min(320px, 70vw)", height: "auto", color: "var(--color-text)" }}
      >
        <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
          <polygon points="70,130 10,130 40,30" stroke="currentColor" strokeWidth="14" />
          <line x1="100" y1="37" x2="220" y2="37" stroke="currentColor" strokeWidth="14" />
          <line x1="160" y1="37" x2="160" y2="130" stroke="currentColor" strokeWidth="14" />
          <circle cx="320" cy="83" r="50" stroke="var(--color-primary, #00c8c8)" strokeWidth="14" />
          <polyline points="410,130 410,37 470,110 530,37 530,130" stroke="currentColor" strokeWidth="14" />
        </g>
      </svg>
    </div>
  );
}

/** Paths that bypass auth */
const PUBLIC_PATHS = ["/login", "/signup", "/invite/"];

function isPublicPath(path: string): boolean {
  if (path === "/") return true;
  for (const p of PUBLIC_PATHS) {
    if (path.startsWith(p)) return true;
  }
  return false;
}

function hasPublicQuery(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.location.hash || "";
  return raw.includes("demo=1") || raw.includes("desktop=1");
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const [location, navigate] = useLocation();
  const [splashDone, setSplashDone] = useState(false);

  // Cap splash at 1500ms
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Also dismiss splash as soon as loading finishes
  useEffect(() => {
    if (!session.loading) setSplashDone(true);
  }, [session.loading]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (session.loading) return;
    if (!session.user && !isPublicPath(location) && !hasPublicQuery()) {
      navigate(`/login?next=${encodeURIComponent(location)}`);
    }
  }, [session.loading, session.user, location, navigate]);

  // Show splash while loading
  if (session.loading && !splashDone) {
    return <AtomSplash />;
  }

  return (
    <SessionContext.Provider value={session}>
      {session.demoMode && !session.user && (
        <div
          className="fixed top-0 left-0 right-0 z-40 text-center py-2 text-sm font-medium"
          style={{
            background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-2))",
            color: "var(--color-text-inverse)",
          }}
        >
          Demo mode — <a href="/#/signup" className="underline font-bold">Sign up</a> to use your own data
        </div>
      )}
      {children}
    </SessionContext.Provider>
  );
}
