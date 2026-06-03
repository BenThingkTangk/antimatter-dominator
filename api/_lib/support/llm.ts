/**
 * LLM client for ATOM Support answer generation.
 *
 * Provider selected by LLM_PROVIDER:
 *   anthropic  → Claude (uses prompt caching on the system block)
 *   openai     → OpenAI-compatible chat endpoint (LLM_BASE_URL for self-hosted 70B)
 *   auto       → anthropic if ANTHROPIC_API_KEY else openai-compatible
 *
 * LLM_MODEL defaults: anthropic=claude-sonnet-4-6, openai=value of LLM_MODEL (e.g. a 70B).
 * Spec target is a 70B open model behind an OpenAI-compatible gateway; set
 * LLM_PROVIDER=openai + LLM_BASE_URL + LLM_MODEL to point at it.
 *
 * Returns the assistant text. Streaming is handled by the caller via stream().
 */
import type { SupportTurn } from "./types";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const LLM_PROVIDER = clean(process.env.LLM_PROVIDER).toLowerCase() || "auto";
const LLM_MODEL = clean(process.env.LLM_MODEL);
const LLM_BASE_URL = clean(process.env.LLM_BASE_URL) || "https://api.openai.com/v1";
const ANTHROPIC_API_KEY = clean(process.env.ANTHROPIC_API_KEY);
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);
const LLM_API_KEY = clean(process.env.LLM_API_KEY) || OPENAI_API_KEY;

const ANTHROPIC_DEFAULT = "claude-sonnet-4-6";
const OPENAI_DEFAULT = LLM_MODEL || "gpt-4o-mini";

export interface LlmResult {
  content: string;
  model: string;
  provider: string;
  mocked: boolean;
}

function resolveProvider(): "anthropic" | "openai" | "mock" {
  if (LLM_PROVIDER === "anthropic") return ANTHROPIC_API_KEY ? "anthropic" : "mock";
  if (LLM_PROVIDER === "openai") return LLM_API_KEY ? "openai" : "mock";
  // auto
  if (ANTHROPIC_API_KEY) return "anthropic";
  if (LLM_API_KEY) return "openai";
  return "mock";
}

export function llmStatus(): { provider: string; model: string; live: boolean } {
  const p = resolveProvider();
  if (p === "anthropic") return { provider: "anthropic", model: LLM_MODEL || ANTHROPIC_DEFAULT, live: true };
  if (p === "openai") return { provider: "openai", model: OPENAI_DEFAULT, live: true };
  return { provider: "mock", model: "mock", live: false };
}

// ─── Anthropic (with prompt caching on the system block) ─────────────────────
async function callAnthropic(system: string, turns: SupportTurn[], model: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      // Cache the (large, stable-per-request) system+sources block. Saves cost
      // when the user sends follow-ups in the same session.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const d: any = await r.json();
  return (d?.content || []).map((b: any) => b.text || "").join("").trim();
}

// ─── OpenAI-compatible (self-hosted 70B gateway, OpenAI, etc.) ───────────────
async function callOpenAI(system: string, turns: SupportTurn[], model: string): Promise<string> {
  const r = await fetch(`${LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "system", content: system }, ...turns.map((t) => ({ role: t.role, content: t.content }))],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`llm ${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
  const d: any = await r.json();
  return (d?.choices?.[0]?.message?.content || "").trim();
}

/**
 * Deterministic mock answer used when no provider is configured (local/CI).
 * Echoes a grounded-sounding answer built from the system's SOURCES block so
 * the full pipeline (citations, confidence, escalation) is testable offline.
 */
export function mockAnswer(system: string, turns: SupportTurn[]): string {
  const q = [...turns].reverse().find((t) => t.role === "user")?.content || "";
  const hasSources = system.includes("[1]");
  if (!hasSources) {
    return "I don't have a confident, sourced answer to that yet. I'll connect you with a human who can help.";
  }
  return `Based on the documentation: here is a concise answer to "${q.slice(0, 80)}". See the cited sources [1] for detail. (mock LLM response — configure LLM_PROVIDER for live answers)`;
}

export async function generate(system: string, turns: SupportTurn[]): Promise<LlmResult> {
  const provider = resolveProvider();
  try {
    if (provider === "anthropic") {
      const model = LLM_MODEL && LLM_MODEL.startsWith("claude") ? LLM_MODEL : ANTHROPIC_DEFAULT;
      return { content: await callAnthropic(system, turns, model), model, provider, mocked: false };
    }
    if (provider === "openai") {
      const model = OPENAI_DEFAULT;
      return { content: await callOpenAI(system, turns, model), model, provider, mocked: false };
    }
  } catch (e: any) {
    console.warn(`[support llm] ${provider} failed, using mock:`, e?.message);
  }
  return { content: mockAnswer(system, turns), model: "mock", provider: "mock", mocked: true };
}
