import { Link, useLocation } from "wouter";
import { useTenant } from "@/lib/useTenant";
import {
  Shield, MessageSquareWarning, TrendingUp,
  Radar, ChevronLeft, ChevronRight, PhoneCall, Brain,
  Menu, X, Swords, Settings, LogOut, User, Crown, Building2, Zap, CreditCard, Coins, ListChecks
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionContext } from "../auth/AuthGate";
import { useEffectiveSession, ViewAsToggle } from "../auth/ViewAs";
import { DtomLogo } from "@nirmata/atom-design-system/react";

interface NavItem { href: string; icon: any; label: string; }

const navItems: NavItem[] = [
  { href: "/war-room", icon: Swords, label: "ΔTOM War Room" },
  { href: "/pitch", icon: TrendingUp, label: "ΔTOM Pitch" },
  { href: "/objections", icon: MessageSquareWarning, label: "ΔTOM Objection Handler" },
  { href: "/market", icon: Shield, label: "ΔTOM Market Intent" },
  { href: "/prospects", icon: Radar, label: "ΔTOM Prospect" },
  { href: "/atom-leadgen", icon: PhoneCall, label: "ΔTOM Lead Gen" },
  { href: "/campaigns", icon: ListChecks, label: "ΔTOM Campaigns" },
  { href: "/company-intelligence", icon: Brain, label: "ΔTOM WarBook" },
];

