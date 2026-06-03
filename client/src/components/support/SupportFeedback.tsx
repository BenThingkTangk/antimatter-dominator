import { ThumbsUp, ThumbsDown, LifeBuoy } from "lucide-react";

interface Props {
  verdict?: "helpful" | "not_helpful" | null;
  onVerdict: (v: "helpful" | "not_helpful") => void;
  onEscalate: () => void;
  escalated?: boolean;
}

/** Helpful / not-helpful thumbs + escalate-to-human, under each answer. */
export function SupportFeedback({ verdict, onVerdict, onEscalate, escalated }: Props) {
  const base =
    "w-7 h-7 rounded-md flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2";
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Helpful"
        aria-pressed={verdict === "helpful"}
        onClick={() => onVerdict("helpful")}
        className={base}
        style={{
          background: verdict === "helpful" ? "color-mix(in oklab, var(--atom-primary, #22e6d6) 22%, transparent)" : "transparent",
          color: verdict === "helpful" ? "var(--atom-primary, #22e6d6)" : "var(--color-text-faint, #7b8a90)",
        }}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        type="button"
        aria-label="Not helpful"
        aria-pressed={verdict === "not_helpful"}
        onClick={() => onVerdict("not_helpful")}
        className={base}
        style={{
          background: verdict === "not_helpful" ? "color-mix(in oklab, var(--atom-coral, #ff7b6b) 22%, transparent)" : "transparent",
          color: verdict === "not_helpful" ? "var(--atom-coral, #ff7b6b)" : "var(--color-text-faint, #7b8a90)",
        }}
      >
        <ThumbsDown size={13} />
      </button>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onEscalate}
        disabled={escalated}
        className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-50"
        style={{
          color: "var(--color-text-muted, #b5c1c5)",
          border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <LifeBuoy size={11} />
        {escalated ? "Human notified" : "Talk to a human"}
      </button>
    </div>
  );
}
