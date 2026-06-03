/**
 * Core support answer pipeline. Orchestrates:
 *   policy → embed query → retrieve → confidence → (hard-block?) → generate →
 *   citations → persist → (escalate if needed).
 *
 * Returns a structured answer the HTTP layer turns into JSON or SSE.
 */
import { embed } from "./embeddings";
import { retrieve } from "./retrieval";
import { evaluatePolicy, hardBlockResponse } from "./policies";
import { scoreConfidence, CONFIDENCE_THRESHOLD } from "./confidence";
import { decideEscalation } from "./escalationPolicy";
import { assembleSystemPrompt } from "./prompt";
import { generate } from "./llm";
import { buildTenantContext } from "./tenantContext";
import { escalate } from "./escalation";
import { ensureConversation, persistMessage, bumpConversation } from "./eval";
import { actionCatalog } from "./actions";
import type { ResolvedSession } from "./auth";
import type { Citation, RetrievedChunk, SupportTurn, TenantContextSummary } from "./types";

export interface ChatRequest {
  message: string;
  history: SupportTurn[];
  sessionId: string;
  surface: "app" | "marketing";
  session: ResolvedSession;
}

export interface ChatAnswer {
  content: string;
  citations: Citation[];
  confidence: number;
  escalated: boolean;
  escalationReason?: string;
  hardBlock: boolean;
  tier: string;
  model: string;
  sessionId: string;
  conversationId: string | null;
  messageId: string | null;
  actions: ReturnType<typeof actionCatalog>;
  mocked: boolean;
}

function toCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((c) => ({
    title: c.sourceTitle,
    url: c.sourceUrl,
    heading: c.heading,
    chunkId: c.id,
  }));
}

/** Detect whether a question is account-impacting (campaign/api/billing/error). */
function isAccountImpacting(message: string, ctx: TenantContextSummary | null): boolean {
  if (!ctx || ctx.tier === "public") return false;
  return /\b(campaign|job|api key|api failure|error|fail|down|broken|outage|stuck|charge|invoice|billing)\b/i.test(message);
}

export async function answer(req: ChatRequest): Promise<ChatAnswer> {
  const { message } = req;

  // 1. Tenant context (safe summary) + tier.
  const ctx = await buildTenantContext(req.session);
  const tier = ctx.tier;
  const visibility = ctx.tenantSlug || "public";

  // 2. Policy evaluation (hard-block / risk / anger).
  const policy = evaluatePolicy(message);

  // 3. Persist conversation + user message early so transcripts are complete
  //    even if generation fails.
  const conversationId = await ensureConversation({
    sessionId: req.sessionId,
    tenantId: req.session.tenantId,
    tenantSlug: ctx.tenantSlug,
    userId: req.session.userId,
    surface: req.surface,
    tier,
  });
  await persistMessage({
    conversationId, sessionId: req.sessionId, tenantSlug: ctx.tenantSlug,
    role: "user", content: message,
  });

  const transcript: SupportTurn[] = [...req.history.slice(-6), { role: "user", content: message }];

  // 4. HARD-BLOCK SHORT-CIRCUIT — never answer substantively; escalate.
  if (policy.hardBlock) {
    const content = hardBlockResponse(policy.primary, tier);
    const decision = decideEscalation({ policy, confidence: 0, tier });
    const esc = await escalate({
      conversationId, sessionId: req.sessionId, tenantId: req.session.tenantId,
      tenantSlug: ctx.tenantSlug, userId: req.session.userId, userEmail: req.session.email,
      userTier: tier, triggerReason: decision.reason, severity: decision.severity,
      confidence: 0, transcript, retrievedDocs: [], recommendedAction: "Human reviews hard-block topic.",
    });
    const messageId = await persistMessage({
      conversationId, sessionId: req.sessionId, tenantSlug: ctx.tenantSlug,
      role: "assistant", content, citations: [], confidence: 0, model: "policy", failureCategory: "hard_block",
    });
    await bumpConversation(conversationId, { lastConfidence: 0, escalated: true });
    return {
      content, citations: [], confidence: 0, escalated: true, escalationReason: decision.reason,
      hardBlock: true, tier, model: "policy", sessionId: req.sessionId, conversationId, messageId,
      actions: actionCatalog(), mocked: false,
    };
  }

  // 5. Embed query + retrieve grounded chunks.
  let chunks: RetrievedChunk[] = [];
  try {
    const e = await embed([message]);
    if (e.embeddings[0]) {
      chunks = await retrieve({ queryEmbedding: e.embeddings[0], visibility, matchCount: 6, threshold: 0.3 });
    }
  } catch (err: any) {
    console.warn("[support chat] retrieval failed:", err?.message);
  }

  // 6. Confidence.
  const sims = chunks.map((c) => c.similarity);
  const conf = scoreConfidence({
    topSimilarity: sims[0] || 0,
    meanSimilarity: sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : 0,
    chunkCount: chunks.length,
    topicRisk: policy.topicRisk,
    tier,
    hasTenantDiagnostics: Boolean(ctx.recentErrors?.length || ctx.recentCampaign),
  });

  // 7. Generate the answer from grounded sources.
  const system = assembleSystemPrompt(chunks, ctx);
  const gen = await generate(system, transcript);
  let content = gen.content;
  let failureCategory: string | null = null;

  // 8. No-source guard — if nothing grounded, do not pretend certainty.
  if (chunks.length === 0) {
    failureCategory = "no_source";
    content =
      "I don't have a sourced answer to that yet, so I don't want to guess. " +
      (tier === "public"
        ? "You can reach our team and they'll help directly."
        : "I've flagged this for a human on our team who'll follow up.");
  }

  const citations = toCitations(chunks);

  // 9. Escalation decision.
  const decision = decideEscalation({
    policy, confidence: conf.score, tier, accountImpacting: isAccountImpacting(message, ctx),
  });
  let escalated = false;
  let escalationReason: string | undefined;
  if (decision.shouldEscalate || chunks.length === 0) {
    const reason = chunks.length === 0 && !decision.shouldEscalate ? "no_source" : decision.reason;
    try {
      await escalate({
        conversationId, sessionId: req.sessionId, tenantId: req.session.tenantId,
        tenantSlug: ctx.tenantSlug, userId: req.session.userId, userEmail: req.session.email,
        userTier: tier, triggerReason: reason,
        severity: decision.severity === "low" ? "normal" : decision.severity,
        confidence: conf.score, transcript, retrievedDocs: chunks,
        recommendedAction: chunks.length === 0 ? "No KB coverage — consider adding a doc." : undefined,
      });
      escalated = true;
      escalationReason = reason;
    } catch (e: any) {
      console.warn("[support chat] escalate failed:", e?.message);
    }
  }

  // 10. Persist assistant message + bump conversation.
  const messageId = await persistMessage({
    conversationId, sessionId: req.sessionId, tenantSlug: ctx.tenantSlug,
    role: "assistant", content, citations, confidence: conf.score, model: gen.model, failureCategory,
  });
  await bumpConversation(conversationId, { lastConfidence: conf.score, escalated });

  return {
    content, citations, confidence: conf.score, escalated, escalationReason,
    hardBlock: false, tier, model: gen.model, sessionId: req.sessionId, conversationId, messageId,
    actions: actionCatalog(), mocked: gen.mocked,
  };
}

export { CONFIDENCE_THRESHOLD };
