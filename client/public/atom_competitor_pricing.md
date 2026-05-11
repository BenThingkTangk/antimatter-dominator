# ATOM Sales Dominator — Competitor Pricing Matrix
**As of May 2026 (latest available public / third-party verified pricing)**

> **Notes on data quality**
> - All prices are USD, per seat/user per month, billed annually unless noted.
> - Per-minute AI-voice platforms are listed on a per-minute basis — there is no per-seat equivalent.
> - Prices marked `QUOTE_ONLY` have no publicly listed price; estimates from third-party procurement data (Vendr, ITQlick, MarketBetter) are noted as such and should not be used as official list prices.
> - Sources are linked for every entry.

---

## Module 1 — ATOM DIAL (Live AI Voice Calls)

| Vendor | Plan | $/min or $/seat/mo | Included Usage | Annual Billed | Source |
|---|---|---|---|---|---|
| Bland AI | Build | $0.12/min + $299/mo platform | 50 concurrent calls, 2,000 calls/day | Yes (platform fee) | https://www.bland.ai/pricing |
| Bland AI | Scale | $0.11/min + $499/mo platform | 100 concurrent calls, 5,000 calls/day | Yes (platform fee) | https://www.bland.ai/pricing |
| Retell AI | Pay-as-you-go | $0.07–0.08/min (voice engine) | No platform fee, 60 free min, 20 concurrent | No (PAYG) | https://www.retellai.com/pricing |
| Synthflow AI | Pro | $0.13/min overage + $375/mo | 2,000 min included, 25 concurrent | Yes | https://synthflow.ai/pricing |
| Synthflow AI | Growth | $0.12/min overage + $750/mo | 4,000 min included, 50 concurrent | Yes | https://synthflow.ai/pricing |
| Air.ai | Outbound | $0.11/min | Outbound campaigns; telephony via Twilio extra | No (PAYG) | https://tekpon.com/software/air-ai/pricing/ |
| Vapi.ai | Ad-Hoc | $0.05/min platform fee | All-in effective rate ~$0.18–0.33/min incl. LLM/TTS | No (PAYG) | https://vapi.ai/pricing |

**Notes:**
- Vapi.ai does not publish packaged plan pricing publicly; their website redirects to a newsletter. The $0.05/min is the base platform fee only; full all-in costs (adding LLM, TTS, STT) typically run $0.18–$0.33/min per Telnyx and Synthflow analyses.
- Retell AI uses a modular add-on model: base $0.07/min + LLM costs (~$0.04–0.08/min for GPT-4.1) + TTS (~$0.015/min) = realistic all-in of $0.11–$0.15/min.
- Air.ai inbound/API calls are $0.32/min; outbound is $0.11/min.
- PolyAI and Sierra.ai are enterprise/QUOTE_ONLY — no public pricing found.

```yaml
module: atom_dial
competitors:
  - vendor: "Bland AI"
    plan: "Build"
    per_minute_usd: 0.12
    platform_fee_per_month_usd: 299
    included: "50 concurrent calls, 2,000 calls/day"
    annual_billed: false
    note: "Per-minute billing + monthly platform fee; no annual seat price"
    source: "https://www.bland.ai/pricing"
  - vendor: "Bland AI"
    plan: "Scale"
    per_minute_usd: 0.11
    platform_fee_per_month_usd: 499
    included: "100 concurrent calls, 5,000 calls/day"
    annual_billed: false
    note: "Per-minute billing + monthly platform fee"
    source: "https://www.bland.ai/pricing"
  - vendor: "Retell AI"
    plan: "Pay-as-you-go"
    per_minute_usd: 0.07
    platform_fee_per_month_usd: 0
    included: "60 free minutes, 20 concurrent calls, 10 free Knowledge Bases"
    annual_billed: false
    note: "Base voice engine only; LLM/TTS costs extra. All-in ~$0.11–0.15/min"
    source: "https://www.retellai.com/pricing"
  - vendor: "Synthflow AI"
    plan: "Pro"
    per_minute_usd: 0.13
    platform_fee_per_month_usd: 375
    included: "2,000 min/mo included, 25 concurrent calls"
    annual_billed: true
    source: "https://synthflow.ai/pricing"
  - vendor: "Air.ai"
    plan: "Outbound Campaigns"
    per_minute_usd: 0.11
    platform_fee_per_month_usd: 0
    included: "Outbound only; telephony via Twilio billed separately"
    annual_billed: false
    note: "Inbound/API calls at $0.32/min"
    source: "https://tekpon.com/software/air-ai/pricing/"
  - vendor: "Vapi.ai"
    plan: "Ad-Hoc"
    per_seat_per_month_usd: null
    per_minute_usd: 0.05
    included: "Platform fee only; LLM, TTS, STT billed separately. All-in ~$0.18–0.33/min"
    annual_billed: false
    note: "No packaged plans published; pricing page does not render tiers publicly"
    source: "https://vapi.ai/pricing"
```

---

## Module 2 — ATOM CAMPAIGN AUTO-DIALER (Queue-Mode Outbound)

| Vendor | Plan | $/seat/mo (annual) | Included Usage | Annual Billed | Source |
|---|---|---|---|---|---|
| Orum | Launch | $250 | Unlimited calls, virtual salesfloor, AI features; 3-seat min | Yes (annual contract) | https://www.orum.com/pricing |
| Nooks | All-inclusive | ~$417 ($5,000/user/yr) | Parallel dialing (5 lines), virtual salesfloor, AI coaching, CRM sync | Yes (annual only) | https://outboundsalespro.com/nooks-reviews/ |
| Aircall | Essentials | $30 | Unlimited inbound/outbound (US), 1 number; 3-license min | Yes | https://aircall.io/pricing/ |
| Aircall | Professional | $50 | Power dialer, Salesforce integration, voicemail drop; 3-license min | Yes | https://aircall.io/pricing/ |
| JustCall | Team | $29 | Unlimited calls (US/Canada), unlimited AI transcription, 500 SMS segments/user | Yes | https://justcall.io/pricing/ |
| JustCall | Pro | $49 | Everything in Team + 1,000 SMS, advanced automations | Yes | https://justcall.io/pricing/ |
| Dialpad AI Sales | Essentials | $60 | AI-powered sales dialer, coaching, CRM integrations | Yes | https://www.dialpad.com/pricing/ |

