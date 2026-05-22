import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface TrialExpiringArgs {
  daysRemaining: number;
  upgradeUrl: string;
  dials: number;
  meetings: number;
  firstName: string;
}

export function subject(args: TrialExpiringArgs) {
  return `${args.firstName}, your ΔTOM trial ends in ${args.daysRemaining} day${args.daysRemaining === 1 ? "" : "s"}`;
}

export default function TrialExpiringEmail({ daysRemaining, upgradeUrl, dials, meetings, firstName }: TrialExpiringArgs) {
  const daysUsed = 14 - daysRemaining;

  return (
    <AtomEmailLayout
      preheader={`Your ΔTOM trial ends in ${daysRemaining} days — lock in your seat to keep the momentum.`}
      footerText="Reply to this email any time with questions. We're here to help."
      showUnsubscribe
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        {firstName}, your trial ends in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        In <strong style={{ color: TEXT_PRIMARY }}>{daysUsed} days</strong>, ΔTOM has placed{" "}
        <strong style={{ color: TEAL }}>{dials.toLocaleString()} dials</strong> and booked{" "}
        <strong style={{ color: TEAL }}>{meetings} meeting{meetings !== 1 ? "s" : ""}</strong> for you.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" }}>
        Lock in your seat before {daysRemaining} day{daysRemaining === 1 ? "" : "s"} from now and keep the momentum.
        No interruption — your workspace, data, and call history carry over seamlessly.
      </Text>

      <CtaButton label="Upgrade now →" href={upgradeUrl} />
      <PlainLink href={upgradeUrl} />
    </AtomEmailLayout>
  );
}
