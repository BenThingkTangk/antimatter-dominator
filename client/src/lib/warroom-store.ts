/**
 * ATOM War Room — Shared Intelligence Layer
 * Von Clausewitz Engine's nervous system.
 *
 * Every ATOM module reads from and writes to this store.
 * Events broadcast across tabs via BroadcastChannel + localStorage.
 *
 * Architecture:
 * - Deal: central unit — contains TRUTH Score, stakeholders, signals, competitive radar
 * - Stakeholder: person on a deal with role (economic_buyer, technical, champion, blocker, ghost)
 * - Signal: company intelligence event (funding, leadership, tech_change, job_posting, news)
 * - Play: recommended action fired by trigger system
 */

export type DealStage = "discovery" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
export type DealRisk = "healthy" | "caution" | "at_risk" | "dead";
export type StakeholderRole = "economic_buyer" | "technical" | "champion" | "blocker" | "ghost" | "unknown";
export type ThreatLevel = "low" | "elevated" | "critical";
export type SignalType = "funding" | "leadership" | "job_posting" | "tech_change" | "news" | "contract_win" | "earnings" | "product_launch" | "competitor_mention" | "hiring_surge" | "conference" | "new_c_suite" | "job_post_matching";
export type PackageStatus = "idle" | "generating" | "partial" | "ready" | "degraded" | "failed";
export type PackageSection = "market_intent" | "pitch" | "objections" | "warbook" | "prospects";
export type TargetTier = "T1" | "T2" | "Watch";

export interface TargetPackage {
  marketIntent?: string;
  pitch?: string;
  objections?: string;
  warbook?: string;
  prospects?: string;
  sections: Record<PackageSection, { status: PackageStatus; updatedAt?: number; sources?: string[] }>;
  generatedAt?: number;
  overallStatus: PackageStatus;
}

export interface DailyBrief {
  id: string;
  briefDate: string;               // YYYY-MM-DD
  summary: string;
  overnightTriggers: string[];
  whyNow: string;
  pitchAngle: string;
  recommendedAction: string;
  dailySignalScore: number;        // 0-10
  sources: string[];
  generatedAt: number;
}

export interface TargetMeta {
  tier: TargetTier;
  signalScore: number;             // 0-10
  lastBriefAt?: number;
  assignedOwner?: string;
  crmIds?: { hubspot?: string; salesforce?: string };
}

export interface Stakeholder {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role: StakeholderRole;
  engagement: number;  // 0-100
  lastTouched?: number;
  notes?: string;
}

export interface CompanySignal {
  id: string;
  type: SignalType;
  headline: string;
  date: string;
  source?: string;
  impactScore: number; // 0-10
}

export interface IntelAnalysis {
  id: string;
  text: string;
  channel: string;
  truthScore: number;
  risk: string;
  dealRisk: string;
  intent: string;
  ghostProb: number;
  competitors: string[];
  stakeholderMentions: string[];
  summary: string;
  timestamp: number;
}

export interface Play {
  id: string;
  name: string;
  trigger: string;
  tactic: string;
  urgency: "low" | "medium" | "high" | "critical";
  firedAt: number;
  acknowledged: boolean;
}

export interface Deal {
  id: string;
  company: string;
  website?: string;
  industry?: string;
  source: "manual" | "prospect" | "leadgen" | "market" | "campaign" | "warbook";
  isHVT: boolean;
  hvtFlaggedAt?: number;
  stage: DealStage;
  risk: DealRisk;

  // TRUTH Score
  truthScore: number;              // 0-100 composite conviction score
  truthHistory: { score: number; at: number }[];

  // Activity timing
  createdAt: number;
  lastBuyerActivity?: number;
  lastRepActivity?: number;

  // Stakeholders + engagement
  stakeholders: Stakeholder[];

  // Intel
  analyses: IntelAnalysis[];

  // Competitive
  competitors: string[];
  threatLevel: ThreatLevel;

  // Signals
  signals: CompanySignal[];

  // Plays fired
  plays: Play[];

  // Ghost Ops
  isGhost: boolean;
  ghostScore: number;                // 0-100 probability of re-engagement
  coldCaseReason?: string;

  // Target Intelligence
  targetPackage?: TargetPackage;
  dailyBriefs: DailyBrief[];
  targetMeta: TargetMeta;

  // Notes
  notes?: string;
}

