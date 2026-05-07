import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface SessionTenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  trial_ends_at: string | null;
  subscription_status: string;
  kill_switch: boolean;
  primary_hex: string;
  accent_hex: string;
}

export interface SessionData {
  user: SessionUser | null;
  tenant: SessionTenant | null;
  role: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  demoMode: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

async function fetchMe(): Promise<{
  user: SessionUser;
  tenant: SessionTenant;
  role: string;
  isSuperAdmin: boolean;
} | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
}

export function useSession(): SessionData {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: fetchMe,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [qc]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.setQueryData(["/api/auth/me"], null);
    qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
  }, [qc]);

  // Demo mode: check URL for ?demo=1
  const demoMode =
    typeof window !== "undefined" &&
    (window.location.search.includes("demo=1") ||
      window.location.hash.includes("demo=1"));

  return {
    user: data?.user ?? null,
    tenant: data?.tenant ?? null,
    role: data?.role ?? null,
    isSuperAdmin: data?.isSuperAdmin ?? false,
    loading: isLoading,
    demoMode,
    refresh,
    logout,
  };
}
