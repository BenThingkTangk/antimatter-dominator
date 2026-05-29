/**
 * ATOM Lead Gen — voice agent auth token
 *
 * Returns a short-lived accessToken the client can use to open the voice
 * agent WebSocket. Fail-closed: only authenticated tenants get a token,
 * and we ONLY return an OAuth client-credentials access_token. We never
 * expose the long-lived API key to a browser, even if OAuth fails — the
 * caller will see a 503 and the UI degrades to a safe banner.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const HUME_API_KEY    = clean(process.env.HUME_API_KEY);
const HUME_SECRET_KEY = clean(process.env.HUME_SECRET_KEY);
const SUPABASE_URL    = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}

async function resolveSession(req: VercelRequest): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const token = parseCookies(req.headers.cookie)["atom_session"];
  if (!token) return false;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1) Require an authenticated tenant session — never hand a voice token
  //    to an anonymous browser. This is what the launch doc flagged as a
  //    P0: short-lived, session-scoped tokens only.
  const ok = await resolveSession(req);
  if (!ok) {
    return res.status(401).json({ error: "unauthorized" });
  }

  // 2) Require both halves of the OAuth client credentials. If either is
  //    missing we 503 and let the UI degrade to a "voice standby" banner.
  //    We do NOT fall back to exposing the API key to the browser.
  if (!HUME_API_KEY || !HUME_SECRET_KEY) {
    return res.status(503).json({ error: "voice agent unavailable" });
  }

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
    if (!tokenRes.ok) {
      return res.status(503).json({ error: "voice agent unavailable" });
    }
    const data: any = await tokenRes.json();
    return res.status(200).json({
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      authType: "accessToken",
    });
  } catch {
    return res.status(503).json({ error: "voice agent unavailable" });
  }
}
