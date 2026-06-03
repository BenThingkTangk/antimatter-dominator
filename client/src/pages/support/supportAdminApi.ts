/** Admin API client for ATOM Support dashboard. Uses the shared admin key. */

const ADMIN_KEY_LS = "atom_admin_key";

export function getAdminKey(): string {
  try { return localStorage.getItem(ADMIN_KEY_LS) || ""; } catch { return ""; }
}
export function setAdminKey(k: string) {
  try { localStorage.setItem(ADMIN_KEY_LS, k); } catch {}
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<any> {
  const key = getAdminKey();
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Admin-Key": key, ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function supportAdminGet(view: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ view, ...params }).toString();
  return adminFetch(`/api/support-admin?${qs}`);
}

export function runEvalScenarios() {
  return adminFetch("/api/support-admin?view=eval-run", { method: "POST", body: "{}" });
}

export function ingestRepoDefaults() {
  return adminFetch("/api/support?op=ingest", {
    method: "POST",
    body: JSON.stringify({ mode: "repo-defaults" }),
  });
}

export function getSupportConfig() {
  return fetch("/api/support?op=config", { credentials: "include" }).then((r) => r.json());
}
