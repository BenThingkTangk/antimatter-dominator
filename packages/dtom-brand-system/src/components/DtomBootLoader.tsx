'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AtomMarkSVG } from './DtomLogo.internal';

/**
 * DtomBootLoader
 *
 * Cinematic classified aerospace ignition loader for ΔTOM.
 *
 * Behavior sequence:
 *  1. Black-titanium field with drifting grid appears.
 *  2. ΔTOM mark spins counter-clockwise and calibrates.
 *  3. Scanline crosses the wordmark.
 *  4. Telemetry tags resolve: ΔTOM - NirmX-UFO, Pi3 - SiQ.
 *  5. Status lines stage in: Signal acquired → Voice engine online → Human interface ready.
 *  6. After minimumDrama ms, loader exits via opacity/visibility fade.
 *
 * No weapon-sight cursors. No gunsight motifs. Aerospace only.
 *
 * Reduced-motion: all animations collapsed, immediate final state, exits after
 * a brief accessible pause.
 *
 * @example
 * <DtomBootLoader onComplete={() => setReady(true)} minimumDrama={2200} />
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

const LEFT_RAIL_LINES = [
  'NIRMATA BLACK OPS',
  'QUANTUM VOICE BUS',
  'ATOMDOMINATOR.COM',
  'UFO LATTICE',
  'Pi3 - SiQ ACTIVE',
  'ANTIMATTER FIELD',
];

const RIGHT_RAIL_LINES = [
  'IGNITION AUTH',
  'COMMAND LOOP ∞',
  'NirmX-UFO ONLINE',
  'SIGNAL ACQUIRED',
  'ZERO LATENCY',
  'SYSTEM LIVE',
];

const STATUS_LINES = [
  'Signal acquired',
  'Voice engine online',
  'Human interface ready',
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
      aria-label="Loading ΔTOM interface"
      aria-atomic="true"
    >
      {/* Drifting aerospace grid */}
      <div className="dtom-loader__field" aria-hidden="true" />

      {/* Precision corner brackets — aerospace only, no weapon sights */}
      <div className="dtom-loader__corner dtom-loader__corner--tl" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--tr" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--bl" aria-hidden="true" />
      <div className="dtom-loader__corner dtom-loader__corner--br" aria-hidden="true" />

      {/* Left telemetry rail */}
      <div className="dtom-loader__rail dtom-loader__rail--left" aria-hidden="true">
        {LEFT_RAIL_LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {/* Right telemetry rail */}
      <div className="dtom-loader__rail dtom-loader__rail--right" aria-hidden="true">
        {RIGHT_RAIL_LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {/* Core content */}
      <div className="dtom-loader__core">
        {/* Aerospace kicker */}
        <p className="dtom-loader__kicker" aria-hidden="true">
          NIRMATA HOLDINGS · AEROSPACE IGNITION SEQUENCE
        </p>

        {/* Logo */}
        <div className="dtom-loader__logo-wrap">
          <AtomMarkSVG spinning={!reducedMotion} />
          <span className="dtom-loader__word" aria-hidden="true">
            ΔT<span className="dtom-loader__word-o">O</span>M
          </span>
        </div>

        {/* Scanline */}
        <div className="dtom-loader__scanline" aria-hidden="true">
          <span className="dtom-loader__scanline-beam" />
        </div>

        {/* Telemetry tags: LLM + Voice labels */}
        <div className="dtom-loader__telemetry" aria-hidden="true">
          <span className="dtom-loader__telemetry-tag">
            LLM: ΔTOM - NirmX-UFO
          </span>
          <span className="dtom-loader__telemetry-tag">
            Voice: Pi3 - SiQ
          </span>
        </div>

        {/* Status lines */}
        <ol className="dtom-loader__status">
          {STATUS_LINES.map((line, i) => (
            <li
              key={line}
              style={{ '--dtom-i': i } as React.CSSProperties}
            >
              {line}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default DtomBootLoader;
