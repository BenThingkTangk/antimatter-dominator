/**
 * Centralized email dispatcher — single Resend call site for the entire app.
 *
 * Usage:
 *   import { sendEmail } from "../_lib/send-email";
 *   await sendEmail("welcome", "user@example.com", { fullName: "...", ... });
 *
 * All 8 templates live in ./email-templates.ts (a single module — see the
 * note there for the Vercel ESM reason) and are rendered server-side via
 * @react-email/render. Resend SDK is used for delivery; email_log is written
 * to Supabase for delivery tracking.
 */
import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import {
  WelcomeEmail, welcomeSubject,
  InviteEmail, inviteSubject,
  PasswordResetEmail, passwordResetSubject,
  TrialExpiringEmail, trialExpiringSubject,
  SubscriptionCreatedEmail, subscriptionCreatedSubject,
  SubscriptionChangedEmail, subscriptionChangedSubject,
  PaymentFailedEmail, paymentFailedSubject,
  ConsentExpiringEmail, consentExpiringSubject,
} from "./email-templates.js";
import type {
  WelcomeArgs,
  InviteArgs,
  PasswordResetArgs,
  TrialExpiringArgs,
  SubscriptionCreatedArgs,
  SubscriptionChangedArgs,
  PaymentFailedArgs,
  ConsentExpiringArgs,
} from "./email-templates.js";

// ─── Template registry ──────────────────────────────────────────────────────

interface TemplateEntry<T> {
  component: (args: T) => React.ReactElement;
  subject: (args: T) => string;
}

type TemplateMap = {
  welcome: WelcomeArgs;
  invite: InviteArgs;
  "password-reset": PasswordResetArgs;
  "trial-expiring": TrialExpiringArgs;
  "subscription-created": SubscriptionCreatedArgs;
  "subscription-changed": SubscriptionChangedArgs;
  "payment-failed": PaymentFailedArgs;
  "consent-expiring": ConsentExpiringArgs;
};

const TEMPLATES: { [K in keyof TemplateMap]: TemplateEntry<TemplateMap[K]> } = {
  welcome: { component: WelcomeEmail as any, subject: welcomeSubject },
  invite: { component: InviteEmail as any, subject: inviteSubject },
  "password-reset": { component: PasswordResetEmail as any, subject: passwordResetSubject },
  "trial-expiring": { component: TrialExpiringEmail as any, subject: trialExpiringSubject },
  "subscription-created": { component: SubscriptionCreatedEmail as any, subject: subscriptionCreatedSubject },
  "subscription-changed": { component: SubscriptionChangedEmail as any, subject: subscriptionChangedSubject },
  "payment-failed": { component: PaymentFailedEmail as any, subject: paymentFailedSubject },
  "consent-expiring": { component: ConsentExpiringEmail as any, subject: consentExpiringSubject },
};

// ─── Env ────────────────────────────────────────────────────────────────────

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
const RESEND_FROM = clean(process.env.RESEND_FROM) || "ATOM <hello@atomsalesdominator.com>";
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Supabase REST helper (inlined per Vercel nft) ──────────────────────────

async function sbInsert(table: string, row: Record<string, any>): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch {
    // email_log insert is best-effort — never block email delivery
  }
}

// ─── Outreach proof linkage (opt-in) ─────────────────────────────────────────

/**
 * Stable linkage context for a GENUINE outreach send. When (and only when) a
 * caller passes this, the Resend message is tagged with the exact tag names the
 * Resend delivery webhook (api/webhooks/resend.ts) extracts, so a delivered
 * `email.delivered` event forwards to ATOM Content as an `email_sent` proof
 * event carrying prospect/campaign/account/tenant/user attribution.
 *
 * Contract (DO NOT rename without updating api/webhooks/resend.ts tagValue()):
 *   prospect_id, campaign_id, account_id, tenant_id, user_id
 *
 * This is OPT-IN. Transactional/lifecycle sends (welcome, invite, billing,
 * trial/consent) must NOT pass it — a delivered transactional email must never
 * become campaign `email_sent` proof just because it was delivered.
 *
 * All values are coerced to strings; only defined, non-empty fields are emitted
 * (Resend tags must be strings; empty linkage is never fabricated). These are
 * provider-side metadata only — never returned to a caller or sent client-side.
 */