**Notes:**
- Orum's Ascend plan for mid-large teams is QUOTE_ONLY.
- Nooks does not publish pricing on its website; $5,000/user/year ($417/mo) is the widely reported list price from third-party sources.
- Salesloft Cadence/Dialer and Outreach are covered in the Bundled Platforms section.

```yaml
module: atom_campaign_auto_dialer
competitors:
  - vendor: "Orum"
    plan: "Launch"
    per_seat_per_month_usd: 250
    included: "Unlimited calls, virtual salesfloor, basic AI features; 3-seat minimum"
    annual_billed: true
    note: "Annual contract required; Ascend plan is QUOTE_ONLY"
    source: "https://www.orum.com/pricing"
  - vendor: "Nooks"
    plan: "All-inclusive"
    per_seat_per_month_usd: 417
    included: "Parallel dialing (5 lines), virtual salesfloor, AI battle cards, CRM sync, Spotify integration"
    annual_billed: true
    note: "~$5,000/user/year; pricing not published on website — third-party estimate"
    source: "https://outboundsalespro.com/nooks-reviews/"
  - vendor: "Aircall"
    plan: "Professional"
    per_seat_per_month_usd: 50
    included: "Power dialer, Salesforce integration, voicemail drop, 3-license minimum"
    annual_billed: true
    source: "https://aircall.io/pricing/"
  - vendor: "JustCall"
    plan: "Pro"
    per_seat_per_month_usd: 49
    included: "Unlimited calls (US/Canada), 1,000 SMS segments/user, AI transcription, automations"
    annual_billed: true
    source: "https://justcall.io/pricing/"
  - vendor: "Dialpad AI Sales"
    plan: "Essentials"
    per_seat_per_month_usd: 60
    included: "AI sales dialer, real-time coaching, CRM integrations"
    annual_billed: true
    source: "https://www.dialpad.com/pricing/"
```

---

## Module 3 — ATOM MULTI-CHANNEL OUTREACH (Email + SMS Sequences)

| Vendor | Plan | $/seat/mo (annual) | Included Usage | Annual Billed | Source |
|---|---|---|---|---|---|
| Outreach.io | Engage | ~$100–$130 | Core sequencing, dialer, CRM sync; AI add-ons extra | Yes (annual contract) | https://marketbetter.ai/blog/outreach-pricing-breakdown-2026/ |
| Reply.io | Multichannel | $89 | Unlimited contacts, email + LinkedIn + SMS + calls, 10K data credits/mo | Yes | https://reply.io/pricing/ |
| Lemlist | Multichannel Expert | $87 | Email + LinkedIn + calling, unlimited contacts, landing pages | Yes (20% off vs monthly) | https://www.lemlist.com/pricing |
| Instantly.ai | Hypergrowth | ~$78 (annual) | Unlimited email accounts, warmup, 25K uploaded contacts, 100K emails/mo | Yes | https://instantly.ai/pricing |
| Smartlead | Pro | ~$78 (annual) | 30K contacts, 90K email sends, unlimited mailboxes, API, webhooks | Yes (~17% off) | https://www.smartlead.ai/pricing |
| Salesloft | Advanced | ~$125–$165 | Cadences, dialer add-on separate (~$300/user/yr), coaching; QUOTE_ONLY | Yes (annual contract) | https://www.landbase.com/blog/salesloft-pricing |

**Notes:**
- Outreach Engage is listed at $100–$130/user/mo based on Vendr marketplace data; the official website shows "Contact Sales."
- Salesloft does not publish pricing; $125–$165 is a third-party estimate.
- Instantly.ai pricing is workspace-based (not per-seat); the $37.60–$77.60/mo annual rates cover a team workspace (unlimited email accounts), not a per-seat fee.

```yaml
module: atom_multi_channel_outreach
competitors:
  - vendor: "Reply.io"
    plan: "Multichannel"
    per_seat_per_month_usd: 89
    included: "Unlimited contacts, email + LinkedIn + SMS + calls, 10,000 data search credits/mo"
    annual_billed: true
    source: "https://reply.io/pricing/"
  - vendor: "Lemlist"
    plan: "Multichannel Expert"
    per_seat_per_month_usd: 87
    included: "Email + LinkedIn + calling, unlimited contacts, landing pages, lead finder"
    annual_billed: true
    note: "Annual billing; monthly is $109/user"
    source: "https://www.lemlist.com/pricing"
  - vendor: "Instantly.ai"
    plan: "Hypergrowth"
    per_seat_per_month_usd: null
    workspace_per_month_usd: 78
    included: "Unlimited email accounts, warmup, 25K contacts, 100K emails/mo (workspace-based, not per-seat)"
    annual_billed: true
    note: "Flat workspace pricing, not per-seat; covers unlimited team members"
    source: "https://instantly.ai/pricing"
  - vendor: "Smartlead"
    plan: "Pro"
    per_seat_per_month_usd: null
    workspace_per_month_usd: 78
    included: "30,000 active contacts, 90,000 emails/mo, unlimited email accounts, API, webhooks; workspace-based pricing"
    annual_billed: true
    note: "17% off with annual; flat workspace not per-seat"
    source: "https://www.smartlead.ai/pricing"
  - vendor: "Outreach.io"
    plan: "Engage"
    per_seat_per_month_usd: 120
    included: "Core sequencing, dialer, CRM sync, basic AI; advanced AI/Amplify credits extra"
    annual_billed: true
    note: "No public pricing; ~$100–$140/user/mo per Vendr/MarketBetter data. Annual contract required."
    source: "https://marketbetter.ai/blog/outreach-pricing-breakdown-2026/"
```

