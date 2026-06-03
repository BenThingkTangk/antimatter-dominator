/** Thin client for the ATOM Support API (/api/support). */

export interface SupportCitation {
  title: string;
  url?: string;
  heading?: string;
  chunkId?: string;
}

export interface SupportMessage {
  id?: string;            // server messageId (assistant turns)
  role: "user" | "assistant";
  content: string;
  citations?: SupportCitation[];
  confidence?: number;
  escalated?: boolean;
  hardBlock?: boolean;
  pending?: boolean;
  feedback?: "helpful" | "not_helpful" | null;
  mocked?: boolean;
}

export interface SupportConfig {
  actions: { enabled: boolean; actions: Array<{ id: string; label: string; confirm: boolean; destructive: boolean }> };
  voice: { enabled: boolean; stt: string; llm: string; tts: string; pipeline: string };
  confidenceThreshold: number;
}

const SESSION_KEY = "atom_support_session_v1";

export function getSupportSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = "";
  try { id = sessionStorage.getItem(SESSION_KEY) || ""; } catch {}
  if (!id) {
    id = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try { sessionStorage.setItem(SESSION_KEY, id); } catch {}
  }
  return id;
}

export async function fetchSupportConfig(): Promise<SupportConfig | null> {
  try {
    const r = await fetch("/api/support?op=config", { credentials: "include" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface ChatStreamHandlers {
  onMeta?: (meta: any) => void;
  onToken?: (delta: string) => void;
  onDone?: (done: any) => void;
  onError?: (err: string) => void;
}

/**
 * Send a chat message with SSE streaming. The server emits the answer in
 * progressive chunks (architected for true token streaming later). Falls back
 * to JSON parsing if the response isn't an event stream.
 */
export async function streamSupportChat(
  body: {
    message: string;
    history: Array<{ role: string; content: string }>;
    surface: "app" | "marketing";
  },
  handlers: ChatStreamHandlers,
): Promise<void> {
  const sessionId = getSupportSessionId();
  let res: Response;
  try {
    res = await fetch("/api/support?op=chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      credentials: "include",
      body: JSON.stringify({ ...body, sessionId, stream: true }),
    });
  } catch (e: any) {
    handlers.onError?.(e?.message || "network error");
    return;
  }

  if (!res.ok) {
    handlers.onError?.(`HTTP ${res.status}`);
    return;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream") || !res.body) {
    // JSON fallback
    try {
      const data = await res.json();
      handlers.onToken?.(data.content || "");
      handlers.onDone?.(data);
    } catch (e: any) {
      handlers.onError?.(e?.message || "parse error");
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let nl: number;
    while ((nl = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      let payload: any = {};
      try { payload = JSON.parse(dataLines.join("\n")); } catch { continue; }
      if (event === "meta") handlers.onMeta?.(payload);
      else if (event === "token") handlers.onToken?.(payload.delta || "");
      else if (event === "done") handlers.onDone?.(payload);
      else if (event === "error") handlers.onError?.(payload.error || "stream error");
    }
  }
}

export async function sendFeedback(input: {
  messageId?: string; sessionId?: string; verdict: "helpful" | "not_helpful";
  question?: string; answer?: string; citations?: SupportCitation[]; confidence?: number;
}): Promise<boolean> {
  try {
    const r = await fetch("/api/support?op=feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function requestEscalation(input: {
  sessionId?: string; reason?: string;
  transcript: Array<{ role: string; content: string }>; email?: string;
}): Promise<{ ok: boolean; provider?: string }> {
  try {
    const r = await fetch("/api/support?op=escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!r.ok) return { ok: false };
    return await r.json();
  } catch {
    return { ok: false };
  }
}

export async function runSupportAction(action: string, args: Record<string, any> = {}): Promise<any> {
  const r = await fetch("/api/support?op=action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action, args }),
  });
  return r.json();
}
