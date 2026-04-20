import type { VercelRequest, VercelResponse } from "@vercel/node";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const PDL_API_KEY = process.env.PDL_API_KEY;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY;
const BUILTWITH_API_KEY = process.env.BUILTWITH_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

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
  source: string; // "apollo" | "pdl" | "theirstack" | "both"
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

// ─── Employee size → Apollo num_employees range string ───────────────────────

function employeeSizeToApolloRangeStr(size: string | undefined): string | null {
  if (!size || size === "any") return null;
  const map: Record<string, string> = {
    "1-10": "1,10",
    "11-50": "11,50",
    "51-200": "51,200",
    "201-500": "201,500",
    "501-1000": "501,1000",
    "1001-5000": "1001,5000",
    "5001-10000": "5001,10000",
    "10001+": "10001,9999999",
  };
  return map[size] || null;
}

// ─── Industry → Apollo keyword tags ──────────────────────────────────────────

function industryToApolloTags(industry: string | undefined): string[] {
  if (!industry || industry === "All Industries") return [];
  // Apollo accepts partial keyword tags — just pass the industry string lowercased
  return [industry.toLowerCase()];
}

// ─── Apollo primary search — returns people + their organizations ─────────────
// Uses POST /v1/mixed_people/api_search (new endpoint — old /search is deprecated)

