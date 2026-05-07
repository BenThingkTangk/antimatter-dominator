/**
 * Mobile-friendly Markdown renderer.
 *
 * Handles only the subset of Markdown that the LLMs in this app actually
 * emit \u2014 enough to render Sonar / Sonar-Pro / Hume responses cleanly without
 * the raw "###", "**", "---" symbols leaking through. No external dependency.
 *
 * Supported:
 *   - Headings: # / ## / ### / ####
 *   - Horizontal rule: ---
 *   - Unordered list: -, *, \u2022 (treated identically)
 *   - Ordered list: 1. 2. \u2026
 *   - Inline: **bold**, *italic*, `code`, [text](url), citation tags [1], [2]
 *   - Blank lines = paragraph break
 *
 * Anything else is rendered as plain text so we never blow up on weird input.
 */
import React from "react";

interface MarkdownProps {
  text: string;
  /** Override the base text color for the rendered block. */
  className?: string;
}

/** Inline parser \u2014 turns a single line of Markdown into React nodes. */
function renderInline(line: string, keyBase: string): React.ReactNode[] {
  // Tokenise on **bold** | *italic* | `code` | [text](url) | [N] citations
  // The order matters \u2014 we process the longest-match patterns first so
  // ** doesn't get caught by *italic*.
  const out: React.ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  const push = (node: React.ReactNode) => out.push(node);

  // We hand-walk the string to keep things predictable. RegExp.exec in a
  // loop with global flag is the simplest robust pattern.
  const PATTERN =
    /(\*\*([^*]+?)\*\*)|(\*([^*]+?)\*)|(`([^`]+?)`)|(\[([^\]]+?)\]\(([^)]+?)\))|(\[(\d+)\])/g;

  let m: RegExpExecArray | null;
  while ((m = PATTERN.exec(line)) !== null) {
    if (m.index > cursor) {
      push(line.slice(cursor, m.index));
    }
    if (m[1]) {
      // **bold**
      push(<strong key={`${keyBase}-b-${i++}`} style={{ fontWeight: 700, color: "var(--m-text)" }}>{m[2]}</strong>);
    } else if (m[3]) {
      // *italic*
      push(<em key={`${keyBase}-i-${i++}`} style={{ fontStyle: "italic" }}>{m[4]}</em>);
    } else if (m[5]) {
      // `code`
      push(
        <code key={`${keyBase}-c-${i++}`} style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.86em",
          padding: "1px 6px",
          borderRadius: 6,
          background: "rgba(0,230,211,0.08)",
          color: "var(--m-teal)",
        }}>{m[6]}</code>
      );
    } else if (m[7]) {
      // [text](url)
      push(
        <a key={`${keyBase}-a-${i++}`} href={m[9]} target="_blank" rel="noreferrer" style={{
          color: "var(--m-teal)", textDecoration: "underline", textUnderlineOffset: "2px",
        }}>{m[8]}</a>
      );
    } else if (m[10]) {
      // [N] citation
      push(
        <sup key={`${keyBase}-s-${i++}`} style={{
          fontSize: "0.7em",
          color: "var(--m-teal)",
          padding: "0 2px",
          fontFamily: "var(--font-mono)",
        }}>[{m[11]}]</sup>
      );
    }
    cursor = PATTERN.lastIndex;
  }
  if (cursor < line.length) {
    push(line.slice(cursor));
  }
  return out;
}

interface Block {
  kind: "h1" | "h2" | "h3" | "h4" | "p" | "ul" | "ol" | "hr";
  lines?: string[];
}

/** Block-level parser \u2014 splits text into paragraphs / lists / headings. */
function parseBlocks(text: string): Block[] {
  // Normalise: collapse Windows newlines, strip trailing whitespace.
  const normal = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const lines = normal.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  function flushList(list: Block) {
    if (list.lines && list.lines.length) blocks.push(list);
  }

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    // Blank line = paragraph break, skip
    if (!t) { i++; continue; }

    // Horizontal rule: --- or *** or ___
    if (/^([-*_])\1{2,}\s*$/.test(t)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1].length;
      const kind = (`h${level}` as Block["kind"]);
      blocks.push({ kind, lines: [h[2].replace(/\s+#+\s*$/, "")] });
      i++;
      continue;
    }

    // Unordered list: starts with - or * or \u2022 followed by space
    if (/^([-*\u2022])\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^([-*\u2022])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*\u2022])\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", lines: items });
      continue;
    }

    // Ordered list: 1. text
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", lines: items });
      continue;
    }

    // Paragraph: collect contiguous non-blank, non-special lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^([-*_])\1{2,}\s*$/.test(lines[i].trim()) &&
      !/^([-*\u2022])\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", lines: para });
  }
  return blocks;
}

const HEADING_STYLE: Record<string, React.CSSProperties> = {
  h1: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", margin: "16px 0 8px", lineHeight: 1.15 },
  h2: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.015em", margin: "14px 0 6px", lineHeight: 1.2 },
  h3: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", margin: "12px 0 4px", color: "var(--m-teal)", textTransform: "uppercase" as const },
  h4: { fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, margin: "10px 0 4px", color: "var(--m-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
};

export function Markdown({ text, className }: MarkdownProps) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div className={className} style={{ fontSize: 15, lineHeight: 1.55, color: "var(--m-text)" }}>
      {blocks.map((b, i) => {
        const k = `b-${i}`;
        if (b.kind === "hr") {
          return (
            <hr key={k} style={{
              border: 0,
              height: 1,
              background: "var(--m-divider)",
              margin: "16px 0",
            }} />
          );
        }
        if (b.kind.startsWith("h") && b.lines) {
          const Tag = b.kind as keyof JSX.IntrinsicElements;
          return React.createElement(
            Tag,
            { key: k, style: HEADING_STYLE[b.kind] },
            renderInline(b.lines[0] || "", k)
          );
        }
        if (b.kind === "ul" && b.lines) {
          return (
            <ul key={k} style={{ paddingLeft: 20, margin: "8px 0 12px", listStyle: "none" }}>
              {b.lines.map((line, j) => (
                <li key={`${k}-${j}`} style={{
                  position: "relative", paddingLeft: 4, marginBottom: 4,
                }}>
                  <span style={{
                    position: "absolute", left: -16, top: 8,
                    width: 6, height: 6, borderRadius: 999,
                    background: "var(--m-teal)", opacity: 0.7,
                  }} />
                  {renderInline(line, `${k}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "ol" && b.lines) {
          return (
            <ol key={k} style={{ paddingLeft: 22, margin: "8px 0 12px" }}>
              {b.lines.map((line, j) => (
                <li key={`${k}-${j}`} style={{ marginBottom: 4 }}>
                  {renderInline(line, `${k}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }
        // paragraph
        if (b.kind === "p" && b.lines) {
          return (
            <p key={k} style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
              {b.lines.map((line, j) => (
                <React.Fragment key={`${k}-${j}`}>
                  {j > 0 ? <br /> : null}
                  {renderInline(line, `${k}-${j}`)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
