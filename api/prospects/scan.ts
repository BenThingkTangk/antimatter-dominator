import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

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

// ─── Apollo.io Enrichment (Primary) ─────────────────────────────────────────
async function enrichWithApollo(
  companyName: string,
  domain?: string
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

// ─── Main Handler ───────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry, productFocus } = req.body;

    // Step 1: AI generates prospect companies with domains
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are a B2B prospect research AI. Return ONLY a valid JSON array. No markdown, no code blocks. Raw JSON only.",
      messages: [{
        role: "user",
        content: `Generate 5 real prospect companies${industry && industry !== "All Industries" ? ` in ${industry}` : ""}${productFocus && productFocus !== "all" ? ` for ${productFocus}` : " for Antimatter AI ecosystem (AI dev, enterprise AI deployment, real estate video, healthcare billing, clinical documentation, quantum security)"}. JSON array: [{"companyName":"string","domain":"company-website.com","industry":"string","score":0-100,"reason":"1 sentence why they need us","matchedProducts":["slug"],"signals":["signal"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]. Use slugs: antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom. IMPORTANT: Include the company's real website domain (e.g. "unitedhealth.com", "jpmorgan.com"). Return ONLY JSON.`,
      }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
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
        enrichWithApollo(company, domain),
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
