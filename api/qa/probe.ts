/**
 * POST /api/qa/probe
 *
 * Probes all 14 ATOM components in parallel (30s hard timeout).
 * For each result: inserts qa_probes row, opens/resolves status_incidents.
 * Auth: x-admin-key OR Vercel cron (authorization: Bearer CRON_SECRET).
 * Body: optional { components?: string[] } to probe a subset.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* ── env ─────────────────────────────────────────────────────────────── */
const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);
const CRON_SECRET = clean(process.env.CRON_SECRET);
const SLACK_ALERT_WEBHOOK = clean(process.env.SLACK_ALERT_WEBHOOK);
const PINECONE_API_KEY = clean(process.env.PINECONE_API_KEY);
const HUME_API_KEY = clean(process.env.HUME_API_KEY);
const TWILIO_ACCOUNT_SID = clean(process.env.TWILIO_ACCOUNT_SID);
const TWILIO_AUTH_TOKEN = clean(process.env.TWILIO_AUTH_TOKEN);

/* ── inline Supabase helper (no shared import per project rules) ───── */
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
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

/* ── runbook map (inline as spec requires) ───────────────────────────── */
const RUNBOOK: Record<string, { severity: string; remediation: string }> = {
  "api:pitch":        { severity: "major",    remediation: "Check Perplexity/OpenAI key quotas. If 429, throttle via exponential backoff. If 500, inspect Vercel function logs for TypeError." },
  "api:atom-chat":    { severity: "major",    remediation: "Check PERPLEXITY_API_KEY. If 401, rotate. If 500, check chat_memory table + embed provider chain." },
  "api:warbook":      { severity: "minor",    remediation: "WarBook is heavy \u2014 Apollo or PDL may be rate-limited. Check apollo key credit in dashboard." },
  "rag-service":      { severity: "critical", remediation: "SSH root@45.79.202.76, pm2 restart atom-rag, check /root/atom-rag/.env has PERPLEXITY_API_KEY." },
  "pinecone":         { severity: "critical", remediation: "Pinecone console \u2192 check index atom-intelligence-pplx. If down, fallback to atom-intelligence (legacy 1536d)." },
  "supabase":         { severity: "critical", remediation: "Supabase dashboard \u2192 DB may be paused. Restart if paused state." },
  "hume-evi":         { severity: "major",    remediation: "Hume status page. Verify HUME_API_KEY + config UUIDs." },
  "twilio":           { severity: "critical", remediation: "Twilio status page. Check phone number AOS if dial errors. Verify TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN." },
  "api:embeddings":   { severity: "major",    remediation: "Perplexity embeddings fallback to OpenAI is wired. Check PERPLEXITY_API_KEY + OPENAI_API_KEY." },
  "api:market":       { severity: "major",    remediation: "Sonar API. Check PERPLEXITY_API_KEY quota." },
  "api:objection":    { severity: "major",    remediation: "Check OpenAI + Anthropic keys." },
  "api:prospects":    { severity: "major",    remediation: "Apollo + PDL credit balances. Hunter fallback removed." },
  "api:atom-leadgen": { severity: "major",    remediation: "Twilio bridge + Hume EVI. Check both." },
  "api:tenant":       { severity: "minor",    remediation: "Supabase tenants table. Verify row exists for the tested slug." },
};

/* ── component probe definitions ─────────────────────────────────────── */
interface ProbeDef {
  component: string;
  endpoint: string;
  method: "GET" | "POST";
  body?: any;
  headers?: Record<string, string>;
  maxMs: number;
  /** If true, 404 counts as healthy (e.g. atom-leadgen probe endpoint) */
  allow404?: boolean;
}

function selfOrigin(): string {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://atom-dominator-pro.vercel.app";
}

