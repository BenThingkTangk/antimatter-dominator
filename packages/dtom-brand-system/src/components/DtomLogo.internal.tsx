/**
 * Internal — shared AtomMarkSVG used by DtomLogo and DtomBootLoader.
 * Not exported from the package index.
 */
import React from 'react';

export function AtomMarkSVG({ spinning = true }: { spinning?: boolean }): JSX.Element {
  return (
    <svg
      className="dtom-logo__mark"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="dtom-logo__atmosphere"
        cx="32"
        cy="32"
        r="30"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.18"
      />
      <g
        className="dtom-logo__orbits"
        style={spinning ? undefined : { animation: 'none' }}
      >
        <ellipse
          className="dtom-logo__orbit dtom-logo__orbit--a"
          cx="32" cy="32" rx="12" ry="29"
        />
        <ellipse
          className="dtom-logo__orbit dtom-logo__orbit--b"
          cx="32" cy="32" rx="29" ry="12"
        />
        <ellipse
          className="dtom-logo__orbit dtom-logo__orbit--c"
          cx="32" cy="32" rx="23" ry="10"
          transform="rotate(45 32 32)"
        />
      </g>
      <circle
        className="dtom-logo__nucleus"
        cx="32" cy="32" r="4.25"
        style={spinning ? undefined : { animation: 'none' }}
      />
      <circle
        className="dtom-logo__electron"
        cx="32" cy="3" r="2.6"
        style={spinning ? undefined : { animation: 'none' }}
      />
      <circle
        className="dtom-logo__electron"
        cx="61" cy="32" r="2.4"
        style={spinning ? undefined : { animation: 'none' }}
      />
      <circle
        className="dtom-logo__electron"
        cx="15.5" cy="48.5" r="2.2"
        style={spinning ? undefined : { animation: 'none' }}
      />
    </svg>
  );
}
