/**
 * ATOM Lead Gen — Hume EVI auth token
 *
 * Returns a short-lived accessToken the client can use to open the Hume
 * EVI WebSocket via @humeai/voice-react.
 *
 * If HUME_SECRET_KEY is configured, we run the OAuth client-credentials flow
 * and return a rotating access_token (production-safe). Otherwise we fall
 * back to exposing the raw HUME_API_KEY — the client uses `type: "apiKey"`.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Strip stray whitespace/newlines from env (Vercel env pulls can preserve literal \n)
const HUME_API_KEY = (process.env.HUME_API_KEY || "").replace(/\\n/g, "").trim();
const HUME_SECRET_KEY = (process.env.HUME_SECRET_KEY || "").replace(/\\n/g, "").trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!HUME_API_KEY) {
    return res.status(500).json({ error: "HUME_API_KEY not configured" });
  }

  // Preferred: OAuth2 client-credentials if secret is available
  if (HUME_SECRET_KEY) {
    try {
      const basic = Buffer.from(`${HUME_API_KEY}:${HUME_SECRET_KEY}`).toString("base64");
      const tokenRes = await fetch("https://api.hume.ai/oauth2-cc/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (tokenRes.ok) {
        const data: any = await tokenRes.json();
        return res.status(200).json({
          accessToken: data.access_token,
          tokenType: data.token_type,
          expiresIn: data.expires_in,
          authType: "accessToken",
        });
      }
      // If OAuth failed, fall through to api-key path
    } catch {
      // fall through
    }
  }

  // Fallback: return raw API key; client should pass type: "apiKey"
  return res.status(200).json({
    accessToken: HUME_API_KEY,
    authType: "apiKey",
  });
}
