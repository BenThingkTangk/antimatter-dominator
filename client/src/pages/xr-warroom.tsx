/**
 * /xr/warroom — ATOM War Room WebXR scene (SUBAGENT C).
 *
 * A-Frame v1.7 scene wrapped in React. Loads on a single URL across:
 *  - Quest / immersive-vr browsers  → A-Frame auto-injects an "Enter VR" button.
 *  - Desktop / non-XR browsers      → 3D scene with mouse + WASD look controls.
 *  - Any fallback                   → flat 3D render; never crashes if WebXR absent.
 *
 * Five zones laid out around a circular dark command room:
 *   1 PIPELINE   (left wall  ~270°)  — 10 floating deal cards
 *   2 CALLS      (right wall  ~90°)  — 5 call records, one REPLAY-able
 *   3 CAMPAIGNS  (front wall   0°)   — active campaign + timeline + LAUNCH
 *   4 BUYER INTEL(above center)      — territory globe with 10 urgency dots
 *   5 REVENUE    (back wall  ~180°)  — MRR ticker, bar chart, close-rate donut
 *
 * A-Frame is dynamically imported (browser-only) so the heavy bundle is not
 * pulled into the main app chunk and never executes during SSR/build.
 */
import { useEffect, useRef, useState } from "react";
import {
  XR_PROSPECTS,
  XR_CALLS,
  XR_CAMPAIGN,
  XR_REVENUE,
  URGENCY_COLOR,
  fmtMoney,
} from "@/lib/warroom-xr-data";

const CYAN = "#00FFFF";
const NAVY = "#070B16";
const PANEL = "#0D1526";
const PANEL_BORDER = "#16D6E6";

export default function XrWarRoom() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [hover, setHover] = useState<{ name: string; company: string; score: number; touch: string } | null>(null);

  // Boot A-Frame (browser-only, once).
  useEffect(() => {
    let cancelled = false;
    import("@/lib/warroom-xr-aframe")
      .then((m) => m.ensureAFrame())
      .then((AFRAME) => {
        if (cancelled) return;
        if (!AFRAME) { setFailed(true); return; }
        setReady(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // 3s cinematic intro gate (logo fade → room reveal).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setIntroDone(true), 3000);
    return () => clearTimeout(t);
  }, [ready]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3 px-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
          War Room couldn't initialize
        </h1>
        <p className="text-sm text-white/45 max-w-md">
          WebXR / WebGL is unavailable in this browser. Open <code className="font-mono text-white/60">/xr/warroom</code> in
          a WebGL-capable browser or a Quest headset to enter the immersive command center.
        </p>
        <a href="#/war-room" className="text-[var(--color-primary)] underline text-sm">Open the 2D War Room instead →</a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" style={{ background: NAVY }}>
        <div className="w-14 h-14 rounded-2xl animate-pulse" style={{ background: "color-mix(in oklab, var(--color-primary) 22%, transparent)", boxShadow: "0 0 60px var(--color-primary-glow)" }} />
        <p className="text-[12px] font-mono tracking-[0.25em] uppercase text-white/40">Initializing War Room…</p>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: NAVY }}>
      {/* Cinematic intro overlay — fades the ATOM logo then dissolves to reveal */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: NAVY,
          pointerEvents: introDone ? "none" : "auto",
          opacity: introDone ? 0 : 1,
          transition: "opacity 900ms ease",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 64,
            letterSpacing: "-2px",
            color: CYAN,
            textShadow: `0 0 60px ${CYAN}`,
            animation: "atomxr-pop 3s ease forwards",
          }}
        >
          ΔTOM
        </div>
        <p className="text-[12px] font-mono tracking-[0.3em] uppercase text-white/40">War Room · Initializing Command Theater</p>
      </div>

      <style>{`
        @keyframes atomxr-pop {
          0%   { opacity: 0; transform: scale(0.6); filter: blur(8px); }
          40%  { opacity: 1; transform: scale(1);   filter: blur(0); }
          75%  { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(2.6); filter: blur(6px); }
        }
      `}</style>

      {/* Selected prospect profile panel (DOM overlay, fed from in-scene clicks) */}
      {selected !== null && (
        <ProspectProfile index={selected} onClose={() => setSelected(null)} />
      )}

      {/* Buyer-intel hover mini-card (DOM overlay) */}
      {hover && (
        <div
          style={{
            position: "absolute", top: 70, right: 24, zIndex: 61,
            background: "rgba(8,12,22,0.92)", border: `1px solid ${PANEL_BORDER}`,
            borderRadius: 12, padding: "12px 16px", minWidth: 220,
            boxShadow: `0 0 40px rgba(0,255,255,0.18)`,
          }}
        >
          <p className="text-[13px] font-bold" style={{ color: CYAN }}>{hover.name}</p>
          <p className="text-[12px] text-white/70">{hover.company}</p>
          <p className="text-[11px] text-white/45 mt-1">Score <span className="text-white/80">{hover.score}</span></p>
          <p className="text-[11px] text-white/45">Last ATOM touch · <span className="text-white/70">{hover.touch}</span></p>
        </div>
      )}

      <Scene
        onSelectProspect={(i) => setSelected(i)}
        onHoverDot={setHover}
        onLeaveDot={() => setHover(null)}
      />
    </div>
  );
}

