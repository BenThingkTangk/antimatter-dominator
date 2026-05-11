/**
 * ATOM Sales Dominator — Seat / Module Cost Model
 *
 * Single source of truth for what each user/seat costs us per month when they
 * exercise the platform. Powers the Nirmata HQ "Seat Costs" page (super-admin
 * only — tenants never see this).
 *
 * Pricing as of May 2026. Source: /home/user/workspace/atom_seat_cost_research.md
 *
 * Edit this file when:
 *   - a provider raises/cuts list price
 *   - we change a module's per-action workload (e.g., switch Sonnet 4.5 \u2192 Opus 4.5)
 *   - we ship a new module that adds COGS
 *   - we add a new sprint / GA level (Vibranium GA, etc.)
 *
 * The page renders directly from this object. No hard-coded numbers in the UI.
 */

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 1. PROVIDER UNIT PRICES (as of 2026-05-11)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export const PROVIDER_PRICES = {
  // Hume EVI 3 \u2014 all-in voice runtime (STT + LLM + Octave TTS)
  hume_evi3_per_min:           0.06,    // Pro plan effective rate
  hume_evi3_per_min_scale:     0.05,    // Scale plan
  hume_evi3_per_min_business:  0.04,    // Business plan

  // Twilio voice + recording + SMS
  twilio_voice_per_min:        0.014,   // outbound US local/toll-free
  twilio_recording_per_min:    0.0025,  // call recording capture
  twilio_storage_per_min_mo:   0.0005,  // recording storage per minute per month
  twilio_number_per_mo:        1.15,    // local number rental
  twilio_sms_per_msg:          0.0128,  // base + typical carrier surcharge

  // OpenAI \u2014 GPT-5.4 is our default routing model
  openai_gpt5_4_in_per_mtok:   2.50,
  openai_gpt5_4_out_per_mtok:  15.00,
  openai_gpt5_5_in_per_mtok:   5.00,
  openai_gpt5_5_out_per_mtok:  30.00,
  openai_whisper_per_min:      0.017,   // GPT-Realtime-Whisper

  // Anthropic \u2014 Sonnet 4.6 is our default voice-LLM model
  anthropic_sonnet_in_per_mtok:  3.00,
  anthropic_sonnet_out_per_mtok: 15.00,
  anthropic_opus_in_per_mtok:    5.00,  // Opus 4.5 (the new cheaper Opus)
  anthropic_opus_out_per_mtok:   25.00,

  // Perplexity Sonar \u2014 used for signal discovery + research
  pplx_sonar_request_fee:       0.005,  // per-request fee dominates
  pplx_sonar_in_per_mtok:       1.00,
  pplx_sonar_out_per_mtok:      1.00,
  pplx_sonar_pro_in_per_mtok:   3.00,
  pplx_sonar_pro_out_per_mtok:  15.00,

  // Pinecone (Standard plan, serverless)
  pinecone_write_per_million:   4.00,
  pinecone_read_per_million:    16.00,
  pinecone_storage_per_gb_mo:   0.33,
  pinecone_standard_min_mo:     50.00,  // account-level minimum

  // Apollo \u2014 PER-SEAT, materially changes seat math
  apollo_professional_per_seat:    79.00,  // annual billing
  apollo_phone_reveal_credit_cost: 1.60,   // 8 credits \u00d7 $0.20

  // PeopleDataLabs \u2014 per-call enrichment
  pdl_person_enrich_per_call:    0.224,  // annual billing tier 1
  pdl_company_enrich_per_call:   0.10,

  // Hunter.io \u2014 per-seat with credit bundle
  hunter_starter_per_seat:       34.00,  // annual billing
  hunter_per_email_starter:      0.0245,

  // Resend \u2014 flat plan + overage
  resend_pro_flat_mo:            20.00,
  resend_overage_per_email:      0.0009,

  // Vercel \u2014 per developer seat (not tenant seat \u2014 our infra cost)
  vercel_per_dev_seat:           20.00,
  vercel_function_per_million:   0.60,

  // Supabase \u2014 per project flat
  supabase_pro_per_project_mo:   25.00,
  supabase_egress_per_gb:        0.09,

  // Stripe \u2014 transaction take rate, not a per-seat cost (rev offset)
  stripe_pct_per_txn:            0.029,
  stripe_flat_per_txn:           0.30,

  // ElevenLabs \u2014 premium voice clones for enterprise tenants only
  elevenlabs_creator_flat_mo:    22.00,
  elevenlabs_pro_flat_mo:        99.00,

  // BuiltWith + TheirStack \u2014 signal layer
  builtwith_pro_flat_mo:         495.00,
  theirstack_per_credit_tier1:   0.109,
} as const;

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 2. SEAT WORKLOAD PROFILES
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// "Light/Medium/Heavy" approximate what a single sales rep will exercise per
// month at each engagement level. We use medium as the default seat-cost
// estimate in the page; the table also shows light + heavy for sensitivity.

export type SeatProfile = "light" | "medium" | "heavy";

export interface SeatWorkload {
  // ATOM Dial (live AI voice calls)
  dialMinutesPerMonth:      number;  // outbound voice minutes
  dialCallsPerMonth:        number;  // unique calls (affects recording, ramp-up)

  // ATOM Campaign / Auto-Dialer (queue mode \u2014 high throughput)
  campaignMinutesPerMonth:  number;
  campaignCallsPerMonth:    number;

