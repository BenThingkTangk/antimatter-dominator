'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * DtomBootLoader (AntimatterAI edition)
 *
 * Minimal cinematic loader matching the AntimatterAI / ATOM Sales Dominator
 * loading screen reference:
 *  - Pure #020202 field
 *  - Ghosted "ΔTOM SALES DOMINATOR" watermark at 4% lavender
 *  - Massive 0→100 counter in #f6f6fd
 *  - "INITIALIZING ΔTOM" label
 *  - 2px lavender gradient progress bar
 *
 * Counter ticks every 60ms by a random 2–10 step. On hitting 100, holds 400ms
 * then fades out via opacity over 0.6s and fires onComplete.
 *
 * Reduced-motion: collapses to a static final-state hold and exits quickly.
 *
 * @example
 * <DtomBootLoader onComplete={() => setReady(true)} />
 */

export interface DtomBootLoaderProps {
  /** Callback fired after the loader exits. */
  onComplete?: () => void;
  /**
   * Minimum cinematic hold time in ms. The counter speed self-regulates so
   * the run takes ~minimumDrama ms even if the random increments would
   * normally finish faster. Default 2200.
   */
  minimumDrama?: number;
  /** When false, exits immediately. Default true. */
  active?: boolean;
  /** Additional class on root */
  className?: string;
}

export function DtomBootLoader({
  onComplete,
  minimumDrama = 2200,
  active = true,
  className = '',
}: DtomBootLoaderProps): JSX.Element | null {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      setProgress(100);
      const t = window.setTimeout(() => {
        setExiting(true);
        window.setTimeout(() => {
          setGone(true);
          onComplete?.();
        }, 200);
      }, 400);
      return () => window.clearTimeout(t);
    }

    const start = performance.now();
    let raf = 0;

    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return prev;
        const elapsed = performance.now() - start;
        // self-regulate so we don't finish much before minimumDrama
        const minAllowed = Math.min(100, (elapsed / minimumDrama) * 100);
        const inc = Math.random() * 8 + 2; // 2..10
        let next = prev + inc;
        if (next > minAllowed + 12) next = minAllowed + 12;
        if (next >= 100) {
          next = 100;
          window.clearInterval(interval);
          window.setTimeout(() => {
            setExiting(true);
            window.setTimeout(() => {
              setGone(true);
              onComplete?.();
            }, 600);
          }, 400);
        }
        return next;
      });
    }, 60);

    return () => {
      window.clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active, minimumDrama, onComplete, reducedMotion]);

  if (!active || gone) return null;

  const rootStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: '#020202',
    color: '#f6f6fd',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    zIndex: 9999,
    fontFamily: "'Plus Jakarta Sans', Arial, Helvetica, sans-serif",
    opacity: exiting ? 0 : 1,
    visibility: exiting ? 'hidden' : 'visible',
    transition: 'opacity 0.6s ease, visibility 0.6s ease',
    overflow: 'hidden',
    pointerEvents: exiting ? 'none' : 'auto',
  };

  const watermarkStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(105, 106, 172, 0.04)',
    fontSize: 'clamp(2rem, 8vw, 8rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
    textAlign: 'center',
    lineHeight: 1,
  };

  const countStyle: React.CSSProperties = {
    position: 'relative',
    color: '#f6f6fd',
    fontSize: 'clamp(4rem, 15vw, 10rem)',
    fontWeight: 800,
    letterSpacing: '-0.06em',
    lineHeight: 1,
    zIndex: 1,
  };

  const labelStyle: React.CSSProperties = {
    position: 'relative',
    marginTop: '1.5rem',
    color: 'rgba(246, 246, 253, 0.4)',
    fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    fontWeight: 500,
    zIndex: 1,
  };

  const barWrapStyle: React.CSSProperties = {
    position: 'relative',
    marginTop: '2rem',
    width: 'min(400px, 80vw)',
    height: 2,
    background: 'rgba(105, 106, 172, 0.2)',
    borderRadius: 9999,
    overflow: 'hidden',
    zIndex: 1,
  };

  const barStyle: React.CSSProperties = {
    height: '100%',
    width: `${progress}%`,
    background: 'linear-gradient(90deg, #8587e3, #696aac)',
    borderRadius: 9999,
    transition: 'width 0.05s linear',
  };

  return (
    <div
      className={`dtom-loader ${exiting ? 'dtom-loader--exiting' : ''} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label="Loading ΔTOM interface"
      aria-atomic="true"
      style={rootStyle}
    >
      <div style={watermarkStyle} aria-hidden="true">
        ΔTOM SALES DOMINATOR
      </div>

      <div style={countStyle}>{Math.floor(progress)}</div>
      <div style={labelStyle}>Initializing ΔTOM</div>
      <div style={barWrapStyle} aria-hidden="true">
        <div style={barStyle} />
      </div>
    </div>
  );
}

export default DtomBootLoader;
