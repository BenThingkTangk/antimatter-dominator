// MissionControl — header-level live status module for the ATOM Sales OS shell.
// Shows breathing KPIs (active agents, calls in progress, pipeline influenced,
// next autonomous action), the compliance shield, the GPU/edge/AI stack, and
// the Investor Demo control. Values animate via the deterministic 2s heartbeat
// in useSalesOsDemo — no random churn, no layout thrash.
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  PhoneCall,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Cpu,
  Play,
  Square,
} from "lucide-react";
import { useSalesOsDemo, DEMO_STEPS } from "@/lib/sales-os-demo";
import { fmtCurrency } from "./SalesOsUI";

const CYAN = "#00d4ff";

/** Smoothly counts the displayed number toward a target so KPI changes glide
 *  rather than snap. Pure rAF, cleaned up on unmount. */
function useCountUp(target: number, ms = 700) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    fromRef.current = val;
    startRef.current = performance.now();
    const from = fromRef.current;
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);

  return val;
}

function Kpi({
  icon,
  label,
  value,
  accent = CYAN,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  testid?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3" data-testid={testid}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}1f`, color: accent }}
      >
        {icon}
      </div>
      <div className="leading-tight">
        <p
          className="text-[9px] font-mono uppercase tracking-[0.18em]"
          style={{ color: "rgba(246,248,255,0.45)" }}
        >
          {label}
        </p>
        <p className="text-sm font-bold tabular-nums" style={{ color: "#f6f8ff" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return <span className="h-8 w-px shrink-0" style={{ background: "rgba(0,212,255,0.14)" }} />;
}

export function MissionControl() {
  const { kpis, demoActive, demoStep, startDemo, stopDemo } = useSalesOsDemo();
  const agents = useCountUp(kpis.activeAgents);
  const calls = useCountUp(kpis.callsInProgress);
  const influenced = useCountUp(Math.round(kpis.pipelineInfluenced / 1000));

  return (
    <div
      data-testid="mission-control"
      className="relative rounded-2xl px-3 py-2.5 mb-5 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: `1px solid ${demoActive ? "rgba(124,58,237,0.45)" : "rgba(0,212,255,0.18)"}`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: demoActive
          ? "0 0 44px rgba(124,58,237,0.18)"
          : "0 0 30px rgba(0,212,255,0.06)",
        transition: "border-color .4s, box-shadow .4s",
      }}
    >
      {/* sweeping shimmer line */}
      <span
        className="pointer-events-none absolute top-0 left-0 h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${demoActive ? "#7c3aed" : CYAN}, transparent)`,
          animation: "mc-sweep 5s linear infinite",
        }}
      />
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-2 px-2 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          <span
            className="text-[10px] font-mono uppercase tracking-[0.22em]"
            style={{ color: CYAN }}
          >
            Mission Control
          </span>
        </div>
        <Divider />

        <Kpi
          icon={<Activity size={15} />}
          label="Active Agents"
          value={`${agents}`}
          testid="mc-active-agents"
        />
        <Kpi
          icon={<PhoneCall size={15} />}
          label="Calls Live"
          value={`${calls}`}
          accent="#34d399"
          testid="mc-calls-live"
        />
        <Kpi
          icon={<TrendingUp size={15} />}
          label="Pipeline Influenced"
          value={fmtCurrency(influenced * 1000)}
          accent="#7c3aed"
          testid="mc-pipeline-influenced"
        />

        <Divider />
        <Kpi
          icon={<Sparkles size={15} />}
          label="Next Autonomous Action"
          value={kpis.nextAction}
          testid="mc-next-action"
        />

        <div className="flex-1" />

        {/* Compliance shield + stack status */}
        <div className="hidden xl:flex items-center gap-2 px-2">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.3)",
              color: "#34d399",
            }}
            title="TCPA / DNC compliance shield"
            data-testid="mc-compliance"
          >
            <ShieldCheck size={12} /> Shield {kpis.complianceShield}
          </span>
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.22)",
              color: CYAN,
            }}
            title={`GPU ${kpis.stack.gpu} · Edge ${kpis.stack.edge} · ${kpis.stack.ai}`}
            data-testid="mc-stack"
          >
            <Cpu size={12} /> {kpis.stack.gpu}
          </span>
        </div>

        <button
          onClick={demoActive ? stopDemo : startDemo}
          data-testid="demo-mode-toggle"
          className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-transform hover:-translate-y-0.5"
          style={
            demoActive
              ? {
                  background: "rgba(124,58,237,0.18)",
                  border: "1px solid rgba(124,58,237,0.5)",
                  color: "#c4b5fd",
                }
              : {
                  background: `linear-gradient(135deg, ${CYAN}, #7c3aed)`,
                  color: "#04121a",
                }
          }
        >
          {demoActive ? <Square size={13} /> : <Play size={13} />}
          {demoActive ? "Stop Demo" : "Investor Demo"}
        </button>
      </div>

      {/* Demo narrative ribbon — only while running */}
      {demoActive && (
        <div
          className="mt-2.5 pt-2.5 flex items-center gap-3 flex-wrap"
          style={{ borderTop: "1px dashed rgba(124,58,237,0.3)" }}
          data-testid="demo-narrative"
        >
          <span
            className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded"
            style={{ background: "rgba(124,58,237,0.18)", color: "#c4b5fd" }}
          >
            Demo · {demoStep + 1}/{DEMO_STEPS.length}
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            {DEMO_STEPS.map((s, i) => (
              <div
                key={s.id}
                className="h-1 flex-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)" }}
                title={s.title}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: i <= demoStep ? "100%" : "0%",
                    background:
                      i === demoStep
                        ? "linear-gradient(90deg,#7c3aed,#00d4ff)"
                        : "#7c3aed",
                  }}
                />
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ color: "#f6f8ff" }}>
            {DEMO_STEPS[demoStep].title}
          </span>
          <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.6)" }}>
            {DEMO_STEPS[demoStep].caption}
          </span>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,212,255,0.1)", color: CYAN }}
          >
            {DEMO_STEPS[demoStep].metric}
          </span>
        </div>
      )}

      <style>{`@keyframes mc-sweep{0%{opacity:0;transform:translateX(-30%)}50%{opacity:1}100%{opacity:0;transform:translateX(30%)}}`}</style>
    </div>
  );
}

export default MissionControl;
