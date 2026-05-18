/**
 * BootScreen — first paint of the mobile app.
 *
 * Matches the QA mockup exactly: atomic orbit (teal), "ATOM" wordmark with
 * glowing O, teal→purple progress bar, monospace ticker lines (BOOT / NET /
 * LLM / VOICE). Auto-completes after ~2.4s, but is also dismissed early if
 * the tenant resolver completes before that.
 */
import { useEffect, useState } from "react";
import { AtomOrbit } from "./AtomOrbit";

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
      <div className="m-boot-mark"><AtomOrbit size={170} /></div>
      <div className="m-boot-wordmark" aria-label="ΔTOM" role="img">
        <svg
          aria-hidden="true"
          viewBox="0 0 640 160"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "min(260px, 70vw)", height: "auto", color: "currentColor" }}
        >
          <g fill="none" strokeLinecap="square" strokeLinejoin="miter">
            <polygon points="70,130 10,130 40,30" stroke="currentColor" strokeWidth="14" />
            <line x1="100" y1="37" x2="220" y2="37" stroke="currentColor" strokeWidth="14" />
            <line x1="160" y1="37" x2="160" y2="130" stroke="currentColor" strokeWidth="14" />
            <circle cx="320" cy="83" r="50" stroke="var(--color-primary, #00c8c8)" strokeWidth="14" />
            <polyline points="410,130 410,37 470,110 530,37 530,130" stroke="currentColor" strokeWidth="14" />
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
