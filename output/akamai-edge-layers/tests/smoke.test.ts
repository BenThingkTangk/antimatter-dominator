/**
 * smoke.test.ts — Minimal vitest smoke tests for all 6 EdgeWorker layers
 *
 * Tests:
 *  - Each layer module exports the expected async function(s)
 *  - Pure-logic helpers (no EdgeWorker globals needed) produce correct output
 *  - Chain handler signatures are present in main.ts exports
 *
 * Note: Full Akamai EdgeWorker integration tests require the Akamai sandbox
 * CLI (`akamai sandbox`). These smoke tests validate pure-TS logic only.
 */

import { describe, it, expect } from "vitest";

// ── Layer 1 ──────────────────────────────────────────────────────────────────
import {
  selectOrigin,
  getOriginCandidates,
  ORIGIN_US_EAST,
  ORIGIN_US_WEST,
  ORIGIN_EU_WEST,
  ORIGIN_GPU_EAST,
  GPU_PATH_PREFIXES,
} from "../src/layer1-router.js";

describe("Layer 1 — Router", () => {
  it("exports routeToOrigin as async function", async () => {
    const mod = await import("../src/layer1-router.js");
    expect(typeof mod.routeToOrigin).toBe("function");
    expect(mod.routeToOrigin.constructor.name).toBe("AsyncFunction");
  });

  it("routes /signals/ to GPU origin", () => {
    const origin = selectOrigin("/signals/realtime", {});
    expect(origin).toBe(ORIGIN_GPU_EAST);
  });

  it("routes /voice/ to GPU origin", () => {
    expect(selectOrigin("/voice/stream", {})).toBe(ORIGIN_GPU_EAST);
  });

  it("routes EU country to eu-west", () => {
    expect(selectOrigin("/api/chat", { geoCountry: "DE" })).toBe(ORIGIN_EU_WEST);
  });

  it("respects stickyOrigin over geo routing", () => {
    const result = selectOrigin("/api/chat", {
      geoCountry: "DE",
      stickyOrigin: ORIGIN_US_WEST,
    });
    expect(result).toBe(ORIGIN_US_WEST);
  });

  it("returns non-empty failover candidates", () => {
    const candidates = getOriginCandidates(ORIGIN_US_EAST);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0]).toBe(ORIGIN_US_EAST);
  });

  it("GPU_PATH_PREFIXES contains /signals/ and /voice/", () => {
    expect(GPU_PATH_PREFIXES).toContain("/signals/");
    expect(GPU_PATH_PREFIXES).toContain("/voice/");
  });
});

// ── Layer 2 ──────────────────────────────────────────────────────────────────
import {
  isBlockedUA,
  getRateLimitConfig,
  consumeToken,
  BLOCKED_UA_PATTERNS,
} from "../src/layer2-bot-defense.js";

describe("Layer 2 — Bot Defense", () => {
  it("exports enforceRateLimit as async function", async () => {
    const mod = await import("../src/layer2-bot-defense.js");
    expect(typeof mod.enforceRateLimit).toBe("function");
    expect(mod.enforceRateLimit.constructor.name).toBe("AsyncFunction");
  });

  it("blocks python-requests UA", () => {
    expect(isBlockedUA("python-requests/2.28.0")).toBe(true);
  });

  it("blocks curl UA", () => {
    expect(isBlockedUA("curl/7.88.1")).toBe(true);
  });

  it("allows legitimate browser UA", () => {
    expect(isBlockedUA("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")).toBe(false);
  });

  it("/signals/ has stricter rate limit than default", () => {
    const signalsCfg  = getRateLimitConfig("/signals/live");
    const defaultCfg  = getRateLimitConfig("/api/other");
    expect(signalsCfg.capacity).toBeLessThan(defaultCfg.capacity);
  });

  it("/pitch/ has the strictest rate limit", () => {
    const pitchCfg   = getRateLimitConfig("/pitch/deck");
    const signalsCfg = getRateLimitConfig("/signals/live");
    expect(pitchCfg.capacity).toBeLessThanOrEqual(signalsCfg.capacity);
  });

  it("token bucket allows first request", () => {
    const allowed = consumeToken("1.2.3.4", "/api/test", Date.now());
    expect(allowed).toBe(true);
  });

  it("BLOCKED_UA_PATTERNS is non-empty array", () => {
    expect(Array.isArray(BLOCKED_UA_PATTERNS)).toBe(true);
    expect(BLOCKED_UA_PATTERNS.length).toBeGreaterThan(0);
  });
});

