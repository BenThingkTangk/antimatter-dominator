/**
 * @nirmata/atom-design-system/react
 *
 * Thin React adapters around the canonical ATOM design system primitives.
 * The single source of truth is the CSS in /css/atom-tokens.css,
 * /css/atom-components.css, /css/atom-animations.css.
 *
 * These components are deliberately thin — they emit markup that uses the
 * design-system class names + assets. No state machines, no theme context
 * Component (theme is set on <html data-theme="dark|light">).
 */

import React from 'react';

/* ────────────────────────────────────────────────────────────
 * <AtomBrandShell> — root wrapper
 *
 * Sets data-theme="dark" on <html> on mount. Optionally tags the
 * wrapper with data-atom-brand for stylistic targeting.
 * ──────────────────────────────────────────────────────────── */

export interface AtomBrandShellProps {
  children: React.ReactNode;
  theme?: 'dark' | 'light';
  brand?: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Asset base path for SVG marks. Default: "/atom-assets".
   * Kept for backwards compat with the old DtomBrandShell API; the new
   * markup embeds SVGs inline, so this is rarely needed.
   */
  assetBasePath?: string;
}

export function AtomBrandShell({
  children,
  theme = 'dark',
  brand = 'atom',
  className,
  style,
}: AtomBrandShellProps) {
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <div
      data-atom-brand={brand}
      className={`atom-shell ${className || ''}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
 * <AtomLogo> — canonical ΔTOM lockup
 *
 * Renders the orbital icon + ΔTOM wordmark. Sizes: sm | md | lg | hero.
 * Spinning controls the orbital ring rotation. Uses inline SVG so it
 * works without bundler asset config.
 * ──────────────────────────────────────────────────────────── */

export type AtomLogoSize = 'sm' | 'md' | 'lg' | 'hero';

export interface AtomLogoProps {
  size?: AtomLogoSize;
  showWordmark?: boolean;
  spinning?: boolean;
  href?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

const sizePx: Record<AtomLogoSize, { icon: number; word: number; gap: number }> = {
  sm:   { icon: 24, word: 16, gap: 8 },
  md:   { icon: 32, word: 20, gap: 10 },
  lg:   { icon: 48, word: 28, gap: 12 },
  hero: { icon: 72, word: 44, gap: 16 },
};

export function AtomLogo({
  size = 'md',
  showWordmark = true,
  spinning = false,
  href,
  ariaLabel = 'ΔTOM home',
  className,
  style,
}: AtomLogoProps) {
  const dims = sizePx[size];
  const content = (
    <span
      aria-label={ariaLabel}
      role="img"
      className={`atom-logo atom-logo--${size} ${className || ''}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: dims.gap, ...style }}
    >
      {/* Orbital icon — canonical: 3 ellipses at 0°/60°/120° + glowing nucleus */}
      <svg
        viewBox="0 0 200 200"
        width={dims.icon}
        height={dims.icon}
        aria-hidden="true"
        style={{
          flexShrink: 0,
          animation: spinning ? 'atom-orbit-spin 6s linear infinite reverse' : undefined,
          filter: 'drop-shadow(0 0 14px rgba(0,200,200,0.45))',
        }}
      >
        <defs>
          <radialGradient id="atomlogo-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor="#bff3f3" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#00c8c8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="atomlogo-shell" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a1a1c" stopOpacity="1" />
            <stop offset="70%" stopColor="#06181a" stopOpacity="1" />
            <stop offset="100%" stopColor="#04121a" stopOpacity="1" />
          </radialGradient>
        </defs>
        <g fill="none" stroke="var(--atom-primary, #3fb5b5)" strokeWidth="4.5" strokeLinecap="round">
          <ellipse cx="100" cy="100" rx="82" ry="32" />
          <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(60 100 100)" />
          <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(120 100 100)" />
        </g>
        <circle cx="100" cy="100" r="26" fill="url(#atomlogo-shell)" />
        <circle cx="100" cy="100" r="18" fill="url(#atomlogo-core)" />
        <circle cx="100" cy="100" r="5" fill="#ffffff" />
      </svg>

      {/* ΔTOM wordmark — canonical geometric SVG, no Unicode Δ font fallback */}
      {showWordmark && (
        <svg
          className="atom-logo__wordmark"
          aria-hidden="true"
          viewBox="0 0 720 200"
          preserveAspectRatio="xMidYMid meet"
          style={{
            display: 'inline-block',
            height: dims.word * 1.4,
            width: 'auto',
            color: 'var(--atom-text, #f0f0f0)',
          }}
        >
          <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
            <polygon points="100,170 10,170 55,30" stroke="currentColor" strokeWidth="18" />
            <line x1="150" y1="35" x2="310" y2="35" stroke="currentColor" strokeWidth="18" />
            <line x1="230" y1="35" x2="230" y2="170" stroke="currentColor" strokeWidth="18" />
            <circle cx="430" cy="102" r="70" stroke="var(--atom-primary, #3fb5b5)" strokeWidth="18" />
            <polyline points="540,170 540,35 615,150 690,35 690,170" stroke="currentColor" strokeWidth="18" />
          </g>
        </svg>
      )}
    </span>
  );

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} style={{ textDecoration: 'none', display: 'inline-flex' }}>
        {content}
      </a>
    );
  }
  return content;
}

