import type { VercelRequest, VercelResponse } from "@vercel/node";
import { scoreAccount, type Evidence } from "./_engine";
import { extractEvidence } from "./evidence";
import { getRagContext } from "./context";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (process.env.SCORER_ENABLED !== "true") {
    return res.status(503).json({ error: "scorer disabled. set SCORER_ENABLED=true" });
  }
  const auth = String(req.headers.authorization || "");
  if (!process.env.DTOM_API_KEY || !auth.includes(process.env.DTOM_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { company_name, website, segment, evidence: manual, tenant_id } = (req.body ?? {}) as any;
  if (!company_name || !website) {
    return res.status(400).json({ error: "company_name + website required" });
  }

  try {
    const evidence: Evidence = manual
      ? manual
      : await extractEvidence(company_name, website, segment ?? "enterprise_saas");

    const context = await getRagContext(company_name, segment ?? "enterprise_saas");
    const result = scoreAccount(evidence);

    let record_id: string | null = null;
    try {
      const { data } = await supabase
        .from("scorer_results")
        .insert({
          tenant_id: tenant_id ?? null,
          company_name,
          website,
          segment,
          score: result.score,
          tier: result.tier,
          rules_version: result.rules_version,
          evidence,
          context,
          explanation: result.explanation,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      record_id = (data as any)?.id ?? null;
    } catch (e) {
      console.error("supabase insert", e);
    }

    return res.status(200).json({
      company: company_name,
      score: result.score,
      tier: result.tier,
      next_action: result.next_action,
      rules_version: result.rules_version,
      explanation: result.explanation,
      evidence,
      context,
      record_id
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
