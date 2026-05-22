import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface SubscriptionCreatedArgs {
  planName: string;
  seats: number;
  nextBillingDate: string;
  amount: string;
  currency: string;
}

export function subject(args: SubscriptionCreatedArgs) {
  return `You're on ΔTOM ${args.planName} — ${args.seats} seat${args.seats === 1 ? "" : "s"} unlocked`;
}

const APP_URL = process.env.APP_URL || "https://atom-dominator-pro.vercel.app";

export default function SubscriptionCreatedEmail({ planName, seats, nextBillingDate, amount, currency }: SubscriptionCreatedArgs) {
  const ctaUrl = `${APP_URL}/#/billing`;
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;

  return (
    <AtomEmailLayout
      preheader={`You're now on ΔTOM ${planName} with ${seats} seats.`}
      footerText="You can change plan, seats, or cancel anytime from the billing portal."
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        Welcome to ΔTOM {planName}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 16px 0" }}>
        Your subscription is active. Here's the summary:
      </Text>

      <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13, lineHeight: "2", color: TEXT_MUTED, margin: "0 0 20px 0", borderCollapse: "collapse" as const }}>
        <tr><td style={{ color: TEXT_MUTED }}>Plan</td><td style={{ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" as const }}>{planName}</td></tr>
        <tr><td style={{ color: TEXT_MUTED }}>Seats</td><td style={{ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" as const }}>{seats}</td></tr>
        <tr><td style={{ color: TEXT_MUTED }}>Per seat / month</td><td style={{ color: TEAL, fontWeight: 700, textAlign: "right" as const }}>{formattedAmount}</td></tr>
        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <td style={{ color: TEXT_MUTED, paddingTop: 8 }}>Next billing</td>
          <td style={{ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" as const, paddingTop: 8 }}>{nextBillingDate}</td>
        </tr>
      </table>

      <CtaButton label="Open billing →" href={ctaUrl} />
      <PlainLink href={ctaUrl} />
    </AtomEmailLayout>
  );
}
