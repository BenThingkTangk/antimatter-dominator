import type { VercelRequest, VercelResponse } from "@vercel/node";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({ status: "ok", version: "gold-standard-v2", timestamp: new Date().toISOString() });
}
// Gold Standard v2.0 — 2026-04-09T14:04:09Z
