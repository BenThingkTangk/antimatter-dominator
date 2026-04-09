import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const PDL_API_KEY = process.env.PDL_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  source: string; // "apollo" | "hunter" | "pdl" | "both"
}

interface ScanFilters {
  industry?: string;
  geo?: string;
  employeeSize?: string;
  revenueRange?: string;
  productFocus?: string;
  jobTitles?: string[];
  techStack?: string;
  keywords?: string;
  excludeCompanies?: string[];
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
    "US Northeast": ["NY", "NJ", "MA", "CT", "PA", "MD", "DE", "RI", "NH", "VT", "ME"],
    "US East": ["NY", "NJ", "MA", "CT", "PA", "MD", "DE", "RI", "NH", "VT", "ME"],
    "US Midwest": ["IL", "OH", "MI", "IN", "MN", "WI", "MO", "IA", "KS", "NE", "ND", "SD"],
    "US West": ["CA", "WA", "OR", "CO", "AZ", "NV", "UT", "ID", "MT", "WY", "NM", "AK", "HI"],
    "US Southeast": ["FL", "GA", "NC", "SC", "VA", "MD", "DC", "DE"],
  };

  if (regionMap[geo]) {
    const states = regionMap[geo];
    const locations = states.map((s) => `${s}, United States`);
    return { personLocations: locations, organizationLocations: locations };
  }

  const abbrev = stateMap[geo];
  if (abbrev) {
    return {
      personLocations: [`${abbrev}, United States`],
      organizationLocations: [`${abbrev}, United States`],
    };
  }

  if (geo === "EU") {
    const euCountries = ["Germany", "France", "Netherlands", "Sweden", "Spain", "Italy", "Belgium", "Poland", "Denmark", "Austria"];
    return { personLocations: euCountries, organizationLocations: euCountries };
  }
  if (geo === "UK") return { personLocations: ["United Kingdom"], organizationLocations: ["United Kingdom"] };
  if (geo === "Canada") return { personLocations: ["Canada"], organizationLocations: ["Canada"] };

  return {};
}

// ─── Employee size → Apollo num_employees range ──────────────────────────────

function employeeSizeToApolloRange(size: string | undefined): [number, number] | null {
  if (!size || size === "any") return null;
  const map: Record<string, [number, number]> = {
    "1-10": [1, 10],
    "11-50": [11, 50],
    "51-200": [51, 200],
    "201-500": [201, 500],
    "501-1000": [501, 1000],
    "1001-5000": [1001, 5000],
    "5001-10000": [5001, 10000],
    "10001+": [10001, 9999999],
  };
  return map[size] || null;
}

// ─── Revenue range → human-readable string for AI prompt ────────────────────

function revenueToDescription(range: string | undefined): string {
  if (!range || range === "any") return "";
  const map: Record<string, string> = {
    "under-1m": "under $1M in annual revenue",
    "1m-10m": "$1M–$10M in annual revenue",
    "10m-50m": "$10M–$50M in annual revenue",
    "50m-100m": "$50M–$100M in annual revenue",
    "100m-500m": "$100M–$500M in annual revenue",
    "500m-1b": "$500M–$1B in annual revenue",
    "1b+": "over $1B in annual revenue",
  };
  return map[range] || "";
}

// ─── Apollo.io enrichment (primary) ─────────────────────────────────────────

