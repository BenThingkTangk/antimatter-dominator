/**
 * Whitelisted autonomous actions. EXACTLY THREE are permitted:
 *   1. resend_verification  — re-send the email verification link
 *   2. restart_campaign     — restart a stuck campaign job
 *   3. regenerate_api_key   — rotate the tenant API key (shown once)
 *
 * Security model (enforced here, not in the prompt):
 *   - Default DB access is read-only; writes happen only inside these functions.
 *   - Caller MUST be authenticated (resolved session) — no anon writes.
 *   - Tenant/user authorization is verified against the resolved session.
 *   - Every attempt is written to support_action_log (audit).
 *   - Actions are gated by ATOM_SUPPORT_ENABLE_ACTIONS=true.
 *   - Ambiguous / cross-tenant / unauthorized → denied + escalate upstream.
 */
import crypto from "crypto";
import { sb, sbInsert, supabaseConfigured } from "./supabase.js";
import { audit } from "./audit.js";
import type { ResolvedSession } from "./auth.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const ACTIONS_ENABLED = clean(process.env.ATOM_SUPPORT_ENABLE_ACTIONS).toLowerCase() === "true";
const APP_URL = clean(process.env.APP_URL) || clean(process.env.PUBLIC_APP_URL) || "https://app.atomdominator.com";

export type ActionId = "resend_verification" | "restart_campaign" | "regenerate_api_key";
export const ACTION_IDS: ActionId[] = ["resend_verification", "restart_campaign", "regenerate_api_key"];

export interface ActionResult {
  ok: boolean;
  action: ActionId;
  message: string;
  data?: Record<string, any>;
  denied?: boolean;
}

/** Metadata for the UI: which actions exist, whether enabled, confirm-required. */
export function actionCatalog() {
  return {
    enabled: ACTIONS_ENABLED,
    actions: [
      { id: "resend_verification", label: "Resend verification email", confirm: false, destructive: false },
      { id: "restart_campaign", label: "Restart a stuck campaign", confirm: true, destructive: false },
      { id: "regenerate_api_key", label: "Regenerate API key", confirm: true, destructive: true },
    ],
  };
}

function guard(session: ResolvedSession, action: ActionId): ActionResult | null {
  if (!ACTIONS_ENABLED) {
    return { ok: false, action, denied: true, message: "Automated actions are disabled on this deployment." };
  }
  if (!session.authenticated || !session.userId || !session.tenantId) {
    return { ok: false, action, denied: true, message: "You must be signed in for me to do that." };
  }
  if (!supabaseConfigured()) {
    return { ok: false, action, denied: true, message: "Action backend is not configured." };
  }
  return null;
}

