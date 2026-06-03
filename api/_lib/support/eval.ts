/**
 * Feedback / eval logging. Persists conversations + messages and captures the
 * full eval record on feedback: question, answer, retrieved chunks, confidence,
 * user tier, thumbs result, escalation result, timestamp, tenant, model,
 * failure category.
 */
import { sb, sbInsert, supabaseConfigured } from "./supabase";
import type { Citation, SupportTier } from "./types";

export interface PersistConversationInput {
  sessionId: string;
  tenantId?: string | null;
  tenantSlug?: string | null;
  userId?: string | null;
  surface: "app" | "marketing";
  tier: SupportTier;
}

/** Upsert the conversation row, returning its id (or null if storage is off). */
export async function ensureConversation(input: PersistConversationInput): Promise<string | null> {
  if (!supabaseConfigured()) return null;
  try {
    const existing = await sb(
      `support_conversations?session_id=eq.${encodeURIComponent(input.sessionId)}&select=id&limit=1`,
    );
    if (Array.isArray(existing) && existing[0]) return existing[0].id;
    const row = await sbInsert("support_conversations", {
      session_id: input.sessionId,
      tenant_id: input.tenantId || null,
      tenant_slug: input.tenantSlug || null,
      user_id: input.userId || null,
      surface: input.surface,
      user_tier: input.tier,
    });
    return row?.id || null;
  } catch {
    return null;
  }
}

export interface PersistMessageInput {
  conversationId: string | null;
  sessionId: string;
  tenantSlug?: string | null;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  confidence?: number;
  model?: string;
  failureCategory?: string | null;
}

export async function persistMessage(input: PersistMessageInput): Promise<string | null> {
  const row = await sbInsert("support_messages", {
    conversation_id: input.conversationId,
    session_id: input.sessionId,
    tenant_slug: input.tenantSlug || null,
    role: input.role,
    content: input.content,
    citations: input.citations || [],
    confidence: input.confidence ?? null,
    model: input.model || null,
    failure_category: input.failureCategory || null,
  });
  return row?.id || null;
}

export async function bumpConversation(
  conversationId: string | null,
  patch: { lastConfidence?: number; escalated?: boolean; messageCount?: number },
): Promise<void> {
  if (!conversationId || !supabaseConfigured()) return;
  try {
    const body: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patch.lastConfidence != null) body.last_confidence = patch.lastConfidence;
    if (patch.escalated != null) body.escalated = patch.escalated;
    if (patch.messageCount != null) body.message_count = patch.messageCount;
    await sb(`support_conversations?id=eq.${conversationId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
  } catch {
    /* best-effort */
  }
}

export interface FeedbackInput {
  messageId?: string | null;
  conversationId?: string | null;
  sessionId?: string | null;
  tenantSlug?: string | null;
  userTier?: SupportTier;
  verdict: "helpful" | "not_helpful";
  reason?: string;
  question?: string;
  answer?: string;
  citations?: Citation[];
  confidence?: number;
  escalated?: boolean;
  model?: string;
}

/** Classify a negative answer into a failure category for the eval harness. */
export function classifyFailure(input: { confidence?: number; citationCount: number; verdict?: string }): string | null {
  if (input.verdict && input.verdict !== "not_helpful") return null;
  if (input.citationCount === 0) return "no_source";
  if ((input.confidence ?? 1) < 0.7) return "low_confidence";
  return "unsatisfactory_answer";
}

export async function recordFeedback(input: FeedbackInput): Promise<string | null> {
  const failureCategory =
    input.verdict === "not_helpful"
      ? classifyFailure({ confidence: input.confidence, citationCount: input.citations?.length || 0, verdict: input.verdict })
      : null;

  const row = await sbInsert("support_feedback", {
    message_id: input.messageId || null,
    conversation_id: input.conversationId || null,
    session_id: input.sessionId || null,
    tenant_slug: input.tenantSlug || null,
    user_tier: input.userTier || "public",
    verdict: input.verdict,
    reason: input.reason || null,
    question: input.question || null,
    answer: input.answer || null,
    citations: input.citations || [],
    confidence: input.confidence ?? null,
    escalated: input.escalated ?? false,
    model: input.model || null,
    failure_category: failureCategory,
  });

  // Mirror failure category onto the message so the admin "failed answers" view
  // can filter without a join.
  if (failureCategory && input.messageId && supabaseConfigured()) {
    try {
      await sb(`support_messages?id=eq.${input.messageId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ failure_category: failureCategory }),
      });
    } catch {
      /* ignore */
    }
  }
  return row?.id || null;
}
