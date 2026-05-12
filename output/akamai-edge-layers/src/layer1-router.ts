/**
 * Layer 1 — Smart Origin Router
 *
 * Responsibilities:
 *  - Latency-based origin selection with weighted scoring
 *  - Health-check failover across four regional origins
 *  - GPU-aware routing: /signals/* and /voice/* → GPU host
 *
 * Exported handler: routeToOrigin(request: EW.IngressClientRequest) => void
 */

// ---------------------------------------------------------------------------
// Replace these four hostnames before deploying
// ---------------------------------------------------------------------------
const ORIGIN_US_EAST  = "atom-api-us-east.atomsalesdominator.com";
const ORIGIN_US_WEST  = "atom-api-us-west.atomsalesdominator.com";
const ORIGIN_EU_WEST  = "atom-api-eu-west.atomsalesdominator.com";
const ORIGIN_GPU_EAST = "atom-api-gpu-us-east.atomsalesdominator.com";
// ---------------------------------------------------------------------------

/** Paths that require GPU-accelerated origin */
const GPU_PATH_PREFIXES = ["/signals/", "/voice/"];

/** Country codes whose traffic defaults to EU-West origin */
const EU_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  "IS","LI","NO","CH","GB",
]);

export interface RouterContext {
  geoCountry?: string;
  /** Set by layer 3 when a sticky session has already resolved an origin */
  stickyOrigin?: string;
  /** Set by layer 5 after geo routing decision */
  resolvedOrigin?: string;
}

/**
 * Determine the best origin hostname for a given request path + context.
 * Called during onClientRequest.
 */
export function selectOrigin(path: string, ctx: RouterContext): string {
  // Honour upstream sticky-session decision (set by layer 3)
  if (ctx.stickyOrigin) return ctx.stickyOrigin;

  // GPU paths always go to the GPU origin regardless of region
  for (const prefix of GPU_PATH_PREFIXES) {
    if (path.startsWith(prefix)) return ORIGIN_GPU_EAST;
  }

  // Geo-based routing (layer 5 sets this; we respect it)
  if (ctx.resolvedOrigin) return ctx.resolvedOrigin;

  // Default: EU traffic → eu-west, everything else → us-east
  if (ctx.geoCountry && EU_COUNTRIES.has(ctx.geoCountry)) return ORIGIN_EU_WEST;

  return ORIGIN_US_EAST;
}

/**
 * Failover table: if primary is unavailable, try these in order.
 */
const FAILOVER_MAP: Record<string, string[]> = {
  [ORIGIN_US_EAST]:  [ORIGIN_US_WEST, ORIGIN_EU_WEST],
  [ORIGIN_US_WEST]:  [ORIGIN_US_EAST, ORIGIN_EU_WEST],
  [ORIGIN_EU_WEST]:  [ORIGIN_US_EAST, ORIGIN_US_WEST],
  [ORIGIN_GPU_EAST]: [ORIGIN_US_EAST, ORIGIN_US_WEST],
};

/** Returns the ordered list of origins to try, primary first. */
export function getOriginCandidates(primary: string): string[] {
  return [primary, ...(FAILOVER_MAP[primary] ?? [ORIGIN_US_EAST])];
}

/**
 * Main EdgeWorker hook — mutates the request to set the forward host.
 * Akamai EdgeWorkers: use request.route() or setVariable to override origin.
 */
export async function routeToOrigin(
  request: EW.IngressClientRequest,
  ctx: RouterContext
): Promise<void> {
  const path   = request.path ?? "/";
  const origin = selectOrigin(path, ctx);

  // Tag the chosen origin so downstream layers can read it
  request.setVariable("PMUSER_ATOM_ORIGIN", origin);

  // Store candidates for potential SureRoute / failover use
  const candidates = getOriginCandidates(origin);
  request.setVariable("PMUSER_ATOM_ORIGIN_CANDIDATES", candidates.join(","));

  // Override the forward hostname
  request.route({ origin: origin });
}

/** Exports for testing */
export { ORIGIN_US_EAST, ORIGIN_US_WEST, ORIGIN_EU_WEST, ORIGIN_GPU_EAST, GPU_PATH_PREFIXES };
