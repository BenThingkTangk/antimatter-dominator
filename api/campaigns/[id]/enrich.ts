// ΔTOM enrich endpoint v2 — Perplexity Sonar evidence + Pinecone RAG context
// + Anthropic synthesis.
//
// Per-account pipeline:
//   1. Sonar evidence extraction (sonar-pro, response_format json_object) →
//      structured signals matching the rule pack's evidence_schema.
//   2. Pinecone atom-intelligence-pplx RAG → top-5 nearest competitive intel
//      / past plays / benchmarks (1024d pplx embeddings, INT8). OpenAI 1536d
//      fallback is intentionally NOT used here — the index dim is 1024.
//   3. Anthropic Claude Haiku 4.5 synthesizes the prompt+RAG into the final
//      ATOM signal pack (buying signals, pain points, decision makers, atom_score).
//   4. Store evidence + rag context + atom signals + rules_version on the row;
//      recompute final_score using the rule pack's ATOM weights.
//
// Batches up to 20 accounts per call (concurrency 4). For 100s of accounts the
// frontend issues repeated /enrich calls — fits inside the 60s Vercel window.
//
// Self-contained per the project rule: each function inlines its helpers.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

import healthcarePack from "../../_rules/healthcare-segmentation-hipaa.v1.json";
import cloudPack from "../../_rules/cloud-ai-infrastructure.v1.json";

const PACKS: Record<string, any> = {
  "healthcare-segmentation-hipaa": healthcarePack,
  "cloud-ai-infrastructure-v1":    cloudPack,
};

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL       = clean(process.env.SUPABASE_URL);
const SUPABASE_KEY       = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const PERPLEXITY_API_KEY = clean(process.env.PERPLEXITY_API_KEY);
const PINECONE_API_KEY   = clean(process.env.PINECONE_API_KEY);
const PINECONE_INDEX     = clean(process.env.PINECONE_INDEX) || "atom-intelligence-pplx";

const a = new Anthropic();

// ─── Supabase helper ────────────────────────────────────────────────────────
async function sb(path: string, init: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// ─── Perplexity Sonar evidence extraction ──────────────────────────────────
const HEALTHCARE_EVIDENCE_PROMPT = `You are an evidence-extraction agent for the Akamai Guardicore healthcare-segmentation play.
Given a healthcare account, gather public-signal evidence for HIPAA exposure, breach history,
and segmentation pain.

Account: {{ACCOUNT}}
Domain: {{DOMAIN}}
Sub-vertical: {{SUBV}}

Return ONLY a JSON object with these keys (no markdown, no prose):
{
  "phi_exposure_note":      "<1 sentence on PHI volume / regulated workload exposure>",
  "breach_history":         ["<short breach/incident headline 1>", ...up to 3],
  "segmentation_pain":      ["<short EHR/IoT/OT segmentation pain point>", ...up to 3],
  "regulatory_drivers":     ["<HIPAA/HHS/state mandate signal>", ...up to 3],
  "ehr_iot_signals":        ["<EHR vendor / connected device signal>", ...up to 3],
  "sources":                ["<https-url-1>", "<https-url-2>", ...up to 5]
}`;

const CLOUD_EVIDENCE_PROMPT = `You are an evidence-extraction agent for the ΔTOM TARGET cloud/AI-infrastructure play
(Akamai edge + Linode compute + GPU inference + multicloud).

Given an account, score it on six dimensions 1-5 and provide one-line evidence per dimension.

Account: {{ACCOUNT}}
Domain: {{DOMAIN}}
Segment: {{SUBV}}

Return ONLY a JSON object (no markdown, no prose):
{
  "latency_score":         <1-5>,
  "security_score":        <1-5>,
  "gpu_inference_score":   <1-5>,
  "egress_score":          <1-5>,
  "multicloud_score":      <1-5>,
  "trigger_score":         <1-5>,
  "latency_evidence":      "<short evidence>",
  "security_evidence":     "<short evidence>",
  "gpu_inference_evidence":"<short evidence>",
  "egress_evidence":       "<short evidence>",
  "multicloud_evidence":   "<short evidence>",
  "trigger_evidence":      "<short evidence>",
  "sources":               ["<https-url-1>", ...up to 5]
}

Scoring rules:
- latency_score: 5=real-time voice/fraud/AI, 4=global interactive, 3=user-facing API, 2=internal API, 1=batch
- security_score: 5=regulated+public API+fraud risk, 4=two of three, 3=one of three, 2=mild, 1=none
- gpu_inference_score: 5=core inference product, 4=heavy RAG/LLM, 3=regular AI features, 2=light AI, 1=none
- egress_score: 5=media/files/global traffic, 4=heavy API/model responses, 3=moderate, 2=low, 1=internal-only
- multicloud_score: 5=explicit multicloud/sovereignty mandate, 4=K8s+Terraform+portability, 3=multi-region one cloud, 2=single cloud planning multi, 1=single cloud
- trigger_score: 5=active migration/compliance/outage, 4=AI launch/funding <6mo, 3=hiring signal, 2=stagnant, 1=declining`;

async function extractEvidenceSonar(account: any, pack: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  if (!PERPLEXITY_API_KEY) return { ok: false, error: "PERPLEXITY_API_KEY missing" };
  const template = pack.engine === "cloud-ai-infra-v1" ? CLOUD_EVIDENCE_PROMPT : HEALTHCARE_EVIDENCE_PROMPT;
  const prompt = template
    .replace("{{ACCOUNT}}", account.account_name || "")
    .replace("{{DOMAIN}}", account.domain || "")
    .replace("{{SUBV}}", account.sub_vertical || "");
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, error: `sonar ${r.status}: ${txt.slice(0, 200)}` };
    }
    const d: any = await r.json();
    const raw = d?.choices?.[0]?.message?.content || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "no JSON in sonar response" };
    return { ok: true, data: JSON.parse(m[0]) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "sonar fetch failed" };
  }
}