// ── Layer 3 ──────────────────────────────────────────────────────────────────
import {
  fnv1a32,
  sessionToOrigin,
  parseSessionCookie,
  ORIGIN_POOL,
  BUCKET_COUNT,
} from "../src/layer3-session-affinity.js";

describe("Layer 3 — Session Affinity", () => {
  it("exports resolveSessionAffinity as async function", async () => {
    const mod = await import("../src/layer3-session-affinity.js");
    expect(typeof mod.resolveSessionAffinity).toBe("function");
    expect(mod.resolveSessionAffinity.constructor.name).toBe("AsyncFunction");
  });

  it("fnv1a32 is deterministic", () => {
    expect(fnv1a32("hello")).toBe(fnv1a32("hello"));
  });

  it("fnv1a32 produces different values for different inputs", () => {
    expect(fnv1a32("session-abc")).not.toBe(fnv1a32("session-xyz"));
  });

  it("sessionToOrigin always returns a valid origin", () => {
    const origins = ["session-1", "session-2", "session-3", "abc123"].map(sessionToOrigin);
    for (const o of origins) {
      expect(ORIGIN_POOL).toContain(o);
    }
  });

  it("same session ID always maps to same origin (determinism)", () => {
    const id = "user-12345-atom";
    expect(sessionToOrigin(id)).toBe(sessionToOrigin(id));
  });

  it("parseSessionCookie extracts atom_session value", () => {
    const val = parseSessionCookie("some=val; atom_session=abc-def-123; other=x");
    expect(val).toBe("abc-def-123");
  });

  it("parseSessionCookie returns undefined if absent", () => {
    expect(parseSessionCookie("foo=bar; baz=qux")).toBeUndefined();
  });

  it("BUCKET_COUNT equals ORIGIN_POOL length", () => {
    expect(BUCKET_COUNT).toBe(ORIGIN_POOL.length);
  });
});

// ── Layer 4 ──────────────────────────────────────────────────────────────────
import { isSseRequest, SSE_PATH_PREFIXES } from "../src/layer4-signal-streaming.js";

describe("Layer 4 — Signal Streaming", () => {
  it("exports streamSignals as async function", async () => {
    const mod = await import("../src/layer4-signal-streaming.js");
    expect(typeof mod.streamSignals).toBe("function");
    expect(mod.streamSignals.constructor.name).toBe("AsyncFunction");
  });

  it("isSseRequest returns true for /api/signals/ path", () => {
    expect(isSseRequest("/api/signals/live", "application/json")).toBe(true);
  });

  it("isSseRequest returns true for text/event-stream Accept header", () => {
    expect(isSseRequest("/other/path", "text/event-stream")).toBe(true);
  });

  it("isSseRequest returns false for regular JSON endpoint", () => {
    expect(isSseRequest("/api/leads", "application/json")).toBe(false);
  });

  it("SSE_PATH_PREFIXES includes /api/signals/ and /api/atom-chat", () => {
    expect(SSE_PATH_PREFIXES).toContain("/api/signals/");
    expect(SSE_PATH_PREFIXES).toContain("/api/atom-chat");
  });
});

// ── Layer 5 ──────────────────────────────────────────────────────────────────
import {
  countryToRegion,
  regionToOrigin,
  consentHeader,
  EU_EEA_COUNTRIES,
} from "../src/layer5-geo-gdpr.js";

describe("Layer 5 — Geo / GDPR", () => {
  it("exports applyGeoRouting as async function", async () => {
    const mod = await import("../src/layer5-geo-gdpr.js");
    expect(typeof mod.applyGeoRouting).toBe("function");
    expect(mod.applyGeoRouting.constructor.name).toBe("AsyncFunction");
  });

  it("maps DE to EU region", () => {
    expect(countryToRegion("DE")).toBe("EU");
  });

  it("maps FR to EU region", () => {
    expect(countryToRegion("FR")).toBe("EU");
  });

  it("maps US to US-EAST region", () => {
    expect(countryToRegion("US")).toBe("US-EAST");
  });

  it("maps AU to APAC region", () => {
    expect(countryToRegion("AU")).toBe("APAC");
  });

  it("EU region resolves to eu-west origin", () => {
    const origin = regionToOrigin("EU");
    expect(origin).toContain("eu-west");
  });

  it("consentHeader returns gdpr=required for EU", () => {
    expect(consentHeader("EU")).toContain("gdpr=required");
  });

  it("consentHeader returns gdpr=optional for non-EU", () => {
    expect(consentHeader("US-EAST")).toContain("gdpr=optional");
  });

  it("EU_EEA_COUNTRIES contains DE, FR, GB", () => {
    expect(EU_EEA_COUNTRIES.has("DE")).toBe(true);
    expect(EU_EEA_COUNTRIES.has("FR")).toBe(true);
    expect(EU_EEA_COUNTRIES.has("GB")).toBe(true);
  });
});

