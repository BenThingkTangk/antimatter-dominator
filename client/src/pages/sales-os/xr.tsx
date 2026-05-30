import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { VRButton, ARButton, XR, Controllers, Hands } from "@react-three/xr";
import { Boxes, X } from "lucide-react";
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

      {/* Entry header overlay (hidden once in immersive session) */}
      {!enteredXR && (
        <div className="absolute top-6 left-6 z-20 pointer-events-none">
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
              <p className="text-sm mt-1 max-w-md" style={{ color: "rgba(246,248,255,0.55)" }}>
                Step inside your pipeline. Enter the War Room to walk among five live
                panels — or explore in 3D right here on desktop (drag to orbit).
              </p>
            </div>
          </div>
          <div
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full pointer-events-none"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.18em]">ATOM is active</span>
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
