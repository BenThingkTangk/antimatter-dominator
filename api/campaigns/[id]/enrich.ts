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

// ── INLINED RULE PACKS (mirror /api/_rules/*.v1.json) ──────────────────────
// Vercel nft tracing does not reliably bundle sibling JSON imports, so the
// canonical pack data is duplicated here. Keep in sync with score-public.ts
// and /api/_rules/*.json.
const healthcarePack = {
  slug: "healthcare-segmentation-hipaa",
  version: "v1.0.0",
  engine: "healthcare-hipaa-v1",
  weights: {
    regulatory: 25, breach: 20, account_fit: 15, list_density: 5, segmentation: 5,
    atom_intent: 12, atom_personas: 10, atom_freshness: 8,
  },
  sub_vertical_profile: {
    "Healthcare Provider":           { phi: 1.0,  seg: 1.0,  note: "Largest PHI volume + EHR/IoT segmentation pain; mandated by 2025 HIPAA rule" },
    "Healthcare Payer":              { phi: 0.95, seg: 0.9,  note: "Massive PHI; claims systems; high regulatory scrutiny" },
    "Pharma and Biotech":            { phi: 0.55, seg: 0.85, note: "Clinical-trial data + IP; OT/lab segmentation" },
    "Medical Devices and Equipment": { phi: 0.45, seg: 0.95, note: "Connected devices = lateral-movement crown jewels" },
    "Health Tech":                   { phi: 0.7,  seg: 0.8,  note: "PHI handling varies; HIPAA BAA exposure" },
  } as Record<string, { phi: number; seg: number; note: string }>,
  revenue_factors: [
    { min: 50_000_000_000, factor: 1.0 },
    { min: 10_000_000_000, factor: 0.92 },
    { min: 2_000_000_000,  factor: 0.78 },
    { min: 500_000_000,    factor: 0.62 },
    { min: 100_000_000,    factor: 0.45 },
    { min: 0,              factor: 0.25 },
  ],
  akafit_multipliers: { A: 1.0, B: 0.65, C: 0.3 } as Record<string, number>,
  wallet_multipliers: { "Mega Strategic": 1.0, "Strategic": 0.85, "Large Enterprise": 0.65 } as Record<string, number>,
  high_value_lists: {
    "2026 NC Must Win TAL": 1.0, "North America ESG 2026 TAL Prospects": 0.9, "2026 Bain Money Map": 0.85,
    "2026-H1 SDR Security Focus - Core": 1.0, "North America API 2026 TAL Prospects": 0.7,
    "API Sec NC Noname Tier 1.2 TAL": 0.6, "2023 Unified Threat Shield": 0.5, "ESG Focus 30": 0.95,
    "2025 NC Must Win TAL": 0.6, "2024 NC Must Win TAL": 0.4,
  } as Record<string, number>,
  tiers: {
    T1: { min: 75, action: "executive_play — direct CISO outreach + Akamai Guardicore segmentation pitch" },
    T2: { min: 60, action: "automated_sequence — ATOM Voice Bridge + nurture" },
    T3: { min: 45, action: "nurture — content drip, watch for breach/regulatory triggers" },
    T4: { min: 0,  action: "hold — not a fit today" },
  } as Record<string, { min: number; action: string }>,
};

