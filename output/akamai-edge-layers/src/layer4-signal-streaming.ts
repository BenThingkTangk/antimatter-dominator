/**
 * Layer 4 — Signal Streaming (SSE Proxy)
 *
 * Responsibilities:
 *  - Detect SSE requests (path starts with /api/signals/* OR Accept: text/event-stream)
 *  - Proxy the upstream SSE stream without buffering
 *  - Inject CORS headers for browser clients
 *  - Attach X-ATOM-Tenant header from the request (read from JWT sub or query param)
 *  - Preserve `data:` lines verbatim; never coalesce chunks
 *  - Applies only when responseProvider is invoked (streaming response path)
 *
 * IMPORTANT: This layer uses `responseProvider` — Akamai's async streaming
 * event handler. It must NOT be called from onClientRequest / onClientResponse.
 * main.ts will invoke it only when the path matches an SSE route.
 *
 * Upstream service: Perplexity Sonar (text streaming) and ATOM signal pipeline
 * behind the GPU Linode (192.155.92.4 / ORIGIN_GPU_EAST).
 */

import { httpRequest } from "http-request";
import { createResponse } from "create-response";
import { ReadableStream } from "streams";

/** Paths that trigger SSE pass-through mode */
export const SSE_PATH_PREFIXES = [
  "/api/signals/",
  "/api/atom-chat",
  "/voice/stream",
];

/** Allowed origins for CORS — tighten to your actual Vercel + app domains */
const CORS_ALLOWED_ORIGINS = [
  "https://atom-dominator-pro.vercel.app",
  "https://api.atomsalesdominator.com",
];

/** Headers to strip before forwarding to origin to avoid duplication */
const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailers", "transfer-encoding", "upgrade",
]);

export function isSseRequest(path: string, acceptHeader: string): boolean {
  if (SSE_PATH_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (acceptHeader.includes("text/event-stream")) return true;
  return false;
}

function extractTenantId(request: EW.ResponseProviderRequest): string {
  // 1. X-ATOM-Tenant header (set by auth middleware upstream)
  const tenantHeader = request.getHeader("X-ATOM-Tenant")?.[0];
  if (tenantHeader) return tenantHeader;

  // 2. Query param ?tenant=xxx
  try {
    const url   = new URL("https://placeholder" + request.url);
    const param = url.searchParams.get("tenant");
    if (param) return param;
  } catch (_) { /* ignore */ }

  return "default";
}

function buildCorsHeaders(requestOrigin: string): Record<string, string> {
  const allowed = CORS_ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : CORS_ALLOWED_ORIGINS[0]!;

  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-ATOM-Session, X-ATOM-Tenant",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

/**
 * Main EdgeWorker responseProvider hook.
 *
 * Akamai calls responseProvider instead of fetching from origin when this
 * function is invoked. We manually proxy to origin and stream back the SSE body
 * without buffering.
 */
export async function streamSignals(
  request: EW.ResponseProviderRequest
): Promise<EW.CreateResponse> {
  const origin    = request.getVariable("PMUSER_ATOM_ORIGIN") ??
                    "atom-api-gpu-us-east.atomsalesdominator.com";
  const tenantId  = extractTenantId(request);
  const reqOrigin = request.getHeader("Origin")?.[0] ?? "";
  const method    = request.method;
  const path      = request.url;

  // Preflight
  if (method === "OPTIONS") {
    return createResponse(204, {
      ...buildCorsHeaders(reqOrigin),
      "Content-Length": "0",
    }, "");
  }

  // Build upstream request headers — strip hop-by-hop, add tenant
  const forwardHeaders: Record<string, string> = {};
  for (const name of request.getHeaderNames()) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) {
      forwardHeaders[name] = request.getHeader(name)?.[0] ?? "";
    }
  }
  forwardHeaders["X-ATOM-Tenant"] = tenantId;
  forwardHeaders["Accept"]        = "text/event-stream";
  forwardHeaders["Cache-Control"] = "no-cache";

  // Forward to origin
  const upstreamUrl = `https://${origin}${path}`;
  const upstreamResp = await httpRequest(upstreamUrl, {
    method,
    headers: forwardHeaders,
    body: method !== "GET" && method !== "HEAD" ? request.body : undefined,
  } as Parameters<typeof httpRequest>[1]);

  // Pass upstream SSE status and response headers
  const respHeaders: Record<string, string | string[]> = {
    ...buildCorsHeaders(reqOrigin),
    "Content-Type":    "text/event-stream; charset=utf-8",
    "Cache-Control":   "no-cache, no-store",
    "Transfer-Encoding": "chunked",
    "X-Accel-Buffering": "no",
    "X-ATOM-Tenant":   tenantId,
  };

  // Forward any Set-Cookie from upstream
  const upstreamSetCookie = upstreamResp.getHeader("Set-Cookie");
  if (upstreamSetCookie?.length) respHeaders["Set-Cookie"] = upstreamSetCookie;

  // Stream body through without buffering
  return createResponse(
    upstreamResp.status,
    respHeaders,
    upstreamResp.body as unknown as string,
  );
}

export { CORS_ALLOWED_ORIGINS };