---

## Module 4 — ATOM PROSPECT ENGINE (Lead Discovery + Enrichment)

| Vendor | Plan | $/seat/mo (annual) | Included Credits | Annual Billed | Source |
|---|---|---|---|---|---|
| Apollo.io | Basic | $49 | 5,000 export credits/mo, unlimited email credits | Yes | https://www.apollo.io/pricing |
| Apollo.io | Professional | $79 | 10,000 export credits, advanced automation, dialer | Yes | https://www.apollo.io/pricing |
| Apollo.io | Organization | $119 | 15,000 export credits, 3-user min, custom reports, API | Yes | https://www.apollo.io/pricing |
| Lusha | Pro | $22.45 | 250 credits/mo (1 credit ≈ 1 contact), basic enrichment | Yes | https://www.lusha.com/pricing/ |
| Lusha | Premium | $52.45 | 600 credits/mo, bulk show (25 contacts), job change alerts | Yes | https://www.lusha.com/pricing/ |
| Clay | Starter | $134 (workspace) | 2,000 credits/mo, up to 5 users | Yes | https://www.clay.com/pricing |
| Clay | Explorer | $314 (workspace) | 10,000 credits/mo, up to 10 users | Yes | https://www.clay.com/pricing |
| Cognism | Standard (est.) | QUOTE_ONLY | ~$15K platform fee + ~$1,500/user/yr (third-party estimate) | Yes | https://www.cognism.com/pricing |
| ZoomInfo Sales | All tiers | QUOTE_ONLY | Custom credits; ~$10K/yr baseline per ZoomInfo reps | Yes | https://www.zoominfo.com/pricing |

**Notes:**
- Clay is workspace/team-priced, not per-seat; $134/mo covers up to 5 users and 2,000 enrichment credits.
- Cognism has no public pricing. The $15K platform fee + $1,500/user/yr estimate comes from Amplemarket/Landbase third-party procurement analyses.
- ZoomInfo has no published tiers; quotes start around $10,000/year for basic setups per ZoomInfo's own blog.

```yaml
module: atom_prospect_engine
competitors:
  - vendor: "Apollo.io"
    plan: "Basic"
    per_seat_per_month_usd: 49
    included: "5,000 export credits/mo, unlimited email credits, basic CRM integration"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Apollo.io"
    plan: "Professional"
    per_seat_per_month_usd: 79
    included: "10,000 export credits/mo, advanced automation, A/B testing, dialer"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Apollo.io"
    plan: "Organization"
    per_seat_per_month_usd: 119
    included: "15,000 export credits/mo, 3-user min, call transcripts, custom reports, API"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Lusha"
    plan: "Pro"
    per_seat_per_month_usd: 22.45
    included: "250 credits/mo (1 credit ≈ 1 verified contact), up to 3 seats"
    annual_billed: true
    source: "https://www.lusha.com/pricing/"
  - vendor: "Lusha"
    plan: "Premium"
    per_seat_per_month_usd: 52.45
    included: "600 credits/mo, bulk show (25 at once), job change alerts, advanced filters"
    annual_billed: true
    source: "https://www.lusha.com/pricing/"
  - vendor: "Clay"
    plan: "Explorer"
    per_seat_per_month_usd: null
    workspace_per_month_usd: 314
    included: "10,000 enrichment credits/mo, up to 10 users, 180+ data providers"
    annual_billed: true
    note: "Workspace pricing, not per-seat; $314/mo covers up to 10 users"
    source: "https://www.clay.com/pricing"
  - vendor: "Cognism"
    plan: "Standard"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — est. ~$15K/yr platform fee + ~$1,500/user/yr (third-party estimate, not public list price)"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing page"
    source: "https://www.cognism.com/pricing"
  - vendor: "ZoomInfo Sales"
    plan: "All tiers"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — custom credits; baseline ~$10K/yr for smallest setups"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing page"
    source: "https://www.zoominfo.com/pricing"
```

---

## Module 5 — ATOM MARKET INTENT (Signal Discovery / Buying Intent)

| Vendor | Plan | $/seat/mo or $/yr | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| Warmly | Orchestrate | From $15,000/yr (~$1,250/mo workspace) | 1st, 2nd, 3rd party signals, visitor ID | Yes | https://www.warmly.ai/p/pricing |
| Warmly | Capture | From $30,000/yr (~$2,500/mo workspace) | Full inbound capture stack | Yes | https://www.warmly.ai/p/pricing |
| Koala (getkoala.com) | Starter | $200/mo (workspace) | 2 seats, 1,000 credits/mo | No (monthly) | https://getkoala.com/pricing |
| Koala (getkoala.com) | Growth | $1,000/mo (workspace) | 3 seats, 5,000 credits/mo | No (monthly) | https://getkoala.com/pricing |
| 6sense | All paid tiers | QUOTE_ONLY | Est. $50K–$130K+/yr; median ~$55K/yr (Vendr) | Yes (multi-year) | https://salesmotion.io/blog/6sense-pricing |
| Demandbase | Professional | QUOTE_ONLY | Est. $45K–$65K/yr; onboarding ~$29K extra | Yes | https://salesmotion.io/blog/demandbase-pricing |
| Bombora | All tiers | QUOTE_ONLY | Intent topic subscriptions; custom volume | Yes | https://bombora.com/our-data/ |

