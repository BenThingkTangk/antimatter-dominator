/**
 * Admin → Integrations
 *
 * CRM connectors: Salesforce, HubSpot, Pipedrive. Outbound channels: Slack,
 * Gmail, Outlook. Each tile shows status + last-synced + Connect / Disconnect.
 */
import { Plug, CheckCircle2, XCircle } from "lucide-react";
import { useAdminQuery, useAdminMutation } from "../useAdminApi";
import { KpiCard, ChartCard, ATOM_TEAL, ATOM_GREEN, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT, EmptyState } from "../charts";

const PROVIDERS = [
  { id: "salesforce", name: "Salesforce",  blurb: "Sync contacts, opportunities, call dispositions",  authUrl: "/api/integrations/salesforce/oauth" },
  { id: "hubspot",    name: "HubSpot",     blurb: "Sync deals, contact timelines, call recordings",   authUrl: "/api/integrations/hubspot/oauth" },
  { id: "pipedrive",  name: "Pipedrive",   blurb: "Sync activities, deals, persons",                  authUrl: "/api/integrations/pipedrive/oauth" },
  { id: "slack",      name: "Slack",       blurb: "Real-time call alerts + compliance notifications", authUrl: "/api/integrations/slack/oauth" },
  { id: "gmail",      name: "Gmail",       blurb: "Send personalised follow-ups via your inbox",      authUrl: "/api/integrations/gmail/oauth" },
  { id: "outlook",    name: "Outlook",     blurb: "Send personalised follow-ups via Outlook",         authUrl: "/api/integrations/outlook/oauth" },
];

export default function Integrations() {
  const { data } = useAdminQuery<{ tenant: any; integrations: any[] }>(["admin","integrations"], "/api/admin/data?view=integrations");
  const disconnect = useAdminMutation<any, any>("/api/admin/data?view=integrations-disconnect", "POST", [["admin","integrations"]]);

  const connected = (data?.integrations ?? []).filter(i => i.status === "connected").length;
  const errored = (data?.integrations ?? []).filter(i => i.status === "error").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Connected" value={connected} sub={`${PROVIDERS.length} available`} tone="success" icon={CheckCircle2} />
        <KpiCard label="Errored" value={errored} sub="Need re-auth" tone={errored > 0 ? "warn" : "default"} icon={XCircle} />
        <KpiCard label="Total providers" value={PROVIDERS.length} sub="CRM + comms" tone="default" icon={Plug} />
      </div>

      <ChartCard title="Connectors" subtitle="OAuth + sync health">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {PROVIDERS.map((p) => {
            const c = (data?.integrations ?? []).find((i) => i.provider === p.id);
            const status = c?.status ?? "disconnected";
            const color = status === "connected" ? ATOM_GREEN : status === "error" ? ATOM_DANGER : ATOM_MUTED;
            return (
              <div key={p.id} style={{
                padding: 18, borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${color}33`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>{p.name}</span>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999,
                    background: `${color}14`, color,
                    fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                  }}>{status}</span>
                </div>
                <div style={{ fontSize: 12, color: ATOM_MUTED, marginBottom: 12, lineHeight: 1.5 }}>{p.blurb}</div>
                {c?.last_synced_at && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT, marginBottom: 8 }}>
                    Last sync · {new Date(c.last_synced_at).toLocaleString()}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  {status === "connected" ? (
                    <button onClick={() => disconnect.mutate({ provider: p.id })} style={{
                      flex: 1, padding: "8px 14px", borderRadius: 8,
                      background: "rgba(255,107,139,0.08)", color: ATOM_DANGER,
                      border: "1px solid rgba(255,107,139,0.32)",
                      fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                      cursor: "pointer",
                    }}>Disconnect</button>
                  ) : (
                    <button onClick={() => window.location.href = p.authUrl} style={{
                      flex: 1, padding: "8px 14px", borderRadius: 8,
                      background: ATOM_TEAL, color: "#041413",
                      border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer",
                    }}>Connect {p.name}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
