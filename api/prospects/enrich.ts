import type { VercelRequest, VercelResponse } from "@vercel/node";

const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!HUNTER_API_KEY) return res.status(500).json({ error: "Hunter API key not configured" });

  try {
    const { companyName, domain } = req.body;
    if (!companyName && !domain) return res.status(400).json({ error: "companyName or domain required" });

    const searchParam = domain ? `domain=${encodeURIComponent(domain)}` : `company=${encodeURIComponent(companyName)}`;
    const url = `https://api.hunter.io/v2/domain-search?${searchParam}&limit=10&seniority=executive,senior&type=personal&required_field=full_name&api_key=${HUNTER_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Hunter API: ${errText}` });
    }

    const data = await response.json();
    const hunterData = data.data;

    const contacts = (hunterData?.emails || []).map((e: any) => ({
      email: e.value || "",
      firstName: e.first_name || "",
      lastName: e.last_name || "",
      position: e.position || "",
      seniority: e.seniority || "",
      department: e.department || "",
      linkedin: e.linkedin || null,
      phone: e.phone_number || null,
      confidence: e.confidence || 0,
      verification: e.verification?.status || "unknown",
    }));

    res.json({
      organization: hunterData?.organization || companyName,
      domain: hunterData?.domain || domain || "",
      pattern: hunterData?.pattern || null,
      totalEmails: hunterData?.emails?.length || 0,
      contacts,
    });
  } catch (err: any) {
    console.error("Enrich error:", err);
    res.status(500).json({ error: err.message || "Failed to enrich" });
  }
}
