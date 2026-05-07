/**
 * /api/vibranium/competitive — live competitive intelligence matrix.
 *
 * Pulls a live snapshot of ATOM's voice-AI sales-agent competitors from
 * Perplexity Sonar Pro with domain filtering toward CB Insights, PitchBook,
 * Statista, G2, Crunchbase, TechCrunch. Returns a structured JSON matrix
 * the Vibranium GA console + the standalone atom-voice-stack-v2 site
 * both consume.
 *
 * Cached in-memory for 6 hours per process to keep Sonar costs sane.
 *
 * Auth: x-admin-key required.
 *
 * GET /api/vibranium/competitive
 *   → { competitors: [...], features: [...], updatedAt, sources: [...] }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);
const PPLX_API_KEY  = clean(process.env.PERPLEXITY_API_KEY);

// ──────────────────────────────────────────────────────────────────────────
// In-memory cache (6h)
// ──────────────────────────────────────────────────────────────────────────
let cache: { value: any; expiresAt: number } | null = null;
const CACHE_TTL_MS = 6 * 3600 * 1000;

// ──────────────────────────────────────────────────────────────────────────
// Static fallback — used if Sonar fails / no key set. Hand-curated from
// competitor public docs as of May 2026. Always returned on error so the
// GA console + voice-stack-v2 site never display an empty matrix.
// ──────────────────────────────────────────────────────────────────────────
// Curated from /docs/COMPETITIVE_MATRIX.md — verified May 2026 with primary
// sources (TechCrunch, Yahoo Finance, Crunchbase, vendor pricing pages,
// FTC enforcement filings). Numbers update on Sonar refresh; this is the
// floor so the UI never renders empty even when Sonar is rate-limited.
const FALLBACK_COMPETITORS = [
  {
    name: "11x.ai (Alice/Mike)",
    url: "https://11x.ai",
    arr_estimate_usd: 3_000_000,                  // TechCrunch Mar 2025 investigation: real retained ARR ~$3M, not claimed $10M
    funding_total_usd: 74_000_000,                // Series B led by a16z at $350M valuation
    last_round: "Series B · Sep 2024 · a16z ($50M @ $350M valuation)",
    pricing: { starter: 5000, growth: 10000, enterprise: 15000 },
    pricing_unit: "/mo (annual contract)",
    voice_realism: 6,
    multichannel: 9,
    deception_analytics: 0,
    enterprise_compliance: 6,
    notes: "Highest-funded; 'AI SDR' branding; voice + email + LinkedIn. TechCrunch exposed inflated customer + ARR claims; 79% retention implies ~21% annual churn.",
  },
  {
    name: "Bland AI",
    url: "https://bland.ai",
    arr_estimate_usd: 10_000_000,                 // Estimated $5–15M; not publicly disclosed
    funding_total_usd: 65_000_000,                // $40M Series B + $16M Series A + ~$9M earlier rounds
    last_round: "Series B · 2024 · Emergence Capital ($40M)",
    pricing: { starter: 0.14, growth: 0.11, enterprise: 0.09 },
    pricing_unit: "/min",
    voice_realism: 8,
    multichannel: 4,
    deception_analytics: 0,
    enterprise_compliance: 6,
    notes: "Phone-first developer infra. Free tier $0.14/min, enterprise $0.11/min + $499/mo. Pure infra — no CRM, no orchestration, no compliance ledger.",
  },
  {
    name: "Synthflow AI",
    url: "https://synthflow.ai",
    arr_estimate_usd: 5_000_000,                  // Estimated $3–8M; not publicly disclosed
    funding_total_usd: 27_400_000,                // $20M Series A (Accel) + ~$7.4M earlier
    last_round: "Series A · 2024 · Accel ($20M)",
    pricing: { starter: 29, growth: 99, enterprise: 999 },
    pricing_unit: "/mo + ~$0.13/min",
    voice_realism: 7,
    multichannel: 5,
    deception_analytics: 0,
    enterprise_compliance: 5,
    notes: "No-code voice agent builder. Strong SMB traction (G2 reviews positive), weaker enterprise + compliance story.",
  },
  {
    name: "Retell AI",
    url: "https://retellai.com",
    arr_estimate_usd: 50_000_000,                 // GlobeNewswire Apr 2026 — fastest voice-agent ramp on record
    funding_total_usd: 4_600_000,                 // YC seed; remarkable capital efficiency
    last_round: "Seed · 2024 · Y Combinator ($4.6M)",
    pricing: { starter: 0.16, growth: 0.11, enterprise: 0.05 },
    pricing_unit: "/min (PAYG → contract)",
    voice_realism: 8,
    multichannel: 3,
    deception_analytics: 0,
    enterprise_compliance: 7,
    notes: "$50M ARR on $4.6M raised — 11× capital efficiency vs Bland. 3,000+ business customers, 50M calls/mo. Developer-first WebSocket API; no built-in multichannel.",
  },
  {
    name: "Vapi",
    url: "https://vapi.ai",
    arr_estimate_usd: 7_000_000,                  // Extruct/Prospeo estimates: ~$4.5–10M
    funding_total_usd: 20_000_000,                // Series A led by Bessemer
    last_round: "Series A · 2024 · Bessemer ($20M)",
    pricing: { starter: 0.30, growth: 0.30, enterprise: 0.05 },
    pricing_unit: "/min (true all-in $0.30–$0.33)",
    voice_realism: 8,
    multichannel: 4,
    deception_analytics: 0,
    enterprise_compliance: 7,
    notes: "Voice infra layer used by hundreds of startups. Enterprise contracts $40K–$70K/yr. SMS recently shipped — still not full multichannel.",
  },
  {
    name: "Air AI",
    url: "https://air.ai",
    arr_estimate_usd: null,                       // Not disclosed; FTC enforcement context
    funding_total_usd: null,                      // Bootstrapped
    last_round: "Bootstrapped · FTC ban Mar 2026 ($18M judgment, $50K mandatory)",
    pricing: { starter: 25000, growth: 50000, enterprise: 100000 },
    pricing_unit: "license + ~$0.11/min",
    voice_realism: 7,
    multichannel: 3,
    deception_analytics: 0,
    enterprise_compliance: 2,
    notes: "FTC banned Mar 2026 for false earnings claims + TSR violations. BBB complaints volume high. Existential risk for the brand.",
  },
];

const FALLBACK_FEATURES = [
  { feature: "Pickup-aware opener (timed to 'hello?')",       atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Sub-200ms barge-in / interruption stop",        atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": true,  "Synthflow AI": false, "Retell AI": true,  "Vapi": true,  "AirAI": false } },
  { feature: "Empathic prosody (Hume EVI)",                   atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Aletheia deception analytics in-call",          atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Background-noise recovery ('sorry, what was that?')", atom: true, competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Voice + Text + Email + LinkedIn (single agent)", atom: true, competitors: { "11x.ai (Alice/Mike)": true, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Pre-call WarBook + Market Intent + Pitch fusion", atom: true, competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Auto-send personalized one-pager + comp matrix", atom: true, competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "TCPA hash-chain audit ledger",                  atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Akamai Blackwell edge GPU inference",            atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
  { feature: "Calendar-aware meeting invite send",             atom: true,  competitors: { "11x.ai (Alice/Mike)": true, "Bland AI": false, "Synthflow AI": true,  "Retell AI": false, "Vapi": false, "AirAI": true  } },
  { feature: "Cross-tenant overlord console (Nirmata HQ)",     atom: true,  competitors: { "11x.ai (Alice/Mike)": false, "Bland AI": false, "Synthflow AI": false, "Retell AI": false, "Vapi": false, "AirAI": false } },
];

const FALLBACK_SOURCES = [
  { name: "Crunchbase / 11x.ai funding rounds",      url: "https://www.crunchbase.com/organization/11x-ai" },
  { name: "Bland AI Series B coverage (TechCrunch)", url: "https://techcrunch.com" },
  { name: "Synthflow AI pricing page",                url: "https://synthflow.ai/pricing" },
  { name: "Retell AI pricing page",                   url: "https://retellai.com/pricing" },
  { name: "Vapi pricing + funding announcements",     url: "https://vapi.ai" },
  { name: "G2 voice-AI category review aggregates",   url: "https://www.g2.com/categories/conversational-intelligence" },
];

async function fetchSonarMatrix() {
  if (!PPLX_API_KEY) return null;
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PPLX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{
        role: "system",
        content: "You are a precise venture analyst. Output ONLY a JSON object — no prose, no markdown fences. Cite Crunchbase, PitchBook, CB Insights, Statista, TechCrunch where possible. Use null when unknown — never fabricate revenue or funding figures.",
      }, {
        role: "user",
        content: `Return a JSON object with this exact shape covering ATOM Sales Dominator's six top competitors in AI outbound voice sales agents (11x.ai, Bland AI, Synthflow AI, Retell AI, Vapi, AirAI):
{
  "competitors": [
    {
      "name": "11x.ai (Alice/Mike)", "url": "...",
      "arr_estimate_usd": 50000000,
      "funding_total_usd": 74000000,
      "last_round": "Series B · Nov 2024 · Andreessen Horowitz",
      "pricing": {"starter": null, "growth": 1500, "enterprise": "custom"},
      "pricing_unit": "/agent/mo",
      "voice_realism": 6, "multichannel": 9, "deception_analytics": 0, "enterprise_compliance": 7,
      "notes": "1-2 sentence summary"
    }
  ],
  "sources": [{"name":"Crunchbase","url":"https://crunchbase.com/..."}]
}
Score 0–10 for voice_realism, multichannel, deception_analytics, enterprise_compliance.`,
      }],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: "json_schema", json_schema: { schema: { type: "object" } } },
      web_search_options: { search_context_size: "high" },
      search_domain_filter: ["crunchbase.com", "techcrunch.com", "pitchbook.com", "cbinsights.com", "statista.com", "g2.com", "11x.ai", "bland.ai", "synthflow.ai", "retellai.com", "vapi.ai", "air.ai"],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Sonar ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.competitors) && parsed.competitors.length > 0) return parsed;
  } catch {}
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  const force = req.query.force === "1";
  if (!force && cache && cache.expiresAt > Date.now()) return res.json(cache.value);

  let payload: any = null;
  try {
    payload = await fetchSonarMatrix();
  } catch (e) {
    console.warn("[vibranium/competitive] Sonar failed:", (e as Error).message);
  }

  // Always wrap with the curated feature comparison + fallback-fill any
  // missing competitor fields. Sonar is for the live ARR / funding / pricing.
  const competitors = (payload?.competitors?.length ? payload.competitors : FALLBACK_COMPETITORS).map((c: any) => {
    const fb = FALLBACK_COMPETITORS.find((f) => f.name === c.name) || {};
    return {
      ...fb,
      ...c,
      voice_realism:        c.voice_realism        ?? (fb as any).voice_realism        ?? 0,
      multichannel:         c.multichannel         ?? (fb as any).multichannel         ?? 0,
      deception_analytics:  c.deception_analytics  ?? (fb as any).deception_analytics  ?? 0,
      enterprise_compliance:c.enterprise_compliance?? (fb as any).enterprise_compliance?? 0,
    };
  });

  const value = {
    competitors,
    features: FALLBACK_FEATURES,
    sources:  payload?.sources?.length ? payload.sources : FALLBACK_SOURCES,
    updatedAt: new Date().toISOString(),
    source: payload ? "sonar-pro+curated" : "curated-fallback",
  };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return res.json(value);
}
