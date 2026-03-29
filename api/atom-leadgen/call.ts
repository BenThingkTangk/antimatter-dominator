import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";

// Twilio credentials
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;    // SK...
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET; // secret
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;    // AC...
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;   // +1...

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Validate config
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

  try {
    const { phoneNumber, contactName, companyName, productSlug } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "phoneNumber is required" });
    }

    // Clean the phone number (ensure E.164 format)
    let cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) {
      cleanNumber = "+1" + cleanNumber; // Default to US
    }

    // Initialize Twilio client with API Key auth
    const client = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
      accountSid: TWILIO_ACCOUNT_SID,
    });

    // Build the TwiML for the call
    // For now, ATOM introduces itself via TTS. 
    // For full Hume integration, this would connect to a WebSocket media stream endpoint.
    const greeting = `Hello ${contactName || "there"}, this is Atom from Antimatter AI. We help companies like ${companyName || "yours"} with cutting edge AI solutions. Do you have a moment to chat about how we can help your team?`;

    // Create the outbound call
    const call = await client.calls.create({
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      twiml: `<Response>
        <Say voice="Polly.Matthew">${greeting}</Say>
        <Pause length="2"/>
        <Say voice="Polly.Matthew">I'd love to schedule a quick 15-minute demo to show you what we've built. Would next week work for you?</Say>
        <Pause length="3"/>
        <Say voice="Polly.Matthew">Great, I'll have our team reach out to confirm. Thank you for your time, and have a wonderful day.</Say>
      </Response>`,
      statusCallback: `https://antimatter-sales-dominator.vercel.app/api/atom-leadgen/call-status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      message: `Call initiated to ${contactName || cleanNumber} at ${companyName || "target company"}`,
    });
  } catch (err: any) {
    console.error("Twilio call error:", err);
    res.status(500).json({
      error: err.message || "Failed to initiate call",
      code: err.code,
    });
  }
}
