/**
 * Vector store abstraction for ATOM Support RAG.
 *
 * Two backends, selected by env:
 *   - Qdrant   (QDRANT_URL set)        → primary per spec
 *   - Supabase (pgvector via RPC)      → fallback, reuses existing infra
 *
 * Both expose the same upsert()/retrieve() contract so the rest of the system
 * (chat, ingest) is backend-agnostic. If neither is configured, retrieve()
 * returns [] (the agent then says it has no sources and escalates).
 */
import type { RetrievedChunk } from "./types.js";
import type { Chunk } from "./chunking.js";
import { sb, supabaseConfigured } from "./supabase.js";
import { EMBED_DIM } from "./embeddings.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const QDRANT_URL = clean(process.env.QDRANT_URL);
const QDRANT_API_KEY = clean(process.env.QDRANT_API_KEY);
const QDRANT_COLLECTION = clean(process.env.QDRANT_COLLECTION_ATOM_SUPPORT) || "atom_support";

export type Backend = "qdrant" | "supabase" | "none";

export function activeBackend(): Backend {
  if (QDRANT_URL) return "qdrant";
  if (supabaseConfigured()) return "supabase";
  return "none";
}

// ─── Qdrant ──────────────────────────────────────────────────────────────────
async function qdrant(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${QDRANT_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Qdrant ${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
  return r.json();
}

async function ensureQdrantCollection(): Promise<void> {
  try {
    await qdrant(`/collections/${QDRANT_COLLECTION}`, { method: "GET" });
  } catch {
    await qdrant(`/collections/${QDRANT_COLLECTION}`, {
      method: "PUT",
      body: JSON.stringify({ vectors: { size: EMBED_DIM, distance: "Cosine" } }),
    });
  }
}

function pointId(c: Chunk): string {
  // Deterministic-ish id so re-ingest upserts rather than duplicates.
  const base = `${c.sourceTitle}::${c.heading}::${c.chunkIndex}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  return String(Math.abs(h)) + String(c.chunkIndex);
}

// ─── Public API ────────────────────────────────────────────────────────────
export async function upsertChunks(
  rows: Array<{ chunk: Chunk; embedding: number[] }>,
): Promise<{ backend: Backend; count: number }> {
  const backend = activeBackend();
  if (!rows.length || backend === "none") return { backend, count: 0 };

  if (backend === "qdrant") {
    await ensureQdrantCollection();
    const points = rows.map(({ chunk, embedding }) => ({
      id: pointId(chunk),
      vector: embedding,
      payload: {
        source_title: chunk.sourceTitle,
        source_url: chunk.sourceUrl,
        source_path: chunk.sourcePath,
        heading: chunk.heading,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        content_type: chunk.contentType,
        tenant_visibility: chunk.tenantVisibility,
        updated_at: new Date().toISOString(),
      },
    }));
    await qdrant(`/collections/${QDRANT_COLLECTION}/points?wait=true`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
    return { backend, count: points.length };
  }

  // Supabase pgvector
  const payload = rows.map(({ chunk, embedding }) => ({
    source_title: chunk.sourceTitle,
    source_url: chunk.sourceUrl || null,
    source_path: chunk.sourcePath || null,
    heading: chunk.heading,
    chunk_index: chunk.chunkIndex,
    content: chunk.content,
    content_type: chunk.contentType,
    tenant_visibility: chunk.tenantVisibility,
    embedding,
    token_estimate: chunk.tokenEstimate,
    updated_at: new Date().toISOString(),
  }));
  await sb("support_chunks", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) });
  return { backend, count: payload.length };
}

export async function retrieve(opts: {
  queryEmbedding: number[];
  visibility: string;       // tenant slug or 'public'
  matchCount?: number;
  threshold?: number;
}): Promise<RetrievedChunk[]> {
  const backend = activeBackend();
  const matchCount = opts.matchCount ?? 6;
  const threshold = opts.threshold ?? 0.3;
  if (backend === "none") return [];

  if (backend === "qdrant") {
    try {
      const res = await qdrant(`/collections/${QDRANT_COLLECTION}/points/search`, {
        method: "POST",
        body: JSON.stringify({
          vector: opts.queryEmbedding,
          limit: matchCount,
          with_payload: true,
          score_threshold: threshold,
          filter: {
            should: [
              { key: "tenant_visibility", match: { value: opts.visibility } },
              { key: "tenant_visibility", match: { value: "public" } },
            ],
          },
        }),
      });
      const hits: any[] = res?.result || [];
      return hits.map((h) => ({
        id: String(h.id),
        sourceTitle: h.payload?.source_title || "Source",
        sourceUrl: h.payload?.source_url || undefined,
        sourcePath: h.payload?.source_path || undefined,
        heading: h.payload?.heading || undefined,
        content: h.payload?.content || "",
        contentType: h.payload?.content_type || "doc",
        updatedAt: h.payload?.updated_at,
        similarity: typeof h.score === "number" ? h.score : 0,
      }));
    } catch (e: any) {
      console.warn("[support retrieve] qdrant failed:", e?.message);
      return [];
    }
  }

  // Supabase pgvector RPC
  try {
    const rows = await sb("rpc/match_support_chunks", {
      method: "POST",
      body: JSON.stringify({
        query_embedding: opts.queryEmbedding,
        match_count: matchCount,
        match_visibility: opts.visibility,
        match_threshold: threshold,
      }),
    });
    if (!Array.isArray(rows)) return [];
    return rows.map((r: any) => ({
      id: String(r.id),
      sourceTitle: r.source_title || "Source",
      sourceUrl: r.source_url || undefined,
      sourcePath: r.source_path || undefined,
      heading: r.heading || undefined,
      content: r.content || "",
      contentType: r.content_type || "doc",
      updatedAt: r.updated_at,
      similarity: typeof r.similarity === "number" ? r.similarity : 0,
    }));
  } catch (e: any) {
    console.warn("[support retrieve] supabase rpc failed:", e?.message);
    return [];
  }
}
