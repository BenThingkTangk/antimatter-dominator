/**
 * MobileDial — voice / live-call screen with live sentiment + buyer intent.
 *
 * Configure card: Lead First Name, Lead Last Name, Phone, Product
 * (Custom Product reveals a free-text input).
 *
 * Active call card: stage pill, mood pill, transcript bubbles, waveform,
 * primary controls, **live sentiment + buyer intent gauges** that poll
 * /api/atom-leadgen/chat-events every 1.5s — same data source as the
 * desktop call screen, just rendered for a phone.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, PhoneCall, PhoneOff, User, TrendingUp, Heart } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { ATOM_PRODUCTS, resolveProductLabel, isCustom } from "../../lib/atom-products";
import { useTenant } from "../../lib/useTenant";

interface TranscriptEntry { role: "atom" | "caller"; text: string; }

const BASE_BARS = [22, 14, 38, 52, 28, 44, 68, 54, 70, 62, 80, 72, 76, 64, 58, 46, 38, 30, 42, 54, 34, 22, 14, 8];

function usePulseBars(active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(BASE_BARS);
  useEffect(() => {
    if (!active) { setBars(BASE_BARS); return; }
    const id = setInterval(() => {
      setBars(() => BASE_BARS.map((base) => {
        const jitter = (Math.random() - 0.5) * 28;
        return Math.max(6, Math.min(96, base + jitter));
      }));
    }, 140);
    return () => clearInterval(id);
  }, [active]);
  return bars;
}

type CallPhase = "idle" | "dialing" | "live" | "ended";

const STAGE_NAMES = ["Discovery", "Evaluation", "Negotiation", "Close"] as const;

function sentimentLabel(v: number): string {
  if (v >= 80) return "Very Positive";
  if (v >= 55) return "Positive";
  if (v >= 35) return "Neutral";
  if (v >= 15) return "Cool";
  return "Negative";
}
function sentimentColor(v: number): string {
  if (v >= 60) return "#72f2a1";
  if (v >= 35) return "#ffd166";
  return "#ff6b8b";
}
function intentColor(v: number): string {
  if (v >= 70) return "#696aac";
  if (v >= 40) return "#8587e3";
  return "#7b8b8a";
}
function intentLabel(v: number): string {
  if (v >= 80) return "Hot";
  if (v >= 60) return "Strong";
  if (v >= 40) return "Warming";
  if (v >= 20) return "Cool";
  return "Cold";
}

/** SVG ring gauge — 64x64, 0-100 value. */
function Gauge({ value, color, label, sub }: { value: number; color: string; label: string; sub: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const offset = c * (1 - pct);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={32} cy={32} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={5} fill="none" />
          <circle
            cx={32} cy={32} r={r}
            stroke={color}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1), stroke 400ms ease" }}
            filter={`drop-shadow(0 0 8px ${color}66)`}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 18,
          color,
          letterSpacing: "-0.02em",
        }}>
          {Math.round(value)}
        </div>
      </div>
      <div className="m-eyebrow" style={{ textAlign: "center" }}>{label}</div>
      <div style={{ fontSize: 12, color, fontWeight: 600 }}>{sub}</div>
    </div>
  );
}

interface LiveMetrics {
  sentiment: number;
  buyerIntent: number;
  stage: number;
  signals: string[];
}

