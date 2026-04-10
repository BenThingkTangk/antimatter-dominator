import type { VercelRequest, VercelResponse } from "@vercel/node";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

interface EnrichedContact {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  seniority: string;
  department: string;
  linkedin: string | null;
  phone: string | null;
  mobilePhone: string | null;
  city: string | null;
  state: string | null;
  confidence: number;
  verification: string;
  source: string; // "apollo" | "hunter" | "both"
}

// ─── Geo → Apollo location filters ──────────────────────────────────────────
function geoToApolloFilters(geo: string | undefined): {
  personLocations?: string[];
  organizationLocations?: string[];
} {
  if (!geo || geo === "All US" || geo === "Global") return {};

  const stateMap: Record<string, string> = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
    Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
    Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
    Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
    Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
    Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
    Wisconsin: "WI", Wyoming: "WY",
  };

  const regionMap: Record<string, string[]> = {
    "US South": ["TX", "FL", "GA", "NC", "SC", "TN", "AL", "LA", "MS", "AR", "VA", "KY", "WV"],
    "US East": ["NY", "NJ", "MA", "CT", "PA", "MD", "DE", "RI", "NH", "VT", "ME"],
    "US Northeast": ["NY", "NJ", "MA", "CT", "PA", "MD", "DE", "RI", "NH", "VT", "ME"],
    "US East / Northeast": ["NY", "NJ", "MA", "CT", "PA", "MD", "DE", "RI", "NH", "VT", "ME"],
    "US Midwest": ["IL", "OH", "MI", "IN", "MN", "WI", "MO", "IA", "KS", "NE", "ND", "SD"],
    "US West": ["CA", "WA", "OR", "CO", "AZ", "NV", "UT", "ID", "MT", "WY", "NM", "AK", "HI"],
    "US Southeast": ["FL", "GA", "NC", "SC", "VA", "MD", "DC", "DE"],
  };

  if (regionMap[geo]) {
    const states = regionMap[geo];
    const locations = states.map((s) => `${s}, United States`);
    return { personLocations: locations, organizationLocations: locations };
  }

  // Check if it's a full state name
  const abbrev = stateMap[geo];
  if (abbrev) {
    return {
      personLocations: [`${abbrev}, United States`],
      organizationLocations: [`${abbrev}, United States`],
    };
  }

  // EU / UK / Canada
  if (geo === "EU") {
    const euCountries = ["Germany", "France", "Netherlands", "Sweden", "Spain", "Italy", "Belgium", "Poland", "Denmark", "Austria"];
    return { personLocations: euCountries, organizationLocations: euCountries };
  }
  if (geo === "UK") {
    return { personLocations: ["United Kingdom"], organizationLocations: ["United Kingdom"] };
  }
  if (geo === "Canada") {
    return { personLocations: ["Canada"], organizationLocations: ["Canada"] };
  }

  return {};
}

// ─── Apollo.io Enrichment (Primary) ─────────────────────────────────────────
async function enrichWithApollo(
  companyName: string,
  domain?: string,
  geoFilters?: { personLocations?: string[]; organizationLocations?: string[] }
): Promise<{ contacts: EnrichedContact[]; companyPhone: string; employeeCount: number; revenue: string }> {
  if (!APOLLO_API_KEY) return { contacts: [], companyPhone: "", employeeCount: 0, revenue: "" };

  let companyPhone = "";
  let employeeCount = 0;
  let revenue = "";
  const contacts: EnrichedContact[] = [];

  try {
    // Step 1: Org enrichment for company data
    if (domain) {
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const orgRes = await fetch(
        `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanDomain)}`,
        { headers: { "X-Api-Key": APOLLO_API_KEY } }
      );
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const org = orgData.organization || {};
        companyPhone = org.phone || "";
        employeeCount = org.estimated_num_employees || 0;
        revenue = org.annual_revenue_printed || "";
      }
    }

    // Step 2: People search for decision makers
    const searchDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
    const searchBody: any = {
      person_seniorities: ["vp", "director", "c_suite", "owner", "founder"],
      page: 1,
      per_page: 5,
    };
    if (searchDomain) {
      searchBody.q_organization_domains = searchDomain;
    } else {
      searchBody.q_organization_name = companyName;
    }

    // Apply geo filters to Apollo people search
    if (geoFilters?.personLocations?.length) {
      searchBody.person_locations = geoFilters.personLocations;
    }

    const peopleRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify(searchBody),
    });

    if (peopleRes.ok) {
      const peopleData = await peopleRes.json();
      const rawPeople = peopleData.people || [];

      // Reveal each person (uses Apollo credits)
      for (const rp of rawPeople.slice(0, 5)) {
        if (!rp.id) continue;
        try {
          const revealRes = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
            body: JSON.stringify({ id: rp.id, reveal_personal_emails: true }),
          });
          if (revealRes.ok) {
            const revealData = await revealRes.json();
            const p = revealData.person;
            if (p && (p.first_name || p.last_name)) {
              contacts.push({
                email: p.email || "",
                firstName: p.first_name || "",
                lastName: p.last_name || "",
                position: p.title || "",
                seniority: p.seniority || rp.seniority || "",
                department: p.departments?.[0] || "",
                linkedin: p.linkedin_url || null,
                phone: p.sanitized_phone || companyPhone || null,
                mobilePhone: p.mobile_phone || null,
                city: p.city || null,
                state: p.state || null,
                confidence: 95,
                verification: p.email_status || "verified",
                source: "apollo",
              });
            }
          }
        } catch {
          // Reveal failed — use whatever search data we have
          if (rp.first_name) {
            contacts.push({
              email: "",
              firstName: rp.first_name || "",
              lastName: rp.last_name || "",
              position: rp.title || "",
              seniority: rp.seniority || "",
              department: "",
              linkedin: null,
              phone: companyPhone || null,
              mobilePhone: null,
              city: null,
              state: null,
              confidence: 50,
              verification: "unverified",
              source: "apollo",
            });
          }
        }
      }
    }
  } catch (err) {
    console.error(`Apollo enrichment failed for ${companyName}:`, err);
  }

  return { contacts, companyPhone, employeeCount, revenue };
}