const DEALS_KEY = "atom_warroom_deals_v2";
const CHANNEL_NAME = "atom_warroom";

// ─── Event bus (cross-module broadcast) ──────────────────────────────────────

type EventType =
  | "deal_created"
  | "deal_updated"
  | "deal_deleted"
  | "hvt_flagged"
  | "analysis_linked"
  | "play_fired"
  | "signal_detected"
  | "stakeholder_added";

interface WarRoomEvent {
  type: EventType;
  dealId?: string;
  payload?: any;
  at: number;
}

let channel: BroadcastChannel | null = null;
try { channel = new BroadcastChannel(CHANNEL_NAME); } catch { /* no-op */ }

const listeners = new Set<(e: WarRoomEvent) => void>();

export function onWarRoomEvent(fn: (e: WarRoomEvent) => void): () => void {
  listeners.add(fn);
  const ch = channel;
  const handler = (ev: MessageEvent) => fn(ev.data);
  if (ch) ch.addEventListener("message", handler);
  return () => {
    listeners.delete(fn);
    if (ch) ch.removeEventListener("message", handler);
  };
}

function broadcast(type: EventType, dealId?: string, payload?: any) {
  const e: WarRoomEvent = { type, dealId, payload, at: Date.now() };
  listeners.forEach(fn => { try { fn(e); } catch {} });
  try { channel?.postMessage(e); } catch {}
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function loadDeals(): Deal[] {
  try {
    const raw = localStorage.getItem(DEALS_KEY);
    const deals: Deal[] = raw ? JSON.parse(raw) : [];
    // Migration: backfill missing fields
    return deals.map(d => ({
      ...d,
      targetPackage: d.targetPackage || {
        sections: {
          market_intent: { status: "idle" as PackageStatus },
          pitch: { status: "idle" as PackageStatus },
          objections: { status: "idle" as PackageStatus },
          warbook: { status: "idle" as PackageStatus },
          prospects: { status: "idle" as PackageStatus },
        },
        overallStatus: "idle" as PackageStatus,
      },
      dailyBriefs: d.dailyBriefs || [],
      targetMeta: d.targetMeta || { tier: d.isHVT ? "T1" as TargetTier : "Watch" as TargetTier, signalScore: 0 },
    }));
  } catch { return []; }
}

export function saveDeals(deals: Deal[]) {
  try { localStorage.setItem(DEALS_KEY, JSON.stringify(deals)); } catch {}
}

export function getDeal(id: string): Deal | undefined {
  return loadDeals().find(d => d.id === id);
}

export function findDealByCompany(company: string): Deal | undefined {
  const needle = company.toLowerCase().trim();
  return loadDeals().find(d => d.company.toLowerCase().trim() === needle);
}

export function createDeal(init: Partial<Deal> & { company: string; source: Deal["source"] }): Deal {
  const existing = findDealByCompany(init.company);
  if (existing) return existing;

  const deal: Deal = {
    id: crypto.randomUUID(),
    company: init.company,
    website: init.website,
    industry: init.industry,
    source: init.source,
    isHVT: init.isHVT || false,
    hvtFlaggedAt: init.isHVT ? Date.now() : undefined,
    stage: init.stage || "discovery",
    risk: "healthy",
    truthScore: 50,
    truthHistory: [{ score: 50, at: Date.now() }],
    createdAt: Date.now(),
    lastBuyerActivity: undefined,
    lastRepActivity: Date.now(),
    stakeholders: init.stakeholders || [],
    analyses: [],
    competitors: [],
    threatLevel: "low",
    signals: init.signals || [],
    plays: [],
    isGhost: false,
    ghostScore: 0,
    targetPackage: {
      sections: {
        market_intent: { status: "idle" },
        pitch: { status: "idle" },
        objections: { status: "idle" },
        warbook: { status: "idle" },
        prospects: { status: "idle" },
      },
      overallStatus: "idle",
    },
    dailyBriefs: [],
    targetMeta: {
      tier: init.isHVT ? "T1" : "Watch",
      signalScore: 0,
    },
    notes: init.notes,
  };
  const deals = loadDeals();
  deals.unshift(deal);
  saveDeals(deals);
  broadcast("deal_created", deal.id, { deal });
  if (deal.isHVT) broadcast("hvt_flagged", deal.id, { deal });
  return deal;
}

export function updateDeal(id: string, patch: Partial<Deal>): Deal | undefined {
  const deals = loadDeals();
  const idx = deals.findIndex(d => d.id === id);
  if (idx === -1) return undefined;
  const prev = deals[idx];
  const next = { ...prev, ...patch };

  // Track TRUTH score history
  if (patch.truthScore !== undefined && patch.truthScore !== prev.truthScore) {
    next.truthHistory = [...prev.truthHistory, { score: patch.truthScore, at: Date.now() }].slice(-50);
  }

  deals[idx] = next;
  saveDeals(deals);
  broadcast("deal_updated", id, { deal: next, patch });
  return next;
}

export function deleteDeal(id: string): void {
  const deals = loadDeals().filter(d => d.id !== id);
  saveDeals(deals);
  broadcast("deal_deleted", id);
}

export function flagAsHVT(company: string, extras: Partial<Deal> = {}): Deal {
  const existing = findDealByCompany(company);
  if (existing) {
    const updated = updateDeal(existing.id, {
      isHVT: true,
      hvtFlaggedAt: Date.now(),
      ...extras,
    });
    if (updated) broadcast("hvt_flagged", updated.id, { deal: updated });
    return updated || existing;
  }
  return createDeal({ company, source: extras.source || "manual", isHVT: true, ...extras });
}

// ─── Link Intel Analysis to Deal ─────────────────────────────────────────────

export function linkAnalysisToDeal(
  dealId: string,
  analysis: Omit<IntelAnalysis, "id" | "timestamp">
): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const a: IntelAnalysis = { ...analysis, id: crypto.randomUUID(), timestamp: Date.now() };

  // Derive updates
  const newAnalyses = [a, ...deal.analyses].slice(0, 50);
  const newTruthScore = Math.round(a.truthScore); // Latest analysis score drives current
  const newCompetitors = Array.from(new Set([...deal.competitors, ...analysis.competitors.filter(Boolean)]));
  const newRisk: DealRisk = (analysis.dealRisk?.toLowerCase() as DealRisk) || deal.risk;
  const newThreat: ThreatLevel = newCompetitors.length > 0
    ? (analysis.risk?.toLowerCase() === "high" ? "critical" : "elevated")
    : "low";
  const newIsGhost = analysis.ghostProb > 60;
  const newGhostScore = analysis.ghostProb > 40 ? 100 - analysis.ghostProb : deal.ghostScore;

  // Add stakeholders from mentions (basic)
  const existingNames = new Set(deal.stakeholders.map(s => s.name.toLowerCase()));
  const newStakeholders = [...deal.stakeholders];
  (analysis.stakeholderMentions || []).forEach(name => {
    if (name && !existingNames.has(name.toLowerCase())) {
      newStakeholders.push({
        id: crypto.randomUUID(),
        name,
        role: "unknown",
        engagement: 50,
        lastTouched: Date.now(),
      });
    }
  });

  const updated = updateDeal(dealId, {
    analyses: newAnalyses,
    truthScore: newTruthScore,
    competitors: newCompetitors,
    risk: newRisk,
    threatLevel: newThreat,
    isGhost: newIsGhost,
    ghostScore: newGhostScore,
    stakeholders: newStakeholders,
    lastBuyerActivity: Date.now(),
  });

  broadcast("analysis_linked", dealId, { analysis: a });
  return updated;
}

