/**
 * /api/vibranium/projection — earnings + ARR forecast model.
 *
 * Computes a quarterly forecast through 2027 across three scenarios
 * (conservative / base / wild) for ATOM Sales Dominator + Voice Stack +
 * Red Team modules. Inputs are POSTed assumption knobs — defaults baked in.
 *
 * Auth: x-admin-key required.
 *
 * GET  → run forecast with default assumptions
 * POST → run forecast with custom assumption JSON
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

interface Assumptions {
  // Tenant counts at Q2 2026 (today)
  startTenants:           number;
  // Net-new tenants per quarter, by scenario
  newTenantsPerQ:         { conservative: number; base: number; wild: number };
  // Plan mix (% of new tenants by plan)
  planMix:                { trial: number; starter: number; growth: number; advisory: number; enterprise: number };
  // Plan ARPU per month (USD)
  planArpu:               { trial: number; starter: number; growth: number; advisory: number; enterprise: number };
  // Quarterly churn rate (% of paying tenants who leave each quarter)
  churnRateQ:             { conservative: number; base: number; wild: number };
  // Voice Stack module attach rate (% of paying tenants who add voice)
  voiceAttachRate:        { conservative: number; base: number; wild: number };
  // Voice Stack avg dials/tenant/month
  voiceDialsPerTenantMo:  number;
  // Voice Stack revenue per dial (USD)
  voiceRevPerDial:        number;
  // Red Team module attach rate (% of enterprise tenants)
  redTeamAttachRate:      { conservative: number; base: number; wild: number };
  // Red Team monthly retainer (USD)
  redTeamMonthly:         number;
  // Gross margin assumption (post-Vibranium savings)
  grossMargin:            { conservative: number; base: number; wild: number };
}

const DEFAULTS: Assumptions = {
  startTenants: 3,
  newTenantsPerQ:        { conservative: 4,   base: 12,  wild: 35 },
  planMix:               { trial: 0.30, starter: 0.25, growth: 0.25, advisory: 0.15, enterprise: 0.05 },
  planArpu:              { trial: 0,    starter: 99,   growth: 299,  advisory: 799,  enterprise: 1999 },
  churnRateQ:            { conservative: 0.12, base: 0.08, wild: 0.04 },
  voiceAttachRate:       { conservative: 0.30, base: 0.55, wild: 0.85 },
  voiceDialsPerTenantMo: 800,
  voiceRevPerDial:       0.40,
  redTeamAttachRate:     { conservative: 0.05, base: 0.15, wild: 0.40 },
  redTeamMonthly:        12_000,
  grossMargin:           { conservative: 0.55, base: 0.68, wild: 0.78 },
};

const QUARTERS = [
  { label: "2026 Q3", q: 1 }, { label: "2026 Q4", q: 2 },
  { label: "2027 Q1", q: 3 }, { label: "2027 Q2", q: 4 },
  { label: "2027 Q3", q: 5 }, { label: "2027 Q4", q: 6 },
];

type Scenario = "conservative" | "base" | "wild";
const SCENARIOS: Scenario[] = ["conservative", "base", "wild"];

function runScenario(a: Assumptions, sc: Scenario) {
  let payingTenants = a.startTenants;
  const series: any[] = [];

  for (const q of QUARTERS) {
    // Churn first
    const churned = Math.floor(payingTenants * a.churnRateQ[sc]);
    payingTenants = Math.max(0, payingTenants - churned);
    // New tenants this quarter
    payingTenants += a.newTenantsPerQ[sc];

    // Plan distribution
    const { planMix, planArpu } = a;
    const tenantsByPlan = {
      trial:      Math.round(payingTenants * planMix.trial),
      starter:    Math.round(payingTenants * planMix.starter),
      growth:     Math.round(payingTenants * planMix.growth),
      advisory:   Math.round(payingTenants * planMix.advisory),
      enterprise: Math.round(payingTenants * planMix.enterprise),
    };

    // SaaS MRR (multi-quarter cumulative is simply current MRR)
    const saasMrr =
      tenantsByPlan.starter    * planArpu.starter +
      tenantsByPlan.growth     * planArpu.growth +
      tenantsByPlan.advisory   * planArpu.advisory +
      tenantsByPlan.enterprise * planArpu.enterprise;

    // Voice usage — only paying (non-trial) tenants attach
    const payingNonTrial = payingTenants - tenantsByPlan.trial;
    const voiceTenants   = Math.round(payingNonTrial * a.voiceAttachRate[sc]);
    const voiceMrr       = voiceTenants * a.voiceDialsPerTenantMo * a.voiceRevPerDial;

    // Red Team — only enterprise tenants attach
    const redTeamTenants = Math.round(tenantsByPlan.enterprise * a.redTeamAttachRate[sc]);
    const redTeamMrr     = redTeamTenants * a.redTeamMonthly;

    const totalMrr = saasMrr + voiceMrr + redTeamMrr;
    const totalArr = totalMrr * 12;
    const grossProfit = totalMrr * a.grossMargin[sc];

    series.push({
      quarter: q.label,
      payingTenants,
      saasMrr,
      voiceMrr,
      redTeamMrr,
      totalMrr,
      totalArr,
      grossProfit,
      planMix: tenantsByPlan,
    });
  }

  return series;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  let assumptions = DEFAULTS;
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      assumptions = { ...DEFAULTS, ...body, planMix: { ...DEFAULTS.planMix, ...(body.planMix || {}) }, planArpu: { ...DEFAULTS.planArpu, ...(body.planArpu || {}) } };
    } catch { /* fall through with defaults */ }
  }

  const scenarios: Record<string, any> = {};
  for (const sc of SCENARIOS) scenarios[sc] = runScenario(assumptions, sc);

  // Year-end totals for KPI tiles
  const summary = SCENARIOS.map((sc) => {
    const last = scenarios[sc][scenarios[sc].length - 1];
    return {
      scenario: sc,
      year_end_arr: last.totalArr,
      year_end_mrr: last.totalMrr,
      year_end_tenants: last.payingTenants,
      year_end_gross_profit_mo: last.grossProfit,
    };
  });

  return res.json({
    assumptions,
    scenarios,
    summary,
    horizon: QUARTERS.map((q) => q.label),
  });
}
