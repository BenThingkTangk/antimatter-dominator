# atom-rag → Perplexity Embeddings migration

> One-page runbook for swapping the atom-rag service (Linode-hosted FastAPI
> at `https://atom-rag.45-79-202-76.sslip.io`) from OpenAI
> `text-embedding-3-large` to Perplexity `pplx-embed-v1`.
>
> The atom-rag service lives in a separate repo. This is the playbook the
> next session will execute on that box; everything in atom-dominator-pro
> already works with whatever embedding model the RAG returns.

## Why now

Per the Vibranium Research, `pplx-embed-v1` is roughly:
- **32× cheaper** per 1M tokens vs `text-embedding-3-large`
  ($0.02/1M vs ~$0.65/1M)
- **Higher MRR@10** on B2B / sales / web-research domains
- Returns 1024-dim vectors → Pinecone storage drops ~33% vs 1536-dim OpenAI
  → roughly $0.07/1K vectors/month savings at our current scale

## Pre-flight

Before flipping the switch on the live box, verify:

1. `PERPLEXITY_API_KEY` is set in atom-rag's environment (`.env` on the box,
   or systemd `Environment=` lines, depending on how it was deployed)
2. Pinecone index dimensions match. The current index is 1536-dim; we either:
   a. Create a brand-new index `atom-rag-pplx` at 1024-dim, point new code
      at it, and reingest. (Recommended; allows side-by-side validation.)
   b. Drop the existing index and recreate at 1024-dim. (Faster but cuts off
      query traffic for ~20 min during reingest.)

We'll use option (a) — zero-downtime cutover.

## The diff (Python pseudocode)

```python
# atom_rag/embeddings.py — current OpenAI path
def embed_openai(texts: list[str]) -> list[list[float]]:
    r = openai.embeddings.create(
        model="text-embedding-3-large",
        input=texts,
    )
    return [d.embedding for d in r.data]

# NEW Perplexity path
def embed_pplx(texts: list[str]) -> list[list[float]]:
    r = httpx.post(
        "https://api.perplexity.ai/embeddings",
        headers={"Authorization": f"Bearer {os.environ['PERPLEXITY_API_KEY']}"},
        json={"model": "pplx-embed-v1", "input": texts},
        timeout=20,
    )
    r.raise_for_status()
    return [row["embedding"] for row in r.json()["data"]]

EMBED_PROVIDER = os.getenv("EMBED_PROVIDER", "perplexity")  # default to new

def embed(texts: list[str]) -> list[list[float]]:
    if EMBED_PROVIDER == "perplexity":
        try: return embed_pplx(texts)
        except Exception as e:
            logger.warning(f"pplx failed, falling back to openai: {e}")
    return embed_openai(texts)
```

Pinecone client init:

```python
PINECONE_INDEX = os.environ.get("PINECONE_INDEX", "atom-rag-pplx")  # was "atom-rag"
```

## Migration sequence

1. **Provision the new index** in Pinecone:
   ```python
   pc.create_index(
       name="atom-rag-pplx",
       dimension=1024,
       metric="cosine",
       spec=ServerlessSpec(cloud="aws", region="us-east-1"),
   )
   ```
2. **Deploy the new code** to atom-rag with `EMBED_PROVIDER=perplexity` and
   `PINECONE_INDEX=atom-rag-pplx`. This points the running service at the
   empty index — `/company/context` will return empty until ingest finishes.
3. **Trigger reingest** of the canonical product corpus (Antimatter AI,
   Vidzee, Clinix Agent, Clinix AI, Red Team ATOM, MoleculeAI, plus the
   hot-list custom products: Akamai, TierPoint, RapidScale, etc.):
   ```bash
   for product in "Antimatter AI" "Vidzee" "Clinix Agent" "Clinix AI" \
                  "Red Team ATOM" "MoleculeAI" "Akamai" "TierPoint" \
                  "RapidScale" "Five9" "PhysioPS"; do
     curl -X POST https://atom-rag.45-79-202-76.sslip.io/company/load \
          -H "Content-Type: application/json" \
          -d "{\"company_name\":\"$product\"}"
   done
   ```
4. **Smoke test** retrieval quality on each product:
   ```bash
   curl -X POST https://atom-rag.45-79-202-76.sslip.io/company/context \
        -H "Content-Type: application/json" \
        -d '{"company_name":"Akamai","module":"pitch","query":"why akamai compute"}'
   ```
   Compare returned context to the same query on the old `atom-rag` index.
   The new one should be at least as specific; usually noticeably more
   on-domain because pplx-embed knows B2B taxonomy better.
5. **Flip the canonical app** by setting `RAG_URL` env on Vercel — actually,
   no flip needed because it's the same URL. The atom-rag service swap is
   transparent to /api/rag in atom-dominator-pro.
6. **Decommission the old index** after a 7-day shadow period. Until then
   keep both around in case quality regresses in production.

## Rollback

If retrieval quality regresses or pplx hits a rate limit we don't expect:
1. Set `EMBED_PROVIDER=openai` on atom-rag and restart
2. Set `PINECONE_INDEX=atom-rag` on atom-rag and restart
3. Old index is untouched, traffic resumes immediately

## Cost projection at our current scale

Assuming ~250K tokens embedded per day across product ingest + ad-hoc
"Custom Product" warmups:

| Provider | Per-day cost | Per-month cost |
|---|---|---|
| OpenAI text-embedding-3-large | $0.16 | ~$5 |
| Perplexity pplx-embed-v1 | $0.005 | ~$0.15 |

The savings are real but small at our current volume. The bigger wins are
**quality on B2B queries** and **future-proofing** for when we hit
10× the ingest volume after the white-label tenant rollout.

## When to do this

Best done in a quiet window because the reingest pulls fresh Perplexity
Sonar context for each product and that's slower than just embedding cached
text — figure 30-45 min of human-attended migration time.

Estimated total work: 60-90 minutes including smoke tests.
