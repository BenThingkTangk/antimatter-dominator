/**
 * MobileShell — top bar + bottom tab bar + content slot.
 *
 * Renders the fixed chrome (safe-area aware) around every mobile route.
 * Uses wouter hash routing so tab links work cleanly (#/m/home, #/m/dial …).
 */
import { Link, useLocation } from "wouter";
import { Home, PhoneCall, Users, MessageSquare, Settings as SettingsIcon, Moon } from "lucide-react";
import { AtomOrbit } from "./AtomOrbit";
import { useTenant } from "../lib/useTenant";

const TABS = [
  { href: "/m/home",   label: "Home",    icon: Home },
  { href: "/m/dial",   label: "Dial",    icon: PhoneCall },
  { href: "/m/leads",  label: "Leads",   icon: Users },
  { href: "/m/chat",   label: "Chat",    icon: MessageSquare },
  { href: "/m/settings", label: "More",  icon: SettingsIcon },
] as const;

export function MobileShell({ children, title, right }: { children: React.ReactNode; title?: string; right?: React.ReactNode }) {
  const [location] = useLocation();
  const { tenant } = useTenant();

  return (
    <>
      {/* Top bar */}
      <div className="m-topbar">
        <div className="m-topbar-title">
          <AtomOrbit size={30} />
          {title ? <span>{title}</span> : <span>AT<span className="m-o">O</span>M</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tenant?.name && tenant.name !== "AntimatterAI" ? (
            <span className="m-pill" style={{ textTransform: "none", letterSpacing: "0.04em" }}>
              {tenant.name}
            </span>
          ) : null}
          {right ?? (
            <Link href="/m/settings" className="m-icon-btn" aria-label="Settings">
              <Moon size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="m-scroll">{children}</div>

      {/* Bottom tab bar */}
      <nav className="m-tabbar" aria-label="Primary">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = location.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={`m-tab${active ? " is-active" : ""}`}>
              <Icon />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
