/**
 * Layer 6 — Cache Key Normalization & TTL Hints
 *
 * Responsibilities:
 *  - Strip transient query params (_t, __cb) from cache keys
 *  - Lowercase the Host header for key consistency
 *  - Inject a tenant hash into the cache key so per-tenant data never bleeds
 *  - Set Cache-Control response header according to the per-route TTL ladder
 *  - Runs during onClientResponse (outbound direction)
 *
 * TTL ladder:
 *  /api/atom-chat              → 30s
 *  /api/warbook/research       → 24h
 *  /api/market-intent/analyze  → 6h
 *  /api/atom-leadgen/*         → 5min
 *  /api/signals/*              → 0  (no-cache, streaming)
 *  default                     → 0
 */

/** Query parameters stripped from the cache key (never part of the cache key) */
export const STRIP_PARAMS = new Set(["_t", "__cb", "_ts", "__nocache"]);

/** Tenant header that becomes part of the cache key hash */
const TENANT_HEADER = "X-ATOM-Tenant";

interface TtlRule {
  prefix: string;
  exact?: true;
  /** Cache-Control value */
  cacheControl: string;
}

export const TTL_RULES: TtlRule[] = [
  // Exact matches checked first
  { prefix: "/api/atom-chat",             exact: true, cacheControl: "public, max-age=30, s-maxage=30" },
  { prefix: "/api/warbook/research",      exact: true, cacheControl: "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600" },
  { prefix: "/api/market-intent/analyze", exact: true, cacheControl: "public, max-age=21600, s-maxage=21600, stale-while-revalidate=600" },
  // Prefix matches
  { prefix: "/api/atom-leadgen/",                      cacheControl: "public, max-age=300, s-maxage=300" },
  { prefix: "/api/signals/",                           cacheControl: "no-store, no-cache, max-age=0" },
  // Default
  { prefix: "/",                                       cacheControl: "no-store, no-cache, max-age=0" },
];

export function resolveCacheControl(path: string): string {
  for (const rule of TTL_RULES) {
    if (rule.exact ? path === rule.prefix : path.startsWith(rule.prefix)) {
      return rule.cacheControl;
    }
  }
  return "no-store, no-cache, max-age=0";
}

/**
 * Simple djb2 hash — used only for tenant bucketing in cache key.
 * Returns a compact hex string.
 */
export function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Strip unwanted query params from a URL search string and return a sorted,
 * normalised query string suitable for use as a cache-key component.
 */
export function normalizeCacheQuery(search: string): string {
  if (!search || search === "?") return "";
  const params: string[] = [];
  const raw = search.startsWith("?") ? search.slice(1) : search;
  for (const part of raw.split("&")) {
    const [key] = part.split("=");
    if (key && !STRIP_PARAMS.has(key)) params.push(part);
  }
  // Sort for deterministic key
  params.sort();
  return params.length ? "?" + params.join("&") : "";
}

/**
 * Main EdgeWorker hook — runs during onClientResponse.
 * Mutates the response to set Cache-Control and returns the normalised cache key
 * (Akamai reads it from PMUSER_CACHE_KEY if set).
 */
export async function normalizeCacheKey(
  request: EW.IngressClientRequest,
  response: EW.EgressClientResponse
): Promise<void> {
  const rawPath   = request.path ?? "/";
  const rawQuery  = request.query ?? "";
  const host      = (request.host ?? "api.atomsalesdominator.com").toLowerCase();
  const tenantId  = request.getHeader(TENANT_HEADER)?.[0] ?? "default";
  const tenantKey = djb2Hash(tenantId);

  // Normalise query string (strip ephemeral params)
  const normQuery = normalizeCacheQuery(rawQuery);

  // Compose cache key: scheme://host/path?normalised-query#tenant-bucket
  const cacheKey = `https://${host}${rawPath}${normQuery}#t=${tenantKey}`;
  request.setVariable("PMUSER_CACHE_KEY", cacheKey);

  // Apply TTL ladder on the response
  const cacheControl = resolveCacheControl(rawPath);
  response.setHeader("Cache-Control", cacheControl);

  // Tag the response with which tenant bucket was used
  response.setHeader("X-ATOM-Cache-Key-Hash", tenantKey);
  response.setHeader("X-ATOM-Normalized-Path", rawPath + normQuery);
}

export { TENANT_HEADER };
