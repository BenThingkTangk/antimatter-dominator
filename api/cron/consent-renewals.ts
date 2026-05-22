/**
 * GET /api/cron/consent-renewals — Weekly consent renewal alert.
 *
 * Runs Sunday 14:00 UTC via Vercel cron.
 * Finds PEWC consents older than 17 months (1 month before 18mo expiry),
 * groups by tenant, and emails each tenant admin a consent-expiring alert.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmail } from "../_lib/send-email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const CRON_SECRET               = clean(process.env.CRON_SECRET);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  if (CRON_SECRET) {
    const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (auth !== CRON_SECRET) return res.status(401).json({ error: "unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  try {
    // Find PEWC consents captured between 17 and 18 months ago (30-day warning window)
    const seventeenMonthsAgo = new Date(Date.now() - 17 * 30.44 * 24 * 3600 * 1000).toISOString();
    const eighteenMonthsAgo = new Date(Date.now() - 18 * 30.44 * 24 * 3600 * 1000).toISOString();

    const expiring: any[] = await sb(
      `consent_ledger?consent_type=in.(PEWC,express_written)&revoked_at=is.null&captured_at=lt.${seventeenMonthsAgo}&captured_at=gt.${eighteenMonthsAgo}&order=tenant_id,captured_at.asc&select=id,tenant_id,prospect_identifier,captured_at&limit=500`
    ).catch(() => []);

    if (!expiring || expiring.length === 0) {
      return res.status(200).json({ ok: true, emailsSent: 0, note: "no expiring consents found" });
    }

    // Group by tenant
    const byTenant = new Map<string, any[]>();
    for (const row of expiring) {
      const tid = row.tenant_id;
      if (!byTenant.has(tid)) byTenant.set(tid, []);
      byTenant.get(tid)!.push(row);
    }

    let emailsSent = 0;

    for (const [tenantId, rows] of byTenant) {
      // Get tenant info
      const tenants = await sb(`tenants?id=eq.${tenantId}&select=id,slug,name`).catch(() => []);
      const tenant = Array.isArray(tenants) ? tenants[0] : null;
      if (!tenant) continue;

      // Get admin users for this tenant
      const admins: any[] = await sb(
        `tenant_users?tenant_id=eq.${tenantId}&role=in.(admin,super_admin)&select=id,email,full_name`
      ).catch(() => []);

      if (!admins || admins.length === 0) continue;

      // Build prospect list for email
      const EIGHTEEN_MONTHS_MS = 18 * 30.44 * 24 * 3600 * 1000;
      const prospects = rows.map((r: any) => {
        const capturedMs = new Date(r.captured_at).getTime();
        const expiresMs = capturedMs + EIGHTEEN_MONTHS_MS;
        const daysRemaining = Math.max(0, Math.round((expiresMs - Date.now()) / 86400000));
        return {
          identifier: r.prospect_identifier || "unknown",
          consentDate: new Date(r.captured_at).toLocaleDateString("en-US"),
          daysRemaining,
        };
      });

      const origin = process.env.APP_URL || "https://atom-dominator-pro.vercel.app";
      const consentLedgerUrl = `${origin}/#/admin/consent`;

      // Send email to each admin
      for (const admin of admins) {
        if (!admin.email) continue;
        try {
          await sendEmail("consent-expiring", admin.email, {
            adminName: admin.full_name?.split(/\s+/)[0] || "Admin",
            tenantName: tenant.name || tenant.slug,
            expiringCount: rows.length,
            prospects,
            consentLedgerUrl,
          }, {
            tenantId,
            userId: admin.id,
          });
          emailsSent++;
        } catch (e: any) {
          console.warn(`[consent-renewals] email to ${admin.email} failed:`, e?.message);
        }
      }

      // Log to compliance_audit_log
      try {
        await sb("compliance_audit_log", {
          method: "POST",
          body: JSON.stringify({
            tenant_id: tenantId,
            action: "consent_renewal_alert",
            details: { expiring_count: rows.length, admins_notified: admins.length },
            completed_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" } as any,
        });
      } catch { /* best-effort */ }
    }

    return res.status(200).json({
      ok: true,
      emailsSent,
      tenantsAlerted: byTenant.size,
      totalExpiring: expiring.length,
    });
  } catch (err: any) {
    console.error("[consent-renewals]", err?.message);
    return res.status(500).json({ error: err?.message || "consent-renewals failed" });
  }
}