function probeDefinitions(): ProbeDef[] {
  const origin = selfOrigin();
  const adminHeaders: Record<string, string> = ADMIN_API_KEY
    ? { "X-Admin-Key": ADMIN_API_KEY }
    : {};

  return [
    {
      component: "api:pitch",
      endpoint: `${origin}/api/pitch/generate`,
      method: "POST",
      body: { company: "Acme Corp", product: "Widget", persona: "CTO", context: "QA probe" },
      headers: adminHeaders,
      maxMs: 15000,
    },
    {
      component: "api:objection",
      endpoint: `${origin}/api/objection/generate`,
      method: "POST",
      body: { objection: "Too expensive", context: "QA probe" },
      headers: adminHeaders,
      maxMs: 15000,
    },
    {
      component: "api:market",
      endpoint: `${origin}/api/market-intent/scan`,
      method: "POST",
      body: { query: "AI sales tools", context: "QA probe" },
      headers: adminHeaders,
      maxMs: 25000,
    },
    {
      component: "api:warbook",
      endpoint: `${origin}/api/warbook/research`,
      method: "POST",
      body: { company: "Acme Corp" },
      headers: adminHeaders,
      maxMs: 40000,
    },
    {
      component: "api:prospects",
      endpoint: `${origin}/api/prospects/scan`,
      method: "POST",
      body: { query: "SaaS CTO Bay Area", limit: 1 },
      headers: adminHeaders,
      maxMs: 30000,
    },
    {
      component: "api:atom-chat",
      endpoint: `${origin}/api/atom-chat`,
      method: "POST",
      body: { message: "ping" },
      headers: adminHeaders,
      maxMs: 10000,
    },
    {
      component: "api:atom-leadgen",
      endpoint: `${origin}/api/atom-leadgen/chat-events?sessionId=_probe_`,
      method: "GET",
      headers: adminHeaders,
      maxMs: 3000,
      allow404: true,
    },
    {
      component: "api:embeddings",
      endpoint: `${origin}/api/embeddings`,
      method: "POST",
      body: { texts: ["ping"] },
      headers: adminHeaders,
      maxMs: 5000,
    },
    {
      component: "api:tenant",
      endpoint: `${origin}/api/tenant?host=atomdominator.com`,
      method: "GET",
      headers: adminHeaders,
      maxMs: 2000,
    },
    {
      component: "rag-service",
      endpoint: (process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io") + "/",
      method: "GET",
      maxMs: 3000,
    },
    {
      component: "pinecone",
      endpoint: "https://api.pinecone.io/indexes",
      method: "GET",
      headers: PINECONE_API_KEY ? { "Api-Key": PINECONE_API_KEY } : {},
      maxMs: 3000,
    },
    {
      component: "supabase",
      endpoint: `${SUPABASE_URL}/rest/v1/tenants?limit=1`,
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      maxMs: 2000,
    },
    {
      component: "hume-evi",
      endpoint: "https://api.hume.ai/v0/evi/configs?page_size=1",
      method: "GET",
      headers: HUME_API_KEY ? { "X-Hume-Api-Key": HUME_API_KEY } : {},
      maxMs: 3000,
    },
    {
      component: "twilio",
      endpoint: TWILIO_ACCOUNT_SID
        ? `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`
        : "https://api.twilio.com/2010-04-01/Accounts/.json",
      method: "GET",
      headers: TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
        ? { Authorization: "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64") }
        : {},
      maxMs: 3000,
    },
  ];
}

/* ── single probe executor ───────────────────────────────────────────── */
interface ProbeResult {
  component: string;
  endpoint: string;
  status: "ok" | "degraded" | "down";
  http_status: number | null;
  latency_ms: number;
  error: string | null;
  remediation: string | null;
}

async function runProbe(def: ProbeDef): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(def.endpoint, {
      method: def.method,
      headers: {
        "Content-Type": "application/json",
        ...(def.headers || {}),
      },
      body: def.body ? JSON.stringify(def.body) : undefined,
      signal: controller.signal,
    });
    const latency = Date.now() - start;
    const httpOk = res.status >= 200 && res.status < 300;
    const is404Ok = def.allow404 && res.status === 404;

    if (!httpOk && !is404Ok) {
      return {
        component: def.component,
        endpoint: def.endpoint,
        status: "down",
        http_status: res.status,
        latency_ms: latency,
        error: `HTTP ${res.status}`,
        remediation: RUNBOOK[def.component]?.remediation || null,
      };
    }
    if (latency > def.maxMs) {
      return {
        component: def.component,
        endpoint: def.endpoint,
        status: "degraded",
        http_status: res.status,
        latency_ms: latency,
        error: `Slow: ${latency}ms > ${def.maxMs}ms threshold`,
        remediation: null,
      };
    }
    return {
      component: def.component,
      endpoint: def.endpoint,
      status: "ok",
      http_status: res.status,
      latency_ms: latency,
      error: null,
      remediation: null,
    };
  } catch (e: any) {
    return {
      component: def.component,
      endpoint: def.endpoint,
      status: "down",
      http_status: null,
      latency_ms: Date.now() - start,
      error: e?.name === "AbortError" ? "Timeout (30s)" : (e?.message || "Unknown error"),
      remediation: RUNBOOK[def.component]?.remediation || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ── Slack alert ─────────────────────────────────────────────────────── */
async function slackAlert(text: string) {
  if (!SLACK_ALERT_WEBHOOK) return;
  try {
    await fetch(SLACK_ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text } },
        ],
      }),
    });
  } catch {
    // best-effort
  }
}

