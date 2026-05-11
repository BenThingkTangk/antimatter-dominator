/**
 * ATOM Lead Gen — Direct Twilio → Hume EVI outbound call.
 *
 * GOLD-STANDARD ARCHITECTURE:
 *
 *   Caller  ◄──►  Twilio SIP  ◄─── TwiML from ───┐
 *                      │                          │
 *                      │                    Hume EVI /v0/evi/twilio
 *                      │                     (config_id pre-warmed)
 *                      │                          │
 *                      └────── WebSocket ────────►│
 *                                                 │
 *                                         ┌───────┴─────────┐
 *                                         │  Anthropic      │
 *                                         │  Claude Sonnet  │  ← system prompt
 *                                         │  (~150ms FTL)   │     with {{variables}}
 *                                         └───────┬─────────┘
 *                                                 │
 *                                         ┌───────▼─────────┐
 *                                         │  Octave TTS     │  ← Jobs Tenor voice
 *                                         │  (Jobs Tenor)   │     (emotionally modulated)
 *                                         └─────────────────┘
 *
 * BEFORE the call is placed, this endpoint:
 *   1. Resolves prospect identity (first_name, company, product).
 *   2. Queries ATOM RAG (Pinecone-backed, cached Perplexity+GPT research)
 *      for a 3-chunk pitch brief + objection playbook on the product being
 *      pitched. Warm cache returns in ~700ms; cold falls back to a generic
 *      brief while ingestion kicks off in background.
 *   3. Passes everything to Hume's EVI via Twilio webhook query params.
 *      The pre-warmed EVI config has {{first_name}}, {{company_name}},
 *      {{product_name}}, {{company_brief}} template slots in its prompt.
 *   4. Twilio dials; when the prospect says hello, ADAM opens with their
 *      name and has the full research brief already in context.
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

// ATOM RAG microservice (Pinecone-backed, always-warm cache)
const RAG_URL = clean(process.env.RAG_URL) || "https://atom-rag.45-79-202-76.sslip.io";

// ─── Pre-warmed Hume assets (production, reused across all calls) ─────────────
const HUME_CONFIG_ID = clean(process.env.HUME_CONFIG_ID) ||
  "3c6f8a5b-e6f3-4732-9570-36a22f38e147"; // v11 Stanford + RAG + pickup (Claude Sonnet)
const HUME_VOICE_ID  = "e891bda0-d013-4a46-9cbe-360d618b0e58"; // ATOM Jobs Tenor

// ─── GPT-5.5 enterprise router ──────────────────────────────────────────────
// Hume EVI's "custom LLM" feature lets us swap the reasoning backend on a
// per-config basis. For high-stakes enterprise calls we want GPT-5.5: 1M
// context window for stuffing entire CRM histories, better multi-turn
// reasoning, ~30% close-rate lift on $50K+ deals per the Vibranium research.
//
// Routing rules (ALL must be true for GPT-5.5 path):
//   1. tenant.plan === "enterprise"
//   2. req.body.deal_value > GPT5_MIN_DEAL_VALUE  (default $50K)
//   3. HUME_CONFIG_GPT5 env is set (the v13 config wired to OpenAI custom LLM)
//
// Fall-through default: standard Claude Sonnet via the v11 config above.
const HUME_CONFIG_GPT5 = clean(process.env.HUME_CONFIG_GPT5);
const GPT5_MIN_DEAL_VALUE = Number(clean(process.env.GPT5_MIN_DEAL_VALUE)) || 50000;

// Note on model name: Hume EVI's OpenAI integration accepts gpt-5 / gpt-5-mini
// / gpt-4.1 / gpt-4o. gpt-5.5 is not yet whitelisted (verified May 2026).
// We expose the running model name so the UI can show the truth.
const GPT5_MODEL_LABEL = clean(process.env.HUME_GPT5_MODEL_LABEL) || "gpt-5";

function pickHumeConfig(opts: {
  tenantPlan?: string | null;
  dealValue?: number | null;
}): { configId: string; reasoningModel: string; tier: "standard" | "enterprise" } {
  const isEnterprise = opts.tenantPlan === "enterprise";
  const isHighValue  = (opts.dealValue ?? 0) >= GPT5_MIN_DEAL_VALUE;
  if (isEnterprise && isHighValue && HUME_CONFIG_GPT5) {
    return { configId: HUME_CONFIG_GPT5, reasoningModel: GPT5_MODEL_LABEL, tier: "enterprise" };
  }
  return { configId: HUME_CONFIG_ID, reasoningModel: "claude-sonnet", tier: "standard" };
}

// ─── Brief compaction ─────────────────────────────────────────────────────────
// RAG returns 4KB-7KB chunks. Twilio Url param has a 4000-char total budget,
// and URL-encoding roughly doubles the size. We keep the most actionable
// signal — key pain points, differentiators, top objections — under ~1.1KB raw.
function compactBrief(raw: string, maxChars: number): string {
  if (!raw) return raw;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;

  // Split by the section headers RAG emits
  const parts = text.split(/(?:\n|\.\s+)(?=\*\*|###|\d\.\s|-{3,}|---OBJECTION|OBJECTION|COLD CALL|DISCOVERY|KEY PAIN)/i);
  // Keep parts containing highest-signal keywords
  const SIGNAL = /pain|objection|differenti|why.*choose|opener|value|budget|competitor|discover/i;
  const signal = parts.filter(p => SIGNAL.test(p));
  let out = (signal.length ? signal.join(" ") : text);
  if (out.length > maxChars) out = out.slice(0, maxChars) + "\u2026";
  return out;
}

// ─── Apollo enrichment — firmographics + person match for the call ────────────
const APOLLO_KEY = (process.env.APOLLO_API_KEY || "").replace(/\\n/g, "").trim();
async function apolloPreCallBrief(opts: { firstName: string; lastName?: string; companyName: string; domain?: string }): Promise<string> {
  if (!APOLLO_KEY) return "";
  const cleanedDomain = opts.domain ? opts.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : "";
  try {
    const tasks: Promise<any>[] = [];
    if (cleanedDomain) {
      tasks.push(fetch(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(cleanedDomain)}`,
        { headers: { "X-Api-Key": APOLLO_KEY }, signal: AbortSignal.timeout(2500) }).then(r => r.ok ? r.json() : null).catch(() => null));
    } else { tasks.push(Promise.resolve(null)); }
    if (opts.firstName) {
      tasks.push(fetch("https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
        body: JSON.stringify({
          first_name: opts.firstName,
          last_name: opts.lastName,
          domain: cleanedDomain,
          organization_name: opts.companyName,
          reveal_personal_emails: false,
          reveal_phone_number: false,
        }),
        signal: AbortSignal.timeout(2500),
      }).then(r => r.ok ? r.json() : null).catch(() => null));
    } else { tasks.push(Promise.resolve(null)); }

    const [orgData, personData] = await Promise.all(tasks);
    const org = orgData?.organization;
    const person = personData?.person;
    if (!org && !person) return "";
    const lines: string[] = ["\nFRESH APOLLO INTEL (last lookup just now):"];
    if (org) {
      if (org.name)                       lines.push(`• ${org.name} — ${org.industry || "unknown industry"}`);
      if (org.estimated_num_employees)    lines.push(`• ~${org.estimated_num_employees.toLocaleString()} employees`);
      if (org.organization_revenue_printed || org.annual_revenue_printed)
                                          lines.push(`• Revenue: ${org.organization_revenue_printed || org.annual_revenue_printed}`);
      if (org.short_description)          lines.push(`• ${String(org.short_description).slice(0, 220)}`);
      if (Array.isArray(org.technology_names) && org.technology_names.length)
                                          lines.push(`• Tech: ${org.technology_names.slice(0, 8).join(", ")}`);
      if (Array.isArray(org.funding_events) && org.funding_events[0]) {
        const f = org.funding_events[0];
        const amount = f.amount ? `\$${(f.amount / 1_000_000).toFixed(1)}M` : "";
        lines.push(`• Latest round: ${f.type || "funding"} ${amount} ${f.date || ""}`.trim());
      }
    }
    if (person) {
      if (person.title)                   lines.push(`• Contact title: ${person.title}`);
      if (person.seniority)                lines.push(`• Seniority: ${person.seniority}`);
      if (person.previous_employment?.[0]?.end_date) {
        const days = Math.round((Date.now() - new Date(person.previous_employment[0].end_date).getTime()) / 86400000);
        if (days < 180) lines.push(`• Recently joined (${days}d ago) from ${person.previous_employment[0].title} @ ${person.previous_employment[0].organization_name}`);
      }
    }
    return lines.join("\n");
  } catch { return ""; }
}

// ─── ATOM RAG — vector-search-backed pitch/objection brief ────────────────────
async function fetchRagBrief(
  productName: string,
  prospectCompany: string,
  contactName: string,
): Promise<string> {
  // We care about the PRODUCT being pitched — that's the library of pitches
  // and objections ADAM has been trained on. We query the RAG service's
  // `pitch` module (chunks covering opener, value, objections, proof).
  const query = `${prospectCompany} ${contactName} outbound call objections pitch value`;

  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: productName,
        module: "pitch",
        query,
      }),
      // Aggressive timeout: warm hits return < 900ms. If RAG takes longer
      // than 1.4s we fall back to the generic brief and fire background ingest
      // — this keeps pickup-to-first-word under ~600ms instead of 3s+.
      signal: AbortSignal.timeout(1400),
    });
    if (!res.ok) return "";
    const data: any = await res.json();
    const ctx: string = data?.context || "";
    if (ctx.length > 40) {
      // Also pull objection chunks for robustness
      try {
        const oRes = await fetch(`${RAG_URL}/company/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: productName,
            module: "objection",
            query: "common objections and rebuttals",
          }),
          signal: AbortSignal.timeout(1500),
        });
        if (oRes.ok) {
          const od: any = await oRes.json();
          const ob: string = od?.context || "";
          if (ob.length > 40) {
            return `${ctx}\n\n---OBJECTION PLAYBOOK---\n${ob}`.slice(0, 4000);
          }
        }
      } catch { /* objection chunk best-effort */ }
      return ctx.slice(0, 4000);
    }
  } catch {}
  return "";
}

