/**
 * Layer 5 — Geo Routing & GDPR Compliance
 *
 * Responsibilities:
 *  - Read PMUSER_GEO_COUNTRY (populated by Akamai's EdgeGrid geo database)
 *  - Route EU/EEA traffic to the eu-west origin for data residency compliance
 *  - Attach X-ATOM-Region header to the forwarded request
 *  - Inject a cookie-consent / data-residency signal header (X-ATOM-GDPR-Region)
 *  - Log the GDPR routing decision to PMUSER for EdgeWorkers monitoring
 *  - Does NOT block traffic — compliance enforcement is at origin
 */

/** EU + EEA country codes */
export const EU_EEA_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
  // EEA
  "IS","LI","NO",
  // GDPR-adjacent (adequacy decision / contractual alignment)
  "CH","GB","JP","KR","CA","NZ",
]);

export type Region = "EU" | "US-EAST" | "US-WEST" | "APAC" | "OTHER";

/** Origin assigned per region for data-residency */
const REGION_ORIGIN_MAP: Record<Region, string> = {
  "EU":       "atom-api-eu-west.atomsalesdominator.com",
  "US-EAST":  "atom-api-us-east.atomsalesdominator.com",
  "US-WEST":  "atom-api-us-west.atomsalesdominator.com",
  "APAC":     "atom-api-us-east.atomsalesdominator.com",  // Fallback until APAC PoP
  "OTHER":    "atom-api-us-east.atomsalesdominator.com",
};

/** APAC country codes (basic list) */
const APAC_COUNTRIES = new Set([
  "AU","NZ","JP","KR","SG","HK","TW","IN","TH","MY","ID","PH","VN",
]);

export function countryToRegion(countryCode: string): Region {
  const cc = countryCode.toUpperCase();
  if (EU_EEA_COUNTRIES.has(cc)) return "EU";
  if (APAC_COUNTRIES.has(cc))   return "APAC";
  // US states come as state codes through Akamai — country is "US"
  if (cc === "US")               return "US-EAST"; // Layer 1 can refine to us-west later
  return "OTHER";
}

export function regionToOrigin(region: Region): string {
  return REGION_ORIGIN_MAP[region]!;
}

/**
 * Build the cookie-consent banner directive header.
 * EU traffic gets "required"; everyone else gets "optional".
 */
export function consentHeader(region: Region): string {
  return region === "EU" ? "gdpr=required; region=EU" : "gdpr=optional";
}

/**
 * Main EdgeWorker hook — runs during onClientRequest.
 * Resolves the geo-appropriate origin and tags the request.
 *
 * Returns the resolved origin so layer1/layer3 can pick it up via RouterContext.
 */
export async function applyGeoRouting(
  request: EW.IngressClientRequest
): Promise<{ region: Region; origin: string }> {
  // Akamai provides geo data in PMUSER variables set by the property rules
  const geoCountry =
    request.getVariable("PMUSER_GEO_COUNTRY") ??
    request.getHeader("X-ATOM-Geo-Country")?.[0] ??  // dev override
    "US";

  const region = countryToRegion(geoCountry);
  const origin = regionToOrigin(region);

  // Write routing decision to PMUSER for property-level logic + logging
  request.setVariable("PMUSER_ATOM_GEO_REGION", region);
  request.setVariable("PMUSER_ATOM_GEO_COUNTRY", geoCountry);
  request.setVariable("PMUSER_ATOM_GEO_ORIGIN",  origin);

  // Attach headers for the origin to consume
  request.addHeader("X-ATOM-Region",      region);
  request.addHeader("X-ATOM-Geo-Country", geoCountry);
  request.addHeader("X-ATOM-GDPR-Region", consentHeader(region));

  // Data-residency log marker (picked up by Akamai DataStream 2)
  request.setVariable("PMUSER_GDPR_LOG",
    `country=${geoCountry};region=${region};origin=${origin};ts=${Date.now()}`
  );

  return { region, origin };
}

export { REGION_ORIGIN_MAP };
