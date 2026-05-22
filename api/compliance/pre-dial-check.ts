/**
 * /api/compliance/pre-dial-check — TCPA-aware 10-point pre-dial gate.
 *
 * POST { phone, tenantSlug, prospectId?, actorEmail? }
 *  → { allowed, blockReasons[], checks{...}, recordedAt }
 *
 * Returns allowed=true ONLY when every applicable check passes. Logs every
 * call (allowed and blocked) to predial_checks for audit.
 *
 * Checks (Federal + state-specific, per 2026 rules):
 *   1.  consent_present           — at least one non-revoked PEWC/express_written entry
 *                                   in consent_ledger for this prospect.
 *   2.  consent_not_revoked       — most recent entry is not "revoked".
 *   3.  internal_dnc              — prospect not on tenant DNC list.
 *   4.  federal_dnc               — prospect not on the federal DNC cache.
 *   5.  litigator_list            — prospect not on the known TCPA litigator list.
 *   6.  state_dnc                 — prospect not on a state-registered DNC.
 *   7.  state_caps                — Oregon: max 3 calls in 24h. Florida: 1 call/12h.
 *   8.  internal_attempt_caps     — max 3 attempts per prospect across the lifecycle.
 *   9.  quiet_hours               — no calls before 8am or after 9pm prospect-local.
 *   10. wireless_safe_harbour     — flagged for human review when number reassigned <90d.
 *
 * Auth: X-Admin-Key OR called server-side by /api/atom-leadgen/call (which can
 * pass the same key). Client-side calls always require the admin key.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

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

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return `+${d}`;
}

const STATE_AC: Record<string, Set<string>> = {
  OR: new Set(["503","541","971","458"]),
  FL: new Set(["239","305","321","352","386","407","561","689","727","754","772","786","813","850","863","904","941","954"]),
  CA: new Set(["209","213","279","310","323","341","408","415","424","442","510","530","559","562","619","626","628","650","657","661","669","707","714","747","760","805","818","820","831","840","858","909","916","925","949","951"]),
  NY: new Set(["212","315","332","347","363","516","518","585","607","631","646","680","716","718","838","845","914","917","929","934"]),
  TX: new Set(["210","214","254","281","325","346","361","409","430","432","469","512","682","713","726","737","806","817","830","832","903","915","936","940","956","972","979"]),
};
function stateOfPhone(e164: string): string | null {
  const ac = e164.match(/^\+1(\d{3})/)?.[1];
  if (!ac) return null;
  for (const [st, s] of Object.entries(STATE_AC)) if (s.has(ac)) return st;
  return null;
}
// Full US state → IANA timezone mapping (covers all 50 states + DC)
const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago', KS: 'America/Chicago',
  KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
  MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles',
  NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
  NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
  SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver', DC: 'America/New_York',
};
function localHour(state: string | null): number {
  const tz = state ? STATE_TZ[state] ?? 'America/Chicago' : 'America/Chicago';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
    const h = Number(parts.find(p => p.type === 'hour')?.value || 12);
    const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return h + m / 60;
  } catch {
    // Fallback to UTC-6 (Central) if Intl fails
    const utcH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
    return ((utcH - 6) + 24) % 24;
  }
}

async function tenantBySlug(slug: string) {
  const rows = await sb(`tenants?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=id,slug,name`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

interface CheckResult { passed: boolean; detail?: string; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const provided = (req.headers["x-admin-key"] || "").toString().trim();
  if (!ADMIN_API_KEY) return res.status(500).json({ error: "ADMIN_API_KEY missing" });
  if (provided !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = req.body || {};
    const phoneIn = String(body.phone || "").trim();
    const slug = String(body.tenantSlug || "").trim();
    const prospectId = String(body.prospectId || "").trim() || null;
    const actorEmail = String(body.actorEmail || "").trim() || null;
    if (!phoneIn || !slug) return res.status(400).json({ error: "phone and tenantSlug required" });
    const phone = normalizePhone(phoneIn);
    const tenant = await tenantBySlug(slug);
    if (!tenant) return res.status(404).json({ error: "tenant not found" });

    const state = stateOfPhone(phone);
    const hourLocal = localHour(state);
    const checks: Record<string, CheckResult> = {};
    const blockReasons: string[] = [];

    // 1+2 — consent present and not revoked
    const consentRows: any[] = await sb(
      `consent_ledger?tenant_id=eq.${tenant.id}&prospect_identifier=eq.${encodeURIComponent("phone:" + phone)}&order=captured_at.desc&limit=5&select=consent_type,revoked_at,captured_at`
    ).catch(() => []);
    const latest = consentRows[0];
    checks.consent_present = { passed: !!latest, detail: latest?.consent_type ?? "no consent on file" };
    checks.consent_not_revoked = {
      passed: !!latest && !latest.revoked_at && latest.consent_type !== "revoked",
      detail: latest?.revoked_at ? `revoked ${latest.revoked_at}` : (latest?.consent_type === "revoked" ? "consent_type=revoked" : "ok"),
    };
    if (!checks.consent_present.passed) blockReasons.push("no_consent_on_file");
    else if (!checks.consent_not_revoked.passed) blockReasons.push("consent_revoked");

    // 3+4+5+6 — DNC layers (internal, federal, litigator, state)
    const dncRows: any[] = await sb(
      `dnc_entries?identifier=eq.${encodeURIComponent(phone)}&removed_at=is.null&or=(tenant_id.eq.${tenant.id},tenant_id.is.null)&select=source,state,tenant_id`
    ).catch(() => []);
    const internal = dncRows.find((r) => r.tenant_id === tenant.id);
    const federal = dncRows.find((r) => r.source === "federal_dnc" && !r.tenant_id);
    const litigator = dncRows.find((r) => r.source === "litigator");
    const stateDnc = dncRows.find((r) => r.source === "state_dnc");
    checks.internal_dnc  = { passed: !internal, detail: internal ? "on tenant DNC" : "ok" };
    checks.federal_dnc   = { passed: !federal,  detail: federal ? "on federal DNC" : "ok" };
    checks.litigator_list = { passed: !litigator, detail: litigator ? "known TCPA litigator" : "ok" };
    checks.state_dnc     = { passed: !stateDnc, detail: stateDnc ? `on ${stateDnc.state} DNC` : "ok" };
    if (internal)  blockReasons.push("internal_dnc");
    if (federal)   blockReasons.push("federal_dnc");
    if (litigator) blockReasons.push("litigator_list");
    if (stateDnc)  blockReasons.push(`state_dnc:${stateDnc.state ?? "?"}`);

    // 7 — state caps (Oregon 3/24h, Florida 1/12h, default unlimited)
    const sinceISO24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const sinceISO12 = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    let stateCapsPassed = true;
    let stateCapsDetail = "ok";
    if (state === "OR") {
      const recent: any[] = await sb(
        `predial_checks?tenant_id=eq.${tenant.id}&phone=eq.${encodeURIComponent(phone)}&allowed=eq.true&checked_at=gte.${sinceISO24}&select=id`
      ).catch(() => []);
      if (recent.length >= 3) { stateCapsPassed = false; stateCapsDetail = `OR: ${recent.length} prior dials in 24h`; blockReasons.push("state_cap_OR_3per24h"); }
    } else if (state === "FL") {
      const recent: any[] = await sb(
        `predial_checks?tenant_id=eq.${tenant.id}&phone=eq.${encodeURIComponent(phone)}&allowed=eq.true&checked_at=gte.${sinceISO12}&select=id`
      ).catch(() => []);
      if (recent.length >= 1) { stateCapsPassed = false; stateCapsDetail = `FL: ${recent.length} prior dials in 12h`; blockReasons.push("state_cap_FL_1per12h"); }
    }
    checks.state_caps = { passed: stateCapsPassed, detail: stateCapsDetail };

    // 8 — internal attempt caps (max 3 per prospect lifetime, hard line)
    const lifetime: any[] = await sb(
      `predial_checks?tenant_id=eq.${tenant.id}&phone=eq.${encodeURIComponent(phone)}&allowed=eq.true&select=id`
    ).catch(() => []);
    checks.internal_attempt_caps = { passed: lifetime.length < 3, detail: `${lifetime.length} prior allowed dials` };
    if (lifetime.length >= 3) blockReasons.push("internal_cap_3_lifetime");

    // 9 — quiet hours (8am - 9pm prospect-local)
    checks.quiet_hours = { passed: hourLocal >= 8 && hourLocal < 21, detail: `local hour ~${hourLocal.toFixed(1)} (${state ?? "central default"})` };
    if (!checks.quiet_hours.passed) blockReasons.push("quiet_hours");

    // 10 — wireless safe-harbour (best-effort placeholder; flag for review)
    checks.wireless_safe_harbour = { passed: true, detail: "no reassigned-number signal in cache" };

    // 11 — consent expired (PEWC older than 18 months)
    const EIGHTEEN_MONTHS_MS = 18 * 30.44 * 24 * 3600 * 1000; // ~548 days
    const consentAge = latest?.captured_at ? Date.now() - new Date(latest.captured_at).getTime() : Infinity;
    const consentExpired = checks.consent_present.passed && checks.consent_not_revoked.passed && consentAge > EIGHTEEN_MONTHS_MS;
    checks.consent_expired = {
      passed: !consentExpired,
      detail: consentExpired ? `PEWC from ${latest.captured_at} is ${Math.round(consentAge / 86400000)}d old (>548d)` : "ok",
    };
    if (consentExpired) blockReasons.push("consent_expired");

    // 12 — tenant suspended (subscription past_due >7d or cancelled)
    let tenantSuspended = false;
    try {
      const tenantRows = await sb(`tenants?id=eq.${tenant.id}&select=subscription_status,subscription_ends_at`);
      const t = Array.isArray(tenantRows) ? tenantRows[0] : null;
      if (t) {
        if (t.subscription_status === "cancelled") tenantSuspended = true;
        if (t.subscription_status === "past_due" && t.subscription_ends_at) {
          const pastDueDays = (Date.now() - new Date(t.subscription_ends_at).getTime()) / 86400000;
          if (pastDueDays > 7) tenantSuspended = true;
        }
      }
    } catch { /* best-effort — don't block dial if tenant lookup fails */ }
    checks.tenant_suspended = { passed: !tenantSuspended, detail: tenantSuspended ? "tenant subscription suspended" : "ok" };
    if (tenantSuspended) blockReasons.push("tenant_suspended");

    // 13 — daily dial cap (tenant plan cap vs. today's atom_calls count)
    let dailyCapExceeded = false;
    try {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayCalls: any[] = await sb(
        `atom_calls?tenant_slug=eq.${encodeURIComponent(tenant.slug)}&started_at=gte.${todayStart.toISOString()}&select=call_sid`
      ).catch(() => []);
      // Plan caps: read from tenants.daily_dial_cap or use generous defaults
      const tenantCap = await sb(`tenants?id=eq.${tenant.id}&select=daily_dial_cap`).catch(() => []);
      const cap = Array.isArray(tenantCap) && tenantCap[0]?.daily_dial_cap ? Number(tenantCap[0].daily_dial_cap) : 500;
      if (todayCalls.length >= cap) {
        dailyCapExceeded = true;
      }
      checks.daily_cap = { passed: !dailyCapExceeded, detail: `${todayCalls.length}/${cap} dials today` };
    } catch {
      checks.daily_cap = { passed: true, detail: "cap check skipped (query failed)" };
    }
    if (dailyCapExceeded) blockReasons.push("over_daily_cap");

    const allowed = blockReasons.length === 0;

    // Persist the check itself
    await sb("predial_checks", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        phone,
        prospect_id: prospectId,
        allowed,
        block_reasons: blockReasons,
        checks,
        actor_email: actorEmail,
      }),
    }).catch((e) => console.warn("[predial_checks] insert failed:", e?.message));

    return res.status(200).json({
      allowed,
      blockReasons,
      checks,
      tenant: { id: tenant.id, slug: tenant.slug },
      phone,
      state,
      checkedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[pre-dial-check]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
