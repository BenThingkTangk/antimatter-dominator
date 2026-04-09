import type { VercelRequest, VercelResponse } from "@vercel/node";

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const PDL_API_KEY = process.env.PDL_API_KEY;

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
// Uses POST /v1/mixed_people/search which is the real Apollo API endpoint

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

    // Keywords filter
    if (filters.keywords) {
      searchBody.q_keywords = filters.keywords;
    }

    // Exclude known companies
    if (filters.excludeCompanies && filters.excludeCompanies.length > 0) {
      searchBody.organization_not_names = filters.excludeCompanies;
    }

    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify(searchBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`Apollo mixed_people/search failed: ${res.status} ${errText}`);
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
      // Fall back to data from the search result itself
      if (!person.first_name && !person.last_name) return null;
      return {
        email: person.email || "",
        firstName: person.first_name || "",
        lastName: person.last_name || "",
        position: person.title || "",
        seniority: person.seniority || "",
        department: person.departments?.[0] || "",
        linkedin: person.linkedin_url || null,
        phone: person.sanitized_phone || null,
        mobilePhone: person.mobile_phone || null,
        city: person.city || null,
        state: person.state || null,
        confidence: 50,
        verification: "unverified",
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
      phone: p.sanitized_phone || null,
      mobilePhone: p.mobile_phone || null,
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
  for (const c of Array.from(byEmail.values()).concat(Array.from(byName.values()))) {
    const key = c.email ? c.email.toLowerCase() : `${c.firstName}_${c.lastName}`.toLowerCase();
    if (!all.has(key)) all.set(key, c);
  }

  return Array.from(all.values()).sort((a, b) => b.confidence - a.confidence);
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
    console.log("[scan] Querying Apollo mixed_people/search with filters:", JSON.stringify({
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
        const [apolloContacts, hunterContacts, pdlData, apolloOrgData] = await Promise.all([
          Promise.all(revealPromises).then((contacts) => contacts.filter(Boolean) as EnrichedContact[]),
          enrichWithHunter(companyName, domain),
          enrichWithPDL(companyName, domain),
          enrichOrgWithApollo(domain),
        ]);

        const mergedContacts = mergeContacts(apolloContacts, hunterContacts);

        // Merge company data — Apollo primary, PDL supplement
        const finalEmployeeCount = apolloOrgData.employeeCount || pdlData.employeeCount || org.apolloOrgData?.estimated_num_employees || 0;
        const finalRevenue = apolloOrgData.revenue || pdlData.revenue || "";
        const finalTechStack = Array.from(new Set(apolloOrgData.techStack.concat(pdlData.techStack))).slice(0, 10);
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

        // Build buying signals from person titles and org data
        const signals: string[] = [];
        for (const person of org.people.slice(0, 3)) {
          const title = (person.title || "").toLowerCase();
          if (title.includes("ai") || title.includes("machine learning") || title.includes("ml")) {
            signals.push("AI/ML initiative in progress");
          }
          if (title.includes("cto") || title.includes("chief technology")) {
            signals.push("CTO-level engagement");
          }
          if (title.includes("vp") || title.includes("director")) {
            signals.push("VP/Director-level decision makers present");
          }
        }
        if (finalEmployeeCount > 200 && finalEmployeeCount < 2000) signals.push("Mid-market growth stage");
        if (pdlData.founded && parseInt(pdlData.founded) >= 2018) signals.push("Recently founded — likely scaling tech");
        // Deduplicate
        const uniqueSignals = Array.from(new Set(signals)).slice(0, 4);

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
