/**
 * Shared Apollo helper — one implementation, used by every API route that
 * benefits from real-time firmographic + person enrichment.
 *
 * Inlined into each consumer (Vercel nft tracing is unreliable for sibling
 * imports). Each consumer copies these functions or imports from here when
 * the build proves it can resolve the import. We export both shapes.
 *
 * The upgraded master key (May 2026) unlocks:
 *   - Organization enrichment (firmographics, tech stack, funding)
 *   - People search + match (verified emails, mobile, title, seniority)
 *   - Job postings (hiring signals)
 *   - News + funding events (timeline)
 *
 * Every call has a 3.5s AbortSignal timeout so the voice path never blocks
 * on a cold Apollo response. A failed Apollo call returns null and the
 * caller must degrade gracefully.
 */

const APOLLO_KEY = (process.env.APOLLO_API_KEY || "").replace(/\\n/g, "").trim();
const APOLLO_BASE = "https://api.apollo.io/api/v1";

// ──────────────────────────────────────────────────────────────────────────
// Org enrichment — firmographics, tech stack, funding
// ──────────────────────────────────────────────────────────────────────────
export interface ApolloOrg {
  name?: string;
  domain?: string;
  industry?: string;
  description?: string;
  employeeCount?: number;
  revenue?: string;        // e.g. "$5.1B"
  founded?: number;
  hqCity?: string;
  hqState?: string;
  hqCountry?: string;
  linkedinUrl?: string;
  techStack?: string[];
  fundingRounds?: { type: string; amount: number; date: string }[];
  fundingTotal?: number;
  publiclyTraded?: boolean;
}

