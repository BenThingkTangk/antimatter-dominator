import { Link, useLocation } from "wouter";
import { 
  Shield, MessageSquareWarning, TrendingUp, 
  Radar, ChevronLeft, ChevronRight, Moon, Sun, PhoneCall, Megaphone, Brain,
  Menu, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  icon: any;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/pitch", icon: TrendingUp, label: "ATOM Pitch" },
  { href: "/objections", icon: MessageSquareWarning, label: "ATOM Objection Handler" },
  { href: "/market", icon: Shield, label: "ATOM Market Intent" },
  { href: "/prospects", icon: Radar, label: "ATOM Prospect" },
  { href: "/atom-leadgen", icon: PhoneCall, label: "ATOM Lead Gen" },
  { href: "/atom-campaign", icon: Megaphone, label: "ATOM Campaign" },
  { href: "/company-intelligence", icon: Brain, label: "ATOM WarBook" },
];

// ATOM Logo SVG — atomic orbital mark
function AtomLogo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-label="ATOM logo">
      <circle cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <ellipse cx="18" cy="18" rx="10" ry="17" stroke="#4dd9d9" strokeWidth="1.5" fill="none"/>
      <ellipse cx="18" cy="18" rx="17" ry="10" stroke="#4dd9d9" strokeWidth="1.5" fill="none" opacity="0.5"/>
      <circle cx="18" cy="18" r="3" fill="#00c8c8"/>
      <circle cx="18" cy="5" r="2" fill="#00c8c8" opacity="0.7"/>
      <circle cx="18" cy="31" r="2" fill="#00c8c8" opacity="0.4"/>
      <circle cx="5" cy="18" r="2" fill="#00c8c8" opacity="0.4"/>
      <circle cx="31" cy="18" r="2" fill="#00c8c8" opacity="0.7"/>
    </svg>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Ambient accent glow at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 blur-3xl opacity-10 rounded-full translate-y-1/2" style={{ background: "#00989c" }} />

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {!isMobile && collapsed ? (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(0,200,200,0.08)", border: "1px solid rgba(0,200,200,0.18)" }}>
            <AtomLogo size={22} />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="shrink-0">
              <AtomLogo size={32} />
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-lg font-bold tracking-tight leading-none truncate"
                style={{ fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif", color: "#f6f6fd", letterSpacing: "-0.03em" }}
              >
                AT<span style={{ color: "#00c8c8" }}>O</span>M
              </h1>
              <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif" }}>
                Sales Dominator
              </p>
            </div>
            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-auto shrink-0 w-8 h-8 flex items-center justify-center transition-colors rounded-lg"
                style={{ color: "rgba(255,255,255,0.4)" }}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Flat nav — 7 modules */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5" style={{ fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif" }}>
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all rounded-lg ${collapsed && !isMobile ? "justify-center" : ""}`}
              style={isActive ? {
                background: "rgba(0,200,200,0.08)",
                color: "#00c8c8",
                boxShadow: "inset 0 0 12px rgba(0,200,200,0.06)"
              } : {
                color: "rgba(255,255,255,0.45)"
              }}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "#00c8c8" }} />}
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? "#00c8c8" : "rgba(255,255,255,0.3)" }} />
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
        {(!collapsed || isMobile) && (
          <div className="px-3 py-2">
            <p className="text-xs font-light" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif" }}>
              ATOM · Nirmata Holdings · © 2026
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start hover:bg-white/[0.03]"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onClick={() => setIsDark(!isDark)}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4 mr-2 shrink-0" /> : <Moon className="w-4 h-4 mr-2 shrink-0" />}
          {(!collapsed || isMobile) && (isDark ? "Light Mode" : "Dark Mode")}
        </Button>
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-white/[0.03]"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onClick={() => setCollapsed(!collapsed)}
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2 shrink-0" />
                Collapse
              </>
            )}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <aside
          className={`relative hidden md:flex flex-col border-r text-sidebar-foreground transition-all duration-300 overflow-hidden ${
            collapsed ? "w-16" : "w-64"
          }`}
          style={{ background: "#0b0b0c", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <SidebarContent isMobile={false} />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside
              className="absolute left-0 top-0 bottom-0 w-72 flex flex-col border-r text-sidebar-foreground overflow-hidden z-10"
              style={{ background: "#0b0b0c", borderColor: "rgba(255,255,255,0.08)" }}
            >
              <SidebarContent isMobile={true} />
            </aside>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header
            className="flex md:hidden items-center gap-3 h-14 px-4 border-b shrink-0"
            style={{ background: "#0b0b0c", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              className="w-10 h-10 flex items-center justify-center transition-colors rounded-lg hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.6)" }}
              aria-label="Open menu"
              data-testid="button-mobile-menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <AtomLogo size={22} />
                <span
                  className="text-sm font-bold tracking-tight"
                  style={{ fontFamily: "'Cabinet Grotesk', 'Satoshi', Arial, sans-serif", color: "#f6f6fd", letterSpacing: "-0.02em" }}
                >
                  AT<span style={{ color: "#00c8c8" }}>O</span>M
                </span>
              </div>
            </div>
            <div className="w-10" />
          </header>

          {/* Main scrollable content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 md:max-w-[1400px] md:mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
