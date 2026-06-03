import { useState, useEffect, useRef, useCallback } from "react";
import { Send, X, ShieldCheck } from "lucide-react";
import {
  streamSupportChat, sendFeedback, requestEscalation, fetchSupportConfig,
  getSupportSessionId, type SupportMessage as Msg, type SupportConfig,
} from "./supportClient";
import { SupportMessage } from "./SupportMessage";
import { VoiceModeToggle } from "./VoiceModeToggle";

interface Props {
  surface: "app" | "marketing";
  loggedIn: boolean;
  onClose: () => void;
}

const STARTERS = {
  app: [
    "Why did my campaign fail?",
    "How do I regenerate my API key?",
    "Walk me through onboarding",
  ],
  marketing: [
    "What is ATOM?",
    "How does pricing work?",
    "What can the platform do?",
  ],
};

export function SupportChatPanel({ surface, loggedIn, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SupportConfig | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchSupportConfig().then(setConfig); }, []);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: "", pending: true },
    ]);

    let assembled = "";
    await streamSupportChat(
      { message: content, history, surface },
      {
        onToken: (delta) => {
          assembled += delta;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") last.content = assembled;
            return next;
          });
        },
        onDone: (done) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.pending = false;
              last.id = done.messageId;
              last.citations = done.citations;
              last.confidence = done.confidence;
              last.escalated = done.escalated;
              last.hardBlock = done.hardBlock;
              last.mocked = done.mocked;
              if (!assembled && done.content) last.content = done.content;
            }
            return next;
          });
        },
        onError: (err) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              last.pending = false;
              last.content = "Sorry — I couldn't reach support just now. Please try again.";
            }
            return next;
          });
          console.warn("[support] chat error:", err);
        },
      },
    );
    setLoading(false);
  }, [input, loading, messages, surface]);

  const handleVerdict = useCallback(async (idx: number, verdict: "helpful" | "not_helpful") => {
    setMessages((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx].feedback = verdict;
      return next;
    });
    const m = messages[idx];
    const q = messages[idx - 1]?.content;
    await sendFeedback({
      messageId: m?.id, sessionId: getSupportSessionId(), verdict,
      question: q, answer: m?.content, citations: m?.citations, confidence: m?.confidence,
    });
  }, [messages]);

  const handleEscalate = useCallback(async (idx: number) => {
    setMessages((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx].escalated = true;
      return next;
    });
    await requestEscalation({
      sessionId: getSupportSessionId(),
      reason: "user_request",
      transcript: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  }, [messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const starters = STARTERS[surface];

  return (
    <div
      role="dialog"
      aria-label="ATOM Support chat"
      className="flex flex-col overflow-hidden"
      style={{
        width: "min(380px, calc(100vw - 2rem))",
        height: "min(600px, calc(100vh - 6rem))",
        background: "var(--color-bg, #050607)",
        border: "1px solid var(--color-border-bright, rgba(255,255,255,0.15))",
        borderRadius: "var(--atom-radius-xl, 1rem)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 40px var(--atom-primary-glow, rgba(34,230,214,0.16))",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b"
        style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))" }}
      >
        <AtomSupportMark size={22} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--color-text, #eef6f5)" }}>
            ATOM Support
          </div>
          <div className="text-[10px] flex items-center gap-1" style={{ color: "var(--color-text-faint, #7b8a90)", fontFamily: "var(--font-mono, monospace)" }}>
            <ShieldCheck size={9} /> {loggedIn ? "secure · account-aware" : "ask us anything"}
          </div>
        </div>
        <VoiceModeToggle status={config?.voice ?? null} active={voiceActive} onToggle={() => setVoiceActive((v) => !v)} />
        <button
          onClick={onClose}
          aria-label="Close support"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "var(--color-text-muted, #b5c1c5)" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm px-1" style={{ color: "var(--color-text-muted, #b5c1c5)" }}>
              {loggedIn
                ? "Hi — I'm ATOM Support. I can answer product, onboarding, campaign, and API questions, and help with your account."
                : "Hi — I'm ATOM Support. Ask me anything about ATOM and what it can do for your team."}
            </div>
            <div className="flex flex-col gap-1.5">
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-[13px] px-3 py-2 rounded-lg transition-all"
                  style={{
                    background: "var(--color-surface, #0b0e10)",
                    border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
                    color: "var(--color-text, #eef6f5)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <SupportMessage
            key={i}
            message={m}
            onVerdict={(v) => handleVerdict(i, v)}
            onEscalate={() => handleEscalate(i)}
          />
        ))}

        {loading && messages[messages.length - 1]?.pending && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
              style={{ background: "var(--color-surface, #0b0e10)", border: "1px solid var(--color-border, rgba(255,255,255,0.08))", color: "var(--color-text-muted, #b5c1c5)" }}
            >
              <span style={{ fontFamily: "var(--font-mono, monospace)" }}>thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t px-3 py-3 flex items-center gap-2" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))" }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask ATOM Support…"
          aria-label="Message ATOM Support"
          className="flex-1 bg-transparent outline-none text-sm px-2"
          style={{ color: "var(--color-text, #eef6f5)" }}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            background: input.trim() && !loading ? "linear-gradient(96deg, var(--atom-primary, #22e6d6), var(--atom-primary-bright, #4ff3e6))" : "var(--color-surface-2, #11161a)",
            color: input.trim() && !loading ? "var(--atom-text-inverse, #04100f)" : "var(--color-text-muted, #b5c1c5)",
            border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function AtomSupportMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      style={{ color: "var(--atom-primary, #22e6d6)", filter: "drop-shadow(0 0 6px var(--atom-primary-glow, rgba(34,230,214,0.34)))" }}
      aria-hidden="true">
      <ellipse cx="32" cy="32" rx="12" ry="29" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.95" />
      <ellipse cx="32" cy="32" rx="29" ry="12" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55" />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
    </svg>
  );
}
