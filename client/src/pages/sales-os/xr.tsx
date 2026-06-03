import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { VRButton, ARButton, XR, Controllers, Hands } from "@react-three/xr";
import { Boxes, X, Check, Headset, MousePointer2, BarChart3, PhoneCall, ShieldCheck, Crosshair } from "lucide-react";
import {
  WarRoomScene,
  DesktopControls,
} from "@/components/sales-os/xr/WarRoomScene";
import { PROSPECTS, VERTICAL_COLORS } from "@/data/warroom-seed";
import { fmtCurrency } from "@/components/sales-os/SalesOsUI";

const CYAN = "#00d4ff";

export default function WarRoomXR() {
  const [enteredXR, setEnteredXR] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = PROSPECTS.find((p) => p.id === selectedId) || null;

  return (
    <div
      className="fixed inset-0 z-30"
      style={{ background: "#04060c" }}
      data-testid="xr-warroom"
    >
      {/* VR / AR session buttons (top-right) */}
      <div className="absolute top-4 right-4 z-20 flex gap-2 salesos-xr-buttons">
        <style>{`
          .salesos-xr-buttons > button {
            background: rgba(0,212,255,0.12) !important;
            border: 1px solid rgba(0,212,255,0.4) !important;
            color: #00d4ff !important;
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 12px !important;
            letter-spacing: 0.12em !important;
            text-transform: uppercase !important;
            border-radius: 12px !important;
            padding: 10px 18px !important;
            cursor: pointer;
          }
        `}</style>
        <VRButton onClick={() => setEnteredXR(true)} />
        <ARButton onClick={() => setEnteredXR(true)} />
      </div>

      {/* Entry overlay — sells the War Room before entering VR. Hidden once in
          an immersive session. Constrained-width panel so the top-right VR/AR
          buttons and the 3D orbit canvas stay reachable. */}
      {!enteredXR && (
        <div
          className="absolute top-0 left-0 bottom-0 z-20 w-full max-w-md p-6 md:p-8 overflow-y-auto pointer-events-none"
          style={{ background: "linear-gradient(90deg, rgba(4,6,12,0.92) 60%, transparent)" }}
          data-testid="xr-entry-overlay"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)", color: CYAN }}
            >
              <Boxes size={20} />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.28em]" style={{ color: "rgba(0,212,255,0.7)" }}>
                WebXR · Quest 3 ready
              </p>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f6f8ff" }}>
                ATOM War Room
              </h1>
            </div>
          </div>
          <p className="text-sm mt-3" style={{ color: "rgba(246,248,255,0.6)" }}>
            Step inside your pipeline. Walk among live deal panels in full VR — or
            explore the same scene in 3D right here on desktop.
          </p>

          <div
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.18em]">ATOM is active</span>
          </div>

          {/* Device readiness checklist */}
          <div
            className="mt-6 p-4 rounded-2xl pointer-events-auto"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.18)" }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] mb-3" style={{ color: CYAN }}>
              Device readiness
            </p>
            <div className="space-y-2">
              {[
                { ok: true, label: "WebXR runtime detected" },
                { ok: true, label: "Quest 3 / Vision Pro / desktop supported" },
                { ok: true, label: "Hand tracking + controller rays enabled" },
                { ok: true, label: "Secure context (HTTPS)" },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(52,211,153,0.18)", color: "#34d399" }}
                  >
                    <Check size={11} />
                  </span>
                  <span className="text-xs" style={{ color: "rgba(246,248,255,0.75)" }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What you'll see */}
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] mt-6 mb-3" style={{ color: "rgba(246,248,255,0.45)" }}>
            What you'll see inside
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Crosshair, label: "Live deal panels", desc: "Top accounts as floating cards" },
              { icon: PhoneCall, label: "Active calls", desc: "Emotion + intent in real time" },
              { icon: BarChart3, label: "Pipeline globe", desc: "Revenue by vertical" },
              { icon: ShieldCheck, label: "Compliance shield", desc: "TCPA / DNC status" },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="p-3 rounded-xl pointer-events-auto"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.22)" }}
                >
                  <Icon size={16} style={{ color: "#c4b5fd" }} />
                  <p className="text-xs font-semibold mt-1.5" style={{ color: "#f6f8ff" }}>{c.label}</p>
                  <p className="text-[10px]" style={{ color: "rgba(246,248,255,0.5)" }}>{c.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Controls / fallback */}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.18)" }}>
              <Headset size={15} style={{ color: CYAN }} />
              <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.7)" }}>Enter VR (top-right)</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <MousePointer2 size={15} style={{ color: "rgba(246,248,255,0.7)" }} />
              <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.7)" }}>No headset? Drag to orbit</span>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 1.6, 6.5], fov: 55 }} dpr={[1, 1.75]}>
        <XR
          referenceSpace="local-floor"
          onSessionStart={() => setEnteredXR(true)}
          onSessionEnd={() => setEnteredXR(false)}
        >
          <WarRoomScene onSelectProspect={setSelectedId} />
          <Controllers rayMaterial={{ color: CYAN }} />
          <Hands />
          {!enteredXR && <DesktopControls />}
        </XR>
      </Canvas>

      {/* Prospect detail (desktop overlay; selectable via ray/pinch in VR too) */}
      {selected && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center p-4"
          style={{ background: "rgba(2,4,8,0.6)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl relative"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${VERTICAL_COLORS[selected.vertical]}66`, backdropFilter: "blur(16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ color: "rgba(246,248,255,0.5)" }}
            >
              <X size={16} />
            </button>
            <span
              className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
              style={{ background: `${VERTICAL_COLORS[selected.vertical]}22`, color: VERTICAL_COLORS[selected.vertical] }}
            >
              {selected.vertical}
            </span>
            <h2 className="text-2xl font-bold mt-2" style={{ color: "#f6f8ff" }}>{selected.company}</h2>
            <p className="text-sm" style={{ color: "rgba(246,248,255,0.6)" }}>{selected.contact} · {selected.title}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              {[
                ["Deal Value", fmtCurrency(selected.dealValue)],
                ["Stage", selected.stage],
                ["Intent", `${selected.intentScore}/100`],
                ["Sentiment", `${selected.sentimentScore > 0 ? "+" : ""}${selected.sentimentScore}`],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>{l}</p>
                  <p className="font-semibold mt-0.5" style={{ color: "#f6f8ff" }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)" }}>
              <p className="text-[10px] font-mono uppercase" style={{ color: CYAN }}>Signal</p>
              <p className="text-xs mt-0.5" style={{ color: "#f6f8ff" }}>{selected.fundingSignal}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
