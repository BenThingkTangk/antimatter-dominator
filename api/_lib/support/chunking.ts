/**
 * Heading-aware markdown chunking. Splits a document by markdown headings
 * (# .. ######) into sections, then further splits long sections on paragraph
 * boundaries so each chunk stays under a token budget while preserving the
 * nearest heading for citation.
 */
import type { ContentType } from "./types.js";

export interface RawSource {
  title: string;
  url?: string;
  path?: string;
  content: string;
  contentType?: ContentType;
  tenantVisibility?: string; // 'public' or tenant slug
}

export interface Chunk {
  sourceTitle: string;
  sourceUrl?: string;
  sourcePath?: string;
  heading: string;
  chunkIndex: number;
  content: string;
  contentType: ContentType;
  tenantVisibility: string;
  tokenEstimate: number;
}

const MAX_CHARS = 1400;   // ~350 tokens
const MIN_CHARS = 80;     // drop trivial fragments

const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/** Split markdown into [{heading, body}] sections by the heading hierarchy. */
function splitByHeadings(md: string): Array<{ heading: string; body: string }> {
  const lines = md.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let heading = "";
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) sections.push({ heading, body });
    buf = [];
  };
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      heading = m[2].trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections.length ? sections : [{ heading: "", body: md.trim() }];
}

/** Pack paragraphs greedily into <= MAX_CHARS windows. */
function packParagraphs(body: string): string[] {
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (p.length > MAX_CHARS) {
      // Hard-split an oversized paragraph on sentence boundaries.
      if (cur) { out.push(cur); cur = ""; }
      const sentences = p.split(/(?<=[.!?])\s+/);
      let s = "";
      for (const sent of sentences) {
        if ((s + " " + sent).length > MAX_CHARS) { if (s) out.push(s.trim()); s = sent; }
        else s = s ? `${s} ${sent}` : sent;
      }
      if (s) out.push(s.trim());
      continue;
    }
    if ((cur + "\n\n" + p).length > MAX_CHARS) { if (cur) out.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

export function chunkSource(src: RawSource): Chunk[] {
  const contentType = src.contentType || "doc";
  const visibility = src.tenantVisibility || "public";
  const chunks: Chunk[] = [];
  let idx = 0;
  for (const { heading, body } of splitByHeadings(src.content)) {
    for (const piece of packParagraphs(body)) {
      if (piece.length < MIN_CHARS) continue;
      chunks.push({
        sourceTitle: src.title,
        sourceUrl: src.url,
        sourcePath: src.path,
        heading: heading || src.title,
        chunkIndex: idx++,
        content: piece,
        contentType,
        tenantVisibility: visibility,
        tokenEstimate: estimateTokens(piece),
      });
    }
  }
  return chunks;
}