// ─── Stakeholders ────────────────────────────────────────────────────────────

export function addStakeholder(dealId: string, s: Omit<Stakeholder, "id">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const stakeholder: Stakeholder = { ...s, id: crypto.randomUUID() };
  const updated = updateDeal(dealId, { stakeholders: [...deal.stakeholders, stakeholder] });
  broadcast("stakeholder_added", dealId, { stakeholder });
  return updated;
}

export function updateStakeholder(dealId: string, stakeholderId: string, patch: Partial<Stakeholder>): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, {
    stakeholders: deal.stakeholders.map(s => s.id === stakeholderId ? { ...s, ...patch } : s),
  });
}

export function removeStakeholder(dealId: string, stakeholderId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, { stakeholders: deal.stakeholders.filter(s => s.id !== stakeholderId) });
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export function addSignal(dealId: string, signal: Omit<CompanySignal, "id">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const s: CompanySignal = { ...signal, id: crypto.randomUUID() };
  const updated = updateDeal(dealId, { signals: [s, ...deal.signals].slice(0, 30) });
  broadcast("signal_detected", dealId, { signal: s });
  return updated;
}

// ─── Plays (Trigger System) ──────────────────────────────────────────────────

export function firePlay(dealId: string, play: Omit<Play, "id" | "firedAt" | "acknowledged">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const p: Play = { ...play, id: crypto.randomUUID(), firedAt: Date.now(), acknowledged: false };
  const updated = updateDeal(dealId, { plays: [p, ...deal.plays].slice(0, 30) });
  broadcast("play_fired", dealId, { play: p });
  return updated;
}