// ─── Perplexity embeddings (1024d INT8, matches atom-intelligence-pplx) ────
function decodePplxEmbedding(raw: any): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string") return [];
  const buf = Buffer.from(raw, "base64");
  const out: number[] = new Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const u = buf[i];
    out[i] = (u < 128 ? u : u - 256) / 127;
  }
  return out;
}

async function embedPplx(text: string): Promise<number[] | null> {
  if (!PERPLEXITY_API_KEY) return null;
  try {
    const r = await fetch("https://api.perplexity.ai/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "pplx-embed-v1-0.6b", input: [text] }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    return decodePplxEmbedding(d?.data?.[0]?.embedding);
  } catch {
    return null;
  }
}

// ─── Pinecone RAG (atom-intelligence-pplx, 1024d) ──────────────────────────
let _indexHostCache: string | null = null;
async function getPineconeHost(): Promise<string | null> {
  if (_indexHostCache) return _indexHostCache;
  if (!PINECONE_API_KEY) return null;
  try {
    const r = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX}`, {
      headers: { "Api-Key": PINECONE_API_KEY },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
    if (d?.host) _indexHostCache = `https://${d.host}`;
    return _indexHostCache;
  } catch {
    return null;
  }
}

async function ragQuery(text: string, topK = 5): Promise<{ matches: any[]; sources: string[] }> {
  const empty = { matches: [], sources: [] };
  const host = await getPineconeHost();
  if (!host) return empty;
  const vec = await embedPplx(text);
  if (!vec || vec.length === 0) return empty;
  try {
    const r = await fetch(`${host}/query`, {
      method: "POST",
      headers: { "Api-Key": PINECONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ vector: vec, topK, includeMetadata: true }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return empty;
    const d: any = await r.json();
    const matches = (d?.matches || []).map((m: any) => ({
      score: m.score,
      text: m.metadata?.text || m.metadata?.snippet || "",
      source: m.metadata?.source || m.metadata?.url || "",
      kind: m.metadata?.kind || m.metadata?.type || "",
    })).filter((m: any) => m.text);
    const sources = matches.map((m: any) => m.source).filter(Boolean);
    const dedup = Array.from(new Set<string>(sources));
    return { matches, sources: dedup };
  } catch {
    return empty;
  }
}

// ─── Anthropic synthesis (ATOM signal pack) ────────────────────────────────
const SYNTH_PROMPT = `You synthesize buyer-intent signals for the Antimatter AI ATOM platform.

Account: {{ACCOUNT}} ({{DOMAIN}}) — segment: {{SUBV}}

Public-signal evidence (Perplexity Sonar):
{{EVIDENCE}}

Past plays / benchmarks / competitive intel (Pinecone RAG, atom-intelligence-pplx, top matches):
{{RAG}}

Return ONLY a JSON object (no markdown, no prose):
{
  "atom_buying_signals":   ["<short signal 1>", ...up to 4],
  "atom_pain_points":      ["<short pain 1>", ...up to 4],
  "atom_recent_news":      ["<short headline 1>", ...up to 3],
  "atom_decision_makers":  [{"title":"<role>","seniority":"<C-suite|VP|Director>"}, ...up to 4],
  "atom_score":            <0-100 integer expressing buying-intent strength>,
  "atom_rationale":        "<one-sentence why-now grounded in the evidence + RAG above>"
}

Be specific to the play. Cite RAG matches when you can. No prose outside JSON.`;

async function synthesizeAtomSignals(account: any, evidence: any, rag: any, _pack: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  const ragBlock = (rag?.matches || []).slice(0, 5).map((m: any, i: number) => `[${i + 1}] (${(m.score || 0).toFixed(3)}) ${m.text}${m.source ? ` — ${m.source}` : ""}`).join("\n") || "(no RAG matches)";
  const evidenceBlock = JSON.stringify(evidence ?? {}, null, 2);
  const prompt = SYNTH_PROMPT
    .replace("{{ACCOUNT}}", account.account_name || "")
    .replace("{{DOMAIN}}", account.domain || "")
    .replace("{{SUBV}}", account.sub_vertical || "")
    .replace("{{EVIDENCE}}", evidenceBlock.slice(0, 4000))
    .replace("{{RAG}}", ragBlock.slice(0, 4000));
  try {
    const resp = await a.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (resp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "No JSON in synthesis response" };
    return { ok: true, data: JSON.parse(m[0]) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "synthesis error" };
  }
}

// ─── Scoring helpers ───────────────────────────────────────────────────────
function r2(n: number) { return Math.round(n * 100) / 100; }
function tierFromPack(score: number, pack: any): "T1" | "T2" | "T3" | "T4" {
  const T = pack.tiers || {};
  if (score >= (T.T1?.min ?? 75)) return "T1";
  if (score >= (T.T2?.min ?? 60)) return "T2";
  if (score >= (T.T3?.min ?? 45)) return "T3";
  return "T4";
}

function scoreAtomSignals(enr: any, pack: any) {
  const W = pack.weights;
  if (!enr) return { intent: 0, personas: 0, freshness: 0 };
  // Only the healthcare engine has explicit atom_intent/personas/freshness weights.
  if (pack.engine !== "healthcare-hipaa-v1") return { intent: 0, personas: 0, freshness: 0 };
  const signals = enr.atom_buying_signals || [];
  const pain = enr.atom_pain_points || [];
  const dms = enr.atom_decision_makers || [];
  const news = enr.atom_recent_news || [];
  const atomScore = typeof enr.atom_score === "number" ? enr.atom_score : 0;

  const intentRaw = atomScore > 0 ? Math.min(W.atom_intent, atomScore * (W.atom_intent / 100)) : Math.min(W.atom_intent, signals.length * 2 + pain.length);
  const seniorDMs = dms.filter((d: any) => {
    const t = `${d?.title || ""} ${d?.seniority || ""}`.toLowerCase();
    return ["chief", "cio", "ciso", "cto", "vp", "director", "head of"].some((kw) => t.includes(kw));
  });
  const personasRaw = Math.min(W.atom_personas, seniorDMs.length * 2.5);
  const freshnessRaw = Math.min(W.atom_freshness, news.length * 2);
  return { intent: r2(intentRaw), personas: r2(personasRaw), freshness: r2(freshnessRaw) };
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
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
    let accountIds: number[] = Array.isArray(body.accountIds)
      ? body.accountIds.map((x: any) => parseInt(x, 10)).filter((x: number) => !isNaN(x))
      : [];
    const cap = 20;

    // Look up campaign + rule pack
    const camps = await sb(`atom_campaigns?id=eq.${id}&select=id,scoring_template_slug&limit=1`);
    const camp = Array.isArray(camps) ? camps[0] : null;
    if (!camp) return res.status(404).json({ error: "campaign not found" });
    const templateSlug = (camp.scoring_template_slug || "healthcare-segmentation-hipaa").toString();
    const pack = PACKS[templateSlug];
    if (!pack) return res.status(400).json({ error: `No rule pack for slug: ${templateSlug}` });

    if (accountIds.length === 0) {
      const top = await sb(
        `atom_campaign_accounts?campaign_id=eq.${id}&enrich_status=neq.ok&select=id&order=final_score.desc.nullslast&limit=${cap}`,
      );
      accountIds = (top || []).map((r: any) => r.id);
    } else {
      accountIds = accountIds.slice(0, cap);
    }
    if (accountIds.length === 0) return res.json({ ok: true, enriched: 0, note: "nothing to enrich" });

    const idsCsv = accountIds.join(",");
    const rows: any[] = await sb(
      `atom_campaign_accounts?id=in.(${idsCsv})&select=id,account_name,domain,sub_vertical,public_subtotal`,
    );

    await sb(`atom_campaign_accounts?id=in.(${idsCsv})`, {
      method: "PATCH",
      body: JSON.stringify({ enrich_status: "running" }),
      headers: { Prefer: "return=minimal" },
    });

    let okCount = 0;
    const concurrency = 3; // 3 concurrent → each account is 3 LLM calls + 1 vector op, ~10s
    for (let i = 0; i < rows.length; i += concurrency) {
      const slice = rows.slice(i, i + concurrency);
      await Promise.all(slice.map(async (r) => {
        // 1. Sonar evidence (parallel with RAG query)
        const ragSeed = `${r.account_name} ${r.sub_vertical || ""} ${pack.name} segmentation cybersecurity buying signals`;
        const [evidenceRes, ragRes] = await Promise.all([
          extractEvidenceSonar(r, pack),
          ragQuery(ragSeed, 5),
        ]);

        // 2. Synthesize ATOM signal pack
        const synth = await synthesizeAtomSignals(r, evidenceRes.ok ? evidenceRes.data : null, ragRes, pack);

        if (!synth.ok) {
          await sb(`atom_campaign_accounts?id=eq.${r.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              enrich_status: "failed",
              enrich_error: `synth: ${synth.error}; evidence: ${evidenceRes.ok ? "ok" : evidenceRes.error}`,
              evidence_json: evidenceRes.ok ? evidenceRes.data : null,
              evidence_source: evidenceRes.ok ? "sonar-pro:v1" : "none",
              rag_context_json: ragRes.matches,
              rag_sources_json: ragRes.sources,
              rules_version: pack.version,
            }),
            headers: { Prefer: "return=minimal" },
          });
          return;
        }

        // 3. Recompute final_score with ATOM weights
        const enr = synth.data;
        const atom = scoreAtomSignals(enr, pack);
        const finalScore = r2((r.public_subtotal || 0) + atom.intent + atom.personas + atom.freshness);
        const tier = tierFromPack(finalScore, pack);
        const whyParts: string[] = [];
        if (enr.atom_rationale) whyParts.push(enr.atom_rationale);
        if (enr.atom_buying_signals?.length) whyParts.push(`Signal: ${enr.atom_buying_signals[0]}`);
        if (enr.atom_pain_points?.length) whyParts.push(`Pain: ${enr.atom_pain_points[0]}`);

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
            why_now: whyParts.filter(Boolean).join(" | ").slice(0, 600),
            evidence_json: evidenceRes.ok ? evidenceRes.data : null,
            evidence_source: evidenceRes.ok ? "sonar-pro:v1" : "none",
            rag_context_json: ragRes.matches,
            rag_sources_json: ragRes.sources,
            rules_version: pack.version,
            enrich_status: "ok",
            enrich_error: null,
            atom_enriched_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" },
        });
        okCount++;
      }));
    }

    const c2 = await sb(`atom_campaigns?id=eq.${id}&select=enriched_accounts`);
    const prev = (c2?.[0]?.enriched_accounts) || 0;
    await sb(`atom_campaigns?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        enriched_accounts: prev + okCount,
        updated_at: new Date().toISOString(),
      }),
      headers: { Prefer: "return=minimal" },
    });

    return res.json({
      ok: true,
      enriched: okCount,
      attempted: rows.length,
      template: templateSlug,
      rule_version: pack.version,
      pipeline: ["sonar-pro:v1", "pinecone:" + PINECONE_INDEX, "claude-haiku-4-5"],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "enrich failed" });
  }
}
