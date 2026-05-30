/**
 * Seeded mock data for the WebXR War Room scene (/xr/warroom).
 * Deterministic — no network calls — so the immersive scene renders
 * identically on Quest, desktop, and non-XR fallback.
 */

export type Urgency = "hot" | "warm" | "cold";

export interface XrProspect {
  name: string;
  company: string;
  value: number;
  stage: string;
  score: number;
  urgency: Urgency;
}

export const XR_PROSPECTS: XrProspect[] = [
  { name: "Sarah Chen", company: "Acura Industries", value: 48000, stage: "Proposal", score: 87, urgency: "hot" },
  { name: "Marcus Webb", company: "PeakFlow Analytics", value: 120000, stage: "Qualified", score: 92, urgency: "hot" },
  { name: "Derek Ross", company: "Vertex Capital", value: 75000, stage: "Contacted", score: 71, urgency: "warm" },
  { name: "Lisa Tran", company: "NovaTech Systems", value: 33000, stage: "Lead", score: 64, urgency: "warm" },
  { name: "James Okafor", company: "BlueSky Logistics", value: 95000, stage: "Proposal", score: 89, urgency: "hot" },
  { name: "Priya Nair", company: "DataEdge Corp", value: 210000, stage: "Qualified", score: 94, urgency: "hot" },
  { name: "Tom Bridges", company: "ClearPath SaaS", value: 18000, stage: "Lead", score: 55, urgency: "cold" },
  { name: "Aisha Grant", company: "Momentum Health", value: 67000, stage: "Contacted", score: 78, urgency: "warm" },
  { name: "Carlos Mendez", company: "Apex Realty Group", value: 42000, stage: "Closed Won", score: 96, urgency: "hot" },
  { name: "Nina Volkov", company: "TrustBridge Finance", value: 155000, stage: "Proposal", score: 91, urgency: "hot" },
];

// ─── Urgency → palette ───────────────────────────────────────────────────────
export const URGENCY_COLOR: Record<Urgency, string> = {
  hot: "#FF3B5C",    // red
  warm: "#FFC83B",   // yellow
  cold: "#3B9BFF",   // blue
};

// ─── Zone 2 — recent calls ────────────────────────────────────────────────────
export interface XrCall {
  prospect: string;
  duration: string;
  outcome: string;
  sentiment: number; // 0-100
  replay: boolean;
}

export const XR_CALLS: XrCall[] = [
  { prospect: "Priya Nair", duration: "14:22", outcome: "Demo booked", sentiment: 88, replay: true },
  { prospect: "James Okafor", duration: "08:47", outcome: "Follow-up set", sentiment: 74, replay: false },
  { prospect: "Derek Ross", duration: "06:13", outcome: "Gatekeeper", sentiment: 52, replay: false },
  { prospect: "Sarah Chen", duration: "11:05", outcome: "Proposal sent", sentiment: 81, replay: false },
  { prospect: "Tom Bridges", duration: "03:38", outcome: "Not interested", sentiment: 29, replay: false },
];

// ─── Zone 3 — active campaign ─────────────────────────────────────────────────
export interface CampaignStep {
  label: string;
  sent: number;
  responded: number;
}

export interface XrCampaign {
  name: string;
  status: string;
  steps: CampaignStep[];
}

export const XR_CAMPAIGN: XrCampaign = {
  name: "Q2 Enterprise Outreach",
  status: "active",
  steps: [
    { label: "SMS Intro", sent: 420, responded: 96 },
    { label: "Email Follow-Up", sent: 388, responded: 72 },
    { label: "ATOM Voice Call", sent: 210, responded: 64 },
    { label: "LinkedIn Touch", sent: 175, responded: 41 },
    { label: "Closing Email", sent: 132, responded: 38 },
  ],
};

// ─── Zone 5 — revenue dashboard ───────────────────────────────────────────────
export const XR_REVENUE = {
  mrr: 487200,
  closeRate: 0.34, // 34%
  // 3D bar chart series (deal value per stage bucket, $K)
  bars: [
    { label: "Lead", value: 51 },
    { label: "Contacted", value: 184 },
    { label: "Qualified", value: 330 },
    { label: "Proposal", value: 446 },
    { label: "Won", value: 42 },
  ],
};

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return `${n}`;
}

export function fmtMoney(n: number): string {
  return `$${compactNumber(n)}`;
}