async function searchApolloProspects(
  filters: ScanFilters,
  geoFilters: { personLocations?: string[]; organizationLocations?: string[] },
  employeeSizeRangeStr: string | null,
  perPage: number = 25
): Promise<any[]> {
  if (!APOLLO_API_KEY) return [];

  try {
    const seniorityCriteria = ["vp", "director", "c_suite", "owner", "founder", "partner", "head", "manager"];

    const searchBody: Record<string, any> = {
      person_seniorities: seniorityCriteria,
      page: 1,
      per_page: perPage,
    };

    // Geography filters
    if (geoFilters.organizationLocations?.length) {
      searchBody.organization_locations = geoFilters.organizationLocations;
    }
    if (geoFilters.personLocations?.length) {
      searchBody.person_locations = geoFilters.personLocations;
    }

    // Job title filter
    if (filters.jobTitles && filters.jobTitles.length > 0) {
      searchBody.person_titles = filters.jobTitles;
    }

    // Employee size filter
    if (employeeSizeRangeStr) {
      searchBody.organization_num_employees_ranges = [employeeSizeRangeStr];
    }

    // Industry filter via keyword tags
    const industryTags = industryToApolloTags(filters.industry);
    if (industryTags.length > 0) {
      searchBody.q_organization_keyword_tags = industryTags;
    }

    // Keywords filter — only use short keywords (Apollo q_keywords is very literal)
    // Long phrases return 0 results, so extract just key terms
    if (filters.keywords) {
      const kw = filters.keywords.trim();
      // If keywords look like a brief/sentence (>40 chars or has common words), skip
      // Apollo works best with company names or single technology terms
      if (kw.length <= 40 && !kw.includes(" for ") && !kw.includes(" and ") && !kw.includes(" to ")) {
        searchBody.q_keywords = kw;
      }
      // Otherwise, try to extract a tech/company name from the keywords
      // e.g. "Cloudflare CDN takeout" → just skip, let industry + titles do the work
    }

    // Exclude known companies
    if (filters.excludeCompanies && filters.excludeCompanies.length > 0) {
      searchBody.organization_not_names = filters.excludeCompanies;
    }

    const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Apollo mixed_people/api_search failed: ${res.status} ${errText}`);
      return [];
    }

    const data = await res.json();
    return data.people || [];
  } catch (err) {
    console.error("Apollo search error:", err);
    return [];
  }
}

// ─── Apollo people/match — reveal full contact details ────────────────────────

async function revealApolloContact(person: any): Promise<EnrichedContact | null> {
  if (!APOLLO_API_KEY) return null;

  try {
    const matchPayload: Record<string, any> = {
      reveal_personal_emails: true,
      reveal_phone_number: true,
    };

    if (person.id) {
      matchPayload.id = person.id;
    } else {
      // Fall back to name + org match
      if (person.first_name) matchPayload.first_name = person.first_name;
      if (person.last_name) matchPayload.last_name = person.last_name;
      if (person.organization_name) matchPayload.organization_name = person.organization_name;
    }

    const revealRes = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify(matchPayload),
    });

    if (!revealRes.ok) {
      console.log(`[scan] Apollo people/match failed ${revealRes.status} for ${person.first_name} ${person.last_name} — using raw search data`);
      // Fall back to data from the search result itself
      // Apollo mixed_people/api_search often includes partial contact data
      if (!person.first_name && !person.last_name) return null;
      return {
        email: person.email || person.personal_emails?.[0] || "",
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        position: person.title || person.headline || "",
        seniority: person.seniority || "",
        department: person.departments?.[0] || "",
        linkedin: person.linkedin_url || null,
        phone: person.sanitized_phone || person.phone_numbers?.[0]?.sanitized_number || null,
        mobilePhone: person.mobile_phone || person.phone_numbers?.[0]?.raw_number || null,
        city: person.city || person.organization?.city || null,
        state: person.state || person.organization?.state || null,
        confidence: person.email ? 70 : 50,
        verification: person.email_status || "unverified",
        source: "apollo",
      };
    }

    const revealData = await revealRes.json();
    const p = revealData.person;
    if (!p || (!p.first_name && !p.last_name)) return null;

    return {
      email: p.email || "",
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      position: p.title || person.title || "",
      seniority: p.seniority || person.seniority || "",
      department: p.departments?.[0] || "",
      linkedin: p.linkedin_url || null,
      phone: p.sanitized_phone || p.phone_numbers?.[0]?.sanitized_number || p.organization?.phone || null,
      mobilePhone: p.mobile_phone || p.phone_numbers?.[0]?.raw_number || p.direct_phone || null,
      city: p.city || null,
      state: p.state || null,
      confidence: 95,
      verification: p.email_status || "verified",
      source: "apollo",
    };
  } catch (err) {
    // Fall back to raw search data
    if (!person.first_name && !person.last_name) return null;
    return {
      email: person.email || "",
      firstName: person.first_name || "",
      lastName: person.last_name || "",
      position: person.title || "",
      seniority: person.seniority || "",
      department: "",
      linkedin: null,
      phone: null,
      mobilePhone: null,
      city: null,
      state: null,
      confidence: 40,
      verification: "unverified",
      source: "apollo",
    };
  }
}

// ─── Apollo org enrichment — get company data from a domain ─────────────────

async function enrichOrgWithApollo(domain: string): Promise<{
  companyPhone: string;
  employeeCount: number;
  revenue: string;
  techStack: string[];
}> {
  if (!APOLLO_API_KEY || !domain) return { companyPhone: "", employeeCount: 0, revenue: "", techStack: [] };

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const orgRes = await fetch(
      `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanDomain)}`,
      { headers: { "x-api-key": APOLLO_API_KEY } }
    );
    if (!orgRes.ok) return { companyPhone: "", employeeCount: 0, revenue: "", techStack: [] };
    const orgData = await orgRes.json();
    const org = orgData.organization || {};
    return {
      companyPhone: org.phone || "",
      employeeCount: org.estimated_num_employees || 0,
      revenue: org.annual_revenue_printed || "",
      techStack: org.technology_names || [],
    };
  } catch {
    return { companyPhone: "", employeeCount: 0, revenue: "", techStack: [] };
  }
}

// ─── Perplexity Sonar: real-time web intel per company ──────────────────

async function getCompanyWebIntel(
  companyName: string,
  domain?: string,
  productFocus?: string
): Promise<{ buyingSignals: string[]; recentNews: string[]; painPoints: string[]; competitorIntel: string; score: number }> {
  if (!PERPLEXITY_API_KEY) return { buyingSignals: [], recentNews: [], painPoints: [], competitorIntel: "", score: 0 };
  try {
    const query = `For the company ${companyName}${domain ? ` (${domain})` : ""}, in 3-4 concise bullet points each, tell me:\n1. Recent buying signals (new hires, funding, tech migrations, growth indicators)\n2. Latest company news (last 3 months)\n3. Key pain points or challenges they face${productFocus ? ` especially around ${productFocus}` : ""}\n4. One sentence on their competitive position\nBe specific and factual. No fluff.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: query }],
        stream: false,
        web_search_options: { search_context_size: "low" },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { buyingSignals: [], recentNews: [], painPoints: [], competitorIntel: "", score: 0 };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the structured response into arrays
    const sections = content.split(/\n\d+\./)
    const buyingSignals = extractBullets(sections[1] || "");
    const recentNews = extractBullets(sections[2] || "");
    const painPoints = extractBullets(sections[3] || "");
    const competitorIntel = (sections[4] || "").trim();

    // Score based on signal strength
    let score = 0;
    const lower = content.toLowerCase();
    if (lower.includes("funding") || lower.includes("raised")) score += 15;
    if (lower.includes("hiring") || lower.includes("new hire") || lower.includes("job posting")) score += 10;
    if (lower.includes("migration") || lower.includes("switching") || lower.includes("replacing")) score += 20;
    if (lower.includes("growth") || lower.includes("expanding") || lower.includes("scaling")) score += 10;
    if (lower.includes("pain") || lower.includes("challenge") || lower.includes("struggle")) score += 10;
    if (lower.includes("ai") || lower.includes("automation") || lower.includes("digital transformation")) score += 15;

    return { buyingSignals, recentNews, painPoints, competitorIntel, score: Math.min(50, score) };
  } catch {
    return { buyingSignals: [], recentNews: [], painPoints: [], competitorIntel: "", score: 0 };
  }
}

