/**
 * /api/admin/overview — high-level platform snapshot for /admin Overview tab.
 *
 * GET → { kpis, trend (24h hourly), planMix, recentEvents }
 * Auth: x-admin-key required.
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

function hourBucket(d: Date): string {
  return d.toISOString().slice(0, 13).replace("T", " "); // "2026-05-07 04"
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  try {
    const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
    const startISO = startOfDay.toISOString();

    const [tenants, users, dialsToday, predials24, openIncidents] = await Promise.all([
      sb("tenants?deleted_at=is.null&select=plan").catch(() => []),
      sb("tenant_users?deleted_at=is.null&select=id").catch(() => []),
      sb(`tenant_calls?started_at=gte.${startISO}&select=id`).catch(() => []),
      sb(`predial_checks?checked_at=gte.${since24}&select=allowed,checked_at,block_reasons`).catch(() => []),
      sb("status_incidents?resolved_at=is.null&select=id,component,severity,detected_at,remediation").catch(() => []),
    ]);

    // Plan mix
    const planCounts: Record<string, number> = {};
    for (const t of tenants ?? []) planCounts[t.plan || "trial"] = (planCounts[t.plan || "trial"] || 0) + 1;
    const planMix = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

    // Hourly trend (last 24h)
    const trend: Record<string, { dials: number; blocks: number; incidents: number }> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600 * 1000);
      const key = `${d.getUTCHours().toString().padStart(2, "0")}:00`;
      trend[key] = { dials: 0, blocks: 0, incidents: 0 };
    }
    for (const p of predials24 ?? []) {
      const d = new Date(p.checked_at);
      const key = `${d.getUTCHours().toString().padStart(2, "0")}:00`;
      if (!trend[key]) continue;
      if (p.allowed) trend[key].dials++; else trend[key].blocks++;
    }
    const trendArr = Object.entries(trend).map(([hour, v]) => ({ hour, ...v }));

    const blockedCount = (predials24 ?? []).filter((p: any) => !p.allowed).length;

    const recentEvents = (openIncidents ?? []).slice(0, 8).map((i: any) => ({
      ts: i.detected_at,
      severity: i.severity === "critical" ? "danger" : i.severity === "minor" ? "info" : "warn",
      text: `${i.component} · ${i.remediation || "incident open"}`,
    }));

    return res.status(200).json({
      kpis: {
        tenants: (tenants ?? []).length,
        users: (users ?? []).length,
        dialsToday: (dialsToday ?? []).length,
        openIncidents: (openIncidents ?? []).length,
        complianceBlocks24h: blockedCount,
      },
      trend: trendArr,
      planMix,
      recentEvents,
    });
  } catch (e: any) {
    console.error("[admin/overview]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
