/**
 * Shared ΔTOM email layout — dark canvas, teal accent, ΔTOM wordmark.
 *
 * Brand tokens:
 *   Dark canvas:  #08080c
 *   Card bg:      #0c1014
 *   Teal accent:  #00c8c8  (CTAs, links, brand strokes)
 *   Text:         #e8e8ea  (primary), #9a9aa3 (muted)
 *   Display font: 'Cabinet Grotesk', system-ui, sans-serif (web-safe stack —
 *                 emails can't load custom fonts reliably)
 */
import {
  Html, Head, Body, Container, Section, Row, Column,
  Text, Link, Hr, Preview,
} from "@react-email/components";
import * as React from "react";

const BG = "#08080c";
const CARD = "#0c1014";
const TEAL = "#00c8c8";
const TEXT_PRIMARY = "#e8e8ea";
const TEXT_MUTED = "#9a9aa3";
const FONT = "'Cabinet Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export { BG, CARD, TEAL, TEXT_PRIMARY, TEXT_MUTED, FONT };

export function AtomWordmark() {
  return (
    <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.06em", fontFamily: "monospace" }}>
      <span style={{ color: TEXT_PRIMARY }}>Δ</span>
      <span style={{ color: TEXT_PRIMARY }}>T</span>
      <span style={{ color: TEAL }}>O</span>
      <span style={{ color: TEXT_PRIMARY }}>M</span>
    </span>
  );
}

export function AtomLogo() {
  return (
    <table cellPadding={0} cellSpacing={0}>
      <tr>
        <td style={{ verticalAlign: "middle", paddingRight: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: TEAL,
              boxShadow: `0 0 18px ${TEAL}40`,
              textAlign: "center",
              color: BG,
              fontWeight: 800,
              lineHeight: "32px",
              fontSize: 14,
              fontFamily: "monospace",
            }}
          >
            Δ
          </div>
        </td>
        <td style={{ verticalAlign: "middle" }}>
          <AtomWordmark />
        </td>
      </tr>
    </table>
  );
}

export function CtaButton({ label, href }: { label: string; href: string }) {
  return (
    <table cellPadding={0} cellSpacing={0} style={{ margin: "0 auto" }}>
      <tr>
        <td align="center" style={{ borderRadius: 999 }}>
          <a
            href={href}
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 999,
              background: TEAL,
              color: "#000",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "0.04em",
              boxShadow: `0 0 24px ${TEAL}40`,
              fontFamily: FONT,
            }}
          >
            {label}
          </a>
        </td>
      </tr>
    </table>
  );
}

export function PlainLink({ href }: { href: string }) {
  return (
    <Text style={{ marginTop: 14, fontSize: 11, color: TEXT_MUTED, fontFamily: "monospace", wordBreak: "break-all" as const, textAlign: "center" as const }}>
      Or paste this link:{" "}
      <Link href={href} style={{ color: TEAL, textDecoration: "none" }}>
        {href}
      </Link>
    </Text>
  );
}

interface LayoutProps {
  preheader?: string;
  children: React.ReactNode;
  footerText?: string;
  showUnsubscribe?: boolean;
}

export default function AtomEmailLayout({ preheader, children, footerText, showUnsubscribe }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      {preheader && <Preview>{preheader}</Preview>}
      <Body style={{ margin: 0, padding: 0, background: BG, fontFamily: FONT }}>
        <Container style={{ background: BG, padding: "32px 16px" }}>
          <Section
            style={{
              maxWidth: 560,
              margin: "0 auto",
              background: CARD,
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              overflow: "hidden" as const,
            }}
          >
            {/* Logo */}
            <Section style={{ padding: "28px 32px 8px 32px" }}>
              <AtomLogo />
            </Section>

            {/* Content */}
            <Section style={{ padding: "18px 32px 28px 32px" }}>
              {children}
            </Section>
          </Section>

          {/* Footer */}
          <Section style={{ maxWidth: 560, margin: "0 auto", padding: "14px 0 0 0" }}>
            {footerText && (
              <Text style={{ fontSize: 11, lineHeight: "1.6", color: TEXT_MUTED, textAlign: "center" as const, fontFamily: FONT }}>
                {footerText}
              </Text>
            )}
            <Text style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase" as const, textAlign: "center" as const }}>
              Sent by ΔTOM · ATOM Sales Dominator · Nirmata Holdings
            </Text>
            <Text style={{ fontSize: 10, color: TEXT_MUTED, textAlign: "center" as const }}>
              You're receiving this because you have an account on ΔTOM.
              {showUnsubscribe && (
                <>
                  {" "}
                  <Link href="mailto:unsubscribe@atomsalesdominator.com?subject=Unsubscribe" style={{ color: TEAL, textDecoration: "underline" }}>
                    Unsubscribe
                  </Link>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
