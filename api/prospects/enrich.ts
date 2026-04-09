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

interface CompanyData {
  name: string;
  domain: string;
  employeeCount: number;
  revenue: string;
  industry: string;
  description: string;
  founded: string;
  location: string;
  techStack: string[];
  phone: string;
  linkedinUrl: string;
  twitter: string;
}

// ─── Apollo.io — org enrich + people search + reveal ────────────────────────

async function apolloEnrich(
  companyName: string,
  domain?: string
): Promise<{ contacts: EnrichedContact[]; companyData: Partial<CompanyData> }> {
  if (!APOLLO_API_KEY) return { contacts: [], companyData: {} };

  let companyData: Partial<CompanyData> = {};
  const contacts: EnrichedContact[] = [];
  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";

  try {
    // Step 1: Organization enrichment
    if (cleanDomain) {
      const orgRes = await fetch(
        `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanDomain)}`,
        { headers: { "X-Api-Key": APOLLO_API_KEY } }
      );
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const org = orgData.organization || {};
        companyData = {
          name: org.name || companyName,
          domain: org.primary_domain || cleanDomain,
          employeeCount: org.estimated_num_employees || 0,
          revenue: org.annual_revenue_printed || "",
          industry: org.industry || "",
          description: org.short_description || "",
          founded: org.founded_year ? String(org.founded_year) : "",
          location: [org.city, org.state, org.country].filter(Boolean).join(", "),
          techStack: org.technology_names || [],
          phone: org.phone || "",
          linkedinUrl: org.linkedin_url || "",
          twitter: org.twitter_url || "",
        };
      }
    }

    // Step 2: Search for decision makers
    const searchBody: any = {
      person_seniorities: ["vp", "director", "c_suite", "owner", "founder", "partner", "head", "manager"],
      page: 1,
      per_page: 15,
    };

    if (cleanDomain) {
      searchBody.q_organization_domains = cleanDomain;
    } else {
      searchBody.q_organization_name = companyName;
    }

    const peopleRes = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify(searchBody),
    });

    if (peopleRes.ok) {
      const peopleData = await peopleRes.json();
      const rawPeople = peopleData.people || [];

      // Reveal all found people (parallel, up to 15)
      const companyPhone = companyData.phone || "";
      const revealPromises = rawPeople.slice(0, 15).map(async (rp: any) => {
        if (!rp.id) return null;
        try {
          const revealRes = await fetch("https://api.apollo.io/api/v1/people/match", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
            body: JSON.stringify({
              id: rp.id,
              reveal_personal_emails: true,
              reveal_phone_number: true,
            }),
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
    console.error(`Apollo enrich failed for ${companyName}:`, err);
  }

  return { contacts, companyData };
}

// ─── Hunter.io — domain search ───────────────────────────────────────────────

async function hunterEnrich(
  companyName: string,
  domain?: string
): Promise<{ contacts: EnrichedContact[]; emailPattern: string; domainData: Partial<CompanyData> }> {
  if (!HUNTER_API_KEY) return { contacts: [], emailPattern: "", domainData: {} };

  try {
    const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
    const searchParam = cleanDomain
      ? `domain=${encodeURIComponent(cleanDomain)}`
      : `company=${encodeURIComponent(companyName)}`;
    const url = `https://api.hunter.io/v2/domain-search?${searchParam}&limit=20&seniority=executive,senior&required_field=full_name&api_key=${HUNTER_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return { contacts: [], emailPattern: "", domainData: {} };

    const data = await response.json();
    const hunterData = data.data;

    const contacts: EnrichedContact[] = (hunterData?.emails || []).map((e: any) => ({
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

    const domainData: Partial<CompanyData> = {
      name: hunterData?.organization || companyName,
      domain: hunterData?.domain || cleanDomain,
      description: hunterData?.description || "",
      techStack: hunterData?.technologies || [],
      twitter: hunterData?.twitter || "",
      location: hunterData?.country || "",
    };

    return { contacts, emailPattern: hunterData?.pattern || "", domainData };
  } catch {
    return { contacts: [], emailPattern: "", domainData: {} };
  }
}

// ─── PDL — company + people enrichment ──────────────────────────────────────

async function pdlEnrich(
  companyName: string,
  domain?: string
): Promise<{ contacts: EnrichedContact[]; companyData: Partial<CompanyData> }> {
  if (!PDL_API_KEY) return { contacts: [], companyData: {} };

  const cleanDomain = domain ? domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "";
  let companyData: Partial<CompanyData> = {};

  try {
    // Company enrichment
    const params = new URLSearchParams({ api_key: PDL_API_KEY, pretty: "true" });
    if (cleanDomain) params.set("website", cleanDomain);
    else params.set("name", companyName);

    const companyRes = await fetch(
      `https://api.peopledatalabs.com/v5/company/enrich?${params.toString()}`
    );

    if (companyRes.ok) {
      const d = await companyRes.json();
      companyData = {
        name: d.display_name || d.name || companyName,
        domain: d.website || cleanDomain,
        employeeCount: d.employee_count || d.size || 0,
        revenue: d.annual_revenue ? `$${(d.annual_revenue / 1_000_000).toFixed(0)}M` : "",
        industry: d.industry || "",
        description: d.summary || "",
        founded: d.founded ? String(d.founded) : "",
        location: [d.location?.locality, d.location?.region, d.location?.country].filter(Boolean).join(", "),
        techStack: d.technology_names || [],
        linkedinUrl: d.linkedin_url || "",
        twitter: d.twitter_url || "",
      };
    }

    // PDL people search for contacts at this company
    const peopleBody: any = {
      sql: `SELECT * FROM person WHERE job_company_name='${companyName.replace(/'/g, "\\'")}' AND job_title_levels IN ('cxo','vp','director','owner','partner') LIMIT 10`,
      size: 10,
    };
    if (cleanDomain) {
      peopleBody.sql = `SELECT * FROM person WHERE job_company_website='${cleanDomain}' AND job_title_levels IN ('cxo','vp','director','owner','partner') LIMIT 10`;
    }

    const peopleRes = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": PDL_API_KEY },
      body: JSON.stringify(peopleBody),
    });

    const contacts: EnrichedContact[] = [];
    if (peopleRes.ok) {
      const peopleData = await peopleRes.json();
      const people = peopleData.data || [];
      for (const p of people) {
        contacts.push({
          email: p.work_email || p.personal_emails?.[0] || "",
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          position: p.job_title || "",
          seniority: p.job_title_levels?.[0] || "",
          department: p.job_title_role || "",
          linkedin: p.linkedin_url || null,
          phone: p.phone_numbers?.[0] || null,
          mobilePhone: p.mobile_phone || null,
          city: p.location_locality || null,
          state: p.location_region || null,
          confidence: 80,
          verification: p.work_email ? "valid" : "unverified",
          source: "pdl",
        });
      }
    }

    return { contacts, companyData };
  } catch {
    return { contacts: [], companyData: {} };
  }
}

