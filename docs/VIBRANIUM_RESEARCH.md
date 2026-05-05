# VIBRANIUM PINNACLE TECH STACK RESEARCH
### AI Outbound Voice Sales Agent Platform — May 2026

> **Scope:** Evaluates five specific integration candidates (GPT-5.5, NVIDIA Nemotron, Perplexity Embeddings, Perplexity Agent API, Perplexity Sonar), then covers every major layer of the AI voice sales stack with best-in-class alternatives. Concludes with a migration table.

---

## Table of Contents

1. [GPT-5.5 — OpenAI Flagship LLM](#1-gpt-55--openai-flagship-llm)
2. [NVIDIA Nemotron 3 — Open Weights LLM Family](#2-nvidia-nemotron-3--open-weights-llm-family)
3. [Perplexity Embeddings (sonar-embed / pplx-embed-v1)](#3-perplexity-embeddings-sonar-embed--pplx-embed-v1)
4. [Perplexity Agent API — Agentic Search Runtime](#4-perplexity-agent-api--agentic-search-runtime)
5. [Perplexity Sonar — Already Integrated (Best Practices)](#5-perplexity-sonar--already-integrated-best-practices)
6. [Best-in-Class: Everything Else](#6-best-in-class-everything-else)
   - 6.1 Voice Models
   - 6.2 LLMs for Agent Reasoning
   - 6.3 Vector DB / Retrieval
   - 6.4 Embedding Models
   - 6.5 Agent / Tool-Use Frameworks
   - 6.6 Telephony
   - 6.7 Observability + Evals
   - 6.8 Guardrails / Safety
   - 6.9 Real-Time Call Intelligence
   - 6.10 Compliance Tooling (TCPA / DNC)
7. [Recommended Vibranium Stack — Migration Table](#7-recommended-vibranium-stack--migration-table)

---

## 1. GPT-5.5 — OpenAI Flagship LLM

### What it replaces / augments
Currently ATOM uses **Claude Sonnet 4.x** as the primary reasoning LLM driving the voice agent's conversational logic, plus SambaNova/OpenAI/Anthropic for ancillary intel modules. GPT-5.5 is a candidate to replace or parallel-run with Claude Sonnet on the highest-stakes sales calls, or to handle the off-call enrichment/research pipeline where raw agentic coding and multi-step reasoning quality matter most.

### Latency / Quality / Cost vs. current

| Dimension | Claude Sonnet 4.6 (current) | GPT-5.5 |
|---|---|---|
| Input pricing | $3 / 1M tokens | $5 / 1M tokens |
| Output pricing | $15 / 1M tokens | $30 / 1M tokens |
| Per-token latency | Fast (streaming) | Matches GPT-5.4 per-token latency in production serving |
| Token efficiency | — | ~38% fewer tokens to complete equivalent Codex tasks vs GPT-5.4 |
| Context window | 200K tokens | 1,050,000 tokens |
| Agentic coding | Strong | #1 on Terminal-Bench 2.0 (82.7%), 73.1% on Expert-SWE long-horizon |

GPT-5.5 carries a **2× price premium over Claude Sonnet 4.6** on output tokens. However, [OpenAI reports](https://developers.openai.com/api/docs/models/gpt-5.5) that a ~38–50% token-use reduction on agentic tasks roughly offsets the raw rate increase in real-world spend. For voice calls where response must stream within 200–400ms of LLM completion, the per-token latency parity with GPT-5.4 is acceptable but not a step-change. The 1M-token context window is significant for loading long deal history + persona files in a single call.

**Recommendation: Augment, not replace.** Route highest-value enterprise accounts and complex multi-turn discovery calls to GPT-5.5. Keep Claude Sonnet 4.6 as the default for volume outbound. Use GPT-5.5 for the offline intel/enrichment pipeline where quality >> cost.

### Integration sketch

```bash
# .env addition
OPENAI_GPT55_API_KEY=sk-...
OPENAI_GPT55_MODEL=gpt-5.5

# Usage in ATOM pipeline (Node/Python)
POST https://api.openai.com/v1/chat/completions
Authorization: Bearer $OPENAI_GPT55_API_KEY
{
  "model": "gpt-5.5",
  "messages": [...],
  "stream": true,
  "max_tokens": 512,       // Keep short for voice TTS latency
  "service_tier": "default"
}
```

For 272K+ token sessions (enterprise dossiers), note the [2× input-token price uplift](https://developers.openai.com/api/docs/models/gpt-5.5) that kicks in at that threshold—pre-chunk if possible.

**Sources:** [OpenAI GPT-5.5 Model Docs](https://developers.openai.com/api/docs/models/gpt-5.5) · [DataCamp GPT-5.5 Overview](https://www.datacamp.com/blog/gpt-5-5) · [OpenAI Community Launch Post](https://community.openai.com/t/gpt-5-5-is-here-available-in-the-api-codex-and-chatgpt-today/1379630) · [Digital Applied Complete Guide](https://www.digitalapplied.com/blog/gpt-5-5-complete-guide-thinking-pro-1m-context)

---

## 2. NVIDIA Nemotron 3 — Open Weights LLM Family

### What it replaces / augments
The Nemotron 3 family (Nano 30B-A3B, Super 120B-A12B, Nano Omni 30B multimodal) are candidates to replace or supplement the **SambaNova inference layer** currently used for fast open-model inference in ATOM's intel modules, or to run on-prem / private cloud with full data control.

### Models in the family

| Model | Params (Active) | Architecture | Context | Specialty |
|---|---|---|---|---|
| Nemotron 3 Nano | 30B (3B active) | Hybrid MoE (Mamba + Transformer) | 1M tokens | High-throughput agentic text |
| Nemotron 3 Super | 120B (12B active) | LatentMoE + Mamba-2 + MTP | 1M tokens | DeepResearch Bench #1, reasoning |
| Nemotron 3 Nano Omni | 30B (3B active) | Hybrid MoE + multimodal | — | Audio/video/doc reasoning |

### Latency / Quality / Cost vs. current

- **Nemotron 3 Super** delivers [up to 5× higher throughput than previous Nemotron Super and 2.2× higher than GPT-OSS-120B](https://llm-stats.com/models/nemotron-3-super-120b-a12b) while matching accuracy, thanks to native NVFP4 pretraining on Blackwell (4× faster than INT8 on Hopper).
- On **RULER @ 1M tokens**, Nemotron 3 Super scores 91.75 vs GPT-OSS-120B at 22.30—a massive long-context advantage for loading full prospect/account history in ATOM's intel modules ([VentureBeat](https://venturebeat.com/technology/nvidias-new-open-weights-nemotron-3-super-combines-three-different)).
- **Nano** provides [3.3× higher inference throughput than Qwen3-30B-A3B](https://research.nvidia.com/labs/nemotron/Nemotron-3/) on a single H200—critical for high-concurrency outbound dialing.
- **Cost:** Zero API token cost when self-hosted on NVIDIA NIMs or vLLM. Replaces SambaNova API spend entirely. Capital cost of GPU compute required.

**Recommendation: Integrate Nano (self-hosted via NIM) for the high-volume fast-path intel modules.** Super for deep research/enrichment tasks. Nano Omni as a future upgrade once ATOM handles audio/video meeting data.

### Integration sketch

```bash
# Self-hosted via NVIDIA NIM (Docker)
docker run -d --gpus all --env NVIDIA_API_KEY=$NVIDIA_API_KEY \
  -p 8000:8000 nvcr.io/nim/nvidia/nemotron-3-nano:latest

# .env
NEMOTRON_NANO_ENDPOINT=http://localhost:8000/v1
NEMOTRON_NANO_MODEL=nemotron-3-nano

# OpenAI-compatible API call
POST $NEMOTRON_NANO_ENDPOINT/chat/completions
{ "model": "nemotron-3-nano", "messages": [...], "stream": true }

# Or via NVIDIA cloud NIM API
POST https://integrate.api.nvidia.com/v1/chat/completions
Authorization: Bearer $NVIDIA_API_KEY
{ "model": "nvidia/nemotron-3-nano", ... }
```

**Sources:** [NVIDIA Nemotron 3 Research Page](https://research.nvidia.com/labs/nemotron/Nemotron-3/) · [NVIDIA Nemotron 3 Nano Omni Blog](https://developer.nvidia.com/blog/nvidia-nemotron-3-nano-omni-powers-multimodal-agent-reasoning-in-a-single-efficient-open-model/) · [Nemotron 3 Super on LLM Stats](https://llm-stats.com/models/nemotron-3-super-120b-a12b) · [VentureBeat Nemotron 3 Super Coverage](https://venturebeat.com/technology/nvidias-new-open-weights-nemotron-3-super-combines-three-different)

---

## 3. Perplexity Embeddings (sonar-embed / pplx-embed-v1)

### What it replaces / augments
Currently ATOM uses **Pinecone with custom atom-rag** for vector storage and retrieval—which requires a separate embedding call (likely OpenAI text-embedding-3-large or similar) to populate and query. `pplx-embed-v1` is a candidate to replace that embedding model, unifying the embedding and search stack under Perplexity for reduced vendor surface.

### Models available

| Model | Dimensions | Context | INT8/BINARY | Price / 1M tokens |
|---|---|---|---|---|
| `pplx-embed-v1-0.6b` | 1024 | 32K | Yes | **$0.004** |
| `pplx-embed-v1-4b` | 2560 | 32K | Yes | **$0.030** |
| `pplx-embed-context-v1-0.6b` | 1024 | 32K | Yes | $0.008 |
| `pplx-embed-context-v1-4b` | 2560 | 32K | Yes | $0.050 |

The `pplx-embed-context-v1` variants embed passages with respect to surrounding document-level context, [reducing chunk-isolation errors common in dense RAG pipelines](https://research.perplexity.ai/articles/pplx-embed-state-of-the-art-embedding-models-for-web-scale-retrieval).

### Latency / Quality / Cost vs. current

According to a [third-party domain benchmark](https://aimultiple.com/embedding-models), `pplx-embed-v1-0.6b` scores **0.8031 nDCG@3 on legal contracts**—outperforming OpenAI text-embedding-3-large (0.6430) at **1/32 the price per token**. The 4B variant maximizes retrieval quality; the 0.6B targets low-latency paths. Matryoshka Representation Learning (MRL) support enables dimension truncation for storage cost control in Pinecone.

- **vs. OpenAI text-embedding-3-large ($0.13/1M):** pplx-embed-v1-0.6b is ~33× cheaper and beats it on domain-specific benchmarks
- **vs. Voyage 3 ($0.18/1M):** pplx-embed-v1-4b is 6× cheaper for comparable or better quality on specialized domains
- Context window of **32K tokens** covers long prospect dossiers without chunking truncation

**Recommendation: Strong integrate.** Replace OpenAI/Voyage embeddings in atom-rag with `pplx-embed-v1-4b` for quality-critical retrieval and `pplx-embed-v1-0.6b` for high-volume real-time lookup. Use context variants for chunked company/product knowledge bases.

### Integration sketch

```python
# .env
PERPLEXITY_API_KEY=pplx-...
PPLX_EMBED_MODEL=pplx-embed-v1-4b   # or 0.6b for latency path

# Python (Perplexity SDK or OpenAI-compatible)
from perplexity import Perplexity
client = Perplexity()

response = client.embeddings.create(
    input=["Prospect company overview: Acme Corp builds..."],
    model="pplx-embed-v1-4b"   # returns base64-encoded INT8
)
# Decode and upsert to Pinecone
import base64, numpy as np
embedding = np.frombuffer(
    base64.b64decode(response.data[0].embedding), dtype=np.int8
).astype(np.float32)
```

**Sources:** [Perplexity Embeddings Quickstart](https://docs.perplexity.ai/docs/embeddings/quickstart) · [pplx-embed Research Post](https://research.perplexity.ai/articles/pplx-embed-state-of-the-art-embedding-models-for-web-scale-retrieval) · [Embeddings API Reference](https://docs.perplexity.ai/api-reference/embeddings-post) · [AIMultiple Embedding Benchmark](https://aimultiple.com/embedding-models)

---

## 4. Perplexity Agent API — Agentic Search Runtime

### What it replaces / augments
ATOM currently calls **Sonar** for live RAG augmentation during or after calls. The **Perplexity Agent API** (launched March 2026) goes further: it is a managed runtime that handles multi-model orchestration, web search, code execution, and tool routing in a single API—effectively replacing a DIY LangGraph + Sonar + sandboxed-code-execution stack.

### What it offers

Per the [official launch post](https://www.perplexity.ai/hub/blog/agent-api-a-managed-runtime-for-agentic-workflows):
- Replaces: model router + search layer + embeddings provider + sandbox service + monitoring stack
- Built-in tools: `web_search` and `fetch_url` (callable from the agent loop)
- Structured outputs and third-party model support
- OpenAI-compatible interface

### Latency / Quality / Cost vs. current

The [Perplexity Search API](https://alphacorp.ai/blog/perplexity-search-api-vs-tavily-the-better-choice-for-rag-and-agents-in-2025) reports **median latency of 358ms with P95 under 800ms** for the underlying search layer, suitable for async tool calls during call-handling flows (not inline voice synthesis path). For post-call enrichment, research, and pre-call dossier generation, this matches or beats assembling the same capability from Sonar + custom sandboxes.

**Recommendation: Use Agent API for pre-call dossier generation and post-call follow-up research.** This consolidates what currently requires separate Sonar calls, custom Linode services, and Perplexity Sonar into one managed endpoint. Keep direct Sonar calls for the simpler real-time lookup paths where latency is paramount.

### Integration sketch

```bash
# .env
PERPLEXITY_AGENT_API_KEY=pplx-...

# POST to Agent API (OpenAI-compatible)
POST https://api.perplexity.ai/v1/agent/completions
Authorization: Bearer $PERPLEXITY_AGENT_API_KEY
Content-Type: application/json
{
  "messages": [
    {"role": "user", "content": "Research Acme Corp's tech stack, recent funding, and decision makers. Use web search."}
  ],
  "tools": [{"type": "web_search"}, {"type": "fetch_url"}],
  "model": "sonar-pro"    // or third-party model
}
```

Pipeline placement: fire Agent API calls **async at call connect** (prospect dossier refresh) and **post-call** (follow-up research, CRM enrichment). Do not block voice streaming on Agent API responses.

**Sources:** [Perplexity Agent API Launch Post](https://www.perplexity.ai/hub/blog/agent-api-a-managed-runtime-for-agentic-workflows) · [Agent API Quickstart Docs](https://docs.perplexity.ai/docs/agent-api/quickstart) · [Perplexity vs Tavily Search API Analysis](https://alphacorp.ai/blog/perplexity-search-api-vs-tavily-the-better-choice-for-rag-and-agents-in-2025)

---

## 5. Perplexity Sonar — Already Integrated (Best Practices)

ATOM already uses Sonar for live RAG augmentation. Below are the current model options and recommended practices as of May 2026.

### Model tiers

| Model | Best For | Citations | Notes |
|---|---|---|---|
| `sonar` | Fast inline lookups, real-time voice assist | Yes | Sub-400ms path |
| `sonar-pro` | Complex multi-step queries, dossiers | 2× citations | Larger context |
| `sonar-deep-research` | Async research tasks | Extensive | Use async API |

**[Perplexity's async API](https://docs.perplexity.ai/docs/resources/changelog)** for Sonar Deep Research allows submitting long-running research jobs and polling for results—ideal for pre-call prep that doesn't block real-time call flow.

### Best practices for ATOM

1. **Domain filtering:** Use `"search_domain": "linkedin"` or `"search_domain": "sec"` for targeted prospect research rather than open-web queries that may surface irrelevant content.
2. **`search_context_size`:** Set to `"low"` for inline voice-path lookups (reduces latency), `"high"` for async dossier generation.
3. **Streaming:** Always stream Sonar responses (`"stream": true`) for any path that feeds into voice synthesis—partial text enables Octave TTS to begin rendering earlier.
4. **Citation stripping:** Strip `[1][2]` citation markers from Sonar output before passing to TTS to avoid unnatural speech.
5. **Caching:** Cache Sonar responses by prospect ID + query hash with a 4-hour TTL to reduce redundant lookups during multi-attempt dial campaigns.

```bash
# Optimized real-time Sonar call
POST https://api.perplexity.ai/v1/sonar
{
  "model": "sonar",
  "messages": [{"role": "user", "content": "What is Acme Corp's current CTO?"}],
  "stream": true,
  "web_search_options": {"search_context_size": "low"},
  "search_domain": "linkedin"
}
```

**Sources:** [Perplexity Sonar API Quickstart](https://docs.perplexity.ai/docs/sonar/quickstart) · [Perplexity Changelog](https://docs.perplexity.ai/docs/resources/changelog) · [Sonar Pro Launch Post](https://www.perplexity.ai/hub/blog/introducing-the-sonar-pro-api)

---

## 6. Best-in-Class: Everything Else

---

### 6.1 Voice Models

The voice layer is the highest-latency sensitivity point in an outbound AI sales agent. Every millisecond of TTS latency extends perceived dead-air between turns.

#### Cartesia Sonic (current best for speed)
[Cartesia Sonic Turbo](https://cartesia.ai/regions/north-america) achieves **40ms Time-to-First-Audio**—the fastest TTS on market as of May 2026. Sonic 2 offers **90ms TTFA** with higher fidelity voice cloning. Built on State Space Models (SSMs) rather than transformers, enabling lower latency at scale. ATOM currently uses Octave TTS; Cartesia Sonic is a strong upgrade for the TTS layer if sub-100ms is critical. Available at [docs.cartesia.ai](https://docs.cartesia.ai/build-with-cartesia/tts-models/older-models).

**Model:** `sonic-turbo` (40ms) or `sonic-2` (90ms, higher fidelity)  
**Verdict for ATOM:** Strong upgrade path over Octave for raw latency. Evaluate against voice quality requirements.

#### Hume Octave 2 (current provider, now upgraded)
[Octave 2](https://www.hume.ai/blog/octave-2-launch) is 40% faster than Octave 1, generates audio in **under 200ms**, is half the price, supports 11 languages, and adds voice conversion + phoneme editing. If ATOM stays with Hume, upgrading from Octave 1 to Octave 2 is an immediate win: same integration, better performance, lower cost.

#### Hume EVI 3 (speech-language model, not just TTS)
[EVI 3](https://www.hume.ai/blog/introducing-evi-3) is Hume's third-generation speech-language model that handles STT + LLM + TTS in a single unified model. It can stream user speech and produce expressive natural speech responses at conversational latency, communicating with reasoning models and web search systems as it speaks ("thinking fast and slow"). For ATOM, replacing the Hume EVI (voice + emotion) → Claude (LLM) → Octave (TTS) chain with **EVI 3 as the unified spine** would eliminate 2 inter-service roundtrip hops, dramatically reducing total turn latency.

**Verdict for ATOM:** The most architecturally impactful upgrade. EVI 3 as the voice-language backbone replaces three separate services.

#### ElevenLabs Eleven v3
[Eleven v3](https://elevenlabs.io/blog/eleven-v3) (GA May 2025) is the most expressive TTS model ElevenLabs has released, with 70+ language support and inline audio tags for emotional direction. However, ElevenLabs explicitly recommends [using v2.5 Turbo/Flash for real-time conversational use cases](https://elevenlabs.io/blog/eleven-v3) as v3 has higher latency. Not recommended for ATOM's primary voice path.

#### Sesame CSM (open-source, experimental)
[Sesame's Conversational Speech Model (CSM)](https://github.com/SesameAILabs/csm) uses a Llama backbone + audio decoder producing RVQ tokens. Generates high-quality conversational prosody by consuming the full conversation history. Apache 2.0 licensed. Available natively in Hugging Face Transformers. Currently a **research/experimental** option—not production-ready for high-volume outbound. Worth watching for future custom voice fine-tuning.

#### OpenAI gpt-4o-realtime (WebRTC/WebSocket)
[gpt-4o-realtime-preview](https://developers.openai.com/api/docs/models/gpt-4o-realtime-preview) handles audio/text in real-time over WebRTC or WebSocket. Tightly integrated with OpenAI's ecosystem. If ATOM shifts to GPT-5.5 as primary LLM, pairing with gpt-realtime is the natural path for a unified OpenAI voice stack. However, it offers less emotional intelligence than Hume EVI.

#### Daily / Pipecat (orchestration framework)
[Pipecat by Daily](https://www.pipecat.ai) is an open-source framework for voice and multimodal conversational AI that handles: STT → LLM → TTS pipeline coordination, WebRTC transport via Daily's infrastructure, interruption handling, and turn detection. [Pipecat officially supports](https://docs.pipecat.ai/pipecat/learn/overview) Daily, Twilio, and custom transports. For ATOM, adopting Pipecat as the voice orchestration layer would standardize pipeline management and make swapping voice components (STT, TTS, LLM) significantly easier without rewiring the telephony glue.

---

### 6.2 LLMs for Agent Reasoning

| Model | Context | Input $/1M | Output $/1M | Agentic Strength | Voice Agent Fit |
|---|---|---|---|---|---|
| **Claude Opus 4.7** (current tier) | 200K | $15 | $75 | #1 coding (SWE-bench 72.5%), multi-hour tasks | High—deep reasoning, long deal history |
| **Claude Sonnet 4.6** (ATOM primary) | 200K | $3 | $15 | Excellent speed/quality balance | Best default for volume |
| **GPT-5.5** | 1M | $5 | $30 | Best agentic coding, terminal bench | Strong for intel/enrichment |
| **Gemini 3 Pro Preview** | Massive | TBD | TBD | Most powerful agentic orchestrator per Google | Monitor—not GA |
| **Gemini 2.5 Pro** | 1M+ | Competitive | Competitive | Top LMArena 6 months, strong multimodal | Strong alternative backbone |
| **Nemotron 3 Super** | 1M | Self-hosted | Self-hosted | DeepResearch Bench #1, 120B reasoning | Best open-weights option |
| **Llama 4** | Long | Free (OS) | Free (OS) | Strong open baseline | Good for fine-tuned vertical models |
| **DeepSeek v3/R1** | Long | Very low | Very low | Cost-effective reasoning | Risk: China data residency concerns |

[Claude Opus 4.7](https://www.anthropic.com/claude/opus) is currently Anthropic's most capable generally available model, with step-change improvements in agentic coding over 4.6. [Gemini 3 Pro](https://developers.googleblog.com/building-ai-agents-with-google-gemini-3-and-open-source-frameworks/) was introduced as the most powerful agentic orchestrator model for complex agent workflows. For ATOM's voice path, latency rules: Claude Sonnet 4.6 remains the correct default. Opus 4.7 and GPT-5.5 are correct for off-call enrichment pipelines.

---

### 6.3 Vector DB / Retrieval

ATOM currently uses Pinecone via the custom atom-rag service on Linode.

| Database | Architecture | Multi-tenancy | Cost (1536-dim, 1M reads, 1M writes) | Key Strength |
|---|---|---|---|---|
| **Pinecone** (current) | Managed serverless | 100K namespaces / 20 indexes | $41 | Mature, reliable, built-in embeddings |
| **Turbopuffer** | Serverless on object storage | Unlimited namespaces | **$9.36** | 10× cheaper, sub-10ms p50, 3.5T docs in production |
| **pgvector + pgvectorscale** | Postgres extension | Schema-based | ~$15 (self-hosted) | 471 QPS at 99% recall on 50M vectors—11.4× better than Qdrant |
| **Vespa** | Distributed search | Full multi-tenancy | Self-hosted | Hybrid search (dense + BM25 + structured), battle-tested at Yahoo scale |
| **LanceDB** | Columnar, embedded/serverless | Namespace-based | Very low | Zero-copy, great for local dev; weaker at billion-scale SaaS |

[Turbopuffer](https://turbopuffer.com) handles 3.5T+ documents and 25K+ queries/s in production at roughly 10× lower cost than Pinecone. For ATOM's multi-tenant SaaS model (multiple prospect namespaces per campaign), Turbopuffer's unlimited namespaces with a $9.36 all-in cost vs Pinecone's $41 is compelling. The atom-rag service on Linode can route to Turbopuffer's API with minimal changes.

[pgvectorscale benchmarks](https://www.firecrawl.dev/blog/best-vector-databases) show 471 QPS at 99% recall on 50M vectors, 11.4× faster than Qdrant, and 28× lower p95 latency than Pinecone s1 at the same recall—making it a strong option if Supabase is adopted as the broader data layer.

**Recommendation:** Migrate atom-rag to Turbopuffer for cost and scale. Evaluate pgvector+Supabase as a unified data layer upgrade.

---

### 6.4 Embedding Models

| Model | Dims | Price / 1M | MTEB Rank | Notes |
|---|---|---|---|---|
| **pplx-embed-v1-4b** | 2560 | $0.030 | Top tier domain-specific | Best value for legal/B2B retrieval |
| **pplx-embed-v1-0.6b** | 1024 | **$0.004** | Strong baseline | 32× cheaper than OpenAI, INT8 quantized |
| **Voyage 3.5** | Variable | $0.06 | #1 across legal/CS/healthcare average | [Beats own flagship](https://aimultiple.com/embedding-models) at half the price |
| **OpenAI text-embedding-3-large** | 3072 | $0.13 | Mid-tier domain | Fast (18ms avg), but costly and outperformed |
| **Cohere Embed v4** | Variable | Competitive | State-of-the-art multimodal | [Text + image embeddings](https://cohere.com/blog/embed-4) for docs/screenshots |

[Voyage 3.5 averages 0.9429 nDCG@3 across legal, customer support, and healthcare domains](https://aimultiple.com/embedding-models), outperforming Voyage's own 4-series flagship at half the price. For ATOM's prospect/account knowledge base (contractual context, company docs), Voyage 3.5 or pplx-embed-v1-4b offer the best quality-to-cost ratio.

---

### 6.5 Agent / Tool-Use Frameworks

| Framework | Language | Paradigm | Best For | Production Proven |
|---|---|---|---|---|
| **LangGraph** | Python | Graph/cyclic state machine | Complex multi-step workflows, crash recovery, human-in-loop | Yes (Klarna, Uber, LinkedIn) |
| **Mastra** | TypeScript | Graph-based, serverless-first | TypeScript teams, Vercel/CF Workers deployment, 5-40× context compression | Growing |
| **OpenAI Agents SDK** | Python | OpenAI-native tool calling | Teams fully on OpenAI stack | Yes |
| **Anthropic MCP** | Multi-language | Universal tool protocol | Cross-vendor tool connectivity | Yes—[10,000+ MCP servers, adopted by ChatGPT, Copilot, Gemini](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) |
| **Inngest** | TypeScript/Python | Durable functions, event-driven | Background jobs, retries, cron | Yes |

[Anthropic donated MCP to the Linux Foundation / Agentic AI Foundation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) in December 2025, cementing it as the de-facto industry standard for agent-to-tool connectivity. For ATOM, adopting MCP for the tool layer means Apollo, Hunter, PDL, and BuiltWith integrations can be built once as MCP servers and reused across any LLM.

**Recommendation:** Adopt MCP as the tool connectivity standard. Use LangGraph for the Python-based orchestration backbone (crash recovery + state persistence critical for multi-call campaigns). Evaluate Pipecat (Section 6.1) as the voice-specific orchestration layer on top.

---

### 6.6 Telephony

ATOM currently uses **Twilio** for telephony.

| Provider | Network | AI Voice Latency | Pricing (US voice) | AI Readiness |
|---|---|---|---|---|
| **Twilio** (current) | Public internet, carrier relationships | Often >3s | $0.013/min | Broad ecosystem, Voice Intelligence add-on, OpenAI partnership |
| **Telnyx** | Private IP backbone, 30+ country licenses | **<1 second** | **$0.007/min** | Native STT + event streaming, built for AI voice |
| **Vonage** | Carrier network | Moderate | Competitive | Good for SMS/omnichannel |
| **Plivo** | Carrier network | Moderate | $0.004/min | Cheapest per minute, weaker AI tooling |

[Telnyx owns a private global IP backbone with telecom licenses in 30+ countries](https://telnyx.com/resources/telnyx-vs-twilio-which-voice-api-is-better) vs Twilio's public-internet routing—translating to <1 second voice latency vs Twilio's >3 seconds in real-world AI agent deployments. At $0.007/min vs Twilio's $0.013/min, Telnyx offers ~46% cost reduction. Telnyx also provides native built-in STT and event streaming, reducing the need for third-party ASR services in the inbound/detection path.

[A major e-commerce company switching from Twilio to Telnyx reported 43% cost savings](https://callin.io/telnyx-vs-twilio/) while maintaining equivalent call quality.

**Recommendation:** Migrate to Telnyx. TeXML is Twilio TwiML-compatible, making migration low-friction. The latency improvement alone justifies the switch for a voice AI agent.

---

### 6.7 Observability + Evals

| Platform | Type | Best For | Cost |
|---|---|---|---|
| **Arize AX / Phoenix** | Managed + open source | Agent evaluation, OTel-native, session-level traces | Phoenix: free OSS; AX: enterprise |
| **Langfuse** | Open source, self-host | Teams needing full data control | OSS free / $199/mo cloud |
| **Braintrust** | Managed | Prompt experimentation, CI/CD evals | $249/mo (1M free spans) |
| **Helicone** | Managed proxy | Quick setup, spend tracking | Usage-based |
| **Posthog LLM analytics** | Product analytics | User behavior on AI features | Free tier available |
| **Hume's built-in analytics** | Voice-specific | Emotion + engagement tracking per call | Bundled with Hume EVI |

[Arize AX](https://arize.com/llm-evaluation-platforms-top-frameworks/) is purpose-built for agent evaluation with session-level multi-step traces, tool-calling analysis, agent convergence tracking, and coherence scoring. It processes trillions of events/month and is OTel-native, enabling zero-copy data lake integration via Iceberg/Parquet. [Arize Phoenix](https://phoenix.arize.com) is the free open-source self-hosted version with the same schema.

For ATOM's voice sales agent, combine: **Arize Phoenix** (self-hosted, OTel trace capture) + **Hume's built-in analytics** (emotion/engagement per call) + **Langfuse** (prompt versioning and A/B evaluation of sales scripts).

---

### 6.8 Guardrails / Safety

| Platform | Approach | Key Capability | Latency |
|---|---|---|---|
| **Lakera Guard** | Real-time AI firewall | Prompt injection, jailbreaks, content moderation, malicious link detection | <10ms inline |
| **Pillar Security** | AI SecOps | 24/7 monitoring of prompts + tool calls, jailbreak detection | Async + inline |
| **Protect AI** | Model security | Supply chain security, model scanning | Pipeline stage |

[Lakera Guard](https://docs.lakera.ai/docs/defenses) provides a real-time AI application firewall with ML-based prompt attack detection, content moderation, and malicious link detection. For ATOM, placing Lakera Guard between inbound prospect data (company names, email content passed into prompts) and LLM calls prevents prompt injection attacks from adversarial inputs. It adds <10ms overhead—acceptable for the non-voice-path Intel modules.

---

### 6.9 Real-Time Call Intelligence

| Service | Specialty | WER (streaming) | Latency | Price |
|---|---|---|---|---|
| **Deepgram Nova-3** | Best streaming STT | **6.84% median WER** (54% better than next competitor) | <1s | **$0.0077/min** |
| **AssemblyAI Universal-Streaming** | End-of-turn detection + accuracy | Competitive | **300ms** | $0.15/hr (~$0.0025/min) |
| **Hume EVI (built-in)** | Emotion-aware STT + response | — | Conversational | Bundled with EVI |
| **Symbl.ai** | Conversation intelligence | Moderate | Batch/near-real-time | Per-minute + per-insight |

[Deepgram Nova-3](https://deepgram.com/learn/introducing-nova-3-speech-to-text-api) achieves a **median WER of 6.84% on real-time audio**, a 54.2% improvement over the next-best competitor (14.92% WER), while maintaining Nova-2's industry-leading inference speed. It is the first voice AI model to offer real-time multilingual transcription across 10 languages—critical for ATOM's international expansion. At $0.0077/min it is over 2× more affordable than cloud providers for equivalent streaming accuracy.

[AssemblyAI Universal-Streaming](https://www.assemblyai.com/universal-streaming) offers **300ms latency** with intelligent end-of-turn detection combining acoustic + semantic features—superior for managing natural conversation flow in the voice agent. Priced at $0.15/hr ($0.0025/min), it is the cheapest streaming option if accuracy is acceptable for the use case.

**Recommendation:** Use Deepgram Nova-3 for call transcription (highest accuracy), AssemblyAI Universal-Streaming for fast turn-detection signal, Hume EVI's built-in for emotion detection (if staying on EVI 3 stack).

---

### 6.10 Compliance Tooling (TCPA / DNC)

Following the [FCC's February 2024 ruling](https://dialzara.com/blog/ai-voice-calls-tcpa-rules-compliance-guide), AI-generated voices are explicitly classified as "artificial or prerecorded voices" under the TCPA. Non-compliance penalties run $500–$1,500 per call, with documented enforcement actions reaching $50M+.

**Mandatory compliance requirements for ATOM:**
- Written consent for marketing calls; express consent for informational calls
- DNC Registry scrub every 31 days
- AI disclosure within first 2 minutes of every call
- Opt-out recognition (STOP, QUIT, CANCEL, UNSUBSCRIBE, END) processed within 24 hours
- Tamper-proof consent and call logs for 5+ years
- Time-zone gating: 8 AM–9 PM in recipient's local time

| Tool | Function | Vendor |
|---|---|---|
| **Trestle** | Phone-to-name verification, litigator screening, TCPA risk scoring | [trestleiq.com](https://trestleiq.com/tcpa-compliance-for-call-centers-4-essential-tools-and-best-practices/) |
| **Numeracle** | Caller ID reputation management, STIR/SHAKEN attestation | [numeracle.com](https://www.numeracle.com/press-releases/2025-remediation-case-study) |
| **Caller ID Reputation** | Real-time spam/fraud label monitoring on your DIDs | calleridreputation.com |
| **Robokiller Intel** | DNC and spam-likely risk scoring on target numbers | robokiller.com |

**Recommended ATOM compliance stack:** Trestle for pre-dial phone validation + litigator screening → Numeracle for outbound DID registration and STIR/SHAKEN → Telnyx CNAM registration → Robokiller Intel for campaign-level DNC scoring.

---

## 7. Recommended Vibranium Stack — Migration Table

| Layer | Current | Vibranium | Justification | Migration Effort |
|---|---|---|---|---|
| **Telephony** | Twilio | **Telnyx** | Private IP backbone → <1s vs >3s AI voice latency; 46% cost reduction; native STT + event streaming; TeXML = TwiML-compatible | **M** — TeXML drop-in swap |
| **Voice Orchestration** | Custom pipeline | **Pipecat (Daily)** | Open-source, handles STT→LLM→TTS pipeline + WebRTC + interruption + turn detection; modular component swap | **M** — refactor voice pipeline |
| **Speech-Language Model (STT+LLM+TTS)** | Hume EVI → Claude Sonnet → Octave TTS (3 hops) | **Hume EVI 3** (unified spine) | Single model handles STT + LLM + emotion + TTS at conversational latency; eliminates 2 inter-service roundtrips | **S** — EVI 3 is same API family |
| **TTS (if keeping separate)** | Octave TTS | **Cartesia Sonic Turbo** + **Octave 2** | Sonic Turbo = 40ms TTFA (lowest latency); Octave 2 = 200ms, 40% faster, half cost vs Octave 1 | **S** — API swap |
| **Primary LLM (voice path)** | Claude Sonnet 4.6 | **Claude Sonnet 4.6** (unchanged) | Best speed/quality/cost for real-time voice; no change needed | **—** |
| **Power LLM (enrichment/complex)** | Various | **GPT-5.5 + Claude Opus 4.7** | GPT-5.5 for agentic research tasks (1M context); Opus 4.7 for sustained multi-step reasoning | **S** — add model routing |
| **Open-Weights LLM (intel modules)** | SambaNova inference | **Nemotron 3 Nano (self-hosted NIM)** | Zero API cost; 3.3× throughput vs peers; NVFP4 on Blackwell; 1M context; full data control | **L** — GPU infra provisioning |
| **Embedding Model** | (OpenAI/Voyage assumed) | **pplx-embed-v1-4b / 0.6b** | 32× cheaper than OpenAI; beats text-embedding-3-large on domain-specific benchmarks; 32K context; MRL truncation | **S** — drop-in in atom-rag |
| **Vector DB** | Pinecone (atom-rag / Linode) | **Turbopuffer** | 10× cheaper ($9.36 vs $41 per 1M ops); unlimited namespaces; sub-10ms p50; handles 3.5T docs in production | **M** — migrate atom-rag service |
| **Live RAG (real-time)** | Perplexity Sonar | **Perplexity Sonar** (with best practices) | Already integrated; upgrade: domain filtering, context sizing, citation stripping, 4hr TTL caching | **S** — config changes |
| **Agentic Search** | Ad-hoc Sonar calls | **Perplexity Agent API** | Managed runtime for multi-step research + tool execution; replaces DIY LangGraph+Sonar for pre/post-call dossiers | **M** — refactor enrichment pipeline |
| **Tool Connectivity** | Custom integrations | **Anthropic MCP** | Industry standard; 10K+ servers; supported by all major LLMs; build Apollo/Hunter/PDL as MCP servers once | **M** — wrap existing APIs |
| **Agent Orchestration** | Custom | **LangGraph** | Graph/cyclic state; crash-proof checkpointing; human-in-loop; production-proven at enterprise scale | **L** — architectural refactor |
| **STT (transcription)** | Hume EVI built-in | **Deepgram Nova-3** | 6.84% median streaming WER (54% better than next competitor); multilingual; $0.0077/min | **S** — add parallel transcription track |
| **End-of-Turn Detection** | Basic silence detection | **AssemblyAI Universal-Streaming** | 300ms latency; acoustic + semantic turn detection; $0.0025/min | **S** — add as pipeline layer |
| **Observability** | None specified | **Arize Phoenix** (OSS) + **Langfuse** | Phoenix: OTel-native agent traces; Langfuse: prompt versioning + A/B evals for sales scripts | **S** — instrument existing services |
| **AI Guardrails** | None specified | **Lakera Guard** | <10ms real-time firewall; blocks prompt injection from prospect data inputs | **S** — middleware wrapper |
| **Compliance (TCPA)** | Custom | **Trestle + Numeracle + Telnyx CNAM** | Pre-dial litigator screening, STIR/SHAKEN, DID reputation management; post-2024 FCC ruling requirements | **M** — integrate pre-dial flow |

**Migration Effort Key:** S = Small (hours–days), M = Medium (1–3 weeks), L = Large (1–2 months), XL = Quarter+

---

### Priority Sequence Recommendation

**Sprint 1 (S items — highest ROI, lowest effort):**
1. Upgrade Hume Octave → **Octave 2** (same API, 40% faster, 50% cheaper)
2. Add **pplx-embed-v1** as embedding model in atom-rag (32× cost reduction, better quality)
3. Add **Arize Phoenix** + **Langfuse** observability instrumentation
4. Implement Sonar best practices (domain filtering, citation stripping, TTL caching)
5. Upgrade LLM routing to add **GPT-5.5** for enrichment pipeline

**Sprint 2 (M items — core infrastructure):**
6. Migrate telephony: **Twilio → Telnyx** (TeXML drop-in)
7. Refactor atom-rag vector store: **Pinecone → Turbopuffer**
8. Integrate **Perplexity Agent API** for pre-call dossier generation
9. Wrap Apollo/Hunter/PDL/BuiltWith as **MCP servers**
10. Add **Trestle + Numeracle** compliance pipeline

**Sprint 3 (L items — architectural evolution):**
11. Provision **Nemotron 3 Nano NIM** on GPU infrastructure for intel modules
12. Refactor voice pipeline with **Pipecat** orchestration framework
13. Evaluate **LangGraph** adoption for agent orchestration backbone

**Sprint 4 (architectural moonshot):**
14. Evaluate **Hume EVI 3** as unified STT+LLM+TTS spine (eliminates 2 roundtrip hops)
15. Introduce **LangGraph** full orchestration with checkpointing

---

*Research compiled May 2026. All pricing reflects publicly available rates at time of publication. Model capabilities and pricing evolve rapidly; verify against current vendor docs before implementation.*
