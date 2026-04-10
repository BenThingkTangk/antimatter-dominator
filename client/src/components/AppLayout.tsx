import { Link, useLocation } from "wouter";
import { 
  Zap, Shield, MessageSquareWarning, TrendingUp, 
  Radar, ChevronLeft, ChevronRight, Moon, Sun, PhoneCall, Megaphone, Brain
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { href: "/", icon: Zap, label: "Command Center", description: "Sales dashboard", beta: false },
  { href: "/pitch", icon: TrendingUp, label: "Pitch Generator", description: "AI pitch creation", beta: false },
  { href: "/objections", icon: MessageSquareWarning, label: "Objection Handler", description: "Counter any pushback", beta: false },
  { href: "/market", icon: Shield, label: "Market Intent", description: "Market intelligence", beta: false },
  { href: "/prospects", icon: Radar, label: "Prospect Engine", description: "AI prospect scanner", beta: false },
  { href: "/atom-leadgen", icon: PhoneCall, label: "ATOM Lead Gen", description: "AI voice cold caller", beta: false },
  { href: "/atom-campaign", icon: Megaphone, label: "ATOM Campaign", description: "Voice campaign engine", beta: false },
  { href: "/company-intelligence", icon: Brain, label: "Company Intel", description: "RAG company intelligence", beta: false },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <aside
          className={`relative flex flex-col border-r border-sidebar-border bg-[#020202] text-sidebar-foreground transition-all duration-300 overflow-hidden ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          {/* Ambient purple glow at bottom */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 bg-[#3e3f7e] blur-3xl opacity-20 rounded-full translate-y-1/2" />

          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
            {collapsed ? (
              /* Collapsed: show "A" lettermark */
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#696aac]/15 border border-[#696aac]/20">
                <span className="text-[#a2a3e9] font-light text-base leading-none">A</span>
              </div>
            ) : (
              /* Expanded: show ANTIMATTER AI wordmark + glow dot */
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[#696aac]" style={{ boxShadow: "0 0 8px #696aac, 0 0 16px rgba(105,106,172,0.4)" }} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-light tracking-tight text-[#f6f6fd] truncate leading-none">
                    ANTIMATTER AI
                  </h1>
                  <p className="text-[10px] text-foreground/30 tracking-widest uppercase mt-0.5">
                    Sales Dominator
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;

              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-lg ${
                    isActive
                      ? "bg-[#696aac]/10 text-[#a2a3e9] border-l-2 border-[#696aac] pl-[10px]"
                      : "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.03] border-l-2 border-transparent pl-[10px]"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[#a2a3e9]" : "text-foreground/40"
                    }`}
                  />
                  {!collapsed && (
                    <span className="truncate min-w-0 font-normal">
                      {item.label}
                    </span>
                  )}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return linkContent;
            })}
          </nav>

          {/* Footer */}
          <div className="relative border-t border-sidebar-border p-2 space-y-1 shrink-0">
            {!collapsed && (
              <div className="px-3 py-2">
                <p className="text-xs text-foreground/40 font-light">Antimatter AI</p>
                <p className="text-[10px] text-foreground/25 tracking-wide">Atlanta, GA</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.03]"
              onClick={() => setIsDark(!isDark)}
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="w-4 h-4 mr-2 shrink-0" /> : <Moon className="w-4 h-4 mr-2 shrink-0" />}
              {!collapsed && (isDark ? "Light Mode" : "Dark Mode")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.03]"
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
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
