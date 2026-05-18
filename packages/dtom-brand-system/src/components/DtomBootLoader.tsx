'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * DtomBootLoader
 *
 * Boot loader overlay for ΔTOM Sales Dominator.
 *
 * Reduced-motion: animations collapsed, exits after a brief accessible pause.
 */

export interface DtomBootLoaderProps {
  /**
   * Callback fired after the loader exits.
   * Use to unmount or transition into the main app.
   */
  onComplete?: () => void;
  /**
   * Minimum cinematic hold time in ms before fade-out begins.
   * Default 2200ms. Increase to 4000ms for full demo effect.
   */
  minimumDrama?: number;
  /**
   * Whether the loader is currently active.
   * When false, the loader exits immediately.
   * Default: true (caller controls lifecycle).
   */
  active?: boolean;
  /** Additional CSS class on the root element */
  className?: string;
}

const MANTRA_WORDS: Array<{ word: string; tone: 'accent' | 'muted' }> = [
  { word: 'PRECISION', tone: 'accent' },
  { word: 'EMPATHY', tone: 'muted' },
  { word: 'VELOCITY', tone: 'accent' },
  { word: 'INTELLIGENCE', tone: 'muted' },
  { word: 'DISRUPTION', tone: 'accent' },
];

export function DtomBootLoader({
  onComplete,
  minimumDrama = 2200,
  active = true,
  className = '',
}: DtomBootLoaderProps): JSX.Element | null {
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  useEffect(() => {
    if (!active) return;

    const holdTime = reducedMotion ? 400 : minimumDrama;

    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setGone(true);
        onComplete?.();
      }, reducedMotion ? 50 : 600);
    }, holdTime);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, minimumDrama, onComplete, reducedMotion]);

  if (!active || gone) return null;

  return (
    <div
      className={`dtom-loader ${exiting ? 'dtom-loader--exiting' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label="Loading ΔTOM Sales Dominator"
      aria-atomic="true"
    >
      <div className="dtom-loader__field" aria-hidden="true" />

      <div className="dtom-loader__corner dtom-loader__corner--tl" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--tr" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--bl" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--br" aria-hidden="true" />

      <div className="dtom-loader__core">
        <div className="dtom-loader__logo-wrap">
          <svg
            className="dtom-loader__wordmark"
            viewBox="0 0 690 180"
            role="img"
            aria-label="ΔTOM"
            preserveAspectRatio="xMidYMid meet"
          >
            <title>ΔTOM</title>
            {/* Canonical geometric ΔTOM wordmark.
                Cap-height 120 with uniform 22-unit stroke for the heavy
                outline weight seen in the brand reference. miterlimit is
                high so the Delta apex stays a sharp point. */}
            <g
              className="dtom-loader__wordmark-glyphs"
              fill="none"
              stroke="currentColor"
              strokeWidth="22"
              strokeLinecap="butt"
              strokeLinejoin="miter"
              strokeMiterlimit="32"
            >
              {/* Δ — Greek capital Delta. Equilateral-ish outline triangle,
                  sharp apex, flat base aligned with the baseline. */}
              <polygon points="80,30 11,150 149,150" />
              {/* T — full-width top bar and centered stem. */}
              <line x1="180" y1="41" x2="320" y2="41" />
              <line x1="250" y1="41" x2="250" y2="150" />
              {/* O — teal ring, same cap-height and stroke weight. */}
              <circle
                cx="410"
                cy="90"
                r="49"
                stroke="var(--dtom-color-primary, #00e6d3)"
              />
              {/* M — two outer verticals joined by a centered V landing on
                  the baseline. */}
              <polyline points="500,150 500,30 580,150 660,30 660,150" />
            </g>
          </svg>
        </div>

        <div className="dtom-loader__scanline" aria-hidden="true">
          <span className="dtom-loader__scanline-beam" />
        </div>

        <p className="dtom-loader__mantra" aria-hidden="true">
          {MANTRA_WORDS.map((entry, i) => (
            <span
              key={entry.word}
              className={`dtom-loader__mantra-word dtom-loader__mantra-word--${entry.tone}`}
              style={{ '--dtom-i': i } as React.CSSProperties}
            >
              {entry.word}.
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default DtomBootLoader;
