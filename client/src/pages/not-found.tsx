import { useLocation } from "wouter";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-[70vh] flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 30%, rgba(0,200,200,0.06) 0%, transparent 60%)",
      }}
    >
      <div className="max-w-md w-full text-center space-y-6">
        <div
          className="text-[11px] font-mono uppercase tracking-[0.32em]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          ATOM · Signal lost
        </div>
        <div
          className="font-bold leading-none"
          style={{
            fontSize: "clamp(72px, 14vw, 140px)",
            fontFamily: "var(--font-display, inherit)",
            color: "var(--color-text, #f6f6fd)",
            letterSpacing: "-0.04em",
          }}
        >
          404
        </div>
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-text, #f6f6fd)", fontFamily: "var(--font-display, inherit)" }}
        >
          This page is off the grid.
        </h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          The route you tried doesn't exist or hasn't been deployed yet. Head back to the Command Center
          or step back one screen to keep the flow going.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: "rgba(0,200,200,0.16)",
              border: "1px solid rgba(0,200,200,0.45)",
              color: "#7fe7e7",
            }}
          >
            <Home size={14} /> Command Center
          </button>
        </div>
      </div>
    </div>
  );
}
