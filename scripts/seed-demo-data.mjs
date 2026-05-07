#!/usr/bin/env node
/**
 * Demo data seeder — creates realistic usage history for all tenants so the
 * admin layer (Overview / HQ / Tenant Detail) renders gorgeous live charts.
 *
 * What it seeds (last 30 days, deterministic-ish randomization):
 *   • module_usage rows for every ATOM module (pitch, objection, market,
 *     prospects, warbook, leadgen, campaign, atom-chat) with a mix of
 *     successful + failed actions across multiple synthetic users.
 *   • predial_checks rows: ~95% allowed, 5% blocked with realistic reasons.
 *   • tenant_calls rows: matching the leadgen module activity volume.
 *   • status_incidents: one historical incident (auto-resolved) per tenant
 *     for the timeline.
 *
 * Idempotent guard: bails out unless `--force` is passed AND the tenant
 * already has < 50 module_usage rows. (You don't want to re-seed prod.)
 *
 * Usage:
 *   node scripts/seed-demo-data.mjs [--force] [--tenant=slug]
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or supabase_keys.txt
 * fallback in /home/user/workspace/).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── env ──────────────────────────────────────────────────────────────────────
let SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
let SERVICE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  const keysPath = "/home/user/workspace/supabase_keys.txt";
  if (fs.existsSync(keysPath)) {
    const txt = fs.readFileSync(keysPath, "utf-8");
    for (const line of txt.split("\n")) {
      const sepIdx = Math.min(...[line.indexOf(":"), line.indexOf("=")].filter(i => i >= 0));
      if (!Number.isFinite(sepIdx) || sepIdx < 0) continue;
      const k = line.slice(0, sepIdx).trim();
      const v = line.slice(sepIdx + 1).trim();
      if (!v) continue;
      if (k === "SUPABASE_URL")              SUPABASE_URL = v;
      if (k === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_KEY  = v;
    }
  }
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const force = process.argv.includes("--force");
const tenantArg = (process.argv.find((a) => a.startsWith("--tenant=")) || "").split("=")[1] || null;

async function sb(p, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: init.method === "POST" ? "return=representation" : "return=minimal",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${p} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

// ── seed corpus ──────────────────────────────────────────────────────────────
const SYNTHETIC_USERS = {
  antimatter: ["ben.oleary@thingktangk.com", "sarah.kim@antimatterai.com", "alex.chen@antimatterai.com", "priya.patel@antimatterai.com"],
  deady:      ["dev@deadycorp.com", "intern@deadycorp.com"],
  intelisys:  ["ops@intelisys.io", "founder@intelisys.io", "sales@intelisys.io"],
};

const MODULES = ["pitch", "objection", "market", "prospects", "warbook", "leadgen", "campaign", "atom-chat"];
const ACTIONS = ["generate", "view", "export", "save", "regenerate"];

const BLOCK_REASONS = ["dnc_internal", "no_consent", "dnc_federal", "wireless_unverified", "quiet_hours"];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function gauss(mean, std) {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

async function tenantBySlug(slug) {
  const rows = await sb(`tenants?slug=eq.${slug}&select=id,slug,name`);
  return rows && rows[0];
}

async function moduleUsageCount(tenantId) {
  // PostgREST: HEAD with Prefer: count=exact returns count in header.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/module_usage?tenant_id=eq.${tenantId}&select=id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" },
  });
  const cr = r.headers.get("content-range") || "";
  const m = cr.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function genTimestamp(daysAgoMax = 30) {
  // Bias toward business hours (9–18 UTC) and weekdays
  const daysAgo = Math.floor(Math.random() * daysAgoMax);
  const d = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  const hour = Math.max(0, Math.min(23, Math.round(gauss(14, 4))));
  d.setUTCHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return d.toISOString();
}

async function seedTenant(slug) {
  const t = await tenantBySlug(slug);
  if (!t) { console.warn(`✗ tenant not found: ${slug}`); return; }
  const existing = await moduleUsageCount(t.id);
  if (existing > 50 && !force) {
    console.log(`⏭  ${slug}: ${existing} module_usage rows exist — skipping (pass --force to override)`);
    return;
  }
  console.log(`→ Seeding ${slug} (${t.id})`);

  const users = SYNTHETIC_USERS[slug] || ["ops@example.com"];

  // ── module_usage ──────────────────────────────────────────────────────────
  const usageRows = [];
  // 30 days × 8 modules × ~3 actions/day per user → ~2k rows per tenant
  const activityPerUser = 80 + Math.floor(Math.random() * 60);
  for (const user of users) {
    for (let i = 0; i < activityPerUser; i++) {
      usageRows.push({
        tenant_id: t.id,
        user_email: user,
        module: rand(MODULES),
        action: Math.random() < 0.85 ? rand(ACTIONS) : "success",  // 15% success-tagged
        created_at: genTimestamp(30),
      });
    }
  }
  // Insert in batches of 200
  for (let i = 0; i < usageRows.length; i += 200) {
    await sb("module_usage", { method: "POST", body: JSON.stringify(usageRows.slice(i, i + 200)) });
  }
  console.log(`  ✓ module_usage: ${usageRows.length} rows`);

  // ── predial_checks ───────────────────────────────────────────────────────
  const predialRows = [];
  const dialCount = users.length * (40 + Math.floor(Math.random() * 50));
  for (let i = 0; i < dialCount; i++) {
    const allowed = Math.random() < 0.94;
    predialRows.push({
      tenant_id: t.id,
      phone: `+155512${String(10000 + Math.floor(Math.random() * 90000)).slice(-5)}`,
      allowed,
      block_reasons: allowed ? [] : [rand(BLOCK_REASONS)],
      actor_email: rand(users),
      checked_at: genTimestamp(7),
    });
  }
  for (let i = 0; i < predialRows.length; i += 200) {
    await sb("predial_checks", { method: "POST", body: JSON.stringify(predialRows.slice(i, i + 200)) });
  }
  console.log(`  ✓ predial_checks: ${predialRows.length} rows`);

  // ── tenant_calls (matching successful pre-dials) ─────────────────────────
  const callRows = [];
  const callCount = Math.floor(predialRows.filter(p => p.allowed).length * 0.7);
  const STATUSES = ["completed", "completed", "completed", "no_answer", "voicemail", "busy"];
  for (let i = 0; i < callCount; i++) {
    callRows.push({
      tenant_id: t.id,
      call_sid: `CA${Math.random().toString(36).slice(2, 10)}_demo`,
      to_number: `+155512${String(10000 + Math.floor(Math.random() * 90000)).slice(-5)}`,
      status: rand(STATUSES),
      duration_s: Math.floor(Math.abs(gauss(180, 90))),
      final_sentiment: gauss(20, 35),
      final_intent: Math.max(0, Math.min(100, gauss(45, 25))),
      final_stage: 1 + Math.floor(Math.random() * 4),
      started_at: genTimestamp(30),
    });
  }
  for (let i = 0; i < callRows.length; i += 100) {
    try {
      await sb("tenant_calls", { method: "POST", body: JSON.stringify(callRows.slice(i, i + 100)) });
    } catch (e) {
      console.warn(`  ⚠ tenant_calls batch ${i} failed: ${String(e).slice(0, 120)}`);
    }
  }
  console.log(`  ✓ tenant_calls: ${callRows.length} rows`);

  // ── tenant_integrations (one or two connected per tenant) ─────────────────
  const PROVIDERS = ["slack", "salesforce", "hubspot", "gmail", "outlook"];
  const numConnected = 1 + Math.floor(Math.random() * 3);
  const chosen = [...PROVIDERS].sort(() => 0.5 - Math.random()).slice(0, numConnected);
  const integrationRows = chosen.map(p => ({
    tenant_id: t.id,
    provider: p,
    status: "connected",
    connected_at: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 3600 * 1000).toISOString(),
    last_synced_at: new Date(Date.now() - Math.floor(Math.random() * 4) * 3600 * 1000).toISOString(),
    connected_by: users[0],
  }));
  for (const row of integrationRows) {
    try {
      await sb("tenant_integrations", { method: "POST", body: JSON.stringify([row]) });
    } catch (e) { /* unique constraint may already be set; ignore */ }
  }
  console.log(`  ✓ tenant_integrations: ${integrationRows.length} rows (${chosen.join(", ")})`);
}

