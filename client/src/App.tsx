import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DtomBrandShell, DtomBootLoader } from "@nirmata/dtom-brand-system";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "./components/AppLayout";
import PitchGenerator from "./pages/pitch-generator";
import ObjectionHandler from "./pages/objection-handler";
import MarketIntent from "./pages/market-intent";
import ProspectEngine from "./pages/prospect-engine";
import AtomLeadGen from "./pages/atom-leadgen";
import AtomCampaign from "./pages/atom-campaign";
import CompanyIntelligence from "./pages/company-intelligence";
import AtomWarRoom from "./pages/atom-warroom";
import AdminTenants from "./pages/admin-tenants";
import BillingPage from "./pages/billing";
import InviteAcceptPage from "./pages/invite";
import AdminShell from "./admin/AdminShell";
import HqShell from "./admin/HqShell";
import VibraniumShell from "./admin/VibraniumShell";
import TenantDetailShell from "./admin/TenantDetailShell";
import { useSessionContext } from "./auth/AuthGate";

// Tenant-admins do NOT see platform-level surfaces (Nirmata HQ, Vibranium GA,
// Billing & Plan, ATOM System Control). Even if they type the URL directly,
// they're bounced to the default product module.
function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const session = useSessionContext();
  if (!session.isSuperAdmin) {
    if (typeof window !== "undefined") {
      window.location.hash = "#/pitch";
    }
    return null;
  }
  return <>{children}</>;
}
import NotFound from "./pages/not-found";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import LandingPage from "./pages/landing";
import { useTenant } from "./lib/useTenant";
import { AuthGate } from "./auth/AuthGate";
import { useSessionContext } from "./auth/AuthGate";
import AtomChat from "./components/AtomChat";
import MobileApp from "./mobile/MobileApp";

/**
 * Detects phone-class viewports + touch UA. We check both width AND touch
 * capability so a narrow desktop window doesn't accidentally launch the
 * mobile app, and an iPad in landscape stays on desktop.
 */
function isPhoneClass(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Strict iPhone/Android-phone UA detection. Tablets, narrow desktop windows,
  // and macOS with touchpads must never trigger the mobile shell.
  const iphoneLike = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (!iphoneLike) return false;
  // Plus very narrow viewport so a phone in landscape stays on desktop only
  // when the user has explicitly rotated wide.
  const narrow = window.innerWidth <= 600;
  return narrow;
}

/**
 * Map a desktop route → mobile route. Only consulted on the FIRST PAINT
 * of a page load when the device is detected as a phone. Never used to
 * rewrite navigations once the app is already mounted on desktop.
 */
const MOBILE_ROUTE_MAP: Record<string, string> = {
  "/pitch":                "/m/pitch",
  "/objections":           "/m/objections",
  "/market":               "/m/market",
  "/prospects":            "/m/prospects",
  "/company-intelligence": "/m/warbook",
  "/war-room":             "/m/war-room",
  "/atom-leadgen":         "/m/dial",
  "/atom-campaign":        "/m/chat",
  "/admin/tenants":        "/m/admin",
};

// Module-level guard — even if React StrictMode or HMR remounts MobileGate
// twice, the redirect can fire AT MOST once per page load.
let __mobileGateRan = false;

function readPin(): boolean {
  try {
    if (localStorage.getItem("atom_pin_desktop") === "1") return true;
    if (sessionStorage.getItem("m_force_desktop") === "1") return true;
  } catch {}
  return false;
}
function writePin() {
  try { localStorage.setItem("atom_pin_desktop", "1"); } catch {}
  try { sessionStorage.setItem("m_force_desktop", "1"); } catch {}
}
function clearPin() {
  try { localStorage.removeItem("atom_pin_desktop"); } catch {}
  try { sessionStorage.removeItem("m_force_desktop"); } catch {}
}

// Expose a console escape hatch so anyone bouncing in error can run
// `__atomDesktop()` from devtools and instantly recover — no rebuild needed.
if (typeof window !== "undefined") {
  (window as any).__atomDesktop = () => { writePin(); window.location.hash = "#/"; window.location.reload(); };
  (window as any).__atomMobile  = () => { clearPin();  window.location.hash = "#/m/home"; window.location.reload(); };
}

/**
 * MobileGate — runs ONCE per page load (module-level guard, empty deps).
 * If the device is a true phone AND the user has not pinned desktop,
 * route to /m/*. Otherwise pin desktop forever in localStorage so even
 * a fresh tab on the same browser stays desktop.
 */