**Notes:**
- 6sense, Bombora, and Demandbase are all QUOTE_ONLY with no public pricing. Estimates from third-party procurement marketplaces are provided for context.
- Warmly is a workspace/platform fee — not per-seat.
- Koala (getkoala.com) is the sales intent tool; do not confuse with Koala.sh which is an AI writing tool.
- Common Room, Userled, UserGems — no public pricing found; all appear QUOTE_ONLY.

```yaml
module: atom_market_intent
competitors:
  - vendor: "Warmly"
    plan: "Orchestrate"
    per_seat_per_month_usd: null
    platform_per_year_usd: 15000
    included: "1st, 2nd, 3rd-party signals, visitor identification, AI chat, no per-seat fees"
    annual_billed: true
    note: "Workspace pricing, starting at $15K/yr; usage-based visitor reveal charges extra"
    source: "https://www.warmly.ai/p/pricing"
  - vendor: "Koala"
    plan: "Growth"
    per_seat_per_month_usd: null
    workspace_per_month_usd: 1000
    included: "3 seats included, 5,000 credits/mo, intent signal workflows"
    annual_billed: false
    source: "https://getkoala.com/pricing"
  - vendor: "6sense"
    plan: "Sales Intelligence + Predictive AI"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — est. ~$50K/yr; median $55,211/yr (Vendr); 2-year contract typical"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing"
    source: "https://salesmotion.io/blog/6sense-pricing"
  - vendor: "Demandbase"
    plan: "Professional"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — est. $45K–$65K/yr + ~$29K onboarding; per-user fees $1,200–$3,000/seat/yr extra"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing"
    source: "https://salesmotion.io/blog/demandbase-pricing"
```

---

## Module 6 — ATOM PITCH (AI Sales Pitch / Personalized Messaging Generation)

| Vendor | Plan | $/seat/mo (annual) | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| Lavender | Starter | $27 | Unlimited email coaching, personalization, AI writer, Gmail/Outlook | Yes | https://www.lavender.ai/coach |
| Lavender | Individual Pro | $45 | Everything in Starter + integrations, priority support, dedicated CSM | Yes | https://www.lavender.ai/coach |
| Lavender | Team Plan | $89 | Everything + coaching dashboard, team analytics, shared templates | Yes | https://www.lavender.ai/coach |
| Regie.ai | AI SEP | $180 | Sequencing agents, intent prioritization, power dialer + coaching, social outreach | Yes (annual) | https://www.regie.ai/pricing |
| Regie.ai | Force Multiplier Rep | $499 | Autonomous prospecting agents, expanded multi-channel, advanced personalization | Yes (annual) | https://www.regie.ai/pricing |
| Copy.ai | Chat plan | ~$6/seat/mo ($29/mo for 5 seats) | Unlimited words/chat, OpenAI/Anthropic/Gemini models, 5 seats | Yes | https://www.copy.ai/prices |
| Jasper | Pro | $59/mo (workspace) | Advanced AI, multi-brand, collaboration; per-workspace not per-seat | Yes | https://www.jasper.ai/pricing |

**Notes:**
- Twain and Humantic AI do not publish pricing publicly; both appear QUOTE_ONLY.
- Lavender's monthly (non-annual) prices are $29/mo (Starter), $49/mo (Individual Pro), $99/seat/mo (Team).
- Copy.ai Chat is $29/mo for 5 seats (effectively ~$6/seat/mo).
- Regie.ai also offers an AI Parallel Dialer add-on at $150/user/mo ($1,800/user/yr).

```yaml
module: atom_pitch
competitors:
  - vendor: "Lavender"
    plan: "Starter"
    per_seat_per_month_usd: 27
    included: "Unlimited email scoring, AI coaching, personalization, multi-inbox, Gmail + Outlook"
    annual_billed: true
    source: "https://www.lavender.ai/coach"
  - vendor: "Lavender"
    plan: "Individual Pro"
    per_seat_per_month_usd: 45
    included: "Everything in Starter + integrations (Outreach, Salesloft, etc.), dedicated CSM"
    annual_billed: true
    source: "https://www.lavender.ai/coach"
  - vendor: "Lavender"
    plan: "Team Plan"
    per_seat_per_month_usd: 89
    included: "Everything in Pro + team coaching dashboard, aggregated analytics, content studio"
    annual_billed: true
    source: "https://www.lavender.ai/coach"
  - vendor: "Regie.ai"
    plan: "AI SEP"
    per_seat_per_month_usd: 180
    included: "Static + dynamic sequencing agents, intent prioritization, power dialer, AI coaching, voicemails, social outreach"
    annual_billed: true
    source: "https://www.regie.ai/pricing"
  - vendor: "Regie.ai"
    plan: "Force Multiplier Rep"
    per_seat_per_month_usd: 499
    included: "Autonomous prospecting agents, full multi-channel outreach, advanced AI personalization, priority support"
    annual_billed: true
    source: "https://www.regie.ai/pricing"
  - vendor: "Copy.ai"
    plan: "Chat (5 seats)"
    per_seat_per_month_usd: 6
    included: "Unlimited words in chat, OpenAI/Anthropic/Gemini access, 5 seats per $29/mo workspace"
    annual_billed: false
    note: "Workspace plan ($29/mo total for 5 seats). Agents plan ($249/mo for 10 seats) adds workflow credits."
    source: "https://www.copy.ai/prices"
```

---

## Module 7 — ATOM OBJECTION HANDLER (Real-Time Call Coaching / Battle Cards)

