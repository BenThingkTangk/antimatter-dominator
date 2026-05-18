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

// Atomic orbit splash screen — shows during auth loading, max 1500ms.
// Canonical full lockup: orbital icon + ΔTOM wordmark, side-by-side per brand spec.
function AtomSplash() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <div
        role="img"
        aria-label="ΔTOM"
        style={{
          width: "min(560px, 80vw)",
          color: "var(--color-text, #f0f0f0)",
          filter: "drop-shadow(0 0 28px rgba(0,200,200,0.35))",
        }}
      >
        <svg
          viewBox="0 0 1100 240"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "auto" }}
        >
          <defs>
            <radialGradient id="splash-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#bff3f3" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#00c8c8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="splash-shell" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a1a1c" stopOpacity="1" />
              <stop offset="70%" stopColor="#06181a" stopOpacity="1" />
              <stop offset="100%" stopColor="#04121a" stopOpacity="1" />
            </radialGradient>
          </defs>
          <g transform="translate(20 20)">
            <g
              fill="none"
              stroke="var(--color-primary, #3fb5b5)"
              strokeWidth="5"
              strokeLinecap="round"
              style={{ transformOrigin: "100px 100px", animation: "atom-orbit-spin 14s linear infinite reverse" }}
            >
              <ellipse cx="100" cy="100" rx="82" ry="32" />
              <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(60 100 100)" />
              <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(120 100 100)" />
            </g>
            <circle cx="100" cy="100" r="26" fill="url(#splash-shell)" />
            <circle cx="100" cy="100" r="18" fill="url(#splash-core)" />
            <circle cx="100" cy="100" r="5" fill="#ffffff" />
          </g>
          <g transform="translate(290 20)" fill="none" strokeLinecap="square" strokeLinejoin="miter">
            <polygon points="100,170 10,170 55,30" stroke="currentColor" strokeWidth="18" />
            <line x1="150" y1="35" x2="310" y2="35" stroke="currentColor" strokeWidth="18" />
            <line x1="230" y1="35" x2="230" y2="170" stroke="currentColor" strokeWidth="18" />
            <circle cx="430" cy="102" r="70" stroke="var(--color-primary, #3fb5b5)" strokeWidth="18" />
            <polyline points="540,170 540,35 615,150 690,35 690,170" stroke="currentColor" strokeWidth="18" />
          </g>
        </svg>
      </div>
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
