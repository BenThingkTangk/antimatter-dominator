import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, FONT } from "./_layout";

export interface PaymentFailedArgs {
  amount: string;
  retryDate: string;
  updateCardUrl: string;
  currency: string;
}

export function subject(_args: PaymentFailedArgs) {
  return "⚠️ Payment failed for ΔTOM — please update your card";
}

export default function PaymentFailedEmail({ amount, retryDate, updateCardUrl, currency }: PaymentFailedArgs) {
  const formattedAmount = currency === "usd" ? `$${amount}` : `${amount} ${currency.toUpperCase()}`;

  return (
    <AtomEmailLayout
      preheader={`We couldn't charge ${formattedAmount}. Update your card to avoid service interruption.`}
      footerText="If you've already updated your card, you can ignore this email."
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        Payment failed
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        We couldn't charge <strong style={{ color: TEXT_PRIMARY }}>{formattedAmount}</strong> for your ΔTOM subscription.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        We'll retry on <strong style={{ color: TEXT_PRIMARY }}>{retryDate}</strong>. To avoid service interruption, please update your card now.
      </Text>
      <Text style={{ fontSize: 13, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" }}>
        If your service is paused, it will resume immediately once payment succeeds.
      </Text>

      <CtaButton label="Update card →" href={updateCardUrl} />
      <PlainLink href={updateCardUrl} />
    </AtomEmailLayout>
  );
}
