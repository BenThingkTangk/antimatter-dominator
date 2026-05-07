/**
 * Shared fetcher for the admin layer — auto-attaches X-Admin-Key from
 * localStorage and normalises error handling.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const ADMIN_KEY_LS = "atom_admin_key";

function getAdminKey(): string {
  try { return localStorage.getItem(ADMIN_KEY_LS) || ""; } catch { return ""; }
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<any> {
  const key = getAdminKey();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-Admin-Key": key } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} · ${t.slice(0, 200)}`);
  }
  return res.json();
}

export function useAdminQuery<T = any>(key: any[], path: string, opts: { refetchInterval?: number; enabled?: boolean } = {}) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => adminFetch(path),
    refetchInterval: opts.refetchInterval,
    enabled: opts.enabled ?? true,
  });
}

export function useAdminMutation<TIn = any, TOut = any>(path: string, method: "POST" | "PATCH" | "DELETE" = "POST", invalidate: any[][] = []) {
  const qc = useQueryClient();
  return useMutation<TOut, Error, TIn>({
    mutationFn: (body) => adminFetch(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}
