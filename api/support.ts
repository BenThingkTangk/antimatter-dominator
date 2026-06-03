/**
 * ATOM Support — consolidated customer-support API router.
 *
 * One Vercel function multiplexing the support surface (keeps us under the
 * serverless function budget, mirroring api/rag.ts and api/admin/data.ts).
 *
 *   POST /api/support?op=chat       → RAG answer (JSON or SSE stream)
 *   POST /api/support?op=feedback   → thumbs up/down (eval capture)
 *   POST /api/support?op=escalate   → manual escalate-to-human
 *   POST /api/support?op=action     → run a whitelisted action
 *   POST /api/support?op=ingest     → ingest docs/urls into the KB (admin-gated)
 *   GET  /api/support?op=config     → public widget config (status, actions, voice)
 *   GET  /api/support?op=voice      → voice-mode status (planned vs live)
 *
 * Auth model:
 *   - chat/feedback/escalate/action read the atom_session cookie (logged-in app
 *     users get tenant context + actions; logged-out marketing users get public).
 *   - ingest requires X-Admin-Key (ADMIN_API_KEY).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveSession } from "./_lib/support/auth.js";
import { answer } from "./_lib/support/chat.js";
import { runAction, actionCatalog, ACTION_IDS, type ActionId } from "./_lib/support/actions.js";
import { escalate } from "./_lib/support/escalation.js";
import { recordFeedback } from "./_lib/support/eval.js";
import { ingestSources, ingestRepoDefaults } from "./_lib/support/ingest.js";
import { voiceStatus } from "./_lib/support/voice.js";
import { llmStatus } from "./_lib/support/llm.js";
import { embeddingProviderStatus } from "./_lib/support/embeddings.js";
import { activeBackend } from "./_lib/support/retrieval.js";
import { escalationProviders } from "./_lib/support/escalation.js";
import type { SupportTurn } from "./_lib/support/types.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

function cors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  return true;
}

function sessionIdFrom(body: any): string {
  return (body?.sessionId && String(body.sessionId)) ||
    `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!cors(req, res)) return;

  const op = String(req.query.op || req.body?.op || "").trim();

  try {
    // ── Public config (GET) ──────────────────────────────────────────────────
    if (op === "config") {
      return res.status(200).json({
        ok: true,
        actions: actionCatalog(),
        voice: voiceStatus(),
        confidenceThreshold: Number(process.env.ATOM_SUPPORT_CONFIDENCE_THRESHOLD) || 0.7,
        status: {
          llm: llmStatus(),
          embeddings: embeddingProviderStatus(),
          vectorStore: activeBackend(),
          escalation: escalationProviders(),
        },
      });
    }
    if (op === "voice") {
      return res.status(200).json({ ok: true, voice: voiceStatus() });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const body = typeof req.body === "string" ? safeJson(req.body) : (req.body || {});

    // ── Ingest (admin-gated) ─────────────────────────────────────────────────
    if (op === "ingest") {
      const provided = (req.headers["x-admin-key"] || "").toString().trim();
      if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY not configured" });
      if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
      if (body?.mode === "repo-defaults") {
        const result = await ingestRepoDefaults();
        return res.status(200).json({ ok: true, ...result });
      }
      const sources = Array.isArray(body?.sources) ? body.sources : [];
      if (!sources.length) return res.status(400).json({ error: "sources[] required (or mode:'repo-defaults')" });
      const result = await ingestSources(sources);
      return res.status(200).json({ ok: true, ...result });
    }

    // Resolve session for the remaining (user-facing) ops.
    const session = await resolveSession(req.headers.cookie);

    // ── Chat ─────────────────────────────────────────────────────────────────
    if (op === "chat") {
      const message = String(body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "message required" });
      const history: SupportTurn[] = Array.isArray(body?.history)
        ? body.history.slice(-6).map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: String(m.content || ""),
          }))
        : [];
      const sessionId = sessionIdFrom(body);
      const surface = body?.surface === "marketing" ? "marketing" : (session.authenticated ? "app" : "marketing");

      const result = await answer({ message, history, sessionId, surface, session });

      const wantsStream =
        body?.stream === true || String(req.headers.accept || "").includes("text/event-stream");

      if (wantsStream) {
        // Architected for token streaming; the LLM layer returns a whole answer
        // today, so we emit it as progressive SSE chunks for a streaming feel.
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(`event: meta\ndata: ${JSON.stringify({
          sessionId: result.sessionId, conversationId: result.conversationId,
          messageId: result.messageId, tier: result.tier, model: result.model,
        })}\n\n`);
        const CHUNK = 64;
        for (let i = 0; i < result.content.length; i += CHUNK) {
          res.write(`event: token\ndata: ${JSON.stringify({ delta: result.content.slice(i, i + CHUNK) })}\n\n`);
        }
        res.write(`event: done\ndata: ${JSON.stringify({
          citations: result.citations, confidence: result.confidence, escalated: result.escalated,
          escalationReason: result.escalationReason, hardBlock: result.hardBlock,
          messageId: result.messageId, actions: result.actions, mocked: result.mocked,
        })}\n\n`);
        return res.end();
      }
      return res.status(200).json(result);
    }

    // ── Feedback (thumbs) ────────────────────────────────────────────────────
    if (op === "feedback") {
      const verdict = body?.verdict === "helpful" ? "helpful" : "not_helpful";
      const id = await recordFeedback({
        messageId: body?.messageId, conversationId: body?.conversationId, sessionId: body?.sessionId,
        tenantSlug: session.tenantSlug, userTier: undefined,
        verdict, reason: body?.reason, question: body?.question, answer: body?.answer,
        citations: body?.citations, confidence: body?.confidence, escalated: body?.escalated, model: body?.model,
      });
      return res.status(200).json({ ok: true, feedbackId: id });
    }

    // ── Manual escalate ──────────────────────────────────────────────────────
    if (op === "escalate") {
      const transcript: SupportTurn[] = Array.isArray(body?.transcript) ? body.transcript : [];
      const result = await escalate({
        conversationId: body?.conversationId, sessionId: body?.sessionId,
        tenantId: session.tenantId, tenantSlug: session.tenantSlug, userId: session.userId,
        userEmail: session.email || body?.email, userTier: undefined,
        triggerReason: body?.reason || "user_request", severity: body?.severity || "normal",
        confidence: body?.confidence, transcript, retrievedDocs: [],
        recommendedAction: "User explicitly requested a human.",
      });
      return res.status(200).json({ ok: true, ...result });
    }

    // ── Run a whitelisted action ─────────────────────────────────────────────
    if (op === "action") {
      const action = String(body?.action || "") as ActionId;
      if (!ACTION_IDS.includes(action)) return res.status(400).json({ error: "unknown action" });
      const result = await runAction(action, session, body?.args || {});
      return res.status(result.ok ? 200 : (result.denied ? 403 : 200)).json(result);
    }

    return res.status(400).json({ error: `unknown op: ${op}` });
  } catch (e: any) {
    console.error("[support]", op, e?.message);
    return res.status(500).json({ error: e?.message || "support_error" });
  }
}

function safeJson(s: string): any {
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
