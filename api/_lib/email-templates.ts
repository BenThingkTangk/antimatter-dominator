/**
 * ΔTOM email templates — single consolidated module (NO JSX, by design).
 *
 * WHY ONE PLAIN-`.ts` FILE:
 *   @vercel/node compiles each function to native ESM (`"type":"module"`) and
 *   ships local modules as sibling files, emitting import specifiers verbatim.
 *   Native ESM requires a file extension on relative specifiers; nft (the file
 *   tracer) only emits a sibling when the specifier's resolved source matches.
 *   A multi-file `.tsx` barrel cannot satisfy both at once:
 *     - extensionless `./welcome`  → nft emits, runtime throws ERR_*_NOT_FOUND
 *     - `./welcome.js`             → runtime resolves, nft emits nothing (.tsx)
 *   The same contradiction bites a single `.tsx` module. The escape hatch is a
 *   plain `.ts` source (like send-email.ts itself): with a `.js` specifier nft
 *   emits `email-templates.js` AND native ESM loads it. `.ts` cannot contain
 *   JSX, so every element is built with React.createElement (aliased `h`).
 *
 * All 8 templates + the shared layout live here. Public API (named exports)
 * matches the previous barrel: <Name>Email components + <name>Subject builders.
 */
import {
  Html, Head, Body, Container, Section, Text, Link, Preview,
} from "@react-email/components";
import * as React from "react";

const h = React.createElement;

// ─── Brand tokens ─────────────────────────────────────────────────────────

const BG = "#08080c";
const CARD = "#0c1014";
const TEAL = "#00c8c8";
const TEXT_PRIMARY = "#e8e8ea";
const TEXT_MUTED = "#9a9aa3";
const FONT = "'Cabinet Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const APP_URL = process.env.APP_URL || "https://atom-dominator-pro.vercel.app";

const H1: React.CSSProperties = { margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT };
const BODY_MUTED: React.CSSProperties = { fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED };
const strong = (children: React.ReactNode, color = TEXT_PRIMARY) =>
  h("strong", { style: { color } }, children);

// ─── Shared layout primitives ───────────────────────────────────────────────

function AtomWordmark() {
  return h(
    "span",
    { style: { fontWeight: 800, fontSize: 18, letterSpacing: "0.06em", fontFamily: "monospace" } },
    h("span", { style: { color: TEXT_PRIMARY } }, "Δ"),
    h("span", { style: { color: TEXT_PRIMARY } }, "T"),
    h("span", { style: { color: TEAL } }, "O"),
    h("span", { style: { color: TEXT_PRIMARY } }, "M"),
  );
}

function AtomLogo() {
  return h(
    "table",
    { cellPadding: 0, cellSpacing: 0 },
    h(
      "tr",
      null,
      h(
        "td",
        { style: { verticalAlign: "middle", paddingRight: 10 } },
        h(
          "div",
          {
            style: {
              width: 32, height: 32, borderRadius: 8, background: TEAL,
              boxShadow: `0 0 18px ${TEAL}40`, textAlign: "center", color: BG,
              fontWeight: 800, lineHeight: "32px", fontSize: 14, fontFamily: "monospace",
            },
          },
          "Δ",
        ),
      ),
      h("td", { style: { verticalAlign: "middle" } }, h(AtomWordmark, null)),
    ),
  );
}

function CtaButton({ label, href }: { label: string; href: string }) {
  return h(
    "table",
    { cellPadding: 0, cellSpacing: 0, style: { margin: "0 auto" } },
    h(
      "tr",
      null,
      h(
        "td",
        { align: "center", style: { borderRadius: 999 } },
        h(
          "a",
          {
            href,
            style: {
              display: "inline-block", padding: "14px 28px", borderRadius: 999,
              background: TEAL, color: "#000", textDecoration: "none", fontWeight: 700,
              fontSize: 14, letterSpacing: "0.04em", boxShadow: `0 0 24px ${TEAL}40`, fontFamily: FONT,
            },
          },
          label,
        ),
      ),
    ),
  );
}

function PlainLink({ href }: { href: string }) {
  return h(
    Text,
    { style: { marginTop: 14, fontSize: 11, color: TEXT_MUTED, fontFamily: "monospace", wordBreak: "break-all", textAlign: "center" } },
    "Or paste this link: ",
    h(Link, { href, style: { color: TEAL, textDecoration: "none" } }, href),
  );
}

