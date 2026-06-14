import type { VercelRequest, VercelResponse } from "@vercel/node";

const PPLX_URL = "https://api.perplexity.ai/chat/completions";

const SCHEMA_PROMPT = `Return ONLY valid JSON with this schema:
{
  "latency_score": 1-5,
  "security_score": 1-5,
  "gpu_score": 1-5,
  "egress_score": 1-5,
  "multicloud_score": 1-5,
  "trigger_score": 1-5,
  "latency_evidence": "",
  "security_evidence": "",
  "gpu_evidence": "",
  "egress_evidence": "",
  "multicloud_evidence": "",
  "trigger_evidence": ""
}

Scoring rules:
- latency: 5=real-time voice/fraud/AI, 4=global interactive, 3=user-facing API, 2=internal, 1=batch
- security: 5=regulated+public API+bot/fraud risk, 4=two of three, 3=one of three, 2=minor, 1=internal-only
- gpu: 5=core inference product, 4=heavy RAG/LLM, 3=regular AI, 2=light AI, 1=none
- egress: 5=media/files/global traffic, 4=heavy API/model responses, 3=moderate, 2=low, 1=minimal
- multicloud: 5=explicit mandate, 4=K8s+Terraform+portability, 3=some signals, 2=minor, 1=locked-in
- trigger: 5=active migration/compliance/outage, 4=AI launch/funding <6mo, 3=hiring, 2=older, 1=none`;

export async function extractEvidence(company: string, website: string, segment: string) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY missing");
  const r = await fetch(PPLX_URL, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [{ role: "user", content: "Analyze " + company + " (" + website + "), segment: " + segment + ".\n" + SCHEMA_PROMPT }],
      response_format: { type: "json_object" }
    })
  });
  if (!r.ok) throw new Error("perplexity " + r.status);
  const j: any = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const auth = String(req.headers.authorization || "");
  if (!process.env.DTOM_API_KEY || !auth.includes(process.env.DTOM_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { company_name, website, segment } = (req.body ?? {}) as any;
  if (!company_name || !website) return res.status(400).json({ error: "company_name + website required" });
  try {
    const evidence = await extractEvidence(company_name, website, segment ?? "enterprise_saas");
    return res.status(200).json({ evidence });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
