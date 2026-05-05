/**
 * ATOM WarBook — Deep Company Research via Perplexity Sonar + Apollo + PDL
 * Enhanced: richer Sonar queries, Apollo people/match reveal, expanded synthesis schema
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const PDL_API_KEY = process.env.PDL_API_KEY;

async function sonarResearch(query: string, ctx: "low" | "medium" | "high" = "medium") {
  if (!PERPLEXITY_API_KEY) return { content: "", citations: [] as string[] };
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: query }],
        stream: false,
        web_search_options: { search_context_size: ctx },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error(`Sonar ${res.status}`); return { content: "", citations: [] as string[] }; }
    const d = await res.json();
    return { content: d.choices?.[0]?.message?.content || "", citations: (d.citations || []) as string[] };
  } catch (e: any) { console.error(`Sonar: ${e.message}`); return { content: "", citations: [] as string[] }; }
}

// ─── Sonar Deep Research (Sonar Agent) ─────────────────────────────────────────
// Multi-step agentic search. The model issues sub-queries autonomously and
// reasons across them. We use this for Deep Mode briefs only — latency is
// 30-60s but the depth is dramatically better than chained Sonar Pro calls.
async function sonarDeepResearch(query: string) {
  if (!PERPLEXITY_API_KEY) return { content: "", citations: [] as string[] };
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-deep-research",
        messages: [{ role: "user", content: query }],
        stream: false,
        web_search_options: { search_context_size: "high" },
        return_related_questions: true,
      }),
      signal: AbortSignal.timeout(75000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error(`Sonar Deep ${res.status}: ${err.slice(0, 200)}`);
      return { content: "", citations: [] as string[] };
    }
    const d = await res.json();
    return {
      content: d.choices?.[0]?.message?.content || "",
      citations: (d.citations || []) as string[],
      relatedQuestions: d.related_questions || [],
    };
  } catch (e: any) {
    console.error(`Sonar Deep: ${e.message}`);
    return { content: "", citations: [] as string[] };
  }
}

// ─── Apollo mixed_people/api_search ──────────────────────────────────────────

async function findDecisionMakers(company: string, domain?: string) {
  if (!APOLLO_API_KEY) return [];
  try {
    const body: any = { per_page: 10, person_titles: ["CEO","CTO","CIO","CFO","COO","VP Engineering","VP Sales","VP Marketing","Head of IT","Director of Technology","CISO","VP Operations","SVP","Chief Information Officer","Chief Technology Officer","VP Product"] };
    if (domain) body.q_organization_domains = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    else body.q_organization_name = company;
    const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.people || []);
  } catch { return []; }
}

// ─── Apollo people/match — reveal full contact details ───────────────────────

async function revealApolloContact(person: any): Promise<any | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const matchPayload: Record<string, any> = {
      reveal_personal_emails: true,
      // NOTE: reveal_phone_number requires webhook_url — breaks the entire reveal call without it
    };
    if (person.id) {
      matchPayload.id = person.id;
    } else {
      if (person.first_name) matchPayload.first_name = person.first_name;
      if (person.last_name) matchPayload.last_name = person.last_name;
      if (person.organization_name) matchPayload.organization_name = person.organization_name;
    }

    const revealRes = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
      body: JSON.stringify(matchPayload),
      signal: AbortSignal.timeout(8000),
    });

    if (!revealRes.ok) {
      // Fall back to raw search data
      if (!person.first_name && !person.last_name && !person.name) return null;
      return {
        name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
        title: person.title || "",
        email: person.email || null,
        phone: person.sanitized_phone || person.phone_numbers?.[0]?.sanitized_number || null,
        linkedin: person.linkedin_url || null,
        city: person.city || null,
        state: person.state || null,
        department: person.departments?.[0] || null,
        seniority: person.seniority || null,
      };
    }

    const revealData = await revealRes.json();
    const p = revealData.person;
    if (!p || (!p.first_name && !p.last_name)) return null;

    return {
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: p.title || person.title || "",
      email: p.email || null,
      phone: p.sanitized_phone || p.phone_numbers?.[0]?.sanitized_number || null,
      linkedin: p.linkedin_url || null,
      city: p.city || null,
      state: p.state || null,
      department: p.departments?.[0] || null,
      seniority: p.seniority || null,
    };
  } catch {
    // Return raw data on error
    return {
      name: person.name || `${person.first_name || ""} ${person.last_name || ""}`.trim(),
      title: person.title || "",
      email: person.email || null,
      phone: person.phone_numbers?.[0]?.sanitized_number || null,
      linkedin: person.linkedin_url || null,
      city: person.city || null,
      state: person.state || null,
      department: person.departments?.[0] || null,
      seniority: person.seniority || null,
    };
  }
}

async function pdlEnrich(company: string, domain?: string) {
  if (!PDL_API_KEY) return null;
  try {
    const params = new URLSearchParams({ api_key: PDL_API_KEY, pretty: "true" });
    if (domain) params.set("website", domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
    else params.set("name", company);
    const res = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { company, website, deep } = req.body || {};
  if (!company) return res.status(400).json({ error: "Missing: company" });
  const domain = website || null;

  // ─── DEEP MODE — single Sonar Agent call instead of 5 parallel Sonar Pro ──
  // Use when the user clicks "Deep Research". Returns a richer multi-section
  // brief sourced via agentic reasoning. Falls through to fast mode if Sonar
  // Deep fails or returns nothing.
  if (deep === true) {
    try {
      const t0 = Date.now();
      const deepBrief = await sonarDeepResearch(
        `Build a comprehensive sales-intelligence brief on ${company}${domain ? ` (${domain})` : ""}. ` +
        `Cover: business model, products, revenue, headcount, leadership, recent news (last 6 months), ` +
        `competitive positioning, tech stack, pain points, buying signals, customer sentiment, and a ` +
        `competitive battle card. Cite primary sources for every claim. Be brutally specific with numbers, dates, and quotes.`
      );
      const [people, pdlData] = await Promise.all([
        findDecisionMakers(company, domain),
        pdlEnrich(company, domain),
      ]);
      const revealPromises = people.slice(0, 10).map((p: any) => revealApolloContact(p));
      const contacts = (await Promise.all(revealPromises)).filter(Boolean);

      if (deepBrief.content && deepBrief.content.length > 200) {
        return res.status(200).json({
          mode: "deep",
          company,
          domain,
          brief: deepBrief.content,
          relatedQuestions: deepBrief.relatedQuestions || [],
          citations: deepBrief.citations,
          contacts,
          firmographics: pdlData,
          generatedIn: Date.now() - t0,
          model: "sonar-deep-research",
        });
      }
      // else: fall through to fast mode
      console.warn(`[warbook] deep mode returned empty for ${company}, falling back to fast mode`);
    } catch (e: any) {
      console.error(`[warbook] deep mode failed: ${e?.message}, falling back to fast mode`);
    }
  }

  try {
    // ── STEP 1: Parallel Sonar queries + Apollo search + PDL enrich ──────────
    const [overviewRes, competitiveRes, newsRes, painSignalsRes, battleCardRes, rawPeople, pdlData] = await Promise.all([
      sonarResearch(`Comprehensive business intelligence report on ${company}${domain ? ` (${domain})` : ""}. Include: what they do, all products and services, annual revenue, employee count, headquarters city/state, founding year, stock ticker if public, market position, key executives, recent strategic direction, tech stack they use, their main customer segments. Be extremely specific with numbers and details.`, "high"),

      sonarResearch(`Deep competitive analysis for ${company}. For EACH major competitor (list at least 4-5): what is their market share vs ${company}? What specific advantages does ${company} have over them? What specific weaknesses does ${company} have compared to them? What features or capabilities does each competitor have that ${company} lacks? What is customer sentiment comparing them? How could a sales rep selling against ${company} beat them — specific tactics. What does ${company} have that competitors DON'T? Be brutally specific and actionable.`, "high"),

      sonarResearch(`Latest breaking news, developments, and market intelligence about ${company} from the last 6 months. Categorize EACH item as one of: product_launch, funding_round, partnership, leadership_change, market_disruption, earnings, acquisition, regulatory, customer_win, customer_loss, tech_adoption. Include: exact dates, what happened, impact level (1-10), and how a salesperson could use this intelligence. Also find: what users/customers are saying about ${company} on review sites, forums, social media — real quotes if possible. Rate overall market disruption potential.`, "high"),

      sonarResearch(`Deep analysis of ${company}'s pain points, buying signals, and market intent. PAIN POINTS: What are their biggest operational challenges? Technology gaps? What are customers complaining about? What job postings reveal about unmet needs? What analysts say about their weaknesses? Rate each pain point severity 1-10 and provide evidence. BUYING SIGNALS: What recent moves suggest they're buying new technology or services? Budget expansions? RFPs? Leadership hires in new areas? Tech stack changes? Contract renewals coming up? For each signal rate buyer intent 1-100. SENTIMENT: What is overall market sentiment? Customer NPS? Glassdoor reviews? Analyst ratings? Rate 1-100.`, "high"),

      sonarResearch(`Create an exhaustive competitive battle card for selling against ${company}. Include: (1) Their exact pricing model and typical contract terms with dollar amounts if available, (2) Known weaknesses customers hate — cite specific reviews and complaints, (3) Feature gaps vs modern alternatives — what they're missing, (4) Their sales process weaknesses — how their reps sell, what tricks they use, how to counter, (5) Switching costs — what it really takes to leave them, (6) Win rate estimates — how often do competitors beat them and why, (7) Decision criteria their buyers use — what matters most to them, (8) Landmines — things a competing rep should NEVER say or do, (9) Competitive talking points — specific phrases that work, (10) Their current vendor relationships and partnerships that create lock-in. Be brutally honest and specific.`, "high"),

      findDecisionMakers(company, domain),
      pdlEnrich(company, domain),
    ]);

    // ── STEP 2: Reveal full contact details for each person ──────────────────
    const revealPromises = rawPeople.slice(0, 10).map((person: any) => revealApolloContact(person));
    const revealedContacts = (await Promise.all(revealPromises)).filter(Boolean);

    // If reveal didn't get us contacts, at least use raw data
    const contacts = revealedContacts.length > 0 ? revealedContacts : rawPeople.map((p: any) => ({
      name: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: p.title || "",
      email: p.email || null,
      phone: p.phone_numbers?.[0]?.sanitized_number || null,
      linkedin: p.linkedin_url || null,
      city: p.city || null,
      state: p.state || null,
      department: p.departments?.[0] || null,
      seniority: p.seniority || null,
    }));

    const profile = pdlData ? {
      employeeCount: pdlData.employee_count || pdlData.size || null,
      revenue: pdlData.annual_revenue ? `$${(pdlData.annual_revenue / 1_000_000).toFixed(0)}M` : null,
      industry: pdlData.industry || null, founded: pdlData.founded || null,
      location: [pdlData.location?.locality, pdlData.location?.region, pdlData.location?.country].filter(Boolean).join(", "),
      techStack: pdlData.technology_names?.slice(0, 20) || [],
      tags: pdlData.tags?.slice(0, 10) || [],
      website: pdlData.website || domain, linkedin: pdlData.linkedin_url || null,
    } : null;

    // ── STEP 3: Synthesis via SambaNova / OpenAI ─────────────────────────────

    const synthesis = `Build an ATOM WarBook for ${company}. Return ONLY valid JSON — no markdown, no explanation.

RESEARCH: ${overviewRes.content}
COMPETITION: ${competitiveRes.content}
NEWS & SENTIMENT: ${newsRes.content}
PAIN POINTS & BUYING SIGNALS: ${painSignalsRes.content}
BATTLE CARD INTEL: ${battleCardRes.content}
COMPANY DATA: ${profile ? JSON.stringify(profile) : "N/A"}
CONTACTS FOUND: ${contacts.length} decision makers

Return this exact JSON structure:
{"overview":{"description":"3-4 detailed sentences","industry":"","founded":"","headquarters":"","employeeCount":"","revenue":"","website":"","stockTicker":null},"executiveSummary":"4-5 sentence intelligence brief for a sales warrior","techStack":["tech1","tech2","tech3","tech4","tech5"],"competitors":[{"name":"","threat":"high/medium/low","differentiator":"one line what makes them different","yourAdvantages":["specific advantage 1","specific advantage 2"],"theirWeaknesses":["specific weakness 1","specific weakness 2"],"howToBeat":"specific tactical advice for beating this competitor in a deal","marketShare":"estimated market position vs target"}],"painPoints":[{"pain":"specific pain point","severity":"critical/high/medium","opportunity":"how we can help","impact":"business impact of this pain","evidence":"where this was discovered - reviews, job postings, analyst reports","urgencyScore":8}],"buyingSignals":[{"signal":"specific signal detected","strength":"strong/moderate/weak","source":"where detected","category":"tech_adoption/expansion/budget_increase/leadership_hire/vendor_switch/contract_renewal/pain_trigger","intentScore":75,"recency":"when this signal was detected","actionableInsight":"what to do with this signal"}],"recentNews":[{"headline":"","date":"exact date","relevance":"why this matters","category":"product_launch/funding/partnership/leadership/disruption/earnings/acquisition/regulatory/customer_win/user_sentiment","impactScore":8,"salesAngle":"how a sales rep should use this intel"}],"battleCard":{"pricingModel":"detailed pricing structure","contractTerms":"typical contract details","switchingCost":"what it takes to switch away","winRate":"estimated win rate against them","knownWeaknesses":["specific weakness 1","specific weakness 2","specific weakness 3"],"customerComplaints":["specific complaint with context 1","specific complaint with context 2","specific complaint with context 3"],"featureGaps":["missing feature 1","missing feature 2","missing feature 3"],"salesProcessWeaknesses":["their sales weakness 1","their sales weakness 2"],"talkingPoints":["killer talking point 1","killer talking point 2","killer talking point 3","killer talking point 4"],"strengthsVsUs":["what they genuinely do well 1","what they genuinely do well 2"],"decisionCriteria":["what their buyers care about most 1","what their buyers care about most 2","what their buyers care about most 3"],"landmines":["never say or do this 1","never say or do this 2"],"vendorLockIn":["partnership or integration creating lock-in 1","partnership or integration creating lock-in 2"]},"battlePlan":{"objectionPredictions":[{"objection":"exact objection they'll raise","probability":"high/medium/low","counterStrategy":"exactly how to handle it","followUp":"what to say next after countering"}],"pitchAngles":[{"angle":"pitch angle name","targetPersona":"who this pitch targets","openingLine":"exact opening line to use","proofPoints":["proof point 1","proof point 2"]}],"callStrategy":{"bestTimeToCall":"specific timing advice","gatekeeperTips":"how to get past gatekeepers","toneRecommendation":"recommended tone and approach","keyQuestions":["discovery question 1","discovery question 2","discovery question 3","discovery question 4","discovery question 5"]},"emailSequence":[{"day":1,"subject":"email subject line","angle":"what angle to take"},{"day":3,"subject":"follow up subject","angle":"angle for follow up"},{"day":7,"subject":"value add subject","angle":"provide value angle"}],"multiThreadStrategy":"how to engage multiple stakeholders simultaneously","timingPlaybook":"when to strike and why — based on their fiscal calendar, contract renewals, etc.","competitiveTraps":["trap to set against competitors 1","trap to set against competitors 2"]},"sentimentScore":75,"buyerIntentScore":60,"priorityLevel":"high/medium/low"}

IMPORTANT: Return at least 4-5 competitors, 5-6 pain points, 5-6 buying signals, 6-8 news items, and 3-4 objection predictions. Be specific and data-driven. Every insight should be actionable for a sales rep.`;

    // Try SambaNova first (faster inference), fall back to OpenAI
    let warbook: any;
    let synthesisEngine = "openai";
    if (SAMBANOVA_API_KEY) {
      try {
        const sambaRes = await fetch("https://api.sambanova.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${SAMBANOVA_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "Meta-Llama-3.3-70B-Instruct", messages: [{ role: "user", content: synthesis }], temperature: 0.3, stream: false }),
          signal: AbortSignal.timeout(25000),
        });
        if (sambaRes.ok) {
          const sambaData = await sambaRes.json();
          const raw = sambaData.choices?.[0]?.message?.content || "{}";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          warbook = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
          synthesisEngine = "sambanova";
        }
      } catch (e: any) {
        console.log(`[WarBook] SambaNova failed (${e.message}), falling back to OpenAI`);
      }
    }
    if (!warbook) {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: synthesis }], response_format: { type: "json_object" }, temperature: 0.3 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
      const gptData = await gptRes.json();
      warbook = JSON.parse(gptData.choices[0].message.content);
    }

    // Normalize: if old-style flat objectionPredictions/pitchAngles/callStrategy exist at root, move into battlePlan
    if (!warbook.battlePlan && warbook.objectionPredictions) {
      warbook.battlePlan = {
        objectionPredictions: warbook.objectionPredictions,
        pitchAngles: warbook.pitchAngles,
        callStrategy: warbook.callStrategy,
        emailSequence: warbook.emailSequence || [],
        multiThreadStrategy: warbook.multiThreadStrategy || "",
        timingPlaybook: warbook.timingPlaybook || "",
        competitiveTraps: warbook.competitiveTraps || [],
      };
    }

    return res.json({
      company, warbook, contacts, companyProfile: profile,
      citations: [...overviewRes.citations, ...competitiveRes.citations, ...newsRes.citations, ...painSignalsRes.citations, ...battleCardRes.citations],
      sources: { perplexity: !!overviewRes.content, apollo: contacts.length > 0, pdl: !!profile, synthesisEngine },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error(`[WarBook] ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