  // ATOM Multi-Channel Outreach (Pitch + email + SMS sequences)
  emailsSentPerMonth:       number;
  smsSentPerMonth:          number;

  // ATOM Prospect Engine (Apollo + PDL enrichment)
  prospectEnrichmentsPerMonth: number;
  phoneRevealsPerMonth:        number;

  // ATOM Market Intent (Perplexity Sonar signal discovery)
  signalQueriesPerMonth:    number;

  // ATOM Pitch (Claude Sonnet pitch generation)
  pitchGenerationsPerMonth: number;

  // ATOM Objection Handler (in-call rebuttal lookups)
  objectionHandlerCallsPerMonth: number;

  // ATOM War Room (deal-level Opus reasoning)
  warroomAnalysesPerMonth:       number;

  // ATOM WarBook (playbook RAG queries + battle-card lookups)
  warbookQueriesPerMonth:        number;

  // ATOM Chat (always-on assistant on every page)
  atomChatMessagesPerMonth: number;

  // Background platform overhead per seat (regardless of usage)
  pineconeReadsPerMonth:    number;  // RAG queries
  pineconeWritesPerMonth:   number;
  pineconeStorageGB:        number;
}

export const SEAT_PROFILES: Record<SeatProfile, { label: string; description: string; workload: SeatWorkload }> = {
  light: {
    label: "Light user",
    description: "Tries ATOM ~1\u20132x per week. ~10 live calls, browses dashboards, light Pitch generation.",
    workload: {
      dialMinutesPerMonth:           45,
      dialCallsPerMonth:             10,
      campaignMinutesPerMonth:       0,
      campaignCallsPerMonth:         0,
      emailsSentPerMonth:            40,
      smsSentPerMonth:               10,
      prospectEnrichmentsPerMonth:   50,
      phoneRevealsPerMonth:          5,
      signalQueriesPerMonth:         30,
      pitchGenerationsPerMonth:      8,
      objectionHandlerCallsPerMonth: 4,
      warroomAnalysesPerMonth:       2,
      warbookQueriesPerMonth:        20,
      atomChatMessagesPerMonth:      120,
      pineconeReadsPerMonth:         800,
      pineconeWritesPerMonth:        200,
      pineconeStorageGB:             0.05,
    },
  },
  medium: {
    label: "Medium user (target ICP)",
    description: "Daily user. ~40 live calls + 200 campaign dials, regular Pitch + outreach, active WarRoom.",
    workload: {
      dialMinutesPerMonth:           180,
      dialCallsPerMonth:             40,
      campaignMinutesPerMonth:       400,
      campaignCallsPerMonth:         200,
      emailsSentPerMonth:            600,
      smsSentPerMonth:               120,
      prospectEnrichmentsPerMonth:   500,
      phoneRevealsPerMonth:          40,
      signalQueriesPerMonth:         250,
      pitchGenerationsPerMonth:      60,
      objectionHandlerCallsPerMonth: 30,
      warroomAnalysesPerMonth:       18,
      warbookQueriesPerMonth:        160,
      atomChatMessagesPerMonth:      1200,
      pineconeReadsPerMonth:         8000,
      pineconeWritesPerMonth:        2500,
      pineconeStorageGB:             0.4,
    },
  },
  heavy: {
    label: "Heavy user (top performer)",
    description: "All-day power user. ~80 live calls + 800 campaign dials, Pitch every prospect, deep research.",
    workload: {
      dialMinutesPerMonth:           420,
      dialCallsPerMonth:             80,
      campaignMinutesPerMonth:       1600,
      campaignCallsPerMonth:         800,
      emailsSentPerMonth:            2200,
      smsSentPerMonth:               450,
      prospectEnrichmentsPerMonth:   2000,
      phoneRevealsPerMonth:          150,
      signalQueriesPerMonth:         900,
      pitchGenerationsPerMonth:      200,
      objectionHandlerCallsPerMonth: 80,
      warroomAnalysesPerMonth:       55,
      warbookQueriesPerMonth:        500,
      atomChatMessagesPerMonth:      4000,
      pineconeReadsPerMonth:         28000,
      pineconeWritesPerMonth:        8000,
      pineconeStorageGB:             1.2,
    },
  },
};

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 3. PER-ACTION COST FORMULAS
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Each module breaks down into atomic actions with marginal $ cost per action.
// These feed both the per-action display and the seat aggregate.

const p = PROVIDER_PRICES;

/** Cost of ONE live AI voice call \u2014 the dominant variable cost. */
function costOneDialMinute(): number {
  // Hume EVI 3 (bundles STT + LLM + TTS) + Twilio voice + recording
  // Recording assumes 1:1 minutes recorded; storage modeled monthly via seat agg.
  return p.hume_evi3_per_min + p.twilio_voice_per_min + p.twilio_recording_per_min;
}

/** Cost of one outbound email through Resend (overage rate). */
function costOneEmail(): number {
  return p.resend_overage_per_email;
}

/** Cost of one SMS. */
function costOneSms(): number {
  return p.twilio_sms_per_msg;
}

/** Cost of one Apollo person enrichment (~included in seat until overage). */
function costOneProspectEnrichment(): number {
  // Hybrid: assume 70% covered by included Apollo credits, 30% PDL fallback.
  return 0.3 * p.pdl_person_enrich_per_call;
}

