// SalesOsDemo — shared, deterministic state powering the Mission Control module
// and the cinematic Investor Demo sequence. No randomness in render, no
// localStorage / sessionStorage / cookies — pure React state. A single 2s tick
// drives smooth, seeded oscillation so KPIs feel alive without layout thrash.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { PROSPECTS, PIPELINE_TOTAL, FORECAST_TOTAL } from "@/data/warroom-seed";

// ── Investor Demo storyline ──────────────────────────────────────────────────
export interface DemoStep {
  id: string;
  title: string;
  /** Short narration shown in Mission Control / the dock */
  caption: string;
  channel: "INTEL" | "CALLING" | "OBJECTION" | "EMAILING" | "MEETING" | "FORECAST";
  /** Headline metric this beat moves */
  metric: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "lead",
    title: "Lead detected",
    caption: "ATOM surfaced Northwind Cloud — Series C, 92 intent.",
    channel: "INTEL",
    metric: "+1 high-intent account",
  },
  {
    id: "call",
    title: "AI call placed",
    caption: "Autonomous voice agent dialing Dana Whitfield, VP RevOps.",
    channel: "CALLING",
    metric: "Live call · 02:14",
  },
  {
    id: "objection",
    title: "Objection handled",
    caption: "“We already use a dialer” → ATOM reframed on ROI + ramp.",
    channel: "OBJECTION",
    metric: "Sentiment +41",
  },
  {
    id: "casestudy",
    title: "Case study sent",
    caption: "Logistics ROI one-pager auto-delivered mid-call.",
    channel: "EMAILING",
    metric: "Opened in 38s",
  },
  {
    id: "meeting",
    title: "Meeting booked",
    caption: "Discovery call set for Thursday 10:00 — routed to AE.",
    channel: "MEETING",
    metric: "+1 meeting",
  },
  {
    id: "forecast",
    title: "Forecast updated",
    caption: "Pipeline influence recalculated — commit raised.",
    channel: "FORECAST",
    metric: "+$184K committed",
  },
];

const STEP_MS = 3400;

// ── Mission Control live KPIs ────────────────────────────────────────────────
export interface MissionKpis {
  activeAgents: number;
  callsInProgress: number;
  pipelineInfluenced: number;
  meetingsToday: number;
  nextAction: string;
  complianceShield: "ACTIVE" | "ELEVATED";
  stack: { gpu: string; edge: string; ai: string };
}

interface DemoContextValue {
  // demo mode
  demoActive: boolean;
  demoStep: number;
  demoStepData: DemoStep | null;
  startDemo: () => void;
  stopDemo: () => void;
  // live tick + kpis
  tick: number;
  kpis: MissionKpis;
}

const DemoContext = createContext<DemoContextValue | null>(null);

const NEXT_ACTIONS = [
  "Dial Apex Forge COO",
  "Send Cedarline ROI deck",
  "Route Lumen Cart to AE",
  "Trigger Day-3 follow-up",
  "Book Beacon Mutual demo",
];

/** Deterministic 0..1 wave from an integer tick + phase. */
function wave(tick: number, phase: number) {
  return (Math.sin(tick * 0.5 + phase) + 1) / 2;
}

export function SalesOsDemoProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const [demoActive, setDemoActive] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Global 2s heartbeat — drives all "alive" oscillation deterministically.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  // Demo sequencer — advances one beat per STEP_MS, loops the story.
  useEffect(() => {
    if (!demoActive) return;
    demoTimer.current = setInterval(() => {
      setDemoStep((s) => (s + 1) % DEMO_STEPS.length);
    }, STEP_MS);
    return () => {
      if (demoTimer.current) clearInterval(demoTimer.current);
    };
  }, [demoActive]);

  const startDemo = () => {
    setDemoStep(0);
    setDemoActive(true);
  };
  const stopDemo = () => setDemoActive(false);

  const kpis = useMemo<MissionKpis>(() => {
    // Base values from seeded data, gently modulated by the heartbeat so the
    // numbers breathe (±) without ever jumping erratically.
    const baseAgents = 24;
    const activeAgents = baseAgents + Math.round(wave(tick, 0) * 6); // 24..30
    const callsInProgress = 7 + Math.round(wave(tick, 2.1) * 5); // 7..12
    const influencePct = 0.61 + wave(tick, 1.3) * 0.05; // 61%..66%
    const pipelineInfluenced = Math.round((PIPELINE_TOTAL * influencePct) / 1000) * 1000;
    const meetingsToday = 12 + (demoActive && demoStep >= 4 ? 1 : 0);
    const nextAction = demoActive
      ? DEMO_STEPS[demoStep].title
      : NEXT_ACTIONS[tick % NEXT_ACTIONS.length];

    return {
      activeAgents,
      callsInProgress: demoActive && demoStep === 1 ? callsInProgress + 1 : callsInProgress,
      pipelineInfluenced,
      meetingsToday,
      nextAction,
      complianceShield: "ACTIVE",
      stack: {
        gpu: "B200 · 4 nodes",
        edge: "12 regions",
        ai: "Frontier online",
      },
    };
  }, [tick, demoActive, demoStep]);

  const value: DemoContextValue = {
    demoActive,
    demoStep,
    demoStepData: demoActive ? DEMO_STEPS[demoStep] : null,
    startDemo,
    stopDemo,
    tick,
    kpis,
  };

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useSalesOsDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    // Safe fallback so components never crash if rendered outside the provider
    // (e.g. isolated tests). Static, non-animated snapshot.
    return {
      demoActive: false,
      demoStep: 0,
      demoStepData: null,
      startDemo: () => {},
      stopDemo: () => {},
      tick: 0,
      kpis: {
        activeAgents: 24,
        callsInProgress: 7,
        pipelineInfluenced: Math.round((PIPELINE_TOTAL * 0.62) / 1000) * 1000,
        meetingsToday: 12,
        nextAction: NEXT_ACTIONS[0],
        complianceShield: "ACTIVE",
        stack: { gpu: "B200 · 4 nodes", edge: "12 regions", ai: "Frontier online" },
      },
    };
  }
  return ctx;
}

export { PIPELINE_TOTAL, FORECAST_TOTAL, PROSPECTS };
