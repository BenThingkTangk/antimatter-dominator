// Shared cinematic UI primitives for the ATOM Sales OS zones.
// Dark base #0a0d14, electric cyan #00d4ff, deep violet #7c3aed,
// glassmorphism cards (rgba(255,255,255,0.04) + blur + 1px low-opacity cyan
// border, radius 12px).
import { ReactNode } from "react";

export const SALES_OS = {
  bg: "#0a0d14",
  cyan: "#00d4ff",
  violet: "#7c3aed",
  glass: "rgba(255,255,255,0.04)",
  border: "rgba(0,212,255,0.18)",
};

/** Full-height page wrapper with the cinematic gradient backdrop. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-full -m-4 md:-m-6 p-4 md:p-8 pb-28"
      style={{
        background:
          "radial-gradient(1200px 600px at 12% -10%, rgba(0,212,255,0.10), transparent 60%)," +
          "radial-gradient(900px 500px at 100% 0%, rgba(124,58,237,0.12), transparent 55%)," +
          SALES_OS.bg,
      }}
    >
      {children}
    </div>
  );
}

/** Glassmorphism card. */
export function GlassCard({
  children,
  className = "",
  glow,
  style,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: SALES_OS.glass,
        border: `1px solid ${SALES_OS.border}`,
        borderRadius: 12,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: glow
          ? "0 0 40px rgba(0,212,255,0.08), inset 0 1px 0 rgba(255,255,255,0.04)"
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Live "ATOM is active" status pill. */
export function AtomActiveStatus() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.18em]"
      style={{
        background: "rgba(52,211,153,0.10)",
        border: "1px solid rgba(52,211,153,0.30)",
        color: "#34d399",
      }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      ATOM is active
    </div>
  );
}

/** Zone hero/header: title, optional subtitle, and the live status indicator. */
export function ZoneHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="relative mb-6 md:mb-8">
      <GlassCard glow className="px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {icon && (
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(0,212,255,0.10)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  color: SALES_OS.cyan,
                }}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && (
                <p
                  className="text-[10px] font-mono uppercase tracking-[0.28em] mb-1"
                  style={{ color: "rgba(0,212,255,0.7)" }}
                >
                  {eyebrow}
                </p>
              )}
              <h1
                className="text-2xl md:text-3xl font-bold tracking-tight"
                style={{ color: "#f6f8ff" }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm" style={{ color: "rgba(246,248,255,0.55)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <AtomActiveStatus />
          </div>
        </div>
      </GlassCard>
    </header>
  );
}

/** Compact metric stat tile. */
export function StatTile({
  label,
  value,
  delta,
  accent = SALES_OS.cyan,
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: string;
}) {
  return (
    <GlassCard className="px-4 py-4">
      <p
        className="text-[10px] font-mono uppercase tracking-[0.2em]"
        style={{ color: "rgba(246,248,255,0.45)" }}
      >
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums" style={{ color: "#f6f8ff" }}>
        {value}
      </p>
      {delta && (
        <p className="mt-0.5 text-xs font-mono" style={{ color: accent }}>
          {delta}
        </p>
      )}
    </GlassCard>
  );
}

export function fmtCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `$${n}`;
}

/** Inline ATOM mark — an orbiting-electron atom glyph in the brand gradient.
 *  Deterministic, dependency-free SVG; scales with `size`. */
export function AtomMark({ size = 28, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="ATOM"
      role="img"
    >
      <defs>
        <linearGradient id="atom-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SALES_OS.cyan} />
          <stop offset="100%" stopColor={SALES_OS.violet} />
        </linearGradient>
      </defs>
      <g
        stroke="url(#atom-mark-grad)"
        strokeWidth="1.8"
        style={
          animate
            ? { transformOrigin: "24px 24px", animation: "atom-spin 9s linear infinite" }
            : undefined
        }
      >
        <ellipse cx="24" cy="24" rx="19" ry="8" />
        <ellipse cx="24" cy="24" rx="19" ry="8" transform="rotate(60 24 24)" />
        <ellipse cx="24" cy="24" rx="19" ry="8" transform="rotate(120 24 24)" />
      </g>
      <circle cx="24" cy="24" r="4" fill="url(#atom-mark-grad)" />
      <style>{`@keyframes atom-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}