async function enrichWithApollo(
  companyName: string,
  domain?: string,
  geoFilters?: { personLocations?: string[]; organizationLocations?: string[] },
  jobTitles?: string[],
  employeeSizeRange?: [number, number] | null
): Promise<{ contacts: EnrichedContact[]; companyPhone: string; employeeCount: number; revenue: string; techStack: string[] }> {
  if (!APOLLO_API_KEY) return { contacts: [], companyPhone: "", employeeCount: 0, revenue: "", techStack: [] };

  let companyPhone = "";
  let employeeCount = 0;
  let revenue = "";
  let techStack: string[] = [];
  const contacts: EnrichedContact[] = [];

  try {
    // Step 1: Org enrichment for company data
    const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
    if (cleanDomain) {
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
        techStack = org.technology_names || [];
      }
    }

    // Step 2: Build people search payload
    const seniorityCriteria = ["vp", "director", "c_suite", "owner", "founder", "partner", "head"];

    const searchBody: any = {
      person_seniorities: seniorityCriteria,
      page: 1,
      per_page: 10,
    };

    if (cleanDomain) {
      searchBody.q_organization_domains = cleanDomain;
    } else {
      searchBody.q_organization_name = companyName;
    }

    // Apply geo filters
    if (geoFilters?.personLocations?.length) {
      searchBody.person_locations = geoFilters.personLocations;
    }

    // Apply org location filters
    if (geoFilters?.organizationLocations?.length) {
      searchBody.organization_locations = geoFilters.organizationLocations;
    }

    // Apply job title filter
    if (jobTitles && jobTitles.length > 0) {
      searchBody.person_titles = jobTitles;
    }

    // Apply employee count filter
    if (employeeSizeRange) {
      searchBody.organization_num_employees_ranges = [`${employeeSizeRange[0]},${employeeSizeRange[1]}`];
    }

    const peopleRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify(searchBody),
    });

    if (peopleRes.ok) {
      const peopleData = await peopleRes.json();
      const rawPeople = peopleData.people || [];

      // Reveal each person via people/match (uses Pro credits for email reveal)
      const revealPromises = rawPeople.slice(0, 10).map(async (rp: any) => {
        if (!rp.id) return null;
        try {
          const revealRes = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
            body: JSON.stringify({ id: rp.id, reveal_personal_emails: true, reveal_phone_number: true }),
          });
          if (!revealRes.ok) return null;
          const revealData = await revealRes.json();
          const p = revealData.person;
          if (!p || (!p.first_name && !p.last_name)) return null;
          return {
            email: p.email || "",
            firstName: p.first_name || "",
            lastName: p.last_name || "",
            position: p.title || rp.title || "",
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
          } as EnrichedContact;
        } catch {
          // Fall back to search data without reveal
          if (!rp.first_name) return null;
          return {
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
          } as EnrichedContact;
        }
      });

      const revealed = await Promise.all(revealPromises);
      for (const c of revealed) {
        if (c) contacts.push(c);
      }
    }
  } catch (err) {
    console.error(`Apollo enrichment failed for ${companyName}:`, err);
  }

  return { contacts, companyPhone, employeeCount, revenue, techStack };
}

// ─── Hunter.io enrichment (supplement) ──────────────────────────────────────

