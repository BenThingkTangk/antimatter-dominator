import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface WelcomeArgs {
  fullName: string;
  companyName: string;
  trialEndDate: string;
}

export function subject(args: WelcomeArgs) {
  return `Welcome to ΔTOM, ${args.fullName} — your 14-day trial starts now`;
}

const APP_URL = process.env.APP_URL || "https://atom-dominator-pro.vercel.app";

export default function WelcomeEmail({ fullName, companyName, trialEndDate }: WelcomeArgs) {
  const firstName = fullName.split(" ")[0] || fullName;
  const ctaUrl = `${APP_URL}/#/pitch`;

  return (
    <AtomEmailLayout
      preheader={`${companyName} is live on ΔTOM. Your 14-day trial ends ${trialEndDate}.`}
      footerText={`Your trial ends ${trialEndDate}. Reply to this email any time with questions.`}
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        Welcome, {firstName}.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        <strong style={{ color: TEXT_PRIMARY }}>{companyName}</strong> is now on ΔTOM.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 16px 0" }}>
        Your <strong style={{ color: TEAL }}>14-day free trial</strong> is active and runs through{" "}
        <strong style={{ color: TEXT_PRIMARY }}>{trialEndDate}</strong>. No credit card required — cancel anytime.
      </Text>

      <Text style={{ fontSize: 13, lineHeight: "1.6", color: TEXT_PRIMARY, fontWeight: 700, margin: "0 0 6px 0" }}>
        Three things to do in the first 24 hours:
      </Text>
      <table cellPadding={0} cellSpacing={0} style={{ fontSize: 13, lineHeight: "1.8", color: TEXT_MUTED, margin: "0 0 20px 0" }}>
        <tr><td style={{ paddingRight: 8, color: TEAL, fontWeight: 700 }}>1.</td><td>Build your first WarBook — deep company research in 30 seconds</td></tr>
        <tr><td style={{ paddingRight: 8, color: TEAL, fontWeight: 700 }}>2.</td><td>Generate your first pitch — brutal, lethal call openers</td></tr>
        <tr><td style={{ paddingRight: 8, color: TEAL, fontWeight: 700 }}>3.</td><td>Run your first dial — ADAM, the AI voice agent, books meetings while you sleep</td></tr>
      </table>

      <CtaButton label="Open ΔTOM →" href={ctaUrl} />
      <PlainLink href={ctaUrl} />
    </AtomEmailLayout>
  );
}
