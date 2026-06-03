/**
 * POST /api/atom-ops/telegram — Telegram webhook for the ATOM Ops bridge.
 *
 * Auth (both required):
 *   1. X-Telegram-Bot-Api-Secret-Token header == ATOM_OPS_TELEGRAM_SECRET_TOKEN
 *   2. sender chat id == ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID
 *
 * Handles: /start, /status, /morning-brief, "<tool>.<action> ..." intents, and
 * callback_query confirm:/cancel: from inline keyboards.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { OpsOrchestrator } from "../../lib/atom-ops/index";
import { logger } from "../../lib/atom-ops/logger";
import { rateLimit } from "../../lib/atom-ops/api-auth";
import {
  answerCallbackQuery,
  isAllowedChat,
  sendConfirmPrompt,
  sendTelegramMessage,
  verifyTelegramSecret,
  type TelegramUpdate,
} from "../../lib/atom-ops/telegram-bridge";
import { errMessage, type OpsContext } from "../../lib/atom-ops/types";
import { superAdminEmails } from "../../lib/atom-ops/env";

const log = logger.child({ route: "atom-ops/telegram" });

function contextFor(chatId: number | string): OpsContext {
  return {
    actorEmail: `telegram:${chatId}`,
    actorRole: "superadmin",
    isSuperAdmin: true,
    source: "telegram",
    sessionId: `telegram:${chatId}`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Gate 1: webhook secret token (constant-time).
  if (!verifyTelegramSecret(req.headers["x-telegram-bot-api-secret-token"] as string)) {
    return res.status(401).json({ error: "Invalid secret token" });
  }

  const update = (req.body || {}) as TelegramUpdate;

  try {
    // ── callback_query (inline confirm/cancel) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id;
      if (!isAllowedChat(chatId)) {
        await answerCallbackQuery(cq.id, "Not authorized");
        return res.status(200).json({ ok: true });
      }
      if (!(await rateLimit(`telegram:${chatId}`))) {
        await answerCallbackQuery(cq.id, "Rate limited");
        return res.status(200).json({ ok: true });
      }
      const data = cq.data || "";
      const [verb, confirmationId] = data.split(":");
      const ctx = contextFor(chatId as number);
      if (verb === "confirm" && confirmationId) {
        const out = await OpsOrchestrator.execute(confirmationId, ctx);
        await answerCallbackQuery(cq.id, "Executing…");
        await sendTelegramMessage(summarize(out), chatId);
      } else if (verb === "cancel" && confirmationId) {
        const out = await OpsOrchestrator.cancel(confirmationId, ctx);
        await answerCallbackQuery(cq.id, "Cancelled");
        await sendTelegramMessage(summarize(out), chatId);
      } else {
        await answerCallbackQuery(cq.id, "Unknown action");
      }
      return res.status(200).json({ ok: true });
    }

    // ── message ──
    const msg = update.message;
    const chatId = msg?.chat.id;
    if (!msg || !isAllowedChat(chatId)) {
      // Gate 2 failed (or no message). Silently OK so Telegram stops retrying.
      return res.status(200).json({ ok: true });
    }
    if (!(await rateLimit(`telegram:${chatId}`))) {
      await sendTelegramMessage("Rate limit exceeded (60/min).", chatId);
      return res.status(200).json({ ok: true });
    }

    const text = (msg.text || "").trim();
    const ctx = contextFor(chatId as number);

    if (text === "/start") {
      await sendTelegramMessage(
        `*ATOM Ops* online.\nSuperadmin: ${superAdminEmails()[0]}\n\nCommands:\n• /status\n• /morning-brief\n• \`<tool>.<action> key=value\`\n• /release pr=<n> tag=<vX.Y.Z>`,
        chatId,
      );
      return res.status(200).json({ ok: true });
    }
    if (text === "/status") {
      await sendTelegramMessage("✅ ATOM Ops bridge healthy.", chatId);
      return res.status(200).json({ ok: true });
    }

    const out = await OpsOrchestrator.dispatch(text, ctx);
    if (out.kind === "confirm") {
      await sendConfirmPrompt(chatId as number, out.plan.confirmationId, out.plan.summary);
    } else {
      await sendTelegramMessage(summarize(out), chatId);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    log.error({ err: errMessage(e) }, "telegram handler failed");
    // Always 200 so Telegram doesn't hammer retries; error is logged.
    return res.status(200).json({ ok: false, error: errMessage(e) });
  }
}

function summarize(out: Awaited<ReturnType<typeof OpsOrchestrator.dispatch>>): string {
  switch (out.kind) {
    case "result":
      return `${out.result.ok ? "✅" : "⚠️"} ${out.result.summary}`;
    case "confirm":
      return `Confirm needed: ${out.plan.summary}`;
    case "cancelled":
      return `✖️ ${out.summary}`;
    case "error":
      return `⚠️ ${out.summary}`;
  }
}
