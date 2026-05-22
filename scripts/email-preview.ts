/**
 * scripts/email-preview.ts
 *
 * Renders every email template with synthetic args and writes static HTML
 * files to /tmp/email-preview/<template>.html for local QA.
 *
 * Usage:  npx tsx scripts/email-preview.ts
 *   or:   npm run email:preview
 */
import * as React from "react";
import { render } from "@react-email/render";
import fs from "fs";
import path from "path";

import WelcomeEmail from "../api/_lib/email-templates/welcome";
import InviteEmail from "../api/_lib/email-templates/invite";
import PasswordResetEmail from "../api/_lib/email-templates/password-reset";
import TrialExpiringEmail from "../api/_lib/email-templates/trial-expiring";
import SubscriptionCreatedEmail from "../api/_lib/email-templates/subscription-created";
import SubscriptionChangedEmail from "../api/_lib/email-templates/subscription-changed";
import PaymentFailedEmail from "../api/_lib/email-templates/payment-failed";

const OUT_DIR = "/tmp/email-preview";

const templates: { name: string; element: React.ReactElement }[] = [
  {
    name: "welcome",
    element: React.createElement(WelcomeEmail, {
      fullName: "Jordan Smith",
      companyName: "Acme Corp",
      trialEndDate: "Saturday, June 7, 2025",
    }),
  },
  {
    name: "invite",
    element: React.createElement(InviteEmail, {
      inviterName: "Taylor Jones",
      tenantName: "Acme Corp",
      role: "rep",
      acceptUrl: "https://atom-dominator-pro.vercel.app/#/invite/abc123xyz",
      expiresAt: "14 days",
    }),
  },
  {
    name: "password-reset",
    element: React.createElement(PasswordResetEmail, {
      resetUrl: "https://atom-dominator-pro.vercel.app/#/reset-password/tok123",
      expiresInMinutes: 60,
    }),
  },
  {
    name: "trial-expiring",
    element: React.createElement(TrialExpiringEmail, {
      daysRemaining: 3,
      upgradeUrl: "https://atom-dominator-pro.vercel.app/#/billing",
      dials: 1247,
      meetings: 18,
      firstName: "Jordan",
    }),
  },
  {
    name: "subscription-created",
    element: React.createElement(SubscriptionCreatedEmail, {
      planName: "Growth",
      seats: 5,
      nextBillingDate: "July 7, 2025",
      amount: "89",
      currency: "usd",
    }),
  },
  {
    name: "subscription-changed",
    element: React.createElement(SubscriptionChangedEmail, {
      oldPlan: "Striker",
      newPlan: "Growth",
      seats: 10,
      effectiveDate: "June 7, 2025",
      amount: "79",
      currency: "usd",
    }),
  },
  {
    name: "payment-failed",
    element: React.createElement(PaymentFailedEmail, {
      amount: "445.00",
      retryDate: "June 10, 2025",
      updateCardUrl: "https://atom-dominator-pro.vercel.app/#/billing",
      currency: "usd",
    }),
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { name, element } of templates) {
    const html = await render(element);
    const dest = path.join(OUT_DIR, `${name}.html`);
    fs.writeFileSync(dest, html, "utf-8");
    console.log(`  ✓ ${dest}`);
  }

  console.log(`\nDone — ${templates.length} templates written to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error("email-preview failed:", err);
  process.exit(1);
});
