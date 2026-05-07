/**
 * ATOM Campaign — Personalized Email Draft Generator
 * 
 * Takes a target's role, company signals, and matched product,
 * generates a personalized cold email using GPT-4o-mini.
 * Returns the draft subject + body for sending via Outlook.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
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


interface EmailRequest {
  contactName: string;
  title: string;
  companyName: string;
  domain?: string;
  industry?: string;
  buyingSignals?: string[];
  painPoints?: string[];
  techStack?: string[];
  recentNews?: string[];
  matchedProduct?: string;
  brief?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const data: EmailRequest = req.body || {};
  if (!data.contactName || !data.companyName) {
    return res.status(400).json({ error: "Missing: contactName and companyName" });
  }

  const firstName = data.contactName.split(" ")[0];
  const signals = (data.buyingSignals || []).slice(0, 3).join("; ");
  const pains = (data.painPoints || []).slice(0, 2).join("; ");
  const news = (data.recentNews || []).slice(0, 2).join("; ");
  const tech = (data.techStack || []).slice(0, 5).join(", ");

  const productDescriptions: Record<string, string> = {
    "antimatter-ai": "Antimatter AI — full-service AI development, product design, and go-to-market strategy",
    "atom-enterprise": "ATOM Enterprise — deploy AI agents in your VPC, on-prem, or at the edge with full IP ownership",
    "vidzee": "Vidzee — transform listing photos into cinematic property videos in 5 minutes",
    "clinix-agent": "Clinix Agent — AI-powered billing denial appeals with success-based pricing",
    "clinix-ai": "Clinix AI — AI clinical documentation and ICD-10/CPT coding, saving providers 2-3 hours daily",
    "red-team-atom": "Red Team ATOM — quantum-ready autonomous red teaming with MITRE ATLAS mapping",
  };

  const product = productDescriptions[data.matchedProduct || "antimatter-ai"] || "Antimatter AI solutions";

  // Live Apollo enrichment — refresh firmographics + person context for THIS campaign send.
  const lastNameC = data.contactName.split(" ").slice(1).join(" ");
  const apolloCtx = await apolloBrief({ domain: data.domain, companyName: data.companyName, firstName, lastName: lastNameC });

  const prompt = `Write a personalized cold email from Adam at Antimatter AI to ${data.contactName}, ${data.title} at ${data.companyName}.

CONTEXT:${apolloCtx ? `\n${apolloCtx}\n` : ""}
- Product to pitch: ${product}
- Industry: ${data.industry || "Technology"}
${signals ? `- Buying signals: ${signals}` : ""}
${pains ? `- Pain points: ${pains}` : ""}
${news ? `- Recent news: ${news}` : ""}
${tech ? `- Their tech stack: ${tech}` : ""}
${data.brief ? `- Campaign brief: ${data.brief}` : ""}

RULES:
- Subject line: 5-8 words, no spam triggers, personalized to their company
- Body: 4-6 sentences max. Sound like a real human, not a template.
- Reference something SPECIFIC about their company (from the signals/news/tech stack above)
- One clear value proposition tied to their role (${data.title})
- End with a soft CTA: suggest a 15-minute call, not a hard sell
- Sign off as: Adam | Antimatter AI | atom@antimatterai.com
- Use contractions. Be warm. No corporate jargon.
- NO "I hope this email finds you well" or any generic opener

Return JSON only: {"subject": "...", "body": "..."}`;

  try {
    // Try SambaNova first (faster), fall back to OpenAI
    let result: { subject: string; body: string } | null = null;

    if (SAMBANOVA_API_KEY) {
      try {
        const sambaRes = await fetch("https://api.sambanova.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${SAMBANOVA_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "Meta-Llama-3.3-70B-Instruct",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.4,
            stream: false,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (sambaRes.ok) {
          const d = await sambaRes.json();
          const raw = d.choices?.[0]?.message?.content || "";
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) result = JSON.parse(match[0]);
        }
      } catch {}
    }

    if (!result && OPENAI_API_KEY) {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (gptRes.ok) {
        const d = await gptRes.json();
        result = JSON.parse(d.choices[0].message.content);
      }
    }

    if (!result) {
      return res.status(500).json({ error: "Failed to generate email" });
    }

    return res.json({
      subject: result.subject,
      body: result.body,
      to: data.contactName,
      company: data.companyName,
      product: data.matchedProduct || "antimatter-ai",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