/* ────────────────────────────────────────────────────────────
 * <AtomHero> — wrapped landing page hero
 *
 * Drop-in replacement for the old <DtomHero>. Accepts title + tagline
 * + a slot for the CTA cluster. Uses the new tokens (no custom colors).
 * ──────────────────────────────────────────────────────────── */

export interface AtomHeroProps {
  title: React.ReactNode;
  tagline?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** CTA cluster (buttons, links). */
  actions?: React.ReactNode;
  /** Optional element to render under the hero (mantra strip, etc). */
  belowFold?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AtomHero({
  title,
  tagline,
  eyebrow,
  actions,
  belowFold,
  className,
  style,
}: AtomHeroProps) {
  return (
    <section
      className={`atom-hero ${className || ''}`.trim()}
      style={{
        position: 'relative',
        padding: 'clamp(48px, 8vw, 120px) clamp(20px, 5vw, 60px)',
        textAlign: 'center',
        color: 'var(--atom-text, #e8e8ea)',
        background:
          'radial-gradient(circle at 50% -20%, rgba(0,200,200,0.10) 0%, transparent 55%), var(--atom-bg, #0b0b0c)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {eyebrow && (
        <div
          className="atom-hero__eyebrow"
          style={{
            fontFamily: "var(--atom-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--atom-primary, #00c8c8)',
            marginBottom: 18,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        className="atom-hero__title"
        style={{
          fontFamily: "var(--atom-font-display, 'Cabinet Grotesk', system-ui, sans-serif)",
          fontWeight: 800,
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: '0 auto 24px',
          maxWidth: 980,
          color: 'var(--atom-text, #e8e8ea)',
        }}
      >
        {title}
      </h1>
      {tagline && (
        <p
          className="atom-hero__tagline"
          style={{
            fontFamily: "var(--atom-font-body, 'Satoshi', system-ui, sans-serif)",
            fontSize: 'clamp(1rem, 1.4vw, 1.25rem)',
            lineHeight: 1.55,
            color: 'var(--atom-text-muted, #8a8a96)',
            margin: '0 auto 32px',
            maxWidth: 720,
          }}
        >
          {tagline}
        </p>
      )}
      {actions && (
        <div
          className="atom-hero__actions"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {actions}
        </div>
      )}
      {belowFold && (
        <div className="atom-hero__below" style={{ marginTop: 56 }}>
          {belowFold}
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
 * <AtomBootLoader> — cinematic boot overlay (React)
 *
 * React-native rewrite of the vanilla loader markup in
 * components/atom-loader.html. Mounts a full-viewport overlay,
 * runs a fade-out, then unmounts after `minimumDrama` ms.
 *
 * Drop-in replacement for the old <DtomBootLoader>.
 * ──────────────────────────────────────────────────────────── */

export interface AtomBootLoaderProps {
  active?: boolean;
  minimumDrama?: number;
  onComplete?: () => void;
  className?: string;
}

export function AtomBootLoader({
  active = true,
  minimumDrama = 2500,
  onComplete,
  className,
}: AtomBootLoaderProps) {
  const [visible, setVisible] = React.useState(active);
  const [mounted, setMounted] = React.useState(active);

  React.useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    setMounted(true);
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      // Allow CSS fade to finish before unmount
      window.setTimeout(() => {
        setMounted(false);
        onComplete?.();
      }, 360);
    }, minimumDrama);
    return () => window.clearTimeout(t);
  }, [active, minimumDrama, onComplete]);

  if (!mounted) return null;

  return (
    <div
      id="atom-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading ATOM"
      aria-hidden={visible ? 'false' : 'true'}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 50% 45%, #15161a 0%, #0b0b0c 60%, #060607 100%)',
        color: 'var(--atom-text, #e8e8ea)',
        transition: 'opacity 320ms cubic-bezier(0.16,1,0.3,1), visibility 320ms',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{ position: 'relative', width: 'min(720px, 92vw)', textAlign: 'center' }}>
        {/* Canonical full lockup — orbital icon + ΔTOM wordmark, horizontal */}
        <div
          role="img"
          aria-label="ΔTOM"
          style={{
            display: 'block',
            width: 'clamp(320px, 70vw, 720px)',
            margin: '0 auto 28px',
            color: 'var(--atom-text, #f0f0f0)',
            filter: 'drop-shadow(0 0 28px rgba(0,200,200,0.35))',
          }}
        >
          <svg
            viewBox="0 0 1100 240"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          >
            <defs>
              <radialGradient id="bootloader-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="35%" stopColor="#bff3f3" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#00c8c8" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bootloader-shell" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0a1a1c" stopOpacity="1" />
                <stop offset="70%" stopColor="#06181a" stopOpacity="1" />
                <stop offset="100%" stopColor="#04121a" stopOpacity="1" />
              </radialGradient>
            </defs>

            {/* Orbital icon — spins as a group */}
            <g transform="translate(20 20)">
              <g
                fill="none"
                stroke="var(--atom-primary, #3fb5b5)"
                strokeWidth="5"
                strokeLinecap="round"
                style={{
                  transformOrigin: '100px 100px',
                  animation: 'atom-orbit-spin 14s linear infinite reverse',
                }}
              >
                <ellipse cx="100" cy="100" rx="82" ry="32" />
                <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(60 100 100)" />
                <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(120 100 100)" />
              </g>
              <circle cx="100" cy="100" r="26" fill="url(#bootloader-shell)" />
              <circle
                cx="100"
                cy="100"
                r="18"
                fill="url(#bootloader-core)"
                style={{
                  transformOrigin: '100px 100px',
                  animation: 'atom-pulse-dot 2.2s ease-in-out infinite',
                }}
              />
              <circle cx="100" cy="100" r="5" fill="#ffffff" />
            </g>

            {/* ΔTOM wordmark — geometric strokes */}
            <g transform="translate(290 20)" fill="none" strokeLinecap="square" strokeLinejoin="miter">
              <polygon points="100,170 10,170 55,30" stroke="currentColor" strokeWidth="18" />
              <line x1="150" y1="35" x2="310" y2="35" stroke="currentColor" strokeWidth="18" />
              <line x1="230" y1="35" x2="230" y2="170" stroke="currentColor" strokeWidth="18" />
              <circle cx="430" cy="102" r="70" stroke="var(--atom-primary, #3fb5b5)" strokeWidth="18" />
              <polyline points="540,170 540,35 615,150 690,35 690,170" stroke="currentColor" strokeWidth="18" />
            </g>
          </svg>
        </div>

        {/* Mantra caption */}
        <div
          style={{
            fontFamily: "var(--atom-font-mono, 'JetBrains Mono', ui-monospace, monospace)",
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--atom-text-muted, #8a8a96)',
            opacity: 0,
            animation: 'atom-reveal-fade 600ms cubic-bezier(0.16,1,0.3,1) 800ms forwards',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.5em',
            maxWidth: 'min(640px, 86vw)',
            margin: '0 auto',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: 'var(--atom-primary, #00c8c8)' }}>PRECISION.</span>
          <span>EMPATHY.</span>
          <span style={{ color: 'var(--atom-primary, #00c8c8)' }}>VELOCITY.</span>
          <span>INTELLIGENCE.</span>
          <span style={{ color: 'var(--atom-primary, #00c8c8)' }}>DISRUPTION.</span>
        </div>

        {/* Progress bar */}
        <div
          aria-hidden="true"
          style={{
            margin: '24px auto 0',
            width: 240,
            height: 2,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 9999,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: '40%',
              background:
                'linear-gradient(90deg, transparent, var(--atom-primary, #00c8c8), transparent)',
              boxShadow: '0 0 18px rgba(0,200,200,0.55)',
              animation: 'atom-loader-sweep 1.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Backwards-compat aliases ───────────────────────────────
// Kept so existing imports of DtomBrandShell, DtomBootLoader, DtomLogo,
// and DtomHero from "@nirmata/dtom-brand-system" can be redirected here
// without changing the component names at the call sites.
export const DtomBrandShell = AtomBrandShell;
export const DtomBootLoader = AtomBootLoader;
export const DtomLogo = AtomLogo;
export const DtomHero = AtomHero;
