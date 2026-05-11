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

  // ATOM Market Intent + Pitch (Perplexity Sonar research queries)
  signalQueriesPerMonth:    number;
  pitchGenerationsPerMonth: number;

  // ATOM Objection Handler + WarBook + WarRoom (Claude/GPT reasoning bursts)
  objectionHandlerCallsPerMonth: number;
  warroomAnalysesPerMonth:       number;

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

/** Pinecone RAG cost per seat per month. */
function costPineconePerSeatMonth(w: SeatWorkload): number {
  return (w.pineconeReadsPerMonth  / 1_000_000) * p.pinecone_read_per_million +
         (w.pineconeWritesPerMonth / 1_000_000) * p.pinecone_write_per_million +
         w.pineconeStorageGB * p.pinecone_storage_per_gb_mo;
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 4. MODULES
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface ModuleCostLine {
  /** Slug matches the module's sidebar route segment. */
  slug: string;
  label: string;
  description: string;
  /** What is this module's atomic billable action? */
  unit: string;
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
  {
    slug: "atom-leadgen",
    label: "ATOM Dial",
    description: "Live 1-on-1 AI voice call with Hume EVI 3 voice runtime.",
    unit: "minute of live call",
    costPerAction: costOneDialMinute(),
    providers: ["Hume EVI 3", "Twilio voice", "Twilio recording"],
    breakdown: `Hume $${p.hume_evi3_per_min}/min + Twilio voice $${p.twilio_voice_per_min}/min + recording $${p.twilio_recording_per_min}/min`,
    unitsPerSeat: (w) => w.dialMinutesPerMonth,
  },
  {
    slug: "atom-campaign",
    label: "ATOM Campaign \u00b7 Auto-Dialer",
    description: "Queue-mode dialing through a saved prospect list with one shared Hume session per cycle.",
    unit: "minute of campaign call",
    costPerAction: costOneDialMinute(),
    providers: ["Hume EVI 3", "Twilio voice", "Twilio recording"],
    breakdown: `Same per-minute cost as ATOM Dial \u2014 throughput is higher (200\u2013800 calls/mo)`,
    unitsPerSeat: (w) => w.campaignMinutesPerMonth,
  },
  {
    slug: "atom-multichannel",
    label: "Multi-Channel Outreach \u00b7 Email",
    description: "Pitch-driven email cadences sent via Resend with personalization tokens.",
    unit: "outbound email",
    costPerAction: costOneEmail(),
    providers: ["Resend", "Claude (tokenized personalization)"],
    breakdown: `Resend overage $${p.resend_overage_per_email}/email (above the 50K/mo included on Pro plan)`,
    unitsPerSeat: (w) => w.emailsSentPerMonth,
  },
  {
    slug: "atom-multichannel-sms",
    label: "Multi-Channel Outreach \u00b7 SMS",
    description: "Compliant outbound SMS bursts tied to a Pitch cadence step.",
    unit: "outbound SMS",
    costPerAction: costOneSms(),
    providers: ["Twilio SMS (+ carrier surcharge)"],
    breakdown: `Twilio base $${p.twilio_sms_per_msg}/msg (base + typical carrier surcharge)`,
    unitsPerSeat: (w) => w.smsSentPerMonth,
  },
  {
    slug: "prospects",
    label: "ATOM Prospect Engine",
    description: "Apollo-anchored prospecting with PDL fallback enrichment for emails/firmographics.",
    unit: "prospect enrichment",
    costPerAction: costOneProspectEnrichment(),
    providers: ["Apollo (included credits)", "PeopleDataLabs (overflow)"],
    breakdown: `Blended: 70% covered by Apollo seat credits, 30% PDL at $${p.pdl_person_enrich_per_call}/call`,
    unitsPerSeat: (w) => w.prospectEnrichmentsPerMonth,
  },
  {
    slug: "prospects-phone-reveal",
    label: "ATOM Prospect Engine \u00b7 Phone reveals",
    description: "Mobile phone number reveal on a contact \u2014 8 Apollo credits per reveal.",
    unit: "phone reveal",
    costPerAction: costOnePhoneReveal(),
    providers: ["Apollo (overage credits)"],
    breakdown: `Apollo overage: 8 credits \u00d7 $0.20 = $${p.apollo_phone_reveal_credit_cost}/reveal`,
    unitsPerSeat: (w) => w.phoneRevealsPerMonth,
  },
  {
    slug: "market",
    label: "ATOM Market Intent",
    description: "Perplexity Sonar signal discovery (LinkedIn posts, funding events, hiring spikes).",
    unit: "signal query",
    costPerAction: costOneSignalQuery(),
    providers: ["Perplexity Sonar"],
    breakdown: `Per-request fee $${p.pplx_sonar_request_fee} + ~700 tokens at $${p.pplx_sonar_in_per_mtok}/MTok`,
    unitsPerSeat: (w) => w.signalQueriesPerMonth,
  },
  {
    slug: "pitch",
    label: "ATOM Pitch",
    description: "Bespoke pitch generation \u2014 Claude Sonnet 4.6 with the full prospect brief + objections.",
    unit: "pitch generated",
    costPerAction: costOnePitchGeneration(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~4.5K in + 1.2K out @ $${p.anthropic_sonnet_in_per_mtok}/$${p.anthropic_sonnet_out_per_mtok} per MTok`,
    unitsPerSeat: (w) => w.pitchGenerationsPerMonth,
  },
  {
    slug: "objection-handler",
    label: "ATOM Objection Handler",
    description: "Real-time objection rebuttal lookups during a live call.",
    unit: "objection lookup",
    costPerAction: costOneObjectionHandler(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~1.8K in + 400 out tokens per request`,
    unitsPerSeat: (w) => w.objectionHandlerCallsPerMonth,
  },
  {
    slug: "war-room",
    label: "ATOM War Room",
    description: "Deal-level reasoning bursts (truth score, leverage, ghost probability) via Claude Opus 4.5.",
    unit: "war-room analysis",
    costPerAction: costOneWarroomAnalysis(),
    providers: ["Anthropic Claude Opus 4.5"],
    breakdown: `~8K in + 2.2K out @ $${p.anthropic_opus_in_per_mtok}/$${p.anthropic_opus_out_per_mtok} per MTok`,
    unitsPerSeat: (w) => w.warroomAnalysesPerMonth,
  },
  {
    slug: "atom-chat",
    label: "ATOM Chat (page-level assistant)",
    description: "Always-on ATOM assistant available on every page \u2014 context-aware Q&A.",
    unit: "chat message",
    costPerAction: costOneAtomChatMessage(),
    providers: ["Anthropic Claude Sonnet 4.6"],
    breakdown: `~1.2K in + 350 out tokens per turn`,
    unitsPerSeat: (w) => w.atomChatMessagesPerMonth,
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

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// 7. SEAT COST COMPUTATION (the function the UI calls)
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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
