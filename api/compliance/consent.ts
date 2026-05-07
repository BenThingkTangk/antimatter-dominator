/**
 * /api/compliance/consent — consent capture + revocation + listing.
 *
 *   GET    ?tenantSlug=<slug>&prospectId=<id>   → active consent for a prospect
 *   GET    ?tenantSlug=<slug>                   → recent consents (last 50)
 *   POST   capture                               → append new consent row
 *   POST   revoke                                → append a 'revoked' row (append-only chain)
 *
 * Auth: X-Admin-Key required.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ADMIN_API_KEY = clean(process.env.ADMIN_API_KEY);

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
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 220)}`);
  return t ? JSON.parse(t) : null;
}
function sha256(s: string): string { return crypto.createHash("sha256").update(s).digest("hex"); }
async function tenantBySlug(slug: string) {
  const rows = await sb(`tenants?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
function normalizeProspectId(raw: string): string {
  // phone:+1... | email:foo@bar | user:uuid — keep canonical form
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.includes(":")) return s;
  if (/^\+?\d/.test(s)) {
    const d = s.replace(/\D/g, "");
    const e164 = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : `+${d}`;
    return `phone:${e164}`;
  }
  if (s.includes("@")) return `email:${s.toLowerCase()}`;
  return `user:${s}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();

  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (req.method === "GET") {
      const slug = String(req.query.tenantSlug || "").trim();
      const prospect = String(req.query.prospectId || "").trim();
      if (!slug) return res.status(400).json({ error: "tenantSlug required" });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });
      if (prospect) {
        const pid = normalizeProspectId(prospect);
        const rows = await sb(
          `consent_ledger?tenant_id=eq.${tenant.id}&prospect_identifier=eq.${encodeURIComponent(pid)}&order=captured_at.desc&limit=20&select=*`
        );
        return res.status(200).json({ consents: rows });
      }
      const rows = await sb(
        `consent_ledger?tenant_id=eq.${tenant.id}&order=captured_at.desc&limit=50&select=id,prospect_identifier,channel,consent_type,source,captured_by,captured_at,revoked_at`
      );
      return res.status(200).json({ consents: rows });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const action = String(body.action || "capture");
      const slug = String(body.tenantSlug || "").trim();
      if (!slug) return res.status(400).json({ error: "tenantSlug required" });
      const tenant = await tenantBySlug(slug);
      if (!tenant) return res.status(404).json({ error: "tenant not found" });

      if (action === "capture") {
        const pid = normalizeProspectId(body.prospectIdentifier || body.prospectId || "");
        if (!pid) return res.status(400).json({ error: "prospectIdentifier required" });
        const channel = String(body.channel || "voice");
        const consentType = String(body.consentType || "PEWC");
        const source = String(body.source || "manual_capture");
        const evidenceUrl = body.evidenceUrl || null;
        const evidencePayload = body.evidencePayload || {};
        const capturedBy = body.capturedBy || null;
        const expiresAt = body.expiresAt || null;

        // Fetch prior row for chaining
        const prior: any[] = await sb(
          `consent_ledger?tenant_id=eq.${tenant.id}&prospect_identifier=eq.${encodeURIComponent(pid)}&order=captured_at.desc&limit=1&select=evidence_hash`
        ).catch(() => []);
        const priorHash = prior?.[0]?.evidence_hash || "";
        const capturedAt = new Date().toISOString();
        const canonical = JSON.stringify({
          tenant_id: tenant.id, pid, channel, consentType, source, evidenceUrl, evidencePayload, capturedBy, capturedAt, priorHash,
        });
        const evidenceHash = sha256(canonical);
        const row = await sb("consent_ledger", {
          method: "POST",
          body: JSON.stringify({
            tenant_id: tenant.id,
            prospect_identifier: pid,
            channel,
            consent_type: consentType,
            source,
            evidence_url: evidenceUrl,
            evidence_payload: evidencePayload,
            captured_by: capturedBy,
            captured_at: capturedAt,
            expires_at: expiresAt,
            prior_hash: priorHash,
            evidence_hash: evidenceHash,
          }),
        });
        return res.status(201).json({ consent: row?.[0] || row, evidenceHash });
      }

      if (action === "revoke") {
        const pid = normalizeProspectId(body.prospectIdentifier || body.prospectId || "");
        if (!pid) return res.status(400).json({ error: "prospectIdentifier required" });
        const channel = String(body.channel || "voice");
        const source = String(body.source || "user_request");
        const prior: any[] = await sb(
          `consent_ledger?tenant_id=eq.${tenant.id}&prospect_identifier=eq.${encodeURIComponent(pid)}&order=captured_at.desc&limit=1&select=evidence_hash`
        ).catch(() => []);
        const priorHash = prior?.[0]?.evidence_hash || "";
        const capturedAt = new Date().toISOString();
        const canonical = JSON.stringify({ tenant_id: tenant.id, pid, channel, type: "revoked", source, capturedAt, priorHash });
        const evidenceHash = sha256(canonical);
        const row = await sb("consent_ledger", {
          method: "POST",
          body: JSON.stringify({
            tenant_id: tenant.id,
            prospect_identifier: pid,
            channel,
            consent_type: "revoked",
            source,
            captured_at: capturedAt,
            revoked_at: capturedAt,
            prior_hash: priorHash,
            evidence_hash: evidenceHash,
          }),
        });
        return res.status(201).json({ consent: row?.[0] || row, evidenceHash });
      }

      return res.status(400).json({ error: "action must be 'capture' or 'revoke'" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[compliance/consent]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