const cloudPack = {
  slug: "cloud-ai-infrastructure-v1",
  version: "v1.0.0",
  engine: "cloud-ai-infra-v1",
  weights: {
    latency: 4, security: 4, gpu_inference: 4, egress: 3, multicloud: 3, trigger: 2,
  } as Record<string, number>,
  sub_vertical_profile: {
    ai_saas:         { latency: 4, security: 4, gpu_inference: 5, egress: 3, multicloud: 3, trigger: 3, note: "Core inference product, heavy GPU + RAG/LLM dependency" },
    fintech_fraud:   { latency: 5, security: 5, gpu_inference: 3, egress: 2, multicloud: 3, trigger: 3, note: "Real-time fraud detection, regulated, latency-critical" },
    voice_ai:        { latency: 5, security: 4, gpu_inference: 5, egress: 3, multicloud: 3, trigger: 4, note: "Real-time voice + GPU inference, edge-native" },
    healthcare_ai:   { latency: 4, security: 5, gpu_inference: 4, egress: 2, multicloud: 4, trigger: 3, note: "PHI + HIPAA + sovereignty mandate" },
    sports_media:    { latency: 4, security: 3, gpu_inference: 3, egress: 5, multicloud: 3, trigger: 3, note: "Heavy media/files/global traffic, latency-sensitive playback" },
    enterprise_saas: { latency: 3, security: 4, gpu_inference: 3, egress: 3, multicloud: 3, trigger: 2, note: "General enterprise workloads, moderate everything" },
    gov_defense:     { latency: 3, security: 5, gpu_inference: 3, egress: 2, multicloud: 5, trigger: 3, note: "Sovereignty mandate, regulated, multicloud-required" },
  } as Record<string, { latency: number; security: number; gpu_inference: number; egress: number; multicloud: number; trigger: number; note: string }>,
  tiers: {
    T1: { min: 80, action: "executive_play — direct CISO/CTO outreach + Akamai+Linode joint pitch" },
    T2: { min: 65, action: "automated_sequence — ATOM Voice Bridge + nurture" },
    T3: { min: 50, action: "nurture — content drip, watch for trigger events" },
    T4: { min: 0,  action: "hold — not a fit today" },
  } as Record<string, { min: number; action: string }>,
};

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
const ANTHROPIC_API_KEY  = clean(process.env.ANTHROPIC_API_KEY);
const OPENAI_API_KEY     = clean(process.env.OPENAI_API_KEY);

// Anthropic instance only constructed if key is present. Otherwise we fall
// back to OpenAI for synthesis below.
const a = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

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
        messages: [
          { role: "system", content: "Respond ONLY with a single valid JSON object. No prose, no markdown, no code fences." },
          { role: "user", content: prompt },
        ],
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
  // Prefer Anthropic Claude Haiku 4.5, fall back to OpenAI gpt-4o-mini if
  // ANTHROPIC_API_KEY is not configured in this environment.
  try {
    if (a) {
      const resp = await a.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (resp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "No JSON in synthesis response (anthropic)" };
      return { ok: true, data: JSON.parse(m[0]) };
    }
    if (OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Respond ONLY with a single valid JSON object. No prose, no markdown." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 900,
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        return { ok: false, error: `openai ${r.status}: ${txt.slice(0, 200)}` };
      }
      const d: any = await r.json();
      const text = d?.choices?.[0]?.message?.content || "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "No JSON in synthesis response (openai)" };
      return { ok: true, data: JSON.parse(m[0]) };
    }
    return { ok: false, error: "No synthesis model configured (ANTHROPIC_API_KEY or OPENAI_API_KEY required)" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "synthesis error" };
  }
}

// ─── Scoring helpers ───────────────────────────────────────────────────────
function r2(n: number) { return Math.round(n * 100) / 100; }

// Inlined from score-public.ts (Vercel nft cannot bundle sibling .ts imports).
// Mirrors scoreHealthcare() exactly — keep in sync if score-public.ts changes.
function revFactorLocal(rev: number | null | undefined, table: any[]): number {
  if (typeof rev !== "number" || rev <= 0) return (table.find((t: any) => t.min === 0)?.factor) ?? 0.25;
  for (const t of table) {
    if (rev >= t.min) return t.factor;
  }
  return 0.25;
}

