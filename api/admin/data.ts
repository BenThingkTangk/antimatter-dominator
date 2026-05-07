/**
 * /api/admin/data — combined data feed for the admin tabs.
 *
 * GET ?view=<name>&tenantSlug=<slug>
 *   view = compliance | leaderboard | tenants-overview | billing-overview |
 *          integrations | apikeys | tenants-list | hq | tenant-detail
 *
 * POST ?view=<name>
 *   view = dnc-add | integrations-disconnect | tenant-killswitch | target-update
 *
 * Single endpoint keeps the admin layer fast (one Vercel function instead of
 * a dozen). Auth: x-admin-key required.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 220)}`);
  return t ? JSON.parse(t) : null;
}

async function tenantBySlug(slug: string) {
  if (!slug) return null;
  const rows = await sb(`tenants?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name,plan`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

// Provider registry — used by the API Keys tab. We never expose the actual
// secrets; we only report whether the env var is set + recent usage.
const PROVIDERS = [
  { name: "Perplexity Sonar", keyVar: "PERPLEXITY_API_KEY", used_by: ["pitch","objection","market","warbook","atom-chat","embeddings"] },
  { name: "OpenAI",            keyVar: "OPENAI_API_KEY",     used_by: ["pitch","objection","embeddings","fallback"] },
  { name: "Anthropic Claude",  keyVar: "ANTHROPIC_API_KEY",  used_by: ["pitch","objection","atom-chat"] },
  { name: "Hume EVI",          keyVar: "HUME_API_KEY",       used_by: ["atom-leadgen","voice"] },
  { name: "Twilio",            keyVar: "TWILIO_ACCOUNT_SID", used_by: ["atom-leadgen"] },
  { name: "Pinecone",          keyVar: "PINECONE_API_KEY",   used_by: ["warbook","embeddings"] },
  { name: "Apollo",            keyVar: "APOLLO_API_KEY",     used_by: ["prospects","warbook"] },
  { name: "People Data Labs",  keyVar: "PDL_API_KEY",        used_by: ["prospects","warbook"] },
  { name: "Supabase",          keyVar: "SUPABASE_URL",       used_by: ["all"] },
  { name: "Stripe",            keyVar: "STRIPE_SECRET_KEY",  used_by: ["billing"] },
  { name: "Slack alerts",      keyVar: "SLACK_ALERT_WEBHOOK",used_by: ["qa-analyzer"] },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  const url = new URL(req.url || "", "http://x");
  const view = String(req.query.view || "").trim();
  const tenantSlug = String(req.query.tenantSlug || "").trim();

  try {
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (view === "dnc-add")                return res.json(await addDnc(body));
      if (view === "integrations-disconnect")return res.json(await disconnectIntegration(body));
      if (view === "tenant-killswitch")      return res.json(await tenantKillswitch(body));
      if (view === "target-update")          return res.json(await updateTarget(body));
      return res.status(400).json({ error: "unknown POST view", view });
    }

    if (view === "compliance")        return res.json(await loadCompliance(tenantSlug));
    if (view === "leaderboard")       return res.json(await loadLeaderboard(tenantSlug));
    if (view === "tenants-overview")  return res.json(await loadTenantsOverview());
    if (view === "tenants-list")      return res.json(await loadTenantsList());
    if (view === "billing-overview")  return res.json(await loadBillingOverview());
    if (view === "integrations")      return res.json(await loadIntegrations(tenantSlug));
    if (view === "apikeys")           return res.json(await loadApiKeys());
    if (view === "hq")                return res.json(await loadHq());
    if (view === "tenant-detail")     return res.json(await loadTenantDetail(tenantSlug));
    return res.status(400).json({ error: "unknown view", view });
  } catch (e: any) {
    console.error("[admin/data]", view, e?.message);
    return res.status(500).json({ error: e?.message || "internal", view });
  }
}

async function loadCompliance(tenantSlug: string) {
  const t = await tenantBySlug(tenantSlug || "antimatter");
  if (!t) return { error: "tenant not found" };
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [allowed, blocked, consents, dnc, audit] = await Promise.all([
    sb(`predial_checks?tenant_id=eq.${t.id}&allowed=eq.true&checked_at=gte.${since24}&select=id`).catch(() => []),
    sb(`predial_checks?tenant_id=eq.${t.id}&allowed=eq.false&checked_at=gte.${since24}&select=id,phone,checked_at,block_reasons,actor_email`).catch(() => []),
    sb(`consent_ledger?tenant_id=eq.${t.id}&order=captured_at.desc&limit=15&select=id,prospect_identifier,channel,consent_type,captured_at,revoked_at`).catch(() => []),
    sb(`dnc_entries?tenant_id=eq.${t.id}&removed_at=is.null&order=added_at.desc&limit=24&select=id,identifier,identifier_type,source,state,added_at`).catch(() => []),
    sb(`audit_log?tenant_id=eq.${t.id}&order=created_at.desc&limit=200&select=entry_hash,prior_hash,created_at`).catch(() => []),
  ]);

  // Verify hash chain integrity (best-effort — a real verifier would
  // recompute SHA-256 over canonical payloads; here we just check that every
  // row's prior_hash matches the previous row's entry_hash).
  let verified = true;
  const auditRows = (audit ?? []).slice().reverse(); // chronological
  for (let i = 1; i < auditRows.length; i++) {
    if (auditRows[i].prior_hash !== auditRows[i - 1].entry_hash) { verified = false; break; }
  }

  // Block reasons donut
  const reasonCounts: Record<string, number> = {};
  for (const b of blocked ?? []) for (const r of b.block_reasons || []) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  const blockReasons = Object.entries(reasonCounts).map(([name, value]) => ({ name, value }));

  // Hourly trend
  const trendMap: Record<string, { allowed: number; blocked: number }> = {};
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.now() - i * 3600 * 1000);
    trendMap[`${d.getUTCHours().toString().padStart(2, "0")}:00`] = { allowed: 0, blocked: 0 };
  }
  for (const a of allowed ?? []) {
    const h = new Date(a.checked_at || since24).getUTCHours().toString().padStart(2, "0") + ":00";
    if (trendMap[h]) trendMap[h].allowed++;
  }
  for (const b of blocked ?? []) {
    const h = new Date(b.checked_at).getUTCHours().toString().padStart(2, "0") + ":00";
    if (trendMap[h]) trendMap[h].blocked++;
  }
  const trend = Object.entries(trendMap).map(([hour, v]) => ({ hour, ...v }));

  const revoked = (consents ?? []).filter((c: any) => c.revoked_at).length;

  return {
    tenant: t,
    kpis: {
      allowed24h: (allowed ?? []).length,
      blocked24h: (blocked ?? []).length,
      consents: (consents ?? []).filter((c: any) => !c.revoked_at).length,
      revokedConsents: revoked,
      dncCount: (dnc ?? []).length,
      auditEntries: (audit ?? []).length,
    },
    blockReasons,
    trend,
    recentBlocks: blocked ?? [],
    consents: consents ?? [],
    dnc: dnc ?? [],
    hashChain: { verified, entries: (audit ?? []).length },
  };
}

async function loadLeaderboard(tenantSlug: string) {
  const t = await tenantBySlug(tenantSlug || "antimatter");
  if (!t) return { rows: [] };
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const usage = await sb(
    `module_usage?tenant_id=eq.${t.id}&created_at=gte.${since30}&select=user_email,module,action`
  ).catch(() => []);

  const byUser: Record<string, { dials: number; success: number; total: number }> = {};
  for (const r of usage ?? []) {
    const u = r.user_email || "unknown";
    byUser[u] ||= { dials: 0, success: 0, total: 0 };
    byUser[u].total++;
    if (r.action === "success") byUser[u].success++;
    if (r.module === "leadgen") byUser[u].dials++;
  }
  const rows = Object.entries(byUser).map(([email, v]) => {
    const score = Math.min(100, Math.round((v.total / 5) + (v.dials * 2) + (v.success / Math.max(1, v.total)) * 30));
    const conversion = v.total > 0 ? v.success / v.total : 0;
    const tier = score >= 70 ? "top" : score >= 35 ? "mid" : "bottom";
    return { email, name: email.split("@")[0], score, dials: v.dials, conversion, tier };
  }).sort((a, b) => b.score - a.score);

  return { rows };
}

async function loadTenantsOverview() {
  const tenants = await sb("tenant_health?select=*").catch(() => []);
  const rows = tenants ?? [];
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const newRows = await sb(`tenants?created_at=gte.${since30}&deleted_at=is.null&select=id`).catch(() => []);

  // Plan mix
  const planMix: Record<string, number> = {};
  for (const r of rows) planMix[r.plan || "trial"] = (planMix[r.plan || "trial"] || 0) + 1;

  // MRR estimation (using plan_caps)
  const plans = await sb("plan_caps?select=plan,monthly_price_cents").catch(() => []);
  const priceByPlan: Record<string, number> = {};
  for (const p of plans ?? []) priceByPlan[p.plan] = p.monthly_price_cents;
  const mrrCents = rows.reduce((acc: number, r: any) => acc + (priceByPlan[r.plan] || 0), 0);

  // Synthesize a 12-month MRR stack from tenants' creation date (best-effort)
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(); d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const mrrStack = months.map((month) => {
    const upTo = new Date(month + "-28").getTime();
    const obj: any = { month, trial: 0, starter: 0, growth: 0, advisory: 0, enterprise: 0 };
    for (const r of rows) {
      if (new Date(r.created_at || month).getTime() <= upTo) {
        const plan = r.plan || "trial";
        const price = priceByPlan[plan] || 0;
        obj[plan] = (obj[plan] || 0) + price;
      }
    }
    return obj;
  });

  // Growth bar
  const growth = months.map((month) => {
    const newCount = rows.filter((r: any) => (r.created_at || "").slice(0, 7) === month).length;
    return { month, new_tenants: newCount, churned: 0 };
  });

  return {
    kpis: {
      activeTenants: rows.length,
      newThisMonth: (newRows ?? []).length,
      mrrCents,
      atRisk: rows.filter((r: any) => r.kill_switch || r.subscription_status === "past_due").length,
    },
    growth,
    mrrStack,
    planMix: Object.entries(planMix).map(([name, value]) => ({ name, value })),
    tenantHealth: rows.map((r: any) => ({
      slug: r.slug, name: r.name, plan: r.plan,
      dials30d: r.dials_30d ?? 0,
      actions7d: r.actions_7d ?? 0,
      seatsUsed: r.seats_used ?? 0,
      trial_ends_at: r.trial_ends_at,
      subscription_status: r.subscription_status || "trialing",
      kill_switch: r.kill_switch || false,
      compliance_blocks_30d: r.compliance_blocks_30d ?? 0,
    })).sort((a: any, b: any) => (b.dials30d || 0) - (a.dials30d || 0)),
  };
}

async function loadBillingOverview() {
  const tenants = await sb("tenants?deleted_at=is.null&select=plan,subscription_status,created_at").catch(() => []);
  const plans = await sb("plan_caps?select=plan,monthly_price_cents").catch(() => []);
  const priceByPlan: Record<string, number> = {};
  for (const p of plans ?? []) priceByPlan[p.plan] = p.monthly_price_cents;
  const mrrCents = (tenants ?? []).reduce((acc: number, r: any) => acc + (priceByPlan[r.plan] || 0), 0);

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const mrrSeries = months.map((month) => ({
    month,
    mrr: (tenants ?? []).filter((t: any) => (t.created_at || "").slice(0,7) <= month).reduce((a: number, t: any) => a + (priceByPlan[t.plan] || 0), 0),
  }));
  const arrSeries = mrrSeries.map((m) => ({ month: m.month, arr: m.mrr * 12 }));

  const planLadder = (plans ?? []).map((p: any) => ({
    plan: p.plan,
    price_cents: p.monthly_price_cents,
    tenants: (tenants ?? []).filter((t: any) => t.plan === p.plan).length,
  }));

  const pastDue = (tenants ?? []).filter((t: any) => t.subscription_status === "past_due").length;

  return {
    kpis: { mrrCents, arrCents: mrrCents * 12, churnRatePct: 0, pastDue },
    mrrSeries,
    arrSeries,
    planLadder,
    recentInvoices: [], // populated by Stripe webhook later
  };
}

async function loadIntegrations(tenantSlug: string) {
  const t = await tenantBySlug(tenantSlug || "antimatter");
  const rows = t ? await sb(`tenant_integrations?tenant_id=eq.${t.id}&select=provider,status,last_synced_at,connected_at,connected_by`).catch(() => []) : [];
  return { tenant: t, integrations: rows ?? [] };
}

async function loadTenantsList() {
  const tenants = await sb(`tenants?deleted_at=is.null&order=created_at.desc&select=slug,name,plan,subscription_status`).catch(() => []);
  return { tenants: tenants ?? [] };
}

async function loadHq() {
  // Cross-tenant overlord console — Nirmata HQ.
  const [tenants, plans, incidents, targets, recent] = await Promise.all([
    sb(`tenant_health?select=*`).catch(() => []),
    sb(`plan_caps?select=plan,monthly_price_cents`).catch(() => []),
    sb(`status_incidents?select=id,component,severity,detected_at,resolved_at&order=detected_at.desc&limit=20`).catch(() => []),
    sb(`company_targets?select=*&order=horizon.asc`).catch(() => []),
    sb(`module_usage?select=tenant_id,module,action,created_at&order=created_at.desc&limit=500`).catch(() => []),
  ]);

  const priceByPlan: Record<string, number> = {};
  for (const p of plans ?? []) priceByPlan[p.plan] = p.monthly_price_cents;
  const rows = tenants ?? [];
  const mrrCents = rows.reduce((acc: number, r: any) => acc + (priceByPlan[r.plan] || 0), 0);
  const arrCents = mrrCents * 12;

  // 12-month MRR trajectory
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - i); months.push(d.toISOString().slice(0, 7)); }
  const mrrSeries = months.map((month) => {
    const upTo = new Date(month + "-28").getTime();
    const obj: any = { month };
    for (const plan of ["trial","starter","growth","advisory","enterprise"]) obj[plan] = 0;
    for (const r of rows) {
      if (new Date(r.created_at || month).getTime() <= upTo) {
        obj[r.plan || "trial"] = (obj[r.plan || "trial"] || 0) + (priceByPlan[r.plan] || 0);
      }
    }
    return obj;
  });

  // Module usage heatmap (7 days × 24 hours, summed across tenants)
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const u of recent ?? []) {
    const d = new Date(u.created_at);
    if (Date.now() - d.getTime() < 7 * 24 * 3600 * 1000) {
      heatmap[d.getUTCDay()][d.getUTCHours()]++;
    }
  }

  // Cross-tenant churn risk
  const churnRisk = rows
    .map((r: any) => {
      let score = 0;
      const reasons: string[] = [];
      if (r.kill_switch) { score += 50; reasons.push("kill-switch"); }
      if (r.subscription_status === "past_due") { score += 35; reasons.push("past-due"); }
      if ((r.dials_30d || 0) === 0 && r.plan !== "trial") { score += 25; reasons.push("no-dials-30d"); }
      if ((r.actions_7d || 0) === 0) { score += 15; reasons.push("no-activity-7d"); }
      if (r.trial_ends_at && new Date(r.trial_ends_at).getTime() < Date.now() + 3 * 24 * 3600 * 1000 && r.plan === "trial") {
        score += 20; reasons.push("trial-ending-soon");
      }
      return { slug: r.slug, name: r.name, plan: r.plan, score: Math.min(100, score), reasons };
    })
    .filter((x: any) => x.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 12);

  // Targets progress
  const horizons: Record<string, any[]> = {};
  for (const t of targets ?? []) (horizons[t.horizon] ||= []).push(t);

  // Open incidents
  const incidentsRows = (incidents ?? []).map((i: any) => ({
    id: i.id,
    component: i.component,
    severity: i.severity,
    status: i.resolved_at ? "resolved" : "open",
    started_at: i.detected_at,
    resolved_at: i.resolved_at,
  }));
  const openIncidents = incidentsRows.filter((i: any) => i.status !== "resolved");

  return {
    kpis: {
      mrrCents, arrCents,
      tenants: rows.length,
      paying: rows.filter((r: any) => ["starter","growth","advisory","enterprise"].includes(r.plan)).length,
      trials: rows.filter((r: any) => r.plan === "trial").length,
      atRisk: churnRisk.length,
      openIncidents: openIncidents.length,
      dials30d: rows.reduce((a: number, r: any) => a + (r.dials_30d || 0), 0),
    },
    mrrSeries,
    heatmap,
    churnRisk,
    targets: horizons,
    incidents: incidentsRows,
    tenants: rows.map((r: any) => ({
      slug: r.slug, name: r.name, plan: r.plan,
      mrr: priceByPlan[r.plan] || 0,
      dials30d: r.dials_30d ?? 0,
      actions7d: r.actions_7d ?? 0,
      seatsUsed: r.seats_used ?? 0,
      compliance_blocks_30d: r.compliance_blocks_30d ?? 0,
      kill_switch: r.kill_switch || false,
      subscription_status: r.subscription_status || "trialing",
    })),
  };
}

async function loadTenantDetail(tenantSlug: string) {
  const t = await tenantBySlug(tenantSlug || "antimatter");
  if (!t) return { error: "tenant not found" };
  const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const since7  = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [calls, usage, users, integrations, predial] = await Promise.all([
    sb(`tenant_calls?tenant_id=eq.${t.id}&started_at=gte.${since30}&select=id,duration_s,status,started_at`).catch(() => []),
    sb(`module_usage?tenant_id=eq.${t.id}&created_at=gte.${since30}&select=user_email,module,action,created_at`).catch(() => []),
    sb(`tenant_users?tenant_id=eq.${t.id}&select=email,role,full_name,last_login_at,created_at`).catch(() => []),
    sb(`tenant_integrations?tenant_id=eq.${t.id}&select=provider,status,last_synced_at`).catch(() => []),
    sb(`predial_checks?tenant_id=eq.${t.id}&checked_at=gte.${since7}&select=allowed,checked_at`).catch(() => []),
  ]);

  // Daily dial trend (30d)
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setUTCDate(d.getUTCDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const dialMap: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]));
  for (const c of calls ?? []) {
    const day = (c.started_at || "").slice(0, 10);
    if (day in dialMap) dialMap[day]++;
  }
  const dialTrend = days.map((day) => ({ day: day.slice(5), dials: dialMap[day] }));

  // Module mix (30d)
  const moduleMix: Record<string, number> = {};
  for (const u of usage ?? []) moduleMix[u.module || "unknown"] = (moduleMix[u.module || "unknown"] || 0) + 1;
  const moduleMixArr = Object.entries(moduleMix).map(([name, value]) => ({ name, value }));

  // Power-user leaderboard
  const byUser: Record<string, { dials: number; actions: number; success: number }> = {};
  for (const u of usage ?? []) {
    const key = u.user_email || "unknown";
    byUser[key] ||= { dials: 0, actions: 0, success: 0 };
    byUser[key].actions++;
    if (u.module === "leadgen") byUser[key].dials++;
    if (u.action === "success") byUser[key].success++;
  }
  // Augment dials with actual call counts
  for (const c of calls ?? []) {
    // tenant_calls doesn't carry user_email, so we don't attribute dials per user here.
  }
  const leaderboard = Object.entries(byUser).map(([email, v]) => {
    const score = Math.min(100, Math.round(v.actions / 5 + v.dials * 2 + (v.success / Math.max(1, v.actions)) * 30));
    return {
      email,
      name: email.split("@")[0],
      score,
      dials: v.dials,
      conversion: v.actions > 0 ? v.success / v.actions : 0,
      tier: (score >= 70 ? "top" : score >= 35 ? "mid" : "bottom") as "top"|"mid"|"bottom",
    };
  }).sort((a, b) => b.score - a.score);

  // Hour×day call heatmap (7d)
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const c of calls ?? []) {
    const d = new Date(c.started_at);
    if (Date.now() - d.getTime() < 7 * 24 * 3600 * 1000) heatmap[d.getUTCDay()][d.getUTCHours()]++;
  }

  // Pre-dial allowed/blocked rate
  const predialRows = predial ?? [];
  const allowed = predialRows.filter((p: any) => p.allowed).length;
  const blocked = predialRows.length - allowed;

  return {
    tenant: t,
    kpis: {
      dials30d: (calls ?? []).length,
      actions30d: (usage ?? []).length,
      activeSeats: (users ?? []).length,
      integrationsConnected: (integrations ?? []).filter((i: any) => i.status === "connected").length,
      predialAllowed: allowed,
      predialBlocked: blocked,
    },
    dialTrend,
    moduleMix: moduleMixArr,
    heatmap,
    leaderboard: leaderboard.slice(0, 12),
    users: users ?? [],
    integrations: integrations ?? [],
  };
}

async function addDnc(body: any) {
  const slug = (body?.tenantSlug || "").trim();
  const t = await tenantBySlug(slug);
  if (!t) throw new Error("tenant not found");
  if (!body?.identifier) throw new Error("identifier required");
  const row = await sb(`dnc_entries`, {
    method: "POST",
    body: JSON.stringify([{
      tenant_id: t.id,
      identifier: body.identifier,
      identifier_type: body.identifierType || "phone",
      source: body.source || "internal",
      state: body.state || null,
    }]),
  });
  return { ok: true, row };
}

async function disconnectIntegration(body: any) {
  const slug = (body?.tenantSlug || "").trim();
  const t = await tenantBySlug(slug);
  if (!t) throw new Error("tenant not found");
  if (!body?.provider) throw new Error("provider required");
  await sb(`tenant_integrations?tenant_id=eq.${t.id}&provider=eq.${encodeURIComponent(body.provider)}`, { method: "PATCH", body: JSON.stringify({ status: "disconnected" }) }).catch(() => null);
  return { ok: true };
}

async function tenantKillswitch(body: any) {
  const slug = (body?.tenantSlug || "").trim();
  const t = await tenantBySlug(slug);
  if (!t) throw new Error("tenant not found");
  await sb(`tenants?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ kill_switch: !!body.enabled }) });
  return { ok: true };
}

async function updateTarget(body: any) {
  if (!body?.id) throw new Error("id required");
  const patch: any = {};
  if (typeof body.current_value === "number") patch.current_value = body.current_value;
  if (typeof body.target_value === "number")  patch.target_value = body.target_value;
  if (typeof body.label === "string")         patch.label = body.label;
  if (typeof body.note === "string")          patch.note = body.note;
  await sb(`company_targets?id=eq.${body.id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return { ok: true };
}

async function loadApiKeys() {
  // Probe envs for `configured` flag without leaking values.
  // Vercel env vars are exposed only to server functions — we check
  // process.env directly here, never in the response payload.
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const probes = await sb(`qa_probes?probed_at=gte.${since24}&select=component,status,error`).catch(() => []);
  const usageByComponent: Record<string, { ok: number; err: number }> = {};
  for (const p of probes ?? []) {
    usageByComponent[p.component] ||= { ok: 0, err: 0 };
    if (p.status === "ok") usageByComponent[p.component].ok++; else usageByComponent[p.component].err++;
  }

  const providers = PROVIDERS.map((p) => {
    const configured = !!clean(process.env[p.keyVar]);
    // Match provider to known qa probe components (best-effort)
    const compKey = p.keyVar === "PERPLEXITY_API_KEY" ? "api:atom-chat"
                  : p.keyVar === "PINECONE_API_KEY"   ? "pinecone"
                  : p.keyVar === "HUME_API_KEY"        ? "hume-evi"
                  : p.keyVar === "TWILIO_ACCOUNT_SID"  ? "twilio"
                  : p.keyVar === "SUPABASE_URL"        ? "supabase"
                  : null;
    const u = compKey ? usageByComponent[compKey] : null;
    return {
      name: p.name,
      keyVar: p.keyVar,
      configured,
      status: !configured ? "unknown" : u && u.err > 0 ? "error" : "ok",
      used_by: p.used_by,
      usage24h: u ? u.ok + u.err : 0,
      errors24h: u ? u.err : 0,
      spark: [],
    };
  });
  return { providers };
}