// ─── Hunter.io Enrichment (Supplement) ──────────────────────────────────────
async function enrichWithHunter(
  companyName: string,
  domain?: string
): Promise<EnrichedContact[]> {
  if (!HUNTER_API_KEY) return [];

  try {
    const searchParam = domain
      ? `domain=${encodeURIComponent(domain)}`
      : `company=${encodeURIComponent(companyName)}`;
    const url = `https://api.hunter.io/v2/domain-search?${searchParam}&limit=5&seniority=executive,senior&type=personal&required_field=full_name&api_key=${HUNTER_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const hunterData = data.data;

    return (hunterData?.emails || []).map((e: any) => ({
      email: e.value || "",
      firstName: e.first_name || "",
      lastName: e.last_name || "",
      position: e.position || "",
      seniority: e.seniority || "",
      department: e.department || "",
      linkedin: e.linkedin || null,
      phone: e.phone_number || null,
      mobilePhone: null,
      city: null,
      state: null,
      confidence: e.confidence || 0,
      verification: e.verification?.status || "unknown",
      source: "hunter",
    }));
  } catch {
    return [];
  }
}

// ─── Merge contacts from Apollo + Hunter ────────────────────────────────────
function mergeContacts(apollo: EnrichedContact[], hunter: EnrichedContact[]): EnrichedContact[] {
  const byEmail = new Map<string, EnrichedContact>();
  const byName = new Map<string, EnrichedContact>();

  // Apollo contacts are primary
  for (const c of apollo) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    const key = `${c.firstName}_${c.lastName}`.toLowerCase();
    if (key !== "_") byName.set(key, c);
  }

  // Merge Hunter contacts — fill in gaps
  for (const h of hunter) {
    const emailKey = h.email?.toLowerCase();
    const nameKey = `${h.firstName}_${h.lastName}`.toLowerCase();

    if (emailKey && byEmail.has(emailKey)) {
      // Same person — merge data
      const existing = byEmail.get(emailKey)!;
      if (!existing.phone && h.phone) existing.phone = h.phone;
      if (!existing.linkedin && h.linkedin) existing.linkedin = h.linkedin;
      if (!existing.position && h.position) existing.position = h.position;
      existing.source = "both";
    } else if (nameKey !== "_" && byName.has(nameKey)) {
      const existing = byName.get(nameKey)!;
      if (!existing.email && h.email) existing.email = h.email;
      if (!existing.phone && h.phone) existing.phone = h.phone;
      if (!existing.linkedin && h.linkedin) existing.linkedin = h.linkedin;
      existing.source = "both";
    } else {
      // New contact from Hunter
      if (h.email) byEmail.set(h.email.toLowerCase(), h);
      else if (nameKey !== "_") byName.set(nameKey, h);
    }
  }

  // Combine and dedupe
  const all = new Map<string, EnrichedContact>();
  for (const c of [...byEmail.values(), ...byName.values()]) {
    const key = c.email ? c.email.toLowerCase() : `${c.firstName}_${c.lastName}`.toLowerCase();
    if (!all.has(key)) all.set(key, c);
  }

  return [...all.values()].sort((a, b) => b.confidence - a.confidence);
}

// ─── Fetch RAG context for product intelligence ───────────────────────────────
async function fetchRagContext(productFocus: string): Promise<string> {
  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: productFocus, module: "pitch" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.context || data.summary || "";
  } catch {
    return "";
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry, productFocus, geo, excludeCompanies = [], sessionId } = req.body;

    // Resolve geo filters for Apollo
    const geoFilters = geoToApolloFilters(geo);

    // Build a human-readable geo description for the AI prompt
    const geoDescription = geo && geo !== "All US" && geo !== "Global"
      ? geo
      : geo === "Global" ? "anywhere in the world" : "the United States";

    // Step 0: Fetch RAG product intelligence context
    let ragContext = "";
    if (productFocus && productFocus !== "all" && productFocus.trim().length > 0) {
      ragContext = await fetchRagContext(productFocus.trim());
    }

    // Step 1: AI generates real prospect companies based on product and industry
    const isCustomProduct = productFocus && productFocus !== "all" && productFocus.trim().length > 0;

    const excludeList = Array.isArray(excludeCompanies) && excludeCompanies.length > 0
      ? excludeCompanies
      : [];

    const systemPrompt = `You are an elite B2B sales intelligence analyst. Your job is to identify REAL companies that would be ideal prospects for a specific product or service.

Rules:
- Only return REAL companies with real website domains
- Focus on companies most likely to NEED and BUY the product
- Consider their current tech stack, pain points, contract cycles, and buying signals
- Rank by likelihood to buy (score 0-100)
- Include the company's actual website domain (e.g. "walmart.com", "ge.com")
- You MUST return companies from DIFFERENT industries/sub-sectors — do not return multiple companies from the same industry or vertical
- Vary company size: include at least 1 enterprise (1000+ employees), 2 mid-market (100-999), and 2 SMB (under 100) if possible
- Return ONLY a valid JSON array. No markdown, no code blocks, no explanation.
${excludeList.length > 0 ? `- Do NOT suggest any of these companies which have already been shown: ${excludeList.join(", ")}` : ""}`;

    let userPrompt: string;
    if (isCustomProduct) {
      const ragSection = ragContext
        ? `\n\nProduct Intelligence (RAG context):\n${ragContext}\n\nUse the above product intelligence to identify companies with the most relevant pain points and best fit for ${productFocus}.`
        : "";

      userPrompt = `Find 5 real companies${industry && industry !== "All Industries" ? ` in the ${industry} industry` : ""} located in ${geoDescription} that would be the best prospects for selling them ${productFocus}.${ragSection}

Think about:
- What does ${productFocus} do? Who buys it?
- Which companies have the pain points ${productFocus} solves?
- Which companies might be using a competitor and could be displaced?
- Which companies are at a size/stage where they'd need this?
- Spread across DIFFERENT sub-industries and verticals — no two from the same sector

Return JSON array:
[{"companyName":"string","domain":"company-website.com","industry":"string","score":0-100,"reason":"1-2 sentences explaining exactly why this company would buy ${productFocus}","matchedProducts":["${productFocus.toLowerCase().replace(/\s+/g, '-')}"],"signals":["buying signal 1","buying signal 2"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]`;
    } else {
      userPrompt = `Find 5 real companies${industry && industry !== "All Industries" ? ` in the ${industry} industry` : ""} located in ${geoDescription} that would be ideal prospects for Antimatter AI's product ecosystem:
- Antimatter AI Platform: Custom AI development and digital product studio
- ATOM Enterprise: Enterprise AI deployment framework (on-prem, VPC, edge)
- Vidzee: AI cinematic video from listing photos (real estate)
- Clinix Agent: AI healthcare billing and denied claims recovery
- Clinix AI: AI clinical documentation automation
- Red Team ATOM: Quantum-ready autonomous cybersecurity red teaming

Spread companies across DIFFERENT industries/sub-sectors — no two from the same vertical.

Return JSON array:
[{"companyName":"string","domain":"company-website.com","industry":"string","score":0-100,"reason":"1-2 sentences why they need a specific product","matchedProducts":["product-slug"],"signals":["signal1","signal2"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]
Use slugs: antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom`;
    }

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
      }),
    });
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";
    let prospectsList: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      prospectsList = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) prospectsList = JSON.parse(match[0]);
    }

    // Step 2: Enrich each prospect with Apollo (primary) + Hunter (supplement) in parallel
    const enrichmentPromises = prospectsList.map(async (p: any) => {
      const company = p.companyName || "Unknown";
      const domain = p.domain || "";

      const [apolloResult, hunterContacts] = await Promise.all([
        enrichWithApollo(company, domain, geoFilters),
        enrichWithHunter(company, domain),
      ]);

      const mergedContacts = mergeContacts(apolloResult.contacts, hunterContacts);

      return {
        apolloResult,
        mergedContacts,
      };
    });

    const enrichments = await Promise.all(enrichmentPromises);

    // Step 3: Merge AI prospects with enriched contact data
    const results = prospectsList.map((p: any, i: number) => {
      const { apolloResult, mergedContacts } = enrichments[i];

      return {
        id: Date.now() + i,
        companyName: p.companyName || "Unknown",
        domain: p.domain || "",
        industry: p.industry || "Technology",
        score: Number(p.score) || 50,
        reason: p.reason || "",
        matchedProducts: JSON.stringify(p.matchedProducts || []),
        signals: JSON.stringify(p.signals || []),
        companySize: p.companySize || "mid-market",
        urgency: p.urgency || "medium",
        lastUpdated: new Date().toISOString(),
        status: "new",
        contacts: JSON.stringify(mergedContacts),
        companyPhone: apolloResult.companyPhone || "",
        employeeCount: apolloResult.employeeCount || 0,
        revenue: apolloResult.revenue || "",
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error("Prospect error:", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
}
