import { Text, Section } from "@react-email/components";
import * as React from "react";
import AtomEmailLayout, { CtaButton, PlainLink, TEXT_PRIMARY, TEXT_MUTED, TEAL, FONT } from "./_layout";

export interface ConsentExpiringArgs {
  adminName: string;
  tenantName: string;
  expiringCount: number;
  prospects: Array<{ identifier: string; consentDate: string; daysRemaining: number }>;
  consentLedgerUrl: string;
}

export function subject(args: ConsentExpiringArgs) {
  return `Consent renewal alert: ${args.expiringCount} PEWC consent${args.expiringCount === 1 ? "" : "s"} expiring this month`;
}

export default function ConsentExpiringEmail({ adminName, tenantName, expiringCount, prospects, consentLedgerUrl }: ConsentExpiringArgs) {
  const previewList = prospects.slice(0, 10);
  return (
    <AtomEmailLayout
      preheader={`${expiringCount} PEWC consents are expiring within 30 days for ${tenantName}. Review and renew to stay compliant.`}
      footerText="This is an automated compliance alert. Reply with questions."
      showUnsubscribe
    >
      <Text style={{ margin: "0 0 12px 0", fontSize: 22, lineHeight: "1.3", color: TEXT_PRIMARY, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: FONT }}>
        {adminName}, {expiringCount} consent{expiringCount === 1 ? "" : "s"} expiring soon
      </Text>
      <Text style={{ fontSize: 14, lineHeight: "1.6", color: TEXT_MUTED, margin: "0 0 16px 0" }}>
        The following PEWC consents for <strong style={{ color: TEXT_PRIMARY }}>{tenantName}</strong> will expire within 30 days.
        Under TCPA, expired consents mean you cannot call these prospects. Renew now to avoid compliance blocks.
      </Text>

      <Section style={{ margin: "0 0 20px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: FONT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
              <th style={{ textAlign: "left", padding: "8px 6px", color: TEXT_MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Prospect</th>
              <th style={{ textAlign: "left", padding: "8px 6px", color: TEXT_MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Consent Date</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: TEXT_MUTED, fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>Days Left</th>
            </tr>
          </thead>
          <tbody>
            {previewList.map((p, i) => (
              <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <td style={{ padding: "8px 6px", color: TEXT_PRIMARY }}>{p.identifier}</td>
                <td style={{ padding: "8px 6px", color: TEXT_MUTED }}>{p.consentDate}</td>
                <td style={{ padding: "8px 6px", color: p.daysRemaining <= 7 ? "#ff7b6b" : TEAL, textAlign: "right", fontWeight: 700 }}>{p.daysRemaining}d</td>
              </tr>
            ))}
          </tbody>
        </table>
        {prospects.length > 10 && (
          <Text style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8 }}>
            + {prospects.length - 10} more. View all in the consent ledger.
          </Text>
        )}
      </Section>

      <CtaButton label="Open consent ledger →" href={consentLedgerUrl} />
      <PlainLink href={consentLedgerUrl} />
    </AtomEmailLayout>
  );
}
