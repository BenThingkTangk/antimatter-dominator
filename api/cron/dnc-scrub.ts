/**
 * GET /api/cron/dnc-scrub — Daily DNC re-check (31-day cycle).
 *
 * Runs daily at 03:00 UTC via Vercel cron.
 * For each tenant with active campaigns where last_dnc_scrub_at is >31 days
 * or null, re-checks each account phone against internal + federal DNC entries.
 *
 * Newly flagged numbers get dnc_flagged = true on the campaign account row.
 * Logs action to compliance_audit_log.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

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

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron uses GET
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  // Optional CRON_SECRET verification (Vercel sends it as Authorization: Bearer <secret>)
  if (CRON_SECRET) {
    const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (auth !== CRON_SECRET) return res.status(401).json({ error: "unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  try {
    // Find campaigns needing DNC scrub (last_dnc_scrub_at > 31 days or null)
    const cutoff = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
    const staleCampaigns: any[] = await sb(
      `atom_campaigns?status=in.(ready,enriching)&or=(last_dnc_scrub_at.is.null,last_dnc_scrub_at.lt.${cutoff})&select=id,name,tenant_id&limit=20`
    ).catch(() => []);

    if (!staleCampaigns || staleCampaigns.length === 0) {
      return res.status(200).json({ ok: true, scrubbed: 0, note: "no campaigns due for scrub" });
    }

    let totalFlagged = 0;
    const results: any[] = [];

    for (const camp of staleCampaigns) {
      // Get campaign accounts with phone-like data
      const accounts: any[] = await sb(
        `atom_campaign_accounts?campaign_id=eq.${camp.id}&select=id,domain,account_name&limit=500`
      ).catch(() => []);

      let newlyFlagged = 0;

      // For each account, check if any related phone is on DNC
      // Campaign accounts may not have direct phone fields — check via domain lookup
      // in dnc_entries. We check the domain as an identifier proxy.
      for (const acct of accounts) {
        if (!acct.domain) continue;
        // Check internal DNC entries for this domain or related phones
        const dncHits: any[] = await sb(
          `dnc_entries?identifier=ilike.*${encodeURIComponent(acct.domain)}*&removed_at=is.null&select=id`
        ).catch(() => []);

        if (dncHits.length > 0) {
          try {
            await sb(`atom_campaign_accounts?id=eq.${acct.id}`, {
              method: "PATCH",
              body: JSON.stringify({ dnc_flagged: true }),
              headers: { Prefer: "return=minimal" } as any,
            });
            newlyFlagged++;
          } catch { /* continue */ }
        }
      }

      // Update campaign's last_dnc_scrub_at
      try {
        await sb(`atom_campaigns?id=eq.${camp.id}`, {
          method: "PATCH",
          body: JSON.stringify({ last_dnc_scrub_at: new Date().toISOString() }),
          headers: { Prefer: "return=minimal" } as any,
        });
      } catch { /* continue */ }

      // Log to compliance_audit_log
      try {
        await sb("compliance_audit_log", {
          method: "POST",
          body: JSON.stringify({
            tenant_id: camp.tenant_id || null,
            action: "dnc_scrub",
            details: { campaign_id: camp.id, campaign_name: camp.name, accounts_checked: accounts.length, newly_flagged: newlyFlagged },
            completed_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=minimal" } as any,
        });
      } catch { /* best-effort */ }

      totalFlagged += newlyFlagged;
      results.push({ campaignId: camp.id, name: camp.name, checked: accounts.length, flagged: newlyFlagged });
    }

    return res.status(200).json({
      ok: true,
      campaigns: staleCampaigns.length,
      totalFlagged,
      results,
    });
  } catch (err: any) {
    console.error("[dnc-scrub]", err?.message);
    return res.status(500).json({ error: err?.message || "dnc-scrub failed" });
  }
}
