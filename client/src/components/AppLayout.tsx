import { Link, useLocation } from "wouter";
import {
  Shield, MessageSquareWarning, TrendingUp,
  Radar, ChevronLeft, ChevronRight, Moon, Sun, PhoneCall, Megaphone, Brain,
  Menu, X, Swords, Settings, LogOut, User, Crown, Building2
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSessionContext } from "../auth/AuthGate";

interface NavItem { href: string; icon: any; label: string; }

const navItems: NavItem[] = [
  { href: "/war-room", icon: Swords, label: "ΔTOM War Room" },
  { href: "/pitch", icon: TrendingUp, label: "ΔTOM Pitch" },
  { href: "/objections", icon: MessageSquareWarning, label: "ΔTOM Objection Handler" },
  { href: "/market", icon: Shield, label: "ΔTOM Market Intent" },
  { href: "/prospects", icon: Radar, label: "ΔTOM Prospect" },
  { href: "/atom-leadgen", icon: PhoneCall, label: "ΔTOM Lead Gen" },
  { href: "/atom-campaign", icon: Megaphone, label: "ΔTOM Campaign" },
  { href: "/company-intelligence", icon: Brain, label: "ΔTOM WarBook" },
];

// ATOM canonical logo — v2.0 Cinematic Systems Edition
// Counter-clockwise atomic orbit mark (teal plasma) per the ATOM Brand &
// Design System Configuration Standards. The mark spins left, the nucleus
// pulses, and the electrons flicker. CSS controls all motion (so reduced-
// motion preference is respected automatically).
function AtomLogo({ size = 42 }: { size?: number }) {
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

/** ATOM lockup — mark + wordmark (with the O glowing). Per spec. */
function AtomLockup({ markSize = 36 }: { markSize?: number }) {
  return (
    <a href="/" className="atom-logo" aria-label="ATOM home" style={{ ['--logo-size' as any]: `${markSize}px` }}>
      <AtomLogo size={markSize} />
      <span className="atom-wordmark">ΔT<span>O</span>M</span>
    </a>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useSessionContext();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Build dynamic nav items
  const dynamicNavItems: NavItem[] = [];

  // Nirmata HQ at the very top for superAdmins
  if (session.isSuperAdmin) {
    dynamicNavItems.push({ href: "/admin/hq", icon: Crown, label: "Nirmata HQ" });
  }

  // All standard items
  dynamicNavItems.push(...navItems);

  // ATOM System Control below WarBook for admins/superAdmins
  if (session.role === "admin" || session.isSuperAdmin) {
    dynamicNavItems.push({ href: "/admin", icon: Building2, label: "ATOM System Control" });
  }

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Ambient teal plasma glow at bottom — ATOM signature */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 blur-3xl opacity-[0.18] rounded-full translate-y-1/2"
        style={{ background: "var(--color-primary)" }}
      />

      {/* Logo — ATOM canonical lockup (animated atomic orbit + AT[O]M wordmark) */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
        {!isMobile && collapsed ? (
          <div className="w-9 h-9 flex items-center justify-center shrink-0">
            <AtomLogo size={26} />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="shrink-0"><AtomLogo size={32} /></div>
            <div className="min-w-0 flex-1">
              <h1
                className="atom-wordmark text-lg leading-none truncate"
                style={{ color: "var(--color-text)" }}
              >
                ΔT<span>O</span>M
              </h1>
              <p
                className="text-[10px] tracking-[0.18em] uppercase mt-0.5"
                style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}
              >
                Sales Dominator
              </p>
            </div>
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
                  <p className="text-[10px] truncate" style={{ color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
                    {session.tenant?.name || ""}
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
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start hover:bg-white/[0.03]"
          style={{ color: "rgba(255,255,255,0.55)" }}
          onClick={() => setIsDark(!isDark)}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4 mr-2 shrink-0" /> : <Moon className="w-4 h-4 mr-2 shrink-0" />}
          {(!collapsed || isMobile) && (isDark ? "Light Mode" : "Dark Mode")}
        </Button>
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
      <div className="flex h-screen overflow-hidden bg-background">
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
          <header className="flex md:hidden items-center gap-3 h-14 px-4 border-b shrink-0" style={{ background: "var(--color-bg-2)", borderColor: "var(--color-border)" }}>
            <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "var(--color-text-muted)" }} aria-label="Open menu" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <AtomLogo size={22} />
                <span className="atom-wordmark text-sm leading-none" style={{ color: "var(--color-text)" }}>
                  ΔT<span>O</span>M
                </span>
              </div>
            </div>
            <div className="w-10" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 md:max-w-[1400px] md:mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
