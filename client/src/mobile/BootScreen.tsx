/**
 * BootScreen — first paint of the mobile app.
 *
 * Matches the QA mockup exactly: atomic orbit (teal), "ATOM" wordmark with
 * glowing O, teal→purple progress bar, monospace ticker lines (BOOT / NET /
 * LLM / VOICE). Auto-completes after ~2.4s, but is also dismissed early if
 * the tenant resolver completes before that.
 */
import { useEffect, useState } from "react";
import { DtomLogo } from "@nirmata/atom-design-system/react";

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
      {/* Canonical ΔTOM wordmark per brand spec */}
      <div className="m-boot-lockup" role="img" aria-label="ΔTOM" style={{ width: "min(280px, 70vw)", margin: "0 auto", filter: "drop-shadow(0 0 24px rgba(0,200,200,0.35))" }}>
        <DtomLogo size="hero" showWordmark={true} showIcon={false} ariaLabel="ΔTOM" />
      </div>
      <div className="m-boot-bar"><div className="m-boot-bar-fill" /></div>
      <div className="m-boot-lines">
        <div className="m-boot-line">
          <span className="m-boot-key">BOOT&nbsp;&nbsp;</span>
          <span className="m-boot-val">Initialising orbital field</span>
        </div>
        <div className="m-boot-line">
          <span className="m-boot-key">NET&nbsp;&nbsp;&nbsp;</span>
          <span className="m-boot-val">Handshake · ATOM.Cloud</span>
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
