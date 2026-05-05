/**
 * MobileDial — active-call / voice QA screen.
 *
 * Matches the voice mockup: sticky header (ATOM orbit + title), LIVE TRANSCRIPT
 * pill + EVI · EMPATHY pill, transcript bubbles, teal→warn waveform, primary
 * Start/End button, ghost Mute, and a "264ms FIRST TOKEN" KPI card.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, PhoneCall, PhoneOff, User } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { ATOM_PRODUCTS, resolveProductLabel, isCustom } from "../../lib/atom-products";
import { useTenant } from "../../lib/useTenant";

interface TranscriptEntry { role: "atom" | "caller"; text: string; }

const DEMO_TRANSCRIPT: TranscriptEntry[] = [
  { role: "caller", text: "I just got the lab results back and I'm a little shaken." },
  { role: "atom",   text: "I'm here. Take your time — what part feels heaviest right now?" },
  { role: "caller", text: "The hemoglobin number. My doctor said to call ClinixAI." },
];

// Baseline waveform shape (24 bars) that modulates when mic is live
const BASE_BARS = [22, 14, 38, 52, 28, 44, 68, 54, 70, 62, 80, 72, 76, 64, 58, 46, 38, 30, 42, 54, 34, 22, 14, 8];

function usePulseBars(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(BASE_BARS);
  useEffect(() => {
    if (!active) { setBars(BASE_BARS); return; }
    const id = setInterval(() => {
      setBars((prev) => prev.map((_, i) => {
        const base = BASE_BARS[i];
        const jitter = (Math.random() - 0.5) * 28;
        return Math.max(6, Math.min(96, base + jitter));
      }));
    }, 140);
    return () => clearInterval(id);
  }, [active]);
  return bars;
}

type CallPhase = "idle" | "dialing" | "live" | "ended";

export default function MobileDial() {
  const { tenant } = useTenant();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [product, setProduct] = useState<string>("atom-platform");
  const [customText, setCustomText] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [dealValue, setDealValue] = useState<string>("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [firstTokenMs] = useState<number>(264);

  const bars = usePulseBars(phase === "live");
  const startedAtRef = useRef<number | null>(null);
  const [elapsedS, setElapsedS] = useState(0);

  useEffect(() => {
    if (phase !== "live") return;
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      if (!startedAtRef.current) return;
      setElapsedS(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  const productLabel = useMemo(() => resolveProductLabel(product, customText), [product, customText]);
  const enterprise = tenant?.plan === "enterprise";
  const dealNum = Number(dealValue.replace(/[^0-9.]/g, "")) || 0;
  const gpt5Eligible = enterprise && dealNum >= 50000;

  async function handleDial() {
    setPhase("dialing");
    setTranscript([]);
    try {
      const payload = {
        name: leadName || "friend",
        phone: leadPhone,
        product: productLabel,
        dealValue: dealNum,
        tenantSlug: tenant?.slug,
      };
      const res = await fetch("/api/atom-leadgen/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      // Go live (real-time transcript would flow via WS in production —
      // here we seed the demo transcript so the UI feels immediately alive).
      setPhase("live");
      DEMO_TRANSCRIPT.forEach((t, i) => setTimeout(() => setTranscript((prev) => [...prev, t]), 500 + i * 1400));
    } catch (e) {
      console.error("[MobileDial] call failed:", e);
      setPhase("idle");
    }
  }

  function handleHangup() {
    setPhase("ended");
    setTimeout(() => setPhase("idle"), 900);
  }

  const stagePill =
    phase === "live"    ? <span className="m-pill m-pill-live"><span className="m-pill-dot" />Live Transcript</span>
  : phase === "dialing" ? <span className="m-pill m-pill-warn">Dialing…</span>
  :                       <span className="m-pill">Ready</span>;

  const moodPill =
    phase === "live"    ? <span className="m-pill m-pill-warn" style={{ color: "#ff8a65" }}>EVI · Empathy</span>
  :                       <span className="m-pill">GPT-5 ensemble</span>;

  return (
    <MobileShell title="ATOM">
      <div className="m-stack-lg">
        {/* Configure card (idle only) */}
        {phase === "idle" && (
          <div className="m-card">
            <div className="m-card-eyebrow">New call</div>
            <div className="m-stack" style={{ marginTop: 12 }}>
              <div>
                <label className="m-label">Lead first name</label>
                <input className="m-input" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Sam" />
              </div>
              <div>
                <label className="m-label">Phone</label>
                <input className="m-input" type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+1 555 0100" />
              </div>
              <div>
                <label className="m-label">Product</label>
                <select className="m-input" value={product} onChange={(e) => setProduct(e.target.value)}>
                  {ATOM_PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              {isCustom(product) && (
                <div>
                  <label className="m-label">Custom product name</label>
                  <input className="m-input" value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="PhysioPS, Akamai, Five9…" />
                </div>
              )}
              <div>
                <label className="m-label">Deal value (USD)</label>
                <input className="m-input" inputMode="numeric" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="50000" />
                {gpt5Eligible && (
                  <div className="m-row" style={{ marginTop: 8 }}>
                    <span className="m-pill m-pill-live" style={{ textTransform: "none", letterSpacing: "0.04em" }}>
                      GPT-5 (1M context) eligible
                    </span>
                  </div>
                )}
              </div>
              <button
                className="m-btn m-btn-primary"
                onClick={handleDial}
                disabled={!leadPhone || (isCustom(product) && !customText.trim())}
              >
                <PhoneCall size={18} /> Dial with ATOM
              </button>
            </div>
          </div>
        )}

        {/* Active call card */}
        {(phase === "live" || phase === "dialing" || phase === "ended") && (
          <>
            <div className="m-card">
              <div className="m-row-btw">
                {stagePill}
                {moodPill}
              </div>

              <div className="m-transcript">
                {transcript.length === 0 ? (
                  <div className="m-text-muted" style={{ fontSize: 14 }}>Listening…</div>
                ) : (
                  transcript.map((t, i) => (
                    <div key={i}>
                      <div className={`m-bubble-label${t.role === "atom" ? " is-atom" : ""}`}>
                        {t.role === "atom" ? "ATOM" : "Caller"}
                      </div>
                      <div className="m-bubble">{t.text}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="m-card" style={{ marginTop: 16, padding: 14, borderRadius: 16 }}>
                <div className={`m-wave${phase === "live" ? "" : ""}`}>
                  {bars.map((h, i) => (
                    <div key={i} className="m-wave-bar" style={{ height: `${h}%`, opacity: phase === "live" ? 0.8 : 0.45 }} />
                  ))}
                </div>
              </div>

              <div className="m-stack" style={{ marginTop: 16 }}>
                <button className="m-btn m-btn-primary" onClick={phase === "live" ? handleHangup : undefined} disabled={phase === "dialing"}>
                  {phase === "live"    ? <><PhoneOff size={18} /> End call</> :
                   phase === "dialing" ? <><PhoneCall size={18} /> Dialing…</> :
                                         <><PhoneCall size={18} /> Ended</>}
                </button>
                <button className="m-btn m-btn-ghost" onClick={() => setMuted((v) => !v)}>
                  {muted ? <><MicOff size={18} /> Unmute mic</> : <><Mic size={18} /> Mute mic</>}
                </button>
                <button className="m-btn m-btn-ghost" onClick={() => setSpeakerMuted((v) => !v)}>
                  {speakerMuted ? <><VolumeX size={18} /> Speaker off</> : <><Volume2 size={18} /> Mute preview</>}
                </button>
              </div>
            </div>

            {/* First-token KPI */}
            <div className="m-card">
              <div style={{ textAlign: "center" }}>
                <div className="m-kpi m-kpi-lg" style={{ fontSize: 56 }}>{firstTokenMs}<span style={{ fontSize: 22 }}>ms</span></div>
                <div className="m-eyebrow" style={{ marginTop: 6 }}>First token</div>
              </div>
              <div className="m-divider" />
              <div className="m-grid-2">
                <div>
                  <div className="m-eyebrow">Elapsed</div>
                  <div className="m-mono" style={{ fontSize: 18, marginTop: 4 }}>
                    {Math.floor(elapsedS / 60).toString().padStart(2, "0")}:{(elapsedS % 60).toString().padStart(2, "0")}
                  </div>
                </div>
                <div>
                  <div className="m-eyebrow">Lead</div>
                  <div className="m-row" style={{ marginTop: 4, gap: 6, fontSize: 14 }}>
                    <User size={14} className="m-text-muted" />
                    <span>{leadName || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}