| Vendor | Plan | $/seat/mo (annual) | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| Gong | Foundations | ~$133/seat/mo ($1,600/user/yr) + $50K/yr platform fee | Call recording, transcription, AI summaries, deal intelligence | Yes | https://www.tropicapp.io/glossary/gong-price |
| Clari Copilot (fmr. Wingman) | Growth add-on | $60 | Call recording, transcription, keyword tracking (add-on to Clari Core) | Yes | https://docket.io/resources/research/clari-pricing |
| Clari Copilot | Accelerator add-on | $90 | Advanced coaching, battle cards, objection handling | Yes | https://docket.io/resources/research/clari-pricing |
| Clari Copilot | Enterprise add-on | $110 | Full enterprise features, API, dedicated CSM | Yes | https://docket.io/resources/research/clari-pricing |
| Chorus.ai (ZoomInfo) | Base package | ~$222/seat/mo ($8K base for 3 seats, $1,200/additional seat/yr) | Unlimited recording, AI transcription, CRM integration; 2-year contract typical | Yes | https://www.itsconvo.com/pricing/chorus |
| Avoma | Organization | $29 | Custom AI notes, conversation intelligence, group scheduling, up to 100 seats | Yes | https://www.avoma.com/pricing |
| Avoma | Startup | $19 | Unlimited AI meeting assistant, 1:1 scheduling, up to 25 seats | Yes | https://www.avoma.com/pricing |

**Notes:**
- Gong introduced a $50,000/yr platform fee in March 2025; per-seat list is $1,600/yr ($133/mo). Actual negotiated prices run $1,000–$1,349/user/yr per Tropic data.
- Chorus.ai pricing is not publicly published; the $8,000 base (3 seats) + $1,200/additional seat/yr figure comes from third-party buyer reports.
- Avoma's Conversation Intelligence is available as a $29/seat/mo add-on to base plans.
- Clari Copilot pricing is third-party estimated; Clari does not publish pricing.

```yaml
module: atom_objection_handler
competitors:
  - vendor: "Gong"
    plan: "Foundations"
    per_seat_per_month_usd: 133
    included: "Call recording, transcription, AI summaries, deal intelligence; $50K/yr platform fee additional"
    annual_billed: true
    note: "List price $1,600/user/yr ($133/mo) + $50K platform fee. Actual negotiated range $1,000–$1,349/user/yr per Tropic."
    source: "https://www.tropicapp.io/glossary/gong-price"
  - vendor: "Clari Copilot"
    plan: "Accelerator (add-on)"
    per_seat_per_month_usd: 90
    included: "Call recording, transcription, AI summaries, objection handling, battle cards; add-on to Clari Core"
    annual_billed: true
    note: "QUOTE_ONLY — third-party estimate; requires Clari Core ($100–120/user/mo) as base"
    source: "https://docket.io/resources/research/clari-pricing"
  - vendor: "Chorus.ai (ZoomInfo)"
    plan: "Base Package"
    per_seat_per_month_usd: 222
    included: "3-seat minimum ($8,000/yr base), unlimited recording, AI transcription, CRM integration"
    annual_billed: true
    note: "QUOTE_ONLY — third-party estimate. Additional seats ~$100/mo ($1,200/yr). 2-year contract typical."
    source: "https://www.itsconvo.com/pricing/chorus"
  - vendor: "Avoma"
    plan: "Organization"
    per_seat_per_month_usd: 29
    included: "Custom AI notes, conversation intelligence, group/round-robin scheduling, up to 100 paid seats"
    annual_billed: true
    source: "https://www.avoma.com/pricing"
```

---

## Module 8 — ATOM WAR ROOM (Deal Intelligence / Forecasting / Risk)

| Vendor | Plan | $/seat/mo (annual) | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| Gong Forecast | Forecast add-on | ~$58/seat/mo ($700/user/yr) | Pipeline forecasting, deal risk identification, revenue context | Yes | https://www.tropicapp.io/glossary/gong-price |
| Gong | Foundations + Forecast bundle | ~$192/seat/mo ($2,300/user/yr) | Call intel + forecasting; platform fee $50K/yr extra | Yes | https://docket.io/resources/research/gong-pricing |
| Clari Core | Forecast | ~$100–$120/seat/mo | AI-powered revenue forecasting, pipeline inspection, analytics | Yes | https://docket.io/resources/research/clari-pricing |
| People.ai | Core SalesAI | ~$50/seat/mo (est.) | Activity capture, revenue intelligence, deal scoring (entry-level est.) | Yes | https://saleshive.com/vendors/people-ai/ |
| Avoma | Revenue Intelligence (add-on) | $29/seat/mo | Deal risk alerts, pipeline health, AI sales methodology tracking, forecasting | Yes | https://www.avoma.com/pricing |

**Notes:**
- Gong Forecast list price is $700/user/yr ($58/mo); actual negotiated prices per Tropic are $475–$603/user/yr.
- Clari does not publish pricing; the $100–$120/seat/mo figure is widely reported from third-party procurement data.
- People.ai has a free PeopleGlass tier for Salesforce users; paid SalesAI starts at ~$50/seat/mo per SalesHive analysis.
- BoostUp, Aviso, Revenue Grid, InsightSquared — all QUOTE_ONLY with no published pricing found.

```yaml
module: atom_war_room
competitors:
  - vendor: "Gong"
    plan: "Forecast add-on"
    per_seat_per_month_usd: 58
    included: "AI-powered pipeline forecasting, deal risk identification, revenue context insights"
    annual_billed: true
    note: "List $700/user/yr; negotiated range $475–$603/user/yr (Tropic). Requires Gong Foundations + $50K platform fee."
    source: "https://www.tropicapp.io/glossary/gong-price"
  - vendor: "Clari"
    plan: "Forecast (Core)"
    per_seat_per_month_usd: 110
    included: "AI revenue forecasting, pipeline inspection, deal scoring, Salesforce + Dynamics 365 integration"
    annual_billed: true
    note: "QUOTE_ONLY — third-party estimate $100–$120/user/mo. Copilot and Groove add-ons priced separately."
    source: "https://docket.io/resources/research/clari-pricing"
  - vendor: "Avoma"
    plan: "Revenue Intelligence add-on"
    per_seat_per_month_usd: 29
    included: "Dealboard pipeline review, deal risk alerts, AI methodology tracker, roll-up forecasting"
    annual_billed: true
    source: "https://www.avoma.com/pricing"
  - vendor: "People.ai"
    plan: "SalesAI"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — activity capture, deal scoring, revenue intelligence; free PeopleGlass tier available for Salesforce users"
    annual_billed: true
    note: "No public pricing; entry-level est. ~$50/seat/mo per third-party reports"
    source: "https://saleshive.com/vendors/people-ai/"
```

