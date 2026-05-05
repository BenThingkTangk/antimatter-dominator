/**
 * Canonical ATOM atomic orbit mark — sized/colored by parent via CSS.
 * Reuses the existing .atom-mark CSS animations (counter-clockwise spin,
 * nucleus pulse, electron flicker).
 */
export function AtomOrbit({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`atom-mark ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle className="atom-atmosphere" cx="32" cy="32" r="30" />
      <g className="atom-orbits">
        <ellipse className="atom-orbit atom-orbit-a" cx="32" cy="32" rx="12" ry="29" />
        <ellipse className="atom-orbit atom-orbit-b" cx="32" cy="32" rx="29" ry="12" />
        <ellipse className="atom-orbit atom-orbit-c" cx="32" cy="32" rx="23" ry="10" transform="rotate(45 32 32)" />
      </g>
      <circle className="atom-nucleus" cx="32" cy="32" r="4.25" />
      <circle className="atom-electron atom-electron-a" cx="32" cy="3" r="2.6" />
      <circle className="atom-electron atom-electron-b" cx="61" cy="32" r="2.4" />
      <circle className="atom-electron atom-electron-c" cx="15.5" cy="48.5" r="2.2" />
    </svg>
  );
}