// ─── Merge contacts from all sources ────────────────────────────────────────

function mergeAllContacts(
  apollo: EnrichedContact[],
  hunter: EnrichedContact[],
  pdl: EnrichedContact[]
): EnrichedContact[] {
  const byEmail = new Map<string, EnrichedContact>();
  const byName = new Map<string, EnrichedContact>();

  const mergeInto = (existing: EnrichedContact, incoming: EnrichedContact) => {
    if (!existing.email && incoming.email) existing.email = incoming.email;
    if (!existing.phone && incoming.phone) existing.phone = incoming.phone;
    if (!existing.mobilePhone && incoming.mobilePhone) existing.mobilePhone = incoming.mobilePhone;
    if (!existing.linkedin && incoming.linkedin) existing.linkedin = incoming.linkedin;
    if (!existing.position && incoming.position) existing.position = incoming.position;
    if (!existing.city && incoming.city) existing.city = incoming.city;
    if (!existing.state && incoming.state) existing.state = incoming.state;
    if (existing.source !== incoming.source) existing.source = "both";
  };

  const addContact = (c: EnrichedContact) => {
    const emailKey = c.email?.toLowerCase();
    const nameKey = `${c.firstName}_${c.lastName}`.toLowerCase();

    if (emailKey && byEmail.has(emailKey)) {
      mergeInto(byEmail.get(emailKey)!, c);
      return;
    }
    if (nameKey && nameKey !== "_" && byName.has(nameKey)) {
      mergeInto(byName.get(nameKey)!, c);
      return;
    }

    // New contact
    if (emailKey) byEmail.set(emailKey, c);
    if (nameKey && nameKey !== "_") byName.set(nameKey, c);
  };

  // Apollo is primary (highest confidence)
  for (const c of apollo) addContact(c);
  for (const c of pdl) addContact(c);
  for (const c of hunter) addContact(c);

  const all = new Map<string, EnrichedContact>();
  for (const c of [...byEmail.values(), ...byName.values()]) {
    const key = c.email ? c.email.toLowerCase() : `${c.firstName}_${c.lastName}`.toLowerCase();
    if (!all.has(key)) all.set(key, c);
  }

  return [...all.values()]
    .filter((c) => c.firstName || c.lastName) // must have at least a name
    .sort((a, b) => b.confidence - a.confidence);
}

// ─── Merge company data from all sources ────────────────────────────────────

function mergeCompanyData(
  apollo: Partial<CompanyData>,
  hunter: Partial<CompanyData>,
  pdl: Partial<CompanyData>
): Partial<CompanyData> {
  return {
    name: apollo.name || pdl.name || hunter.name || "",
    domain: apollo.domain || pdl.domain || hunter.domain || "",
    employeeCount: apollo.employeeCount || pdl.employeeCount || 0,
    revenue: apollo.revenue || pdl.revenue || "",
    industry: apollo.industry || pdl.industry || "",
    description: apollo.description || pdl.description || hunter.description || "",
    founded: apollo.founded || pdl.founded || "",
    location: apollo.location || pdl.location || hunter.location || "",
    techStack: [...new Set([
      ...(apollo.techStack || []),
      ...(pdl.techStack || []),
      ...(hunter.techStack || []),
    ])].slice(0, 15),
    phone: apollo.phone || "",
    linkedinUrl: apollo.linkedinUrl || pdl.linkedinUrl || "",
    twitter: pdl.twitter || hunter.twitter || "",
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { companyName, domain } = req.body;
    if (!companyName && !domain) {
      return res.status(400).json({ error: "companyName or domain required" });
    }

    const name = companyName || "";
    const dom = domain || "";

    // Run all three enrichments in parallel
    const [apolloResult, hunterResult, pdlResult] = await Promise.all([
      apolloEnrich(name, dom),
      hunterEnrich(name, dom),
      pdlEnrich(name, dom),
    ]);

    const contacts = mergeAllContacts(
      apolloResult.contacts,
      hunterResult.contacts,
      pdlResult.contacts
    );

    const company = mergeCompanyData(
      apolloResult.companyData,
      hunterResult.domainData,
      pdlResult.companyData
    );

    return res.json({
      company,
      contacts,
      emailPattern: hunterResult.emailPattern || null,
      totalContacts: contacts.length,
      sources: {
        apollo: apolloResult.contacts.length,
        hunter: hunterResult.contacts.length,
        pdl: pdlResult.contacts.length,
      },
    });
  } catch (err: any) {
    console.error("Enrich error:", err);
    return res.status(500).json({ error: err.message || "Failed to enrich" });
  }
}