---

## Module 9 — ATOM WARBOOK (Sales Playbooks / Battle Cards / Enablement)

| Vendor | Plan | $/seat/mo (annual) | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| Guru | Self-serve | $25 | Knowledge base, AI search, 10-seat minimum ($250/mo total min) | Yes | https://www.getguru.com/pricing |
| Highspot | Enterprise | QUOTE_ONLY | Content management, sales plays, analytics, training, AI; avg $91K/yr (Vendr) | Yes | https://www.highspot.com/pricing/ |
| Seismic | Professional | QUOTE_ONLY | Enablement cloud; est. $30–$60/user/mo per procurement benchmarks | Yes | https://www.seismic.com |
| Mindtickle | Core Readiness | QUOTE_ONLY | Onboarding, training, coaching, content mgmt; est. $100–$200/user/yr (core only) | Yes | https://www.mindtickle.com |
| Showpad | All tiers | QUOTE_ONLY | Content + coaching; est. $80–$160/user/yr per Vendr/Mindtickle comparison | Yes | n/a |

**Notes:**
- Guru is the only vendor in this category with a published, self-serve list price.
- Highspot, Seismic, Mindtickle, and Showpad all require sales conversations for pricing.
- Highspot average contract value is $91,460/yr per Vendr (62 deals); per-seat estimates from Reddit/G2 are $45–$65/seat/mo.
- Seismic per-seat estimates are $30–$60/user/mo for Professional tier per procurement benchmark data.
- Mindtickle Core Readiness Platform is typically $100–$200/user/yr — note this is per-YEAR, not per-month.
- Allego is another competitor; no public pricing found.

```yaml
module: atom_warbook
competitors:
  - vendor: "Guru"
    plan: "Self-serve"
    per_seat_per_month_usd: 25
    included: "AI-powered knowledge base, search, chat, Slack/Salesforce/SharePoint integrations; 10-seat minimum"
    annual_billed: true
    note: "Minimum 10 seats = $250/mo minimum. Enterprise plan is QUOTE_ONLY."
    source: "https://www.getguru.com/pricing"
  - vendor: "Highspot"
    plan: "Enterprise"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — content management, sales plays, analytics, training, AI enablement; avg $91,460/yr (Vendr); est. $45–65/seat/mo"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing. Average contract $91,460/yr per Vendr (62 deals)."
    source: "https://www.highspot.com/pricing/"
  - vendor: "Seismic"
    plan: "Professional Edition"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — enablement cloud, content management, analytics; est. $30–$60/user/mo per procurement benchmarks"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing. Typical deployment $20K–$120K/yr (SpendFlo)."
    source: "https://www.seismic.com"
  - vendor: "Mindtickle"
    plan: "Core Readiness"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — onboarding, training, coaching, call AI add-on; est. $100–$200/user/year core; median contract $44,054/yr (Vendr)"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing. Median contract $44,054/yr per Vendr (62 purchases)."
    source: "https://www.vendr.com/marketplace/mindtickle"
```

---

## Bundled Platform Competitors

| Vendor | Plan | $/seat/mo (annual) | Included | Annual Billed | Source |
|---|---|---|---|---|---|
| HubSpot Sales Hub | Starter | $15 | Pipeline mgmt, 1 sequence limit, basic automation, email integration | Yes | https://www.hubspot.com/pricing/sales |
| HubSpot Sales Hub | Professional | $90 | 300 workflows, sequences, calling, forecasting, reporting; $1,500 onboarding fee | Yes | https://www.hubspot.com/pricing/sales |
| HubSpot Sales Hub | Enterprise | $150 | 1,000 workflows, custom objects, advanced permissions; $3,500 onboarding | Yes | https://www.hubspot.com/pricing/sales |
| Salesforce Sales Cloud | Starter Suite | $25 | Basic CRM, leads, contacts, opportunities, email integration | Yes | https://www.salesforce.com/sales/pricing/ |
| Salesforce Sales Cloud | Pro Suite | $100 | Full CRM, forecasting, quoting, custom reports | Yes | https://www.salesforce.com/sales/pricing/ |
| Salesforce Sales Cloud | Enterprise | $175 | Advanced pipeline, deal insights, conversation intelligence, Agentforce available | Yes | https://www.salesforce.com/sales/pricing/ |
| Salesforce Sales Cloud | Unlimited | $350 | Predictive AI, full sales engagement + conversation intelligence, full sandbox | Yes | https://www.salesforce.com/sales/pricing/ |
| Outreach | Engage | ~$120 | Core sequencing, dialer, CRM sync; AI add-ons credit-based | Yes (annual) | https://marketbetter.ai/blog/outreach-pricing-breakdown-2026/ |
| Salesloft | Advanced | ~$125–$165 | Cadences, conversation intelligence, coaching; dialer ~$25/user/mo add-on | Yes (annual) | https://www.landbase.com/blog/salesloft-pricing |
| Apollo.io | Basic | $49 | 5K export credits, email sequences, basic CRM sync | Yes | https://www.apollo.io/pricing |
| Apollo.io | Professional | $79 | 10K export credits, sequences + dialer, advanced automation | Yes | https://www.apollo.io/pricing |
| Apollo.io | Organization | $119 | 15K credits, 3-user min, call transcripts, API, custom reports | Yes | https://www.apollo.io/pricing |
| Gong | Foundations | ~$133 | Call recording, transcription, deal intelligence; $50K/yr platform fee | Yes | https://www.tropicapp.io/glossary/gong-price |
| Clari | Full platform | ~$200–$310 | Forecast + Copilot + Groove; all modules combined | Yes | https://docket.io/resources/research/clari-pricing |
| Microsoft Dynamics 365 Sales | Professional | $65 | Sales force automation, Microsoft 365 interop, mobile, basic reporting | Yes | https://www.microsoft.com/en-us/dynamics-365/products/sales |
| Microsoft Dynamics 365 Sales | Enterprise | $105 | Advanced automation, AI, customization, Copilot | Yes | https://www.microsoft.com/en-us/dynamics-365/products/sales |
| Microsoft Dynamics 365 Sales | Premium | $150 | Full sales intelligence, AI enrichment, 1,000 Copilot Credits | Yes | https://www.microsoft.com/en-us/dynamics-365/products/sales |
| Pipedrive | Lite | $14 | Basic pipeline, contact management, mobile app | Yes | https://www.pipedrive.com/en/pricing |
| Pipedrive | Growth | $39 | Email automations, reporting, group email, workflow automation | Yes | https://www.pipedrive.com/en/pricing |
| Pipedrive | Premium | $59 | LeadBooster (chatbot, live chat, prospector), advanced AI | Yes | https://www.pipedrive.com/en/pricing |
| Pipedrive | Ultimate | $79 | Full feature access, advanced customization, all add-ons | Yes | https://www.pipedrive.com/en/pricing |
| ZoomInfo Sales | All tiers | QUOTE_ONLY | Contact/company data, intent signals, engagement tools; baseline ~$10K/yr | Yes | https://www.zoominfo.com/pricing |