// ─── Prospect profile overlay ─────────────────────────────────────────────────
function ProspectProfile({ index, onClose }: { index: number; onClose: () => void }) {
  const p = XR_PROSPECTS[index];
  if (!p) return null;
  return (
    <div
      style={{
        position: "absolute", inset: 0, zIndex: 62,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(4,7,14,0.6)", backdropFilter: "blur(2px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380, background: PANEL, border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 16, padding: 24, boxShadow: `0 0 80px rgba(0,255,255,0.22)`,
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: URGENCY_COLOR[p.urgency] }}>{p.urgency} prospect</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        <h2 className="text-2xl font-bold mt-2" style={{ color: "#fff", fontFamily: "var(--font-display)" }}>{p.name}</h2>
        <p className="text-sm text-white/55">{p.company}</p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <Stat label="Deal Value" value={fmtMoney(p.value)} />
          <Stat label="Stage" value={p.stage} />
          <Stat label="ATOM Score" value={String(p.score)} />
          <Stat label="Agent" value="ATOM-VC" />
        </div>
        <div className="mt-5">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div style={{ width: `${p.score}%`, height: "100%", background: CYAN, boxShadow: `0 0 12px ${CYAN}` }} />
          </div>
          <p className="text-[10px] text-white/35 mt-1 font-mono">CONVICTION {p.score}/100</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/35">{label}</p>
      <p className="text-[14px] font-semibold text-white/90 mt-0.5">{value}</p>
    </div>
  );
}

// ─── The A-Frame scene ─────────────────────────────────────────────────────────
function Scene({
  onSelectProspect,
  onHoverDot,
  onLeaveDot,
}: {
  onSelectProspect: (i: number) => void;
  onHoverDot: (p: { name: string; company: string; score: number; touch: string }) => void;
  onLeaveDot: () => void;
}) {
  const sceneRef = useRef<HTMLElement | null>(null);

  // Wire DOM event listeners from in-scene clickable entities to React state.
  useEffect(() => {
    const root = sceneRef.current;
    if (!root) return;
    const onClick = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      const target = (e.target as HTMLElement) || null;
      const idxAttr = target?.getAttribute?.("data-prospect-index");
      if (idxAttr != null) onSelectProspect(parseInt(idxAttr, 10));
    };
    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement;
      const i = t?.getAttribute?.("data-dot-index");
      if (i != null) {
        const p = XR_PROSPECTS[parseInt(i, 10)];
        if (p) onHoverDot({ name: p.name, company: p.company, score: p.score, touch: lastTouch(parseInt(i, 10)) });
      }
    };
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t?.getAttribute?.("data-dot-index") != null) onLeaveDot();
    };
    root.addEventListener("click", onClick, true);
    root.addEventListener("mouseenter", onEnter, true);
    root.addEventListener("mouseleave", onLeave, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("mouseenter", onEnter, true);
      root.removeEventListener("mouseleave", onLeave, true);
    };
  }, [onSelectProspect, onHoverDot, onLeaveDot]);

  return (
    <a-scene
      ref={sceneRef as any}
      embedded
      vr-mode-ui="enabled: true"
      device-orientation-permission-ui="enabled: true"
      background={`color: ${NAVY}`}
      renderer="colorManagement: true; antialias: true; highRefreshRate: true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* Ambient + cyan accent lighting (dark blue room) */}
      <a-entity light="type: ambient; color: #11304a; intensity: 0.7" />
      <a-entity light="type: point; color: #00FFFF; intensity: 0.55; distance: 30; decay: 1" position="0 5 0" />
      <a-entity light="type: point; color: #0a7fff; intensity: 0.35; distance: 24" position="0 2 -8" />
      <a-entity light="type: point; color: #00FFFF; intensity: 0.3; distance: 20" position="-8 2 0" />
      <a-entity light="type: point; color: #00FFFF; intensity: 0.3; distance: 20" position="8 2 0" />

      {/* Grid floor with cyan glow lines */}
      <a-entity
        geometry="primitive: circle; radius: 14"
        material={`shader: standard; color: #04060d; metalness: 0.2; roughness: 0.9`}
        rotation="-90 0 0"
        position="0 0 0"
      />
      <GridFloor />

      {/* Circular wall shell (deep navy, inward-facing) */}
      <a-entity
        geometry="primitive: cylinder; radius: 13.5; height: 8; openEnded: true; segmentsRadial: 64"
        material="color: #060912; side: back; metalness: 0.3; roughness: 0.85; opacity: 0.96; transparent: true"
        position="0 4 0"
      />

      {/* Slow-rotating ambient starfield / data points */}
      <a-entity starfield="count: 900; radius: 30; color: #2bd6ff" position="0 4 0" />

      {/* Camera rig with desktop look-controls + Quest gaze cursor (fuse).
          movement-controls (aframe-extras) unifies keyboard / gamepad / touch
          locomotion and is a safe no-op when no input device is present.
          aframe-extras 7.x ships no standalone teleport, so cross-zone
          navigation uses the stable NavPads waypoints below instead. */}
      <a-entity id="rig" position="0 1.6 0" movement-controls="speed: 0.25; fly: false">
        <a-camera
          look-controls="pointerLockEnabled: false"
          wasd-controls="acceleration: 28"
          position="0 0 0"
        >
          <a-cursor
            fuse="true"
            fuse-timeout="1500"
            raycaster="objects: .clickable; far: 30"
            material="color: #00FFFF; shader: flat"
            geometry="primitive: ring; radiusInner: 0.012; radiusOuter: 0.02"
            position="0 0 -1"
          />
        </a-camera>
      </a-entity>

      {/* Quest controllers + hand tracking (all no-op if absent on device).
          laser-controls gives a pointer ray; hand-tracking-controls enables
          bare-hand pinch select when the headset reports hand joints. */}
      <a-entity laser-controls="hand: left" raycaster="objects: .clickable; far: 30" hand-tracking-controls="hand: left" />
      <a-entity laser-controls="hand: right" raycaster="objects: .clickable; far: 30" hand-tracking-controls="hand: right" />

      {/* Navigation waypoint pads between zones (stable, non-teleport-dependent) */}
      <NavPads />

      {/* ── ZONE 1 — PIPELINE (left wall ~270° = −X) ──────────────────────── */}
      <ZonePipeline />

      {/* ── ZONE 2 — CALLS (right wall ~90° = +X) ─────────────────────────── */}
      <ZoneCalls />

      {/* ── ZONE 3 — CAMPAIGNS (front wall, center, −Z) ───────────────────── */}
      <ZoneCampaigns />

      {/* ── ZONE 4 — BUYER INTEL (above center) ───────────────────────────── */}
      <ZoneBuyerIntel />

      {/* ── ZONE 5 — REVENUE (back wall ~180° = +Z) ───────────────────────── */}
      <ZoneRevenue />
    </a-scene>
  );
}

