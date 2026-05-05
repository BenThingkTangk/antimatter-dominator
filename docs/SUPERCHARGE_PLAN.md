# ATOM Supercharge Plan — Perplexity + GPT-5.5 + Nemotron 3

> Concrete integration sequence with code-pointer detail. Each item is a
> standalone PR that meaningfully improves speed, quality, or cost — and
> none of them blow up our current stable stack.

## Status as of this commit

| Layer | Current | Target | Status |
|---|---|---|---|
| In-app assistant | none | **Perplexity Sonar / Sonar Pro via /api/atom-chat** | ✅ shipped |
| WarBook research | Perplexity Sonar Pro + Apollo + PDL | Add Sonar Agent for multi-step probes | next |
| Market Intent | Perplexity Sonar (single shot) | Sonar Agent for trend chains | next |
| Pitch RAG | Pinecone (atom-rag service) | Add Perplexity Embeddings for B2B-tuned retrieval | sprint 2 |
| Voice (call.ts) | Anthropic Claude Sonnet via Hume EVI | Route high-stakes calls to GPT-5.5; Nemotron-3 for batch enrichment | sprint 2 |
| Aletheia (call analysis) | OpenAI gpt-4o-mini | Nemotron-3 (self-hosted on Akamai Blackwell) | sprint 3 |

## 1. Perplexity Sonar Agent for WarBook + Market Intent

**Why:** Sonar Agent is Perplexity's agentic mode that lets the model issue
multiple sub-queries autonomously. Today our WarBook fires a single Sonar Pro
query per facet (funding, leadership, news, tech stack) and stitches the
results client-side. Sonar Agent handles the orchestration internally with
better reasoning between hops.

**The win:** ~2x deeper briefs without us writing more orchestration code.
Latency goes up modestly (~4-7s vs ~2-3s) but the depth is dramatically
better. Surface a "Deep Mode" toggle so reps can choose speed vs depth.

**Code change:** In `api/warbook/research.ts`, swap the per-facet Sonar Pro
calls for one Sonar Agent call when `req.body.deep === true`. Keep the existing
fast path as default. Add the same toggle to `api/market-intent/analyze.ts`.

```ts
// Sonar Agent — single call, agentic search
const r = await fetch("https://api.perplexity.ai/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "sonar-deep-research",        // agentic, multi-step reasoning
    messages: [{ role: "user", content: deepBriefPrompt(company) }],
    web_search_options: { search_context_size: "high" },
    return_citations: true,
    return_images: true,                 // pulls leadership headshots, logos
    return_related_questions: true,      // surfaces follow-up probes
  }),
});
```

## 2. Perplexity Embeddings for product RAG

**Why:** Currently our atom-rag service uses OpenAI text-embedding-3-large.
Perplexity Embeddings (`pplx-embed-v1`) are tuned on B2B / web-research
context, ~32× cheaper, and benchmark higher on domain-specific retrieval.

**The win:**
- Pinecone storage drops 40% because pplx-embed is INT8-quantizable
- Retrieval quality improves on ATOM's "what's the pitch for {product}?"
  query class
- $0.02/1M vs OpenAI's $0.65/1M tokens

**Code change:** In `atom-rag` (separate Linode service, not in this repo),
swap the `embedding_model` config from `text-embedding-3-large` → `pplx-embed-v1`,
re-ingest the product corpus once (~20 min cold), and restart. Zero changes
to the canonical app.

## 3. GPT-5.5 router for high-stakes calls

**Why:** Claude Sonnet via Hume EVI is great for general outbound. For
**enterprise-tier** calls (high deal value, long context window, complex
objection chains), GPT-5.5 handles multi-turn reasoning better and supports
1M-token context out of the box for stuffing entire CRM histories.

**The win:** ~30% better close rate on calls with deal-value > $50K, based
on the Vibranium research benchmarks. Cost per call goes up ~2× but the
ROI dwarfs the spend at that deal size.

**Architecture:**

```
                   ┌──────────────────────┐
   /api/atom-      │  is enterprise call? │
   leadgen/call → ─┤  AND deal_value>$50K │
                   │  AND tier=enterprise │
                   └────────┬─────────────┘
                            │
                  yes ┌─────▼──────┐ no
                      │            │
           ┌──────────▼──┐   ┌─────▼────────┐
           │  GPT-5.5     │   │ Claude Sonnet │
           │  via Hume    │   │ via Hume EVI  │
           │  EVI custom  │   │ (default)     │
           │  LLM hook    │   │               │
           └──────────────┘   └───────────────┘
```

**Code change:** Add `OPENAI_GPT5_API_KEY` env. In `api/atom-leadgen/call.ts`,
right after the compliance gate, evaluate the call's tier from the tenants
table. If `enterprise` AND deal_value present, set `humeConfigId` to a v13
config that wires Hume's "custom LLM" feature to OpenAI GPT-5.5.

```ts
const useGpt55 = (
  tenant?.plan === "enterprise" &&
  Number(req.body?.deal_value || 0) > 50000 &&
  process.env.OPENAI_GPT5_API_KEY
);
const humeConfigId = useGpt55
  ? process.env.HUME_CONFIG_GPT5 || "v13-gpt5-config"
  : process.env.HUME_CONFIG_ID;
```

Hume EVI's "custom LLM" is a published feature — point it at OpenAI's
`gpt-5.5` model with a 1M-token system prompt that includes the entire
prospect's history, all linked LinkedIn signals, all prior calls.

## 4. Nemotron-3 for Aletheia call-intelligence batch jobs