**Notes:**
- Outreach pricing is third-party estimated (~$100–$140/user/mo per Vendr); official website is "Contact Sales" only.
- Salesloft pricing is third-party estimated; not publicly listed.
- Gong $50K/yr platform fee applies to all deployments regardless of seat count.
- Salesforce noted a 6% price increase effective August 1, 2025 for Enterprise and Unlimited editions; these prices reflect that update.

```yaml
module: bundled_platforms
competitors:
  - vendor: "HubSpot Sales Hub"
    plan: "Starter"
    per_seat_per_month_usd: 15
    included: "Pipeline management, 1 sequence, basic CRM, email integration, meeting scheduling"
    annual_billed: true
    source: "https://www.hubspot.com/pricing/sales"
  - vendor: "HubSpot Sales Hub"
    plan: "Professional"
    per_seat_per_month_usd: 90
    included: "300 workflows, sequences, calling, forecasting, reporting, playbooks; $1,500 onboarding fee"
    annual_billed: true
    source: "https://www.hubspot.com/pricing/sales"
  - vendor: "HubSpot Sales Hub"
    plan: "Enterprise"
    per_seat_per_month_usd: 150
    included: "1,000 workflows, custom objects, advanced permissions, predictive lead scoring; $3,500 onboarding"
    annual_billed: true
    source: "https://www.hubspot.com/pricing/sales"
  - vendor: "Salesforce Sales Cloud"
    plan: "Starter Suite"
    per_seat_per_month_usd: 25
    included: "Basic CRM, lead/contact/opportunity management, email integration"
    annual_billed: true
    source: "https://www.salesforce.com/sales/pricing/"
  - vendor: "Salesforce Sales Cloud"
    plan: "Pro Suite"
    per_seat_per_month_usd: 100
    included: "Full CRM, forecast management, quoting, custom reports and dashboards"
    annual_billed: true
    source: "https://www.salesforce.com/sales/pricing/"
  - vendor: "Salesforce Sales Cloud"
    plan: "Enterprise"
    per_seat_per_month_usd: 175
    included: "Advanced pipeline, deal insights, conversation intelligence, Agentforce (add-on)"
    annual_billed: true
    note: "6% price increase effective August 1, 2025"
    source: "https://www.salesforce.com/sales/pricing/"
  - vendor: "Salesforce Sales Cloud"
    plan: "Unlimited"
    per_seat_per_month_usd: 350
    included: "Predictive AI, full sales engagement + conversation intelligence, Premier Success, full sandbox"
    annual_billed: true
    source: "https://www.salesforce.com/sales/pricing/"
  - vendor: "Outreach"
    plan: "Engage"
    per_seat_per_month_usd: 120
    included: "Sequencing, dialer, CRM sync, basic AI; Amplify AI credits extra; Meet/Deal add-ons $30–50/user/mo"
    annual_billed: true
    note: "QUOTE_ONLY officially — $100–$140/user/mo per Vendr marketplace data. Annual contract required."
    source: "https://marketbetter.ai/blog/outreach-pricing-breakdown-2026/"
  - vendor: "Salesloft"
    plan: "Advanced"
    per_seat_per_month_usd: 145
    included: "Cadences, conversation intelligence, coaching, forecasting; dialer ~$25/user/mo add-on"
    annual_billed: true
    note: "QUOTE_ONLY officially — est. $125–$165/user/mo list; ~$100–$130 after negotiation (Vendr). Annual contract."
    source: "https://www.landbase.com/blog/salesloft-pricing"
  - vendor: "Apollo.io"
    plan: "Basic"
    per_seat_per_month_usd: 49
    included: "5,000 export credits/mo, email sequences, basic CRM sync, intent data access"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Apollo.io"
    plan: "Professional"
    per_seat_per_month_usd: 79
    included: "10,000 export credits, sequences + dialer, A/B testing, advanced automation, SendGrid integration"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Apollo.io"
    plan: "Organization"
    per_seat_per_month_usd: 119
    included: "15,000 export credits, 3-user min, call transcripts, custom reports, API, advanced admin"
    annual_billed: true
    source: "https://www.apollo.io/pricing"
  - vendor: "Gong"
    plan: "Foundations"
    per_seat_per_month_usd: 133
    included: "Call recording, transcription, AI summaries, deal intelligence; Engage (+$67/user/mo) and Forecast (+$58/user/mo) extra"
    annual_billed: true
    note: "List $1,600/user/yr ($133/mo) + mandatory $50,000/yr platform fee. Negotiated range $1,000–$1,349/user/yr."
    source: "https://www.tropicapp.io/glossary/gong-price"
  - vendor: "Clari"
    plan: "Full Platform (Core + Copilot + Groove)"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — revenue forecasting, conversation intelligence (call coaching), engagement (Salesloft integration); est. $200–$310+/user/mo"
    annual_billed: true
    note: "QUOTE_ONLY — Clari merged with Salesloft Dec 2025. Core $100–120/mo; Copilot adds $60–110/mo; Groove adds $50–80/mo."
    source: "https://docket.io/resources/research/clari-pricing"
  - vendor: "Microsoft Dynamics 365 Sales"
    plan: "Professional"
    per_seat_per_month_usd: 65
    included: "Sales force automation, Microsoft 365 interop, mobile access, reporting and dashboards"
    annual_billed: true
    source: "https://www.microsoft.com/en-us/dynamics-365/products/sales"
  - vendor: "Microsoft Dynamics 365 Sales"
    plan: "Enterprise"
    per_seat_per_month_usd: 105
    included: "Advanced automation, AI insights, Copilot, customization, contextual intelligence"
    annual_billed: true
    source: "https://www.microsoft.com/en-us/dynamics-365/products/sales"
  - vendor: "Microsoft Dynamics 365 Sales"
    plan: "Premium"
    per_seat_per_month_usd: 150
    included: "Full sales intelligence, AI-powered recommendations, data enrichment, 1,000 Copilot Credits"
    annual_billed: true
    source: "https://www.microsoft.com/en-us/dynamics-365/products/sales"
  - vendor: "Pipedrive"
    plan: "Lite"
    per_seat_per_month_usd: 14
    included: "Basic pipeline management, 2,500 active leads+deals/user, contact management, mobile app"
    annual_billed: true
    source: "https://www.pipedrive.com/en/pricing"
  - vendor: "Pipedrive"
    plan: "Growth"
    per_seat_per_month_usd: 39
    included: "5,000 leads+deals/user, email sync, workflow automation (3 if/else steps), custom reports (50)"
    annual_billed: true
    source: "https://www.pipedrive.com/en/pricing"
  - vendor: "Pipedrive"
    plan: "Premium"
    per_seat_per_month_usd: 59
    included: "LeadBooster (chatbot, live chat, prospector, web forms), advanced AI, advanced reporting"
    annual_billed: true
    source: "https://www.pipedrive.com/en/pricing"
  - vendor: "Pipedrive"
    plan: "Ultimate"
    per_seat_per_month_usd: 79
    included: "Full feature access, all add-ons included, advanced customization, enhanced security"
    annual_billed: true
    source: "https://www.pipedrive.com/en/pricing"
  - vendor: "ZoomInfo Sales"
    plan: "All tiers"
    per_seat_per_month_usd: null
    included: "QUOTE_ONLY — contact/company database, intent signals, engagement tools; baseline ~$10K/yr per ZoomInfo reps"
    annual_billed: true
    note: "QUOTE_ONLY — no public pricing. Most teams see $14,995–$35,000+/yr depending on credits and seats."
    source: "https://pipeline.zoominfo.com/sales/how-much-does-zoominfo-cost"
```

