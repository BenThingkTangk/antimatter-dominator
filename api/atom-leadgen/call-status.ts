import type { VercelRequest, VercelResponse } from "@vercel/node";

// Twilio call status webhook — receives updates as call progresses
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      CallSid,
      CallStatus,
      To,
      From,
      Duration,
      CallDuration,
      Timestamp,
    } = req.body;

    console.log(`[ATOM Call Status] SID: ${CallSid} | Status: ${CallStatus} | To: ${To} | Duration: ${Duration || CallDuration || 0}s`);

    // In a production setup, you'd store this in a database and push 
    // updates to the frontend via WebSocket or SSE
    // For now, we just acknowledge the webhook
    res.status(200).json({
      received: true,
      callSid: CallSid,
      status: CallStatus,
      duration: Duration || CallDuration || 0,
    });
  } catch (err: any) {
    console.error("Call status webhook error:", err);
    res.status(500).json({ error: err.message });
  }
}
