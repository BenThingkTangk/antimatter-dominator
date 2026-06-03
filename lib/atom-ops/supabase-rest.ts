/**
 * Minimal Supabase REST client for ATOM Ops, mirroring api/_lib/admin.ts.
 * Uses the SERVICE ROLE key (server-only). Never import this into client code.
 */
import { getEnv } from "./env";
import { errMessage } from "./types";

function base(): { url: string; key: string } {
  return {
    url: getEnv("SUPABASE_URL", true),
    key: getEnv("SUPABASE_SERVICE_ROLE_KEY", true),
  };
}

export async function sbRest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, key } = base();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Call a Postgres RPC (SQL function) by name with a JSON body.
 * Parameters are passed as a structured body — never string-interpolated SQL.
 */
export async function sbRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return sbRest<T>(`rpc/${encodeURIComponent(fn)}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export function isSupabaseConfigured(): boolean {
  try {
    base();
    return true;
  } catch {
    return false;
  }
}

export { errMessage };
