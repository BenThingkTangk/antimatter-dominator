/**
 * Shared Supabase REST helper for the ATOM Support module.
 * Mirrors the pattern used across api/* (service-role, server-side only).
 * Never exposed to the client; all support tables are RLS service-role only.
 */
const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

export const SUPABASE_URL = clean(process.env.SUPABASE_URL);
export const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

export async function sb(path: string, init: RequestInit = {}): Promise<any> {
  if (!supabaseConfigured()) throw new Error("Supabase not configured");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

/** Best-effort insert that never throws — used for logging/telemetry paths. */
export async function sbInsert(table: string, row: Record<string, any>): Promise<any | null> {
  try {
    const rows = await sb(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (e: any) {
    console.warn(`[support] insert into ${table} failed:`, e?.message);
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const [k, ...v] = pair.split("=");
    if (k) out[k.trim()] = v.join("=").trim();
  }
  return out;
}
