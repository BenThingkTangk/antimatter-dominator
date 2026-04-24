/**
 * ATOM Lead Gen — DIRECT Twilio → Hume EVI outbound call.
 *
 * Architecture:
 *   1. SINGLE pre-warmed Hume EVI config (no per-call config creation)
 *      → eliminates 2-3 seconds of Hume API latency that was causing the
 *      "long pause after hello" feedback.
 *   2. Prospect context (first_name, company_name, product_name, company_brief)
 *      is passed per call via Hume session variables through the Twilio
 *      webhook URL as query params.
 *   3. Perplexity Sonar runs in parallel while the call is being placed,
 *      building a live research brief about the prospect's company and the
 *      product being pitched. The brief is injected as session context so
 *      ADAM can handle ANY question, objection, or rebuttal about ANY
 *      product or company — like he knows it better than anyone.
 *   4. Twilio dials out with URL pointing at Hume's TwiML webhook, which
 *      wires the media stream directly into EVI.
 *
 * No Linode bridge. No pre-warm greeting race. No hardcoded product knowledge.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Env ──────────────────────────────────────────────────────────────────────
const clean = (v: string | undefined) =>
  (v || "").replace(/\\n/g, "").trim();

const TWILIO_ACCOUNT_SID    = clean(process.env.TWILIO_ACCOUNT_SID);
const TWILIO_API_KEY_SID    = clean(process.env.TWILIO_API_KEY_SID);
const TWILIO_API_KEY_SECRET = clean(process.env.TWILIO_API_KEY_SECRET);
const TWILIO_AUTH_TOKEN     = clean(process.env.TWILIO_AUTH_TOKEN);
const TWILIO_PHONE_NUMBER   = clean(process.env.TWILIO_PHONE_NUMBER);

const HUME_API_KEY          = clean(process.env.HUME_API_KEY);
const PERPLEXITY_API_KEY    = clean(process.env.PERPLEXITY_API_KEY);

// ─── Pre-warmed Hume assets (created once, reused forever) ────────────────────
// Config: ATOM Sales Agent v11 — Stanford voice + RAG + pickup detection
// Prompt has {{first_name}}, {{company_name}}, {{product_name}}, {{company_brief}}
const HUME_CONFIG_ID = "3c6f8a5b-e6f3-4732-9570-36a22f38e147";
// Voice: ATOM Jobs Tenor (expressive tenor, young startup-founder cadence)
const HUME_VOICE_ID  = "e891bda0-d013-4a46-9cbe-360d618b0e58";

// ─── Perplexity Sonar RAG — per-call research brief ───────────────────────────
async function buildCompanyBrief(
  contactName: string,
  companyName: string,
  productName: string
): Promise<string> {
  if (!PERPLEXITY_API_KEY) {
    return `Pitching ${productName} to ${contactName} at ${companyName}. Focus on value, ask discovery questions, handle objections with curiosity.`;
  }

  const briefPrompt = `You are briefing a sales rep for an outbound call. Return ONLY a concise single-paragraph intelligence brief (max 220 words) covering:

1. What does ${companyName} do, and what is ${contactName}'s likely role/pain point?
2. What is ${productName} — core capability, differentiators, pricing model?
3. Why ${companyName} should care about ${productName} (specific angle for this prospect).
4. Top 2 objections ${contactName} is likely to raise and the sharpest rebuttals.
5. One proof point or case study that maps to ${companyName}'s situation.

Tight, factual, no filler. Write as briefing notes, not marketing copy. If you don't have data on a specific entity, infer reasonable context from the industry. Output plain prose only — no bullet lists, no headings, no markdown.`;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You are a precise sales intelligence researcher. Respond with plain-prose briefing notes only." },
          { role: "user",   content: briefPrompt },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
      // hard timeout via AbortSignal — give Sonar ~6s to think
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) {
      console.warn("Perplexity brief failed:", res.status, await res.text().catch(() => ""));
      return `Pitching ${productName} to ${contactName} at ${companyName}. Lead with value, listen more than talk, handle objections with curiosity.`;
    }
    const data: any = await res.json();
    const brief = data?.choices?.[0]?.message?.content?.trim();
    if (brief && brief.length > 40) {
      // Strip any accidental citation markers like [1], [2]
      return brief.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
    }
  } catch (err: any) {
    console.warn("Perplexity brief error:", err?.message || err);
  }

  return `Pitching ${productName} to ${contactName} at ${companyName}. Lead with value, handle objections with curiosity, always redirect to their specific business outcome.`;
}

// ─── Twilio helpers ───────────────────────────────────────────────────────────
function twilioAuthHeader() {
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET &&
      TWILIO_API_KEY_SECRET !== "placeholder") {
    return "Basic " + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64");
  }
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function twilioCreateCall(
  to: string,
  from: string,
  opts: { twiml?: string; url?: string }
) {
  const form = new URLSearchParams({ To: to, From: from });
  if (opts.twiml) form.set("Twiml", opts.twiml);
  if (opts.url)   form.set("Url",   opts.url);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Twilio calls.create HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return data;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    phoneNumber,
    to,
    firstName,
    contactName,
    companyName,
    product,
    productSlug,
    productName,
  } = req.body || {};

  const phone = phoneNumber || to;
  if (!phone) return res.status(400).json({ error: "phoneNumber is required" });

  let cleanNumber = String(phone).replace(/[^\d+]/g, "");
  if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

  // Resolve prospect identity
  const rawName   = (contactName || firstName || "").toString().trim();
  const first     = rawName ? rawName.split(/\s+/)[0] : "there";
  const company   = ((companyName || "").toString().trim()) || "their company";
  const productLabel = ((productName || product || productSlug || "").toString().trim())
    || "our platform";

  if (!HUME_API_KEY) return res.status(500).json({ error: "HUME_API_KEY not configured" });
  if (!TWILIO_ACCOUNT_SID || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: "Twilio credentials not configured" });
  }

  try {
    // Run Perplexity brief in the background — don't block call placement on it.
    // The brief is passed to Hume as a session variable; EVI will pick it up
    // when the conversation starts. If the brief takes 2-5s but the call
    // itself rings for 3-10s before the prospect picks up, we still win.
    const briefPromise = buildCompanyBrief(first, company, productLabel);

    // Wait up to 7s to get the Perplexity brief before dialing.
    // The phone rings 8-15s before pickup, so even the full Sonar round-trip
    // (~4-5s) comfortably fits inside the ring window.
    let companyBrief: string;
    try {
      companyBrief = await Promise.race([
        briefPromise,
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error("brief timeout")), 7000)),
      ]);
    } catch {
      // Brief isn't ready in time — fall back to a generic briefing.
      companyBrief =
        `Pitching ${productLabel} to ${first} at ${company}. ` +
        `Lead with curiosity, listen more than talk, redirect objections to business outcomes.`;
    }

    // Build Hume TwiML webhook URL with session variables as query params.
    // Hume's /v0/evi/twilio endpoint accepts custom session variables via query string
    // which get injected into the prompt template's {{first_name}}, {{company_name}}, etc.
    const humeTwimlUrl = new URL("https://api.hume.ai/v0/evi/twilio");
    humeTwimlUrl.searchParams.set("config_id", HUME_CONFIG_ID);
    humeTwimlUrl.searchParams.set("api_key",   HUME_API_KEY);
    // Session variables — these populate {{first_name}}, {{company_name}},
    // {{product_name}}, {{company_brief}} in the pre-warmed prompt template.
    humeTwimlUrl.searchParams.set("first_name",    first);
    humeTwimlUrl.searchParams.set("company_name",  company);
    humeTwimlUrl.searchParams.set("product_name",  productLabel);
    humeTwimlUrl.searchParams.set("company_brief", companyBrief.slice(0, 1800));

    // Place the Twilio outbound call. TwiML is fetched by Twilio from Hume,
    // which returns <Connect><Stream url="wss://..."/></Connect> TwiML wiring
    // the call media straight into EVI.
    const call = await twilioCreateCall(cleanNumber, TWILIO_PHONE_NUMBER, {
      url: humeTwimlUrl.toString(),
    });

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status || "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "direct-twilio-hume-rag-v9",
      humeConfigId: HUME_CONFIG_ID,
      humeVoiceId: HUME_VOICE_ID,
      firstName: first,
      briefLength: companyBrief.length,
      briefPreview: companyBrief.slice(0, 240) + (companyBrief.length > 240 ? "..." : ""),
      message: `ADAM calling ${first} at ${company} about ${productLabel} — pre-warmed config + live RAG brief`,
    });
  } catch (err: any) {
    console.error("ATOM Lead Gen direct call error:", err);
    return res.status(500).json({ error: err?.message || "Failed to initiate call" });
  }
}
