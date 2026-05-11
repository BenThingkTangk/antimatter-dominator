# ATOM Sales Dominator Stack — Pricing Research
**As of May 2026 | List prices only — no negotiated/enterprise discounts**

> **Methodology note:** All prices fetched directly from provider pricing pages and official documentation. Where pages showed pricing tiers, only the standard pay-as-you-go or lowest committed-use list price is recorded unless otherwise noted. Prices are in USD. Per-seat SaaS products are flagged explicitly — they change seat math differently than usage-based costs.

---

## 1. Hume AI — EVI 3 (Empathic Voice Interface v3)

**Source:** [https://www.hume.ai/pricing](https://www.hume.ai/pricing)

### Summary
EVI 3 is billed as an all-in per-minute voice runtime fee — it includes the full speech-to-speech pipeline (STT + LLM inference + Octave TTS synthesis). **There is no separately itemized LLM pass-through line item at list price.** External LLM routing exists but pricing is not published for free-tier or standard plans. The per-minute rate varies by plan tier (volume discount structure):

| Plan | Monthly Cost | Included Minutes | Per-Minute Rate |
|------|-------------|-----------------|-----------------|
| Free | $0 | 5 min | — |
| Starter | $3/mo | 40 min | $0.07/min effective |
| Creator | $14/mo ($7 first mo) | 200 min | $0.07/min effective |
| Pro | $70/mo | 1,200 min | $0.06/min + $0.06/min overage |
| Scale | $200/mo | 5,000 min | $0.05/min + $0.05/min overage |
| Business | $500/mo | 12,500 min | $0.04/min + $0.04/min overage |
| Enterprise | Custom | Unlimited | Custom |

**Octave TTS (separable):**

| Plan | Included Characters | Overage Rate |
|------|--------------------|----|
| Creator | 140,000/mo | $0.15/1,000 characters |
| Pro | 1,000,000/mo | $0.12/1,000 characters |
| Scale | 3,300,000/mo | $0.10/1,000 characters |
| Business | 10,000,000/mo | $0.05/1,000 characters |

> **Note on LLM pass-through:** Hume's EVI 3 all-in price bundles the LLM. External LLM configuration (e.g., routing to your own Anthropic/OpenAI key) is available on Pro+ plans but the pricing page shows no separate pass-through surcharge — cost would then be your direct LLM provider bill added on top.

```yaml
provider: hume_ai
units:
  - name: evi3_minute_pro_tier
    price_usd: 0.06
    unit: per minute of streaming voice (speech-to-speech)
    note: All-in price including STT + embedded LLM + Octave TTS synthesis. No separate LLM pass-through at list price. Pro plan rate; lower at Scale ($0.05) and Business ($0.04).
    source: "https://www.hume.ai/pricing"
  - name: evi3_minute_starter_creator
    price_usd: 0.07
    unit: per minute of streaming voice (effective, within included bundle)
    note: Starter and Creator tier effective rate.
    source: "https://www.hume.ai/pricing"
  - name: octave_tts_overage_pro
    price_usd: 0.00012
    unit: per character (i.e., $0.12 per 1,000 characters)
    note: Overage above Pro plan included allotment (1M chars/mo).
    source: "https://www.hume.ai/pricing"
```

---

## 2. Twilio

**Sources:**
- Voice: [https://www.twilio.com/en-us/voice/pricing/us](https://www.twilio.com/en-us/voice/pricing/us)
- SMS: [https://www.twilio.com/en-us/sms/pricing/us](https://www.twilio.com/en-us/sms/pricing/us)
- Recording/Storage: pricing confirmed via Twilio voice pricing page

### Voice

| Item | Rate |
|------|------|
| Outbound voice (US local) | $0.0140/min |
| Outbound voice (US toll-free) | $0.0140/min |
| Inbound voice (local number) | $0.0085/min + $1.15/mo number fee |
| Inbound voice (toll-free number) | $0.0220/min + $2.15/mo number fee |
| Local phone number rental | $1.15/mo |
| Toll-free phone number rental | $2.15/mo |

### Recording & Storage

| Item | Rate |
|------|------|
| Call recording (per minute recorded) | $0.0025/min (first 100K min/mo) |
| Recording storage (per minute stored/mo) | $0.0005/min/mo (first 10K min free, then $0.0005/min) |
| Call transcription | $0.0500/min |

### SMS (Outbound, US Long Code)

| Item | Base Rate | With Typical Carrier Fee (T-Mobile/Verizon) |
|------|-----------|---------------------------------------------|
| Outbound SMS (base) | $0.0083/message | $0.0128/message (+ $0.0045 carrier fee) |
| Failed message fee | $0.001/message | — |

> **Note:** US A2P 10DLC registration fees apply for business messaging. Carrier surcharges vary by carrier ($0.0025–$0.0050/msg); $0.0083 is Twilio's base; all-in cost with major carriers is typically $0.0118–$0.0133.

```yaml
provider: twilio
units:
  - name: outbound_voice_us_per_minute
    price_usd: 0.0140
    unit: per minute (outbound US local or toll-free)
    note: Pay-as-you-go list price. Volume discounts available.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: local_phone_number_monthly
    price_usd: 1.15
    unit: per number per month
    note: Local US number rental.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: tollfree_phone_number_monthly
    price_usd: 2.15
    unit: per number per month
    note: Toll-free US number rental.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: call_recording_per_minute
    price_usd: 0.0025
    unit: per minute recorded
    note: First 100K minutes/mo rate. Volume tiers available.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: recording_storage_per_minute_per_month
    price_usd: 0.0005
    unit: per recorded minute stored per month
    note: First 10K minutes free; $0.0005/min/mo thereafter.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: call_transcription_per_minute
    price_usd: 0.0500
    unit: per minute transcribed
    note: Separate from recording fee.
    source: "https://www.twilio.com/en-us/voice/pricing/us"
  - name: outbound_sms_us_base
    price_usd: 0.0083
    unit: per SMS message segment (outbound US)
    note: Base rate before carrier surcharges (~$0.0035–$0.0050 per msg added by carrier). All-in ~$0.0118–$0.0133 for major carriers.
    source: "https://www.twilio.com/en-us/sms/pricing/us"
```

---

## 3. Anthropic

**Source:** [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing)

> **Update note:** As of May 2026, the current generation is Claude 4.x. "Claude Sonnet 4.5" and "Sonnet 4.6" are both listed. "Claude Opus 4" ($15/$75) and "Claude Opus 4.5" ($5/$25) are distinct models — Opus 4.5 is a newer, more cost-efficient Opus variant. Older model names (e.g., Claude 3.5) are retired from the pricing page.

| Model | Input $/1M tokens | Output $/1M tokens |
|-------|------------------|-------------------|
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 4.5 | $3.00 | $15.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Opus 4.5 / 4.7 | $5.00 | $25.00 |

> **Important:** Claude Opus 4 ($15/$75) is the flagship heavy reasoning model. Claude Opus 4.5 ($5/$25) is a faster/cheaper Opus variant. Confirm which you intend to use in the stack — cost difference is 3×.

```yaml
provider: anthropic
units:
  - name: claude_sonnet_4_5_input
    price_usd: 3.00
    unit: per 1M input tokens
    source: "https://www.anthropic.com/pricing"
  - name: claude_sonnet_4_5_output
    price_usd: 15.00
    unit: per 1M output tokens
    source: "https://www.anthropic.com/pricing"
  - name: claude_sonnet_4_6_input
    price_usd: 3.00
    unit: per 1M input tokens
    note: Same price as Sonnet 4.5; newer version.
    source: "https://www.anthropic.com/pricing"
  - name: claude_sonnet_4_6_output
    price_usd: 15.00
    unit: per 1M output tokens
    source: "https://www.anthropic.com/pricing"
  - name: claude_opus_4_input
    price_usd: 15.00
    unit: per 1M input tokens
    note: Flagship reasoning model (heavy, expensive).
    source: "https://www.anthropic.com/pricing"
  - name: claude_opus_4_output
    price_usd: 75.00
    unit: per 1M output tokens
    source: "https://www.anthropic.com/pricing"
  - name: claude_opus_4_5_input
    price_usd: 5.00
    unit: per 1M input tokens
    note: Newer Opus variant — faster, 3× cheaper than Opus 4.
    source: "https://www.anthropic.com/pricing"
  - name: claude_opus_4_5_output
    price_usd: 25.00
    unit: per 1M output tokens
    source: "https://www.anthropic.com/pricing"
  - name: claude_haiku_4_5_input
    price_usd: 1.00
    unit: per 1M input tokens
    note: Budget tier, fastest Claude model.
    source: "https://www.anthropic.com/pricing"
  - name: claude_haiku_4_5_output
    price_usd: 5.00
    unit: per 1M output tokens
    source: "https://www.anthropic.com/pricing"
```

---

## 4. OpenAI

**Source:** [https://openai.com/api/pricing](https://openai.com/api/pricing)

> **Important update (May 2026):** OpenAI has significantly restructured its model lineup. "GPT-5" and "GPT-4o" are no longer the current flagship names. The pricing page as of May 2026 lists **GPT-5.4**, **GPT-5.4 mini**, **GPT-5.5**, and deprecated GPT-5 (the original). GPT-4o pricing is no longer prominent on the main pricing page. See notes below.

| Model | Input $/1M | Output $/1M | Cached Input $/1M |
|-------|-----------|------------|-------------------|
| GPT-5.5 (latest flagship) | $5.00 | $30.00 | $0.50 |
| GPT-5.4 | $2.50 | $15.00 | $0.25 |
| GPT-5.4 mini | $0.75 | $4.50 | $0.075 |
| GPT-5 (original, still available) | $1.25 | $10.00 | $0.125 |
| GPT-Realtime-2 (audio tokens) | $32.00 | $64.00 | $0.40 |
| GPT-Realtime-2 (text tokens) | $4.00 | $24.00 | $0.40 |

**Whisper Transcription:**
- GPT-Realtime-Whisper: **$0.017/minute** (=$0.00028/second)
- This replaces the old Whisper API pricing of $0.006/min — it is ~2.8× more expensive; confirm which endpoint you use.

> **GPT-4o note:** GPT-4o was removed from the primary pricing page by May 2026. It may still be accessible via the API but is superseded by the GPT-5.x family. Per a cross-reference source (Finout, April 2026): GPT-4.1 is $2.00/$8.00 per 1M tokens (a parallel lineup from a new naming scheme). If your stack referenced "GPT-4o," the closest current equivalent is GPT-5.4 ($2.50/$15.00) or GPT-4.1 ($2.00/$8.00).

```yaml
provider: openai
units:
  - name: gpt_5_5_input
    price_usd: 5.00
    unit: per 1M input tokens
    note: Latest flagship model as of May 2026.
    source: "https://openai.com/api/pricing"
  - name: gpt_5_5_output
    price_usd: 30.00
    unit: per 1M output tokens
    source: "https://openai.com/api/pricing"
  - name: gpt_5_4_input
    price_usd: 2.50
    unit: per 1M input tokens
    note: Previous flagship, still available.
    source: "https://openai.com/api/pricing"
  - name: gpt_5_4_output
    price_usd: 15.00
    unit: per 1M output tokens
    source: "https://openai.com/api/pricing"
  - name: gpt_5_4_mini_input
    price_usd: 0.75
    unit: per 1M input tokens
    note: Budget tier.
    source: "https://openai.com/api/pricing"
  - name: gpt_5_4_mini_output
    price_usd: 4.50
    unit: per 1M output tokens
    source: "https://openai.com/api/pricing"
  - name: gpt_5_original_input
    price_usd: 1.25
    unit: per 1M input tokens
    note: Original GPT-5 model, still available as of May 2026.
    source: "https://openai.com/api/pricing"
  - name: gpt_5_original_output
    price_usd: 10.00
    unit: per 1M output tokens
    source: "https://openai.com/api/pricing"
  - name: whisper_transcription
    price_usd: 0.017
    unit: per minute of audio transcribed
    note: GPT-Realtime-Whisper endpoint. Classic Whisper API was $0.006/min — verify which endpoint is in use.
    source: "https://openai.com/api/pricing"
  - name: gpt_realtime_audio_input
    price_usd: 32.00
    unit: per 1M audio tokens (input)
    note: For real-time voice AI use cases (GPT-Realtime-2).
    source: "https://openai.com/api/pricing"
  - name: gpt_realtime_audio_output
    price_usd: 64.00
    unit: per 1M audio tokens (output)
    source: "https://openai.com/api/pricing"
```

---

## 5. Perplexity (Sonar)

**Source:** [https://docs.perplexity.ai/guides/pricing](https://docs.perplexity.ai/guides/pricing)

| Model | Input $/1M | Output $/1M | Per-Request Fee |
|-------|-----------|------------|-----------------|
| Sonar | $1.00 | $1.00 | ~$0.005/request |
| Sonar Pro | $3.00 | $15.00 | varies (search context) |
| Sonar Reasoning Pro | $2.00 | $8.00 | varies |
| Sonar Deep Research | — | — | $5.00/1K search queries |

> **Per-request fee detail:** The page shows a worked example for Sonar: 500 input tokens ($0.0005) + 200 output tokens ($0.0002) + request fee ($0.005) = **$0.0057 total per query**. The request fee is the dominant cost for short queries. This fee applies to Sonar, Sonar Pro, and Sonar Reasoning Pro; the exact amount scales with search context size but ~$0.005 is the example shown.

```yaml
provider: perplexity_sonar
units:
  - name: sonar_input_tokens
    price_usd: 1.00
    unit: per 1M input tokens
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_output_tokens
    price_usd: 1.00
    unit: per 1M output tokens
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_request_fee
    price_usd: 0.005
    unit: per API request (approximate; scales with search context)
    note: Per-request fee dominates cost for short queries. Example from docs: $0.005 fee vs $0.0007 in tokens for a typical short query.
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_pro_input_tokens
    price_usd: 3.00
    unit: per 1M input tokens
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_pro_output_tokens
    price_usd: 15.00
    unit: per 1M output tokens
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_reasoning_pro_input_tokens
    price_usd: 2.00
    unit: per 1M input tokens
    source: "https://docs.perplexity.ai/guides/pricing"
  - name: sonar_reasoning_pro_output_tokens
    price_usd: 8.00
    unit: per 1M output tokens
    source: "https://docs.perplexity.ai/guides/pricing"
```

---

## 6. Pinecone

**Sources:**
- [https://www.pinecone.io/pricing/](https://www.pinecone.io/pricing/)
- [https://docs.pinecone.io/guides/organizations/manage-cost/understanding-cost](https://docs.pinecone.io/guides/organizations/manage-cost/understanding-cost)
- Cross-reference: [Orb Pinecone pricing analysis, Jan 2026](https://www.withorb.com/blog/pinecone-pricing)

### Plan Tiers

| Plan | Monthly Cost | Notes |
|------|-------------|-------|
| Starter | Free | 2GB storage, 2M write units/mo, 1M read units/mo |
| Builder | $20/mo flat | Increased limits, multi-project |
| Standard | $50/mo minimum (pay-as-you-go above) | Production workloads |
| Enterprise | $500/mo minimum | 99.95% uptime SLA, private networking |

### Serverless Usage Rates (Standard Plan)

| Metric | Rate |
|--------|------|
| Write units | $4.00 per million |
| Read units | $16.00 per million |
| Storage | $0.33 per GB/month |

> **Source note:** The Pinecone pricing page does not display per-unit dollar amounts inline (intentionally hidden behind a calculator). The rates above ($4/M writes, $16/M reads, $0.33/GB) are sourced from Orb's January 2026 analysis which cites Pinecone directly and is widely cited. Enterprise rates are higher ($6/M writes, $24/M reads). Verify in Pinecone dashboard before finalizing model.

```yaml
provider: pinecone
units:
  - name: serverless_write_units
    price_usd: 4.00
    unit: per 1M write units (Standard plan)
    note: Enterprise rate is $6/M write units. Starter plan includes 2M write units/mo free.
    source: "https://www.withorb.com/blog/pinecone-pricing (citing Pinecone docs); https://www.pinecone.io/pricing/"
  - name: serverless_read_units
    price_usd: 16.00
    unit: per 1M read units (Standard plan)
    note: Enterprise rate is $24/M read units. Starter plan includes 1M read units/mo free.
    source: "https://www.withorb.com/blog/pinecone-pricing (citing Pinecone docs); https://www.pinecone.io/pricing/"
  - name: serverless_storage
    price_usd: 0.33
    unit: per GB per month (Standard plan)
    note: Starter plan includes 2GB free.
    source: "https://www.withorb.com/blog/pinecone-pricing (citing Pinecone docs); https://www.pinecone.io/pricing/"
  - name: standard_plan_minimum
    price_usd: 50.00
    unit: per month (minimum commitment, usage billed above this)
    note: This is a PER-ACCOUNT minimum, not per-seat. Usage above $50 is pay-as-you-go.
    source: "https://www.pinecone.io/pricing/"
```

---

## 7. Apollo.io

**Source:** [https://www.apollo.io/pricing](https://www.apollo.io/pricing)

> **Per-seat SaaS — materially changes seat math.** Apollo charges per user seat. Credits are consumption-based on top of the seat fee.

### Per-Seat Pricing

| Plan | Monthly Billing | Annual Billing (per user/mo) | Min Users |
|------|----------------|------------------------------|-----------|
| Free | $0 | $0 | 1 |
| Basic | $59/user | $49/user | 1 |
| Professional | $99/user | $79/user | 1 |
| Organization | $149/user | $119/user | 3 |

### Credit Costs (Consumption)

| Action | Credits Consumed |
|--------|-----------------|
| Email reveal | 1 credit |
| Phone (mobile) reveal | 8 credits |
| Data enrichment (contact/company) | 1–8 credits |
| AI Research run | 1 credit/run |
| Dialer usage | 2 credits/minute |

> **Overage credits:** $0.20 per credit (250-credit minimum purchase per the Salesmotion source, April 2026).

> **Credit bundles per plan:** Basic includes ~4,000 export credits/mo; Professional ~2,000/mo; Organization ~4,000/mo. Note: email credits are listed as "unlimited (fair use)" but mobile credits are hard-capped (75–200/mo depending on tier).

```yaml
provider: apollo_io
billing_model: per_seat_plus_credits
units:
  - name: seat_professional_monthly
    price_usd: 99.00
    unit: per seat per month (monthly billing)
    note: Annual billing reduces to $79/seat/mo. This is a per-seat cost that scales with headcount.
    source: "https://www.apollo.io/pricing"
  - name: seat_professional_annual
    price_usd: 79.00
    unit: per seat per month (billed annually)
    source: "https://www.apollo.io/pricing"
  - name: seat_organization_monthly
    price_usd: 149.00
    unit: per seat per month (monthly billing, 3-seat minimum)
    note: Minimum 3 seats = $447/mo minimum.
    source: "https://www.apollo.io/pricing"
  - name: seat_organization_annual
    price_usd: 119.00
    unit: per seat per month (billed annually, 3-seat minimum)
    source: "https://www.apollo.io/pricing"
  - name: phone_reveal_credit
    price_usd: 0.20
    unit: per overage credit (8 credits per mobile reveal = $1.60/reveal at overage rate)
    note: Included credits come with seat; overage credits are $0.20 each. 1 mobile reveal = 8 credits = $1.60 overage cost.
    source: "https://www.apollo.io/pricing; https://salesmotion.io/blog/apollo-pricing"
  - name: email_reveal_credit
    price_usd: 0.20
    unit: per overage credit (1 credit per email reveal = $0.20/reveal at overage rate)
    note: Email credits are "unlimited" within fair use on paid plans; overage credits $0.20 each.
    source: "https://www.apollo.io/pricing"
```

---

## 8. Resend (Transactional Email)

**Source:** [https://resend.com/pricing](https://resend.com/pricing)

| Plan | Monthly Cost | Included Emails/mo | Extra Emails |
|------|-------------|-------------------|-------------|
| Free | $0 | 3,000 | — |
| Pro | $20/mo | 50,000 | $0.90/1,000 |
| Scale | $80/mo | 100,000 | $0.90/1,000 |
| Enterprise | Custom | Custom | Custom |

> **Add-on:** Dedicated IPs available at $30/mo for high-volume senders on Scale plan (500+ emails/day).

```yaml
provider: resend
units:
  - name: pro_plan_base
    price_usd: 20.00
    unit: per month (includes 50,000 emails)
    note: NOT per-seat. Flat account fee. $0.90/1,000 overage.
    source: "https://resend.com/pricing"
  - name: scale_plan_base
    price_usd: 80.00
    unit: per month (includes 100,000 emails)
    note: $0.90/1,000 overage.
    source: "https://resend.com/pricing"
  - name: email_overage
    price_usd: 0.0009
    unit: per email sent (beyond plan included volume)
    note: Expressed as $0.90 per 1,000 emails = $0.0009/email.
    source: "https://resend.com/pricing"
```

---

## 9. Vercel

**Source:** [https://vercel.com/pricing](https://vercel.com/pricing)

> **Per-seat SaaS component:** Vercel Pro charges per developer seat. Infrastructure costs (functions, bandwidth) are usage-based.

| Item | Cost |
|------|------|
| Pro plan — per developer seat | $20/seat/month |
| Function invocations (beyond free tier) | $0.60 per 1M invocations |
| Blob data transfer | $0.05 per GB |
| Fast Data Transfer (bandwidth overage) | Not separately listed on pricing page (included at plan level) |

> **Free tier (Hobby):** $0, limited to personal non-commercial use. Pro plan required for team/commercial use.

```yaml
provider: vercel
billing_model: per_seat_plus_usage
units:
  - name: pro_seat_monthly
    price_usd: 20.00
    unit: per developer seat per month
    note: Per-seat cost — scales with engineering team size.
    source: "https://vercel.com/pricing"
  - name: function_invocations
    price_usd: 0.60
    unit: per 1M function invocations (beyond free tier)
    source: "https://vercel.com/pricing"
  - name: blob_data_transfer
    price_usd: 0.05
    unit: per GB of blob data transfer
    source: "https://vercel.com/pricing"
```

---

## 10. Supabase

**Source:** [https://supabase.com/pricing](https://supabase.com/pricing)

| Item | Cost |
|------|------|
| Pro plan (flat) | $25/month per project |
| Additional DB storage | $0.125 per GB/month |
| Additional egress | $0.09 per GB |
| Additional auth (MAU beyond 50K) | Included up to 50K MAU |

> **Free tier:** 500 MB database, 5 GB egress, 2 active projects, paused after 1 week inactivity.
> **Note:** Supabase Pro is priced per PROJECT, not per seat. Multiple projects incur multiple $25/mo charges.

```yaml
provider: supabase
billing_model: per_project_flat_plus_usage
units:
  - name: pro_plan_per_project
    price_usd: 25.00
    unit: per project per month
    note: Per-project fee, NOT per-seat. Additional projects each add $25/mo.
    source: "https://supabase.com/pricing"
  - name: additional_db_storage
    price_usd: 0.125
    unit: per GB per month (above Pro plan included storage)
    source: "https://supabase.com/pricing"
  - name: additional_egress
    price_usd: 0.09
    unit: per GB of egress (above Pro plan included egress)
    source: "https://supabase.com/pricing"
```

---

## 11. Stripe

**Source:** [https://stripe.com/pricing](https://stripe.com/pricing)

| Fee type | Amount |
|----------|--------|
| Standard card processing (domestic US) | 2.9% + $0.30 per successful transaction |
| Setup fee | None |
| Monthly fee | None |

> **Unchanged from 2025.** Stripe's standard rate has been 2.9% + $0.30 for domestic cards for several years. International cards may incur an additional 1.5% fee. ACH Direct Debit is 0.8% capped at $5. Stripe Connect (marketplace) has separate pricing. Dispute fee: $15 per dispute.

```yaml
provider: stripe
units:
  - name: standard_card_transaction
    price_usd: null
    unit: per successful transaction
    note: "Rate is 2.9% of transaction value + $0.30 flat fee. Not a fixed dollar amount — model as: cost = (transaction_value * 0.029) + 0.30"
    rate_percent: 2.9
    flat_fee_usd: 0.30
    source: "https://stripe.com/pricing"
  - name: dispute_fee
    price_usd: 15.00
    unit: per dispute/chargeback
    note: Refunded if you win the dispute.
    source: "https://stripe.com/pricing"
```

---

## 12. ElevenLabs

**Source:** [https://elevenlabs.io/pricing](https://elevenlabs.io/pricing)

> **Note:** ElevenLabs updated its plan lineup in 2025–2026. The current published plans are Free, Starter ($6/mo), Creator ($22/mo), Pro ($99/mo), Scale ($299/mo), Business ($990/mo), Enterprise (custom). The "Scale" plan price differs across sources ($299 per ElevenLabs directly; some older sources show $330 — the $299 figure from the official page and the smallest.ai April 2026 analysis is used here).

| Plan | Monthly Cost | Credits/Month | Overage (Multilingual v2) |
|------|-------------|--------------|---------------------------|
| Free | $0 | 10,000 | — |
| Starter | $6 | 30,000 | — |
| Creator | $22 (first mo $11) | 121,000 | ~$0.30/min |
| Pro | $99 | 600,000 | ~$0.24/min |
| Scale | $299 | 1,800,000 | ~$0.18/min |
| Business | $990 | 6,000,000 | ~$0.12/min |
| Enterprise | Custom | Custom | Custom |

> **Credit mapping:** 1 credit = 1 character (Multilingual v2 model). Flash/Turbo models cost 0.5 credits/character (effectively double the minutes per plan). At ~5 characters/word and ~150 words/minute of speech, 1 minute ≈ 750 characters ≈ 750 credits. Creator plan: 121,000 credits / 750 = ~161 minutes of speech/month.

> **Professional Voice Cloning:** Requires Creator plan or above. Per-tenant voice clones for the ATOM stack require Creator ($22/mo minimum) per ElevenLabs account.

```yaml
provider: elevenlabs
billing_model: per_account_tiered_plus_overage
units:
  - name: creator_plan_monthly
    price_usd: 22.00
    unit: per account per month (121,000 credits included)
    note: Minimum tier for Professional Voice Cloning. First month $11.
    source: "https://elevenlabs.io/pricing"
  - name: pro_plan_monthly
    price_usd: 99.00
    unit: per account per month (600,000 credits included)
    note: Adds 44.1kHz PCM API output.
    source: "https://elevenlabs.io/pricing"
  - name: scale_plan_monthly
    price_usd: 299.00
    unit: per account per month (1,800,000 credits, 3 seats)
    source: "https://elevenlabs.io/pricing"
  - name: tts_overage_creator
    price_usd: 0.00030
    unit: per character (~$0.30 per 1,000 characters / per ~1.3 minutes speech)
    note: Overage on Creator plan. Multilingual v2 model. 1 char = 1 credit.
    source: "https://elevenlabs.io/pricing; https://www.cekura.ai/blogs/elevenlabs-pricing"
  - name: tts_overage_pro
    price_usd: 0.00024
    unit: per character (Pro plan overage rate)
    source: "https://elevenlabs.io/pricing; https://www.cekura.ai/blogs/elevenlabs-pricing"
```

---

## 13. PeopleDataLabs (PDL)

**Sources:**
- [https://www.peopledatalabs.com/pricing](https://www.peopledatalabs.com/pricing)
- [PDL Help Center — Pricing & Credits](https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits)

> **Note:** PDL does not show per-credit costs on the main pricing page. Tier pricing is documented in their help center. The Pro plan entry point ($98/mo = 350 person enrichment credits) implies $0.28/credit at entry volume.

### Person Enrichment / Search API (Monthly Billing)

| Tier | Credits Range | $/Credit |
|------|-------------|----------|
| Tier 1 | 350–2,500 | $0.28 |
| Tier 2 | 2,501–5,000 | $0.265 |
| Tier 3 | 5,001–8,333 | $0.25 |

### Company Enrichment / Search API (Monthly Billing)

| Tier | Credits Range | $/Credit |
|------|-------------|----------|
| Tier 1 | 1,000–10,000 | $0.10 |
| Tier 2 | 10,001–25,000 | $0.075 |
| Tier 3 | 25,001–33,333 | $0.065 |

### Person Identify API (Monthly Billing, higher quality)

| Tier | Credits Range | $/Credit |
|------|-------------|----------|
| Tier 1 | 200–499 | $0.55 |
| Tier 2 | 500–999 | $0.525 |
| Tier 3 | 1,000–4,167 | $0.50 |

> **Annual billing discount:** ~20% discount. Person enrichment annual Tier 1 = $0.224/credit.
> **1 credit = 1 successful API response** (person enrichment, company enrichment, or IP enrichment per call).

```yaml
provider: people_data_labs
units:
  - name: person_enrichment_tier1_monthly
    price_usd: 0.28
    unit: per successful person enrichment API call (Tier 1: 350–2,500 credits/mo)
    note: Entry-level list price. Implies $98/mo minimum (350 credits × $0.28).
    source: "https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits"
  - name: person_enrichment_annual_tier1
    price_usd: 0.224
    unit: per successful person enrichment API call (annual billing, Tier 1)
    note: 20% discount for annual commitment.
    source: "https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits"
  - name: company_enrichment_tier1_monthly
    price_usd: 0.10
    unit: per successful company enrichment API call (Tier 1: 1,000–10,000 credits/mo)
    source: "https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits"
  - name: person_identify_tier1_monthly
    price_usd: 0.55
    unit: per successful Person Identify API call (higher-quality match, Tier 1)
    source: "https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits"
```

---

## 14. Hunter.io

**Source:** [https://hunter.io/pricing](https://hunter.io/pricing)

> **Per-seat SaaS:** Hunter is priced as a single-seat subscription with a credit bundle. Adding users requires additional seats/plans.

| Plan | Monthly Billing | Annual Billing | Credits/Month |
|------|----------------|----------------|---------------|
| Free | $0 | $0 | 50 |
| Starter | $49/mo | $34/mo | 2,000 |
| Growth | $149/mo | $104/mo | 10,000 |
| Scale | $299/mo | $209/mo | 25,000 |
| Enterprise | Custom | Custom | Custom |

> **Credit definition:** 1 credit = 1 email found via Domain Search, Email Finder, or Bulk Email Finder. 1 credit = up to 10 emails via Bulk Domain Search. 0.5 credit = 1 email verified. Credits do not roll over.

> **Implied per-email cost:**
> - Starter: $49 / 2,000 = $0.0245/email found
> - Growth: $149 / 10,000 = $0.0149/email found
> - Scale: $299 / 25,000 = $0.01196/email found

```yaml
provider: hunter_io
billing_model: per_seat_with_credit_bundle
units:
  - name: starter_plan_monthly
    price_usd: 49.00
    unit: per seat per month (2,000 credits included)
    note: Annual billing reduces to $34/mo.
    source: "https://hunter.io/pricing"
  - name: growth_plan_monthly
    price_usd: 149.00
    unit: per seat per month (10,000 credits included)
    note: Annual billing reduces to $104/mo.
    source: "https://hunter.io/pricing"
  - name: scale_plan_monthly
    price_usd: 299.00
    unit: per seat per month (25,000 credits included)
    note: Annual billing reduces to $209/mo.
    source: "https://hunter.io/pricing"
  - name: implied_cost_per_email_starter
    price_usd: 0.0245
    unit: per email found (Starter plan effective rate)
    note: Derived: $49 / 2,000 credits. 1 credit = 1 email via Domain Search or Email Finder.
    source: "https://hunter.io/pricing"
  - name: implied_cost_per_email_growth
    price_usd: 0.0149
    unit: per email found (Growth plan effective rate)
    note: Derived: $149 / 10,000 credits.
    source: "https://hunter.io/pricing"
```

---

## 15. BuiltWith

**Source:** [https://builtwith.com/plans](https://builtwith.com/plans)

> **Per-account subscription (not per-seat for Basic/Pro; Team adds unlimited logins).** BuiltWith is priced per account with 1 login for Basic and Pro, unlimited for Team.

| Plan | Monthly Cost | Technologies | Users |
|------|-------------|-------------|-------|
| Basic | $295/mo | 2 tech reports | 1 |
| Pro | $495/mo | Unlimited | 1 |
| Team | $995/mo | Unlimited | Unlimited |

> **Note:** BuiltWith is expensive relative to alternatives and its pricing has been stable at these levels. The "technologies" column refers to concurrent technology-based lead list reports (e.g., "companies using Shopify").

```yaml
provider: builtwith
billing_model: per_account_tiered
units:
  - name: basic_plan_monthly
    price_usd: 295.00
    unit: per account per month (2 technology reports, 1 login)
    note: Not per-seat in standard sense — 1 user license. Team plan needed for multiple users.
    source: "https://builtwith.com/plans"
  - name: pro_plan_monthly
    price_usd: 495.00
    unit: per account per month (unlimited technology reports, 1 login)
    source: "https://builtwith.com/plans"
  - name: team_plan_monthly
    price_usd: 995.00
    unit: per account per month (unlimited reports, unlimited logins)
    note: This is effectively the per-team/org price for multi-user access.
    source: "https://builtwith.com/plans"
```

---

## 16. TheirStack

**Source:** [https://theirstack.com/pricing](https://theirstack.com/pricing)

> **Credit-based pricing.** TheirStack sells company credits (1 credit = data on 1 company). Both company credits and API credits are included in plans. Cancel anytime, no commitment.

| Tier | Credits | Total Cost | $/Credit |
|------|---------|-----------|---------|
| Free | 50 | $0 | — |
| Tier 1 | 1,000 | $109 | $0.109 |
| Tier 2 | 3,500 | $339 | $0.097 |
| Tier 3 | 6,500 | $599 | $0.092 |
| Tier 4 | 10,000 | $849 | $0.085 |
| Tier 5 | 20,000 | $1,538 | $0.077 |
| Tier 6 | 50,000 | $2,986 | $0.060 |

> **API credits:** Included alongside company credits in each plan tier. No separate API per-call pricing published.

```yaml
provider: theirstack
billing_model: credit_bundles
units:
  - name: company_credit_tier1
    price_usd: 0.109
    unit: per company credit (1,000-credit tier)
    note: Entry-level paid tier. 1 credit = data on 1 company. API credits also included.
    source: "https://theirstack.com/pricing"
  - name: company_credit_tier2
    price_usd: 0.097
    unit: per company credit (3,500-credit tier = $339/mo)
    source: "https://theirstack.com/pricing"
  - name: company_credit_tier4
    price_usd: 0.085
    unit: per company credit (10,000-credit tier = $849/mo)
    source: "https://theirstack.com/pricing"
  - name: company_credit_tier6
    price_usd: 0.060
    unit: per company credit (50,000-credit tier = $2,986/mo)
    note: Highest volume published tier.
    source: "https://theirstack.com/pricing"
```

---

## Quick Reference: Per-Unit Cost Summary Table

| Provider | Key Unit | List Price | Billing Model |
|----------|---------|-----------|---------------|
| Hume AI EVI 3 | Per minute voice | $0.04–$0.07/min | Usage-based (tiered) |
| Twilio Voice | Per minute outbound | $0.0140/min | Usage-based |
| Twilio SMS | Per message (base) | $0.0083/msg + carrier | Usage-based |
| Twilio Recording | Per minute recorded | $0.0025/min | Usage-based |
| Twilio Number | Per number/month | $1.15–$2.15/mo | Per-number rental |
| Anthropic Sonnet 4.6 | Per 1M tokens in/out | $3 / $15 | Usage-based |
| Anthropic Opus 4 | Per 1M tokens in/out | $15 / $75 | Usage-based |
| OpenAI GPT-5.5 | Per 1M tokens in/out | $5 / $30 | Usage-based |
| OpenAI GPT-5.4 | Per 1M tokens in/out | $2.50 / $15 | Usage-based |
| OpenAI Whisper | Per minute audio | $0.017/min | Usage-based |
| Perplexity Sonar | Per request (effective) | ~$0.005 + tokens | Usage-based |
| Perplexity Sonar Pro | Per 1M tokens in/out | $3 / $15 | Usage-based |
| Pinecone (Standard) | Write/Read/Storage | $4/1M writes, $16/1M reads, $0.33/GB | Usage-based ($50 min) |
| Apollo.io Professional | Per seat | $79–$99/seat/mo | **Per-seat SaaS** |
| Apollo.io phone reveal | Per overage credit | $1.60/reveal (8 credits × $0.20) | Credits |
| Resend Pro | Per account flat | $20/mo + $0.90/1K overage | Flat + usage |
| Vercel Pro | Per developer seat | $20/seat/mo | **Per-seat SaaS** |
| Vercel Functions | Per 1M invocations | $0.60/1M | Usage-based |
| Supabase Pro | Per project flat | $25/project/mo | Per-project flat |
| Stripe | Per transaction | 2.9% + $0.30 | Transaction % + flat |
| ElevenLabs Creator | Per account flat | $22/mo (121K credits) | Flat + overage |
| ElevenLabs Pro | Per account flat | $99/mo (600K credits) | Flat + overage |
| PDL Person Enrichment | Per API call | $0.28/call (entry) | Credit-based |
| PDL Company Enrichment | Per API call | $0.10/call (entry) | Credit-based |
| Hunter.io Starter | Per seat | $49/mo (2K credits) | **Per-seat SaaS** |
| BuiltWith Pro | Per account | $495/mo | Per-account flat |
| TheirStack Tier 1 | Per company credit | $0.109/credit | Credit bundles |

---

## Key Observations for Unit Economics Modeling

1. **Per-seat vs. per-usage split:** Apollo.io, Hunter.io, and Vercel charge per-seat — costs scale linearly with team size regardless of usage. Hume, Twilio, OpenAI, Anthropic, Perplexity, Pinecone are pure usage-based and scale with activity volume.

2. **OpenAI model rename warning:** What the stack may call "GPT-5" is now **GPT-5.4** ($2.50/$15 per MTok) or **GPT-5.5** ($5/$30). The original "GPT-5" ($1.25/$10) is still accessible but is a prior generation. Verify your API endpoint name.

3. **Hume EVI 3 is all-in:** The $0.04–$0.07/min fee bundles STT + LLM + TTS. You are NOT paying Anthropic/OpenAI separately unless you configure an external LLM on Pro+ plans.

4. **ElevenLabs character math:** 121,000 credits (Creator) ÷ 750 chars/min ≈ 161 minutes of speech. At $22/mo that is $0.137/min — significantly more expensive than Hume EVI 3's all-in rate for standalone TTS.

5. **Pinecone rates unverified from official page:** The $4/1M writes, $16/1M reads, $0.33/GB figures come from a well-cited third-party analysis (Orb, Jan 2026). The Pinecone pricing page intentionally omits per-unit rates in favor of a calculator. Flag for direct verification in Pinecone dashboard or support.

6. **Stripe effective rate:** For a $500 deal: 2.9% × $500 + $0.30 = $14.80 + $0.30 = **$15.10 per transaction**. For a $50/mo SaaS: $1.75/transaction. Model this as a revenue take-rate, not a fixed cost.

7. **PDL vs Apollo for enrichment:** Apollo email enrichment is included in seat cost (fair use); phone reveal is $1.60/record at overage. PDL person enrichment is $0.28/record. For pure enrichment at scale, PDL is cheaper; for a combined prospecting+CRM+enrichment workflow, Apollo's seat cost may be more efficient.

---

*Report generated: May 2026. All prices are publicly listed list prices. Enterprise/negotiated pricing will differ. Verify before committing to model — provider pricing pages change without notice.*
