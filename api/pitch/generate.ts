// GOLD STANDARD v2.0 — Edge Runtime
//
// M3: Converted from @vercel/node (Node runtime, ~600-1200ms cold start) to
// Edge Runtime (~30-80ms cold start). The handler is pure fetch+JSON; no
// Buffer / fs / crypto usage, so it ports cleanly to the Web standard
// Request/Response API.

export const config = { runtime: "edge" } as const;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    productSlug,
    product,
    pitchType,
    industry,
    persona,
    company,
    tone,
    customContext,
  } = body;

  const productName = product || productSlug || "";
  const target = company || productName || "";

  // Fetch RAG context in parallel
  const domainGuess = target && target.includes(".") ? target : "";
  const [targetCtx, productCtx, apolloCtx] = await Promise.all([
    target ? getRAGContext(target, "pitch") : Promise.resolve(""),
    productName && productName !== target ? getRAGContext(productName, "pitch") : Promise.resolve(""),
    apolloBrief({ domain: domainGuess, companyName: target }),
  ]);

  const ragContext = [
    targetCtx ? `INTELLIGENCE FOR "${target}":\n${targetCtx}` : "",
    productCtx ? `PRODUCT INTELLIGENCE FOR "${productName}":\n${productCtx}` : "",
    apolloCtx ? `LIVE FIRMOGRAPHIC SIGNAL:${apolloCtx}` : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `You are the world's #1 B2B enterprise sales expert. Generate highly compelling, specific sales pitches for Antimatter AI products. You MUST respond with valid JSON only — no markdown, no preamble.

Antimatter AI Products:
- Antimatter AI Platform: Enterprise AI/ML platform for building and deploying custom AI models
- ATOM Enterprise AI: Secure VPC/on-prem/edge AI deployment for regulated industries  
- Vidzee: AI-powered real estate video marketing automation
- Clinix Agent: AI billing and revenue cycle management for healthcare
- Clinix AI: AI clinical documentation and scribe assistant for physicians
- Red Team ATOM: Quantum-resistant cryptography and post-quantum security platform`;

  const userPrompt = `Generate a ${pitchType || "cold call opening"} pitch${company ? ` for ${company}` : ""}${productName ? ` selling ${productName}` : ""}${industry ? ` in the ${industry} industry` : ""}${persona ? ` targeting ${persona}` : ""}${tone ? ` with a ${tone} tone` : ""}.

${customContext ? `ADDITIONAL CONTEXT: ${customContext}\n` : ""}
${ragContext ? `USE THIS INTELLIGENCE TO MAKE THE PITCH HIGHLY SPECIFIC:\n${ragContext}\n` : ""}

Return ONLY this JSON structure (no markdown):
{
  "mainPitch": "The complete pitch text with clear paragraph breaks. Should be compelling and specific. 150-250 words.",
  "powerPhrases": ["phrase1", "phrase2", "phrase3", "phrase4", "phrase5"],
  "alternatives": [
    { "type": "Direct Opener", "text": "30-word punchy opener variation 1" },
    { "type": "Question Hook", "text": "30-word question-based opener variation 2" },
    { "type": "Insight Lead", "text": "30-word insight-based opener variation 3" }
  ],
  "emotions": {
    "confidence": 85,
    "urgency": 70,
    "empathy": 60,
    "authority": 80,
    "enthusiasm": 75
  },
  "confidenceScore": 87,
  "confidenceReasoning": "One sentence explaining the confidence score",
  "detectedObjections": ["likely objection 1", "likely objection 2"],
  "suggestedFollowUp": "Specific follow-up question to ask after delivering this pitch",
  "category": "${pitchType || "cold-call"}",
  "product": "${productName}",
  "persona": "${persona || "Executive"}",
  "tone": "${tone || "Professional"}"
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
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: return raw as mainPitch
      parsed = {
        mainPitch: raw,
        powerPhrases: [],
        alternatives: [],
        emotions: { confidence: 75, urgency: 65, empathy: 60, authority: 70, enthusiasm: 70 },
        confidenceScore: 72,
        confidenceReasoning: "Generated from available context.",
        detectedObjections: [],
        suggestedFollowUp: "",
        category: pitchType || "cold-call",
        product: productName,
        persona: persona || "Executive",
        tone: tone || "Professional",
      };
    }

    // M4: Pitch responses are user-specific (cached by client) — do not
    // edge-cache the response since persona/company/product vary too much
    // for HTTP cache to hit. Client cache handles re-renders.
    return new Response(
      JSON.stringify({
        ...parsed,
        content: parsed.mainPitch || raw,
        hasRagContext: ragContext.length > 50,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-ATOM-Version": "gold-v2-edge",
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// v2.0 — Gold Standard rebuild 2026-04-09T12:33:45Z
// v3 deploy 1776649290
