import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface SubscriptionChangedArgs {
  oldPlan: string;
  newPlan: string;
  seats: number;
  effectiveDate: string;
  amount: string;
  currency: string;
}

export function subject(args: SubscriptionChangedArgs) {
  return `Your ΔTOM plan changed: ${args.oldPlan} → ${args.newPlan}`;
}

const APP_URL = process.env.APP_URL || "https://atom-dominator-pro.vercel.app";

export default function SubscriptionChangedEmail({ oldPlan, newPlan, seats, effectiveDate, amount, currency }: SubscriptionChangedArgs) {
  const ctaUrl = `${APP_URL}/#/billing`;
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;

  return (
    <AtomEmailLayout
      preheader={`Your ΔTOM plan changed from ${oldPlan} to ${newPlan}.`}
      footerText="You can change plan, seats, or cancel anytime from the billing portal."
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        Plan updated: {oldPlan} → {newPlan}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 16px 0" }}>
        Effective <strong style={{ color: TEXT_PRIMARY }}>{effectiveDate}</strong>, your ΔTOM plan is now{" "}
        <strong style={{ color: TEAL }}>{newPlan}</strong>.
      </Text>

      <table cellPadding={0} cellSpacing={0} style={{ width: "100%", fontSize: 13, lineHeight: "2", color: TEXT_MUTED, margin: "0 0 20px 0", borderCollapse: "collapse" as const }}>
        <tr><td style={{ color: TEXT_MUTED }}>Previous plan</td><td style={{ color: TEXT_MUTED, textAlign: "right" as const, textDecoration: "line-through" as const }}>{oldPlan}</td></tr>
        <tr><td style={{ color: TEXT_MUTED }}>New plan</td><td style={{ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" as const }}>{newPlan}</td></tr>
        <tr><td style={{ color: TEXT_MUTED }}>Seats</td><td style={{ color: TEXT_PRIMARY, fontWeight: 700, textAlign: "right" as const }}>{seats}</td></tr>
        <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <td style={{ color: TEXT_MUTED, paddingTop: 8 }}>New monthly</td>
          <td style={{ color: TEAL, fontWeight: 700, textAlign: "right" as const, paddingTop: 8 }}>{formattedAmount}</td>
        </tr>
      </table>

      <CtaButton label="View billing →" href={ctaUrl} />
      <PlainLink href={ctaUrl} />
    </AtomEmailLayout>
  );
}
