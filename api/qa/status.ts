/**
 * GET /api/qa/status
 *
 * Rolls up the last 24h per component: uptime %, avg latency, last probe,
 * last incident summary. Also returns open incident count and total probes.
 *
 * Auth: x-admin-key OR open (read-only status page data).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

const ALL_COMPONENTS = [
  "api:pitch", "api:objection", "api:market", "api:warbook", "api:prospects",
  "api:atom-chat", "api:atom-leadgen", "api:embeddings", "api:tenant",
  "rag-service", "pinecone", "supabase", "hume-evi", "twilio",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch last 24h probes
    const probes: any[] = await sb(
      `qa_probes?probed_at=gte.${since}&order=probed_at.desc&select=component,status,latency_ms,probed_at,error&limit=5000`
    ).catch(() => []) || [];

    // Fetch open incidents
    const openIncidents: any[] = await sb(
      `status_incidents?resolved_at=is.null&order=detected_at.desc&select=id,component,severity,remediation,detected_at`
    ).catch(() => []) || [];

    // Group probes by component
    const byComponent = new Map<string, any[]>();
    for (const comp of ALL_COMPONENTS) byComponent.set(comp, []);
    for (const p of probes) {
      const arr = byComponent.get(p.component);
      if (arr) arr.push(p);
      else byComponent.set(p.component, [p]);
    }

    // Build per-component rollup
    const components = ALL_COMPONENTS.map((name) => {
      const pList = byComponent.get(name) || [];
      const total = pList.length;
      const okCount = pList.filter((p: any) => p.status === "ok").length;
      const uptime24h = total > 0 ? Math.round((okCount / total) * 10000) / 100 : null;
      const avgLatency = total > 0
        ? Math.round(pList.reduce((a: number, p: any) => a + (p.latency_ms || 0), 0) / total)
        : null;
      const lastProbe = pList[0] || null;
      const lastIncident = openIncidents.find((i: any) => i.component === name) || null;

      return {
        name,
        status: lastProbe?.status || "unknown",
        uptime24h,
        avgLatency,
        lastProbedAt: lastProbe?.probed_at || null,
        lastIncident,
        totalProbes: total,
      };
    });

    // Hourly histogram for charts (last 24h)
    const hourlyBuckets: Record<string, { ok: number; degraded: number; down: number }> = {};
    for (let h = 23; h >= 0; h--) {
      const d = new Date(Date.now() - h * 3600_000);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
      hourlyBuckets[key] = { ok: 0, degraded: 0, down: 0 };
    }
    for (const p of probes) {
      const d = new Date(p.probed_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
      if (hourlyBuckets[key]) {
        const s = p.status as "ok" | "degraded" | "down";
        if (s in hourlyBuckets[key]) hourlyBuckets[key][s]++;
      }
    }
    const hourly = Object.entries(hourlyBuckets).map(([hour, counts]) => ({
      hour: hour.split("T")[1] + ":00",
      ...counts,
    }));

    return res.status(200).json({
      components,
      openIncidents,
      totalProbes24h: probes.length,
      hourly,
    });
  } catch (e: any) {
    console.error("[qa/status]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
