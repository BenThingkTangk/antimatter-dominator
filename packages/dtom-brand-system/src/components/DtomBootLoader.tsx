'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AtomMarkSVG } from './DtomLogo.internal';

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
          <AtomMarkSVG spinning={!reducedMotion} />
          <span className="dtom-loader__word" aria-hidden="true">
            ΔT<span className="dtom-loader__word-o">O</span>M
          </span>
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
