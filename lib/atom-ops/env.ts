/**
 * Central env access for ATOM Ops. Never read process.env directly elsewhere.
 *
 *   getEnv("GITHUB_TOKEN")            -> string | undefined (no throw)
 *   getEnv("GITHUB_TOKEN", true)      -> string (throws if missing/empty)
 *   requireEnv("GITHUB_TOKEN")        -> string (throws)
 *   getEnvList("ATOM_OPS_ALLOWED")    -> string[]
 *
 * Values are trimmed and have stray escaped newlines stripped (Vercel env
 * paste artifact, mirrored from api/_lib/admin.ts behavior).
 */

function clean(v: string | undefined): string {
  return (v || "").replace(/\\n/g, "").trim();
}

export function getEnv(name: string): string | undefined;
export function getEnv(name: string, required: true): string;
export function getEnv(name: string, required?: boolean): string | undefined {
  const raw = clean(process.env[name]);
  if (required && !raw) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return raw || undefined;
}

export function requireEnv(name: string): string {
  return getEnv(name, true);
}

export function getEnvList(name: string): string[] {
  const raw = clean(process.env[name]);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validate that a set of envs are present. Returns the list of missing keys
 * (empty when all present). Used by tools to fail fast with a clear summary
 * instead of making a doomed API call.
 */
export function validateEnv(names: string[]): string[] {
  return names.filter((n) => !getEnv(n));
}

/** True when the value looks set (non-empty after cleaning). */
export function hasEnv(name: string): boolean {
  return Boolean(getEnv(name));
}

/** Superadmin allowlist — mirrors api/auth/*.ts NIRMATA_HQ_EMAILS. */
export function superAdminEmails(): string[] {
  const list = getEnvList("NIRMATA_HQ_EMAILS");
  return (list.length ? list : ["ben.oleary@thingktangk.com"]).map((e) =>
    e.toLowerCase(),
  );
}