// ── Layer 6 ──────────────────────────────────────────────────────────────────
import {
  resolveCacheControl,
  normalizeCacheQuery,
  djb2Hash,
  STRIP_PARAMS,
  TTL_RULES,
} from "../src/layer6-cache-key.js";

describe("Layer 6 — Cache Key", () => {
  it("exports normalizeCacheKey as async function", async () => {
    const mod = await import("../src/layer6-cache-key.js");
    expect(typeof mod.normalizeCacheKey).toBe("function");
    expect(mod.normalizeCacheKey.constructor.name).toBe("AsyncFunction");
  });

  it("/api/atom-chat → 30s cache", () => {
    expect(resolveCacheControl("/api/atom-chat")).toContain("max-age=30");
  });

  it("/api/warbook/research → 24h cache", () => {
    expect(resolveCacheControl("/api/warbook/research")).toContain("max-age=86400");
  });

  it("/api/market-intent/analyze → 6h cache", () => {
    expect(resolveCacheControl("/api/market-intent/analyze")).toContain("max-age=21600");
  });

  it("/api/atom-leadgen/* → 5min cache", () => {
    expect(resolveCacheControl("/api/atom-leadgen/search")).toContain("max-age=300");
  });

  it("/api/signals/* → no-cache", () => {
    const cc = resolveCacheControl("/api/signals/live");
    expect(cc).toContain("no-cache");
    expect(cc).toContain("max-age=0");
  });

  it("default path → no-cache", () => {
    expect(resolveCacheControl("/some/random/path")).toContain("no-cache");
  });

  it("normalizeCacheQuery strips _t param", () => {
    const result = normalizeCacheQuery("?foo=bar&_t=1234567890&baz=qux");
    expect(result).not.toContain("_t=");
    expect(result).toContain("foo=bar");
    expect(result).toContain("baz=qux");
  });

  it("normalizeCacheQuery strips __cb param", () => {
    expect(normalizeCacheQuery("?a=1&__cb=xyz")).not.toContain("__cb=");
  });

  it("normalizeCacheQuery returns empty for empty input", () => {
    expect(normalizeCacheQuery("")).toBe("");
  });

  it("djb2Hash is deterministic", () => {
    expect(djb2Hash("tenant-acme")).toBe(djb2Hash("tenant-acme"));
  });

  it("djb2Hash returns 8-char hex string", () => {
    const h = djb2Hash("test");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it("STRIP_PARAMS contains _t and __cb", () => {
    expect(STRIP_PARAMS.has("_t")).toBe(true);
    expect(STRIP_PARAMS.has("__cb")).toBe(true);
  });

  it("TTL_RULES has an entry for each required route", () => {
    const prefixes = TTL_RULES.map((r) => r.prefix);
    expect(prefixes).toContain("/api/atom-chat");
    expect(prefixes).toContain("/api/warbook/research");
    expect(prefixes).toContain("/api/signals/");
    expect(prefixes).toContain("/api/atom-leadgen/");
  });
});

// ── main.ts chain exports ─────────────────────────────────────────────────────
describe("main.ts — Chain Handler Signatures", () => {
  it("exports onClientRequest as async function", async () => {
    const mod = await import("../src/main.js");
    expect(typeof mod.onClientRequest).toBe("function");
    expect(mod.onClientRequest.constructor.name).toBe("AsyncFunction");
  });

  it("exports onClientResponse as async function", async () => {
    const mod = await import("../src/main.js");
    expect(typeof mod.onClientResponse).toBe("function");
    expect(mod.onClientResponse.constructor.name).toBe("AsyncFunction");
  });

  it("exports responseProvider as async function", async () => {
    const mod = await import("../src/main.js");
    expect(typeof mod.responseProvider).toBe("function");
    expect(mod.responseProvider.constructor.name).toBe("AsyncFunction");
  });
});