function lastTouch(i: number): string {
  const days = ["2h ago", "1d ago", "3d ago", "5h ago", "yesterday", "4d ago", "1w ago", "6h ago", "today", "2d ago"];
  return days[i % days.length];
}

// ─── Grid floor ────────────────────────────────────────────────────────────────
function GridFloor() {
  const lines: JSX.Element[] = [];
  const span = 13;
  for (let i = -span; i <= span; i += 1) {
    lines.push(
      <a-entity
        key={`gx${i}`}
        geometry="primitive: plane; width: 0.02; height: 26"
        material={`color: ${CYAN}; shader: flat; opacity: 0.12; transparent: true`}
        rotation="-90 0 0"
        position={`${i} 0.01 0`}
      />,
    );
    lines.push(
      <a-entity
        key={`gz${i}`}
        geometry="primitive: plane; width: 26; height: 0.02"
        material={`color: ${CYAN}; shader: flat; opacity: 0.12; transparent: true`}
        rotation="-90 0 0"
        position={`0 0.01 ${i}`}
      />,
    );
  }
  return <a-entity position="0 0 0">{lines}</a-entity>;
}

// ─── Navigation pads ─────────────────────────────────────────────────────────
function NavPads() {
  const pads = [
    { label: "PIPELINE", pos: "-4 0.03 0" },
    { label: "CALLS", pos: "4 0.03 0" },
    { label: "CAMPAIGNS", pos: "0 0.03 -4" },
    { label: "REVENUE", pos: "0 0.03 4" },
    { label: "CENTER", pos: "0 0.03 0" },
  ];
  return (
    <a-entity>
      {pads.map((p) => (
        <a-entity key={p.label} class="clickable" position={p.pos}>
          <a-ring
            class="clickable"
            radius-inner="0.35"
            radius-outer="0.5"
            rotation="-90 0 0"
            material={`color: ${CYAN}; shader: flat; opacity: 0.35; transparent: true`}
            hover-glow="scale: 1.15"
          />
          <a-text value={p.label} align="center" width="3" color="#7fe9ff" position="0 0.02 0.7" rotation="-90 0 0" />
        </a-entity>
      ))}
    </a-entity>
  );
}

