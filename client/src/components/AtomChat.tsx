/**
 * ATOM Chat — floating in-app assistant.
 *
 * UX:
 *   - Bottom-right floating button (atomic orbit icon, teal glow)
 *   - Click → 380x600 panel slides up
 *   - Detects current route → routes to the right system prompt context
 *     (warbook / market / pitch / objection / leadgen / general)
 *   - Suggested starter questions per context
 *   - Streaming-feel typed answer with citations footer
 *
 * Powered by /api/atom-chat which delegates to Perplexity Sonar / Sonar Pro.
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Sparkles, Send, X, ExternalLink, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ title: string; url: string }>;
}

const ROUTE_TO_CONTEXT: Record<string, string> = {
  "/company-intelligence": "warbook",
  "/market":               "market",
  "/objections":           "objection",
  "/pitch":                "pitch",
  "/atom-leadgen":         "leadgen",
  "/war-room":             "warbook",
  "/prospects":            "warbook",
};

const STARTERS_BY_CONTEXT: Record<string, string[]> = {
  general: [
    "What can ATOM do for me?",
    "How do I start a call?",
    "Walk me through the War Room",
  ],
  warbook: [
    "Build me a one-page brief on Akamai",
    "Who are the key buyers at this company?",
    "What's their tech stack?",
  ],
  market: [
    "What's the latest hiring signal in cybersecurity?",
    "Who just raised a Series B in healthcare AI?",
    "Recent M&A in real estate tech",
  ],
  pitch: [
    "Sharpen my opener for a CTO",
    "Make this pitch shorter and harder",
    "Add a quantified outcome",
  ],
  objection: [
    "We already have a vendor — counter that",
    "It's too expensive — counter that",
    "We're not ready for AI yet",
  ],
  leadgen: [
    "What buying signals appeared on this call?",
    "Why was the call short?",
    "Suggest a follow-up email",
  ],
};

function getContext(pathname: string): string {
  for (const [path, ctx] of Object.entries(ROUTE_TO_CONTEXT)) {
    if (pathname.startsWith(path)) return ctx;
  }
  return "general";
}

export default function AtomChat() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const context = getContext(location);
  const starters = STARTERS_BY_CONTEXT[context] || STARTERS_BY_CONTEXT.general;

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/atom-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context,
          history: messages.slice(-6),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `Sorry — ${data.error || "something went wrong"}.` }]);
      } else {
        setMessages((m) => [...m, {
          role: "assistant",
          content: data.content || "(no response)",
          citations: data.citations || [],
        }]);
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Network error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating launcher — always present, bottom-right */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ask ATOM"
        className="fixed bottom-6 right-6 z-50 rounded-full flex items-center justify-center transition-all"
        style={{
          width: 56, height: 56,
          background: "color-mix(in oklab, var(--color-primary) 18%, var(--color-bg))",
          border: "1px solid color-mix(in oklab, var(--color-primary) 40%, transparent)",
          boxShadow: "0 8px 32px var(--color-primary-glow-strong)",
          backdropFilter: "blur(12px)",
        }}
      >
        <AtomChatMark size={28} />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: "min(380px, calc(100vw - 32px))",
            height: "min(600px, calc(100vh - 120px))",
            background: "color-mix(in oklab, var(--color-bg) 85%, transparent)",
            backdropFilter: "blur(24px) saturate(1.1)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "color-mix(in oklab, var(--color-primary) 18%, transparent)",
                border: "1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)",
              }}
            >
              <AtomChatMark size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="atom-wordmark text-base leading-tight" style={{ letterSpacing: "-0.02em", color: "var(--color-text)" }}>
                Ask ATOM
              </div>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                {context === "general" ? "Powered by Perplexity Sonar" : `${context} mode`}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close ATOM Chat"
              className="w-8 h-8 flex items-center justify-center rounded-lg"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "color-mix(in oklab, var(--color-primary) 12%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--color-primary) 25%, transparent)",
                  }}
                >
                  <AtomChatMark size={36} />
                </div>
                <p className="text-sm mb-4 max-w-xs" style={{ color: "var(--color-text-muted)" }}>
                  Ask anything about your prospects, products, the platform, or live market signals. Cited from primary sources.
                </p>
                <div className="space-y-2 w-full">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-sm px-3 py-2.5 rounded-lg transition-colors"
                      style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  style={
                    m.role === "user"
                      ? {
                          background: "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))",
                          color: "var(--color-text-inverse)",
                          fontWeight: 500,
                        }
                      : {
                          background: "var(--color-surface)",
                          color: "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }
                  }
                >
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-1.5" style={{ borderColor: "var(--color-divider)" }}>
                      {m.citations.slice(0, 5).map((c, ci) => (
                        <a
                          key={ci}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
                          style={{
                            background: "color-mix(in oklab, var(--color-primary) 8%, transparent)",
                            color: "var(--color-primary)",
                            border: "1px solid color-mix(in oklab, var(--color-primary) 20%, transparent)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          <ExternalLink size={9} />
                          {c.title.slice(0, 32)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ fontFamily: "var(--font-mono)" }}>thinking…</span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t px-3 py-3 flex items-center gap-2" style={{ borderColor: "var(--color-border)" }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                context === "warbook" ? "Ask about a company, person, or signal…" :
                context === "market"  ? "Ask about a market trend, signal, or competitor…" :
                context === "pitch"   ? "Sharpen a pitch, find a hook, draft a line…" :
                "Ask anything…"
              }
              className="flex-1 bg-transparent outline-none text-sm px-2"
              style={{ color: "var(--color-text)" }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: input.trim() && !loading ? "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))" : "var(--color-surface-2)",
                color: input.trim() && !loading ? "var(--color-text-inverse)" : "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
                boxShadow: input.trim() && !loading ? "0 0 12px var(--color-primary-glow)" : "none",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Small atomic-orbit mark for the chat launcher / header. */
function AtomChatMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      style={{ color: "var(--color-primary)", filter: "drop-shadow(0 0 6px var(--color-primary-glow))" }}
      aria-hidden="true"
    >
      <ellipse cx="32" cy="32" rx="12" ry="29" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.95" />
      <ellipse cx="32" cy="32" rx="29" ry="12" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55" />
      <circle cx="32" cy="32" r="5" fill="currentColor" />
    </svg>
  );
}
