/**
 * Voice infrastructure defaults.
 *
 * Every file that talks to the bridge or RAG service should import these
 * instead of hard-coding the sslip.io IP. Production deployments override
 * via env vars (BRIDGE_URL / VITE_BRIDGE_URL, RAG_URL / VITE_RAG_URL).
 */

/** Primary voice bridge (Hume EVI / TwiML / WebSocket) */
export const DEFAULT_BRIDGE_URL = "https://45-79-202-76.sslip.io";

/** RAG service (embedding search, knowledge retrieval) */
export const DEFAULT_RAG_URL = "https://atom-rag.45-79-202-76.sslip.io";

/* ---------- helpers ---------- */

/** Server-side: process.env.BRIDGE_URL ?? DEFAULT_BRIDGE_URL */
export function bridgeUrl(): string {
  return (typeof process !== "undefined" && process.env?.BRIDGE_URL) || DEFAULT_BRIDGE_URL;
}

/** Server-side: process.env.RAG_URL ?? DEFAULT_RAG_URL */
export function ragUrl(): string {
  return (typeof process !== "undefined" && process.env?.RAG_URL) || DEFAULT_RAG_URL;
}

/**
 * Client-side: import.meta.env.VITE_BRIDGE_URL ?? DEFAULT_BRIDGE_URL
 * (call from client code only — Vite replaces import.meta.env at build time)
 */
export function clientBridgeUrl(): string {
  try {
    // @ts-expect-error — import.meta.env only exists in Vite client builds
    const v = import.meta.env?.VITE_BRIDGE_URL;
    if (v) return v;
  } catch {}
  return DEFAULT_BRIDGE_URL;
}

/**
 * Client-side: import.meta.env.VITE_RAG_URL ?? DEFAULT_RAG_URL
 */
export function clientRagUrl(): string {
  try {
    // @ts-expect-error — import.meta.env only exists in Vite client builds
    const v = import.meta.env?.VITE_RAG_URL;
    if (v) return v;
  } catch {}
  return DEFAULT_RAG_URL;
}
