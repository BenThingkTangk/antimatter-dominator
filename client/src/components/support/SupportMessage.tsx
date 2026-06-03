import { AlertTriangle } from "lucide-react";
import type { SupportMessage as Msg } from "./supportClient";
import { SupportCitations } from "./SupportCitations";
import { SupportFeedback } from "./SupportFeedback";

interface Props {
  message: Msg;
  onVerdict: (v: "helpful" | "not_helpful") => void;
  onEscalate: () => void;
}

/** A single chat bubble. Assistant turns carry citations, feedback, escalate. */
export function SupportMessage({ message, onVerdict, onEscalate }: Props) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="rounded-2xl px-4 py-3 text-sm max-w-[88%]"
        style={
          isUser
            ? {
                background: "linear-gradient(96deg, var(--atom-primary, #22e6d6), var(--atom-primary-bright, #4ff3e6))",
                color: "var(--atom-text-inverse, #04100f)",
                fontWeight: 500,
              }
            : {
                background: "var(--color-surface, #0b0e10)",
                color: "var(--color-text, #eef6f5)",
                border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
              }
        }
      >
        <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>

        {!isUser && message.hardBlock && (
          <div
            className="mt-2 text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded"
            style={{ color: "var(--atom-coral, #ff7b6b)", fontFamily: "var(--font-mono, monospace)" }}
          >
            <AlertTriangle size={11} /> routed to a human
          </div>
        )}

        {!isUser && !message.pending && (
          <SupportCitations citations={message.citations} />
        )}

        {!isUser && !message.pending && (
          <SupportFeedback
            verdict={message.feedback}
            onVerdict={onVerdict}
            onEscalate={onEscalate}
            escalated={message.escalated}
          />
        )}

        {!isUser && message.mocked && (
          <div
            className="mt-1 text-[10px]"
            style={{ color: "var(--color-text-faint, #7b8a90)", fontFamily: "var(--font-mono, monospace)" }}
          >
            demo mode — connect an LLM provider for live answers
          </div>
        )}
      </div>
    </div>
  );
}
