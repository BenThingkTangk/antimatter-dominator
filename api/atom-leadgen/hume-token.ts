import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchAccessToken } from "hume";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.HUME_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Hume API key not configured" });

  try {
    const accessToken = await fetchAccessToken({ apiKey });
    if (!accessToken) {
      return res.status(500).json({ error: "Failed to fetch Hume access token" });
    }
    res.json({ accessToken });
  } catch (err: any) {
    console.error("Hume token error:", err);
    res.status(500).json({ error: err.message || "Failed to get Hume token" });
  }
}
