/**
 * ΔTOM Brand / Experience System — V4
 * Lightweight, dependency-free React components.
 *
 * Canonical visual: black/dark field, cyan multi-orbit atom with glowing
 * nucleus, ΔTOM wordmark (Δ/T/M white, O cyan). Brand cyan #39BFC0.
 *
 * Hard brand rule: the visual branded wordmark is ΔTOM (Greek Delta),
 * never Latin "ATOM". Use ATOM only as product-family prose.
 *
 * Import the stylesheet once at app root:
 *   import "@nirmata/atom-v4-brand-system/css/atom-v4.css";
 *
 * @nirmata/atom-v4-brand-system 4.0.0
 */
import * as React from "react";

export const ATOM_CYAN = "#39BFC0";
const NUCLEUS_STOPS: Array<[string, string, number]> = [
  ["0%", "#ffffff", 1],
  ["35%", "#c8f3f3", 1],
  ["65%", "#39bfc0", 0.95],
  ["100%", "#39bfc0", 0],
];

let _gid = 0;
const useId = (p: string) => React.useMemo(() => `${p}-${++_gid}`, [p]);

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
};

/* ----------------------------------------------------------------
 * ATOMV4Orbital — the canonical orbital mark (animated by default).
 * ---------------------------------------------------------------- */
export interface OrbitalProps {
  size?: number;
  animate?: boolean;
  emissive?: boolean; // adds VR-safe glow
  title?: string;
}
export const ATOMV4Orbital: React.FC<OrbitalProps> = ({
  size = 120, animate = true, emissive = false, title = "ΔTOM orbital mark",
}) => {
  const id = useId("atom-nuc");
  const reduced = usePrefersReducedMotion();
  const spin = animate && !reduced;
  return (
    <svg
      width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title}
      className={`atom-orbit${emissive ? " atom-vr-emissive" : ""}`}
    >
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          {NUCLEUS_STOPS.map(([o, c, op], i) => (
            <stop key={i} offset={o} stopColor={c} stopOpacity={op} />
          ))}
        </radialGradient>
      </defs>
      <g
        className={spin ? "orbits" : undefined}
        fill="none" stroke={ATOM_CYAN} strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        {[0, 60, 120].map((deg) => (
          <ellipse key={deg} cx={60} cy={60} rx={46} ry={17}
            transform={deg ? `rotate(${deg} 60 60)` : undefined} />
        ))}
      </g>
      <g className={spin ? "nucleus" : undefined}>
        <circle cx={60} cy={60} r={8} fill={`url(#${id})`} />
        <circle cx={60} cy={60} r={2.2} fill="#ffffff" />
      </g>
    </svg>
  );
};

/* ----------------------------------------------------------------
 * ATOMV4Wordmark — Δ T O M as inline SVG (Δ/T/M white, O cyan).
 * ---------------------------------------------------------------- */
export const ATOMV4Wordmark: React.FC<{ height?: number; title?: string }> = ({
  height = 40, title = "ΔTOM wordmark",
}) => (
  <svg height={height} viewBox="0 0 820 220" role="img" aria-label={title} style={{ display: "block" }}>
    <path d="M 96 26 L 192 194 L 0 194 Z M 96 84 L 146 178 L 46 178 Z" fill="#fff" fillRule="evenodd" />
    <path d="M 218 26 H 388 V 56 H 320 V 194 H 286 V 56 H 218 Z" fill="#fff" />
    <circle cx={498} cy={110} r={74} fill="none" stroke={ATOM_CYAN} strokeWidth={24} />
    <path d="M 614 194 V 26 H 646 L 710 168 L 774 26 H 806 V 194 H 774 V 96 L 722 194 H 698 L 646 96 V 194 Z" fill="#fff" />
  </svg>
);

/* ----------------------------------------------------------------
 * ATOMV4Lockup — orbital icon + ΔTOM wordmark on one cap height.
 * Sizing: nav 28–34px, loader 220–320px, hero ≤ 420px.
 * ---------------------------------------------------------------- */
export interface LockupProps {
  variant?: "nav" | "loader" | "hero";
  height?: number;          // explicit override
  animate?: boolean;
}
const VARIANT_HEIGHT: Record<NonNullable<LockupProps["variant"]>, number> = {
  nav: 30, loader: 56, hero: 84,
};
export const ATOMV4Lockup: React.FC<LockupProps> = ({
  variant = "nav", height, animate = variant !== "nav",
}) => {
  const h = height ?? VARIANT_HEIGHT[variant];
  const id = useId("atom-lk-nuc");
  const reduced = usePrefersReducedMotion();
  const spin = animate && !reduced;
  return (
    <svg height={h} viewBox="0 0 1080 220" role="img" aria-label="ΔTOM" style={{ display: "block" }}>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          {NUCLEUS_STOPS.map(([o, c, op], i) => (
            <stop key={i} offset={o} stopColor={c} stopOpacity={op} />
          ))}
        </radialGradient>
      </defs>
      <g className={spin ? "orbits" : undefined} fill="none" stroke={ATOM_CYAN}
         strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        {[0, 60, 120].map((deg) => (
          <ellipse key={deg} cx={110} cy={110} rx={80} ry={30}
            transform={deg ? `rotate(${deg} 110 110)` : undefined} />
        ))}
      </g>
      <g className={spin ? "nucleus" : undefined}>
        <circle cx={110} cy={110} r={14} fill={`url(#${id})`} />
        <circle cx={110} cy={110} r={3.6} fill="#fff" />
      </g>
      <g transform="translate(260,0)">
        <path d="M 96 26 L 192 194 L 0 194 Z M 96 84 L 146 178 L 46 178 Z" fill="#fff" fillRule="evenodd" />
        <path d="M 218 26 H 388 V 56 H 320 V 194 H 286 V 56 H 218 Z" fill="#fff" />
        <circle cx={498} cy={110} r={74} fill="none" stroke={ATOM_CYAN} strokeWidth={24} />
        <path d="M 614 194 V 26 H 646 L 710 168 L 774 26 H 806 V 194 H 774 V 96 L 722 194 H 698 L 646 96 V 194 Z" fill="#fff" />
      </g>
    </svg>
  );
};

