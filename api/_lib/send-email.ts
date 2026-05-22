/**
 * Centralized email dispatcher — single Resend call site for the entire app.
 *
 * Usage:
 *   import { sendEmail } from "../_lib/send-email";
 *   await sendEmail("welcome", "user@example.com", { fullName: "...", ... });
 *
 * All 7 templates live in ./email-templates/ and are rendered server-side
 * via @react-email/render. Resend SDK is used for delivery; email_log is
 * written to Supabase for delivery tracking.
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
} from "./email-templates";
import type { WelcomeArgs } from "./email-templates";
import type { InviteArgs } from "./email-templates";
import type { PasswordResetArgs } from "./email-templates";
import type { TrialExpiringArgs } from "./email-templates";
import type { SubscriptionCreatedArgs } from "./email-templates";
import type { SubscriptionChangedArgs } from "./email-templates";
import type { PaymentFailedArgs } from "./email-templates";
import type { ConsentExpiringArgs } from "./email-templates";

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
  options?: { tenantId?: string; userId?: string; subject?: string },
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

  try {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject: subjectLine,
      html,
      tags: [{ name: "template", value: template }],
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