export async function apolloOrg(domain: string): Promise<ApolloOrg | null> {
  if (!APOLLO_KEY || !domain) return null;
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!cleaned) return null;
  try {
    const res = await fetch(
      `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(cleaned)}`,
      { headers: { "X-Api-Key": APOLLO_KEY }, signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const org = data?.organization;
    if (!org) return null;
    return {
      name: org.name,
      domain: org.primary_domain || cleaned,
      industry: org.industry,
      description: org.short_description || org.long_description,
      employeeCount: org.estimated_num_employees,
      revenue: org.organization_revenue_printed || org.annual_revenue_printed,
      founded: org.founded_year,
      hqCity: org.city,
      hqState: org.state,
      hqCountry: org.country,
      linkedinUrl: org.linkedin_url,
      techStack: Array.isArray(org.technology_names) ? org.technology_names.slice(0, 24) : [],
      fundingRounds: Array.isArray(org.funding_events) ? org.funding_events.map((f: any) => ({
        type: f.type || f.funding_type || "round",
        amount: f.amount || 0,
        date: f.date || f.announced_date || "",
      })) : [],
      fundingTotal: org.total_funding,
      publiclyTraded: org.publicly_traded_symbol ? true : false,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Person match — find verified contact by name + company
// ──────────────────────────────────────────────────────────────────────────
export interface ApolloPerson {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  seniority?: string;
  department?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  isDecisionMaker?: boolean;
  changedJobs?: { previousCompany: string; previousTitle: string; daysSinceChange: number } | null;
}

export async function apolloPerson(input: {
  firstName?: string; lastName?: string; name?: string; domain?: string; email?: string;
}): Promise<ApolloPerson | null> {
  if (!APOLLO_KEY) return null;
  const params: any = {};
  if (input.firstName) params.first_name = input.firstName;
  if (input.lastName)  params.last_name  = input.lastName;
  if (input.name && !input.firstName && !input.lastName) {
    const parts = input.name.trim().split(/\s+/);
    if (parts[0]) params.first_name = parts[0];
    if (parts.length > 1) params.last_name = parts.slice(1).join(" ");
  }
  if (input.domain) params.domain = input.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (input.email)  params.email  = input.email;
  if (Object.keys(params).length === 0) return null;
  try {
    const res = await fetch(`${APOLLO_BASE}/people/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
      body: JSON.stringify({ ...params, reveal_personal_emails: false, reveal_phone_number: false }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.person;
    if (!p) return null;
    const seniority = (p.seniority || "").toLowerCase();
    const decisionTitles = ["c_suite", "founder", "vp", "head", "director", "owner", "partner", "principal"];
    return {
      name: p.name,
      firstName: p.first_name,
      lastName: p.last_name,
      title: p.title,
      seniority: p.seniority,
      department: p.departments?.[0],
      email: p.email,
      phone: p.phone_numbers?.[0]?.sanitized_number,
      linkedinUrl: p.linkedin_url,
      city: p.city,
      state: p.state,
      country: p.country,
      isDecisionMaker: decisionTitles.some((d) => seniority.includes(d) || (p.title || "").toLowerCase().includes(d)),
      changedJobs: p.previous_employment ? {
        previousCompany: p.previous_employment[0]?.organization_name || "",
        previousTitle:   p.previous_employment[0]?.title || "",
        daysSinceChange: p.previous_employment[0]?.end_date
          ? Math.round((Date.now() - new Date(p.previous_employment[0].end_date).getTime()) / 86400000)
          : 999,
      } : null,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Hiring signals — open job postings count + recent senior hires
// ──────────────────────────────────────────────────────────────────────────
export interface ApolloHiring {
  openRoles: number;
  recentExecHires: { name: string; title: string; date: string }[];
  hiringTrend: "expanding" | "steady" | "contracting" | "unknown";
}

export async function apolloHiring(domain: string): Promise<ApolloHiring | null> {
  if (!APOLLO_KEY || !domain) return null;
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  try {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
      body: JSON.stringify({
        q_organization_domains: cleaned,
        person_seniorities: ["c_suite", "vp", "head", "director"],
        page: 1, per_page: 10,
      }),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const people: any[] = data?.people || [];
    // Approximate "recent hires" as people whose previous employment ended <120 days ago
    const recent = people
      .filter((p) => p.previous_employment?.[0]?.end_date)
      .map((p) => {
        const end = new Date(p.previous_employment[0].end_date).getTime();
        const days = Math.round((Date.now() - end) / 86400000);
        return { name: p.name, title: p.title, date: p.previous_employment[0].end_date, days };
      })
      .filter((p) => p.days < 180)
      .slice(0, 4);
    return {
      openRoles: data?.pagination?.total_entries || people.length,
      recentExecHires: recent,
      hiringTrend: recent.length >= 3 ? "expanding" : recent.length >= 1 ? "steady" : "unknown",
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Synthesizer — single string blob suitable for an LLM system prompt
// ──────────────────────────────────────────────────────────────────────────
export function apolloBriefString(org: ApolloOrg | null, person: ApolloPerson | null, hiring: ApolloHiring | null): string {
  const lines: string[] = [];
  if (org) {
    lines.push(`Company: ${org.name || "?"} (${org.domain})`);
    if (org.industry) lines.push(`Industry: ${org.industry}`);
    if (org.employeeCount) lines.push(`Headcount: ${org.employeeCount.toLocaleString()}`);
    if (org.revenue) lines.push(`Revenue: ${org.revenue}`);
    if (org.founded) lines.push(`Founded: ${org.founded}`);
    if (org.hqCity || org.hqCountry) lines.push(`HQ: ${[org.hqCity, org.hqState, org.hqCountry].filter(Boolean).join(", ")}`);
    if (org.techStack?.length) lines.push(`Tech stack: ${org.techStack.slice(0, 12).join(", ")}`);
    if (org.fundingRounds?.length) {
      const last = org.fundingRounds[0];
      lines.push(`Latest funding: ${last.type} \$${(last.amount / 1_000_000).toFixed(1)}M (${last.date})`);
    }
  }
  if (person) {
    lines.push("");
    lines.push(`Contact: ${person.name || `${person.firstName} ${person.lastName}`}`);
    if (person.title) lines.push(`Title: ${person.title}`);
    if (person.department) lines.push(`Dept: ${person.department}`);
    if (person.isDecisionMaker) lines.push(`Decision-maker: yes`);
    if (person.changedJobs && person.changedJobs.daysSinceChange < 120) {
      lines.push(`Recently changed jobs (${person.changedJobs.daysSinceChange}d ago) from ${person.changedJobs.previousTitle} @ ${person.changedJobs.previousCompany}`);
    }
  }
  if (hiring && (hiring.recentExecHires.length || hiring.hiringTrend !== "unknown")) {
    lines.push("");
    lines.push(`Hiring signal: ${hiring.hiringTrend}`);
    if (hiring.recentExecHires.length) {
      lines.push(`Recent senior hires: ${hiring.recentExecHires.map((h) => `${h.name} (${h.title})`).join("; ")}`);
    }
  }
  return lines.join("\n");
}
