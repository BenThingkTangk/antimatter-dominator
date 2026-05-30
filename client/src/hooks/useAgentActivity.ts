// useAgentActivity — v1 seeds realistic mock ATOM agent events and cycles a
// fresh batch every 3 seconds. No backend dependency; safe for investor demos.
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sentimentFromScore(score: number): Sentiment {
  if (score > 25) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

function buildBatch(): AgentEvent[] {
  const now = Date.now();
  const callP = pick(PROSPECTS);
  const emailC = pick(CAMPAIGNS);
  const linkedP = pick(PROSPECTS);
  const dur = `${Math.floor(Math.random() * 9) + 1}:${String(
    Math.floor(Math.random() * 60),
  ).padStart(2, "0")}`;
  const sequences = Math.floor(Math.random() * 18) + 6;
  const sent = Math.floor(Math.random() * 900) + 120;
  const openRate = Math.floor(Math.random() * 38) + 28;
  const pending = Math.floor(Math.random() * 14) + 3;

  return [
    {
      id: `call-${now}`,
      channel: "CALLING",
      primary: callP.contact,
      detail: `${callP.company} · ${dur}`,
      sentiment: sentimentFromScore(callP.sentimentScore),
      intent: callP.intentScore,
      nextAction: pick(NEXT_ACTIONS),
    },
    {
      id: `text-${now}`,
      channel: "TEXTING",
      primary: `${sequences} sequences active`,
      detail: `${Math.floor(sequences * 0.6)} replies pending`,
      sentiment: "neutral",
      intent: Math.floor(Math.random() * 40) + 50,
      nextAction: pick(NEXT_ACTIONS),
    },
    {
      id: `email-${now}`,
      channel: "EMAILING",
      primary: emailC,
      detail: `${sent} sent · ${openRate}% open`,
      sentiment: openRate > 45 ? "positive" : "neutral",
      intent: Math.floor(Math.random() * 30) + 55,
      nextAction: pick(NEXT_ACTIONS),
    },
    {
      id: `li-${now}`,
      channel: "LINKEDIN",
      primary: `${pending} messages pending`,
      detail: `${linkedP.company} thread warming`,
      sentiment: sentimentFromScore(linkedP.sentimentScore),
      intent: linkedP.intentScore,
      nextAction: pick(NEXT_ACTIONS),
    },
  ];
}

export function useAgentActivity(intervalMs = 3000) {
  const [events, setEvents] = useState<AgentEvent[]>(() => buildBatch());

  useEffect(() => {
    const t = setInterval(() => setEvents(buildBatch()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return events;
}
