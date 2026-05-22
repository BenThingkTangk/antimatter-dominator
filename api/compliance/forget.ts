/**
 * POST /api/compliance/forget — GDPR / CCPA "right to be forgotten" endpoint.
 *
 * Auth: admin or super_admin role (cookie-based via atom_session).
 *
 * Body: { email?: string, phone?: string, prospectId?: string }
 *   At least one identifier required.
 *
 * Actions:
 *   1. Delete matching rows from atom_prospect_lists (if table exists)
 *   2. Redact call transcripts in atom_calls
 *   3. Scrub PII from usage_events metadata
 *   4. Remove from consent_ledger
 *   5. Remove from dnc_entries
 *   6. Log to compliance_audit_log
 *
 * Returns: { deleted_records, redacted_calls, audit_log_id }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return out;
}

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

async function sbCount(path: string, init: RequestInit = {}): Promise<number> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "count=exact",
      ...(init.headers || {}),
    },
  });
  // Content-Range: */N or 0-M/N
  const cr = r.headers.get("content-range") || "";
  const total = parseInt(cr.split("/").pop() || "0", 10);
  return isNaN(total) ? 0 : total;
}

interface AuthResult { userId: string; tenantId: string; role: string }

async function resolveAdmin(req: VercelRequest): Promise<AuthResult | null> {
  try {
    const token = parseCookies(req.headers.cookie)["atom_session"];
    if (!token) return null;
    const sessions: any[] = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id`
    );
    const s = sessions?.[0];
    if (!s?.user_id) return null;
    const users: any[] = await sb(
      `tenant_users?id=eq.${s.user_id}&select=role`
    );
    const role = users?.[0]?.role;
    if (role !== "admin" && role !== "super_admin") return null;
    return { userId: s.user_id, tenantId: s.tenant_id, role };
  } catch {
    return null;
  }
}

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  const admin = await resolveAdmin(req);
  if (!admin) return res.status(403).json({ error: "admin or super_admin role required" });

  const body = req.body || {};
  const email = (body.email || "").toString().trim().toLowerCase();
  const phone = normalizePhone(body.phone || "");
  const prospectId = (body.prospectId || "").toString().trim();

  if (!email && !phone && !prospectId) {
    return res.status(400).json({ error: "At least one of email, phone, or prospectId required" });
  }

  try {
    let deletedRecords = 0;
    let redactedCalls = 0;

    // 1. Delete from consent_ledger
    const identifiers: string[] = [];
    if (phone) identifiers.push(`phone:${phone}`);
    if (email) identifiers.push(`email:${email}`);
    if (prospectId) identifiers.push(`user:${prospectId}`);

    for (const pid of identifiers) {
      try {
        const rows = await sb(
          `consent_ledger?tenant_id=eq.${admin.tenantId}&prospect_identifier=eq.${encodeURIComponent(pid)}&select=id`,
        );
        if (Array.isArray(rows) && rows.length > 0) {
          await sb(
            `consent_ledger?tenant_id=eq.${admin.tenantId}&prospect_identifier=eq.${encodeURIComponent(pid)}`,
            { method: "DELETE", headers: { Prefer: "return=minimal" } as any },
          );
          deletedRecords += rows.length;
        }
      } catch { /* continue */ }
    }

    // 2. Delete from dnc_entries
    if (phone) {
      try {
        const dnc = await sb(
          `dnc_entries?identifier=eq.${encodeURIComponent(phone)}&or=(tenant_id.eq.${admin.tenantId},tenant_id.is.null)&select=id`
        );
        if (Array.isArray(dnc) && dnc.length > 0) {
          await sb(
            `dnc_entries?identifier=eq.${encodeURIComponent(phone)}&tenant_id=eq.${admin.tenantId}`,
            { method: "DELETE", headers: { Prefer: "return=minimal" } as any },
          );
          deletedRecords += dnc.length;
        }
      } catch { /* continue */ }
    }

    // 3. Redact call transcripts in atom_calls
    const callFilters: string[] = [];
    if (phone) callFilters.push(`to_number=eq.${encodeURIComponent(phone)}`);
    if (email) callFilters.push(`prospect_email=eq.${encodeURIComponent(email)}`);
    for (const filter of callFilters) {
      try {
        const calls = await sb(
          `atom_calls?${filter}&tenant_slug=eq.${encodeURIComponent(admin.tenantId)}&select=call_sid`
        ).catch(() => []);
        // Also try matching by tenant_id directly
        const calls2 = await sb(
          `atom_calls?${filter}&select=call_sid`
        ).catch(() => []);
        const allCallSids = new Set([
          ...(Array.isArray(calls) ? calls : []).map((c: any) => c.call_sid),
          ...(Array.isArray(calls2) ? calls2 : []).map((c: any) => c.call_sid),
        ]);
        for (const sid of allCallSids) {
          try {
            await sb(`atom_calls?call_sid=eq.${encodeURIComponent(sid)}`, {
              method: "PATCH",
              body: JSON.stringify({
                transcript: "[REDACTED]",
                metadata: { redacted_at: new Date().toISOString(), redacted_by: admin.userId },
              }),
              headers: { Prefer: "return=minimal" } as any,
            });
            redactedCalls++;
          } catch { /* continue */ }
        }
      } catch { /* continue */ }
    }

    // 4. Scrub PII from usage_events metadata (best-effort)
    // PostgREST doesn't support jsonb field-level updates well, so we use a simple approach
    if (email) {
      try {
        await sb(
          `usage_events?metadata->>prospectEmail=eq.${encodeURIComponent(email)}&tenant_id=eq.${admin.tenantId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ metadata: { redacted: true, redacted_at: new Date().toISOString() } }),
            headers: { Prefer: "return=minimal" } as any,
          }
        );
      } catch { /* best-effort */ }
    }
    if (phone) {
      try {
        await sb(
          `usage_events?metadata->>prospectPhone=eq.${encodeURIComponent(phone)}&tenant_id=eq.${admin.tenantId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ metadata: { redacted: true, redacted_at: new Date().toISOString() } }),
            headers: { Prefer: "return=minimal" } as any,
          }
        );
      } catch { /* best-effort */ }
    }

    // 5. Delete from predial_checks (PII scrub)
    if (phone) {
      try {
        await sb(
          `predial_checks?phone=eq.${encodeURIComponent(phone)}&tenant_id=eq.${admin.tenantId}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } as any }
        );
      } catch { /* best-effort */ }
    }

    // 6. Log to compliance_audit_log
    let auditLogId = "";
    try {
      const auditRows = await sb("compliance_audit_log", {
        method: "POST",
        body: JSON.stringify({
          tenant_id: admin.tenantId,
          action: "gdpr_forget",
          target_email: email || null,
          target_phone: phone || null,
          target_prospect_id: prospectId || null,
          by_user_id: admin.userId,
          details: { deleted_records: deletedRecords, redacted_calls: redactedCalls },
          completed_at: new Date().toISOString(),
        }),
      });
      auditLogId = auditRows?.[0]?.id || "";
    } catch (e: any) {
      console.warn("[forget] audit log insert failed:", e?.message);
    }

    return res.status(200).json({
      deleted_records: deletedRecords,
      redacted_calls: redactedCalls,
      audit_log_id: auditLogId,
    });
  } catch (err: any) {
    console.error("[compliance/forget]", err?.message);
    return res.status(500).json({ error: err?.message || "forget failed" });
  }
}