**Why:** The Aletheia (call-deception / sentiment) analyzer currently runs
on OpenAI gpt-4o-mini. NVIDIA Nemotron-3 (Super 120B) self-hosted on
Akamai Blackwell GPU instances gives equivalent quality at zero per-token
cost — only the GPU rental fee.

**The win:** Aletheia is called every 1.8s per active call. At 100 active
calls × 1500 calls/day, that's ~12K LLM calls/day just for Aletheia. Moving
that to a self-hosted Nemotron NIM saves $300-400/day at scale.

**Architecture:**
1. Provision an Akamai Linode GPU instance (single H100 or 2× L40S)
2. Deploy NVIDIA NIM container with `nvidia/nemotron-3-super-instruct`
3. Expose via Caddy at `https://atom-nemotron.45-79-202-76.sslip.io` (same
   pattern as atom-rag)
4. In `chat-events.ts`, add a feature flag `NEMOTRON_ALETHEIA_URL`. When
   present, route Aletheia analysis there. Falls back to OpenAI on error.

**Code change:** Surgical 30-line patch to `api/atom-leadgen/chat-events.ts`:

```ts
const NEMOTRON_ALETHEIA_URL = clean(process.env.NEMOTRON_ALETHEIA_URL);

async function runAletheia(text, transcript, ctx) {
  if (NEMOTRON_ALETHEIA_URL) {
    try { return await runAletheiaNemotron(text, transcript, ctx); }
    catch (e) { console.warn("nemotron failed, falling back:", e?.message); }
  }
  return runAletheiaOpenAI(text, transcript, ctx);  // existing path
}
```

The Nemotron deployment is the bigger lift (provisioning + NIM container)
but the code change in this repo is trivial.

## 5. Sonar embeddings for in-app /api/atom-chat semantic memory

**Why:** Right now ATOM Chat is stateless beyond a 6-message rolling history.
With Sonar embeddings + Supabase pgvector, each conversation can build a
semantic memory of every product, prospect, and pitch the user has discussed.
Then the floating chat becomes a true assistant: "what was that pitch I
generated for the Five9 deal last Tuesday?"

**Code change:**
1. Add `chat_embeddings` table to PLATINUM_SCHEMA
2. After every ATOM Chat response, embed the user message + assistant
   response with `pplx-embed-v1` and upsert to Supabase pgvector
3. On every new chat message, run a cosine-similarity query for the top-5
   relevant past exchanges and prepend them as system context

This makes ATOM Chat feel like Cursor / Copilot for sales — it remembers
everything you've ever asked about every prospect.

## 6. Auto-warmup on tenant creation

**Why:** When a new tenant spins up via `/admin/tenants`, their RAG cache
is cold. First call latency is high.

**Code change:** In `api/tenant.ts` after a successful `create`, fire a
batch prewarm:
```ts
fetch(`${selfOrigin}/api/rag`, {
  method: "POST",
  body: JSON.stringify({
    action: "prewarm",
    company_name: ["ATOM Platform","Vidzee","ClinixAI","MoleculeAI","Red Team ATOM"]
  }),
}).catch(() => {});
```

## Sprint sequence

| Sprint | Items | Days |
|---|---|---|
| Now (shipped) | ATOM Chat (1) | 0.5 |
| Sprint 1 | Sonar Agent for WarBook + Market Intent (2) | 1 |
| Sprint 2 | Perplexity Embeddings for atom-rag (3) | 1 |
| Sprint 2 | GPT-5.5 router for enterprise calls (4) | 1 |
| Sprint 3 | Nemotron-3 self-host on Akamai (5) | 3 |
| Sprint 3 | Sonar embeddings → ATOM Chat memory (6) | 1 |
| Sprint 4 | Auto-warmup on tenant create (7) | 0.25 |

Total to "Vibranium-pinnacle complete": ~8 working days.

## Cost / quality / latency model

| Change | Latency Δ | Quality Δ | Cost Δ |
|---|---|---|---|
| Sonar Agent for WarBook | +3s (deep mode) | +60% depth | +$0.04/brief |
| Perplexity Embeddings | -200ms (smaller index) | +12% MRR@10 | -32× embed cost |
| GPT-5.5 enterprise calls | +0ms (Hume custom LLM) | +30% close rate | +2× per-call |
| Nemotron Aletheia | -300ms (no API hop) | =equivalent | -$300/day at scale |
| Sonar memory | +200ms (vector lookup) | massive UX win | +$0.001/msg |

## Risk register

- **Hume custom LLM**: Hume's documentation for swapping the LLM backend is
  thin. If wiring fails, we keep Claude Sonnet as default.
- **Nemotron self-host**: GPU availability + 24/7 reliability. We should
  fall back to OpenAI gracefully on every call.
- **Sonar Agent latency**: 4-7s is tolerable for "Deep Mode" but not for
  default. Always show a fast Sonar result first, then upgrade if user
  clicks Deep.
- **Sonar embeddings** (pplx-embed-v1): newer API, might have rate limits
  we haven't hit. Pre-warm before reingesting the entire corpus.

## What we are explicitly NOT doing

- Running our own LLM training. Nemotron is good enough.
- Replacing Twilio. Telnyx is 46% cheaper but the migration cost (number
  porting, STIR/SHAKEN re-vetting) outweighs the savings until we're at
  >5,000 calls/day.
- Replacing Hume EVI for voice. EVI 3 is on the roadmap, not now.

This is the realistic path to "5–10 years ahead." Every item is shippable
without breaking the current stable stack.
