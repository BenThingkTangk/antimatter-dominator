/**
 * /api/qa/incidents
 *
 * GET  ?open=true  — list open incidents (or all if open not set).
 * POST { id, action: "resolve", postMortem? } — mark incident resolved.
 *
 * Auth: x-admin-key required for POST. GET is open (status page data).
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
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    /* ── GET: list incidents ─────────────────────────────────────────── */
    if (req.method === "GET") {
      const onlyOpen = req.query.open === "true";
      let path = "status_incidents?order=detected_at.desc&select=id,component,severity,remediation,detected_at,resolved_at,post_mortem&limit=200";
      if (onlyOpen) path += "&resolved_at=is.null";
      const incidents = await sb(path);
      return res.status(200).json({ incidents: incidents || [] });
    }

    /* ── POST: resolve incident ──────────────────────────────────────── */
    if (req.method === "POST") {
      const provided = (req.headers["x-admin-key"] || "").toString().trim();
      if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
      if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

      const body = req.body || {};
      const id = String(body.id || "").trim();
      const action = String(body.action || "").trim();

      if (!id) return res.status(400).json({ error: "id required" });
      if (action !== "resolve") return res.status(400).json({ error: "action must be 'resolve'" });

      const patch: any = { resolved_at: new Date().toISOString() };
      if (body.postMortem) patch.post_mortem = String(body.postMortem);

      const updated = await sb(`status_incidents?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      return res.status(200).json({ incident: updated?.[0] || null });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[qa/incidents]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