export function acknowledgePlay(dealId: string, playId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, {
    plays: deal.plays.map(p => p.id === playId ? { ...p, acknowledged: true } : p),
  });
}

// ─── Multithreading meter ────────────────────────────────────────────────────

export function multithreadingScore(deal: Deal): { engaged: number; required: number; fragile: boolean } {
  const engaged = deal.stakeholders.filter(s => s.engagement >= 50 && s.role !== "ghost").length;
  // Required stakeholders scale with stage
  const required = deal.stage === "discovery" ? 2 : deal.stage === "qualified" ? 3 : deal.stage === "proposal" ? 4 : 5;
  return { engaged, required, fragile: engaged < required };
}

// ─── Stall detection ─────────────────────────────────────────────────────────

export function stallDays(deal: Deal): number {
  const last = deal.lastBuyerActivity || deal.createdAt;
  return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
}

// ─── Stage lock ──────────────────────────────────────────────────────────────

export function canAdvanceStage(deal: Deal, toStage: DealStage): { allowed: boolean; reason?: string } {
  if (toStage === "qualified" && deal.stakeholders.length < 1) {
    return { allowed: false, reason: "Need at least 1 stakeholder identified" };
  }
  if (toStage === "proposal" && deal.stakeholders.length < 2) {
    return { allowed: false, reason: "Need at least 2 stakeholders (multithreading)" };
  }
  if (toStage === "proposal" && deal.analyses.length < 1) {
    return { allowed: false, reason: "Need at least 1 Intel Analyzer run on this deal" };
  }
  if (toStage === "negotiation" && deal.truthScore < 50) {
    return { allowed: false, reason: `TRUTH Score ${deal.truthScore} below threshold (50) — deal not qualified` };
  }
  return { allowed: true };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

// ─── Target Package management ────────────────────────────────────

export function updatePackageSection(
  dealId: string,
  section: PackageSection,
  data: { status: PackageStatus; content?: string; sources?: string[] }
): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const pkg = deal.targetPackage || {
    sections: {
      market_intent: { status: "idle" as PackageStatus },
      pitch: { status: "idle" as PackageStatus },
      objections: { status: "idle" as PackageStatus },
      warbook: { status: "idle" as PackageStatus },
      prospects: { status: "idle" as PackageStatus },
    },
    overallStatus: "idle" as PackageStatus,
  };
  const newSections = {
    ...pkg.sections,
    [section]: { status: data.status, updatedAt: Date.now(), sources: data.sources },
  };
  const contentKey = section === "market_intent" ? "marketIntent" : section;
  const newPkg: TargetPackage = {
    ...pkg,
    [contentKey]: data.content !== undefined ? data.content : (pkg as any)[contentKey],
    sections: newSections,
  };
  // Compute overall status
  const statuses = Object.values(newSections).map(s => s.status);
  if (statuses.every(s => s === "ready")) newPkg.overallStatus = "ready";
  else if (statuses.some(s => s === "generating")) newPkg.overallStatus = "generating";
  else if (statuses.some(s => s === "failed")) newPkg.overallStatus = "degraded";
  else if (statuses.some(s => s === "ready")) newPkg.overallStatus = "partial";
  if (newPkg.overallStatus === "ready") newPkg.generatedAt = Date.now();
  return updateDeal(dealId, { targetPackage: newPkg });
}

export function markPackageGenerating(dealId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, {
    targetPackage: {
      ...deal.targetPackage,
      sections: {
        market_intent: { status: "generating", updatedAt: Date.now() },
        pitch: { status: "generating", updatedAt: Date.now() },
        objections: { status: "generating", updatedAt: Date.now() },
        warbook: { status: "generating", updatedAt: Date.now() },
        prospects: { status: "generating", updatedAt: Date.now() },
      },
      overallStatus: "generating",
    },
  });
}