// ─── 1. Resend verification email ────────────────────────────────────────────
async function resendVerification(session: ResolvedSession): Promise<ActionResult> {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Store the token against the user (best-effort — column may be optional).
  try {
    await sb(`tenant_users?id=eq.${session.userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ email_verification_token: token, email_verification_expires: expires }),
    });
  } catch {
    // If the column doesn't exist we still send a link; verification is idempotent.
  }

  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  let sent = false;
  // Send the verification link via Resend directly. The platform's templated
  // sendEmail() has no "verify" template, so we use the raw transport guarded
  // by RESEND_API_KEY — clean live-vs-mock boundary: no key → logged, not sent.
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  if (resendKey && session.email) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: (process.env.RESEND_FROM || "").trim() || "ATOM <hello@atomsalesdominator.com>",
        to: [session.email],
        subject: "Verify your ATOM email",
        html: `<p>Hi ${session.fullName || "there"},</p><p>Confirm your email to finish setup:</p><p><a href="${verifyUrl}">Verify email</a></p>`,
      });
      sent = true;
    } catch (e: any) {
      console.warn("[support action] resendVerification email failed:", e?.message);
    }
  } else {
    console.warn("[support action] resendVerification: RESEND_API_KEY not configured — link not emailed");
  }

  await audit({
    action: "resend_verification",
    tenantId: session.tenantId,
    tenantSlug: session.tenantSlug,
    userId: session.userId,
    actorEmail: session.email,
    resource: `email:${session.email}`,
    result: sent ? "ok" : "error",
    reason: sent ? undefined : "email_transport_failed",
  });

  return {
    ok: sent,
    action: "resend_verification",
    message: sent
      ? `I've re-sent a verification email to ${session.email}. Check your inbox (and spam).`
      : "I prepared a new verification link but the email couldn't be sent right now — I've logged it for our team.",
  };
}

// ─── 2. Restart a stuck campaign job ─────────────────────────────────────────
async function restartCampaign(session: ResolvedSession, args: { campaignId?: string }): Promise<ActionResult> {
  if (!args.campaignId) {
    return { ok: false, action: "restart_campaign", denied: true, message: "Which campaign? Please pick the campaign to restart." };
  }

  // Authorization: campaign MUST belong to the caller's tenant.
  let campaign: any = null;
  try {
    const rows = await sb(
      `campaigns?id=eq.${encodeURIComponent(args.campaignId)}&tenant_id=eq.${session.tenantId}&select=id,name,status`,
    );
    campaign = Array.isArray(rows) ? rows[0] : null;
  } catch {
    /* fallthrough to not-found */
  }

  if (!campaign) {
    await audit({
      action: "restart_campaign", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
      userId: session.userId, actorEmail: session.email, resource: `campaign:${args.campaignId}`,
      result: "denied", reason: "not_found_or_cross_tenant",
    });
    return { ok: false, action: "restart_campaign", denied: true, message: "I couldn't find that campaign on your account." };
  }

  // Only restart campaigns that look genuinely stuck — otherwise escalate to avoid
  // disrupting an in-flight run.
  const stuckStates = ["error", "failed", "stuck", "stalled", "scoring", "enriching"];
  if (!stuckStates.includes(String(campaign.status || "").toLowerCase())) {
    await audit({
      action: "restart_campaign", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
      userId: session.userId, actorEmail: session.email, resource: `campaign:${campaign.id}`,
      result: "escalated", reason: `not_stuck:${campaign.status}`,
    });
    return {
      ok: false, action: "restart_campaign", denied: true,
      message: `Campaign "${campaign.name}" is currently "${campaign.status}", which doesn't look stuck. To avoid disrupting it I've flagged this for a human to review.`,
    };
  }

  try {
    await sb(`campaigns?id=eq.${campaign.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "draft", updated_at: new Date().toISOString() }),
    });
  } catch (e: any) {
    await audit({
      action: "restart_campaign", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
      userId: session.userId, actorEmail: session.email, resource: `campaign:${campaign.id}`,
      result: "error", reason: e?.message,
    });
    return { ok: false, action: "restart_campaign", message: "I hit an error restarting that campaign and logged it for our team." };
  }

  await audit({
    action: "restart_campaign", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
    userId: session.userId, actorEmail: session.email, resource: `campaign:${campaign.id}`,
    result: "ok", reason: `from:${campaign.status}`,
  });
  return {
    ok: true, action: "restart_campaign",
    message: `Done — I reset "${campaign.name}" so it can re-run. It'll move back through scoring shortly.`,
    data: { campaignId: campaign.id },
  };
}

// ─── 3. Regenerate API key (shown once) ──────────────────────────────────────
async function regenerateApiKey(session: ResolvedSession): Promise<ActionResult> {
  const plaintext = `atom_sk_${crypto.randomBytes(24).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(0, 12);

  // We store ONLY the hash + prefix; the plaintext is returned once, never persisted.
  //
  // Order is security-critical: persist (insert) the NEW key FIRST and verify the
  // insert actually succeeded before revoking the old one. sbInsert swallows REST
  // errors and returns null, so a try/catch alone is insufficient — we must check
  // the returned row. If persistence fails we leave the existing key intact so the
  // tenant is never left with no working key.
  let inserted: any = null;
  try {
    inserted = await sbInsert("tenant_api_keys", {
      tenant_id: session.tenantId,
      key_hash: hash,
      key_prefix: prefix,
      created_by: session.userId,
    });
  } catch (e: any) {
    inserted = null;
    console.warn("[support action] regenerateApiKey insert threw:", e?.message);
  }

  // sbInsert returns the inserted row (return=representation) on success, or null
  // on any failure. Require a persisted row with an id before proceeding.
  if (!inserted || !inserted.id) {
    await audit({
      action: "regenerate_api_key", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
      userId: session.userId, actorEmail: session.email, resource: `tenant:${session.tenantId}`,
      result: "error", reason: "new_key_persist_failed",
    });
    return {
      ok: false, action: "regenerate_api_key",
      message: "I couldn't rotate the API key right now and logged it for our team. Your existing key is unchanged.",
    };
  }

  // New key is safely persisted — only now is it safe to revoke prior active keys.
  // Exclude the row we just inserted so a transient clock/filter overlap can't
  // revoke the brand-new key.
  try {
    await sb(`tenant_api_keys?tenant_id=eq.${session.tenantId}&revoked_at=is.null&id=neq.${encodeURIComponent(inserted.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    });
  } catch (e: any) {
    // The new key is live and returned to the user. Failing to revoke the old key
    // is a non-fatal degradation: log/audit it but do not claim failure, since the
    // rotation (new key issuance) did succeed.
    await audit({
      action: "regenerate_api_key", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
      userId: session.userId, actorEmail: session.email, resource: `tenant:${session.tenantId}`,
      result: "error", reason: `old_key_revoke_failed:${e?.message}`,
      payload: { prefix },
    });
  }

  await audit({
    action: "regenerate_api_key", tenantId: session.tenantId, tenantSlug: session.tenantSlug,
    userId: session.userId, actorEmail: session.email, resource: `tenant:${session.tenantId}`,
    result: "ok", reason: "rotated",
    payload: { prefix }, // prefix only — never the secret
  });

  return {
    ok: true, action: "regenerate_api_key",
    message: "Here is your new API key. Copy it now — for security I can only show it once.",
    data: { apiKey: plaintext, prefix, shownOnce: true },
  };
}

export async function runAction(
  action: ActionId,
  session: ResolvedSession,
  args: Record<string, any> = {},
): Promise<ActionResult> {
  if (!ACTION_IDS.includes(action)) {
    return { ok: false, action, denied: true, message: "That action isn't available." };
  }
  const blocked = guard(session, action);
  if (blocked) {
    await audit({
      action, tenantId: session.tenantId, tenantSlug: session.tenantSlug, userId: session.userId,
      actorEmail: session.email, result: "denied", reason: blocked.message,
    });
    return blocked;
  }
  switch (action) {
    case "resend_verification": return resendVerification(session);
    case "restart_campaign": return restartCampaign(session, args);
    case "regenerate_api_key": return regenerateApiKey(session);
  }
}