/* ----------------------------------------------------------------
 * ATOMV4Loader — splash with sweeping progress line.
 * ---------------------------------------------------------------- */
export const ATOMV4Loader: React.FC<{ caption?: string; lockup?: boolean }> = ({
  caption = "Initializing ΔTOM", lockup = false,
}) => (
  <div className="atom-loader">
    {lockup ? <ATOMV4Lockup variant="loader" animate /> : <ATOMV4Orbital size={120} />}
    <div className="atom-loader__bar"><i /></div>
    <span className="atom-loader__caption">{caption}</span>
  </div>
);

/* ----------------------------------------------------------------
 * ATOMV4Hero — marketing hero block.
 * ---------------------------------------------------------------- */
export const ATOMV4Hero: React.FC<{
  headline: React.ReactNode; sub?: React.ReactNode; cta?: React.ReactNode;
}> = ({ headline, sub, cta }) => (
  <header className="hero atom-field" style={{ textAlign: "center" }}>
    <div className="atom-grid-overlay" />
    <div className="atom-lockup atom-lockup--hero atom-vr-emissive">
      <ATOMV4Lockup variant="hero" animate />
    </div>
    <h1 style={{ marginTop: 28, fontWeight: 900 }}>{headline}</h1>
    {sub && <p className="lead" style={{ marginInline: "auto" }}>{sub}</p>}
    {cta && <div style={{ marginTop: 28 }}>{cta}</div>}
  </header>
);

/* ----------------------------------------------------------------
 * ATOMV4AppShell — sidebar + topbar product chrome.
 * ---------------------------------------------------------------- */
export const ATOMV4AppShell: React.FC<{
  nav: Array<{ label: string; active?: boolean }>;
  title?: string;
  children?: React.ReactNode;
}> = ({ nav, title = "Overview", children }) => (
  <div className="atom-appshell atom-panel" style={{ overflow: "hidden" }}>
    <aside className="atom-appshell__nav">
      <div style={{ marginBottom: 22 }}><ATOMV4Lockup variant="nav" height={28} animate={false} /></div>
      {nav.map((n) => (
        <div key={n.label} className={`atom-navitem${n.active ? " atom-navitem--active" : ""}`}>{n.label}</div>
      ))}
    </aside>
    <div>
      <div className="atom-appshell__topbar">
        <strong style={{ color: "#fff" }}>{title}</strong>
        <span className="atom-chip">Live</span>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

/* ----------------------------------------------------------------
 * ATOMV4MobileSplash — phone-framed splash screen.
 * ---------------------------------------------------------------- */
export const ATOMV4MobileSplash: React.FC<{ caption?: string }> = ({
  caption = "Spatial · Agent · Cloud",
}) => (
  <div className="atom-phone">
    <div className="atom-phone__notch" />
    <div className="atom-phone__splash atom-vr-field">
      <ATOMV4Orbital size={96} />
      <ATOMV4Wordmark height={30} />
      <span className="atom-loader__caption">{caption}</span>
    </div>
  </div>
);

/* ----------------------------------------------------------------
 * ATOMV4VRPanel — world-space dark-glass panel for Meta/Oculus/WebXR.
 * Render as a texture on a world quad (~0.8m wide @ ~1.5m).
 * `aspect` keeps a 2:1 plate by default.
 * ---------------------------------------------------------------- */
export const ATOMV4VRPanel: React.FC<{
  label?: React.ReactNode;
  children?: React.ReactNode;
  width?: number;
}> = ({ label, children, width = 640 }) => (
  <div className="atom-vr-panel" style={{ width, padding: 28 }}>
    <div className="atom-vr-foveal">
      <div className="atom-vr-emissive" style={{ display: "inline-block" }}>
        <ATOMV4Lockup variant="loader" height={48} animate />
      </div>
      {label && <div className="atom-vr-safe-text" style={{ marginTop: 14 }}>{label}</div>}
      {children}
    </div>
  </div>
);

/* ----------------------------------------------------------------
 * ATOMV4AgentBadge — branded agent name chip.
 * Always renders the Delta. `name` parts: text around the literal "TOM"
 * are auto-styled; pass `productName` (e.g. "ATOM VR") to honor the
 * documented ATOM VR exception while still showing Delta geometry.
 * ---------------------------------------------------------------- */
export const ATOMV4AgentBadge: React.FC<{
  label?: string;          // e.g. "Assistant", "VR", "Spatial"
  emissive?: boolean;      // VR contexts
}> = ({ label = "Assistant", emissive = false }) => (
  <span className={`atom-agent-badge${emissive ? " atom-vr-emissive" : ""}`}>
    <span className="atom-agent-badge__avatar"><ATOMV4Orbital size={26} animate={false} /></span>
    <span className={`name${emissive ? " atom-vr-safe-text" : ""}`}>
      Δ<span className="o">T</span>OM{label ? <>&nbsp;{label}</> : null}
    </span>
  </span>
);

export default {
  ATOMV4Lockup, ATOMV4Orbital, ATOMV4Wordmark, ATOMV4Loader, ATOMV4Hero,
  ATOMV4AppShell, ATOMV4MobileSplash, ATOMV4VRPanel, ATOMV4AgentBadge, ATOM_CYAN,
};
