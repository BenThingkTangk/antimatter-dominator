/**
 * Twilio StatusCallback receiver — fires when a call completes.
 * Persists final status + duration into atom_calls so the history list
 * reflects accurate call state even if the browser closed mid-call.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function readForm(req: VercelRequest): Promise<Record<string, string>> {
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const form = await readForm(req);
  const callSid     = form.CallSid     || "";
  const callStatus  = form.CallStatus  || "";
  const duration    = Number(form.CallDuration || 0) || 0;

  if (!callSid) return res.status(200).send("ok");

  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const patch: any = {
        status: callStatus || "completed",
      };
      if (duration > 0) patch.duration_s = duration;
      if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
        patch.ended_at = new Date().toISOString();
      }
      await fetch(
        `${SUPABASE_URL}/rest/v1/atom_calls?call_sid=eq.${encodeURIComponent(callSid)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(patch),
        }
      );
    }
  } catch (err: any) {
    console.error("call-status error:", err);
  }

  return res.status(200).send("ok");
}