// ─── ZONE 1 — Pipeline ─────────────────────────────────────────────────────────
function ZonePipeline() {
  return (
    <a-entity position="-9 1.2 0" rotation="0 90 0">
      <a-text value="PIPELINE" align="center" width="10" color={CYAN} position="0 4.6 0" />
      {XR_PROSPECTS.map((p, i) => {
        const col = 0; // single vertical stack
        const y = 3.8 - i * 0.78;
        return (
          <a-entity
            key={p.company}
            class="clickable"
            data-prospect-index={i}
            position={`${col} ${y} 0`}
            hover-glow="scale: 1.05"
          >
            <a-box
              class="clickable"
              data-prospect-index={i}
              depth="0.05"
              height="0.66"
              width="3.4"
              material={`color: ${PANEL}; emissive: #07212b; emissiveIntensity: 0.4; metalness: 0.3; roughness: 0.6`}
            />
            <a-box depth="0.06" height="0.2" width="0.9" position="1.05 0.16 0.04" material={`color: ${URGENCY_COLOR[p.urgency]}; shader: flat; opacity: 0.85; transparent: true`} />
            <a-text value={p.stage} align="center" width="3.2" color="#04141a" position="1.05 0.16 0.08" />
            <a-box depth="0.06" height="0.34" width="0.34" position="-1.45 0 0.04" material={`color: ${CYAN}; shader: flat; opacity: 0.85; transparent: true`} />
            <a-text value={`${p.name}  ·  ${p.company}`} width="5.2" color="#dff7ff" position="-1.15 0.12 0.05" />
            <a-text value={`${fmtMoney(p.value)}   ATOM-VC`} width="5" color="#7fe9ff" position="-1.15 -0.16 0.05" />
          </a-entity>
        );
      })}
    </a-entity>
  );
}