interface LayoutProps {
  preheader?: string;
  children?: React.ReactNode;
  footerText?: string;
  showUnsubscribe?: boolean;
}

function AtomEmailLayout({ preheader, children, footerText, showUnsubscribe }: LayoutProps) {
  return h(
    Html,
    { lang: "en" },
    h(Head, null),
    preheader ? h(Preview, null, preheader) : null,
    h(
      Body,
      { style: { margin: 0, padding: 0, background: BG, fontFamily: FONT } },
      h(
        Container,
        { style: { background: BG, padding: "32px 16px" } },
        h(
          Section,
          {
            style: {
              maxWidth: 560, margin: "0 auto", background: CARD,
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden",
            },
          },
          h(Section, { style: { padding: "28px 32px 8px 32px" } }, h(AtomLogo, null)),
          h(Section, { style: { padding: "18px 32px 28px 32px" } }, children),
        ),
        h(
          Section,
          { style: { maxWidth: 560, margin: "0 auto", padding: "14px 0 0 0" } },
          footerText
            ? h(Text, { style: { fontSize: 11, lineHeight: "1.6", color: TEXT_MUTED, textAlign: "center", fontFamily: FONT } }, footerText)
            : null,
          h(
            Text,
            { style: { fontSize: 10, color: TEXT_MUTED, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center" } },
            "Sent by ΔTOM · ATOM Sales Dominator · Nirmata Holdings",
          ),
          h(
            Text,
            { style: { fontSize: 10, color: TEXT_MUTED, textAlign: "center" } },
            "You're receiving this because you have an account on ΔTOM.",
            showUnsubscribe
              ? h(
                  React.Fragment,
                  null,
                  " ",
                  h(Link, { href: "mailto:unsubscribe@atomsalesdominator.com?subject=Unsubscribe", style: { color: TEAL, textDecoration: "underline" } }, "Unsubscribe"),
                )
              : null,
          ),
        ),
      ),
    ),
  );
}

// ─── Welcome ─────────────────────────────────────────────────────────────────

export interface WelcomeArgs {
  fullName: string;
  companyName: string;
  trialEndDate: string;
}

export function welcomeSubject(args: WelcomeArgs) {
  return `Welcome to ΔTOM, ${args.fullName} — your 14-day trial starts now`;
}

export function WelcomeEmail({ fullName, companyName, trialEndDate }: WelcomeArgs) {
  const firstName = fullName.split(" ")[0] || fullName;
  const ctaUrl = `${APP_URL}/#/pitch`;
  return h(
    AtomEmailLayout,
    {
      preheader: `${companyName} is live on ΔTOM. Your 14-day trial ends ${trialEndDate}.`,
      footerText: `Your trial ends ${trialEndDate}. Reply to this email any time with questions.`,
    },
    h(Text, { style: H1 }, "Welcome, ", firstName, "."),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 8px 0" } }, strong(companyName), " is now on ΔTOM."),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 16px 0" } },
      "Your ", strong("14-day free trial", TEAL), " is active and runs through ",
      strong(trialEndDate), ". No credit card required — cancel anytime.",
    ),
    h(Text, { style: { fontSize: 13, lineHeight: "1.6", color: TEXT_PRIMARY, fontWeight: 700, margin: "0 0 6px 0" } }, "Three things to do in the first 24 hours:"),
    h(
      "table",
      { cellPadding: 0, cellSpacing: 0, style: { fontSize: 13, lineHeight: "1.8", color: TEXT_MUTED, margin: "0 0 20px 0" } },
      h("tr", null, h("td", { style: { paddingRight: 8, color: TEAL, fontWeight: 700 } }, "1."), h("td", null, "Build your first WarBook — deep company research in 30 seconds")),
      h("tr", null, h("td", { style: { paddingRight: 8, color: TEAL, fontWeight: 700 } }, "2."), h("td", null, "Generate your first pitch — brutal, lethal call openers")),
      h("tr", null, h("td", { style: { paddingRight: 8, color: TEAL, fontWeight: 700 } }, "3."), h("td", null, "Run your first dial — ADAM, the AI voice agent, books meetings while you sleep")),
    ),
    h(CtaButton, { label: "Open ΔTOM →", href: ctaUrl }),
    h(PlainLink, { href: ctaUrl }),
  );
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export interface InviteArgs {
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}

