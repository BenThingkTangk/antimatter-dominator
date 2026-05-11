/**
 * Twilio RecordingStatusCallback receiver.
 *
 * Twilio POSTs application/x-www-form-urlencoded with fields like
 *   CallSid, RecordingSid, RecordingUrl, RecordingDuration,
 *   RecordingStatus (in-progress | completed | failed | absent).
 *
 * We persist the recording URL on the matching atom_calls row so the
 * call-history detail page can stream it back from Twilio.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function readForm(req: VercelRequest): Promise<Record<string, string>> {
  // Vercel may have already parsed it as JSON or x-www-form-urlencoded
  const body: any = req.body;
  if (!body) return {};
  if (typeof body === "object" && !Array.isArray(body)) return body as Record<string, string>;
  if (typeof body === "string") {
    const out: Record<string, string> = {};
    for (const pair of body.split("&")) {
      const [k, v] = pair.split("=");
      if (k) out[decodeURIComponent(k)] = decodeURIComponent((v || "").replace(/\+/g, " "));
    }
    return out;
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS open — Twilio does not need it but local debug does.
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const form = await readForm(req);
  const callSid       = form.CallSid       || "";
  const recordingSid  = form.RecordingSid  || "";
  const recordingUrl  = form.RecordingUrl  || "";
  const recordingDur  = Number(form.RecordingDuration || 0) || 0;
  const recordingStat = form.RecordingStatus || "completed";

  if (!callSid) return res.status(400).json({ error: "missing CallSid" });

  // Twilio's RecordingUrl is bare — needs ".mp3" suffix for HTTP MP3 playback.
  // Twilio also requires basic auth to stream; we proxy this through our own
  // /api/atom-leadgen/recording-stream endpoint so the browser doesn't need
  // the secret.
  const mp3Url = recordingUrl ? `${recordingUrl}.mp3` : "";

  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && callSid) {
      const patch = await fetch(
        `${SUPABASE_URL}/rest/v1/atom_calls?call_sid=eq.${encodeURIComponent(callSid)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            recording_url: mp3Url || null,
            recording_sid: recordingSid || null,
            recording_duration_s: recordingDur || null,
            recording_status: recordingStat,
          }),
        }
      );
      if (!patch.ok) {
        console.error("recording-callback patch failed", patch.status, await patch.text().catch(() => ""));
      }
    }
  } catch (err: any) {
    console.error("recording-callback error:", err);
  }

  // Twilio doesn't care about the body — 200 is enough to ACK.
  return res.status(200).send("ok");
}
