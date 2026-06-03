/**
 * Notification integration points for ATOM Ops. Basic by design: pushes a
 * Telegram message when configured, and bumps an in-memory badge counter the
 * console polls. Swap the badge store for Supabase/Redis later without changing
 * call sites.
 */
import { logger } from "./logger";
import { sendTelegramMessage } from "./telegram-bridge";
import { errMessage } from "./types";

const log = logger.child({ component: "notify" });

interface BadgeState {
  count: number;
  lastMessage: string | null;
  updatedAt: number;
}

const badge: BadgeState = { count: 0, lastMessage: null, updatedAt: Date.now() };

/** Read the current notification badge (consumed by GET /api/atom-ops?badge=1). */
export function getBadge(): BadgeState {
  return { ...badge };
}

/** Reset the badge (called when the operator views the console). */
export function clearBadge(): void {
  badge.count = 0;
  badge.lastMessage = null;
  badge.updatedAt = Date.now();
}

/**
 * Fan-out a notification: bump the console badge AND (best-effort) Telegram.
 */
export async function notify(message: string): Promise<void> {
  badge.count += 1;
  badge.lastMessage = message;
  badge.updatedAt = Date.now();
  log.info({ message }, "notify");
  try {
    await sendTelegramMessage(message);
  } catch (e) {
    log.debug({ err: errMessage(e) }, "telegram notify skipped");
  }
}
