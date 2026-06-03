// M3 revert: Edge Runtime caused 504 FUNCTION_INVOCATION_TIMEOUT because
// the OpenAI gpt-4 call routinely runs 15-45s and exceeds Edge's 25-30s
// ceiling. Reverted to Node serverless with maxDuration: 60.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkEntitlement, recordUsage } from "../_rules/entitlements";
import { enforceRateLimit } from "../_lib/rate-limit";

export const config = { maxDuration: 60 } as const;

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

async function resolveSession(req: VercelRequest): Promise<{ userId: string; tenantId: string } | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["atom_session"];
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    const s = Array.isArray(rows) ? rows[0] : null;
    return s ? { userId: s.user_id, tenantId: s.tenant_id } : null;
  } catch { return null; }
}
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

// ─── Apollo enrichment (inlined per Vercel nft requirement) ─────────────────
const APOLLO_KEY = (process.env.APOLLO_API_KEY || "").replace(/\\n/g, "").trim();
async function apolloBrief(opts: { domain?: string; companyName?: string; firstName?: string; lastName?: string }): Promise<string> {
  if (!APOLLO_KEY) return "";
  const cleanedDomain = opts.domain ? opts.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";
  if (!cleanedDomain && !opts.companyName) return "";
  try {
    const tasks: Promise<any>[] = [];
    if (cleanedDomain) {
      tasks.push(fetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanedDomain)}`,
        { headers: { "X-Api-Key": APOLLO_KEY }, signal: AbortSignal.timeout(2500) }).then(r => r.ok ? r.json() : null).catch(() => null));
    } else { tasks.push(Promise.resolve(null)); }
    if (opts.firstName) {
      tasks.push(fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
        body: JSON.stringify({ first_name: opts.firstName, last_name: opts.lastName, domain: cleanedDomain, organization_name: opts.companyName, reveal_personal_emails: false, reveal_phone_number: false }),
        signal: AbortSignal.timeout(2500),
      }).then(r => r.ok ? r.json() : null).catch(() => null));
    } else { tasks.push(Promise.resolve(null)); }
    const [orgData, personData] = await Promise.all(tasks);
    const org = orgData?.organization;
    const person = personData?.person;
    if (!org && !person) return "";
    const lines: string[] = ["", "FRESH APOLLO INTEL:"];
    if (org) {
      if (org.name)                    lines.push(`• ${org.name} — ${org.industry || "?"}`);
      if (org.estimated_num_employees) lines.push(`• ~${org.estimated_num_employees.toLocaleString()} employees`);
      const rev = org.organization_revenue_printed || org.annual_revenue_printed;
      if (rev)                         lines.push(`• Revenue: ${rev}`);
      if (org.short_description)       lines.push(`• ${String(org.short_description).slice(0, 220)}`);
      if (Array.isArray(org.technology_names) && org.technology_names.length)
                                       lines.push(`• Tech: ${org.technology_names.slice(0, 8).join(", ")}`);
      if (Array.isArray(org.funding_events) && org.funding_events[0]) {
        const f = org.funding_events[0];
        const amt = f.amount ? `$${(f.amount / 1_000_000).toFixed(1)}M` : "";
        lines.push(`• Latest round: ${f.type || "funding"} ${amt} ${f.date || ""}`.trim());
      }
    }
    if (person) {
      if (person.title)                lines.push(`• Contact: ${person.name} — ${person.title}`);
      if (person.seniority)            lines.push(`• Seniority: ${person.seniority}`);
      if (person.previous_employment?.[0]?.end_date) {
        const days = Math.round((Date.now() - new Date(person.previous_employment[0].end_date).getTime()) / 86400000);
        if (days < 180) lines.push(`• Recently joined (${days}d) from ${person.previous_employment[0].title} @ ${person.previous_employment[0].organization_name}`);
      }
    }
    return lines.join("\n");
  } catch { return ""; }
}

async function getRAGContext(company: string, module: string): Promise<string> {
  if (!company || company.trim().length < 2) return "";
  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: company.trim(), module }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.context || "";
  } catch { return ""; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // ── Entitlement gate ──
  const session = await resolveSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  if (await enforceRateLimit(req, res, { key: "ai-objection", limit: 30, windowSec: 60 })) return;
  const ent = await checkEntitlement(session.tenantId, "objection");
  if (!ent.allowed) {
    return res.status(402).json({ error: ent.reason, used: ent.used, cap: ent.cap, plan: ent.plan, upgradeUrl: "/#/billing" });
  }

  const {
    productSlug,
    selectedProduct,
    objection,
    objectionText,
    context,
    company,
  } = req.body;

  const productName = selectedProduct || productSlug || "";
  const objText = objection || objectionText || "";
  const target = company || productName || "";

  // Fetch RAG context
  const domainGuess = target && target.includes(".") ? target : "";
  const [targetCtx, productCtx, apolloCtx] = await Promise.all([
    target ? getRAGContext(target, "objections") : Promise.resolve(""),
    productName && productName !== target ? getRAGContext(productName, "objections") : Promise.resolve(""),
    apolloBrief({ domain: domainGuess, companyName: target }),
  ]);

  const ragContext = [
    targetCtx ? `OBJECTION INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT OBJECTION PLAYBOOK FOR "${productName}":\n${productCtx}` : "",
    apolloCtx ? `LIVE FIRMOGRAPHIC SIGNAL:${apolloCtx}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are an elite enterprise sales trainer and deal-closer. Handle sales objections with precision and empathy. You MUST respond with valid JSON only — no markdown, no preamble.

Antimatter AI Products:
- Antimatter AI Platform: Enterprise AI/ML platform for building and deploying custom AI models
- ATOM Enterprise AI: Secure VPC/on-prem/edge AI deployment for regulated industries
- Vidzee: AI-powered real estate video marketing automation
- Clinix Agent: AI billing and revenue cycle management for healthcare
- Clinix AI: AI clinical documentation and scribe assistant for physicians
- Red Team ATOM: Quantum-resistant cryptography and post-quantum security platform`;

  const userPrompt = `Handle this sales objection:

OBJECTION: "${objText}"
${context ? `CONTEXT: ${context}` : ""}
${productName ? `PRODUCT: ${productName}` : ""}

${ragContext ? `INTELLIGENCE TO USE:\n${ragContext}\n` : ""}

Analyze the objection and return ONLY this JSON structure (no markdown):
{
  "primaryResponse": "The main counter-argument response. 3-4 sentences. Acknowledge, reframe with data, prove with specifics, close with question. Make it conversational and specific.",
  "detectedCategory": "price|timing|competition|authority|need|trust",
  "categoryConfidence": 92,
  "sentiment": {
    "hostility": 35,
    "curiosity": 65,
    "buyingSignalStrength": 58,
    "recommendedTone": "Empathetic|Direct|Educational|Reassuring"
  },
  "strategies": [
    {
      "type": "Acknowledge & Redirect",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    },
    {
      "type": "Reframe",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    },
    {
      "type": "Social Proof",
      "headline": "3-5 word headline",
      "response": "Full response text using this strategy. 2-3 sentences."
    }
  ],
  "followUpQuestions": [
    "Follow-up question 1 to keep conversation going?",
    "Follow-up question 2 to uncover more?",
    "Follow-up question 3 to advance the sale?"
  ],
  "urgencyLevel": "low|medium|high",
  "closingProbability": 62,
  "keyInsight": "One sentence insight about the hidden concern behind this objection."
}`;

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        primaryResponse: raw,
        detectedCategory: "general",
        categoryConfidence: 70,
        sentiment: { hostility: 40, curiosity: 60, buyingSignalStrength: 50, recommendedTone: "Empathetic" },
        strategies: [],
        followUpQuestions: [],
        urgencyLevel: "medium",
        closingProbability: 50,
        keyInsight: "Review the objection context for deeper insights.",
      };
    }

    // Record usage (fire-and-forget)
    recordUsage(session.tenantId, "objection");

    // ── Compliance guardrails — block/sanitize unsafe LLM output ──
    const GUARDRAIL_PATTERNS = [
      { id: "no_fake_urgency", r: /\b(today only|last chance|going up|act now|limited time|expires tonight|price increases)\b/i },
      { id: "no_fearmongering", r: /\b(you'll lose|disaster|catastroph|breach is coming|terminally ill)\b/i },
      { id: "no_closing_by_ai", r: /\b(sign here|wire the funds|swipe your card|charging your card now|send payment)\b/i },
      { id: "no_ai_pretending_human", r: /\b(I'm just like you|I'm human|I have feelings|I am a person)\b/i },
      { id: "no_medical_claim", r: /\b(cure[sd]?|treats|prevents disease|FDA[- ]approved|clinically proven to)\b/i },
    ];
    let guardrailFlag: string | null = null;
    const respText = parsed.primaryResponse || raw || "";
    for (const g of GUARDRAIL_PATTERNS) {
      if (g.r.test(respText)) { guardrailFlag = g.id; break; }
    }
    if (guardrailFlag) {
      console.warn(`[objection/handle] guardrail triggered: ${guardrailFlag}`);
      let sanitized = respText;
      for (const g of GUARDRAIL_PATTERNS) { sanitized = sanitized.replace(g.r, "[adjusted for compliance]"); }
      parsed.primaryResponse = sanitized;
      parsed.guardrailApplied = guardrailFlag;
    }

    res.setHeader("X-ATOM-Version", "gold-v2");
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      ...parsed,
      response: parsed.primaryResponse || raw,
      content: parsed.primaryResponse || raw,
      category: parsed.detectedCategory || "general",
      hasRagContext: ragContext.length > 50,
      guardrailApplied: guardrailFlag || undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// v2.0 — Gold Standard rebuild 2026-04-09T12:33:45Z
