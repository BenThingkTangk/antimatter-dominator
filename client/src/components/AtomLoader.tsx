/**
 * AtomLoader — the canonical ATOM boot screen.
 *
 * Per the ATOM Brand Standard OS: the cold-open says ONE word — ATOM — beneath
 * a refined orbital cage with a solid, breathing cyan nucleus. No telemetry
 * tickers, no sub-brands, no legacy wordmark. Dark-only.
 *
 * Inlines the brand kit's atom-loader.svg geometry so it animates from tokens
 * (override --atom-primary and the whole loader recolors). Auto-completes after
 * `minimumDrama` ms, then fades and calls onComplete.
 */
import { useEffect, useState } from "react";

interface AtomLoaderProps {
  active: boolean;
  /** Minimum time the cold-open is shown before it begins fading out. */
  minimumDrama?: number;
  onComplete: () => void;
}

export function AtomLoader({ active, minimumDrama = 2200, onComplete }: AtomLoaderProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t1 = setTimeout(() => setLeaving(true), minimumDrama);
    const t2 = setTimeout(() => onComplete(), minimumDrama + 460);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, minimumDrama, onComplete]);

  if (!active) return null;

  return (
    <div
      className="atom-loader-screen"
      data-leaving={leaving ? "1" : undefined}
      role="status"
      aria-label="ATOM loading"
    >
      <div className="atom-loader-screen__core">
        <svg
          viewBox="0 0 120 120"
          width="132"
          height="132"
          role="img"
          aria-label="ATOM"
          className="atom-loader-screen__svg"
        >
          <defs>
            <radialGradient id="atomLoaderCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--atom-primary-bright, #4ff3e6)" />
              <stop offset="55%" stopColor="var(--atom-primary, #22e6d6)" />
              <stop offset="100%" stopColor="var(--atom-primary-dim, #14a99d)" />
            </radialGradient>
          </defs>

          {/* Static guide ring */}
          <circle cx="60" cy="60" r="46" fill="none" stroke="var(--atom-primary, #22e6d6)" strokeWidth="1" opacity="0.12" />

          {/* Spinning orbital cage */}
          <g transform="translate(60 60)" fill="none" stroke="var(--atom-primary, #22e6d6)" strokeWidth="2" strokeLinecap="round">
            <g>
              <ellipse rx="42" ry="17" opacity="0.9" />
              <ellipse rx="42" ry="17" opacity="0.55" transform="rotate(60)" />
              <ellipse rx="42" ry="17" opacity="0.35" transform="rotate(120)" />
              <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
            </g>
          </g>

          {/* Solid breathing nucleus */}
          <circle cx="60" cy="60" r="8.5" fill="url(#atomLoaderCore)" />
          <circle cx="60" cy="60" r="8.5" fill="none" stroke="var(--atom-primary, #22e6d6)" strokeWidth="1.5" opacity="0.5">
            <animate
              attributeName="r"
              values="8.5;16;8.5"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.16 1 0.3 1; 0.16 1 0.3 1"
              keyTimes="0;0.5;1"
            />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <div className="atom-loader-screen__word" aria-hidden="true">ATOM</div>
    </div>
  );
}

export default AtomLoader;