function computeHealthcarePublic(r: any, pack: any) {
  const W = pack.weights || {};
  const SUBV = pack.sub_vertical_profile || {};
  const LISTS = pack.high_value_lists || {};
  const AKAFIT = pack.akafit_multipliers || {};
  const WALLET = pack.wallet_multipliers || {};
  const REVTBL = pack.revenue_factors || [];

  const sub = r.sub_vertical || "";
  const profile = SUBV[sub] || { phi: 0.3, seg: 0.3, note: "Unknown sub-vertical" };
  const rev = typeof r.revenue === "number" ? r.revenue : null;
  const rFac = revFactorLocal(rev, REVTBL);
  const wFac = WALLET[r.wallet_grade || ""] ?? 0.4;
  const aFac = AKAFIT[(r.akafit || "").toUpperCase()] ?? 0.3;

  const extra = r.extra_tags_json || {};
  const tlRaw = (extra.target_lists || "").toString();
  const tokens = tlRaw.split(";").map((t: string) => t.trim()).filter(Boolean);
  let listScore = 0;
  const matched: string[] = [];
  for (const t of tokens) {
    if (LISTS[t] !== undefined) { listScore = Math.max(listScore, LISTS[t]); matched.push(t); }
  }
  const density = Math.min(1.0, tokens.length / 8.0);
  const combined = 0.65 * listScore + 0.35 * density;

  const sReg = (W.regulatory || 0) * (0.6 * profile.phi + 0.4 * rFac);
  const sFit = (W.account_fit || 0) * (0.5 * aFac + 0.5 * wFac);
  const sDen = (W.list_density || 0) * combined;
  const sSeg = (W.segmentation || 0) * profile.seg;
  const publicSub = r2(sReg + sFit + sDen + sSeg);

  const whyNow: string[] = [];
  if (matched.length) whyNow.push(`Lists: ${matched.slice(0, 2).join(", ")}`);
  whyNow.push(`Profile: ${profile.note}`);
  if (rev && rev >= 10_000_000_000) whyNow.push("Mega-revenue: strategic priority");

  return {
    score_regulatory: r2(sReg),
    score_account_fit: r2(sFit),
    score_list_density: r2(sDen),
    score_segmentation: r2(sSeg),
    public_subtotal: publicSub,
    public_why_now: whyNow.join(" | "),
  };
}

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
    // Vercel maxDuration is 60s. Each account = Sonar (~6s) + RAG (~1s) + synth (~3s) ≈ 10s.
    // At concurrency 3 that's ~10s per row of 3 → 6 accounts = 2 rows = ~20s. Safe margin.
    // User can click Enrich again to process the next batch.
    const cap = 6;

    // Look up campaign + rule pack
    const camps = await sb(`atom_campaigns?id=eq.${id}&select=id,scoring_template_slug,product_label&limit=1`);
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
      `atom_campaign_accounts?id=in.(${idsCsv})&select=id,account_name,domain,sub_vertical,revenue,akafit,wallet_grade,extra_tags_json,public_subtotal`,
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

        // Backfill deterministic public_subtotal if score-public was never run on this row.
        // Healthcare engine only — Cloud/AI engine uses different scoring (score-public is the entry point there).
        const needsPublicBackfill = pack.engine === "healthcare-hipaa-v1"
          && (r.public_subtotal == null || r.public_subtotal === 0);
        const pubComputed = needsPublicBackfill ? computeHealthcarePublic(r, pack) : null;
        const publicSubtotal = pubComputed ? pubComputed.public_subtotal : (r.public_subtotal || 0);

        // Capture breach evidence from Sonar response so the scorer can use it.
        // Direct breach = the account's own incident history.
        // Peer breach = breaches in the same sub-vertical / segment (we currently
        // surface peer pressure from the same payload; future enhancement: separate Sonar query).
        const evData = evidenceRes.ok ? evidenceRes.data : null;
        const directBreachList: string[] = Array.isArray(evData?.breach_history)
          ? evData.breach_history.filter((s: any) => typeof s === "string" && s.trim())
          : [];
        const directBreachJson = directBreachList.length > 0 ? directBreachList : null;

        // Score breach in line with score-public.ts breachFactor()
        // direct present -> 0.95, peer only -> 0.60, none -> 0.20
        const breachW = (pack.weights && (pack.weights as any).breach) || 20;
        const breachFac = directBreachList.length > 0 ? 0.95 : 0.20;
        const scoreBreachVal = r2(breachW * breachFac);

        const finalScore = r2(publicSubtotal + scoreBreachVal + atom.intent + atom.personas + atom.freshness);
        const tier = tierFromPack(finalScore, pack);
        const tierMeta = (pack.tiers as any)?.[tier] || {};
        const recommendedMove = tierMeta.action || null;

        const whyParts: string[] = [];
        if (pubComputed?.public_why_now) whyParts.push(pubComputed.public_why_now);
        if (directBreachList.length > 0) whyParts.push(`Breach history: ${directBreachList[0]}`);
        if (enr.atom_rationale) whyParts.push(enr.atom_rationale);
        if (enr.atom_buying_signals?.length) whyParts.push(`Signal: ${enr.atom_buying_signals[0]}`);
        if (enr.atom_pain_points?.length) whyParts.push(`Pain: ${enr.atom_pain_points[0]}`);

        const patchBody: any = {
            atom_buying_signals_json: enr.atom_buying_signals || [],
            atom_pain_points_json: enr.atom_pain_points || [],
            atom_recent_news_json: enr.atom_recent_news || [],
            atom_decision_makers_json: enr.atom_decision_makers || [],
            score_atom_intent: atom.intent,
            score_atom_personas: atom.personas,
            score_atom_freshness: atom.freshness,
            score_breach: scoreBreachVal,
            direct_breach_json: directBreachJson,
            final_score: finalScore,
            tier,
            recommended_move: recommendedMove,
            why_now: whyParts.filter(Boolean).join(" | ").slice(0, 600),
            evidence_json: evData,
            evidence_source: evidenceRes.ok ? "sonar-pro:v1" : "none",
            rag_context_json: ragRes.matches,
            rag_sources_json: ragRes.sources,
            rules_version: pack.version,
            enrich_status: "ok",
            enrich_error: null,
            atom_enriched_at: new Date().toISOString(),
        };

        if (pubComputed) {
          patchBody.score_regulatory = pubComputed.score_regulatory;
          patchBody.score_account_fit = pubComputed.score_account_fit;
          patchBody.score_list_density = pubComputed.score_list_density;
          patchBody.score_segmentation = pubComputed.score_segmentation;
          patchBody.public_subtotal = r2(pubComputed.public_subtotal + scoreBreachVal);
        }

        await sb(`atom_campaign_accounts?id=eq.${r.id}`, {
          method: "PATCH",
          body: JSON.stringify(patchBody),
          headers: { Prefer: "return=minimal" },
        });
        okCount++;

        // Fire-and-forget: pre-render cold-open audio via ElevenLabs
        const contactName = Array.isArray(enr.atom_decision_makers) && enr.atom_decision_makers.length > 0
          ? (typeof enr.atom_decision_makers[0] === "string" ? enr.atom_decision_makers[0] : enr.atom_decision_makers[0]?.name || "")
          : "";
        if (contactName) {
          const proto = (req.headers["x-forwarded-proto"] as string) || "https";
          const host  = (req.headers["x-forwarded-host"] as string) || (req.headers.host as string) || "atom-dominator-pro.vercel.app";
          fetch(`${proto}://${host}/api/atom-leadgen/pre-render-opener`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId: r.id,
              campaignId: id,
              contactName,
              companyName: r.account_name || "",
              productLabel: camp.product_label || "AntimatterAI",
            }),
          }).catch(() => {}); // fire-and-forget
        }
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
      pipeline: ["sonar-pro:v1", "pinecone:" + PINECONE_INDEX, a ? "claude-haiku-4-5" : "gpt-4o-mini"],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "enrich failed" });
  }
}
