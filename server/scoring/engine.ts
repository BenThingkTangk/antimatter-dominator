/**
 * ΔTOM Scoring Engine
 * --------------------
 * Deterministic public-signal scorer. Computes 0-70 from columns provided
 * on the imported sheet (sub-vertical, revenue, wallet grade, AkaFit,
 * target lists). ATOM enrichment adds 0-30 on top in a separate pass.
 *
 * Port of /home/user/workspace/akamai-scoring/score-public.py +
 * build-xlsx.py composite logic. Single source of truth — must stay
 * byte-identical with the offline reference so XLSX/PDF deliverables
 * and in-app scoring agree.
 */

export type ScoringTemplateConfig = {
  weights: {
    regulatory: number;
    breach: number;
    accountFit: number;
    listDensity: number;
    segmentation: number;
    atomIntent: number;
    atomPersonas: number;
    atomFreshness: number;
  };
  subVerticalProfile: Record<string, { phi: number; seg: number; note: string }>;
  walletScore: Record<string, number>;
  akaFitScore: Record<string, number>;
  highValueLists: Record<string, number>;
  tierThresholds: { t1: number; t2: number; t3: number };
};

export const HEALTHCARE_HIPAA_TEMPLATE: ScoringTemplateConfig = {
  weights: {
    regulatory: 25,
    breach: 20,
    accountFit: 15,
    listDensity: 5,
    segmentation: 5,
    atomIntent: 12,
    atomPersonas: 10,
    atomFreshness: 8,
  },
  subVerticalProfile: {
    "Healthcare Provider": { phi: 1.0, seg: 1.0, note: "Largest PHI volume + EHR/IoT segmentation pain; mandated by 2025 HIPAA rule" },
    "Healthcare Payer": { phi: 0.95, seg: 0.9, note: "Massive PHI; claims systems; high regulatory scrutiny" },
    "Pharma and Biotech": { phi: 0.55, seg: 0.85, note: "Clinical-trial data + IP; OT/lab segmentation" },
    "Medical Devices and Equipment": { phi: 0.45, seg: 0.95, note: "Connected devices = lateral-movement crown jewels" },
    "Health Tech": { phi: 0.7, seg: 0.8, note: "PHI handling varies; HIPAA BAA exposure" },
  },
  walletScore: { "Mega Strategic": 1.0, "Strategic": 0.85, "Large Enterprise": 0.65 },
  akaFitScore: { A: 1.0, B: 0.65, C: 0.3 },
  highValueLists: {
    "2026 NC Must Win TAL": 1.0,
    "North America ESG 2026 TAL Prospects": 0.9,
    "2026 Bain Money Map": 0.85,
    "2026-H1 SDR Security Focus - Core": 1.0,
    "North America API 2026 TAL Prospects": 0.7,
    "API Sec NC Noname Tier 1.2 TAL": 0.6,
    "2023 Unified Threat Shield": 0.5,
    "ESG Focus 30": 0.95,
    "2025 NC Must Win TAL": 0.6,
    "2024 NC Must Win TAL": 0.4,
  },
  tierThresholds: { t1: 75, t2: 60, t3: 45 },
};

function revenueTierScore(rev: number | null | undefined): number {
  if (typeof rev !== "number" || rev <= 0) return 0.3;
  if (rev >= 50_000_000_000) return 1.0;
  if (rev >= 10_000_000_000) return 0.92;
  if (rev >= 2_000_000_000) return 0.78;
  if (rev >= 500_000_000) return 0.62;
  if (rev >= 100_000_000) return 0.45;
  return 0.25;
}

export type RawAccount = {
  account: string;
  domain?: string | null;
  state?: string | null;
  sub_vertical?: string | null;
  wallet_grade?: string | null;
  akafit?: string | null;
  target_lists?: string | null;
  revenue?: number | null;
  [k: string]: any;
};

export type PublicScoreBreakdown = {
  regulatory: number;
  accountFit: number;
  listDensity: number;
  segmentation: number;
  breach: number; // 0 until breach matcher runs
  publicSubtotal: number;
  publicMaxPossible: number;
  matchedHighValueLists: string[];
  subVerticalNote: string;
};