// ─── ZONE 2 — Calls ──────────────────────────────────────────────────────────
function ZoneCalls() {
  return (
    <a-entity position="9 1.4 0" rotation="0 -90 0">
      <a-text value="CALLS" align="center" width="10" color={CYAN} position="0 3.4 0" />
      {XR_CALLS.map((c, i) => {
        const y = 2.6 - i * 0.95;
        const sentColor = c.sentiment >= 70 ? "#27e0a0" : c.sentiment >= 45 ? "#FFC83B" : "#FF3B5C";
        return (
          <a-entity key={c.prospect} class="clickable" position={`0 ${y} 0`} hover-glow="scale: 1.05">
            <a-box class="clickable" depth="0.05" height="0.8" width="3.6" material={`color: ${PANEL}; emissive: #07212b; emissiveIntensity: 0.4`} />
            <a-text value={c.prospect} width="4.6" color="#dff7ff" position="-1.5 0.24 0.05" />
            <a-text value={`${c.duration}  ·  ${c.outcome}`} width="4.4" color="#9fdcff" position="-1.5 0.0 0.05" />
            {/* sentiment bar */}
            <a-box depth="0.04" height="0.1" width={`${(c.sentiment / 100) * 2.8}`} position={`${-1.5 + ((c.sentiment / 100) * 2.8) / 2} -0.24 0.05`} material={`color: ${sentColor}; shader: flat`} />
            {c.replay && (
              <>
                {/* REPLAY badge — click triggers waveform + sentiment rings */}
                <a-entity class="clickable" position="1.45 0.24 0.06" replay-trigger>
                  <a-box class="clickable" depth="0.06" height="0.22" width="0.9" material={`color: ${CYAN}; shader: flat`} hover-glow="scale: 1.1" />
                  <a-text value="REPLAY" align="center" width="3.4" color="#04141a" position="0 0 0.05" />
                </a-entity>
                {/* waveform that animates on replay */}
                <a-entity waveform="bars: 24; color: #00FFFF; width: 2.6" position="0 -0.5 0.06" id="callWaveform" />
                {/* pulsing sentiment rings */}
                <a-ring radius-inner="0.45" radius-outer="0.5" position="1.45 0.24 0.02" material={`color: ${sentColor}; shader: flat; transparent: true`} pulse="speed: 3; min: 0.2; max: 0.8" />
              </>
            )}
          </a-entity>
        );
      })}
      {/* Wire REPLAY click → emit `replay` on the waveform. Handled inline below. */}
      <EmitOnClick triggerAttr="replay-trigger" targetId="callWaveform" event="replay" />
    </a-entity>
  );
}

// Bridges a DOM click on any element under [triggerAttr] to an A-Frame custom
// event on the entity #targetId — the in-scene way to fire scripted animations.
function EmitOnClick({ triggerAttr, targetId, event }: { triggerAttr: string; targetId: string; event: string }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.(`[${triggerAttr}]`)) {
        (document.getElementById(targetId) as any)?.emit?.(event);
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [triggerAttr, targetId, event]);
  return null;
}

// ─── ZONE 3 — Campaigns ────────────────────────────────────────────────────────
function ZoneCampaigns() {
  const { name, steps } = XR_CAMPAIGN;
  return (
    <a-entity position="0 1.8 -9">
      <a-text value="ACTIVE CAMPAIGN" align="center" width="8" color={CYAN} position="0 2.7 0" />
      <a-box depth="0.05" height="1.0" width="6" position="0 1.9 0" material={`color: ${PANEL}; emissive: #07212b; emissiveIntensity: 0.5`} />
      <a-text value={name} align="center" width="7" color="#eafdff" position="0 2.05 0.06" />
      <a-text value="STATUS · ACTIVE" align="center" width="5" color="#27e0a0" position="0 1.7 0.06" />

      {steps.map((s, i) => {
        const x = -4 + i * 2;
        return (
          <a-entity key={s.label} position={`${x} 0.9 0`}>
            <a-sphere radius="0.22" material={`color: ${CYAN}; emissive: #00FFFF; emissiveIntensity: 0.8; shader: standard`} pulse="speed: 2; min: 0.55; max: 1" />
            {i < steps.length - 1 && (
              <a-box depth="0.02" height="0.03" width="1.55" position="1 0 0" material={`color: ${CYAN}; shader: flat; opacity: 0.4; transparent: true`} />
            )}
            <a-text value={s.label} align="center" width="3.4" color="#cdeeff" position="0 0.45 0" />
            <a-text value={`${s.sent} sent / ${s.responded} rep`} align="center" width="3" color="#7fb8d6" position="0 -0.45 0" />
          </a-entity>
        );
      })}

      <a-entity class="clickable" position="0 0 0" launch-trigger>
        <a-box class="clickable" depth="0.08" height="0.4" width="2.6" material={`color: ${CYAN}; emissive: #00FFFF; emissiveIntensity: 0.6; shader: standard`} hover-glow="scale: 1.08" />
        <a-text value="LAUNCH CAMPAIGN" align="center" width="4" color="#04141a" position="0 0 0.06" />
        <a-entity particle-burst="count: 160; color: #00FFFF" position="0 0 0.1" id="launchBurst" />
      </a-entity>
      <EmitOnClick triggerAttr="launch-trigger" targetId="launchBurst" event="burst" />
    </a-entity>
  );
}

