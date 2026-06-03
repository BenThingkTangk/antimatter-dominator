/**
 * Telegram bridge for ATOM Ops — mobile-first control surface.
 *
 * Security (two independent gates, BOTH required):
 *   1. Webhook secret token: Telegram sends the configured secret in the
 *      `X-Telegram-Bot-Api-Secret-Token` header. verifyTelegramSecret() checks
 *      it with a constant-time compare. This is the primary auth.
 *   2. Allowed chat id: ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID must match the
 *      sender's chat. Secondary defense so a leaked webhook URL alone is inert.
 *
 * Env:
 *   ATOM_OPS_TELEGRAM_BOT_TOKEN
 *   ATOM_OPS_TELEGRAM_SECRET_TOKEN          (set when registering the webhook)
 *   ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID
 */
import crypto from "crypto";
import { getEnv } from "./env";
import { httpJson } from "./http";
import { logger } from "./logger";
import { errMessage, type OpsResult } from "./types";

const log = logger.child({ component: "telegram" });

function apiBase(): string {
  return `https://api.telegram.org/bot${getEnv("ATOM_OPS_TELEGRAM_BOT_TOKEN", true)}`;
}

/** Constant-time comparison of the webhook secret header. */
export function verifyTelegramSecret(headerValue: string | undefined): boolean {
  const expected = getEnv("ATOM_OPS_TELEGRAM_SECRET_TOKEN");
  if (!expected) {
    log.warn({}, "ATOM_OPS_TELEGRAM_SECRET_TOKEN not set — rejecting webhook");
    return false;
  }
  const provided = (headerValue || "").toString();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Is this chat id on the allowlist? */
export function isAllowedChat(chatId: number | string | undefined): boolean {
  const allowed = getEnv("ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID");
  if (!allowed) return false;
  return String(chatId) === String(allowed);
}

export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from?: { id: number; username?: string };
    message?: { chat: { id: number } };
    data?: string;
  };
}

/** Send a plain message (best-effort). Used by notify() and the bridge. */
export async function sendTelegramMessage(
  text: string,
  chatId?: number | string,
): Promise<void> {
  const token = getEnv("ATOM_OPS_TELEGRAM_BOT_TOKEN");
  const target = chatId ?? getEnv("ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID");
  if (!token || !target) return; // not configured → no-op
  try {
    await httpJson(`${apiBase()}/sendMessage`, {
      method: "POST",
      body: { chat_id: target, text, parse_mode: "Markdown" },
      throwOnError: false,
    });
  } catch (e) {
    log.debug({ err: errMessage(e) }, "sendTelegramMessage failed");
  }
}

/** Send a message with an inline confirm/cancel keyboard for a pending op. */
export async function sendConfirmPrompt(
  chatId: number | string,
  confirmationId: string,
  summary: string,
): Promise<void> {
  await httpJson(`${apiBase()}/sendMessage`, {
    method: "POST",
    throwOnError: false,
    body: {
      chat_id: chatId,
      text: `⚠️ *Confirm destructive op*\n${summary}\n\n_Expires in 5 min._`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: `confirm:${confirmationId}` },
            { text: "✖️ Cancel", callback_data: `cancel:${confirmationId}` },
          ],
        ],
      },
    },
  });
}

/** Answer a callback_query so Telegram stops the spinner on the button. */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
): Promise<void> {
  await httpJson(`${apiBase()}/answerCallbackQuery`, {
    method: "POST",
    throwOnError: false,
    body: { callback_query_id: callbackQueryId, text },
  });
}

/**
 * Webhook registration helper. NOT called at import time — invoke it manually
 * from a one-off script or the documented curl command. Sets the secret token
 * so future updates carry the X-Telegram-Bot-Api-Secret-Token header.
 */
export async function registerWebhook(publicUrl: string): Promise<OpsResult<{ url: string }>> {
  const secret = getEnv("ATOM_OPS_TELEGRAM_SECRET_TOKEN", true);
  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/api/atom-ops/telegram`;
  const r = await httpJson<{ ok: boolean; description?: string }>(
    `${apiBase()}/setWebhook`,
    {
      method: "POST",
      throwOnError: false,
      body: {
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
      },
    },
  );
  if (!r.body?.ok) {
    return { ok: false, data: { url: webhookUrl }, summary: r.body?.description || "setWebhook failed" };
  }
  return { ok: true, data: { url: webhookUrl }, summary: `Webhook registered: ${webhookUrl}` };
}
