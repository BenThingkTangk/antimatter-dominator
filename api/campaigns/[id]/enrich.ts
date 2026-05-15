// ΔTOM enrich endpoint. Synchronous-within-Vercel-window — batches up to ~20 rows
// per call (Anthropic Haiku finishes each in ~5-8s). For larger sets, the
// frontend should issue repeated /enrich calls in chunks.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !KEY) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const a = new Anthropic();

const ENRICH_PROMPT = `You are a B2B sales-intelligence enrichment agent for Antimatter AI's ATOM platform.
Given an account, produce concise structured JSON.

Account: {{ACCOUNT}}
Domain: {{DOMAIN}}
Sub-vertical: {{SUBV}}

Return ONLY a JSON object with exactly these keys:
{
  "atom_buying_signals": ["short signal 1", "short signal 2", ... up to 4],
  "atom_pain_points": ["pain 1", "pain 2", ... up to 4],
  "atom_recent_news": ["news headline 1", ...up to 3],
  "atom_decision_makers": [{"title":"Chief Information Security Officer","seniority":"C-suite"}, ...up to 4],
  "atom_score": 0-100 integer expressing buying-intent strength
}

Be specific to healthcare cybersecurity, microsegmentation, HIPAA exposure. No prose, no markdown — JSON only.`;

function scoreAtom(enr: any) {
  if (!enr || enr._status === "failed") return { intent: 0, personas: 0, freshness: 0 };
  const signals = enr.atom_buying_signals || [];
  const pain = enr.atom_pain_points || [];
  const dms = enr.atom_decision_makers || [];
  const news = enr.atom_recent_news || [];
  let intent: number;
  if (typeof enr.atom_score === "number" && enr.atom_score > 0) {
    intent = Math.min(12, enr.atom_score * 0.12);
  } else {
    intent = Math.min(12, signals.length * 2 + pain.length);
  }
  const seniorDMs = dms.filter((d: any) => {
    const t = `${d?.title || ""} ${d?.seniority || ""}`.toLowerCase();
    return ["chief", "cio", "ciso", "cto", "vp", "director", "head of"].some((kw) => t.includes(kw));
  });
  const personas = Math.min(10, seniorDMs.length * 2.5);
  const freshness = Math.min(8, news.length * 2);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { intent: r(intent), personas: r(personas), freshness: r(freshness) };
}

function tierOf(score: number): "T1" | "T2" | "T3" | "T4" {
  if (score >= 75) return "T1";
  if (score >= 60) return "T2";
  if (score >= 45) return "T3";
  return "T4";
}

async function enrichOne(account: any) {
  const prompt = ENRICH_PROMPT
    .replace("{{ACCOUNT}}", account.account_name || "")
    .replace("{{DOMAIN}}", account.domain || "")
    .replace("{{SUBV}}", account.sub_vertical || "");
  try {
    const resp = await a.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (resp.content || [])
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    // Extract JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in model response");
    const parsed = JSON.parse(jsonMatch[0]);
    return { ok: true, data: parsed };
  } catch (e: any) {
    return { ok: false, error: e?.message || "enrich error" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = parseInt((req.query.id || "").toString(), 10);
  if (!id || isNaN(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    let accountIds: number[] = Array.isArray(body.accountIds) ? body.accountIds.map((x: any) => parseInt(x, 10)).filter((x: number) => !isNaN(x)) : [];
    const cap = 20;
    if (accountIds.length === 0) {
      // Auto-pick top-N unenriched
      const top = await sb(
        `atom_campaign_accounts?campaign_id=eq.${id}&enrich_status=neq.ok&select=id&order=final_score.desc.nullslast&limit=${cap}`,
      );
      accountIds = (top || []).map((r: any) => r.id);
    } else {
      accountIds = accountIds.slice(0, cap);
    }
    if (accountIds.length === 0) return res.json({ ok: true, enriched: 0, note: "nothing to enrich" });

    // Fetch full rows
    const idsCsv = accountIds.join(",");
    const rows: any[] = await sb(
      `atom_campaign_accounts?id=in.(${idsCsv})&select=id,account_name,domain,sub_vertical,public_subtotal`,
    );

    // Mark in-progress
    await sb(`atom_campaign_accounts?id=in.(${idsCsv})`, {
      method: "PATCH",
      body: JSON.stringify({ enrich_status: "running" }),
      headers: { Prefer: "return=minimal" },
    });

    let okCount = 0;
    // Concurrency: 4 at a time
    const concurrency = 4;
    for (let i = 0; i < rows.length; i += concurrency) {
      const slice = rows.slice(i, i + concurrency);
      await Promise.all(slice.map(async (r) => {
        const result = await enrichOne(r);
        if (result.ok) {
          const enr = result.data;
          const atom = scoreAtom(enr);
          const finalScore = Math.round(((r.public_subtotal || 0) + atom.intent + atom.personas + atom.freshness) * 100) / 100;
          const tier = tierOf(finalScore);
          const whyParts: string[] = [];
          if (enr.atom_buying_signals?.length) whyParts.push(`Signal: ${enr.atom_buying_signals[0]}`);
          if (enr.atom_pain_points?.length) whyParts.push(`Pain: ${enr.atom_pain_points[0]}`);
          if (enr.atom_recent_news?.length) whyParts.push(`News: ${enr.atom_recent_news[0]}`);
          await sb(`atom_campaign_accounts?id=eq.${r.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              atom_buying_signals_json: enr.atom_buying_signals || [],
              atom_pain_points_json: enr.atom_pain_points || [],
              atom_recent_news_json: enr.atom_recent_news || [],
              atom_decision_makers_json: enr.atom_decision_makers || [],
              score_atom_intent: atom.intent,
              score_atom_personas: atom.personas,
              score_atom_freshness: atom.freshness,
              final_score: finalScore,
              tier,
              why_now: whyParts.join(" | "),
              enrich_status: "ok",
              enrich_error: null,
              atom_enriched_at: new Date().toISOString(),
            }),
            headers: { Prefer: "return=minimal" },
          });
          okCount++;
        } else {
          await sb(`atom_campaign_accounts?id=eq.${r.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              enrich_status: "failed",
              enrich_error: result.error,
            }),
            headers: { Prefer: "return=minimal" },
          });
        }
      }));
    }

    // Update campaign counters
    const camp = await sb(`atom_campaigns?id=eq.${id}&select=enriched_accounts`);
    const prev = (camp?.[0]?.enriched_accounts) || 0;
    await sb(`atom_campaigns?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        enriched_accounts: prev + okCount,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });

    return res.json({ ok: true, enriched: okCount, attempted: rows.length });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "enrich failed" });
  }
}