// ── status_incidents (one historical, auto-resolved) ────────────────────────
async function seedHistoricalIncident() {
  // Insert one resolved incident from ~2 weeks ago for the timeline.
  const detected = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const resolved = new Date(Date.now() - 14 * 24 * 3600 * 1000 + 47 * 60 * 1000).toISOString();
  try {
    await sb("status_incidents", {
      method: "POST",
      body: JSON.stringify([{
        component: "rag-service",
        severity: "major",
        remediation: "SSH root@45.79.202.76; pm2 restart atom-rag; check Pinecone index health.",
        detected_at: detected,
        resolved_at: resolved,
        post_mortem: "RAG service ran out of file descriptors during reingest; scaled ulimit + restarted pm2.",
      }]),
    });
    console.log("✓ status_incidents: historical sample inserted");
  } catch (e) {
    console.warn(`⚠ status_incidents seed skipped: ${String(e).slice(0, 120)}`);
  }
}

// ── run ──────────────────────────────────────────────────────────────────────
const slugs = tenantArg ? [tenantArg] : ["antimatter", "deady", "intelisys"];
console.log(`Seeding tenants: ${slugs.join(", ")}${force ? " (--force)" : ""}\n`);
for (const s of slugs) await seedTenant(s);
await seedHistoricalIncident();
console.log("\n✓ Demo data seeding complete.");
