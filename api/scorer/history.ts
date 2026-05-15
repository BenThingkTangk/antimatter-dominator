import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = String(req.headers.authorization || "");
  if (!process.env.DTOM_API_KEY || !auth.includes(process.env.DTOM_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const company = String(req.query.company || "");
  const tenant_id = req.query.tenant_id ? String(req.query.tenant_id) : null;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    let q = supabase
      .from("scorer_results")
      .select("id, company_name, website, segment, score, tier, rules_version, explanation, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (company) q = q.eq("company_name", company);
    if (tenant_id) q = q.eq("tenant_id", tenant_id);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ results: data ?? [] });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
