/**
 * ATOM Lead Gen — Direct Hume EVI Twilio Integration (No Bridge)
 * 
 * Gold-standard architecture:
 *   Twilio → Hume EVI 4 (SambaCloud) directly via /v0/evi/twilio webhook
 *   NO Linode bridge. NO mulaw transcoding. NO WebSocket relay.
 *   Pure native Hume audio processing for maximum human-like quality.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";

const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const HUME_API_KEY = process.env.HUME_API_KEY;

// ATOM Sales Agent config — updated with Steve Jobs voice + ADAM prompt
const HUME_CONFIG_ID = "42271e30-8773-43bd-81e5-c411e6aa990a";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_ACCOUNT_SID || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({
      error: "Twilio not fully configured",
      missing: {
        TWILIO_ACCOUNT_SID: !TWILIO_ACCOUNT_SID,
        TWILIO_API_KEY_SID: !TWILIO_API_KEY_SID,
        TWILIO_API_KEY_SECRET: !TWILIO_API_KEY_SECRET,
        TWILIO_PHONE_NUMBER: !TWILIO_PHONE_NUMBER,
      }
    });
  }

  if (!HUME_API_KEY) {
    return res.status(500).json({ error: "HUME_API_KEY not configured" });
  }

  try {
    const { phoneNumber, contactName, companyName, productSlug, firstName, product } = req.body;
    const phone = phoneNumber || req.body.to;

    if (!phone) return res.status(400).json({ error: "phoneNumber is required" });

    let cleanNumber = phone.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

    // Direct Hume EVI webhook — Twilio connects to Hume natively
    // NO bridge server. NO mulaw transcoding. Pure native audio.
    const humeWebhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${HUME_CONFIG_ID}&api_key=${HUME_API_KEY}`;

    const twilioClient = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, { accountSid: TWILIO_ACCOUNT_SID });

    const call = await twilioClient.calls.create({
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      url: humeWebhookUrl,
    });

    // Start recording after call connects
    setTimeout(async () => {
      try {
        await twilioClient.calls(call.sid).recordings.create({
          recordingChannels: "dual",
          trim: "do-not-trim",
        });
      } catch (recErr: any) {
        console.log(`[${call.sid}] Recording start failed (non-fatal): ${recErr.message}`);
      }
    }, 8000);

    res.json({
      success: true,
      callSid: call.sid,
      status: "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "direct-hume-evi",
      message: `ADAM calling ${contactName || firstName || cleanNumber} — Direct Hume EVI (no bridge)`,
    });
  } catch (err: any) {
    console.error("Call error:", err);
    res.status(500).json({ error: err.message || "Failed to initiate call", code: err.code });
  }
}