// ─── ZONE 4 — Buyer Intel (globe above center) ──────────────────────────────────
function ZoneBuyerIntel() {
  // Distribute 10 dots over a sphere surface deterministically.
  return (
    <a-entity position="0 5.4 0">
      <a-text value="BUYER INTEL" align="center" width="9" color={CYAN} position="0 1.7 0" />
      <a-sphere radius="1.2" material="color: #0a2236; emissive: #0a3b5a; emissiveIntensity: 0.5; opacity: 0.85; transparent: true; wireframe: true" rotation="0 0 0">
        <a-entity animation="property: rotation; to: 0 360 0; loop: true; dur: 40000; easing: linear" />
      </a-sphere>
      <a-entity animation="property: rotation; to: 0 360 0; loop: true; dur: 40000; easing: linear">
        {XR_PROSPECTS.map((p, i) => {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / XR_PROSPECTS.length);
          const theta = Math.PI * (1 + Math.sqrt(5)) * i;
          const r = 1.25;
          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.cos(phi);
          const z = r * Math.sin(phi) * Math.sin(theta);
          return (
            <a-sphere
              key={p.company}
              class="clickable"
              data-dot-index={i}
              radius="0.07"
              position={`${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`}
              material={`color: ${URGENCY_COLOR[p.urgency]}; emissive: ${URGENCY_COLOR[p.urgency]}; emissiveIntensity: 0.9; shader: standard`}
              hover-glow="scale: 1.8"
            />
          );
        })}
      </a-entity>
    </a-entity>
  );
}

// ─── ZONE 5 — Revenue (back wall +Z) ────────────────────────────────────────────
function ZoneRevenue() {
  const { mrr, closeRate, bars } = XR_REVENUE;
  const maxBar = Math.max(...bars.map((b) => b.value));
  const donutPct = Math.round(closeRate * 100);
  return (
    <a-entity position="0 1.8 9" rotation="0 180 0">
      <a-text value="REVENUE" align="center" width="9" color={CYAN} position="0 3.0 0" />
      {/* dashboard panel */}
      <a-box depth="0.05" height="2.6" width="6.4" position="0 1.4 0" material={`color: ${PANEL}; emissive: #07212b; emissiveIntensity: 0.45`} />

      {/* MRR ticker (count-up) */}
      <a-text value="MRR" align="center" width="5" color="#7fb8d6" position="-2 2.35 0.06" />
      <a-text align="center" width="9" color={CYAN} position="-2 2.0 0.06" count-up={`to: ${mrr}; dur: 1800; prefix: $; compact: true`} value="$0" />

      {/* close-rate donut */}
      <a-text value="CLOSE RATE" align="center" width="5" color="#7fb8d6" position="2 2.35 0.06" />
      <a-ring radius-inner="0.32" radius-outer="0.46" position="2 1.85 0.06" theta-length={`${donutPct * 3.6}`} material={`color: ${CYAN}; shader: flat; side: double`} />
      <a-ring radius-inner="0.32" radius-outer="0.46" position="2 1.85 0.05" material="color: #133; shader: flat; opacity: 0.4; transparent: true; side: double" />
      <a-text align="center" width="6" color="#eafdff" position="2 1.85 0.07" count-up={`to: ${donutPct}; dur: 1500; suffix: %`} value="0%" />

      {/* 3D pipeline bar chart */}
      {bars.map((b, i) => {
        const h = 0.2 + (b.value / maxBar) * 1.1;
        const x = -2.4 + i * 1.2;
        return (
          <a-entity key={b.label} position={`${x} 0.4 0.1`}>
            <a-box depth="0.3" width="0.5" height={`${h}`} position={`0 ${h / 2} 0`} material={`color: ${CYAN}; emissive: #008c99; emissiveIntensity: 0.5; opacity: 0.92; transparent: true`} />
            <a-text value={b.label} align="center" width="2.6" color="#9fdcff" position="0 -0.05 0.2" />
          </a-entity>
        );
      })}

      {/* Powered-by badge with pulse */}
      <a-entity position="0 -0.15 0.1">
        <a-box depth="0.04" height="0.3" width="4.4" material={`color: #0a1b2e; emissive: #00FFFF; emissiveIntensity: 0.25`} pulse="speed: 1.6; min: 0.55; max: 1" />
        <a-text value="Powered by Akamai Blackwell GPU" align="center" width="5.2" color="#7fe9ff" position="0 0 0.05" />
      </a-entity>
    </a-entity>
  );
}
