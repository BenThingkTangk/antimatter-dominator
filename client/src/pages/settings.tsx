/**
 * /settings — Account & workspace settings.
 * Investor-grade landing surface that covers identity, security, notifications,
 * compliance posture, and integration status. Wires into the same /api/auth/me
 * session shape every other page already trusts.
 */
import { useState } from "react";
import { useSessionContext } from "@/auth/AuthGate";
import {
  User,
  Lock,
  Bell,
  ShieldCheck,
  CreditCard,
  Building2,
  Plug,
  ExternalLink,
} from "lucide-react";

type TabId = "profile" | "security" | "notifications" | "compliance" | "billing" | "integrations";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "compliance", label: "Compliance", icon: ShieldCheck },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Plug },
];

export default function SettingsPage() {
  const { user } = useSessionContext();
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-white/40 mb-2">
          ATOM · Settings
        </p>
        <h1
          className="text-2xl font-bold"
          style={{
            color: "var(--color-text, #f6f6fd)",
            fontFamily: "var(--font-display, inherit)",
            letterSpacing: "-0.4px",
          }}
        >
          Workspace Settings
        </h1>
        <p className="text-sm text-white/55 mt-1">
          Tune your identity, security posture, and how ATOM AI behaves for your team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition"
                style={{
                  background: active ? "rgba(0,200,200,0.10)" : "transparent",
                  border: `1px solid ${active ? "rgba(0,200,200,0.35)" : "transparent"}`,
                  color: active ? "#7fe7e7" : "rgba(255,255,255,0.7)",
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <section
          className="rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {tab === "profile" && (
            <Block title="Profile" subtitle="Your identity inside ATOM.">
              <Field label="Full name" value={user?.fullName || "—"} />
              <Field label="Email" value={user?.email || "—"} />
              <Field label="Role" value={user?.role || "member"} />
              <Field label="Tenant" value={(user as any)?.tenantSlug || "—"} />
              <Hint>
                Editing profile fields is being rolled out gradually. Need a change today? Email{" "}
                <a href="mailto:support@atom-sales.ai" className="underline">support@atom-sales.ai</a>.
              </Hint>
            </Block>
          )}

          {tab === "security" && (
            <Block title="Security" subtitle="Account protection and session controls.">
              <Field label="Password" value="••••••••••" />
              <Field label="Two-factor" value="Not enrolled" />
              <Field label="Active sessions" value="This device" />
              <a
                href="/#/reset-password"
                className="inline-flex items-center gap-2 mt-2 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "rgba(0,200,200,0.12)",
                  border: "1px solid rgba(0,200,200,0.35)",
                  color: "#7fe7e7",
                }}
              >
                Change password
              </a>
            </Block>
          )}

          {tab === "notifications" && (
            <Block title="Notifications" subtitle="What ATOM AI pings you about.">
              <ToggleRow label="Call completion summaries" defaultOn />
              <ToggleRow label="Hot-lead alerts" defaultOn />
              <ToggleRow label="Daily revenue digest" />
              <ToggleRow label="Compliance/DNC scrub alerts" defaultOn />
              <Hint>Preferences sync across web and mobile push.</Hint>
            </Block>
          )}

          {tab === "compliance" && (
            <Block title="Compliance" subtitle="Regulatory posture for outbound dialing.">
              <Field label="TCPA consent capture" value="Enabled (default)" />
              <Field label="DNC scrub cadence" value="Daily, 03:00 local" />
              <Field label="Call recording disclosure" value="Auto-injected pre-dial" />
              <Field label="Quiet hours" value="08:00 – 21:00 prospect-local" />
              <Field label="GDPR data residency" value="US-East (default)" />
              <Hint>
                These guardrails are enforced server-side. Contact compliance@atom-sales.ai to adjust
                jurisdiction or evidence retention.
              </Hint>
            </Block>
          )}

          {tab === "billing" && (
            <Block title="Billing" subtitle="Plan, seats, and invoices.">
              <a
                href="/#/billing"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: "rgba(0,200,200,0.12)",
                  border: "1px solid rgba(0,200,200,0.35)",
                  color: "#7fe7e7",
                }}
              >
                Open Billing <ExternalLink size={12} />
              </a>
              <Hint>Self-serve subscription, seats, and Stripe-hosted invoices.</Hint>
            </Block>
          )}

          {tab === "integrations" && (
            <Block title="Integrations" subtitle="ATOM AI talks to the systems you already use.">
              <IntegrationRow name="Email delivery" status="Connected" />
              <IntegrationRow name="Voice & call automation" status="Connected" />
              <IntegrationRow name="Prospect data" status="Connected" />
              <IntegrationRow name="CRM sync" status="Coming soon" />
              <Hint>Vendor names are hidden from your team — every action presents as ATOM AI.</Hint>
            </Block>
          )}
        </section>
      </div>
    </div>
  );
}

function Block({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <span className="text-xs uppercase tracking-wider text-white/45 font-mono">{label}</span>
      <span className="text-sm text-white/85">{value}</span>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/45 leading-relaxed pt-3">{children}</p>;
}

function ToggleRow({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-white/85">{label}</span>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        className="w-10 h-6 rounded-full transition relative"
        style={{
          background: on ? "rgba(0,200,200,0.45)" : "rgba(255,255,255,0.10)",
        }}
        aria-pressed={on}
      >
        <span
          className="absolute top-[2px] w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: on ? "calc(100% - 22px)" : "2px" }}
        />
      </button>
    </div>
  );
}

function IntegrationRow({ name, status }: { name: string; status: string }) {
  const connected = status === "Connected";
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5">
      <span className="text-sm text-white/85 flex items-center gap-2">
        <Building2 size={14} className="text-white/40" /> {name}
      </span>
      <span
        className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
        style={{
          background: connected ? "rgba(0,200,200,0.12)" : "rgba(255,255,255,0.06)",
          color: connected ? "#7fe7e7" : "rgba(255,255,255,0.55)",
          border: `1px solid ${connected ? "rgba(0,200,200,0.35)" : "rgba(255,255,255,0.10)"}`,
        }}
      >
        {status}
      </span>
    </div>
  );
}
