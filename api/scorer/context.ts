export type RagMatch = { score: number; text: string; source: string };

export async function getRagContext(company: string, segment: string): Promise<RagMatch[]> {
  const pkey = process.env.PINECONE_API_KEY;
  const phost = process.env.PINECONE_HOST;
  const pplx = process.env.PERPLEXITY_API_KEY;
  if (!pkey || !phost || !pplx) return [];
  try {
    const embRes = await fetch("https://api.perplexity.ai/embeddings", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + pplx,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: company + " " + segment + " Akamai Linode edge inference AI security multicloud"
      })
    });
    if (!embRes.ok) return [];
    const emb: any = await embRes.json();
    const vector = emb.data?.[0]?.embedding;
    if (!vector) return [];

    const qRes = await fetch(phost + "/query", {
      method: "POST",
      headers: { "Api-Key": pkey, "Content-Type": "application/json" },
      body: JSON.stringify({ vector, topK: 5, includeMetadata: true })
    });
    if (!qRes.ok) return [];
    const q: any = await qRes.json();
    return (q.matches || []).map((m: any) => ({
      score: m.score,
      text: m.metadata?.text ?? "",
      source: m.metadata?.source ?? ""
    }));
  } catch {
    return [];
  }
}
