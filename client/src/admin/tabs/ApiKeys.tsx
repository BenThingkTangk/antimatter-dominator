/**
 * Admin → API Keys
 *
 * Internal key registry: each provider ΔTOM calls (Perplexity, OpenAI, Hume,
 * Twilio, Pinecone, Apollo, etc.) with usage + rate-limit telemetry.
 */
import { KeyRound, Shield, Activity } from "lucide-react";
import { useAdminQuery } from "../useAdminApi";
import { KpiCard, ChartCard, LineSpark, ATOM_TEAL, ATOM_GREEN, ATOM_AMBER, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT, EmptyState } from "../charts";

interface ApiKeyData {
  providers: {
    name: string;
    keyVar: string;
    configured: boolean;
    status: "ok" | "rate_limited" | "error" | "unknown";
    used_by: string[];
    usage24h: number;
    errors24h: number;
    spark: number[];
  }[];
}

export default function ApiKeys() {
  const { data } = useAdminQuery<ApiKeyData>(["admin","apikeys"], "/api/admin/data?view=apikeys", { refetchInterval: 60_000 });
  const providers = data?.providers ?? [];
  const configured = providers.filter(p => p.configured).length;
  const errored = providers.filter(p => p.status === "error" || p.status === "rate_limited").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard label="Keys configured" value={configured} sub={`${providers.length} providers`} tone="success" icon={KeyRound} />
        <KpiCard label="Errored or rate-limited" value={errored} sub="Need attention" tone={errored > 0 ? "warn" : "default"} icon={Shield} />
        <KpiCard label="Calls · 24h" value={providers.reduce((a, p) => a + p.usage24h, 0)} sub="Across every provider" tone="default" icon={Activity} />
      </div>

      <ChartCard title="Provider keys" subtitle="Never displays actual secrets · only configured-flags + usage">
        {providers.length === 0 ? <EmptyState message="Provider registry loading…" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {providers.map((p) => {
              const color = !p.configured ? ATOM_MUTED : p.status === "error" ? ATOM_DANGER : p.status === "rate_limited" ? ATOM_AMBER : ATOM_GREEN;
              return (
                <div key={p.name} style={{
                  padding: 14, borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${color}33`,
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--color-text)" }}>{p.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT, marginTop: 2 }}>{p.keyVar}</div>
                    </div>
                    <span style={{
                      padding: "3px 10px", borderRadius: 999,
                      background: `${color}14`, color,
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700,
                    }}>{p.configured ? p.status : "MISSING"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: ATOM_MUTED, marginBottom: 10 }}>
                    <span>{p.usage24h} calls 24h</span>
                    {p.errors24h > 0 && <span style={{ color: ATOM_DANGER }}>{p.errors24h} errors</span>}
                  </div>
                  {p.used_by.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.used_by.slice(0, 4).map((u, i) => (
                        <span key={i} style={{
                          padding: "2px 8px", borderRadius: 999, fontSize: 9,
                          fontFamily: "var(--font-mono)", color: ATOM_MUTED,
                          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                          letterSpacing: "0.08em", textTransform: "uppercase",
                        }}>{u}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