---

## Quick Reference: Public List Prices at a Glance

### AI Voice (per minute)
| Vendor | Lowest Public Rate | Notes |
|---|---|---|
| Retell AI | $0.07/min (+ LLM/TTS) | Most transparent; all-in ~$0.11–0.15/min |
| Bland AI | $0.11/min + $499/mo platform | Scale plan |
| Synthflow | $0.13/min overage + $375/mo | Pro plan; 2,000 min included |
| Air.ai | $0.11/min outbound | Per-minute PAYG |
| Vapi.ai | $0.05/min platform | All-in ~$0.18–0.33/min |

### Per-Seat Platforms (annual billing, lowest meaningful paid tier)
| Vendor | Entry Paid Price | Notes |
|---|---|---|
| Pipedrive | $14/seat/mo | Lite plan |
| HubSpot Sales Hub | $15/seat/mo | Starter |
| JustCall | $29/seat/mo | Team plan |
| Aircall | $30/seat/mo | Essentials |
| Apollo.io | $49/seat/mo | Basic |
| Salesforce Sales Cloud | $25/seat/mo | Starter Suite |
| Microsoft Dynamics 365 | $65/seat/mo | Professional |
| Lavender | $27/seat/mo | Starter (annual) |
| Avoma | $19/seat/mo | Startup |
| Guru | $25/seat/mo | Self-serve (10-seat min) |
| Lemlist | $87/seat/mo | Multichannel Expert |
| Reply.io | $89/seat/mo | Multichannel |
| Orum | $250/seat/mo | Launch (3-seat min, annual) |
| Nooks | ~$417/seat/mo | ~$5K/user/yr (third-party; not public) |
| Regie.ai | $180/seat/mo | AI SEP (annual) |
| Gong Foundations | ~$133/seat/mo | + $50K/yr platform fee |

---
*File generated: May 2026. All prices from public pricing pages or cited third-party procurement analyses. Verify before publishing — prices change frequently.*
