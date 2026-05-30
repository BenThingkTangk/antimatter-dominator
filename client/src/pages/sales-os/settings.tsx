import { Settings as SettingsIcon, Check, X } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";

// Reads frontend-safe (VITE_*) env presence only — never exposes secret values.
function envConnected(key: string): boolean {
  try {
    return Boolean((import.meta as any).env?.[key]);
  } catch {
    return false;
  }
}

const INTEGRATIONS = [
  { name: "Apollo", desc: "Prospect data & enrichment", envKey: "VITE_APOLLO_ENABLED", mock: true },
  { name: "Hume", desc: "Voice emotion AI", envKey: "VITE_HUME_ENABLED", mock: true },
  { name: "Perplexity", desc: "Live market intel", envKey: "VITE_PERPLEXITY_ENABLED", mock: true },
  { name: "Resend", desc: "Transactional email", envKey: "VITE_RESEND_ENABLED", mock: true },
  { name: "Stripe", desc: "Billing & subscriptions", envKey: "VITE_STRIPE_ENABLED", mock: false },
];

export default function Settings() {
  return (
    <PageShell>
      <ZoneHeader
        eyebrow="System"
        title="Settings"
        subtitle="Workspace configuration, integrations, and ATOM behavior."
        icon={<SettingsIcon size={22} />}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard className="p-5">
          <p className="text-xs font-mono uppercase tracking-[0.2em] mb-4" style={{ color: SALES_OS.cyan }}>
            Workspace
          </p>
          <div className="space-y-4">
            <SettingRow label="Brand" value="ATOM Sales OS" />
            <SettingRow label="Theme" value="Dark Cinematic (locked)" />
            <SettingRow label="Primary Color" value="#00d4ff" swatch="#00d4ff" />
            <SettingRow label="Accent Color" value="#7c3aed" swatch="#7c3aed" />
            <SettingRow label="Timezone" value="America/New_York" />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-xs font-mono uppercase tracking-[0.2em] mb-4" style={{ color: SALES_OS.cyan }}>
            Integrations
          </p>
          <div className="space-y-2">
            {INTEGRATIONS.map((it) => {
              const connected = envConnected(it.envKey) || it.mock;
              return (
                <div
                  key={it.name}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>{it.name}</p>
                    <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.5)" }}>{it.desc}</p>
                  </div>
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full"
                    style={
                      connected
                        ? { background: "rgba(52,211,153,0.14)", color: "#34d399" }
                        : { background: "rgba(148,163,184,0.14)", color: "#94a3b8" }
                    }
                  >
                    {connected ? <Check size={11} /> : <X size={11} />}
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </PageShell>
  );
}

function SettingRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "rgba(246,248,255,0.55)" }}>{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "#f6f8ff" }}>
        {swatch && <span className="w-4 h-4 rounded" style={{ background: swatch, border: "1px solid rgba(255,255,255,0.2)" }} />}
        {value}
      </span>
    </div>
  );
}
