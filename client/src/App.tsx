import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { DtomBrandShell, DtomBootLoader } from "@nirmata/atom-design-system/react";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "./components/AppLayout";
import { SalesOsLayout } from "./components/sales-os/SalesOsLayout";
import { CommandPalette } from "./components/CommandPalette";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { registerShortcuts } from "./lib/keyboard-shortcuts";
import DemoDial from "./pages/demo-dial";
import Dashboard from "./pages/dashboard";
import PitchGenerator from "./pages/pitch-generator";
import ObjectionHandler from "./pages/objection-handler";
import MarketIntent from "./pages/market-intent";
import ProspectEngine from "./pages/prospect-engine";
import AtomLeadGen from "./pages/atom-leadgen";
import CompanyIntelligence from "./pages/company-intelligence";
import AtomWarRoom from "./pages/atom-warroom";
import AdminTenants from "./pages/admin-tenants";
import BillingPage from "./pages/billing";
import InviteAcceptPage from "./pages/invite";
import AdminShell from "./admin/AdminShell";
import HqShell from "./admin/HqShell";
import SeatCostsShell from "./admin/SeatCostsShell";
import VibraniumShell from "./admin/VibraniumShell";
import TenantDetailShell from "./admin/TenantDetailShell";
import { useSessionContext, AuthGate } from "./auth/AuthGate";
import { ViewAsProvider, useEffectiveSession } from "./auth/ViewAs";
import NotFound from "./pages/not-found";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import LandingPage from "./pages/landing";
import ResetPasswordPage from "./pages/reset-password";
import { useTenant } from "./lib/useTenant";
import AtomChat from "./components/AtomChat";
import MobileApp from "./mobile/MobileApp";
import { initPush, subscribePush } from "./lib/push-notifications";
import { lazy, Suspense } from "react";
// ATOM Sales OS zones
import PipelineCommand from "./pages/sales-os/pipeline";
import SalesOsCalls from "./pages/sales-os/calls";
import SalesOsCampaigns from "./pages/sales-os/campaigns";
import BuyerIntel from "./pages/sales-os/intel";
import SalesOsRevenue from "./pages/sales-os/revenue";
import ComplianceVault from "./pages/sales-os/compliance";
import SalesOsPartners from "./pages/sales-os/partners";
import SalesOsAgents from "./pages/sales-os/agents";
import SalesOsOnboarding from "./pages/sales-os/onboarding";
import SalesOsSettings from "./pages/sales-os/settings";
// War Room (WebXR) — lazy so three.js stays out of the main bundle
const WarRoomXR = lazy(() => import("./pages/sales-os/xr"));

// Tenant-admins do NOT see platform-level surfaces (Nirmata HQ, Vibranium GA,
// Billing & Plan, ATOM System Control). Even if they type the URL directly,
// they're bounced to the default product module.
//
// Reads the EFFECTIVE session (not the raw one) so that when a real
// super-admin flips the View-As toggle to manager/rep, this gate behaves
// exactly as if they had logged in with that lower role.
function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const session = useEffectiveSession();
  if (!session.isSuperAdmin) {
    if (typeof window !== "undefined") {
      window.location.hash = "#/pitch";
    }
    return null;
  }
  return <>{children}</>;
}

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
  "/campaigns":            "/m/chat",
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

/** Authenticated app routes inner — only shown when logged in (via AuthGate).
 *  Wrapped by AuthenticatedRoutes below in ViewAsProvider so the
 *  super-admin View-As toggle can mask down to manager/rep across every
 *  gated surface inside the layout. */
