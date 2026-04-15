import type { VercelRequest, VercelResponse } from "@vercel/node";
import twilio from "twilio";

const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Voice: Polly.Matthew-Neural = warm American male, closest to ATOM on antimatterai.com
const VOICE = "Polly.Matthew-Neural";

const PRODUCT_HOOKS: Record<string, { hook: string; value: string; ask: string }> = {
  "antimatter-ai": {
    hook: "we build AI systems and digital products for companies, kind of end to end",
    value: "We've done over twenty projects now, haven't had a single unhappy client yet. We handle everything, the design, the engineering, the AI, even the go to market piece.",
    ask: "What's your team working on at the moment? I'd love to see if there's something we could help with.",
  },
  "atom-enterprise": {
    hook: "we help companies deploy AI agents inside their own environment. So whether that's on prem, VPC, or out at the edge",
    value: "The big thing with us is you own everything. Your IP, your data, no one trains on it. And you can swap model providers whenever you want without rewriting a line of code. We've got an edge partnership with Akamai as well, which is brilliant for latency.",
    ask: "How are you handling AI deployment and data governance at the moment? That's usually where we see the biggest gaps.",
  },
  "vidzee": {
    hook: "we've built this tool that takes listing photos and turns them into proper cinematic property videos in about five minutes flat",
    value: "Agents are saving a couple hundred bucks per listing compared to hiring a videographer. We've done over twelve thousand videos already. Works across Reels, TikTok, YouTube, MLS, all of it.",
    ask: "Are you using video for your listings right now, or is it something you've been meaning to get into?",
  },
  "clinix-agent": {
    hook: "we help healthcare organizations recover revenue that's been lost to denied claims. We automate the whole appeals and resubmission process",
    value: "We actually stop denials before they happen with eligibility guardrails. And when they do come through, we auto generate the appeal packets tailored to each payer. Best part is, it's success based pricing. You only pay when we actually get the money back.",
    ask: "What's your denial rate looking like these days? That's usually the first thing we dig into.",
  },
  "clinix-ai": {
    hook: "we automate clinical documentation and coding for healthcare providers",
    value: "Providers we work with are saving two to three hours a day on paperwork. The AI pulls ICD ten, CPT, and DSM five codes straight from the clinical notes, and it plugs right into whatever EHR you're running.",
    ask: "How much time are your providers spending on documentation outside of patient hours? That's the pain point we hear about most.",
  },
  "red-team-atom": {
    hook: "we've built the first quantum ready red team platform, fully autonomous",
    value: "So instead of doing a pen test once a year and hoping for the best, we run continuous adversarial simulations. Post quantum crypto, MITRE ATLAS heat mapping, real time telemetry across your entire stack.",
    ask: "How are you thinking about quantum readiness? A lot of teams are starting to take the harvest now decrypt later threat quite seriously.",
  },
};

function buildTwiML(contactName: string, companyName: string, productSlug: string): string {
  const product = PRODUCT_HOOKS[productSlug] || PRODUCT_HOOKS["antimatter-ai"];
  const firstName = contactName.split(" ")[0] || "there";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOICE}">Hey ${firstName}, <break time="250ms"/> it's ATOM from Antimatter AI. <break time="400ms"/> Hope I'm not catching you at a bad time?</Say>
  <Pause length="3"/>
  <Say voice="${VOICE}">Cool. So, <break time="200ms"/> quick reason for the call. <break time="250ms"/> I came across ${companyName} <break time="150ms"/> and, <break time="100ms"/> ${product.hook}. <break time="300ms"/> Thought there might be a really good fit here.</Say>
  <Pause length="3"/>
  <Say voice="${VOICE}">${product.value}</Say>
  <Pause length="2"/>
  <Say voice="${VOICE}">${product.ask}</Say>
  <Pause length="4"/>
  <Say voice="${VOICE}">Look I know you're busy, <break time="200ms"/> so I won't keep you. <break time="250ms"/> Would it make sense to grab fifteen minutes later this week? <break time="200ms"/> I can walk you through exactly how this'd work for ${companyName}.</Say>
  <Pause length="4"/>
  <Say voice="${VOICE}">Alright, <break time="200ms"/> well I really appreciate your time ${firstName}. <break time="250ms"/> I'll shoot you a quick email with the details and a link to book a call. <break time="400ms"/> Have a great rest of your day.</Say>
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

    if (!phoneNumber) return res.status(400).json({ error: "phoneNumber is required" });

    let cleanNumber = phoneNumber.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

    // Route through ATOM Voice Bridge (Linode + Hume EVI) for real conversational AI calls
    const BRIDGE_URL = "https://45-79-202-76.sslip.io";

    const bridgeRes = await fetch(`${BRIDGE_URL}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: cleanNumber,
        firstName: (contactName || "there").split(" ")[0],
        companyName: companyName || "your company",
        product: productSlug || "antimatter-ai",
      }),
    });

    const call = await bridgeRes.json();

    if (!bridgeRes.ok) {
      return res.status(bridgeRes.status).json(call);
    }

    res.json({
      success: true,
      callSid: call.callSid,
      status: "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      message: `ATOM calling ${contactName || cleanNumber} at ${companyName || "target company"}`,
    });
  } catch (err: any) {
    console.error("Twilio call error:", err);
    res.status(500).json({ error: err.message || "Failed to initiate call", code: err.code });
  }
}