function extractBullets(text: string): string[] {
  return text.split(/\n[-•*]\s*/)
    .map(s => s.replace(/^[-•*]\s*/, "").trim())
    .filter(s => s.length > 10 && s.length < 300)
    .slice(0, 4);
}

// ─── Hunter.io: discover emails by domain ─────────────────────────────────

async function hunterDomainSearch(
  domain?: string
): Promise<EnrichedContact[]> {
  if (!HUNTER_API_KEY || !domain) return [];
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${HUNTER_API_KEY}&limit=10&type=personal`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const emails = data.data?.emails || [];
    return emails.map((e: any) => ({
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
      confidence: e.confidence || 70,
      verification: e.verification?.status || "unverified",
      source: "hunter",
    }));
  } catch { return []; }
}

// ─── Hunter.io: email-finder with phone data for specific contacts ──────────

async function hunterPhoneLookup(email: string, firstName?: string, lastName?: string, domain?: string): Promise<string | null> {
  if (!HUNTER_API_KEY || !email) return null;
  try {
    const params = new URLSearchParams({ api_key: HUNTER_API_KEY, email });
    if (firstName) params.set("first_name", firstName);
    if (lastName) params.set("last_name", lastName);
    if (domain) params.set("domain", domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.phone_number || null;
  } catch { return null; }
}

// ─── TheirStack: find companies by actual technology used ───────────────────

async function enrichTechWithTheirStack(
  domain?: string,
  techKeywords?: string
): Promise<string[]> {
  if (!THEIRSTACK_API_KEY || !domain) return [];
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const res = await fetch(`https://api.theirstack.com/v1/companies/lookup?domain=${encodeURIComponent(cleanDomain)}`, {
      headers: { Authorization: `Bearer ${THEIRSTACK_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.technologies || []).map((t: any) => t.name || t).slice(0, 15);
  } catch { return []; }
}

// ─── BuiltWith: tech stack verification per company ─────────────────────────

async function verifyTechWithBuiltWith(
  domain?: string
): Promise<string[]> {
  if (!BUILTWITH_API_KEY || !domain) return [];
  try {
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const res = await fetch(`https://api.builtwith.com/free1/api.json?KEY=${BUILTWITH_API_KEY}&LOOKUP=${encodeURIComponent(cleanDomain)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const groups = data.groups || data.Results?.[0]?.Result?.Paths?.[0]?.Technologies || [];
    if (Array.isArray(groups)) {
      return groups.map((g: any) => g.Name || g.name || g).filter(Boolean).slice(0, 10);
    }
    return [];
  } catch { return []; }
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

// ─── Deduplicate contacts ───────────────────────────────────────────────────

async function deduplicateContacts(contacts: EnrichedContact[]): Promise<EnrichedContact[]> {
  const byEmail = new Map<string, EnrichedContact>();
  const byName = new Map<string, EnrichedContact>();

  for (const c of contacts) {
    const emailKey = c.email?.toLowerCase();
    const nameKey = `${c.firstName}_${c.lastName}`.toLowerCase();

    if (emailKey && byEmail.has(emailKey)) {
      const existing = byEmail.get(emailKey)!;
      if (!existing.phone && c.phone) existing.phone = c.phone;
      if (!existing.linkedin && c.linkedin) existing.linkedin = c.linkedin;
      if (!existing.position && c.position) existing.position = c.position;
      existing.source = "both";
    } else if (nameKey !== "_" && byName.has(nameKey)) {
      const existing = byName.get(nameKey)!;
      if (!existing.email && c.email) existing.email = c.email;
      if (!existing.phone && c.phone) existing.phone = c.phone;
      if (!existing.linkedin && c.linkedin) existing.linkedin = c.linkedin;
      existing.source = "both";
    } else {
      if (emailKey) byEmail.set(emailKey, c);
      else if (nameKey !== "_") byName.set(nameKey, c);
    }
  }

  const all = new Map<string, EnrichedContact>();
  for (const c of Array.from(byEmail.values()).concat(Array.from(byName.values()))) {
    const key = c.email ? c.email.toLowerCase() : `${c.firstName}_${c.lastName}`.toLowerCase();
    if (!all.has(key)) all.set(key, c);
  }

  const dedupedContacts = Array.from(all.values()).sort((a, b) => b.confidence - a.confidence);

  // Phone fallback: for contacts without phone, try Hunter.io email-finder
  const noPhoneContacts = dedupedContacts.filter(c => !c.phone && c.email);
  if (noPhoneContacts.length > 0 && HUNTER_API_KEY) {
    const phoneLookups = noPhoneContacts.slice(0, 5).map(async (c) => {
      try {
        const phone = await hunterPhoneLookup(c.email, c.firstName, c.lastName);
        if (phone) c.phone = phone;
      } catch {}
    });
    await Promise.allSettled(phoneLookups);
  }

  return dedupedContacts;
}

// ─── Group Apollo people by organization ─────────────────────────────────────

interface ApolloOrg {
  companyName: string;
  domain: string;
  industry: string;
  companySize: string;
  people: any[];
  location: string;
  apolloOrgData: any;
}

function groupPeopleByOrg(people: any[]): ApolloOrg[] {
  const orgMap = new Map<string, ApolloOrg>();

  for (const person of people) {
    const org = person.organization || person.employment_history?.[0] || {};
    const orgName = org.name || person.organization_name || "";
    if (!orgName) continue;

    const domain = (org.website_url || org.domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const key = domain || orgName.toLowerCase().replace(/\s+/g, "-");

    if (!orgMap.has(key)) {
      const empCount = org.estimated_num_employees || 0;
      let companySize = "mid-market";
      if (empCount >= 5000) companySize = "enterprise";
      else if (empCount <= 200) companySize = "smb";

      // Build location from person or org data
      const location = [
        org.city || person.city,
        org.state || person.state,
        org.country || person.country,
      ].filter(Boolean).join(", ");

      orgMap.set(key, {
        companyName: orgName,
        domain,
        industry: org.industry || person.organization_industry || "",
        companySize,
        people: [],
        location,
        apolloOrgData: org,
      });
    }

    orgMap.get(key)!.people.push(person);
  }

  return Array.from(orgMap.values());
}

// ─── Scoring heuristic for Apollo-sourced companies ──────────────────────────

function scoreCompany(org: ApolloOrg, filters: ScanFilters): number {
  let score = 50;

  // More senior contacts = higher score
  const seniorityWeights: Record<string, number> = {
    c_suite: 15, vp: 12, director: 10, head: 8, owner: 12, founder: 12, partner: 10, manager: 5,
  };
  for (const person of org.people) {
    const s = (person.seniority || "").toLowerCase();
    score += seniorityWeights[s] || 0;
  }

  // Industry match
  if (filters.industry && filters.industry !== "All Industries") {
    const orgIndustry = (org.industry || "").toLowerCase();
    const filterIndustry = filters.industry.toLowerCase();
    if (orgIndustry.includes(filterIndustry) || filterIndustry.includes(orgIndustry)) {
      score += 15;
    }
  }

  // Cap at 97
  return Math.min(97, score);
}

// ─── Build reason text from Apollo data ──────────────────────────────────────

function buildReason(org: ApolloOrg, filters: ScanFilters): string {
  const parts: string[] = [];

  if (org.people.length > 0) {
    const topPerson = org.people[0];
    const title = topPerson.title || topPerson.headline || "";
    if (title) {
      parts.push(`Has ${title} in their organization`);
    }
  }

  if (filters.productFocus) {
    parts.push(`identified as a strong fit for ${filters.productFocus}`);
  } else if (org.industry) {
    parts.push(`operates in the ${org.industry} sector`);
  }

  if (filters.jobTitles && filters.jobTitles.length > 0) {
    parts.push(`with direct access to target decision-maker roles`);
  }

  return parts.length > 0
    ? parts.join(", ") + "."
    : `Real company sourced directly from Apollo's database matching your search criteria.`;
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
    const employeeSizeRangeStr = employeeSizeToApolloRangeStr(filters.employeeSize);

    // ── STEP 1: Query Apollo's real search API as PRIMARY source ─────────────
    console.log("[scan] Querying Apollo mixed_people/api_search with filters:", JSON.stringify({
      geo: filters.geo,
      industry: filters.industry,
      employeeSize: filters.employeeSize,
      jobTitles: filters.jobTitles,
      keywords: filters.keywords,
    }));

    const apolloPeople = await searchApolloProspects(filters, geoFilters, employeeSizeRangeStr, 25);
    console.log(`[scan] Apollo returned ${apolloPeople.length} people`);

    // ── STEP 2: Group people by organization to get distinct companies ────────
    const orgs = groupPeopleByOrg(apolloPeople);
    console.log(`[scan] Grouped into ${orgs.length} organizations`);

    // Filter out excluded companies
    const excludeSet = new Set((filters.excludeCompanies || []).map((c) => c.toLowerCase()));
    const filteredOrgs = orgs.filter((o) => !excludeSet.has(o.companyName.toLowerCase()));

    // Score and sort, take top 8
    const scoredOrgs = filteredOrgs
      .map((o) => ({ org: o, score: scoreCompany(o, filters) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // ── STEP 3: For each org, reveal contacts + enrich with Hunter & PDL ──────
    const results = await Promise.all(
      scoredOrgs.map(async ({ org, score }, i) => {
        const domain = org.domain;
        const companyName = org.companyName;

        // Reveal Apollo contacts (up to 5 per company to conserve credits)
        const revealPromises = org.people.slice(0, 5).map((person) => revealApolloContact(person));
        const [apolloContacts, hunterContacts, pdlData, apolloOrgData, theirStackTech, builtWithTech, webIntel] = await Promise.all([
          Promise.all(revealPromises).then((contacts) => contacts.filter(Boolean) as EnrichedContact[]),
          hunterDomainSearch(domain),
          enrichWithPDL(companyName, domain),
          enrichOrgWithApollo(domain),
          enrichTechWithTheirStack(domain, filters.techStack),
          verifyTechWithBuiltWith(domain),
          getCompanyWebIntel(companyName, domain, filters.productFocus),
        ]);

        // Merge contacts: Apollo revealed + Hunter discovered, then deduplicate
        const mergedContacts = await deduplicateContacts([...apolloContacts, ...hunterContacts]);

        // Merge company data — Apollo primary, PDL supplement
        const finalEmployeeCount = apolloOrgData.employeeCount || pdlData.employeeCount || org.apolloOrgData?.estimated_num_employees || 0;
        const finalRevenue = apolloOrgData.revenue || pdlData.revenue || "";
        // Merge tech stacks from all sources: Apollo + PDL + TheirStack + BuiltWith
        const finalTechStack = Array.from(new Set([
          ...apolloOrgData.techStack,
          ...pdlData.techStack,
          ...theirStackTech,
          ...builtWithTech,
        ])).slice(0, 15);
        const finalIndustry = org.industry || pdlData.industry || "Technology";

        // Determine company size label
        const empCount = finalEmployeeCount;
        let companySize = org.companySize;
        if (empCount >= 5000) companySize = "enterprise";
        else if (empCount >= 201) companySize = "mid-market";
        else if (empCount > 0) companySize = "smb";

        // Determine urgency from score
        let urgency: "critical" | "high" | "medium" | "low" = "medium";
        if (score >= 85) urgency = "critical";
        else if (score >= 70) urgency = "high";
        else if (score < 40) urgency = "low";

        // Build matched products based on industry
        const matchedProducts: string[] = [];
        if (filters.productFocus) {
          matchedProducts.push(filters.productFocus.toLowerCase().replace(/\s+/g, "-"));
        } else {
          const industry = finalIndustry.toLowerCase();
          if (industry.includes("health") || industry.includes("medical")) {
            matchedProducts.push("clinix-agent", "clinix-ai");
          } else if (industry.includes("real estate") || industry.includes("property")) {
            matchedProducts.push("vidzee");
          } else if (industry.includes("cyber") || industry.includes("security")) {
            matchedProducts.push("red-team-atom");
          } else {
            matchedProducts.push("atom-enterprise", "antimatter-ai");
          }
        }

        // Build buying signals: Perplexity web intel (real-time) + heuristic title signals
        const signals: string[] = [];
        // Perplexity real-time signals (web-grounded, not AI-guessed)
        if (webIntel.buyingSignals.length > 0) {
          signals.push(...webIntel.buyingSignals);
        }
        // Supplement with title-based heuristics
        for (const person of org.people.slice(0, 3)) {
          const title = (person.title || "").toLowerCase();
          if (title.includes("ai") || title.includes("machine learning")) signals.push("AI/ML initiative detected");
          if (title.includes("cto") || title.includes("chief technology")) signals.push("CTO-level engagement");
        }
        if (finalEmployeeCount > 200 && finalEmployeeCount < 2000) signals.push("Mid-market growth stage");
        const uniqueSignals = Array.from(new Set(signals)).slice(0, 6);

        // Boost score with Perplexity's web-grounded intel score
        score = Math.min(100, score + webIntel.score);

        return {
          id: Date.now() + i,
          companyName,
          domain: domain || "",
          industry: finalIndustry,
          score: Math.min(100, Math.max(0, score)),
          reason: buildReason(org, filters),
          matchedProducts: JSON.stringify(matchedProducts),
          signals: JSON.stringify(uniqueSignals),
          companySize,
          urgency,
          lastUpdated: new Date().toISOString(),
          status: "new",
          contacts: JSON.stringify(mergedContacts),
          companyPhone: apolloOrgData.companyPhone || "",
          employeeCount: finalEmployeeCount,
          revenue: finalRevenue,
          techStack: JSON.stringify(finalTechStack),
          // Perplexity web-grounded intel
          recentNews: JSON.stringify(webIntel.recentNews),
          painPoints: JSON.stringify(webIntel.painPoints),
          competitorIntel: webIntel.competitorIntel,
          webIntelScore: webIntel.score,
        };
      })
    );

    console.log(`[scan] Returning ${results.length} real Apollo prospects`);
    return res.json(results);
  } catch (err: any) {
    console.error("Prospect scan error:", err);
    return res.status(500).json({ error: err.message || "Failed to scan prospects" });
  }
}

// v3.0 — Apollo-first real search (no GPT hallucination) 2026-04-09
