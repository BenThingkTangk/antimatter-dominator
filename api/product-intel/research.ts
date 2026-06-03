import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkEntitlement, recordUsage } from "../_rules/entitlements.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

async function resolveSession(req: VercelRequest): Promise<{ userId: string; tenantId: string } | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies["atom_session"];
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    const s = Array.isArray(rows) ? rows[0] : null;
    return s ? { userId: s.user_id, tenantId: s.tenant_id } : null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Entitlement gate ──
  const session = await resolveSession(req);
  if (!session) return res.status(401).json({ error: "Not authenticated" });
  const ent = await checkEntitlement(session.tenantId, "leadgen");
  if (!ent.allowed) {
    return res.status(402).json({ error: ent.reason, used: ent.used, cap: ent.cap, plan: ent.plan, upgradeUrl: "/#/billing" });
  }

  const { product } = req.body;
  if (!product || typeof product !== "string" || product.trim().length < 2) {
    return res.status(400).json({ error: "product is required (min 2 chars)" });
  }

  const productName = product.trim();
  const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    // Step 1: Try to scrape the product website for real data
    let websiteContent = "";
    let websiteUrl = "";
    const possibleDomains = [
      productName.toLowerCase().replace(/\s+/g, "") + ".com",
      productName.toLowerCase().replace(/\s+/g, "-") + ".com",
      productName.toLowerCase().split(" ")[0] + ".com",
    ];

    // Also check known product mappings
    const knownDomains: Record<string, string> = {
      "akamai": "akamai.com", "akamai cdn": "akamai.com",
      "tierpoint": "tierpoint.com", "tierpoint vmware": "tierpoint.com",
      "five9": "five9.com",
      "cloudflare": "cloudflare.com", "cloudflare cdn": "cloudflare.com",
      "antimatter ai": "antimatterai.com",
      "atom enterprise": "antimatterai.com/enterprise-ai",
      "atom red team": "antimatterai.com/red-team",
      "vidzee": "antimatterai.com/vidzee",
      "clinix": "antimatterai.com/clinix", "clinix agent": "antimatterai.com/clinix",
      "clinix ai": "antimatterai.com/clinix",
      "salesforce": "salesforce.com",
      "hubspot": "hubspot.com",
      "vmware": "vmware.com",
      "broadcom": "broadcom.com",
      "aws": "aws.amazon.com",
      "azure": "azure.microsoft.com",
      "gcp": "cloud.google.com",
      "snowflake": "snowflake.com",
      "databricks": "databricks.com",
      "palo alto": "paloaltonetworks.com",
      "crowdstrike": "crowdstrike.com",
      "zscaler": "zscaler.com",
      "fortinet": "fortinet.com",
    };

    const knownDomain = knownDomains[productName.toLowerCase()];
    if (knownDomain) possibleDomains.unshift(knownDomain);

    for (const domain of possibleDomains) {
      try {
        const url = domain.startsWith("http") ? domain : `https://www.${domain}`;
        const pageRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ATOM-Intel/1.0)" },
          signal: AbortSignal.timeout(5000),
          redirect: "follow",
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
          const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is);
          const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/is);

          // Extract visible text (strip HTML tags, limit to first 3000 chars)
          const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .substring(0, 3000);

          websiteUrl = pageRes.url || url;
          websiteContent = `Website: ${websiteUrl}\nTitle: ${titleMatch?.[1]?.trim() || "N/A"}\nDescription: ${descMatch?.[1]?.trim() || ogDescMatch?.[1]?.trim() || "N/A"}\nContent excerpt: ${textContent.substring(0, 2000)}`;
          break;
        }
      } catch {}
    }

    // Step 2: Use OpenAI to build comprehensive product intelligence
    const prompt = `You are a world-class B2B sales intelligence analyst. Research and build a comprehensive product profile for "${productName}".

${websiteContent ? `Here is data scraped from their website:\n${websiteContent}\n` : "I couldn't access their website, so use your training knowledge."}

Build a detailed product intelligence profile. Return ONLY valid JSON (no markdown):
{
  "slug": "${slug}",
  "name": "${productName}",
  "company": "Parent company name",
  "website": "${websiteUrl || "https://www." + slug + ".com"}",
  "tagline": "One-line description of what they do",
  "description": "2-3 sentence description of the product/service, what it does, and who it's for",
  "keyFeatures": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "targetAudience": "Who buys this product — titles, company types, industries",
  "pricing": "What's known about pricing — enterprise, per-seat, usage-based, etc. Say 'Contact sales' if unknown",
  "competitors": ["competitor1", "competitor2", "competitor3"],
  "differentiators": ["What makes this product unique vs competitors — 3-4 points"],
  "commonObjections": [
    {"objection": "It's too expensive", "counter": "Best counter-argument using real product data"},
    {"objection": "We already have a solution", "counter": "Best displacement argument"},
    {"objection": "Bad timing", "counter": "Best urgency/timing argument"},
    {"objection": "Need to think about it", "counter": "Best follow-up close"}
  ],
  "idealPitch": "The perfect 30-second elevator pitch for this product, written conversationally as if a real SDR would say it on a cold call. Use specific numbers and benefits.",
  "keyStats": ["Stat or proof point 1", "Stat or proof point 2", "Stat or proof point 3"],
  "industryFocus": ["industry1", "industry2", "industry3"],
  "painPoints": ["What pain does this product solve — 3-4 specific problems"],
  "qualifyingQuestions": [
    "Best qualifying question 1 to ask a prospect",
    "Best qualifying question 2",
    "Best qualifying question 3"
  ],
  "callScript": {
    "opener": "Hey [name], this is Adam from [company]. [1 sentence hook]",
    "valueHook": "2-3 sentence value proposition using specific product benefits",
    "qualifyingQuestion": "The single best question to ask to qualify the prospect",
    "closingAsk": "The ask — book a meeting, send info, demo, etc."
  }
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a B2B sales intelligence analyst. Return ONLY valid JSON. No markdown, no code blocks." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const intel = JSON.parse(cleaned);

    // Add metadata
    intel.lastUpdated = Date.now();
    intel.source = websiteContent ? "website + ai" : "ai_only";

    // Record usage (fire-and-forget)
    recordUsage(session.tenantId, "leadgen");

    return res.json(intel);
  } catch (err: any) {
    console.error("Product intel error:", err);
    return res.status(500).json({ error: err.message || "Research failed" });
  }
}
