import { MessageCircleQuestion, X } from "lucide-react";

interface Props {
  open: boolean;
  onClick: () => void;
}

/** Bottom-right floating launcher button with cyan glow + open/close swap. */
export function SupportLauncher({ open, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close ATOM Support" : "Open ATOM Support"}
      aria-expanded={open}
      className="w-14 h-14 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2"
      style={{
        background: "linear-gradient(135deg, var(--atom-primary, #22e6d6), var(--atom-primary-dim, #14a99d))",
        color: "var(--atom-text-inverse, #04100f)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.45), 0 0 28px var(--atom-primary-glow-strong, rgba(34,230,214,0.34))",
        border: "1px solid color-mix(in oklab, var(--atom-primary, #22e6d6) 40%, transparent)",
        transform: open ? "rotate(90deg)" : "none",
      }}
    >
      {open ? <X size={22} /> : <MessageCircleQuestion size={24} />}
    </button>
  );
}
