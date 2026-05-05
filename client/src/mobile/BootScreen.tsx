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
      <div className="m-boot-wordmark">AT<span className="m-o">O</span>M</div>
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
