/**
 * Ingestion interface for the ATOM Support KB.
 *
 * Two entry points:
 *   ingestSources(sources)  — caller supplies raw {title, content|url, ...}
 *   ingestRepoDefaults()    — reads known repo docs (docs/, WHITE-LABEL-PLAYBOOK.md,
 *                             CHANGELOG, etc.) so launch content lands with zero
 *                             config. Missing files are skipped, not fatal.
 *
 * Each source is chunked (heading-aware), embedded (BGE-M3 where available), and
 * upserted into the active vector store (Qdrant or Supabase pgvector).
 */
import { promises as fs } from "fs";
import path from "path";
import { chunkSource, type RawSource } from "./chunking";
import { embed } from "./embeddings";
import { upsertChunks, activeBackend } from "./retrieval";
import type { ContentType } from "./types";

export interface IngestSource {
  title: string;
  content?: string;        // raw text/markdown
  url?: string;            // fetched if content not provided
  path?: string;           // on-disk path (informational)
  contentType?: ContentType;
  tenantVisibility?: string;
}

export interface IngestResult {
  backend: string;
  sources: number;
  chunks: number;
  embedded: number;
  skipped: string[];
}

async function fetchUrl(url: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const html = await r.text();
  // Crude HTML→text: strip tags. Good enough for help-center / status pages;
  // markdown sources should be passed via content directly.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function ingestSources(sources: IngestSource[]): Promise<IngestResult> {
  const backend = activeBackend();
  const skipped: string[] = [];
  let chunkCount = 0;
  let embedded = 0;

  for (const src of sources) {
    try {
      let content = src.content || "";
      if (!content && src.url) content = await fetchUrl(src.url);
      if (!content) { skipped.push(`${src.title}: no content`); continue; }

      const raw: RawSource = {
        title: src.title,
        url: src.url,
        path: src.path,
        content,
        contentType: src.contentType || "doc",
        tenantVisibility: src.tenantVisibility || "public",
      };
      const chunks = chunkSource(raw);
      if (!chunks.length) { skipped.push(`${src.title}: no chunks`); continue; }
      chunkCount += chunks.length;

      // Embed in batches of 32 to stay under provider payload limits.
      const rows: Array<{ chunk: typeof chunks[number]; embedding: number[] }> = [];
      for (let i = 0; i < chunks.length; i += 32) {
        const batch = chunks.slice(i, i + 32);
        const e = await embed(batch.map((c) => `${c.heading}\n${c.content}`));
        batch.forEach((c, j) => {
          if (e.embeddings[j]) rows.push({ chunk: c, embedding: e.embeddings[j] });
        });
      }
      embedded += rows.length;
      await upsertChunks(rows);
    } catch (e: any) {
      skipped.push(`${src.title}: ${e?.message}`);
    }
  }

  return { backend, sources: sources.length, chunks: chunkCount, embedded, skipped };
}

/** Candidate repo docs for the launch KB. Missing ones are skipped. */
const REPO_DOC_CANDIDATES: Array<{ rel: string; title: string; type: ContentType }> = [
  { rel: "WHITE-LABEL-PLAYBOOK.md", title: "White-Label Playbook", type: "playbook" },
  { rel: "docs/ATOM_DESIGN_SYSTEM.md", title: "ATOM Design System", type: "doc" },
  { rel: "docs/SPEC_AUTH.md", title: "Auth Spec", type: "doc" },
  { rel: "docs/SPEC_QA_ENGINE.md", title: "QA Engine Spec", type: "doc" },
  { rel: "docs/AUTH_STATUS.md", title: "Auth Status", type: "doc" },
  { rel: "docs/QA_STATUS.md", title: "QA Status", type: "status" },
  { rel: "docs/COMPETITIVE_MATRIX.md", title: "Competitive Matrix", type: "doc" },
  { rel: "docs/ATOM_VOICE_REFERENCE.md", title: "Voice Reference", type: "doc" },
  { rel: "CHANGELOG.md", title: "Changelog", type: "changelog" },
  { rel: "ROADMAP.md", title: "Roadmap", type: "roadmap" },
  { rel: "README.md", title: "README", type: "doc" },
];

export async function ingestRepoDefaults(): Promise<IngestResult> {
  // process.cwd() is the repo root on Vercel build and locally.
  const root = process.cwd();
  const sources: IngestSource[] = [];
  const skipped: string[] = [];

  for (const cand of REPO_DOC_CANDIDATES) {
    const abs = path.join(root, cand.rel);
    try {
      const content = await fs.readFile(abs, "utf-8");
      if (content.trim()) {
        sources.push({ title: cand.title, content, path: cand.rel, contentType: cand.type, tenantVisibility: "public" });
      }
    } catch {
      skipped.push(cand.rel);
    }
  }

  const result = await ingestSources(sources);
  return { ...result, skipped: [...result.skipped, ...skipped.map((s) => `${s}: not found`)] };
}
