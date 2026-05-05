/**
 * MobileChat — full-screen ATOM chat (Sonar / Sonar Pro).
 *
 * Calls the existing /api/atom-chat endpoint. Persists session id so chat
 * memory (pgvector recall) stays coherent across tabs.
 */
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { MobileShell } from "../MobileShell";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ title: string; url: string }>;
}

const SESSION_KEY = "atom_chat_session_v1";
function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY) || "";
    if (!id) {
      id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch { return `chat_${Date.now()}`; }
}

const STARTERS = [
  "What can ATOM do for me?",
  "Build me a one-page brief on Akamai",
  "Sharpen my opener for a CTO",
  "What buying signals appeared this week?",
];

export default function MobileChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/atom-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          context: "general",
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.content || "", citations: data.citations || [] }]);
    } catch (e: any) {
      setMessages([...next, { role: "assistant", content: `Something glitched. ${e?.message || e}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileShell title="Ask ATOM">
      <div className="m-stack-lg">
        {messages.length === 0 && (
          <div className="m-card m-card-glow">
            <Sparkles size={22} style={{ color: "#00e6d3", marginBottom: 8 }} />
            <div className="m-card-title">What's on your mind?</div>
            <div className="m-text-muted" style={{ fontSize: 14, marginTop: 6 }}>
              Powered by Perplexity Sonar + Sonar Pro. Ask anything — markets, accounts, objections, pitches.
            </div>
            <div className="m-stack" style={{ marginTop: 14 }}>
              {STARTERS.map((s) => (
                <button key={s} className="m-btn m-btn-ghost" onClick={() => send(s)} style={{ justifyContent: "flex-start" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="m-card" style={{
            borderColor: m.role === "assistant" ? "rgba(0,230,211,0.18)" : "rgba(255,255,255,0.06)",
            background: m.role === "user" ? "rgba(0,230,211,0.04)" : undefined,
          }}>
            <div className={`m-bubble-label${m.role === "assistant" ? " is-atom" : ""}`}>
              {m.role === "assistant" ? "ATOM" : "You"}
            </div>
            <div className="m-bubble" style={{ marginTop: 6 }}>{m.content}</div>
            {m.citations && m.citations.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {m.citations.map((c, j) => (
                  <a key={j} href={c.url} target="_blank" rel="noreferrer" className="m-row" style={{
                    gap: 6, fontSize: 12, color: "#00e6d3", textDecoration: "none",
                  }}>
                    <ExternalLink size={12} /> {c.title || c.url}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="m-card">
            <div className="m-row" style={{ gap: 10 }}>
              <Loader2 size={16} className="animate-spin" style={{ color: "#00e6d3" }} />
              <span className="m-text-muted" style={{ fontSize: 14 }}>ATOM is thinking…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating input bar — sits above the tab bar */}
      <div style={{
        position: "fixed",
        left: 12, right: 12,
        bottom: "calc(var(--m-safe-bot, 0px) + 84px)",
        zIndex: 25,
        background: "#0a1218",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 14,
        padding: 8,
        boxShadow: "0 12px 48px -12px rgba(0,0,0,0.6)",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <input
          className="m-input"
          style={{ minHeight: 44, fontSize: 15, border: "none", background: "transparent" }}
          placeholder="Ask anything…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
        />
        <button
          className="m-btn m-btn-primary"
          style={{ width: 52, minHeight: 44, padding: 0 }}
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          <Send size={18} />
        </button>
      </div>
    </MobileShell>
  );
}
