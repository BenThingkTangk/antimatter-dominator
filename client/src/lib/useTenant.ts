/**
 * useTenant() — multi-tenant white-label resolver.
 *
 * Behavior:
 *   1. On first paint, fetch /api/tenant?host=<window.location.hostname>
 *   2. Apply primary_hex + accent_hex as CSS variables on <html>
 *   3. Cache result in sessionStorage so subsequent route changes are instant
 *   4. Expose { tenant, loading } to any component via useTenant()
 *
 * Defaults (used when fetch fails OR domain doesn't match a tenant):
 *   slug: "antimatter"
 *   name: "AntimatterAI"
 *   primary_hex: "#00e6d3"  (ATOM teal)
 *   accent_hex: "#06b6d4"
 */
import { useEffect, useState } from "react";

export interface Tenant {
  slug: string;
  name: string;
  logo_url: string;
  primary_hex: string;
  accent_hex: string;
  plan: string;
  hume_config_id: string | null;
  twilio_subaccount_sid: string | null;
  source?: "default" | "db" | "fallback" | "error_fallback";
}

const DEFAULT_TENANT: Tenant = {
  slug: "antimatter",
  name: "AntimatterAI",
  logo_url: "/logo-atom.svg",
  primary_hex: "#00e6d3",
  accent_hex: "#00a7ff",
  plan: "enterprise",
  hume_config_id: null,
  twilio_subaccount_sid: null,
  source: "default",
};

// v3 — bumped to invalidate stale RED brand caches from when DEFAULT_TENANT
// in api/tenant.ts had primary_hex='#ef4444'. Server is now teal #00e6d3 and
// the antimatter Supabase row is also teal; this just clears any client cache
// still holding red from before the fix.
const SESSION_KEY = "atom_tenant_v3";

// Convert any hex (#RRGGBB) to a hex with alpha multiplier so we can build
// the soft "glow" companion to the primary brand color.
function hexWithAlpha(hex: string, a: number): string {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function applyTheme(t: Tenant) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Set BOTH the brand-* aliases (used by some legacy code) AND the actual
  // --color-primary / --color-primary-2 / --color-primary-glow variables that
  // the entire app reads from. Without this second set, brand colors don't
  // propagate — the app stays default ATOM teal.
  root.style.setProperty("--brand-primary", t.primary_hex);
  root.style.setProperty("--brand-accent", t.accent_hex);
  root.style.setProperty("--color-primary", t.primary_hex);
  root.style.setProperty("--color-primary-2", t.accent_hex || t.primary_hex);
  root.style.setProperty("--color-primary-glow", hexWithAlpha(t.primary_hex, 0.32));
  // Document title reflects tenant name
  if (t.name) {
    document.title = `${t.name} — ATOM Sales Dominator`;
  }
}

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant>(() => {
    if (typeof window === "undefined") return DEFAULT_TENANT;
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) return JSON.parse(cached) as Tenant;
    } catch {}
    return DEFAULT_TENANT;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply cached theme immediately to avoid FOUC
    applyTheme(tenant);

    let cancelled = false;
    // Allow ?tenant=<slug> URL override so admins can preview a tenant's
    // branded view ("View as tenant") from the Tenants admin tab.
    const previewSlug = (() => {
      try {
        const url = new URL(window.location.href);
        const fromQuery = url.searchParams.get("tenant") || url.searchParams.get("tenantSlug");
        if (fromQuery) return fromQuery;
        // Also check the hash query string (HashRouter)
        const hashQ = window.location.hash.split("?")[1];
        if (hashQ) {
          const h = new URLSearchParams(hashQ);
          return h.get("tenant") || h.get("tenantSlug") || null;
        }
      } catch {}
      return null;
    })();

    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const url = previewSlug
      ? `/api/tenant?slug=${encodeURIComponent(previewSlug)}`
      : `/api/tenant?host=${encodeURIComponent(host)}`;

    fetch(url)
      .then((r) => r.json())
      .then((t: Tenant) => {
        if (cancelled) return;
        setTenant(t);
        applyTheme(t);
        // Don't cache preview overrides — admins switch frequently.
        if (!previewSlug) {
          try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(t));
          } catch {}
        }
      })
      .catch(() => {
        // Stay on cached / default — multi-tenant is graceful-degrade.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tenant, loading };
}

/** For components that need brand colors directly without re-fetching */
export function getCachedTenant(): Tenant {
  if (typeof window === "undefined") return DEFAULT_TENANT;
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return JSON.parse(cached) as Tenant;
  } catch {}
  return DEFAULT_TENANT;
}