/* ── auth check ──────────────────────────────────────────────────────── */
function isAuthed(req: VercelRequest): boolean {
  const adminKey = (req.headers["x-admin-key"] || "").toString().trim();
  if (ADMIN_API_KEY && adminKey === ADMIN_API_KEY) return true;
  const authHeader = (req.headers["authorization"] || "").toString().trim();
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;
  // Vercel cron invocations from vercel.json are authenticated
  // If no secrets configured, allow (dev mode)
  if (!ADMIN_API_KEY && !CRON_SECRET) return true;
  return false;
}

/* ── handler ─────────────────────────────────────────────────────────── */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!isAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = req.body || {};
    const subset: string[] | undefined = body.components;
    let defs = probeDefinitions();
    if (subset && Array.isArray(subset) && subset.length > 0) {
      const set = new Set(subset);
      defs = defs.filter((d) => set.has(d.component));
    }

    // Run all probes in parallel
    const results = await Promise.all(defs.map(runProbe));

    // Insert probe rows + manage incidents
    let incidentsOpened = 0;
    let incidentsResolved = 0;

    for (const r of results) {
      // Insert qa_probes row
      await sb("qa_probes", {
        method: "POST",
        body: JSON.stringify({
          component: r.component,
          endpoint: r.endpoint,
          status: r.status,
          http_status: r.http_status,
          latency_ms: r.latency_ms,
          error: r.error,
          remediation: r.remediation,
          probed_at: new Date().toISOString(),
        }),
      }).catch((e) => console.error(`[qa/probe] insert qa_probes failed for ${r.component}:`, e.message));

      const rb = RUNBOOK[r.component];

      if (r.status === "down") {
        // Check for existing open incident (idempotent)
        const openIncidents = await sb(
          `status_incidents?component=eq.${encodeURIComponent(r.component)}&resolved_at=is.null&select=id&limit=1`
        ).catch(() => []);

        if (!openIncidents || openIncidents.length === 0) {
          await sb("status_incidents", {
            method: "POST",
            body: JSON.stringify({
              component: r.component,
              severity: rb?.severity || "major",
              remediation: rb?.remediation || r.error,
              detected_at: new Date().toISOString(),
            }),
          }).catch((e) => console.error(`[qa/probe] insert incident failed:`, e.message));
          incidentsOpened++;
          await slackAlert(
            `:rotating_light: *ATOM QA \u2014 ${r.component} DOWN*\nHTTP ${r.http_status || "N/A"} \u2014 ${r.error}\n_Remediation:_ ${rb?.remediation || "Check logs."}`
          );
        }
      }

      if (r.status === "ok") {
        // Resolve any open incident
        const openIncidents = await sb(
          `status_incidents?component=eq.${encodeURIComponent(r.component)}&resolved_at=is.null&select=id`
        ).catch(() => []);

        if (openIncidents && openIncidents.length > 0) {
          for (const inc of openIncidents) {
            await sb(`status_incidents?id=eq.${inc.id}`, {
              method: "PATCH",
              body: JSON.stringify({ resolved_at: new Date().toISOString() }),
            }).catch((e) => console.error(`[qa/probe] resolve incident failed:`, e.message));
          }
          incidentsResolved += openIncidents.length;
          await slackAlert(
            `:white_check_mark: *ATOM QA \u2014 ${r.component} RECOVERED*\nLatency: ${r.latency_ms}ms`
          );
        }
      }
    }

    return res.status(200).json({
      results,
      incidentsOpened,
      incidentsResolved,
      probedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[qa/probe]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