function AuthenticatedRoutesInner() {
  const { user } = useSessionContext();
  const [location, navigate] = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);

  useEffect(() => {
    return registerShortcuts(navigate, togglePalette);
  }, [navigate, togglePalette]);

  // Initialize push notifications after auth
  useEffect(() => {
    if (user?.id) {
      initPush().then(() => subscribePush(user.id)).catch(() => {});
    }
  }, [user?.id]);

  // Onboarding gate: fresh signups see the wizard before anything else.
  // The demo-dial page is allowed through so the post-wizard redirect works.
  const showOnboarding = user && !user.onboardingComplete && location !== "/demo-dial";

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => navigate("/demo-dial")} />;
  }

  // ATOM Sales OS zone routes — new left-nav shell + persistent Agent dock.
  // Root redirects to /pipeline (Pipeline Command). The XR War Room renders
  // its own full-screen canvas inside the shell.
  const SALES_OS_PATHS = [
    "/pipeline", "/calls", "/intel", "/revenue", "/compliance",
    "/partners", "/agents", "/xr", "/onboarding", "/settings",
  ];
  if (location === "/" || SALES_OS_PATHS.includes(location) || location === "/campaigns") {
    return (
      <SalesOsLayout>
        <Switch>
          <Route path="/">{() => <Redirect to="/pipeline" />}</Route>
          <Route path="/pipeline" component={PipelineCommand} />
          <Route path="/calls" component={SalesOsCalls} />
          <Route path="/campaigns" component={SalesOsCampaigns} />
          <Route path="/intel" component={BuyerIntel} />
          <Route path="/revenue" component={SalesOsRevenue} />
          <Route path="/compliance" component={ComplianceVault} />
          <Route path="/partners" component={SalesOsPartners} />
          <Route path="/agents" component={SalesOsAgents} />
          <Route path="/onboarding" component={SalesOsOnboarding} />
          <Route path="/settings" component={SalesOsSettings} />
          <Route path="/xr">
            {() => (
              <Suspense fallback={<div className="text-cyan-400 p-8 font-mono text-sm">Loading War Room…</div>}>
                <WarRoomXR />
              </Suspense>
            )}
          </Route>
        </Switch>
      </SalesOsLayout>
    );
  }

  return (
    <AppLayout>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navigate={navigate} />
      <Switch>
        {/* Demo dial — cinematic activation moment (no layout chrome needed but
            rendered inside AppLayout for trial banner + nav escape hatch) */}
        <Route path="/demo-dial" component={DemoDial} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pitch" component={PitchGenerator} />
        <Route path="/objections" component={ObjectionHandler} />
        <Route path="/market" component={MarketIntent} />
        <Route path="/prospects" component={ProspectEngine} />
        <Route path="/atom-leadgen" component={AtomLeadGen} />
        <Route path="/atom-campaign">{() => <Redirect to="/campaigns" />}</Route>
        <Route path="/company-intelligence" component={CompanyIntelligence} />
        <Route path="/war-room" component={AtomWarRoom} />
        <Route path="/admin/tenants">{() => <SuperAdminOnly><AdminTenants /></SuperAdminOnly>}</Route>
        <Route path="/billing">{() => <SuperAdminOnly><BillingPage /></SuperAdminOnly>}</Route>
        <Route path="/admin/hq">{() => <SuperAdminOnly><HqShell /></SuperAdminOnly>}</Route>
        <Route path="/admin/hq/seat-costs">{() => <SuperAdminOnly><SeatCostsShell /></SuperAdminOnly>}</Route>
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

function AuthenticatedRoutes() {
  return (
    <ViewAsProvider>
      <AuthenticatedRoutesInner />
    </ViewAsProvider>
  );
}

/** Root path resolver: logged-in users go to the Sales OS shell (which
 *  redirects to /pipeline); anonymous visitors get the landing page. */
function RootRoute() {
  const { user, loading } = useSessionContext();
  if (loading) return null;
  return user ? <AuthenticatedRoutes /> : <LandingPage />;
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
        <Route path="/reset-password/:token" component={ResetPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/invite/:token" component={InviteAcceptPage} />
        {/* Root: authenticated users enter the Sales OS shell (→ /pipeline);
            anonymous visitors see the public landing page. */}
        <Route path="/">{() => <RootRoute />}</Route>
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
