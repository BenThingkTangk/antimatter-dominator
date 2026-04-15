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

  const prompt = `Write a personalized cold email from Adam at Antimatter AI to ${data.contactName}, ${data.title} at ${data.companyName}.

CONTEXT:
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
