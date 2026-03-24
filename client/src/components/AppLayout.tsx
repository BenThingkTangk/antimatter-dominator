import { Link, useLocation } from "wouter";
import { 
  Atom, Zap, Shield, MessageSquareWarning, TrendingUp, 
  Radar, ChevronLeft, ChevronRight, Moon, Sun
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";

const navItems = [
  { href: "/", icon: Zap, label: "Command Center", description: "Sales dashboard" },
  { href: "/pitch", icon: TrendingUp, label: "Pitch Generator", description: "AI pitch creation" },
  { href: "/objections", icon: MessageSquareWarning, label: "Objection Handler", description: "Counter any pushback" },
  { href: "/market", icon: Shield, label: "Market Intent", description: "Market intelligence" },
  { href: "/prospects", icon: Radar, label: "Prospect Engine", description: "AI prospect scanner" },
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
          className={`flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ${
            collapsed ? "w-16" : "w-64"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Atom className="w-5 h-5 text-primary" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-primary truncate">
                  ANTIMATTER
                </h1>
                <p className="text-[10px] text-sidebar-foreground/60 tracking-widest uppercase">
                  Sales Dominator
                </p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              const linkContent = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
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
          <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={() => setIsDark(!isDark)}
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
              {!collapsed && (isDark ? "Light Mode" : "Dark Mode")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={() => setCollapsed(!collapsed)}
              data-testid="button-collapse-sidebar"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Collapse
                </>
              )}
            </Button>
            <PerplexityAttribution />
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