export function inviteSubject(args: InviteArgs) {
  return `${args.inviterName} invited you to ${args.tenantName} on ΔTOM`;
}

export function InviteEmail({ inviterName, tenantName, role, acceptUrl, expiresAt }: InviteArgs) {
  return h(
    AtomEmailLayout,
    {
      preheader: `${inviterName} invited you to ${tenantName} on ΔTOM — accept your invite to get started.`,
      footerText: "If you weren't expecting this email, you can safely ignore it. Questions? Just reply to this message.",
    },
    h(Text, { style: H1 }, "You're invited to ", tenantName),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 8px 0" } },
      strong(inviterName), " invited you to join ", strong(tenantName),
      " on ΔTOM (ATOM Sales Dominator) as ", strong(role, TEAL), ".",
    ),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 20px 0" } },
      "Click the button below to accept your invite, set your password, and start running ATOM — the AI sales operating system. The link is single-use and expires ",
      strong(expiresAt), ".",
    ),
    h(CtaButton, { label: "Accept invite →", href: acceptUrl }),
    h(PlainLink, { href: acceptUrl }),
  );
}

// ─── Password reset ───────────────────────────────────────────────────────────

export interface PasswordResetArgs {
  resetUrl: string;
  expiresInMinutes: number;
}

export function passwordResetSubject(_args: PasswordResetArgs) {
  return "Reset your ΔTOM password";
}

export function PasswordResetEmail({ resetUrl, expiresInMinutes }: PasswordResetArgs) {
  return h(
    AtomEmailLayout,
    {
      preheader: "You requested a password reset for your ΔTOM account.",
      footerText: `This link expires in ${expiresInMinutes} minutes. If you didn't request a password reset, no action is needed.`,
    },
    h(Text, { style: H1 }, "Reset your password"),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 8px 0" } }, "We received a request to reset your password. Click the button below to choose a new one."),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 8px 0" } }, "This link expires in ", strong(`${expiresInMinutes} minutes`), "."),
    h(Text, { style: { fontSize: 13, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" } }, "If you didn't request this, you can safely ignore this email — your password remains unchanged."),
    h(CtaButton, { label: "Reset password →", href: resetUrl }),
    h(PlainLink, { href: resetUrl }),
  );
}

// ─── Trial expiring ────────────────────────────────────────────────────────────

export interface TrialExpiringArgs {
  daysRemaining: number;
  upgradeUrl: string;
  dials: number;
  meetings: number;
  firstName: string;
}

export function trialExpiringSubject(args: TrialExpiringArgs) {
  return `${args.firstName}, your ΔTOM trial ends in ${args.daysRemaining} day${args.daysRemaining === 1 ? "" : "s"}`;
}

export function TrialExpiringEmail({ daysRemaining, upgradeUrl, dials, meetings, firstName }: TrialExpiringArgs) {
  const daysUsed = 14 - daysRemaining;
  const dayWord = daysRemaining === 1 ? "" : "s";
  return h(
    AtomEmailLayout,
    {
      preheader: `Your ΔTOM trial ends in ${daysRemaining} days — lock in your seat to keep the momentum.`,
      footerText: "Reply to this email any time with questions. We're here to help.",
      showUnsubscribe: true,
    },
    h(Text, { style: H1 }, `${firstName}, your trial ends in ${daysRemaining} day${dayWord}`),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 8px 0" } },
      "In ", strong(`${daysUsed} days`), ", ΔTOM has placed ",
      strong(`${dials.toLocaleString()} dials`, TEAL), " and booked ",
      strong(`${meetings} meeting${meetings !== 1 ? "s" : ""}`, TEAL), " for you.",
    ),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 20px 0" } },
      `Lock in your seat before ${daysRemaining} day${dayWord} from now and keep the momentum. No interruption — your workspace, data, and call history carry over seamlessly.`,
    ),
    h(CtaButton, { label: "Upgrade now →", href: upgradeUrl }),
    h(PlainLink, { href: upgradeUrl }),
  );
}

// ─── Subscription created ────────────────────────────────────────────────────

