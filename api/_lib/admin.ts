/**
 * Shared admin helpers — inlined into each admin API route (Vercel nft can't
 * trace sibling imports reliably). If you edit this file, mirror the change
 * into the routes that need it. For now we keep it as a small internal
 * module and import where we can; routes that must stay self-contained
 * copy the bodies in.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
export const SUPABASE_URL = clean(process.env.SUPABASE_URL);
export const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

export async function supabase(path: string, init: RequestInit = {}): Promise<any> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase not configured");
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) {
    res.status(500).json({ error: "ADMIN_API_KEY not configured on server" });
    return false;
  }
  if (!provided || provided !== ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized — provide X-Admin-Key header" });
    return false;
  }
  return true;
}

export function cors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key, X-Tenant-Slug");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  return true;
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * Append-only log with tamper-evident chaining.
 *   entry_hash = sha256(prior_hash || canonical_payload)
 * The prior_hash is pulled from the most recent row in the tenant scope.
 */
export async function appendAuditLog(opts: {
  tenantId: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resource?: string | null;
  result?: "ok" | "blocked" | "error";
  reason?: string | null;
  payload?: Record<string, any>;
}): Promise<{ entryHash: string }> {
  const tenantFilter = opts.tenantId
    ? `tenant_id=eq.${opts.tenantId}`
    : `tenant_id=is.null`;
  const prior = await supabase(
    `audit_log?${tenantFilter}&select=entry_hash&order=created_at.desc&limit=1`
  ).catch(() => []);
  const priorHash = Array.isArray(prior) && prior[0]?.entry_hash ? prior[0].entry_hash : "";
  const payload = opts.payload ?? {};
  const canonical = JSON.stringify({
    tenant_id: opts.tenantId,
    actor_email: opts.actorEmail ?? null,
    actor_role: opts.actorRole ?? null,
    action: opts.action,
    resource: opts.resource ?? null,
    result: opts.result ?? "ok",
    reason: opts.reason ?? null,
    payload,
    prior_hash: priorHash,
  });
  const entryHash = sha256(canonical);
  await supabase("audit_log", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: opts.tenantId,
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole,
      action: opts.action,
      resource: opts.resource,
      result: opts.result ?? "ok",
      reason: opts.reason,
      payload,
      prior_hash: priorHash,
      entry_hash: entryHash,
    }),
    headers: { Prefer: "return=minimal" },
  }).catch((e) => console.warn("[audit_log] write failed:", e?.message));
  return { entryHash };
}

/**
 * Append a consent ledger entry with SHA-256 chaining per prospect.
 */
export async function appendConsent(opts: {
  tenantId: string;
  prospectIdentifier: string;
  channel: "voice" | "sms" | "email";
  consentType: "PEWC" | "express_written" | "implied" | "revoked";
  source: string;
  evidenceUrl?: string | null;
  evidencePayload?: Record<string, any>;
  capturedBy?: string | null;
  expiresAt?: string | null;
}): Promise<{ evidenceHash: string }> {
  const prior = await supabase(
    `consent_ledger?tenant_id=eq.${opts.tenantId}&prospect_identifier=eq.${encodeURIComponent(opts.prospectIdentifier)}&select=evidence_hash&order=captured_at.desc&limit=1`
  ).catch(() => []);
  const priorHash = Array.isArray(prior) && prior[0]?.evidence_hash ? prior[0].evidence_hash : "";
  const capturedAt = new Date().toISOString();
  const canonical = JSON.stringify({
    tenant_id: opts.tenantId,
    prospect_identifier: opts.prospectIdentifier,
    channel: opts.channel,
    consent_type: opts.consentType,
    source: opts.source,
    evidence_url: opts.evidenceUrl ?? null,
    evidence_payload: opts.evidencePayload ?? {},
    captured_by: opts.capturedBy ?? null,
    captured_at: capturedAt,
    prior_hash: priorHash,
  });
  const evidenceHash = sha256(canonical);
  await supabase("consent_ledger", {
    method: "POST",
    body: JSON.stringify({
      tenant_id: opts.tenantId,
      prospect_identifier: opts.prospectIdentifier,
      channel: opts.channel,
      consent_type: opts.consentType,
      source: opts.source,
      evidence_url: opts.evidenceUrl,
      evidence_payload: opts.evidencePayload ?? {},
      captured_by: opts.capturedBy,
      captured_at: capturedAt,
      expires_at: opts.expiresAt,
      prior_hash: priorHash,
      evidence_hash: evidenceHash,
    }),
    headers: { Prefer: "return=minimal" },
  });
  return { evidenceHash };
}

/** Normalise to E.164: +15552345678 */
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;       // US default
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/** Infer US state from an E.164 phone (coarse — area code only). */
export function usStateFromPhone(e164: string): string | null {
  // Minimal area-code → state map, enough to flag Oregon/Florida/California
  // Expand freely. Returns null if unknown.
  const ac = e164.match(/^\+1(\d{3})/)?.[1];
  if (!ac) return null;
  const OR = new Set(["503", "541", "971", "458"]);
  const FL = new Set(["239","305","321","352","386","407","561","689","727","754","772","786","813","850","863","904","941","954"]);
  const CA = new Set(["209","213","279","310","323","341","408","415","424","442","510","530","559","562","619","626","628","650","657","661","669","707","714","747","760","805","818","820","831","840","858","909","916","925","949","951"]);
  const NY = new Set(["212","315","332","347","363","516","518","585","607","631","646","680","716","718","838","845","914","917","929","934"]);
  if (OR.has(ac)) return "OR";
  if (FL.has(ac)) return "FL";
  if (CA.has(ac)) return "CA";
  if (NY.has(ac)) return "NY";
  return null;
}

/** Rough tz offset for a phone — for quiet-hours enforcement. */
export function tzOffsetFromState(state: string | null): number {
  // Offset from UTC in hours. DST-agnostic approximation.
  switch (state) {
    case "OR": case "CA": return -8;
    case "NY": case "FL": return -5;
    default: return -6; // central as a conservative default
  }
}
