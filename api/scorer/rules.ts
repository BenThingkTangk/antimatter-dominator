import type { VercelRequest, VercelResponse } from "@vercel/node";
import rules from "../_lib/scoring-rules.json";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = String(req.headers.authorization || "");
  if (!process.env.DTOM_API_KEY || !auth.includes(process.env.DTOM_API_KEY)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.status(200).json(rules);
}
