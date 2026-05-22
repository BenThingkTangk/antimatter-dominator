import { Text } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface InviteArgs {
  inviterName: string;
  tenantName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}

export function subject(args: InviteArgs) {
  return `${args.inviterName} invited you to ${args.tenantName} on ΔTOM`;
}

export default function InviteEmail({ inviterName, tenantName, role, acceptUrl, expiresAt }: InviteArgs) {
  return (
    <AtomEmailLayout
      preheader={`${inviterName} invited you to ${tenantName} on ΔTOM — accept your invite to get started.`}
      footerText="If you weren't expecting this email, you can safely ignore it. Questions? Just reply to this message."
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        You're invited to {tenantName}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 8px 0" }}>
        <strong style={{ color: TEXT_PRIMARY }}>{inviterName}</strong> invited you to join{" "}
        <strong style={{ color: TEXT_PRIMARY }}>{tenantName}</strong> on ΔTOM (ATOM Sales Dominator) as{" "}
        <strong style={{ color: TEAL }}>{role}</strong>.
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 20px 0" }}>
        Click the button below to accept your invite, set your password, and start running ATOM — the AI sales operating system.
        The link is single-use and expires <strong style={{ color: TEXT_PRIMARY }}>{expiresAt}</strong>.
      </Text>

      <CtaButton label="Accept invite →" href={acceptUrl} />
      <PlainLink href={acceptUrl} />
    </AtomEmailLayout>
  );
}
