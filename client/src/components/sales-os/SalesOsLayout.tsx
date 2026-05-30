// SalesOsLayout — app shell for the ATOM Sales OS zones: left SalesOsNav,
// scrollable main, and the persistent AgentActivityDock pinned to the bottom of
// every authenticated page.
import { ReactNode, useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Menu } from "lucide-react";
import { SalesOsNav, SALES_OS_NAV } from "./SalesOsNav";
import { AgentActivityDock } from "./AgentActivityDock";

export function SalesOsLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  useEffect(() => setMobileOpen(false), [location]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0d14" }}>
      <SalesOsNav />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0" style={{ background: "rgba(2,4,8,0.7)" }} onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 overflow-y-auto p-3 z-10"
            style={{ background: "#070a10", borderRight: "1px solid rgba(0,212,255,0.14)" }}
          >
            <p className="px-3 py-3 text-sm font-bold" style={{ color: "#f6f8ff" }}>ATOM Sales OS</p>
            {SALES_OS_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2.5 rounded-xl text-sm"
                style={location === item.href ? { background: "rgba(0,212,255,0.12)", color: "#00d4ff" } : { color: "rgba(246,248,255,0.6)" }}
              >
                {item.label}
              </Link>
            ))}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header
          className="flex md:hidden items-center gap-3 h-14 px-4 shrink-0"
          style={{ background: "#070a10", borderBottom: "1px solid rgba(0,212,255,0.14)" }}
        >
          <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ color: "rgba(246,248,255,0.7)" }} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold" style={{ color: "#f6f8ff" }}>ATOM Sales OS</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>

      <AgentActivityDock />
    </div>
  );
}

export default SalesOsLayout;
