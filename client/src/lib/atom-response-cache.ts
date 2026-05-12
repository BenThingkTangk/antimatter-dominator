/**
 * ATOM client-side response cache (M4)
 *
 * Lightweight localStorage-backed cache for the heavy AI endpoints whose
 * responses are stable for hours. Modules call `cacheGet(key)` before firing
 * a fetch; on cache miss they fetch and call `cacheSet(key, data, ttlMs)`.
 *
 * Cache TTLs ladder (mirrors the Cache-Control hints emitted by the API):
 *   warbook        24h
 *   market-intent  6h
 *   leadgen        5min
 *   pitch          15min (per pitchType+persona+company combo)
 *   objection      15min (per objection text hash)
 *
 * The UI can call `cacheIsHit(key)` to render a small "Cached" badge.
 *
 * Storage shape (per key):
 *   {
 *     value:   <any JSON-serializable>,
 *     savedAt: <epoch ms>,
 *     ttl:     <ms>
 *   }
 *
 * @example
 *   const key = buildCacheKey("warbook", { company, website });
 *   const hit = cacheGet<WarBookResponse>(key);
 *   if (hit) {
 *     setData(hit.value);
 *     setCachedAt(hit.savedAt);
 *   } else {
 *     const fresh = await fetch(...).then(r => r.json());
 *     cacheSet(key, fresh, CACHE_TTL.warbook);
 *     setData(fresh);
 *   }
 */

const PREFIX = "atom:cache:v1:";

export const CACHE_TTL = {
  warbook: 24 * 60 * 60 * 1000, // 24h
  market: 6 * 60 * 60 * 1000, //  6h
  leadgen: 5 * 60 * 1000, //  5min
  pitch: 15 * 60 * 1000, // 15min
  objection: 15 * 60 * 1000, // 15min
  prospect: 30 * 60 * 1000, // 30min
} as const;

export type CacheTier = keyof typeof CACHE_TTL;

interface CacheEntry<T> {
  value: T;
  savedAt: number;
  ttl: number;
}

/** Build a stable cache key. Skips undefined/empty parts so swapping order is safe. */
export function buildCacheKey(
  tier: CacheTier,
  parts: Record<string, string | number | undefined | null>
): string {
  const flat = Object.keys(parts)
    .sort()
    .map((k) => {
      const v = parts[k];
      if (v == null || v === "") return null;
      return `${k}=${String(v).toLowerCase().trim().slice(0, 80)}`;
    })
    .filter(Boolean)
    .join("|");
  return `${tier}::${flat}`;
}

function safeGet(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function cacheGet<T = unknown>(
  key: string
): { value: T; savedAt: number; ageMs: number } | null {
  const ls = safeGet();
  if (!ls) return null;
  try {
    const raw = ls.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const ageMs = Date.now() - entry.savedAt;
    if (ageMs > entry.ttl) {
      ls.removeItem(PREFIX + key);
      return null;
    }
    return { value: entry.value, savedAt: entry.savedAt, ageMs };
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const ls = safeGet();
  if (!ls) return;
  try {
    const entry: CacheEntry<T> = { value, savedAt: Date.now(), ttl: ttlMs };
    ls.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // QuotaExceeded — silently drop. Don't break UX over a cache miss.
  }
}

export function cacheIsHit(key: string): boolean {
  return cacheGet(key) !== null;
}

export function cacheInvalidate(key: string): void {
  const ls = safeGet();
  if (!ls) return;
  try {
    ls.removeItem(PREFIX + key);
  } catch {}
}

export function cacheClearAll(): void {
  const ls = safeGet();
  if (!ls) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => ls.removeItem(k));
  } catch {}
}

/** Human-friendly relative time string for a "Cached Xm ago" badge. */
export function relativeAge(savedAt: number): string {
  const sec = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}
