// SalesOsNav — the ATOM Sales OS left sidebar. Five primary zones + system
// routes, cinematic dark glass styling. Uses wouter hash routing like the rest
// of the app.
import { Link, useLocation } from "wouter";
import {
  Crosshair,
  PhoneCall,
  Megaphone,
  Brain,
  TrendingUp,
  ShieldCheck,
  Handshake,
  Activity,
  Boxes,
  Rocket,
  Settings,
  LogOut,
} from "lucide-react";
import { useSessionContext } from "@/auth/AuthGate";

interface NavItem {
  href: string;
  icon: typeof Crosshair;
  label: string;
  group: "ZONES" | "SYSTEM";
}

export const SALES_OS_NAV: NavItem[] = [
  { href: "/pipeline", icon: Crosshair, label: "Pipeline Command", group: "ZONES" },
  { href: "/calls", icon: PhoneCall, label: "Calls", group: "ZONES" },
  { href: "/campaigns", icon: Megaphone, label: "Campaigns", group: "ZONES" },
  { href: "/intel", icon: Brain, label: "Buyer Intel", group: "ZONES" },
  { href: "/revenue", icon: TrendingUp, label: "Revenue", group: "ZONES" },
  { href: "/compliance", icon: ShieldCheck, label: "Compliance Vault", group: "SYSTEM" },
  { href: "/partners", icon: Handshake, label: "Partners", group: "SYSTEM" },
  { href: "/agents", icon: Activity, label: "Agent Activity", group: "SYSTEM" },
  { href: "/xr", icon: Boxes, label: "War Room (XR)", group: "SYSTEM" },
  { href: "/onboarding", icon: Rocket, label: "Onboarding", group: "SYSTEM" },
  { href: "/settings", icon: Settings, label: "Settings", group: "SYSTEM" },
];

const CYAN = "#00d4ff";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      data-testid={`salesos-nav-${item.href.replace("/", "")}`}
      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all"
      style={
        active
          ? {
              background: "rgba(0,212,255,0.10)",
              color: CYAN,
              border: "1px solid rgba(0,212,255,0.28)",
              boxShadow: "inset 0 0 16px rgba(0,212,255,0.10)",
            }
          : { color: "rgba(246,248,255,0.6)", border: "1px solid transparent" }
      }
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
          style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
        />
      )}
      <Icon size={16} className="shrink-0" style={{ color: active ? CYAN : "rgba(246,248,255,0.55)" }} />
      <span className="truncate font-medium">{item.label}</span>
    </Link>
  );
}

export function SalesOsNav() {
  const [location] = useLocation();
  const session = useSessionContext();
  const zones = SALES_OS_NAV.filter((n) => n.group === "ZONES");
  const system = SALES_OS_NAV.filter((n) => n.group === "SYSTEM");

  return (
    <aside
      className="relative hidden md:flex flex-col w-64 shrink-0 border-r overflow-hidden"
      style={{ background: "#070a10", borderColor: "rgba(0,212,255,0.14)" }}
    >
      {/* ambient violet glow */}
      <div
        className="pointer-events-none absolute -top-24 -left-10 w-64 h-64 rounded-full blur-3xl opacity-30"
        style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 blur-3xl opacity-20"
        style={{ background: CYAN }}
      />

      {/* Brand lockup */}
      <div
        className="flex items-center gap-3 px-5 h-16 border-b shrink-0"
        style={{ borderColor: "rgba(0,212,255,0.14)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(124,58,237,0.25))",
            border: "1px solid rgba(0,212,255,0.4)",
            color: "#fff",
          }}
        >
          A
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-tight leading-none" style={{ color: "#f6f8ff" }}>
            ATOM Sales OS
          </h1>
          <p
            className="text-[9px] font-mono uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(0,212,255,0.7)" }}
          >
            Autonomous Revenue
          </p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <p
          className="px-3 mb-2 text-[9px] font-mono uppercase tracking-[0.28em]"
          style={{ color: "rgba(246,248,255,0.35)" }}
        >
          Zones
        </p>
        <div className="space-y-1">
          {zones.map((item) => (
            <NavLink key={item.href} item={item} active={location === item.href} />
          ))}
        </div>

        <p
          className="px-3 mt-6 mb-2 text-[9px] font-mono uppercase tracking-[0.28em]"
          style={{ color: "rgba(246,248,255,0.35)" }}
        >
          System
        </p>
        <div className="space-y-1">
          {system.map((item) => (
            <NavLink key={item.href} item={item} active={location === item.href} />
          ))}
        </div>
      </nav>

      {/* Footer / user */}
      <div className="relative border-t p-3 shrink-0" style={{ borderColor: "rgba(0,212,255,0.14)" }}>
        {session.user ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(0,212,255,0.18)", color: CYAN }}
            >
              {session.user.fullName?.charAt(0)?.toUpperCase() ||
                session.user.email?.charAt(0)?.toUpperCase() ||
                "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate" style={{ color: "#f6f8ff" }}>
                {session.user.fullName || session.user.email}
              </p>
              <p className="text-[10px] font-mono uppercase tracking-[0.16em]" style={{ color: "rgba(246,248,255,0.4)" }}>
                ATOM Sales OS
              </p>
            </div>
            <button
              onClick={async () => {
                await session.logout();
                window.location.hash = "#/login";
                window.location.reload();
              }}
              aria-label="Sign out"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/5"
              style={{ color: "rgba(246,248,255,0.5)" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <a
            href="/#/login"
            className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] rounded-xl"
            style={{ color: CYAN }}
          >
            <LogOut size={16} /> Sign In
          </a>
        )}
      </div>
    </aside>
  );
}

export default SalesOsNav;
