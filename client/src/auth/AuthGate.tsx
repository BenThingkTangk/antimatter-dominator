import { useEffect, useState, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { useSession, type SessionData } from "./useSession";
import { DtomLogo } from "@nirmata/atom-design-system/react";

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
      <div style={{ width: "min(360px, 75vw)", filter: "drop-shadow(0 0 28px rgba(0,200,200,0.35))" }}>
        <DtomLogo size="hero" showWordmark={true} showIcon={false} ariaLabel="ΔTOM" />
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
