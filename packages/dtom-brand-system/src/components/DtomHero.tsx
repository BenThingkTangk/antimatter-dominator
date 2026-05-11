'use client';

import React from 'react';

/**
 * DtomHero
 *
 * Apple keynote meets classified aerospace command hero section for ΔTOM.
 *
 * Visual elements:
 * - Drifting grid field (background, aria-hidden)
 * - Left+right telemetry rails (desktop only, aria-hidden)
 * - System eyebrow label
 * - Large hero headline (ΔTOM — no plain ATOM in UI text)
 * - Lead body copy
 * - Command telemetry capsule: IGNITION AUTHORIZED, LLM: ΔTOM - NirmX-UFO,
 *   Voice: Pi3 - SiQ, Domain: AtomDominator.com
 * - Primary + secondary CTA buttons
 *
 * Domain note: domain literal "AtomDominator.com" is real-world domain and must
 * remain as-is. In all other visible product copy the brand is ΔTOM.
 *
 * No weapon-sight cursors. No gunsight motifs. Aerospace only.
 *
 * @example
 * <DtomHero
 *   headline="ΔTOM ignition for machine-scale command and human-grade nerve."
 *   body="ΔTOM is the voice AI flagship of Nirmata Holdings — a cinematic command layer..."
 *   primaryCta={{ label: 'Ignite command layer', href: '#demo' }}
 *   secondaryCta={{ label: 'Run voice telemetry', href: '#system' }}
 * />
 */

export interface DtomHeroCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface DtomHeroProps {
  /** System eyebrow label. Default: "v3.0 · Black-Site Aerospace Brand System" */
  eyebrow?: string;
  /** Hero headline. Use ΔTOM — never plain ATOM. */
  headline?: string;
  /** Lead body copy beneath the headline */
  body?: string;
  /** Primary CTA button */
  primaryCta?: DtomHeroCta;
  /** Secondary CTA button */
  secondaryCta?: DtomHeroCta;
  /** Show the command telemetry capsule. Default: true */
  showCapsule?: boolean;
  /** Additional CSS class on the hero section */
  className?: string;
  /** Additional inline style */
  style?: React.CSSProperties;
}

const DEFAULT_HEADLINE =
  'ΔTOM ignition for machine-scale command and human-grade nerve.';

const DEFAULT_BODY =
  'ΔTOM is the voice AI flagship — a cinematic command layer where NirmX-UFO reasoning, Pi3 - SiQ voice telemetry, and AntimatterAI infrastructure come online like an aerospace launch system.';

const DEFAULT_EYEBROW = 'v3.0 · Black-Site Aerospace Brand System';

const LEFT_RAIL = [
  'NIRMATA BLACK OPS',
  'ATOMDOMINATOR.COM',
  'ANTIMATTER FIELD',
];

const RIGHT_RAIL = [
  'NirmX-UFO ONLINE',
  'Pi3 - SiQ ACTIVE',
  'COMMAND LOOP ∞',
];

export function DtomHero({
  eyebrow = DEFAULT_EYEBROW,
  headline = DEFAULT_HEADLINE,
  body = DEFAULT_BODY,
  primaryCta,
  secondaryCta,
  showCapsule = true,
  className = '',
  style,
}: DtomHeroProps): JSX.Element {
  return (
    <section
      className={`dtom-hero ${className}`.trim()}
      style={style}
      aria-label="ΔTOM hero command section"
    >
      {/* Drifting grid field */}
      <div className="dtom-hero__field" aria-hidden="true" />

      {/* Left telemetry rail */}
      <div className="dtom-hero__rail dtom-hero__rail--left" aria-hidden="true">
        {LEFT_RAIL.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      {/* Right telemetry rail */}
      <div className="dtom-hero__rail dtom-hero__rail--right" aria-hidden="true">
        {RIGHT_RAIL.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>

      <div className="dtom-container dtom-hero__inner">
        {/* Eyebrow */}
        {eyebrow && (
          <p className="dtom-hero__eyebrow dtom-system-label">{eyebrow}</p>
        )}

        {/* Headline */}
        <h1 className="dtom-hero__headline">{headline}</h1>

        {/* Body */}
        {body && <p className="dtom-hero__body">{body}</p>}

        {/* Command telemetry capsule */}
        {showCapsule && (
          <div className="dtom-hero__capsule" aria-label="System telemetry">
            <div className="dtom-hero__capsule-item">
              <span className="dtom-hero__capsule-label">Status</span>
              <span className="dtom-hero__capsule-value">IGNITION AUTHORIZED</span>
            </div>
            <div className="dtom-hero__capsule-item">
              <span className="dtom-hero__capsule-label">System</span>
              <span className="dtom-hero__capsule-value">ΔTOM · command stack live</span>
            </div>
            <div className="dtom-hero__capsule-item">
              <span className="dtom-hero__capsule-label">LLM</span>
              <span className="dtom-hero__capsule-value">ΔTOM - NirmX-UFO</span>
            </div>
            <div className="dtom-hero__capsule-item">
              <span className="dtom-hero__capsule-label">Voice</span>
              <span className="dtom-hero__capsule-value">Pi3 - SiQ</span>
            </div>
            <div className="dtom-hero__capsule-item">
              <span className="dtom-hero__capsule-label">Domain</span>
              {/* Literal domain — must remain AtomDominator.com */}
              <span className="dtom-hero__capsule-value">AtomDominator.com</span>
            </div>
          </div>
        )}

        {/* CTA buttons */}
        {(primaryCta || secondaryCta) && (
          <div className="dtom-hero__actions">
            {primaryCta && (
              primaryCta.href ? (
                <a
                  href={primaryCta.href}
                  className="dtom-btn dtom-btn-primary"
                >
                  {primaryCta.label}
                </a>
              ) : (
                <button
                  type="button"
                  className="dtom-btn dtom-btn-primary"
                  onClick={primaryCta.onClick}
                >
                  {primaryCta.label}
                </button>
              )
            )}
            {secondaryCta && (
              secondaryCta.href ? (
                <a
                  href={secondaryCta.href}
                  className="dtom-btn dtom-btn-ghost"
                >
                  {secondaryCta.label}
                </a>
              ) : (
                <button
                  type="button"
                  className="dtom-btn dtom-btn-ghost"
                  onClick={secondaryCta.onClick}
                >
                  {secondaryCta.label}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default DtomHero;