async function enrichWithHunter(
  companyName: string,
  domain?: string
): Promise<EnrichedContact[]> {
  if (!HUNTER_API_KEY) return [];

  try {
    const searchParam = domain
      ? `domain=${encodeURIComponent(domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))}`
      : `company=${encodeURIComponent(companyName)}`;
    const url = `https://api.hunter.io/v2/domain-search?${searchParam}&limit=10&seniority=executive,senior&type=personal&required_field=full_name&api_key=${HUNTER_API_KEY}`;

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

// ─── PDL company enrichment (additional company data) ───────────────────────

async function enrichWithPDL(
  companyName: string,
  domain?: string
): Promise<{ employeeCount: number; revenue: string; industry: string; techStack: string[]; founded: string; location: string }> {
  if (!PDL_API_KEY) return { employeeCount: 0, revenue: "", industry: "", techStack: [], founded: "", location: "" };

  try {
    const params = new URLSearchParams({ api_key: PDL_API_KEY });
    if (domain) {
      params.set("website", domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
    } else {
      params.set("name", companyName);
    }
    params.set("pretty", "true");

    const res = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?${params.toString()}`);
    if (!res.ok) return { employeeCount: 0, revenue: "", industry: "", techStack: [], founded: "", location: "" };

    const data = await res.json();
    return {
      employeeCount: data.employee_count || data.size || 0,
      revenue: data.annual_revenue ? `$${(data.annual_revenue / 1_000_000).toFixed(0)}M` : "",
      industry: data.industry || "",
      techStack: data.technology_names || [],
      founded: data.founded ? String(data.founded) : "",
      location: [data.location?.locality, data.location?.region, data.location?.country].filter(Boolean).join(", "),
    };
  } catch {
    return { employeeCount: 0, revenue: "", industry: "", techStack: [], founded: "", location: "" };
  }
}

// ─── Merge contacts from Apollo + Hunter ────────────────────────────────────

function mergeContacts(apollo: EnrichedContact[], hunter: EnrichedContact[]): EnrichedContact[] {
  const byEmail = new Map<string, EnrichedContact>();
  const byName = new Map<string, EnrichedContact>();

  for (const c of apollo) {
    if (c.email) byEmail.set(c.email.toLowerCase(), c);
    const key = `${c.firstName}_${c.lastName}`.toLowerCase();
    if (key !== "_") byName.set(key, c);
  }

  for (const h of hunter) {
    const emailKey = h.email?.toLowerCase();
    const nameKey = `${h.firstName}_${h.lastName}`.toLowerCase();

    if (emailKey && byEmail.has(emailKey)) {
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
      if (h.email) byEmail.set(h.email.toLowerCase(), h);
      else if (nameKey !== "_") byName.set(nameKey, h);
    }
  }

  const all = new Map<string, EnrichedContact>();
  for (const c of [...byEmail.values(), ...byName.values()]) {
    const key = c.email ? c.email.toLowerCase() : `${c.firstName}_${c.lastName}`.toLowerCase();
    if (!all.has(key)) all.set(key, c);
  }

  return [...all.values()].sort((a, b) => b.confidence - a.confidence);
}

// ─── Fetch RAG context for product intelligence ──────────────────────────────

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

// ─── Build AI prompt with all granular filters ───────────────────────────────

function buildPrompt(filters: ScanFilters, ragContext: string, geoDescription: string): { system: string; user: string } {
  const {
    industry,
    employeeSize,
    revenueRange,
    productFocus,
    jobTitles,
    techStack,
    keywords,
    excludeCompanies = [],
  } = filters;

  const isCustomProduct = productFocus && productFocus.trim().length > 0;

  const constraints: string[] = [];
  if (industry && industry !== "All Industries") {
    constraints.push(`Industry: ${industry}`);
  }
  if (employeeSize && employeeSize !== "any") {
    const sizeMap: Record<string, string> = {
      "1-10": "1–10 employees (micro/startup)",
      "11-50": "11–50 employees (small startup)",
      "51-200": "51–200 employees (growing startup/SMB)",
      "201-500": "201–500 employees (mid-market lower)",
      "501-1000": "501–1,000 employees (mid-market)",
      "1001-5000": "1,001–5,000 employees (upper mid-market)",
      "5001-10000": "5,001–10,000 employees (enterprise lower)",
      "10001+": "10,000+ employees (large enterprise)",
    };
    constraints.push(`Company size: ${sizeMap[employeeSize] || employeeSize}`);
  }
  if (revenueRange && revenueRange !== "any") {
    const revDesc = revenueToDescription(revenueRange);
    if (revDesc) constraints.push(`Revenue: ${revDesc}`);
  }
  if (jobTitles && jobTitles.length > 0) {
    constraints.push(`Target decision-maker titles: ${jobTitles.join(", ")}`);
  }
  if (techStack) {
    constraints.push(`Tech stack / tools they use: ${techStack}`);
  }
  if (keywords) {
    constraints.push(`Keywords / company description match: ${keywords}`);
  }

  const constraintBlock = constraints.length > 0
    ? `\n\nSTRICT FILTER REQUIREMENTS — all companies must match:\n${constraints.map(c => `• ${c}`).join("\n")}`
    : "";

  const excludeBlock = excludeCompanies.length > 0
    ? `\n\nDo NOT suggest any of these companies (already shown): ${excludeCompanies.join(", ")}`
    : "";

  const system = `You are an elite B2B sales intelligence analyst specializing in identifying ideal-fit prospects.

Rules:
- Only return REAL companies with real website domains
- Focus on companies most likely to NEED and BUY the product — consider their tech stack, pain points, contract cycles, and buying signals
- Rank by likelihood to buy (score 0-100)
- Include the company's actual website domain (e.g. "walmart.com", "ge.com")
- Vary company sub-sectors — do not return multiple companies in the exact same niche
- Return ONLY a valid JSON array with no markdown, no code blocks, no explanation${excludeBlock}`;

  let userPrompt: string;

  if (isCustomProduct) {
    const ragSection = ragContext
      ? `\n\nProduct Intelligence (RAG context):\n${ragContext}\n\nUse the above to identify companies with the most relevant pain points.`
      : "";

    userPrompt = `Find 8 real companies located in ${geoDescription} that would be ideal prospects for selling them: ${productFocus}.${ragSection}${constraintBlock}

Think about:
- What does ${productFocus} do? Who buys it?
- Which companies have the pain points ${productFocus} solves?
- Which companies might be using a competitor and could be displaced?
- Which companies are at the right size/revenue stage?
${jobTitles && jobTitles.length > 0 ? `- The key buyers at these companies would be: ${jobTitles.join(", ")}` : ""}
${techStack ? `- Prefer companies using: ${techStack}` : ""}
${keywords ? `- Look for companies described by: ${keywords}` : ""}

Return a JSON array (no markdown):
[{"companyName":"string","domain":"company.com","industry":"string","score":0-100,"reason":"1-2 sentences explaining exactly why this company would buy ${productFocus}","matchedProducts":["${productFocus.toLowerCase().replace(/\s+/g, "-")}"],"signals":["buying signal 1","buying signal 2","buying signal 3"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]`;
  } else {
    userPrompt = `Find 8 real companies located in ${geoDescription} that would be ideal prospects for Antimatter AI's product ecosystem:${constraintBlock}

Products:
- Antimatter AI Platform: Custom AI development and digital product studio
- ATOM Enterprise: Enterprise AI deployment framework (on-prem, VPC, edge)
- Vidzee: AI cinematic video from listing photos (real estate)
- Clinix Agent: AI healthcare billing and denied claims recovery
- Clinix AI: AI clinical documentation automation
- Red Team ATOM: Quantum-ready autonomous cybersecurity red teaming
${techStack ? `\nPrefer companies using: ${techStack}` : ""}
${keywords ? `\nLook for companies matching: ${keywords}` : ""}

Return a JSON array (no markdown):
[{"companyName":"string","domain":"company.com","industry":"string","score":0-100,"reason":"1-2 sentences why they need a specific product","matchedProducts":["product-slug"],"signals":["signal1","signal2","signal3"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]
Use slugs: antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom`;
  }

  return { system, user: userPrompt };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const filters: ScanFilters = {
      industry: req.body.industry,
      geo: req.body.geo,
      employeeSize: req.body.employeeSize,
      revenueRange: req.body.revenueRange,
      productFocus: req.body.productFocus,
      jobTitles: req.body.jobTitles || [],
      techStack: req.body.techStack,
      keywords: req.body.keywords,
      excludeCompanies: Array.isArray(req.body.excludeCompanies) ? req.body.excludeCompanies : [],
    };

    // Resolve geo filters
    const geoFilters = geoToApolloFilters(filters.geo);
    const employeeSizeRange = employeeSizeToApolloRange(filters.employeeSize);

    const geoDescription =
      filters.geo && filters.geo !== "All US" && filters.geo !== "Global"
        ? filters.geo
        : filters.geo === "Global"
        ? "anywhere in the world"
        : "the United States";

    // Fetch RAG context if product specified
    let ragContext = "";
    if (filters.productFocus && filters.productFocus.trim().length > 0) {
      ragContext = await fetchRagContext(filters.productFocus.trim());
    }

    // Build and send AI prompt
    const { system, user } = buildPrompt(filters, ragContext, geoDescription);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
        max_tokens: 3000,
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
      if (match) {
        try {
          prospectsList = JSON.parse(match[0]);
        } catch {
          prospectsList = [];
        }
      }
    }

    if (!Array.isArray(prospectsList)) prospectsList = [];

    // Enrich each prospect in parallel — Apollo (primary) + Hunter (supplement) + PDL (company data)
    const enrichmentPromises = prospectsList.map(async (p: any) => {
      const company = p.companyName || "Unknown";
      const domain = p.domain || "";

      const [apolloResult, hunterContacts, pdlData] = await Promise.all([
        enrichWithApollo(company, domain, geoFilters, filters.jobTitles, employeeSizeRange),
        enrichWithHunter(company, domain),
        enrichWithPDL(company, domain),
      ]);

      const mergedContacts = mergeContacts(apolloResult.contacts, hunterContacts);

      // Merge company data — Apollo primary, PDL supplement
      const finalEmployeeCount = apolloResult.employeeCount || pdlData.employeeCount || 0;
      const finalRevenue = apolloResult.revenue || pdlData.revenue || "";
      const finalTechStack = [...new Set([...apolloResult.techStack, ...pdlData.techStack])].slice(0, 10);

      return {
        apolloResult,
        pdlData,
        mergedContacts,
        finalEmployeeCount,
        finalRevenue,
        finalTechStack,
      };
    });

    const enrichments = await Promise.all(enrichmentPromises);

    // Assemble final results
    const results = prospectsList.map((p: any, i: number) => {
      const { mergedContacts, finalEmployeeCount, finalRevenue, finalTechStack, apolloResult } = enrichments[i];

      return {
        id: Date.now() + i,
        companyName: p.companyName || "Unknown",
        domain: p.domain || "",
        industry: p.industry || "Technology",
        score: Math.min(100, Math.max(0, Number(p.score) || 50)),
        reason: p.reason || "",
        matchedProducts: JSON.stringify(p.matchedProducts || []),
        signals: JSON.stringify(p.signals || []),
        companySize: p.companySize || "mid-market",
        urgency: p.urgency || "medium",
        lastUpdated: new Date().toISOString(),
        status: "new",
        contacts: JSON.stringify(mergedContacts),
        companyPhone: apolloResult.companyPhone || "",
        employeeCount: finalEmployeeCount,
        revenue: finalRevenue,
        techStack: JSON.stringify(finalTechStack),
      };
    });

    return res.json(results);
  } catch (err: any) {
    console.error("Prospect scan error:", err);
    return res.status(500).json({ error: err.message || "Failed to scan prospects" });
  }
}