export interface OutreachProofLinkage {
  prospectId?: string | number;
  campaignId?: string | number;
  accountId?: string | number;
  tenantId?: string | number;
  userId?: string | number;
}

/** Resend tag — `{ name, value }`, both strings (Resend constraint). */
export interface ResendTag {
  name: string;
  value: string;
}

// Map of linkage field → the exact Resend tag name the webhook extracts.
const OUTREACH_TAG_NAMES: { [K in keyof OutreachProofLinkage]-?: string } = {
  prospectId: "prospect_id",
  campaignId: "campaign_id",
  accountId: "account_id",
  tenantId: "tenant_id",
  userId: "user_id",
};

/**
 * Build the Resend `{ name, value }[]` proof tags from a linkage object.
 * Only defined, non-empty fields are included; values are stringified and
 * trimmed. Returns `[]` when nothing is linkable so callers never emit blanks.
 * Exported so genuine outreach senders (and tests) share one exact contract.
 */
export function buildOutreachProofTags(linkage: OutreachProofLinkage | undefined): ResendTag[] {
  if (!linkage) return [];
  const tags: ResendTag[] = [];
  for (const field of Object.keys(OUTREACH_TAG_NAMES) as (keyof OutreachProofLinkage)[]) {
    const raw = linkage[field];
    if (raw === undefined || raw === null) continue;
    const value = String(raw).trim();
    if (!value) continue;
    tags.push({ name: OUTREACH_TAG_NAMES[field], value });
  }
  return tags;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface SendEmailResult {
  id: string;
  sent: boolean;
  reason?: string;
}

export async function sendEmail<T extends keyof TemplateMap>(
  template: T,
  to: string,
  args: TemplateMap[T],
  options?: {
    tenantId?: string;
    userId?: string;
    subject?: string;
    /**
     * OPT-IN. Set ONLY for genuine outreach sends. Emits the proof-linkage
     * Resend tags (prospect_id/campaign_id/account_id/tenant_id/user_id) so a
     * delivered event becomes an attributed ATOM Content `email_sent` proof.
     * Omit for transactional/lifecycle sends — they must not be tagged.
     */
    outreachProof?: OutreachProofLinkage;
  },
): Promise<SendEmailResult> {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping ${template} to ${to}`);
    return { id: "noop", sent: false, reason: "no_api_key" };
  }

  const entry = TEMPLATES[template];
  if (!entry) {
    console.error(`[email] Unknown template: ${template}`);
    return { id: "noop", sent: false, reason: "unknown_template" };
  }

  const subjectLine = options?.subject || entry.subject(args as any);
  const element = React.createElement(entry.component as any, args as any);

  let html: string;
  try {
    html = await render(element);
  } catch (err: any) {
    console.error(`[email] render failed for ${template}:`, err?.message);
    return { id: "noop", sent: false, reason: `render_error: ${err?.message}` };
  }

  // Proof-linkage tags are emitted ONLY when the caller opted in via
  // options.outreachProof. The `template` tag is always present; proof tags are
  // appended so the Resend webhook can attribute the delivered event.
  const tags: ResendTag[] = [
    { name: "template", value: template },
    ...buildOutreachProofTags(options?.outreachProof),
  ];

  try {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject: subjectLine,
      html,
      tags,
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@atomsalesdominator.com>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-Ref-ID": `atom-${template}-${Date.now()}`,
      },
    });

    const resendId = result.data?.id || "";

    // Log to email_log (best-effort, fire-and-forget)
    sbInsert("email_log", {
      tenant_id: options?.tenantId || null,
      user_id: options?.userId || null,
      template,
      to_address: to,
      subject: subjectLine,
      resend_id: resendId,
    }).catch(() => {});

    return { id: resendId, sent: true };
  } catch (err: any) {
    console.error(`[email] Resend send failed for ${template}:`, err?.message);
    return { id: "noop", sent: false, reason: err?.message || "send_failed" };
  }
}