// ─── Daily Briefs ───────────────────────────────────────────────────
export function addDailyBrief(dealId: string, brief: Omit<DailyBrief, "id" | "generatedAt">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const b: DailyBrief = { ...brief, id: crypto.randomUUID(), generatedAt: Date.now() };
  const briefs = [b, ...(deal.dailyBriefs || [])].slice(0, 30);
  return updateDeal(dealId, {
    dailyBriefs: briefs,
    targetMeta: {
      ...deal.targetMeta,
      signalScore: brief.dailySignalScore,
      lastBriefAt: Date.now(),
    },
  });
}

// ─── Target Tier Management ────────────────────────────────────

export function updateTargetTier(dealId: string, tier: TargetTier): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, { targetMeta: { ...deal.targetMeta, tier } });
}

// ─── Signal Score Computation (weighted) ───────────────────────────

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  funding: 4,
  new_c_suite: 3,
  leadership: 3,
  hiring_surge: 3,
  job_post_matching: 3,
  job_posting: 2,
  competitor_mention: 2,
  product_launch: 2,
  earnings: 2,
  tech_change: 2,
  contract_win: 2,
  news: 1,
  conference: 1,
};

export function computeSignalScore(signals: CompanySignal[]): number {
  if (!signals || signals.length === 0) return 0;
  // Only consider signals in last 30 days
  const cutoff = Date.now() - 30 * 86400000;
  const recent = signals.filter(s => {
    const d = new Date(s.date).getTime();
    return !isNaN(d) ? d >= cutoff : true;
  });
  const raw = recent.reduce((sum, s) => {
    const weight = SIGNAL_WEIGHTS[s.type] || 1;
    const impactMultiplier = (s.impactScore || 5) / 10;
    return sum + weight * impactMultiplier;
  }, 0);
  return Math.min(10, Math.round(raw * 10) / 10);
}

// ─── TRUTH Score Composite ───────────────────────────────────────

export function computeTruthScore(deal: Deal): number {
  // Components:
  // - buyerActivity (recency): 20 pts
  // - sentiment trend (from latest analyses): 25 pts
  // - multithreading depth: 20 pts
  // - stage progression: 15 pts
  // - signal score (external intel): 20 pts

  // Buyer activity (20 pts)
  const daysSince = stallDays(deal);
  const buyerActivityPts = daysSince <= 2 ? 20 : daysSince <= 5 ? 15 : daysSince <= 10 ? 8 : daysSince <= 20 ? 3 : 0;

  // Sentiment (25 pts) — average truthScore of last 3 analyses
  const recentAnalyses = (deal.analyses || []).slice(0, 3);
  const avgAnalysis = recentAnalyses.length > 0
    ? recentAnalyses.reduce((s, a) => s + a.truthScore, 0) / recentAnalyses.length
    : 50;
  const sentimentPts = (avgAnalysis / 100) * 25;

  // Multithreading (20 pts)
  const mt = multithreadingScore(deal);
  const mtPts = mt.required > 0 ? Math.min(20, (mt.engaged / mt.required) * 20) : 10;

  // Stage progression (15 pts)
  const stageWeight: Record<DealStage, number> = {
    discovery: 3, qualified: 6, proposal: 10, negotiation: 13, closed_won: 15, closed_lost: 0,
  };
  const stagePts = stageWeight[deal.stage] || 0;

  // External signal score (20 pts)
  const signalPts = ((deal.targetMeta?.signalScore || 0) / 10) * 20;

  return Math.min(100, Math.round(buyerActivityPts + sentimentPts + mtPts + stagePts + signalPts));
}

// Recompute TRUTH for a deal and persist
export function recomputeTruth(dealId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const score = computeTruthScore(deal);
  return updateDeal(dealId, { truthScore: score });
}

export function dealStats() {
  const deals = loadDeals();
  const hvt = deals.filter(d => d.isHVT).length;
  const ghosts = deals.filter(d => d.isGhost).length;
  const highTruth = deals.filter(d => d.truthScore >= 70).length;
  const atRisk = deals.filter(d => d.risk === "at_risk" || d.risk === "dead").length;
  const avgTruth = deals.length > 0 ? Math.round(deals.reduce((s, d) => s + d.truthScore, 0) / deals.length) : 0;
  const openPlays = deals.flatMap(d => d.plays).filter(p => !p.acknowledged).length;
  return { total: deals.length, hvt, ghosts, highTruth, atRisk, avgTruth, openPlays };
}
