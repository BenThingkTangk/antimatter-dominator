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
 *   primary_hex: "#ef4444"
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
  primary_hex: "#ef4444",
  accent_hex: "#06b6d4",
  plan: "enterprise",
  hume_config_id: null,
  twilio_subaccount_sid: null,
  source: "default",
};

const SESSION_KEY = "atom_tenant_v1";

function applyTheme(t: Tenant) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", t.primary_hex);
  root.style.setProperty("--brand-accent", t.accent_hex);
  // Update document title
  if (t.name && t.name !== "AntimatterAI") {
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
    const host =
      typeof window !== "undefined" ? window.location.hostname : "localhost";
    fetch(`/api/tenant?host=${encodeURIComponent(host)}`)
      .then((r) => r.json())
      .then((t: Tenant) => {
        if (cancelled) return;
        setTenant(t);
        applyTheme(t);
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(t));
        } catch {}
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
