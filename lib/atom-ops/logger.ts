/**
 * Structured logger for ATOM Ops — JSON lines, no bare console.log.
 *
 * The repo is ESM ("type": "module") and runs in Vercel serverless / Vite.
 * To keep cold starts robust and avoid a hard pino import that could fail in a
 * given runtime, this is a minimal dependency-free structured logger with the
 * same shape as pino (info/warn/error/debug/child). If you want pino's
 * transport features, swap `logger` for a pino instance — call sites are
 * already structured and won't change.
 */

type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (obj: Record<string, unknown>, msg?: string) => void;
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

/** Keys whose values must never be logged verbatim. */
const REDACT_KEYS = new Set([
  "token",
  "password",
  "password_hash",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "service_role_key",
  "bot_token",
]);

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;
  return LEVELS[env] ?? LEVELS.info;
}

function makeLogger(bindings: Record<string, unknown> = {}): Logger {
  const emit = (level: Level, obj: Record<string, unknown>, msg?: string) => {
    if (LEVELS[level] < threshold()) return;
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      ...bindings,
      ...redact(obj),
      ...(msg ? { msg } : {}),
    });
    if (level === "error" || level === "warn") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  };
  return {
    debug: (o, m) => emit("debug", o, m),
    info: (o, m) => emit("info", o, m),
    warn: (o, m) => emit("warn", o, m),
    error: (o, m) => emit("error", o, m),
    child: (b) => makeLogger({ ...bindings, ...b }),
  };
}

export const logger: Logger = makeLogger({ name: "atom-ops" });