export function scorePublic(
  account: RawAccount,
  template: ScoringTemplateConfig = HEALTHCARE_HIPAA_TEMPLATE,
): PublicScoreBreakdown {
  const sub = account.sub_vertical || "";
  const profile = template.subVerticalProfile[sub] || { phi: 0.3, seg: 0.3, note: "Unknown sub-vertical" };
  const phiFactor = profile.phi;
  const segFactor = profile.seg;

  const revFactor = revenueTierScore(typeof account.revenue === "number" ? account.revenue : null);
  const walletFactor = template.walletScore[account.wallet_grade || ""] ?? 0.4;
  const akaFitFactor = template.akaFitScore[(account.akafit || "").toUpperCase()] ?? 0.3;

  const listTokens = (account.target_lists || "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);

  let listScore = 0;
  const matched: string[] = [];
  for (const tok of listTokens) {
    if (template.highValueLists[tok] !== undefined) {
      listScore = Math.max(listScore, template.highValueLists[tok]);
      matched.push(tok);
    }
  }
  const listDensity = Math.min(1.0, listTokens.length / 8.0);
  const listCombined = 0.65 * listScore + 0.35 * listDensity;

  const sRegulatory = template.weights.regulatory * (0.6 * phiFactor + 0.4 * revFactor);
  const sAcctFit = template.weights.accountFit * (0.5 * akaFitFactor + 0.5 * walletFactor);
  const sListDens = template.weights.listDensity * listCombined;
  const sSegRelev = template.weights.segmentation * segFactor;

  const publicSubtotal = round2(sRegulatory + sAcctFit + sListDens + sSegRelev);
  const publicMaxPossible =
    template.weights.regulatory + template.weights.accountFit + template.weights.listDensity + template.weights.segmentation;

  return {
    regulatory: round2(sRegulatory),
    accountFit: round2(sAcctFit),
    listDensity: round2(sListDens),
    segmentation: round2(sSegRelev),
    breach: 0,
    publicSubtotal,
    publicMaxPossible,
    matchedHighValueLists: matched,
    subVerticalNote: profile.note,
  };
}

export type AtomEnrichment = {
  atom_buying_signals?: string[];
  atom_pain_points?: string[];
  atom_score?: number;
  atom_decision_makers?: Array<{ title?: string; seniority?: string }>;
  atom_recent_news?: string[];
  _status?: string;
};

export type AtomScoreBreakdown = {
  intent: number;
  personas: number;
  freshness: number;
  atomSubtotal: number;
  whyNow: string[];
};

export function scoreAtom(
  enrichment: AtomEnrichment | null | undefined,
  template: ScoringTemplateConfig = HEALTHCARE_HIPAA_TEMPLATE,
): AtomScoreBreakdown {
  if (!enrichment || enrichment._status === "failed") {
    return { intent: 0, personas: 0, freshness: 0, atomSubtotal: 0, whyNow: [] };
  }
  const signals = enrichment.atom_buying_signals || [];
  const pain = enrichment.atom_pain_points || [];
  const dms = enrichment.atom_decision_makers || [];
  const news = enrichment.atom_recent_news || [];

  let intent: number;
  if (typeof enrichment.atom_score === "number" && enrichment.atom_score > 0) {
    intent = Math.min(template.weights.atomIntent, enrichment.atom_score * 0.12);
  } else {
    intent = Math.min(template.weights.atomIntent, signals.length * 2 + pain.length);
  }

  const seniorDMs = dms.filter((d) => {
    const t = `${d?.title || ""} ${d?.seniority || ""}`.toLowerCase();
    return ["chief", "cio", "ciso", "cto", "vp", "director", "head of"].some((kw) => t.includes(kw));
  });
  const personas = Math.min(template.weights.atomPersonas, seniorDMs.length * 2.5);
  const freshness = Math.min(template.weights.atomFreshness, news.length * 2);

  const whyNow: string[] = [];
  if (signals.length) whyNow.push(...signals.slice(0, 2).map((s) => `Signal: ${s}`));
  if (pain.length) whyNow.push(...pain.slice(0, 2).map((p) => `Pain: ${p}`));
  if (news.length) whyNow.push(`News: ${news[0]}`);

  return {
    intent: round2(intent),
    personas: round2(personas),
    freshness: round2(freshness),
    atomSubtotal: round2(intent + personas + freshness),
    whyNow,
  };
}

export function tierOf(finalScore: number, template: ScoringTemplateConfig = HEALTHCARE_HIPAA_TEMPLATE): "T1" | "T2" | "T3" | "T4" {
  const { t1, t2, t3 } = template.tierThresholds;
  if (finalScore >= t1) return "T1";
  if (finalScore >= t2) return "T2";
  if (finalScore >= t3) return "T3";
  return "T4";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