// ΔTOM canonical logo — sourced from @nirmata/atom-design-system/react.
// Counter-clockwise SVG orbital mark + ΔT[O]M wordmark, teal accent on the O.
// The legacy local AtomLogo SVG is retained ONLY for the collapsed-sidebar
// fallback because DtomLogo wraps in an <a>, which we don't want for the
// collapsed icon-only state. We render the same SVG inline there.
function CollapsedAtomMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="atom-mark"
      style={{ ['--logo-size' as any]: `${size}px`, width: size, height: size }}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // Theme is locked dark-first per brand bible — no toggle, no state.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Use the EFFECTIVE session everywhere the sidebar / RBAC decisions are
  // made. When the real super-admin flips the View-As toggle, `session`
  // here returns `isSuperAdmin: false` and the Nirmata HQ / Seat Costs /
  // Vibranium GA / Billing / System Control entries disappear from the
  // sidebar exactly like a manager / rep would experience.
  const session = useEffectiveSession();
  const { tenant } = useTenant();
  const isCustomBrand = !!tenant?.slug && tenant.slug !== "antimatter" && tenant.name !== "AntimatterAI";
  const tenantLogo = isCustomBrand && tenant.logo_url ? tenant.logo_url : null;

  // Detect preview mode — super admin viewing a tenant via ?tenant=<slug>
  const previewSlug = (() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("tenant") || url.searchParams.get("tenantSlug") || null;
    } catch {}
    return null;
  })();

  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Build dynamic nav items.
  // Visual: the eight product modules are the headline list (matches the
  // reference ATOM build sidebar). Super-admin platform surfaces (Nirmata
  // HQ, Seat Costs, Vibranium GA, Billing, System Control) are grouped
  // under a separate "PLATFORM" section below the modules so they remain
  // one-click reachable without competing visually with day-to-day weapons.
  const visibleNavItems = session.role === "rep"
    ? navItems.filter(n =>
        n.href !== "/war-room" &&
        n.href !== "/company-intelligence"
      )
    : navItems;
  const dynamicNavItems: NavItem[] = [...visibleNavItems];

  // Super-admin only platform/admin entries. Kept here so the surface still
  // exists; rendered as a separate group beneath the main modules.
  const adminNavItems: NavItem[] = [];
  if (session.isSuperAdmin) {
    adminNavItems.push({ href: "/admin/hq", icon: Crown, label: "Nirmata HQ" });
    adminNavItems.push({ href: "/admin/hq/seat-costs", icon: Coins, label: "Seat Costs" });
    adminNavItems.push({ href: "/admin/vibranium-ga", icon: Zap, label: "Vibranium GA" });
    adminNavItems.push({ href: "/billing", icon: CreditCard, label: "Billing & Plan" });
    adminNavItems.push({ href: "/admin", icon: Building2, label: "ΔTOM System Control" });
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Ambient teal plasma glow at bottom — ATOM signature */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 blur-3xl opacity-[0.18] rounded-full translate-y-1/2"
        style={{ background: "var(--color-primary)" }}
      />

      {/* Logo — tenant-branded when present, otherwise ATOM canonical lockup */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
        {!isMobile && collapsed ? (
          <div className="w-9 h-9 flex items-center justify-center shrink-0 overflow-hidden">
            {tenantLogo ? (
              <img src={tenantLogo} alt={tenant.name} className="w-full h-full object-contain" />
            ) : (
              <CollapsedAtomMark size={26} />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {isCustomBrand ? (
              <>
                <div className="shrink-0" style={{ width: 32, height: 32 }}>
                  {tenantLogo ? (
                    <img src={tenantLogo} alt={tenant.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <CollapsedAtomMark size={32} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1
                    className="text-base font-bold leading-tight truncate"
                    style={{ color: "var(--color-text)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}
                  >
                    {tenant.name}
                  </h1>
                  <p
                    className="text-[10px] tracking-[0.18em] uppercase mt-0.5"
                    style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
                  >
                    Powered by ΔTOM
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                {/* Canonical ΔTOM wordmark per brand spec — wordmark only, no orbital icon */}
                <DtomLogo size="md" showIcon={false} showWordmark={true} ariaLabel="ΔTOM home" />
                <p
                  className="text-[9px] tracking-[0.22em] uppercase"
                  style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginLeft: 2 }}
                >
                  Sales Dominator
                </p>
              </div>
            )}
            {isMobile && (
              <button onClick={() => setMobileOpen(false)} className="ml-auto shrink-0 w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--color-text-muted)" }} aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Flat nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        {dynamicNavItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all rounded-lg ${collapsed && !isMobile ? "justify-center" : ""}`}
              style={isActive ? {
                background: "color-mix(in oklab, var(--color-primary) 8%, transparent)",
                color: "var(--color-primary)",
                boxShadow: "inset 0 0 12px color-mix(in oklab, var(--color-primary) 8%, transparent)"
              } : {
                color: "var(--color-text-muted)"
              }}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary-glow)" }} />}
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }} />
              {(!collapsed || isMobile) && <span className="truncate min-w-0 font-medium">{item.label}</span>}
            </Link>
          );
          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{linkContent}</div>;
        })}

        {/* Platform / admin (super-admin only) — visually separated so the
           main 8 weapons match the reference ATOM build sidebar. */}
        {adminNavItems.length > 0 && (
          <>
            <div
              className="mt-4 mb-1 px-3 text-[10px] tracking-[0.22em] uppercase"
              style={{
                color: "rgba(255,255,255,0.35)",
                display: collapsed && !isMobile ? "none" : "block",
              }}
            >
              Platform
            </div>
            {!collapsed || isMobile ? null : (
              <div className="my-2 mx-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            )}
            {adminNavItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all rounded-lg ${collapsed && !isMobile ? "justify-center" : ""}`}
                  style={isActive ? {
                    background: "color-mix(in oklab, var(--color-primary) 8%, transparent)",
                    color: "var(--color-primary)",
                    boxShadow: "inset 0 0 12px color-mix(in oklab, var(--color-primary) 8%, transparent)"
                  } : {
                    color: "rgba(255,255,255,0.40)"
                  }}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "var(--color-primary)", boxShadow: "0 0 8px var(--color-primary-glow)" }} />}
                  <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? "var(--color-primary)" : "rgba(255,255,255,0.40)" }} />
                  {(!collapsed || isMobile) && <span className="truncate min-w-0 font-medium">{item.label}</span>}
                </Link>
              );
              if (collapsed && !isMobile) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }
              return <div key={item.href}>{linkContent}</div>;
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="relative border-t p-2 space-y-1 shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {/* User info / auth actions */}
        {session.user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-all"
              style={{ color: "var(--color-text-muted)" }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "color-mix(in oklab, var(--color-primary) 20%, transparent)", color: "var(--color-primary)" }}>
                {session.user.fullName?.charAt(0)?.toUpperCase() || session.user.email?.charAt(0)?.toUpperCase() || "?"}
              </div>
              {(!collapsed || isMobile) && (
                <div className="min-w-0 text-left flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>
                    {session.user.fullName || session.user.email}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: "var(--color-text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    ΔTOM
                  </p>
                </div>
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full left-2 right-2 mb-1 z-40 rounded-xl overflow-hidden" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-lg)" }}>
                  <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/[0.04] transition-all" style={{ color: "var(--color-text-muted)" }}>
                    <User className="w-3.5 h-3.5" /> Profile
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/[0.04] transition-all" style={{ color: "var(--color-text-muted)" }}>
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                  <div style={{ height: 1, background: "var(--color-border)" }} />
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await session.logout();
                      window.location.hash = "#/login";
                      window.location.reload();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/[0.04] transition-all"
                    style={{ color: "var(--color-error)" }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <a
            href="/#/login"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] rounded-lg hover:bg-white/[0.03] transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(!collapsed || isMobile) && <span className="font-medium">Sign In</span>}
          </a>
        )}

        {(!collapsed || isMobile) && (
          <div className="px-3 py-2">
            <p className="text-xs font-light" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              ΔTOM · Nirmata Holdings · © 2026
            </p>
          </div>
        )}
        {/* Light/Dark toggle removed — ΔTOM is dark-first per the brand bible. */}
        {!isMobile && (
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start hover:bg-white/[0.03]"
            style={{ color: "rgba(255,255,255,0.55)" }}
            onClick={() => setCollapsed(!collapsed)}
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <><ChevronLeft className="w-4 h-4 mr-2 shrink-0" />Collapse</>}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className="atom-app-shell flex h-screen overflow-hidden bg-background">
        <aside
          className={`relative hidden md:flex flex-col border-r text-sidebar-foreground transition-all duration-300 overflow-hidden ${collapsed ? "w-16" : "w-64"}`}
          style={{ background: "#08080c", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <SidebarContent isMobile={false} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col border-r text-sidebar-foreground overflow-hidden z-10" style={{ background: "#08080c", borderColor: "rgba(255,255,255,0.08)" }}>
              <SidebarContent isMobile={true} />
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {previewSlug && (
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0"
              style={{
                background: "color-mix(in oklab, var(--color-primary) 14%, transparent)",
                borderColor: "color-mix(in oklab, var(--color-primary) 32%, transparent)",
                color: "#0c1014",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                  style={{ background: "#0c1014", color: "var(--color-primary)" }}
                >Preview as tenant</span>
                <span className="text-sm font-bold truncate" style={{ color: "#0c1014" }}>
                  Viewing as <code style={{ fontFamily: "var(--font-mono)" }}>{previewSlug}</code> · they would see this exactly
                </span>
              </div>
              <a
                href="#/admin?tab=tenants"
                className="text-xs font-mono font-bold underline"
                style={{ color: "#0c1014" }}
              >
                Exit preview →
              </a>
            </div>
          )}
          <header className="flex md:hidden items-center gap-3 h-14 px-4 border-b shrink-0" style={{ background: "var(--color-bg-2)", borderColor: "var(--color-border)" }}>
            <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "var(--color-text-muted)" }} aria-label="Open menu" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <DtomLogo size="sm" showIcon={false} showWordmark={true} ariaLabel="ΔTOM home" />
            </div>
            <div className="w-10" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 md:max-w-[1400px] md:mx-auto">{children}</div>
          </main>
        </div>
      </div>
      {/* View-As preview affordance — floating pill, no top banner */}
      <ViewAsToggle />
    </TooltipProvider>
  );
}
