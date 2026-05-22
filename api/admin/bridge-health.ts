/**
 * GET /api/admin/bridge-health
 *
 * Admin-only endpoint — pings the voice bridge and RAG service and returns
 * latency + status for each. Results are cached for 15 s so the Vibranium GA
 * dashboard doesn't hammer the bridge on every poll.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const BRIDGE_URL = clean(process.env.BRIDGE_URL) || "https://45-79-202-76.sslip.io";
const RAG_URL    = clean(process.env.RAG_URL)    || "https://atom-rag.45-79-202-76.sslip.io";

/* ---------- auth ---------- */

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

async function isSuperAdmin(req: VercelRequest): Promise<boolean> {
  try {
    const token = parseCookies(req.headers.cookie)["atom_session"];
    if (!token) return false;
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${encodeURIComponent(token)}&select=user_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!r.ok) return false;
    const rows: any[] = await r.json();
    const userId = rows?.[0]?.user_id;
    if (!userId) return false;
    const u = await fetch(
      `${SUPABASE_URL}/rest/v1/tenant_users?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!u.ok) return false;
    const users: any[] = await u.json();
    return users?.[0]?.role === "super_admin";
  } catch {
    return false;
  }
}

/* ---------- 15s cache ---------- */

interface HealthResult {
  bridge: ServiceHealth;
  rag: ServiceHealth;
  ts: string;
}
interface ServiceHealth {
  url: string;
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  error?: string;
}

let cachedResult: HealthResult | null = null;
let cachedAt = 0;
const CACHE_TTL = 15_000;

async function pingService(url: string, path: string): Promise<ServiceHealth> {
  const endpoint = url.replace(/\/+$/, "") + path;
  const start = Date.now();
  try {
    const r = await fetch(endpoint, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (r.ok) {
      return { url, status: latencyMs > 3000 ? "degraded" : "ok", latencyMs };
    }
    return { url, status: "degraded", latencyMs, error: `HTTP ${r.status}` };
  } catch (err: any) {
    return { url, status: "down", latencyMs: Date.now() - start, error: err?.message || "timeout" };
  }
}

async function getHealth(): Promise<HealthResult> {
  if (cachedResult && Date.now() - cachedAt < CACHE_TTL) return cachedResult;
  const [bridge, rag] = await Promise.all([
    pingService(BRIDGE_URL, "/health"),
    pingService(RAG_URL, "/"),
  ]);
  cachedResult = { bridge, rag, ts: new Date().toISOString() };
  cachedAt = Date.now();
  return cachedResult;
}

/* ---------- handler ---------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  const admin = await isSuperAdmin(req);
  if (!admin) return res.status(403).json({ error: "forbidden" });

  const health = await getHealth();
  return res.status(200).json(health);
}
