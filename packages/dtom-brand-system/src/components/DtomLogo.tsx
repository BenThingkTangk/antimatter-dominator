'use client';

import React from 'react';
import { useDtomBrand } from './DtomBrandShell';
import { AtomMarkSVG } from './DtomLogo.internal';

/**
 * DtomLogo
 *
 * Canonical ΔTOM logo lockup: canonical image asset (dtom-canonical-logo.jpg)
 * paired with the SVG orbital atom mark and the ΔTOM wordmark.
 *
 * Rules enforced:
 * - ΔTOM wordmark: Δ white, T white, O teal, M white
 * - SVG atom orbits spin counter-clockwise only
 * - Logo mark always left of wordmark
 * - Domain AtomDominator.com is the real-world literal — brand visible text is ΔTOM
 * - No generic atom icon library substitutions — canonical SVG only
 * - Never rotate full lockup; only internal orbit group spins
 * - Reduced-motion: animations disabled, static state preserved
 *
 * @example
 * <DtomLogo size="md" spinning href="/" />
 */

export type DtomLogoSize = 'favicon' | 'sm' | 'md' | 'lg' | 'hero';

export interface DtomLogoProps {
  /** Wraps the lockup in an anchor if provided */
  href?: string;
  /** Size variant controlling mark dimensions and wordmark type size */
  size?: DtomLogoSize;
  /** Show canonical logo image instead of SVG atom mark */
  useCanonicalImage?: boolean;
  /** Enable the spinning orbital animation on the SVG mark */
  spinning?: boolean;
  /** Show ΔTOM wordmark beside the mark */
  showWordmark?: boolean;
  /** Accessible label. Default: "ΔTOM home" */
  ariaLabel?: string;
  /** Additional CSS class on the root element */
  className?: string;
  /** Additional inline style */
  style?: React.CSSProperties;
  /** Override asset base path (defaults to DtomBrandShell context) */
  assetBasePath?: string;
}

const sizeClassMap: Record<DtomLogoSize, string> = {
  favicon: 'dtom-logo--sm',
  sm:      'dtom-logo--sm',
  md:      'dtom-logo--md',
  lg:      'dtom-logo--lg',
  hero:    'dtom-logo--hero',
};

export function DtomLogo({
  href,
  size = 'md',
  useCanonicalImage = false,
  spinning = true,
  showWordmark = true,
  ariaLabel = 'ΔTOM home',
  className = '',
  style,
  assetBasePath: propAssetBasePath,
}: DtomLogoProps): JSX.Element {
  const ctx = useDtomBrand();
  const base = propAssetBasePath ?? ctx.assetBasePath;

  const sizeClass = sizeClassMap[size] ?? 'dtom-logo--md';
  const rootClass = `dtom-logo ${sizeClass} ${className}`.trim();

  const mark = useCanonicalImage ? (
    <img
      className="dtom-logo__mark--image"
      src={`${base}/dtom-canonical-logo.jpg`}
      alt="ΔTOM canonical logo mark"
      aria-hidden="true"
      width="42"
      height="42"
    />
  ) : (
    <AtomMarkSVG spinning={spinning} />
  );

  const wordmark = showWordmark && (
    <span className="dtom-logo__wordmark" aria-hidden="true">
      ΔT<span className="dtom-logo__wordmark-o">O</span>M
    </span>
  );

  const inner = (
    <>
      {mark}
      {wordmark}
    </>
  );

  if (href) {
    return (
      <a href={href} className={rootClass} aria-label={ariaLabel} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <div className={rootClass} aria-label={ariaLabel} role="img" style={style}>
      {inner}
    </div>
  );
}

export default DtomLogo;
