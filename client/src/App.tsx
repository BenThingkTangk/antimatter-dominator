import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
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
import AdminShell from "./admin/AdminShell";
import HqShell from "./admin/HqShell";
import TenantDetailShell from "./admin/TenantDetailShell";
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
 * Map a desktop route → mobile route. Used by the cross-module action
 * buttons inside the desktop pages (e.g. "Build Pitch from This"
 * navigates to /pitch?context=… — we rewrite to /m/pitch?context=… so
 * the click stays inside the mobile experience).
 */
const MOBILE_ROUTE_MAP: Record<string, string> = {
  "/pitch":                "/m/pitch",
  "/objections":           "/m/objections",
  "/market":               "/m/market",
  "/prospects":            "/m/prospects",
  "/company-intelligence": "/m/warbook",
  "/war-room":             "/m/war-room",
  "/atom-leadgen":         "/m/dial",
  "/atom-campaign":        "/m/chat",          // no dedicated /m/campaign route yet
  "/admin/tenants":        "/m/admin",
};

/**
 * MobileGate — runs ONCE on first paint. If the device is a phone AND the
 * user has not pinned the desktop view, route to the mobile experience.
 *
 * Critically, this does NOT re-run on subsequent route changes — that bug
 * would bounce desktop users to /m/* whenever a momentary viewport check
 * tripped (devtools open, browser zoom, touchpad reporting touch, etc.).
 */
function MobileGate() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const url = new URL(window.location.href);
    const forceDesktop = url.searchParams.get("desktop") === "1";
    if (forceDesktop) {
      try { sessionStorage.setItem("m_force_desktop", "1"); } catch {}
      return;
    }
    // Once a session is pinned to desktop, stay there forever.
    let stickDesktop = false;
    try { stickDesktop = sessionStorage.getItem("m_force_desktop") === "1"; } catch {}
    if (stickDesktop) return;

    // Already inside mobile? Nothing to do.
    const initialPath = window.location.hash.replace(/^#/, "").split("?")[0] || "/";
    if (initialPath.startsWith("/m")) return;

    if (isPhoneClass()) {
      const target = MOBILE_ROUTE_MAP[initialPath];
      const rawHash = window.location.hash || "";
      const queryIdx = rawHash.indexOf("?");
      const queryStr = queryIdx >= 0 ? rawHash.slice(queryIdx) : "";
      navigate((target || "/m/home") + queryStr);
    } else {
      // Pin desktop for the rest of the session — guarantees no later
      // re-detection ever flips the user mid-flow.
      try { sessionStorage.setItem("m_force_desktop", "1"); } catch {}
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
        <Route path="/admin/tenants" component={AdminTenants} />
        <Route path="/admin/hq" component={HqShell} />
        <Route path="/admin/t/:slug" component={TenantDetailShell} />
        <Route path="/admin" component={AdminShell} />
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

  if (location.startsWith("/m")) {
    return <MobileApp />;
  }

  return (
    <AuthGate>
      <Switch>
        {/* Public routes — rendered outside AppLayout */}
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        {/* Landing page at root for unauthenticated users */}
        <Route path="/" component={LandingPage} />
        {/* Everything else goes through authenticated layout */}
        <Route>{() => <AuthenticatedRoutes />}</Route>
      </Switch>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <MobileGate />
        <AppRouter />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
