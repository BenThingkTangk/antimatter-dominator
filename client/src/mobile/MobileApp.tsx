/**
 * MobileApp — root for the mobile route group.
 *
 * Owns:
 *   - the .atom-mobile-root wrapper (CSS scope)
 *   - the BootScreen on first paint of the mobile experience (per-session)
 *   - tenant resolution (shared with desktop)
 *   - sub-routes: /m/home, /m/dial, /m/leads, /m/chat, /m/settings, /m/admin
 */
import { useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { BootScreen } from "./BootScreen";
import { useTenant } from "../lib/useTenant";
import MobileHome from "./pages/MobileHome";
import MobileDial from "./pages/MobileDial";
import MobileLeads from "./pages/MobileLeads";
import MobileChat from "./pages/MobileChat";
import MobileSettings from "./pages/MobileSettings";
import MobileAdmin from "./pages/MobileAdmin";

const BOOT_KEY = "m_boot_done_v1";

export default function MobileApp() {
  // Mobile shares the same tenant resolver as desktop
  useTenant();

  const [booted, setBooted] = useState<boolean>(() => {
    try { return sessionStorage.getItem(BOOT_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (booted) {
      try { sessionStorage.setItem(BOOT_KEY, "1"); } catch {}
    }
  }, [booted]);

  // Lock body scroll while mobile shell is mounted (desktop layout
  // appears on the same page in some scenarios — keep them separated).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="atom-mobile-root">
      {!booted && <BootScreen onDone={() => setBooted(true)} />}

      <Switch>
        <Route path="/m"><Redirect to="/m/home" /></Route>
        <Route path="/m/home"     component={MobileHome} />
        <Route path="/m/dial"     component={MobileDial} />
        <Route path="/m/leads"    component={MobileLeads} />
        <Route path="/m/chat"     component={MobileChat} />
        <Route path="/m/settings" component={MobileSettings} />
        <Route path="/m/admin"    component={MobileAdmin} />
        <Route><Redirect to="/m/home" /></Route>
      </Switch>
    </div>
  );
}
