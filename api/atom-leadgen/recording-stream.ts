/**
 * Authenticated proxy for Twilio call recordings.
 *
 * Twilio recording URLs are NOT publicly accessible — they require HTTP
 * Basic Auth with the account credentials. Streaming them directly from
 * the browser would either leak the secret or fail CORS. We proxy the
 * MP3 bytes through Vercel so an <audio src="…/recording-stream?callSid=…">
 * tag just works.
 *
 * Usage: GET /api/atom-leadgen/recording-stream?callSid=<CAxxxx>
 *
 * We resolve the recording via the row in atom_calls (recording_url +
 * recording_sid). If neither is set, we ask Twilio directly using the
 * Recordings API filtered by CallSid as a last-mile fallback.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const TWILIO_ACCOUNT_SID        = clean(process.env.TWILIO_ACCOUNT_SID);
const TWILIO_API_KEY_SID        = clean(process.env.TWILIO_API_KEY_SID);
const TWILIO_API_KEY_SECRET     = clean(process.env.TWILIO_API_KEY_SECRET);
const TWILIO_AUTH_TOKEN         = clean(process.env.TWILIO_AUTH_TOKEN);

function twilioAuthHeader(): string {
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET && TWILIO_API_KEY_SECRET !== "placeholder") {
    return "Basic " + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64");
  }
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function findRecordingUrl(callSid: string): Promise<string | null> {
  // Try Supabase first (fast path).
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/atom_calls?call_sid=eq.${encodeURIComponent(callSid)}&select=recording_url,recording_sid`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      if (r.ok) {
        const rows: any[] = await r.json();
        const row = rows && rows[0];
        if (row?.recording_url) return row.recording_url;
        if (row?.recording_sid) {
          return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${row.recording_sid}.mp3`;
        }
      }
    } catch {}
  }

  // Last-mile fallback: ask Twilio for any recording on this call.
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings.json?CallSid=${encodeURIComponent(callSid)}&PageSize=1`,
      { headers: { Authorization: twilioAuthHeader() } }
    );
    if (r.ok) {
      const data: any = await r.json();
      const rec = data?.recordings?.[0];
      if (rec?.sid) {
        return `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Recordings/${rec.sid}.mp3`;
      }
    }
  } catch {}
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "method" });
  }

  const callSid = String(req.query.callSid || req.query.call_sid || "").trim();
  if (!callSid) return res.status(400).json({ error: "callSid required" });

  const mp3Url = await findRecordingUrl(callSid);
  if (!mp3Url) return res.status(404).json({ error: "no recording" });

  try {
    // Always advertise range support so the browser <audio> element can seek.
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");

    // Forward the browser's Range header upstream to Twilio. Twilio supports
    // partial content on recordings, so we can pipe their 206 right back.
    const range = req.headers.range as string | undefined;
    const upstreamHeaders: Record<string, string> = {
      Authorization: twilioAuthHeader(),
    };
    if (range) upstreamHeaders["Range"] = range;

    const upstream = await fetch(mp3Url, { headers: upstreamHeaders });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status || 502).json({ error: "upstream failed" });
    }
    if (!upstream.body && req.method !== "HEAD") {
      return res.status(502).json({ error: "upstream empty" });
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) res.setHeader("Content-Range", contentRange);

    // 206 if upstream returned partial content, otherwise 200.
    res.status(upstream.status === 206 ? 206 : 200);

    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }

    // Stream bytes through. Vercel Node runtime supports res.write with Buffers.
    const reader = upstream.body.getReader();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: any) {
    console.error("recording-stream error:", err);
    if (!res.headersSent) res.status(500).json({ error: err?.message || "failed" });
    else res.end();
  }
}