function MobileGate() {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (__mobileGateRan) return;
    __mobileGateRan = true;

    const url = new URL(window.location.href);
    const forceDesktop = url.searchParams.get("desktop") === "1";
    if (forceDesktop) { writePin(); return; }
    const forceMobile  = url.searchParams.get("mobile") === "1";
    if (forceMobile)  { clearPin(); navigate("/m/home"); return; }

    if (readPin()) return;

    const initialPath = window.location.hash.replace(/^#/, "").split("?")[0] || "/";
    // Same trap as AppRouter — must match the /m group exactly, not /market.
    if (initialPath === "/m" || initialPath.startsWith("/m/")) return;

    if (isPhoneClass()) {
      // Phone detected on first paint and not yet pinned to either side.
      // Only redirect from the EXACT root "/" — never silently rewrite a
      // user-typed module URL like /market into /m/market. This way clicks
      // from the desktop sidebar (/market, /pitch, etc.) can never bounce
      // mid-session, and a phone user landing on root still gets sent home.
      if (initialPath === "/" || initialPath === "") {
        const rawHash = window.location.hash || "";
        const queryIdx = rawHash.indexOf("?");
        const queryStr = queryIdx >= 0 ? rawHash.slice(queryIdx) : "";
        navigate("/m/home" + queryStr);
      }
    } else {
      // True desktop — pin it forever so no bundle (current or stale,
      // current tab or future tab) ever flips them again.
      writePin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Authenticated app routes — only shown when logged in (via AuthGate). */
function AuthenticatedRoutes() {
  const { user } = useSessionContext();

  return (
    <AppLayout>
      <Switch>
        {/* Authenticated root → redirect to pitch */}
        <Route path="/">
          {user ? <Redirect to="/pitch" /> : <LandingPage />}
        </Route>
        <Route path="/pitch" component={PitchGenerator} />
        <Route path="/objections" component={ObjectionHandler} />
        <Route path="/market" component={MarketIntent} />
        <Route path="/prospects" component={ProspectEngine} />
        <Route path="/atom-leadgen" component={AtomLeadGen} />
        <Route path="/atom-campaign" component={AtomCampaign} />
        <Route path="/company-intelligence" component={CompanyIntelligence} />
        <Route path="/war-room" component={AtomWarRoom} />
        <Route path="/admin/tenants">{() => <SuperAdminOnly><AdminTenants /></SuperAdminOnly>}</Route>
        <Route path="/billing">{() => <SuperAdminOnly><BillingPage /></SuperAdminOnly>}</Route>
        <Route path="/admin/hq">{() => <SuperAdminOnly><HqShell /></SuperAdminOnly>}</Route>
        <Route path="/admin/vibranium-ga">{() => <SuperAdminOnly><VibraniumShell /></SuperAdminOnly>}</Route>
        <Route path="/admin/t/:slug">{(params) => <SuperAdminOnly><TenantDetailShell params={params as any} /></SuperAdminOnly>}</Route>
        <Route path="/admin">{() => <SuperAdminOnly><AdminShell /></SuperAdminOnly>}</Route>
        <Route component={NotFound} />
      </Switch>
      {/* Floating ATOM Chat — visible on every desktop page, route-aware context */}
      <AtomChat />
    </AppLayout>
  );
}

function AppRouter() {
  // Resolve tenant on first paint (shared between mobile + desktop).
  useTenant();
  const [location] = useLocation();

  // Match the mobile route group exactly — "/m", "/m/", or "/m/<anything>".
  // Never use startsWith("/m") here because it also matches "/market"
  // (which is why Market Intent kept bouncing into the mobile shell).
  if (location === "/m" || location.startsWith("/m/")) {
    return <MobileApp />;
  }

  return (
    <AuthGate>
      <Switch>
        {/* Public routes — rendered outside AppLayout */}
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/invite/:token" component={InviteAcceptPage} />
        {/* Landing page at root for unauthenticated users */}
        <Route path="/" component={LandingPage} />
        {/* Everything else goes through authenticated layout */}
        <Route>{() => <AuthenticatedRoutes />}</Route>
      </Switch>
    </AuthGate>
  );
}

function App() {
  // One-shot cinematic boot loader on first paint of the app session. We
  // suppress it on `?noboot=1` and after sessionStorage flag so navigation
  // inside the app doesn't re-trigger the cinematic ignition.
  const [bootDone, setBootDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("noboot") === "1") return true;
      if (sessionStorage.getItem("dtom_boot_done") === "1") return true;
    } catch {}
    return false;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <DtomBrandShell assetBasePath="/dtom-assets" theme="dark" brand="atom">
        {!bootDone && (
          <DtomBootLoader
            active={!bootDone}
            minimumDrama={2200}
            onComplete={() => {
              try { sessionStorage.setItem("dtom_boot_done", "1"); } catch {}
              setBootDone(true);
            }}
          />
        )}
        <Router hook={useHashLocation}>
          <MobileGate />
          <AppRouter />
        </Router>
        <Toaster />
      </DtomBrandShell>
    </QueryClientProvider>
  );
}

export default App;
