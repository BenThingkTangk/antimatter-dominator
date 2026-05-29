/**
 * TCPA / FCC / GDPR pre-dial disclosure.
 *
 * Shown ONCE per browser session before the very first outbound dial.
 * Captures: TCPA consent acknowledgment, DNC check confirmation,
 * recording-disclosure acknowledgment, and quiet-hours/region awareness.
 *
 * This is a UI guardrail — server-side compliance checks (DNC scrub,
 * quiet-hours enforcement, consent ledger) remain the authoritative gate.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, X } from "lucide-react";

const STORAGE_KEY = "atom_tcpa_ack_v1";

export function hasAckedTcpa(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearTcpaAck() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

interface Props {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export default function TcpaDisclosure({ open, onAccept, onCancel }: Props) {
  const [consent, setConsent] = useState(false);
  const [dnc, setDnc] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quiet, setQuiet] = useState(false);

  useEffect(() => {
    if (open) {
      setConsent(false);
      setDnc(false);
      setRecording(false);
      setQuiet(false);
    }
  }, [open]);

  if (!open) return null;

  const allChecked = consent && dnc && recording && quiet;

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    onAccept();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tcpa-title"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-xl rounded-2xl"
        style={{
          background: "rgba(14,15,20,0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
        }}
      >
        <div className="flex items-start justify-between p-6 pb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(0,200,200,0.16)", border: "1px solid rgba(0,200,200,0.45)" }}
            >
              <ShieldCheck size={18} className="text-[#7fe7e7]" />
            </div>
            <div>
              <h2 id="tcpa-title" className="text-base font-bold text-white">
                Pre-dial compliance check
              </h2>
              <p className="text-xs text-white/55">
                Confirm before ATOM AI places its first outbound call.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded hover:bg-white/5 text-white/55"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-3 space-y-3">
          <CheckRow
            checked={consent}
            onChange={setConsent}
            label="TCPA consent"
            body="I have prior express written consent (or an established business relationship that satisfies TCPA §227 / FCC rules) to call this prospect with an AI-assisted voice agent."
          />
          <CheckRow
            checked={dnc}
            onChange={setDnc}
            label="DNC scrubbed"
            body="This number is not on the federal DNC registry, my company's internal DNC list, or any state-level wireless restriction list applicable to the prospect's region."
          />
          <CheckRow
            checked={recording}
            onChange={setRecording}
            label="Recording & AI disclosure"
            body="ATOM AI will automatically deliver the legally required recording and AI-voice disclosure at the start of the call (two-party-consent states, GDPR Art. 13/14, and EU AI Act §50)."
          />
          <CheckRow
            checked={quiet}
            onChange={setQuiet}
            label="Quiet hours & region"
            body="The prospect's local time is within the 08:00–21:00 dialing window and I am authorized to contact this jurisdiction (including state-specific wireless/holiday restrictions)."
          />

          <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px]"
            style={{
              background: "rgba(255,200,80,0.06)",
              border: "1px solid rgba(255,200,80,0.20)",
              color: "rgba(255,215,140,0.95)",
            }}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              ATOM AI's server-side compliance layer will block the call if DNC, quiet-hours, or
              consent ledger checks fail — but you remain the controller of record.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-6 pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={!allChecked}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "rgba(0,200,200,0.18)",
              border: "1px solid rgba(0,200,200,0.50)",
              color: "#7fe7e7",
            }}
          >
            Acknowledge & dial
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  body: string;
}) {
  return (
    <label
      className="flex gap-3 p-3 rounded-lg cursor-pointer transition"
      style={{
        background: checked ? "rgba(0,200,200,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${checked ? "rgba(0,200,200,0.30)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 shrink-0 accent-[#7fe7e7]"
      />
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-white/60 mt-0.5 leading-relaxed">{body}</div>
      </div>
    </label>
  );
}