export default function MobileDial() {
  const { tenant } = useTenant();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [product, setProduct] = useState<string>("atom-platform");
  const [customText, setCustomText] = useState("");
  const [leadFirstName, setLeadFirstName] = useState("");
  const [leadLastName, setLeadLastName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics>({ sentiment: 50, buyerIntent: 30, stage: 1, signals: [] });
  const [sessionId, setSessionId] = useState<string | null>(null);

  const bars = usePulseBars(phase === "live");
  const startedAtRef = useRef<number | null>(null);
  const [elapsedS, setElapsedS] = useState(0);
  const seenTranscriptRef = useRef<Set<string>>(new Set());

  // Pre-fill from MobileLeads (swipe-left)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("m_dial_prefill");
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.firstName ?? p.name) setLeadFirstName((p.firstName ?? p.name) || "");
      if (p.lastName) setLeadLastName(p.lastName);
      if (p.phone) setLeadPhone(p.phone);
      sessionStorage.removeItem("m_dial_prefill");
    } catch {}
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (phase !== "live") return;
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      if (!startedAtRef.current) return;
      setElapsedS(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [phase]);

  // Live metrics + transcript polling
  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/atom-leadgen/chat-events?sessionId=${encodeURIComponent(sessionId)}`);
        if (!r.ok || cancelled) return;
        const d: any = await r.json();
        if (d?.metrics) {
          setMetrics({
            sentiment:    d.metrics.sentiment    ?? 0,
            buyerIntent:  d.metrics.buyerIntent  ?? 0,
            stage:        d.metrics.stage        ?? 1,
            signals:      Array.isArray(d.buyingSignals) ? d.buyingSignals : [],
          });
        }
        if (Array.isArray(d?.transcript)) {
          const incoming: TranscriptEntry[] = [];
          for (const m of d.transcript) {
            const key = `${m.timestamp}|${m.role}|${(m.text || "").slice(0, 24)}`;
            if (seenTranscriptRef.current.has(key)) continue;
            seenTranscriptRef.current.add(key);
            incoming.push({
              role: m.role === "USER" || m.role === "PROSPECT" ? "caller" : "atom",
              text: m.text || "",
            });
          }
          if (incoming.length) setTranscript((prev) => [...prev, ...incoming]);
        }
      } catch { /* keep polling */ }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(id); };
  }, [phase, sessionId]);

  const productLabel = useMemo(() => resolveProductLabel(product, customText), [product, customText]);

  async function handleDial() {
    setPhase("dialing");
    setTranscript([]);
    seenTranscriptRef.current = new Set();
    setMetrics({ sentiment: 50, buyerIntent: 30, stage: 1, signals: [] });
    try {
      const fullName = [leadFirstName, leadLastName].filter(Boolean).join(" ").trim() || "friend";
      const payload = {
        name: fullName,
        firstName: leadFirstName || "friend",
        lastName: leadLastName || "",
        phone: leadPhone,
        product: productLabel,
        tenantSlug: tenant?.slug,
      };
      const res = await fetch("/api/atom-leadgen/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json: any = await res.json();
      const sid: string = json.sessionId || json.humeCustomSessionId || json.callSid;
      if (sid) setSessionId(sid);
      setPhase("live");
    } catch (e) {
      console.error("[MobileDial] call failed:", e);
      setPhase("idle");
    }
  }

  function handleHangup() {
    setPhase("ended");
    setTimeout(() => { setPhase("idle"); setSessionId(null); }, 900);
  }

  const stagePill =
    phase === "live"    ? <span className="m-pill m-pill-live"><span className="m-pill-dot" />Live</span>
  : phase === "dialing" ? <span className="m-pill m-pill-warn">Dialing…</span>
  :                       <span className="m-pill">Ready</span>;

  const stageName = STAGE_NAMES[(metrics.stage || 1) - 1] || "Discovery";

  return (
    <MobileShell title="ΔTOM">
      <div className="m-stack-lg">
        {/* Configure card (idle only) */}
        {phase === "idle" && (
          <div className="m-card">
            <div className="m-card-eyebrow">New call</div>
            <div className="m-stack" style={{ marginTop: 12 }}>
              <div>
                <label className="m-label">Lead first name</label>
                <input className="m-input" value={leadFirstName} onChange={(e) => setLeadFirstName(e.target.value)} placeholder="Sam" autoComplete="given-name" />
              </div>
              <div>
                <label className="m-label">Lead last name</label>
                <input className="m-input" value={leadLastName} onChange={(e) => setLeadLastName(e.target.value)} placeholder="Patel" autoComplete="family-name" />
              </div>
              <div>
                <label className="m-label">Phone</label>
                <input className="m-input" type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+1 555 0100" autoComplete="tel" />
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
              <button
                className="m-btn m-btn-primary"
                onClick={handleDial}
                disabled={!leadPhone || (isCustom(product) && !customText.trim())}
              >
                <PhoneCall size={18} /> Dial with ΔTOM
              </button>
            </div>
          </div>
        )}

        {/* Active call */}
        {(phase === "live" || phase === "dialing" || phase === "ended") && (
          <>
            {/* Live analytics card — sentiment + buyer intent gauges + stage */}
            <div className="m-card m-card-glow">
              <div className="m-row-btw" style={{ marginBottom: 10 }}>
                {stagePill}
                <span className="m-pill" style={{ textTransform: "none", letterSpacing: "0.04em" }}>
                  {stageName}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "6px 0 4px" }}>
                <Gauge
                  value={metrics.sentiment}
                  color={sentimentColor(metrics.sentiment)}
                  label="Sentiment"
                  sub={sentimentLabel(metrics.sentiment)}
                />
                <Gauge
                  value={metrics.buyerIntent}
                  color={intentColor(metrics.buyerIntent)}
                  label="Buyer intent"
                  sub={intentLabel(metrics.buyerIntent)}
                />
              </div>
              <div className="m-row" style={{ gap: 8, marginTop: 14, fontSize: 11, color: "var(--m-text-muted)" }}>
                <Heart size={12} style={{ color: sentimentColor(metrics.sentiment) }} />
                <span style={{ flex: 1 }}>Live emotion read</span>
                <TrendingUp size={12} style={{ color: intentColor(metrics.buyerIntent) }} />
                <span>Updates every 1.5s</span>
              </div>

              {/* Buying signals chips */}
              {metrics.signals.length > 0 && (
                <>
                  <div className="m-divider" />
                  <div className="m-eyebrow" style={{ marginBottom: 8 }}>Buying signals</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {metrics.signals.slice(0, 8).map((s, i) => (
                      <span key={i} className="m-pill m-pill-live" style={{
                        textTransform: "none",
                        letterSpacing: "0.02em",
                        fontWeight: 500,
                        fontSize: 11,
                      }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Transcript + waveform card */}
            <div className="m-card">
              <div className="m-transcript">
                {transcript.length === 0 ? (
                  <div className="m-text-muted" style={{ fontSize: 14 }}>Listening…</div>
                ) : (
                  transcript.slice(-12).map((t, i) => (
                    <div key={i}>
                      <div className={`m-bubble-label${t.role === "atom" ? " is-atom" : ""}`}>
                        {t.role === "atom" ? "ΔTOM" : "Caller"}
                      </div>
                      <div className="m-bubble">{t.text}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="m-card" style={{ marginTop: 16, padding: 14, borderRadius: 16 }}>
                <div className="m-wave">
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

            {/* Compact call meta */}
            <div className="m-card">
              <div className="m-grid-2">
                <div>
                  <div className="m-eyebrow">Elapsed</div>
                  <div className="m-mono" style={{ fontSize: 22, marginTop: 4, color: "#696aac" }}>
                    {Math.floor(elapsedS / 60).toString().padStart(2, "0")}:{(elapsedS % 60).toString().padStart(2, "0")}
                  </div>
                </div>
                <div>
                  <div className="m-eyebrow">Lead</div>
                  <div className="m-row" style={{ marginTop: 4, gap: 6, fontSize: 14 }}>
                    <User size={14} className="m-text-muted" />
                    <span>{[leadFirstName, leadLastName].filter(Boolean).join(" ") || "—"}</span>
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
