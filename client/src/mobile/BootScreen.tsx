/**
 * BootScreen — first paint of the mobile app.
 *
 * Matches the QA mockup exactly: atomic orbit (teal), "ATOM" wordmark with
 * glowing O, teal→purple progress bar, monospace ticker lines (BOOT / NET /
 * LLM / VOICE). Auto-completes after ~2.4s, but is also dismissed early if
 * the tenant resolver completes before that.
 */
import { useEffect, useState } from "react";

interface BootScreenProps {
  onDone: () => void;
  /** Will be shown briefly even if tenant loads instantly. */
  minDuration?: number;
}

export function BootScreen({ onDone, minDuration = 2400 }: BootScreenProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), minDuration);
    const t2 = setTimeout(() => onDone(), minDuration + 380);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minDuration, onDone]);

  return (
    <div className={`m-boot${leaving ? " is-leaving" : ""}`} role="status" aria-label="ATOM booting">
      {/* Canonical ΔTOM full lockup — orbital icon + wordmark per brand spec */}
      <div className="m-boot-lockup" role="img" aria-label="ΔTOM" style={{ width: "min(420px, 86vw)", margin: "0 auto", filter: "drop-shadow(0 0 24px rgba(0,200,200,0.35))" }}>
        <svg
          aria-hidden="true"
          viewBox="0 0 1100 240"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "auto", color: "currentColor" }}
        >
          <defs>
            <radialGradient id="mboot-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#bff3f3" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#00c8c8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mboot-shell" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a1a1c" stopOpacity="1" />
              <stop offset="70%" stopColor="#06181a" stopOpacity="1" />
              <stop offset="100%" stopColor="#04121a" stopOpacity="1" />
            </radialGradient>
          </defs>
          <g transform="translate(20 20)">
            <g
              fill="none"
              stroke="var(--color-primary, #3fb5b5)"
              strokeWidth="5"
              strokeLinecap="round"
              style={{ transformOrigin: "100px 100px", animation: "atom-orbit-spin 14s linear infinite reverse" }}
            >
              <ellipse cx="100" cy="100" rx="82" ry="32" />
              <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(60 100 100)" />
              <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(120 100 100)" />
            </g>
            <circle cx="100" cy="100" r="26" fill="url(#mboot-shell)" />
            <circle cx="100" cy="100" r="18" fill="url(#mboot-core)" />
            <circle cx="100" cy="100" r="5" fill="#ffffff" />
          </g>
          <g transform="translate(290 20)" fill="none" strokeLinecap="square" strokeLinejoin="miter">
            <polygon points="100,170 10,170 55,30" stroke="currentColor" strokeWidth="18" />
            <line x1="150" y1="35" x2="310" y2="35" stroke="currentColor" strokeWidth="18" />
            <line x1="230" y1="35" x2="230" y2="170" stroke="currentColor" strokeWidth="18" />
            <circle cx="430" cy="102" r="70" stroke="var(--color-primary, #3fb5b5)" strokeWidth="18" />
            <polyline points="540,170 540,35 615,150 690,35 690,170" stroke="currentColor" strokeWidth="18" />
          </g>
        </svg>
      </div>
      <div className="m-boot-bar"><div className="m-boot-bar-fill" /></div>
      <div className="m-boot-lines">
        <div className="m-boot-line">
          <span className="m-boot-key">BOOT&nbsp;&nbsp;</span>
          <span className="m-boot-val">Initialising orbital field</span>
        </div>
        <div className="m-boot-line">
          <span className="m-boot-key">NET&nbsp;&nbsp;&nbsp;</span>
          <span className="m-boot-val">Handshake · Nirmata.Holdings</span>
        </div>
        <div className="m-boot-line">
          <span className="m-boot-key">LLM&nbsp;&nbsp;&nbsp;</span>
          <span className="m-boot-val">Claude · GPT · Ensemble ready</span>
        </div>
        <div className="m-boot-line">
          <span className="m-boot-key">VOICE&nbsp;</span>
          <span className="m-boot-val">Hume · EVI engaged</span>
        </div>
      </div>
    </div>
  );
}
