/**
 * Thin typed fetch wrapper for ATOM Ops tools. Centralizes timeout, JSON
 * parsing, and error normalization so every tool's try/catch stays small.
 */
import { errMessage } from "./types";

export interface HttpResponse<T> {
  ok: boolean;
  status: number;
  body: T;
  raw: string;
}

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** When false, a non-2xx status does not throw (caller inspects status). */
  throwOnError?: boolean;
}

export async function httpJson<T = unknown>(
  url: string,
  opts: HttpOptions = {},
): Promise<HttpResponse<T>> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 20_000,
    throwOnError = true,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const raw = await res.text();
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    if (!res.ok && throwOnError) {
      throw new Error(`HTTP ${res.status}: ${raw.slice(0, 300)}`);
    }
    return { ok: res.ok, status: res.status, body: parsed as T, raw };
  } catch (e) {
    if (throwOnError) throw new Error(errMessage(e));
    return { ok: false, status: 0, body: null as T, raw: errMessage(e) };
  } finally {
    clearTimeout(timer);
  }
}