/** Cost of one phone-reveal action (Apollo overage credits). */
function costOnePhoneReveal(): number {
  return p.apollo_phone_reveal_credit_cost;
}

/** Cost of one Perplexity Sonar signal query. */
function costOneSignalQuery(): number {
  // Per-request fee + ~700 tokens round-trip on Sonar
  return p.pplx_sonar_request_fee + (700 / 1_000_000) * (p.pplx_sonar_in_per_mtok + p.pplx_sonar_out_per_mtok);
}

/** Cost of one Pitch generation \u2014 a meaty Claude Sonnet 4.6 reasoning call. */
function costOnePitchGeneration(): number {
  const inTok  = 4500;   // prompt + brief + Apollo enrichment + objection list
  const outTok = 1200;   // structured pitch JSON
  return (inTok / 1_000_000) * p.anthropic_sonnet_in_per_mtok +
         (outTok / 1_000_000) * p.anthropic_sonnet_out_per_mtok;
}

/** Cost of one Objection Handler request \u2014 small Claude burst. */
function costOneObjectionHandler(): number {
  const inTok  = 1800;
  const outTok = 400;
  return (inTok / 1_000_000) * p.anthropic_sonnet_in_per_mtok +
         (outTok / 1_000_000) * p.anthropic_sonnet_out_per_mtok;
}

/** Cost of one WarRoom analysis \u2014 a deeper reasoning burst (Opus 4.5). */
function costOneWarroomAnalysis(): number {
  const inTok  = 8000;
  const outTok = 2200;
  return (inTok / 1_000_000) * p.anthropic_opus_in_per_mtok +
         (outTok / 1_000_000) * p.anthropic_opus_out_per_mtok;
}

/** Cost of one ATOM Chat message (short, GPT-5.4-mini equivalent on Sonnet). */
function costOneAtomChatMessage(): number {
  const inTok  = 1200;
  const outTok = 350;
  return (inTok / 1_000_000) * p.anthropic_sonnet_in_per_mtok +
         (outTok / 1_000_000) * p.anthropic_sonnet_out_per_mtok;
}

/** Cost of one WarBook query — RAG lookup against the playbook corpus. */
function costOneWarbookQuery(): number {
  // 1 Pinecone read + a small Sonnet summarization burst.
  const readCost = (1 / 1_000_000) * p.pinecone_read_per_million;
  const inTok    = 2400;   // retrieved chunks + question
  const outTok   = 480;
  const llm = (inTok / 1_000_000) * p.anthropic_sonnet_in_per_mtok +
              (outTok / 1_000_000) * p.anthropic_sonnet_out_per_mtok;
  return readCost + llm;
}

