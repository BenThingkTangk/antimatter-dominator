import type { VercelRequest, VercelResponse } from "@vercel/node";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ status: "ok", version: "gold-standard-v2", timestamp: new Date().toISOString() });
}
