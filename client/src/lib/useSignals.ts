/**
 * useSignals — TanStack Query hook backed by /api/signals/discover.
 *
 * Auto-fetches premium-source signals for a company or industry. Returns
 * a typed SignalBundle shape compatible with War Room, Campaign, Market
 * Intent, and Prospect consumers.
 *
 * Pattern:
 *   const { data, isLoading, refetch } = useSignals({ company: "Akamai", domain: "akamai.com" });
 *
 * Cache: 6h on the client (matches the server cache). Force refresh with
 * `useSignals({ ..., force: true })`.
 */
import { useQuery } from "@tanstack/react-query";

export interface DiscoveredSignal {
  id: string;
  headline: string;
  summary: string;
  category: "funding" | "m&a" | "hiring" | "leadership" | "product" | "partnership" | "regulatory" | "competitive" | "macro" | "risk";
  impact: number;
  recencyDays: number;
  source: string;
  url: string;
  date?: string;
}
export interface SignalBundle {
  scope:        { type: "company" | "industry"; name: string; domain?: string };
  signals:      DiscoveredSignal[];
  atomScore:    number;
  topNarrative: string;
  updatedAt:    string;
  sourceCount:  number;
}

const KEY_LS = "atom_admin_key";
function getAdminKey(): string {
  try { return localStorage.getItem(KEY_LS) || ""; } catch { return ""; }
}

interface Opts {
  company?:  string;
  domain?:   string;
  industry?: string;
  force?:    boolean;
  enabled?:  boolean;
}

export function useSignals(opts: Opts) {
  const type = opts.industry ? "industry" : "company";
  const name = (opts.industry || opts.company || "").trim();
  const domain = (opts.domain || "").trim();
  const enabled = (opts.enabled ?? true) && name.length > 1;

  return useQuery<SignalBundle>({
    queryKey: ["signals", type, name, domain, opts.force ? "force" : "cached"],
    enabled,
    staleTime: 6 * 3600 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const params = new URLSearchParams({ type, name });
      if (domain) params.set("domain", domain);
      if (opts.force) params.set("force", "1");
      const res = await fetch(`/api/signals/discover?${params}`, {
        headers: { ...(getAdminKey() ? { "X-Admin-Key": getAdminKey() } : {}) },
      });
      if (!res.ok) throw new Error(`signals/discover ${res.status}`);
      return res.json();
    },
  });
}

/** Compact category label for chips */
export function signalCategoryColor(cat: DiscoveredSignal["category"]): string {
  const map: Record<DiscoveredSignal["category"], string> = {
    funding:      "var(--color-success)",
    "m&a":         "var(--color-primary)",
    hiring:       "var(--color-primary-2)",
    leadership:   "var(--color-claude)",
    product:      "var(--color-primary)",
    partnership:  "var(--color-primary-2)",
    regulatory:   "var(--color-warning)",
    competitive:  "var(--color-hume)",
    macro:        "var(--color-text-muted)",
    risk:         "var(--color-error)",
  };
  return map[cat];
}