/** Pinecone RAG cost per seat per month. */
function costPineconePerSeatMonth(w: SeatWorkload): number {
  return (w.pineconeReadsPerMonth  / 1_000_000) * p.pinecone_read_per_million +
         (w.pineconeWritesPerMonth / 1_000_000) * p.pinecone_write_per_million +
         w.pineconeStorageGB * p.pinecone_storage_per_gb_mo;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 4. MODULES
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export type ModuleGroup =
  | "voice"           // Anything that drives Twilio + Hume voice runtime
  | "outreach"        // Async / multi-channel touches (email + SMS)
  | "intelligence"    // Research, scoring, signal discovery, deal reasoning
  | "content"         // Pitch / objection / chat — LLM-generated text artifacts
  | "knowledge";      // RAG-backed knowledge base (WarBook)

export interface ModuleCostLine {
  /** Slug matches the module's sidebar route segment. */
  slug: string;
  label: string;
  /** Top-level grouping for the UI table headers. */
  group: ModuleGroup;
  description: string;
  /** What is this module's atomic billable action? */
  unit: string;
  /** Verbose explainer of what *counts as one unit* (shown as a hover/expand). */
  unitExplainer: string;
  /** Marginal cost per atomic action, in dollars. */
  costPerAction: number;
  /** Which providers contribute to that per-action cost. */
  providers: string[];
  /** Free-form cost-breakdown breadcrumb shown in the UI. */
  breakdown: string;
  /** Pulls the right field off the seat workload to multiply against. */
  unitsPerSeat: (w: SeatWorkload) => number;
}

export const MODULES: ModuleCostLine[] = [
  // ── VOICE ─────────────────────────────────────────────────────────────────
  {
    slug: "atom-leadgen",
    label: "ATOM Dial",
    group: "voice",
    description: "Live 1-on-1 AI voice call with Hume EVI 3 voice runtime.",
    unit: "minute of live call",
    unitExplainer: "One unit = ONE MINUTE of two-way audio between the prospect and ATOM (the AI), measured by Twilio from connect to hangup. A 4-minute call = 4 units. Pickup detection silence is included; pre-dial setup is not.",
    costPerAction: costOneDialMinute(),
    providers: ["Hume EVI 3", "Twilio voice", "Twilio recording"],
    breakdown: `Hume $${p.hume_evi3_per_min}/min + Twilio voice $${p.twilio_voice_per_min}/min + recording $${p.twilio_recording_per_min}/min`,
    unitsPerSeat: (w) => w.dialMinutesPerMonth,
  },
  {
    slug: "atom-campaign",
    label: "ATOM Campaign \u00b7 Auto-Dialer",
    group: "voice",
    description: "Queue-mode dialing through a saved prospect list, one shared Hume session per cycle.",
    unit: "minute of campaign call",
    unitExplainer: "One unit = ONE MINUTE of voice-connected campaign call. No-answer + voicemail attempts cost Twilio voice but not Hume (Hume meter starts on human pickup). We bill on connected minutes only.",
    costPerAction: costOneDialMinute(),
    providers: ["Hume EVI 3", "Twilio voice", "Twilio recording"],
    breakdown: `Same per-minute cost as ATOM Dial \u2014 throughput is higher (200\u2013800 calls/mo)`,
    unitsPerSeat: (w) => w.campaignMinutesPerMonth,
  },

  // ── OUTREACH ───────────────────────────────────────────────────────────────
  {
    slug: "atom-multichannel",
    label: "Multi-Channel Outreach \u00b7 Email",
    group: "outreach",
    description: "Pitch-driven email cadences sent via Resend with personalization tokens.",
    unit: "outbound email",
    unitExplainer: "One unit = ONE OUTBOUND EMAIL successfully accepted by Resend's SMTP. Bounces don't count. Each follow-up step in a sequence = 1 unit. Reply parsing / inbox sync is free.",
    costPerAction: costOneEmail(),
    providers: ["Resend", "Claude (tokenized personalization)"],
    breakdown: `Resend overage $${p.resend_overage_per_email}/email (above the 50K/mo included on Pro plan)`,
    unitsPerSeat: (w) => w.emailsSentPerMonth,
  },
  {
    slug: "atom-multichannel-sms",
    label: "Multi-Channel Outreach \u00b7 SMS",
    group: "outreach",
    description: "Compliant outbound SMS bursts tied to a Pitch cadence step.",
    unit: "outbound SMS",
    unitExplainer: "One unit = ONE 160-character SMS SEGMENT sent through Twilio US long code. A long message > 160 chars splits into multiple segments and each is its own billable unit. Inbound replies are free.",
    costPerAction: costOneSms(),
    providers: ["Twilio SMS (+ carrier surcharge)"],
    breakdown: `Twilio base $${p.twilio_sms_per_msg}/msg (base + typical carrier surcharge)`,
    unitsPerSeat: (w) => w.smsSentPerMonth,
  },

  // ── INTELLIGENCE ────────────────────────────────────────────────────────────
  {
    slug: "prospects",
    label: "ATOM Prospect Engine",
    group: "intelligence",
    description: "Apollo-anchored prospecting with PDL fallback enrichment for emails / firmographics.",
    unit: "prospect enrichment",
    unitExplainer: "One unit = ONE CONTACT enriched with email + title + company firmographics. Re-enrichment of the same contact within 30 days does not re-bill. Adding to a list / saving a search is free.",
    costPerAction: costOneProspectEnrichment(),
    providers: ["Apollo (included credits)", "PeopleDataLabs (overflow)"],
    breakdown: `Blended: 70% covered by Apollo seat credits, 30% PDL at $${p.pdl_person_enrich_per_call}/call`,
    unitsPerSeat: (w) => w.prospectEnrichmentsPerMonth,
  },
  {
    slug: "prospects-phone-reveal",
    label: "Prospect Engine \u00b7 Phone reveals",
    group: "intelligence",
    description: "Mobile phone number reveal on a contact \u2014 8 Apollo credits per reveal.",
    unit: "phone reveal",
    unitExplainer: "One unit = ONE successful mobile-phone reveal. We only charge when Apollo returns a verified mobile number. Failed lookups cost zero credits.",
    costPerAction: costOnePhoneReveal(),
    providers: ["Apollo (overage credits)"],
    breakdown: `Apollo overage: 8 credits \u00d7 $0.20 = $${p.apollo_phone_reveal_credit_cost}/reveal`,
    unitsPerSeat: (w) => w.phoneRevealsPerMonth,
  },
  {
    slug: "market",
    label: "ATOM Market Intent",
    group: "intelligence",
    description: "Perplexity Sonar signal discovery (LinkedIn posts, funding events, hiring spikes).",
    unit: "signal query",
    unitExplainer: "One unit = ONE SONAR RESEARCH QUERY against the live web. Cached results returned within 24 hours don't re-bill. Signal autopilot batches count as 1 unit per company researched.",
    costPerAction: costOneSignalQuery(),
    providers: ["Perplexity Sonar"],
    breakdown: `Per-request fee $${p.pplx_sonar_request_fee} + ~700 tokens at $${p.pplx_sonar_in_per_mtok}/MTok`,
    unitsPerSeat: (w) => w.signalQueriesPerMonth,
  },
  {
    slug: "war-room",
    label: "ATOM War Room",
    group: "intelligence",
    description: "Deal-level reasoning (truth score, leverage, ghost probability) via Claude Opus 4.5.",
    unit: "war-room analysis",
    unitExplainer: "One unit = ONE FULL DEAL ANALYSIS — the Von Clausewitz / Aletheia run that produces truth score, ghost probability, leverage posture, and flag list. Refreshing the same deal within 6h serves cached.",
    costPerAction: costOneWarroomAnalysis(),
    providers: ["Anthropic Claude Opus 4.5"],
    breakdown: `~8K in + 2.2K out @ $${p.anthropic_opus_in_per_mtok}/$${p.anthropic_opus_out_per_mtok} per MTok`,
    unitsPerSeat: (w) => w.warroomAnalysesPerMonth,
  },

  // ── CONTENT (LLM-generated text artifacts) ──────────────────────────────────────────
  {
    slug: "pitch",
    label: "ATOM Pitch",
    group: "content",
    description: "Bespoke pitch generation \u2014 Claude Sonnet 4.6 with the full prospect brief + objections.",
    unit: "pitch generated",
    unitExplainer: "One unit = ONE PITCH OBJECT generated for a specific prospect (opener + hook + 3 value props + qualifying question + close). Regenerating the same pitch within 24h with no input change serves cached.",
    costPerAction: costOnePitchGeneration(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~4.5K in + 1.2K out @ $${p.anthropic_sonnet_in_per_mtok}/$${p.anthropic_sonnet_out_per_mtok} per MTok`,
    unitsPerSeat: (w) => w.pitchGenerationsPerMonth,
  },
  {
    slug: "objection-handler",
    label: "ATOM Objection Handler",
    group: "content",
    description: "Real-time objection rebuttal lookups during a live call.",
    unit: "objection lookup",
    unitExplainer: "One unit = ONE REBUTTAL REQUEST during or after a live call. The rep clicks an objection chip or speaks it; we return a short, tone-matched rebuttal. RAG-cached objections served from the WarBook DO NOT count here.",
    costPerAction: costOneObjectionHandler(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~1.8K in + 400 out tokens per request`,
    unitsPerSeat: (w) => w.objectionHandlerCallsPerMonth,
  },
  {
    slug: "atom-chat",
    label: "ATOM Chat (page-level assistant)",
    group: "content",
    description: "Always-on ATOM assistant available on every page \u2014 context-aware Q&A.",
    unit: "chat message",
    unitExplainer: "One unit = ONE USER TURN in the floating ATOM Chat panel. The assistant's reply is bundled with the turn. Suggested-prompt clicks count as a user turn.",
    costPerAction: costOneAtomChatMessage(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~1.2K in + 350 out tokens per turn`,
    unitsPerSeat: (w) => w.atomChatMessagesPerMonth,
  },

  // ── KNOWLEDGE ────────────────────────────────────────────────────────────────
  {
    slug: "warbook",
    label: "ATOM WarBook",
    group: "knowledge",
    description: "RAG-backed playbook / battle-card / objection library tuned to the tenant.",
    unit: "WarBook query",
    unitExplainer: "One unit = ONE RAG LOOKUP against the tenant's WarBook corpus (objection lib, playbook chapters, battle cards, won-call snippets). Includes the Pinecone read + the Sonnet summarization burst.",
    costPerAction: costOneWarbookQuery(),
    providers: ["Pinecone", "Anthropic Claude Sonnet 4.6"],
    breakdown: `1 Pinecone read + ~2.4K in + 480 out tokens on Sonnet`,
    unitsPerSeat: (w) => w.warbookQueriesPerMonth,
  },
];

// Flat / platform overhead amortized across the seat base.
export interface PlatformOverhead {
  label: string;
  monthlyCost: number;
  amortizeBy: "tenant" | "global";
  note: string;
}

export const PLATFORM_OVERHEAD: PlatformOverhead[] = [
  { label: "Vercel Pro \u00b7 hosting + functions",        monthlyCost: 200,  amortizeBy: "global", note: "10 dev seats \u00d7 $20 + functions overflow. Spread across entire portfolio." },
  { label: "Supabase Pro \u00b7 main DB",                  monthlyCost: 25,   amortizeBy: "global", note: "Single project flat fee at portfolio level." },
  { label: "Pinecone Standard \u00b7 RAG minimum",          monthlyCost: 50,   amortizeBy: "global", note: "Account minimum; usage above is per-seat (see seat math)." },
  { label: "Resend Pro \u00b7 transactional + cadences",     monthlyCost: 20,   amortizeBy: "global", note: "Flat plan that covers 50K emails/mo across portfolio." },
  { label: "BuiltWith Pro \u00b7 tech stack signals",       monthlyCost: 495,  amortizeBy: "global", note: "Shared account; unlimited reports." },
  { label: "Twilio numbers \u00b7 1 per tenant",             monthlyCost: 1.15, amortizeBy: "tenant", note: "$1.15/mo per local number, scales with tenants." },
  { label: "Apollo Org plan \u00b7 minimum",                 monthlyCost: 79,   amortizeBy: "tenant", note: "Effectively the floor of a per-seat cost \u2014 see per-seat line above." },
];

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 5. PER-SEAT FIXED COSTS (paid regardless of usage)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface PerSeatFixedCost {
  label: string;
  monthlyCost: number;
  note: string;
}

export const PER_SEAT_FIXED: PerSeatFixedCost[] = [
  { label: "Apollo Professional \u00b7 seat",   monthlyCost: 79,   note: "Per-seat SaaS \u2014 scales 1:1 with active seats. Annual billing rate." },
  { label: "Hunter.io Starter \u00b7 seat",     monthlyCost: 34,   note: "Per-seat SaaS for backup email finder. Annual billing rate." },
];

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 6. SPRINT TIMELINE \u2014 how the seat cost evolves through the product roadmap
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface SprintMilestone {
  id: string;
  label: string;
  status: "shipped" | "in_progress" | "planned";
  shippedOn?: string;          // ISO date \u2014 informational
  description: string;
  addedModules?: string[];     // module slugs activated in this sprint
  costDelta: {
    /** Diff to medium-seat $ vs. previous sprint. Positive = cost went up. */
    mediumSeatUsd: number;
    note: string;
  };
}

export const SPRINTS: SprintMilestone[] = [
  {
    id: "v1-mvp",
    label: "Sprint 1 \u00b7 MVP Voice Dial",
    status: "shipped",
    shippedOn: "2026-03-15",
    description: "ATOM Dial only \u2014 single live call, no recording, no history. Hume EVI 3 + Twilio voice.",
    addedModules: ["atom-leadgen"],
    costDelta: { mediumSeatUsd: 14.5, note: "Establishes the seat-cost baseline." },
  },
  {
    id: "v2-pitch-objection",
    label: "Sprint 2 \u00b7 Pitch + Objection Handler",
    status: "shipped",
    shippedOn: "2026-03-28",
    description: "Pitch generation + real-time objection handler bolted on top of Dial.",
    addedModules: ["pitch", "objection-handler"],
    costDelta: { mediumSeatUsd: 0.95, note: "Claude reasoning bursts \u2014 small, bounded." },
  },
  {
    id: "v3-prospect-market",
    label: "Sprint 3 \u00b7 Prospect Engine + Market Intent",
    status: "shipped",
    shippedOn: "2026-04-10",
    description: "Apollo prospecting + Perplexity Sonar signal discovery.",
    addedModules: ["prospects", "prospects-phone-reveal", "market"],
    costDelta: { mediumSeatUsd: 81.5, note: "Apollo per-seat fee dominates ($79 fixed); Sonar queries are cheap." },
  },
  {
    id: "v4-campaign-multichannel",
    label: "Sprint 4 \u00b7 Auto-Dialer + Multi-Channel Outreach",
    status: "shipped",
    shippedOn: "2026-04-22",
    description: "Campaign queue mode + email + SMS sequences via Resend + Twilio.",
    addedModules: ["atom-campaign", "atom-multichannel", "atom-multichannel-sms"],
    costDelta: { mediumSeatUsd: 33.2, note: "Campaign minutes \u00d7 Hume + Twilio dominate." },
  },
  {
    id: "v5-warroom-chat",
    label: "Sprint 5 \u00b7 War Room + ATOM Chat",
    status: "shipped",
    shippedOn: "2026-05-02",
    description: "Deal-level Opus 4.5 reasoning + always-on assistant on every page.",
    addedModules: ["war-room", "atom-chat"],
    costDelta: { mediumSeatUsd: 6.4, note: "Opus is pricey but per-seat usage is bounded; Chat is small." },
  },
  {
    id: "v6-recording-replay",
    label: "Sprint 6 \u00b7 Call recording + history replay (current)",
    status: "shipped",
    shippedOn: "2026-05-11",
    description: "Twilio call recording with per-call toggle, history replay UI with sentiment scrubber.",
    costDelta: { mediumSeatUsd: 1.5, note: "Recording capture + storage. Storage cost grows monotonically with retention." },
  },
  {
    id: "v7-vibranium-ga",
    label: "Sprint 7 \u00b7 Vibranium GA (planned)",
    status: "planned",
    description: "Per-tenant ElevenLabs voice clones, GPT-5.5 routing for enterprise tier, full Aletheia engine, signal autopilot.",
    costDelta: { mediumSeatUsd: 22.0, note: "ElevenLabs Pro $99 (amortized across tenants) + GPT-5.5 premium routing for enterprise calls." },
  },
];

// ─────────────────────────────────────────────────────────────────────
// 7. RECOMMENDED PLAN STRUCTURE (the pricing we charge tenants)
// ─────────────────────────────────────────────────────────────────────
// Based on May 2026 prior pricing advice + the live competitor matrix in
// /atom_competitor_pricing.json. Designed so EVERY tier earns positive gross
// margin at the heavy-seat profile (see Margin Matrix in the UI).

export interface PlanTier {
  id: string;
  label: string;
  positioning: string;
  /** Monthly billing per-seat price. Annual is monthly × 12 × 0.83 (17% off). */
  monthlyPerSeat: number;
  annualPerSeat: number;
  minSeats: number;
  freeTrialDays: number;
  includes: string[];
  excludes?: string[];
  /** Module slugs available on this tier. Empty array = all modules. */
  includedModules: string[];   // slugs; empty = all
  /** Soft usage caps. Overage either rolls into the seat or is gated. */
  caps: {
    dialMinutesPerSeat?: number;
    campaignMinutesPerSeat?: number;
    emailsPerSeat?: number;
    smsPerSeat?: number;
    prospectEnrichmentsPerSeat?: number;
    phoneRevealsPerSeat?: number;
    signalQueriesPerSeat?: number;
    pitchesPerSeat?: number;
    warroomAnalysesPerSeat?: number;
    warbookQueriesPerSeat?: number;
  };
  highlight?: boolean;          // mark this as the recommended/anchor tier
  contactSales?: boolean;       // hide price, show "Contact sales"
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "recon",
    label: "Recon",
    positioning: "14-day free trial for solo evaluators — proof, not power.",
    monthlyPerSeat: 0,
    annualPerSeat: 0,
    minSeats: 1,
    freeTrialDays: 14,
    includes: [
      "100 Dial minutes",
      "50 prospect enrichments",
      "30 signal queries",
      "Watermarked ATOM voice (no clone)",
      "Email support · community Discord",
    ],
    excludes: ["Campaign auto-dialer", "WarBook", "War Room", "SSO"],
    includedModules: ["atom-leadgen", "prospects", "market", "pitch", "atom-chat"],
    caps: { dialMinutesPerSeat: 100, prospectEnrichmentsPerSeat: 50, signalQueriesPerSeat: 30, pitchesPerSeat: 10 },
  },
  {
    id: "striker",
    label: "Striker",
    positioning: "SMB sales teams — the everyday workhorse.",
    monthlyPerSeat: 99,
    annualPerSeat: 82,
    minSeats: 3,
    freeTrialDays: 14,
    includes: [
      "750 Dial + Campaign minutes",
      "1,500 multi-channel touches (email + SMS)",
      "500 prospect enrichments · 25 phone reveals",
      "250 Market Intent signals",
      "60 Pitch generations · 30 Objection lookups",
      "WarBook (read-only) · ATOM Chat",
      "Standard ATOM voice (shared)",
      "Email support",
    ],
    excludes: ["War Room", "Custom voice clone", "SSO/SAML"],
    includedModules: ["atom-leadgen", "atom-campaign", "atom-multichannel", "atom-multichannel-sms", "prospects", "prospects-phone-reveal", "market", "pitch", "objection-handler", "atom-chat", "warbook"],
    caps: { dialMinutesPerSeat: 400, campaignMinutesPerSeat: 350, emailsPerSeat: 1200, smsPerSeat: 300, prospectEnrichmentsPerSeat: 500, phoneRevealsPerSeat: 25, signalQueriesPerSeat: 250, pitchesPerSeat: 60, warbookQueriesPerSeat: 200 },
  },
  {
    id: "growth",
    label: "Growth",
    positioning: "Scaling teams — the anchor tier, where every module is on.",
    monthlyPerSeat: 199,
    annualPerSeat: 165,
    minSeats: 10,
    freeTrialDays: 14,
    highlight: true,
    includes: [
      "2,500 Dial + Campaign minutes",
      "5,000 multi-channel touches (email + SMS)",
      "2,000 prospect enrichments · 100 phone reveals",
      "1,000 Market Intent signals",
      "200 Pitches · 100 Objection lookups",
      "War Room (50 deal analyses)",
      "WarBook (read + write)",
      "Premium Sonar Pro signals",
      "Priority support · dedicated CSM after seat 25",
    ],
    includedModules: [],   // all modules
    caps: { dialMinutesPerSeat: 1500, campaignMinutesPerSeat: 1200, emailsPerSeat: 4000, smsPerSeat: 1000, prospectEnrichmentsPerSeat: 2000, phoneRevealsPerSeat: 100, signalQueriesPerSeat: 1000, pitchesPerSeat: 200, warroomAnalysesPerSeat: 50, warbookQueriesPerSeat: 600 },
  },
  {
    id: "advisory",
    label: "Advisory",
    positioning: "Mid-market teams — HVT pipeline, Vibranium console, dedicated success.",
    monthlyPerSeat: 449,
    annualPerSeat: 372,
    minSeats: 25,
    freeTrialDays: 14,
    includes: [
      "10,000 voice minutes (Dial + Campaign pooled)",
      "Unlimited multi-channel outreach",
      "10,000 prospect enrichments · 500 phone reveals",
      "Unlimited Market Intent + Sonar Reasoning Pro",
      "Unlimited Pitch + Objection Handler",
      "War Room HVT pipeline (200 analyses, multi-deal correlation)",
      "Vibranium GA console",
      "Dedicated CSM + quarterly business reviews",
      "API access",
    ],
    includedModules: [],
    caps: { dialMinutesPerSeat: 5000, campaignMinutesPerSeat: 5000, prospectEnrichmentsPerSeat: 10000, phoneRevealsPerSeat: 500, warroomAnalysesPerSeat: 200 },
  },
  {
    id: "enterprise",
    label: "Enterprise",
    positioning: "Large orgs — custom voice, compliance, SSO, premium routing.",
    monthlyPerSeat: 999,
    annualPerSeat: 829,
    minSeats: 50,
    freeTrialDays: 30,
    includes: [
      "Unlimited voice minutes (Hume Business tier, $0.04/min unit cost)",
      "Per-tenant ElevenLabs Professional voice clone",
      "GPT-5.5 premium routing on Enterprise calls (Claude Opus 4.5 fallback)",
      "Custom Twilio sub-account + numbers",
      "Unlimited everything else",
      "SSO / SAML · SCIM · audit logs",
      "24/7 SLA · 99.95% uptime",
      "Compliance & data residency (HIPAA / SOC 2 Type II)",
      "Quarterly executive review with the Nirmata team",
    ],
    includedModules: [],
    caps: {},     // unlimited
  },
  {
    id: "sovereign",
    label: "Sovereign",
    positioning: "Defense / Fortune 500 / quantum-adjacent buyers — dedicated infrastructure.",
    monthlyPerSeat: 0,
    annualPerSeat: 0,
    contactSales: true,
    minSeats: 250,
    freeTrialDays: 0,
    includes: [
      "Dedicated Akamai / Linode / Nvidia Blackwell inference quota",
      "On-prem deployment option",
      "FedRAMP-ready logging · ITAR-aware data handling",
      "White-glove onboarding (90-day implementation team)",
      "Custom voice clone library (multi-persona)",
      "Source-code escrow available",
      "Named engineering counterpart from Nirmata Holdings",
    ],
    includedModules: [],
    caps: {},
  },
];

// Add-on products — layered on top of any base plan to expand ACV without
// bloating the core tiers. Each is its own Stripe product with its own price.
export interface AddOn {
  id: string;
  label: string;
  description: string;
  monthlyPrice: number;
  unit: "per seat" | "per workspace" | "per agent" | "per number";
  category: "voice" | "intelligence" | "compliance" | "infra";
}

export const ADD_ONS: AddOn[] = [
  {
    id: "warbook-strategist",
    label: "WarBook AI Strategist Seat",
    description: "A second seat tuned for SDR managers / sales coaches. Read-write access to objection libraries, weekly playbook updates from won calls.",
    monthlyPrice: 149,
    unit: "per seat",
    category: "intelligence",
  },
  {
    id: "extra-voice-agent",
    label: "Additional Voice Agent",
    description: "Run a parallel persona (e.g. 'Adam from Akamai' + 'Maya from healthtech'). Adds another Hume EVI config slot and ATOM voice variant.",
    monthlyPrice: 39,
    unit: "per agent",
    category: "voice",
  },
  {
    id: "premium-intent",
    label: "Premium Intent Data Pack",
    description: "Bombora topic intent + BuiltWith tech stack signals layered into Market Intent. Adds ~120 new signal types.",
    monthlyPrice: 299,
    unit: "per workspace",
    category: "intelligence",
  },
  {
    id: "custom-voice-clone",
    label: "Custom ElevenLabs Voice Clone",
    description: "30-min training session + ElevenLabs Professional Voice Cloning. Voice is private to your tenant.",
    monthlyPrice: 199,
    unit: "per workspace",
    category: "voice",
  },
  {
    id: "api-throughput",
    label: "API Throughput Boost (10×)",
    description: "Lifts per-tenant rate limits on /api/* by 10×. Required for high-volume programmatic integrations.",
    monthlyPrice: 499,
    unit: "per workspace",
    category: "infra",
  },
  {
    id: "compliance-pack",
    label: "Compliance + Audit Pack",
    description: "SOC 2 Type II report access, exportable audit logs, GDPR / CCPA data-subject tools, US states AI-disclosure handling.",
    monthlyPrice: 399,
    unit: "per workspace",
    category: "compliance",
  },
  {
    id: "additional-number",
    label: "Additional Twilio Number",
    description: "Local or toll-free number provisioning + recording storage. Useful for territory / brand splits.",
    monthlyPrice: 19,
    unit: "per number",
    category: "infra",
  },
  {
    id: "signal-autopilot",
    label: "Signal Autopilot (Vibranium GA)",
    description: "Daily autonomous Sonar sweeps across your TAM. Surfaces new buying-intent signals every morning with auto-routed Pitch drafts.",
    monthlyPrice: 599,
    unit: "per workspace",
    category: "intelligence",
  },
];

/** Annual savings %  applied to month × 12 — standard SaaS lever. */
export const ANNUAL_DISCOUNT_PCT = 17;

// ─────────────────────────────────────────────────────────────────────
// 8. SEAT COST COMPUTATION (the function the UI calls)
// ─────────────────────────────────────────────────────────────────────

export interface ModuleSeatCost {
  module: ModuleCostLine;
  unitsPerSeat: number;
  variableCost: number;          // unitsPerSeat * costPerAction
}

export interface SeatCostResult {
  profile: SeatProfile;
  perSeatFixedCost: number;      // Apollo + Hunter etc.
  variableByModule: ModuleSeatCost[];
  pineconeRagCost: number;
  recordingStorageCost: number;  // monthly storage of THIS seat's recordings
  totalVariable: number;
  totalSeatCost: number;
}

export function computeSeatCost(profile: SeatProfile): SeatCostResult {
  const w = SEAT_PROFILES[profile].workload;

  const perSeatFixedCost = PER_SEAT_FIXED.reduce((s, c) => s + c.monthlyCost, 0);

  const variableByModule: ModuleSeatCost[] = MODULES.map((m) => {
    const units = m.unitsPerSeat(w);
    return { module: m, unitsPerSeat: units, variableCost: units * m.costPerAction };
  });

  // Pinecone RAG is shared across modules \u2014 charge once at the seat level.
  const pineconeRagCost = costPineconePerSeatMonth(w);

  // Recording storage \u2014 we keep 90 days. So month N stores everything from N-2..N.
  const monthlyMinutesRecorded = w.dialMinutesPerMonth + w.campaignMinutesPerMonth;
  const recordingStorageCost = monthlyMinutesRecorded * 3 * p.twilio_storage_per_min_mo;

  const totalVariable = variableByModule.reduce((s, r) => s + r.variableCost, 0)
                      + pineconeRagCost
                      + recordingStorageCost;

  return {
    profile,
    perSeatFixedCost,
    variableByModule,
    pineconeRagCost,
    recordingStorageCost,
    totalVariable,
    totalSeatCost: perSeatFixedCost + totalVariable,
  };
}

/** Last-updated timestamp shown in the UI so we know how stale numbers are. */
export const SEAT_COST_MODEL_UPDATED = "2026-05-11";