export interface SubscriptionCreatedArgs {
  planName: string;
  seats: number;
  nextBillingDate: string;
  amount: string;
  currency: string;
}

export function subscriptionCreatedSubject(args: SubscriptionCreatedArgs) {
  return `You're on ΔTOM ${args.planName} — ${args.seats} seat${args.seats === 1 ? "" : "s"} unlocked`;
}

export function SubscriptionCreatedEmail({ planName, seats, nextBillingDate, amount, currency }: SubscriptionCreatedArgs) {
  const ctaUrl = `${APP_URL}/#/billing`;
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
  const cell = (style: React.CSSProperties) => ({ style });
  return h(
    AtomEmailLayout,
    {
      preheader: `You're now on ΔTOM ${planName} with ${seats} seats.`,
      footerText: "You can change plan, seats, or cancel anytime from the billing portal.",
    },
    h(Text, { style: H1 }, "Welcome to ΔTOM ", planName),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 16px 0" } }, "Your subscription is active. Here's the summary:"),
    h(
      "table",
      { cellPadding: 0, cellSpacing: 0, style: { width: "100%", fontSize: 13, lineHeight: "2", color: TEXT_MUTED, margin: "0 0 20px 0", borderCollapse: "collapse" } },
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "Plan"), h("td", cell({ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" }), planName)),
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "Seats"), h("td", cell({ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" }), seats)),
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "Per seat / month"), h("td", cell({ color: TEAL, fontWeight: 700, textAlign: "right" }), formattedAmount)),
      h(
        "tr",
        { style: { borderTop: "1px solid rgba(255,255,255,0.06)" } },
        h("td", cell({ color: TEXT_MUTED, paddingTop: 8 }), "Next billing"),
        h("td", cell({ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right", paddingTop: 8 }), nextBillingDate),
      ),
    ),
    h(CtaButton, { label: "Open billing →", href: ctaUrl }),
    h(PlainLink, { href: ctaUrl }),
  );
}

// ─── Subscription changed ────────────────────────────────────────────────────

export interface SubscriptionChangedArgs {
  oldPlan: string;
  newPlan: string;
  seats: number;
  effectiveDate: string;
  amount: string;
  currency: string;
}

export function subscriptionChangedSubject(args: SubscriptionChangedArgs) {
  return `Your ΔTOM plan changed: ${args.oldPlan} → ${args.newPlan}`;
}

export function SubscriptionChangedEmail({ oldPlan, newPlan, seats, effectiveDate, amount, currency }: SubscriptionChangedArgs) {
  const ctaUrl = `${APP_URL}/#/billing`;
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
  const cell = (style: React.CSSProperties) => ({ style });
  return h(
    AtomEmailLayout,
    {
      preheader: `Your ΔTOM plan changed from ${oldPlan} to ${newPlan}.`,
      footerText: "You can change plan, seats, or cancel anytime from the billing portal.",
    },
    h(Text, { style: H1 }, "Plan updated: ", oldPlan, " → ", newPlan),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 16px 0" } },
      "Effective ", strong(effectiveDate), ", your ΔTOM plan is now ", strong(newPlan, TEAL), ".",
    ),
    h(
      "table",
      { cellPadding: 0, cellSpacing: 0, style: { width: "100%", fontSize: 13, lineHeight: "2", color: TEXT_MUTED, margin: "0 0 20px 0", borderCollapse: "collapse" } },
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "Previous plan"), h("td", cell({ color: TEXT_MUTED, textAlign: "right", textDecoration: "line-through" }), oldPlan)),
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "New plan"), h("td", cell({ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" }), newPlan)),
      h("tr", null, h("td", cell({ color: TEXT_MUTED }), "Seats"), h("td", cell({ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" }), seats)),
      h(
        "tr",
        { style: { borderTop: "1px solid rgba(255,255,255,0.06)" } },
        h("td", cell({ color: TEXT_MUTED, paddingTop: 8 }), "New monthly"),
        h("td", cell({ color: TEAL, fontWeight: 700, textAlign: "right", paddingTop: 8 }), formattedAmount),
      ),
    ),
    h(CtaButton, { label: "View billing →", href: ctaUrl }),
    h(PlainLink, { href: ctaUrl }),
  );
}

// ─── Payment failed ───────────────────────────────────────────────────────────

export interface PaymentFailedArgs {
  amount: string;
  retryDate: string;
  updateCardUrl: string;
  currency: string;
}

export function paymentFailedSubject(_args: PaymentFailedArgs) {
  return "⚠️ Payment failed for ΔTOM — please update your card";
}

export function PaymentFailedEmail({ amount, retryDate, updateCardUrl, currency }: PaymentFailedArgs) {
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;
  return h(
    AtomEmailLayout,
    {
      preheader: `We couldn't charge ${formattedAmount}. Update your card to avoid service interruption.`,
      footerText: "If you've already updated your card, you can ignore this email.",
    },
    h(Text, { style: H1 }, "Payment failed"),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 8px 0" } }, "We couldn't charge ", strong(formattedAmount), " for your ΔTOM subscription."),
    h(Text, { style: { ...BODY_MUTED, margin: "0 0 8px 0" } }, "We'll retry on ", strong(retryDate), ". To avoid service interruption, please update your card now."),
    h(Text, { style: { fontSize: 13, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" } }, "If your service is paused, it will resume immediately once payment succeeds."),
    h(CtaButton, { label: "Update card →", href: updateCardUrl }),
    h(PlainLink, { href: updateCardUrl }),
  );
}

// ─── Consent expiring ─────────────────────────────────────────────────────────

export interface ConsentExpiringArgs {
  adminName: string;
  tenantName: string;
  expiringCount: number;
  prospects: Array<{ identifier: string; consentDate: string; daysRemaining: number }>;
  consentLedgerUrl: string;
}

export function consentExpiringSubject(args: ConsentExpiringArgs) {
  return `Consent renewal alert: ${args.expiringCount} PEWC consent${args.expiringCount === 1 ? "" : "s"} expiring this month`;
}

export function ConsentExpiringEmail({ adminName, tenantName, expiringCount, prospects, consentLedgerUrl }: ConsentExpiringArgs) {
  const previewList = prospects.slice(0, 10);
  const th = (align: "left" | "right", label: string) =>
    h("th", { style: { textAlign: align, padding: "8px 6px", color: TEXT_MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" } }, label);
  return h(
    AtomEmailLayout,
    {
      preheader: `${expiringCount} PEWC consents are expiring within 30 days for ${tenantName}. Review and renew to stay compliant.`,
      footerText: "This is an automated compliance alert. Reply with questions.",
      showUnsubscribe: true,
    },
    h(Text, { style: H1 }, `${adminName}, ${expiringCount} consent${expiringCount === 1 ? "" : "s"} expiring soon`),
    h(
      Text,
      { style: { ...BODY_MUTED, margin: "0 0 16px 0" } },
      "The following PEWC consents for ", strong(tenantName),
      " will expire within 30 days. Under TCPA, expired consents mean you cannot call these prospects. Renew now to avoid compliance blocks.",
    ),
    h(
      Section,
      { style: { margin: "0 0 20px 0" } },
      h(
        "table",
        { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT } },
        h("thead", null, h("tr", { style: { borderBottom: "1px solid rgba(255,255,255,0.08)" } }, th("left", "Prospect"), th("left", "Consent Date"), th("right", "Days Left"))),
        h(
          "tbody",
          null,
          ...previewList.map((p, i) =>
            h(
              "tr",
              { key: i, style: { borderBottom: "1px solid rgba(255,255,255,0.04)" } },
              h("td", { style: { padding: "8px 6px", color: TEXT_PRIMARY } }, p.identifier),
              h("td", { style: { padding: "8px 6px", color: TEXT_MUTED } }, p.consentDate),
              h("td", { style: { padding: "8px 6px", color: p.daysRemaining <= 7 ? "#ff7b6b" : TEAL, textAlign: "right", fontWeight: 700 } }, `${p.daysRemaining}d`),
            ),
          ),
        ),
      ),
      prospects.length > 10
        ? h(Text, { style: { fontSize: 12, color: TEXT_MUTED, marginTop: 8 } }, `+ ${prospects.length - 10} more. View all in the consent ledger.`)
        : null,
    ),
    h(CtaButton, { label: "Open consent ledger →", href: consentLedgerUrl }),
    h(PlainLink, { href: consentLedgerUrl }),
  );
}
