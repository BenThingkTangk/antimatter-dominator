import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";

const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

const PRODUCT_HOOKS: Record<string, { hook: string; value: string; ask: string }> = {
  "antimatter-ai": {
    hook: "we build AI systems and digital products for companies",
    value: "We've shipped over twenty projects with a hundred percent client satisfaction. We do everything from product design to AI development to go-to-market, all under one roof.",
    ask: "I'd love to understand what your team's working on right now, and see if there's a way we could help speed things up.",
  },
  "atom-enterprise": {
    hook: "we help companies deploy AI agents in their own environment, whether that's on-prem, VPC, or edge",
    value: "What makes us different is full IP ownership, zero-training guarantees, and you can swap model providers without touching your code. We've also got an edge partnership with Akamai.",
    ask: "I'm curious, how are you guys handling AI deployment and data governance right now?",
  },
  "vidzee": {
    hook: "we've built something that turns listing photos into cinematic property videos in about five minutes",
    value: "Agents are saving two to five hundred bucks per listing versus hiring a videographer. We've already created over twelve thousand videos. Works for Reels, TikTok, YouTube, MLS, all of it.",
    ask: "Are you currently using video for your listings, or is that something you've been thinking about?",
  },
  "clinix-agent": {
    hook: "we help healthcare organizations recover lost revenue by automating denial appeals and resubmissions",
    value: "We stop denials before they happen with eligibility guardrails. And when they do happen, we auto-generate appeal packets tailored to each payer. Plus it's success-based pricing, so you only pay when we actually recover money.",
    ask: "What does your denial rate look like right now?",
  },
  "clinix-ai": {
    hook: "we automate clinical documentation and coding for healthcare providers",
    value: "Providers are saving two to three hours a day on documentation. The AI generates ICD-10, CPT, and DSM-5 codes directly from clinical notes, and it plugs right into your EHR.",
    ask: "How much time are your providers spending on documentation after hours?",
  },
  "red-team-atom": {
    hook: "we've built the first quantum-ready autonomous red team platform",
    value: "Instead of annual pen tests, we run continuous adversarial simulations with post-quantum cryptography and MITRE ATLAS heatmapping. Real-time AI and quantum attack telemetry across your whole stack.",
    ask: "How are you guys thinking about post-quantum readiness right now?",
  },
};

function buildTwiML(contactName: string, companyName: string, productSlug: string): string {
  const product = PRODUCT_HOOKS[productSlug] || PRODUCT_HOOKS["antimatter-ai"];
  const firstName = contactName.split(" ")[0] || "there";

  // Clean TwiML - NO <speak> or <prosody> tags inside <Say>
  // Twilio handles SSML wrapping automatically for Polly Neural voices
  // Use <break> tags directly inside <Say> for natural pauses
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">Hey ${firstName}, <break time="200ms"/> this is Alex from Antimatter AI. <break time="300ms"/> Hope I'm not catching you at a bad time?</Say>
  <Pause length="3"/>
  <Say voice="Polly.Matthew-Neural">Yeah so, <break time="150ms"/> quick reason for the call. <break time="200ms"/> I came across ${companyName} and, <break time="100ms"/> ${product.hook}. <break time="200ms"/> Thought there might be a really good fit here.</Say>
  <Pause length="2"/>
  <Say voice="Polly.Matthew-Neural">${product.value}</Say>
  <Pause length="2"/>
  <Say voice="Polly.Matthew-Neural">${product.ask}</Say>
  <Pause length="4"/>
  <Say voice="Polly.Matthew-Neural">I know you're busy so I'll keep it quick. <break time="200ms"/> Would it make sense to set up a fifteen minute call later this week? <break time="200ms"/> I can show you exactly how this works for a company like ${companyName}.</Say>
  <Pause length="4"/>
  <Say voice="Polly.Matthew-Neural">Alright, <break time="150ms"/> well I appreciate your time ${firstName}. <break time="200ms"/> I'll shoot you a quick email with some details and a link to book time if that works. <break time="300ms"/> Have a great rest of your day.</Say>
</Response>`;
}

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

  try {
    const { phoneNumber, contactName, companyName, productSlug } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "phoneNumber is required" });
    }

    let cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) {
      cleanNumber = "+1" + cleanNumber;
    }

    const client = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
      accountSid: TWILIO_ACCOUNT_SID,
    });

    const twiml = buildTwiML(
      contactName || "there",
      companyName || "your company",
      productSlug || "antimatter-ai"
    );

    const call = await client.calls.create({
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      twiml,
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
