import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, FONT } from "./_layout";

export interface PasswordResetArgs {
  resetUrl: string;
  expiresInMinutes: number;
}

export function subject(_args: PasswordResetArgs) {
  return "Reset your ΔTOM password";
}

export default function PasswordResetEmail({ resetUrl, expiresInMinutes }: PasswordResetArgs) {
  return (
    <AtomEmailLayout
      preheader="You requested a password reset for your ΔTOM account."
      footerText={`This link expires in ${expiresInMinutes} minutes. If you didn't request a password reset, no action is needed.`}
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        Reset your password
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        We received a request to reset your password. Click the button below to choose a new one.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        This link expires in <strong style={{ color: TEXT_PRIMARY }}>{expiresInMinutes} minutes</strong>.
      </Text>
      <Text style={{ fontSize: 13, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" }}>
        If you didn't request this, you can safely ignore this email — your password remains unchanged.
      </Text>

      <CtaButton label="Reset password →" href={resetUrl} />
      <PlainLink href={resetUrl} />
    </AtomEmailLayout>
  );
}
