// Seeded B2B prospect data for ATOM Sales OS — powers the /xr War Room,
// Pipeline Command, Buyer Intel, and Revenue zones. Pure frontend mock data;
// no secrets, no backend dependency.

export type Vertical =
  | "SaaS"
  | "Logistics"
  | "Healthcare"
  | "Fintech"
  | "Real Estate"
  | "Manufacturing"
  | "Legal"
  | "Insurance"
  | "E-commerce"
  | "EdTech";

export type DealStage =
  | "Discovery"
  | "Qualified"
  | "Demo"
  | "Proposal"
  | "Negotiation"
  | "Closed Won";

export interface Prospect {
  id: string;
  company: string;
  contact: string;
  title: string;
  vertical: Vertical;
  dealValue: number;
  stage: DealStage;
  /** 0–100, ATOM's composite buying-intent score */
  intentScore: number;
  /** -100..100, live conversation sentiment (negative = objecting) */
  sentimentScore: number;
  /** Recent funding / growth signal surfaced by ATOM intel */
  fundingSignal: string;
  /** Headcount — drives the Buyer Intel scatter X axis */
  companySize: number;
}

export const VERTICAL_COLORS: Record<Vertical, string> = {
  SaaS: "#00d4ff",
  Logistics: "#7c3aed",
  Healthcare: "#34d399",
  Fintech: "#f5c842",
  "Real Estate": "#fb7185",
  Manufacturing: "#fb923c",
  Legal: "#a78bfa",
  Insurance: "#38bdf8",
  "E-commerce": "#f472b6",
  EdTech: "#4ade80",
};

export const STAGE_ORDER: DealStage[] = [
  "Discovery",
  "Qualified",
  "Demo",
  "Proposal",
  "Negotiation",
  "Closed Won",
];

export const PROSPECTS: Prospect[] = [
  {
    id: "p-001",
    company: "Northwind Cloud",
    contact: "Dana Whitfield",
    title: "VP Revenue Operations",
    vertical: "SaaS",
    dealValue: 184000,
    stage: "Negotiation",
    intentScore: 92,
    sentimentScore: 64,
    fundingSignal: "Series C · $120M (4 weeks ago)",
    companySize: 640,
  },
  {
    id: "p-002",
    company: "Meridian Freight",
    contact: "Carlos Reyna",
    title: "Director of Dispatch",
    vertical: "Logistics",
    dealValue: 96000,
    stage: "Proposal",
    intentScore: 81,
    sentimentScore: 22,
    fundingSignal: "New 3PL contract · 40% volume jump",
    companySize: 1200,
  },
  {
    id: "p-003",
    company: "Cedarline Health",
    contact: "Priya Anand",
    title: "Chief Growth Officer",
    vertical: "Healthcare",
    dealValue: 240000,
    stage: "Demo",
    intentScore: 88,
    sentimentScore: 41,
    fundingSignal: "Acquired 3 regional clinics",
    companySize: 2100,
  },
  {
    id: "p-004",
    company: "Vault Pay",
    contact: "Marcus Lin",
    title: "Head of Sales",
    vertical: "Fintech",
    dealValue: 132000,
    stage: "Qualified",
    intentScore: 76,
    sentimentScore: -18,
    fundingSignal: "Hiring 22 AEs this quarter",
    companySize: 380,
  },
  {
    id: "p-005",
    company: "Harborstone Realty",
    contact: "Elena Brooks",
    title: "Managing Partner",
    vertical: "Real Estate",
    dealValue: 58000,
    stage: "Discovery",
    intentScore: 63,
    sentimentScore: 9,
    fundingSignal: "Expanding into 2 new metros",
    companySize: 210,
  },
  {
    id: "p-006",
    company: "Apex Forge Industries",
    contact: "Tom Okafor",
    title: "COO",
    vertical: "Manufacturing",
    dealValue: 310000,
    stage: "Proposal",
    intentScore: 84,
    sentimentScore: 33,
    fundingSignal: "$45M plant automation budget",
    companySize: 3400,
  },
  {
    id: "p-007",
    company: "Sterling & Cho LLP",
    contact: "Rachel Sterling",
    title: "Operations Director",
    vertical: "Legal",
    dealValue: 74000,
    stage: "Demo",
    intentScore: 70,
    sentimentScore: 12,
    fundingSignal: "Opened intake automation RFP",
    companySize: 160,
  },
  {
    id: "p-008",
    company: "Beacon Mutual",
    contact: "David Ferraro",
    title: "SVP Distribution",
    vertical: "Insurance",
    dealValue: 205000,
    stage: "Qualified",
    intentScore: 79,
    sentimentScore: -7,
    fundingSignal: "Replacing legacy dialer vendor",
    companySize: 5200,
  },
  {
    id: "p-009",
    company: "Lumen Cart",
    contact: "Aisha Karim",
    title: "VP Marketing",
    vertical: "E-commerce",
    dealValue: 88000,
    stage: "Negotiation",
    intentScore: 90,
    sentimentScore: 58,
    fundingSignal: "Record Q4 · 2.3x YoY GMV",
    companySize: 470,
  },
  {
    id: "p-010",
    company: "BrightPath Learning",
    contact: "Noah Feldman",
    title: "Head of Partnerships",
    vertical: "EdTech",
    dealValue: 121000,
    stage: "Demo",
    intentScore: 82,
    sentimentScore: 27,
    fundingSignal: "District-wide rollout in 3 states",
    companySize: 290,
  },
];

export const PIPELINE_TOTAL = PROSPECTS.reduce((s, p) => s + p.dealValue, 0);
export const FORECAST_TOTAL = Math.round(PIPELINE_TOTAL * 0.72);
