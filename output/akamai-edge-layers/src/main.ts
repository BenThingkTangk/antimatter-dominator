/**
 * main.ts — ATOM Sales Dominator Akamai EdgeWorker Entry Point
 *
 * Chains all 6 layers in the prescribed order:
 *   Layer 2 (bot defense) → Layer 5 (geo/GDPR) → Layer 1 (origin router)
 *   → Layer 3 (session affinity) → Layer 4 (SSE streaming) → Layer 6 (cache key)
 *
 * Akamai EdgeWorkers lifecycle hooks used:
 *   onClientRequest   — inbound request processing (L2, L5, L1, L3)
 *   onClientResponse  — outbound response processing (L6 cache key)
 *   responseProvider  — full async streaming override (L4 SSE)
 *
 * @see https://techdocs.akamai.com/edgeworkers/docs/event-handler-functions
 */

import { enforceRateLimit }       from "./layer2-bot-defense.js";
import { applyGeoRouting }        from "./layer5-geo-gdpr.js";
import { routeToOrigin }          from "./layer1-router.js";
import { resolveSessionAffinity } from "./layer3-session-affinity.js";
import { isSseRequest, streamSignals } from "./layer4-signal-streaming.js";
import { normalizeCacheKey }      from "./layer6-cache-key.js";

// ---------------------------------------------------------------------------
// onClientRequest — runs for every incoming request at the edge
// ---------------------------------------------------------------------------
export async function onClientRequest(
  request: EW.IngressClientRequest
): Promise<void> {
  // ── Layer 2: Bot Defense & Rate Limiting ─────────────────────────────────
  const allowed = await enforceRateLimit(request);
  if (!allowed) return; // Response already set; short-circuit

  // ── Layer 5: Geo Routing & GDPR tagging ──────────────────────────────────
  const { origin: geoOrigin, region } = await applyGeoRouting(request);

  // Build the shared routing context (passed by reference via PMUSER variables)
  const ctx = {
    geoCountry:    request.getVariable("PMUSER_ATOM_GEO_COUNTRY") ?? "US",
    resolvedOrigin: geoOrigin,
    stickyOrigin:   undefined as string | undefined,
  };

  // ── Layer 3: Session Affinity (may override geo origin) ──────────────────
  const stickyOrigin = await resolveSessionAffinity(request);
  if (stickyOrigin) ctx.stickyOrigin = stickyOrigin;

  // ── Layer 1: Smart Origin Router ─────────────────────────────────────────
  // routeToOrigin reads ctx.stickyOrigin first, then ctx.resolvedOrigin
  await routeToOrigin(request, ctx);

  // Tag for observability
  request.addHeader("X-ATOM-Layer-Chain",
    `L2:ok,L5:${region},L3:${stickyOrigin ? "sticky" : "none"},L1:${ctx.stickyOrigin ?? geoOrigin}`
  );
}

// ---------------------------------------------------------------------------
// onClientResponse — runs after the origin responds, before delivery to client
// ---------------------------------------------------------------------------
export async function onClientResponse(
  request: EW.IngressClientRequest,
  response: EW.EgressClientResponse
): Promise<void> {
  // ── Layer 6: Cache Key Normalization & TTL Hints ──────────────────────────
  await normalizeCacheKey(request, response);
}

// ---------------------------------------------------------------------------
// responseProvider — replaces origin fetch; only invoked for SSE paths
// Requires property-rule criterion: "Path matches /api/signals/* or /api/atom-chat"
// ---------------------------------------------------------------------------
export async function responseProvider(
  request: EW.ResponseProviderRequest
): Promise<EW.CreateResponse> {
  const path   = request.path ?? "/";
  const accept = request.getHeader("Accept")?.[0] ?? "";

  if (isSseRequest(path, accept)) {
    // ── Layer 4: Signal Streaming / SSE Proxy ────────────────────────────
    return streamSignals(request);
  }

  // Fallback — should not normally reach here; property rules gate responseProvider
  // Return a 501 so monitoring catches misconfigured property rules
  return {
    status: 501,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "responseProvider invoked for non-SSE path", path }),
  } as unknown as EW.CreateResponse;
}