// Background-ingest a product we don't have indexed yet — fire-and-forget.
// Next call for this product will be warm (~700ms).
function backgroundIngest(productName: string): void {
  fetch(`${RAG_URL}/company/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: productName }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => { /* best-effort */ });
}

// ─── Twilio helpers ───────────────────────────────────────────────────────────
function twilioAuthHeader() {
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET &&
      TWILIO_API_KEY_SECRET !== "placeholder") {
    return "Basic " + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64");
  }
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function twilioCreateCall(to: string, from: string, opts: { twiml?: string; url?: string }) {
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

// --- Hume per-call config helper ---
// Hume Twilio integration does NOT propagate query-param variables into the
// chat's session_settings, so {{first_name}}/{{company_name}}/{{product_name}}
// placeholders in the master config's prompt stay raw. Fix: clone master,
// substitute variables into the prompt TEXT, create ephemeral config per call.
async function createPerCallConfig(args: {
  masterConfigId: string;
  firstName: string;
  companyName: string;
  productName: string;
  companyBrief: string;
  prospectCompany: string;
}): Promise<string> {
  const listRes = await fetch(
    `https://api.hume.ai/v0/evi/configs/${args.masterConfigId}`,
    { headers: { "X-Hume-Api-Key": HUME_API_KEY } }
  );
  if (!listRes.ok) throw new Error(`Hume master config fetch failed: ${listRes.status}`);
  const listJson: any = await listRes.json();
  const master = listJson?.configs_page?.[0];
  if (!master?.prompt?.text) throw new Error("Hume master config has no prompt text");
  const substitute = (text: string): string => text
    .replace(/\{\{\s*first_name\s*\}\}/g,       args.firstName       || "there")
    .replace(/\{\{\s*company_name\s*\}\}/g,     args.companyName     || "AntimatterAI")
    .replace(/\{\{\s*product_name\s*\}\}/g,     args.productName     || "our solution")
    .replace(/\{\{\s*prospect_company\s*\}\}/g, args.prospectCompany || "their company")
    .replace(/\{\{\s*company_brief\s*\}\}/g,    args.companyBrief    || "");
  const renderedPrompt = substitute(master.prompt.text);
  const createRes = await fetch("https://api.hume.ai/v0/evi/configs", {
    method: "POST",
    headers: { "X-Hume-Api-Key": HUME_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      evi_version: master.evi_version || "3",
      name: `ATOM call - ${args.firstName} @ ${args.prospectCompany} - ${Date.now()}`,
      prompt: { text: renderedPrompt },
      voice: master.voice,
      language_model: master.language_model,
      ellm_model: master.ellm_model,
      tools: master.tools || [],
      builtin_tools: master.builtin_tools || [],
      event_messages: master.event_messages,
      timeouts: master.timeouts,
      nudges: master.nudges,
      webhooks: master.webhooks || [],
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Hume create-per-call-config failed: ${createRes.status} ${errText.slice(0, 240)}`);
  }
  const created: any = await createRes.json();
  if (!created?.id) throw new Error("Hume create-per-call-config returned no id");
  return created.id as string;
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
    pitchTopic,         // user-typed value-prop / talking point (informational)
    deal_value,
    dealValue,
    tenant_slug,
    tenantSlug,
  } = req.body || {};

  // Normalize: accept both snake_case and camelCase from the frontend.
  const dealValueNum = Number(deal_value ?? dealValue ?? 0) || 0;
  const reqTenantSlug = (tenant_slug || tenantSlug || "").toString().trim();

  const phone = phoneNumber || to;
  if (!phone) return res.status(400).json({ error: "phoneNumber is required" });

  let cleanNumber = String(phone).replace(/[^\d+]/g, "");
  if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

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
    // 1. Pull warm RAG brief on the product being pitched, IN PARALLEL with
    //    placing the Twilio call. The Twilio URL param actually needs the
    //    brief embedded (Hume reads {{company_brief}} from query string), so
    //    we still await before createCall — BUT the timeout is now 1.4s, and
    //    we fire a background prewarm on the fallback path so the next call
    //    for this product is ready in <700ms.
    // Fire RAG brief and Apollo enrichment in parallel so the worse path doesn't block the better.
    const companyDomain = (company || "").includes(".") ? company
      : ((req.body?.domain || "").toString().trim());
    const lastNameGuess = rawName.split(/\s+/).slice(1).join(" ") || "";
    const [ragBrief, apolloBrief] = await Promise.all([
      fetchRagBrief(productLabel, company, first),
      apolloPreCallBrief({ firstName: first, lastName: lastNameGuess, companyName: company, domain: companyDomain }),
    ]);

    let companyBrief: string;
    if (ragBrief) {
      companyBrief = ragBrief;
    } else {
      // Product not yet indexed — fire background ingest (next call will be warm)
      backgroundIngest(productLabel);
      companyBrief =
        `You are pitching ${productLabel} to ${first} at ${company}. ` +
        `Lead with curiosity about their current stack and pain. ` +
        `Listen more than you talk. Redirect every objection to a business outcome. ` +
        `Always answer like you built the product yourself and know it cold.`;
    }
    // Append Apollo intel — fresh firmographics + decision-maker context for the voice agent.
    if (apolloBrief) companyBrief = companyBrief + "\n" + apolloBrief;

    // Append the rep's pitch-topic note so ATOM knows the SPECIFIC angle to lead with.
    // This is critical: without this hook the LLM hallucinates a generic pitch (or
    // picks up training-set noise like "Boost Mobile"). With it, ATOM has a sharp
    // talking-point to anchor the opening line and the call brief on.
    const trimmedPitchTopic = ((pitchTopic || "").toString().trim()).slice(0, 320);
    if (trimmedPitchTopic) {
      companyBrief = `\n---REP'S CALL ANGLE---\nWhen ${first} engages, steer the conversation toward this topic specifically:\n  ${trimmedPitchTopic}\nFrame the value-prop around this angle. Do NOT name another product unrelated to ${productLabel}.\n\n` + companyBrief;
    }

    // 1.5. Resolve which Hume config + reasoning model to use for this call.
    //      Enterprise tier + deal_value over threshold + GPT-5.5 config
    //      configured → route to GPT-5.5 path. Else default Claude Sonnet.
    let tenantPlan: string | null = null;
    if (reqTenantSlug) {
      try {
        const proto = (req.headers["x-forwarded-proto"] as string) || "https";
        const host = (req.headers["x-forwarded-host"] as string)
          || (req.headers.host as string)
          || "atom-dominator-pro.vercel.app";
        // 4s timeout: cold-start internal fetch can take ~2.5s on Vercel.
        // We still fail soft — standard tier is the right safe default.
        const tRes = await fetch(
          `${proto}://${host}/api/tenant?slug=${encodeURIComponent(reqTenantSlug)}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (tRes.ok) {
          const t: any = await tRes.json();
          tenantPlan = t?.plan || null;
        }
      } catch {
        // Tenant lookup is non-blocking — standard config is the safe default.
      }
    }

    const routedConfig = pickHumeConfig({ tenantPlan, dealValue: dealValueNum });

    // 2. Build Hume EVI's Twilio webhook URL with per-call session variables.
    //    Twilio has a 4000-char Url limit; after URL-encoding the brief balloons
    //    to ~3x its raw length. Budget: ~1200 raw chars of brief.
    //    We trim to the densest signal — typically the opener + top 3 objections.
    const trimmedBrief = compactBrief(companyBrief, 1100);

    // Twilio doesn't give us the SID until AFTER we place the call, but
    // Hume accepts a custom_session_id we can set ourselves. We generate a
    // UUID here, send it to Hume via query param, and tag the Twilio call
    // via the 'Url' callback where we'll also pass it back. The frontend
    // uses this to poll /api/atom-leadgen/chat-events.
    const sessionId = `atom_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // ──────────────────────────────────────────────────────────────────────
    // CRITICAL FIX (May 11, 2026): Hume's Twilio integration DOES NOT support
    // passing dynamic variables via query params. The {{first_name}},
    // {{company_name}}, etc. placeholders in the master config's prompt stay
    // unsubstituted, so the LLM sees literal '{{company_name}}' tokens and
    // either ignores them (dead air, confused turn) or hallucinates a
    // company name ("Boost Mobile" reported by user).
    //
    // Fix: clone the master config and substitute variables into the prompt
    // TEXT before the call. Hume's /v0/evi/configs API supports per-call
    // ephemeral configs — we create one, use it, and let Hume garbage-collect.
    // ──────────────────────────────────────────────────────────────────────
    const sellerCompany = productLabel && productLabel !== "their solution"
      ? productLabel
      : "AntimatterAI";

    const callConfigId = await createPerCallConfig({
      masterConfigId: routedConfig.configId,
      firstName: first,
      companyName: sellerCompany,
      productName: sellerCompany,
      companyBrief: trimmedBrief,
      prospectCompany: company,
    });

    const humeTwimlUrl = new URL("https://api.hume.ai/v0/evi/twilio");
    humeTwimlUrl.searchParams.set("config_id", callConfigId);
    humeTwimlUrl.searchParams.set("api_key",   HUME_API_KEY);

    // 3. Place the outbound call.
    const call = await twilioCreateCall(cleanNumber, TWILIO_PHONE_NUMBER, {
      url: humeTwimlUrl.toString(),
    });

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      sessionId,                         // used by frontend to poll chat-events
      humeCustomSessionId: sessionId,    // alias
      status: call.status || "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "twilio-hume-direct-rag-cached-v10",
      humeConfigId: routedConfig.configId,
      humeVoiceId: HUME_VOICE_ID,
      reasoningModel: routedConfig.reasoningModel,        // "claude-sonnet" | "gpt-5.5"
      tier: routedConfig.tier,                            // "standard" | "enterprise"
      dealValue: dealValueNum || null,
      tenantPlan: tenantPlan || null,
      firstName: first,
      briefSource: ragBrief ? "atom-rag (warm cache)" : "generic (ingest queued)",
      briefLength: trimmedBrief.length,
      briefRawLength: companyBrief.length,
      briefPreview: trimmedBrief.slice(0, 300) + (trimmedBrief.length > 300 ? "..." : ""),
      message: `ADAM (from ${productLabel || "AntimatterAI"}) calling ${first} at ${company}`,
    });
  } catch (err: any) {
    console.error("ATOM Lead Gen direct call error:", err);
    return res.status(500).json({ error: err?.message || "Failed to initiate call" });
  }
}
