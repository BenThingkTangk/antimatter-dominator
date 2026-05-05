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
import NotFound from "./pages/not-found";
import { useTenant } from "./lib/useTenant";
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
  const touch = matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= 820;
  const iphoneLike = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return (touch && narrow) || iphoneLike;
}

/**
 * MobileGate — on first paint, if this is a phone AND the URL is at the
 * root, redirect to /m/home. Users can still get to desktop via
 * "?desktop=1" or by hitting a non-mobile route directly.
 */
function MobileGate() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    const url = new URL(window.location.href);
    const forceDesktop = url.searchParams.get("desktop") === "1";
    if (forceDesktop) {
      try { sessionStorage.setItem("m_force_desktop", "1"); } catch {}
      return;
    }
    let stickDesktop = false;
    try { stickDesktop = sessionStorage.getItem("m_force_desktop") === "1"; } catch {}
    if (stickDesktop) return;
    if (location.startsWith("/m")) return;
    if (isPhoneClass()) navigate("/m/home");
  }, [location, navigate]);
  return null;
}

function AppRouter() {
  // Resolve tenant on first paint (shared between mobile + desktop).
  useTenant();
  const [location] = useLocation();

  if (location.startsWith("/m")) {
    return <MobileApp />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/"><Redirect to="/pitch" /></Route>
        <Route path="/pitch" component={PitchGenerator} />
        <Route path="/objections" component={ObjectionHandler} />
        <Route path="/market" component={MarketIntent} />
        <Route path="/prospects" component={ProspectEngine} />
        <Route path="/atom-leadgen" component={AtomLeadGen} />
        <Route path="/atom-campaign" component={AtomCampaign} />
        <Route path="/company-intelligence" component={CompanyIntelligence} />
        <Route path="/war-room" component={AtomWarRoom} />
        <Route path="/admin/tenants" component={AdminTenants} />
        <Route component={NotFound} />
      </Switch>
      {/* Floating ATOM Chat — visible on every desktop page, route-aware context */}
      <AtomChat />
    </AppLayout>
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
