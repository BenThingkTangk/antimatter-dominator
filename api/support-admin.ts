/**
 * ATOM Support — admin/eval data feed. One function, view-multiplexed (mirrors
 * api/admin/data.ts). Auth: X-Admin-Key (ADMIN_API_KEY).
 *
 *   GET /api/support-admin?view=conversations&tenantSlug=&days=
 *   GET /api/support-admin?view=escalations
 *   GET /api/support-admin?view=feedback        (negative + recent)
 *   GET /api/support-admin?view=low-confidence
 *   GET /api/support-admin?view=actions         (action audit log)
 *   GET /api/support-admin?view=knowledge-gaps  (unanswered/no-source questions)
 *   GET /api/support-admin?view=overview        (counts for dashboard cards)
 *   GET /api/support-admin?view=conversation&id= (single thread w/ messages)
 *   POST /api/support-admin?view=eval-run        (run the eval scenarios)
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

function sinceClause(days: number): string {
  const d = new Date(Date.now() - days * 86400000).toISOString();
  return `created_at=gte.${d}`;
}
function tenantClause(slug: string): string {
  return slug ? `&tenant_slug=eq.${encodeURIComponent(slug)}` : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY not configured" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(200).json({ ok: true, configured: false, rows: [], note: "Supabase not configured — no data yet." });
  }

  const view = String(req.query.view || "overview").trim();
  const tenantSlug = String(req.query.tenantSlug || "").trim();
  const days = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 1), 365);
  const tc = tenantClause(tenantSlug);

  try {
    if (req.method === "POST" && view === "eval-run") {
      // Eval harness is invoked from the test page; defer to the scenarios module.
      const { runEvalScenarios } = await import("./_lib/support/evalScenarios");
      const out = await runEvalScenarios();
      return res.status(200).json({ ok: true, ...out });
    }

    switch (view) {
      case "overview": {
        const [convs, escs, negFb, lowConf] = await Promise.all([
          sb(`support_conversations?select=id&${sinceClause(days)}${tc}`).catch(() => []),
          sb(`support_escalations?select=id,status&${sinceClause(days)}${tc}`).catch(() => []),
          sb(`support_feedback?select=id&verdict=eq.not_helpful&${sinceClause(days)}${tc}`).catch(() => []),
          sb(`support_messages?select=id&role=eq.assistant&confidence=lt.0.7&${sinceClause(days)}${tc}`).catch(() => []),
        ]);
        return res.status(200).json({
          ok: true, configured: true,
          cards: {
            conversations: count(convs),
            escalations: count(escs),
            openEscalations: (Array.isArray(escs) ? escs : []).filter((e: any) => e.status === "open").length,
            negativeFeedback: count(negFb),
            lowConfidence: count(lowConf),
          },
        });
      }
      case "conversations":
        return res.status(200).json({ ok: true, rows: await sb(
          `support_conversations?select=*&order=updated_at.desc&limit=100&${sinceClause(days)}${tc}`) });
      case "conversation": {
        const id = String(req.query.id || "");
        if (!id) return res.status(400).json({ error: "id required" });
        const [conv, messages] = await Promise.all([
          sb(`support_conversations?id=eq.${id}&select=*`),
          sb(`support_messages?conversation_id=eq.${id}&select=*&order=created_at.asc`),
        ]);
        return res.status(200).json({ ok: true, conversation: (conv || [])[0] || null, messages: messages || [] });
      }
      case "escalations":
        return res.status(200).json({ ok: true, rows: await sb(
          `support_escalations?select=*&order=created_at.desc&limit=100&${sinceClause(days)}${tc}`) });
      case "feedback":
        return res.status(200).json({ ok: true, rows: await sb(
          `support_feedback?select=*&order=created_at.desc&limit=100&${sinceClause(days)}${tc}`) });
      case "low-confidence":
        return res.status(200).json({ ok: true, rows: await sb(
          `support_messages?select=*&role=eq.assistant&confidence=lt.0.7&order=created_at.desc&limit=100&${sinceClause(days)}${tc}`) });
      case "actions":
        return res.status(200).json({ ok: true, rows: await sb(
          `support_action_log?select=*&order=created_at.desc&limit=100&${sinceClause(days)}${tc}`) });
      case "knowledge-gaps": {
        // Questions that produced no-source / low-confidence answers — the docs to write.
        const rows = await sb(
          `support_messages?select=content,confidence,failure_category,created_at,conversation_id&role=eq.assistant&or=(failure_category.eq.no_source,confidence.lt.0.5)&order=created_at.desc&limit=100${tc}`,
        ).catch(() => []);
        return res.status(200).json({ ok: true, rows: rows || [] });
      }
      default:
        return res.status(400).json({ error: `unknown view: ${view}` });
    }
  } catch (e: any) {
    console.error("[support-admin]", view, e?.message);
    return res.status(500).json({ error: e?.message || "support_admin_error" });
  }
}

function count(rows: any): number {
  return Array.isArray(rows) ? rows.length : 0;
}
