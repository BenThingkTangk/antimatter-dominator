import { ExternalLink, FileText } from "lucide-react";
import type { SupportCitation } from "./supportClient";

/** Source citations rendered under every grounded answer. */
export function SupportCitations({ citations }: { citations?: SupportCitation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div
      className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-1.5"
      style={{ borderColor: "var(--color-divider, rgba(255,255,255,0.06))" }}
    >
      <span
        className="text-[10px] uppercase tracking-[0.18em] w-full mb-1"
        style={{ color: "var(--color-text-faint, #7b8a90)", fontFamily: "var(--font-mono, monospace)" }}
      >
        Sources
      </span>
      {citations.slice(0, 6).map((c, i) => {
        const label = (c.heading || c.title || `Source ${i + 1}`).slice(0, 36);
        const inner = (
          <>
            {c.url ? <ExternalLink size={9} /> : <FileText size={9} />}
            <span>[{i + 1}] {label}</span>
          </>
        );
        const style = {
          background: "color-mix(in oklab, var(--atom-primary, #22e6d6) 8%, transparent)",
          color: "var(--atom-primary, #22e6d6)",
          border: "1px solid color-mix(in oklab, var(--atom-primary, #22e6d6) 20%, transparent)",
          fontFamily: "var(--font-mono, monospace)",
        };
        return c.url ? (
          <a
            key={i}
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
            style={style}
            title={c.title}
          >
            {inner}
          </a>
        ) : (
          <span
            key={i}
            className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md"
            style={style}
            title={c.title}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}
