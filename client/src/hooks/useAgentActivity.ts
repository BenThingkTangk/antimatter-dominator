// useAgentActivity — seeds realistic ATOM agent events and rotates them on a
// fixed cadence. Deterministic: the batch is derived from a monotonic tick (not
// Math.random), so renders are stable and there is no layout thrash or flicker.
import { useEffect, useState } from "react";
import { PROSPECTS } from "@/data/warroom-seed";

export type Channel = "CALLING" | "TEXTING" | "EMAILING" | "LINKEDIN";
export type Sentiment = "positive" | "neutral" | "negative";

export interface AgentEvent {
  id: string;
  channel: Channel;
  /** Primary headline, e.g. prospect or campaign name */
  primary: string;
  /** Secondary detail line */
  detail: string;
  sentiment: Sentiment;
  /** 0–100 buying intent */
  intent: number;
  nextAction: string;
}

const CAMPAIGNS = [
  "Q3 SaaS Expansion",
  "Logistics Reactivation",
  "Healthcare ABM",
  "Fintech Founders",
  "Year-End Push",
];

const NEXT_ACTIONS = [
  "Book discovery call",
  "Send pricing one-pager",
  "Trigger Day-3 follow-up",
  "Route to AE",
  "Schedule demo",
  "Send case study",
  "Escalate to manager",
];

function sentimentFromScore(score: number): Sentiment {
  if (score > 25) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

// Deterministic pick keyed on the tick so the ticker rotates predictably.
function at<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function buildBatch(tick: number): AgentEvent[] {
  const callP = at(PROSPECTS, tick);
  const emailC = at(CAMPAIGNS, tick);
  const linkedP = at(PROSPECTS, tick + 3);
  const secs = (tick * 17) % 60;
  const mins = (tick % 8) + 1;
  const dur = `${mins}:${String(secs).padStart(2, "0")}`;
  const sequences = (tick % 18) + 6;
  const sent = ((tick * 37) % 900) + 120;
  const openRate = ((tick * 7) % 38) + 28;
  const pending = (tick % 14) + 3;

  return [
    {
      id: `call-${callP.id}`,
      channel: "CALLING",
      primary: callP.contact,
      detail: `${callP.company} · ${dur}`,
      sentiment: sentimentFromScore(callP.sentimentScore),
      intent: callP.intentScore,
      nextAction: at(NEXT_ACTIONS, tick),
    },
    {
      id: `text-${tick}`,
      channel: "TEXTING",
      primary: `${sequences} sequences active`,
      detail: `${Math.floor(sequences * 0.6)} replies pending`,
      sentiment: "neutral",
      intent: 50 + (tick % 40),
      nextAction: at(NEXT_ACTIONS, tick + 1),
    },
    {
      id: `email-${tick}`,
      channel: "EMAILING",
      primary: emailC,
      detail: `${sent} sent · ${openRate}% open`,
      sentiment: openRate > 45 ? "positive" : "neutral",
      intent: 55 + (tick % 30),
      nextAction: at(NEXT_ACTIONS, tick + 2),
    },
    {
      id: `li-${tick}`,
      channel: "LINKEDIN",
      primary: `${pending} messages pending`,
      detail: `${linkedP.company} thread warming`,
      sentiment: sentimentFromScore(linkedP.sentimentScore),
      intent: linkedP.intentScore,
      nextAction: at(NEXT_ACTIONS, tick + 3),
    },
  ];
}

export function useAgentActivity(intervalMs = 3000) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return buildBatch(tick);
}
