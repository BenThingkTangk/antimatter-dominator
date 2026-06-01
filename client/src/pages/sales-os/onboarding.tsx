import { useState } from "react";
import {
  Rocket,
  Building2,
  Plug,
  Users,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";

type Role = "Admin" | "Sales Rep" | "Partner";

interface Member {
  email: string;
  role: Role;
}

const INTEGRATIONS = [
  { key: "apollo", name: "Apollo", desc: "Prospect data", envKey: "VITE_APOLLO_ENABLED" },
  { key: "hume", name: "Hume", desc: "Voice emotion AI", envKey: "VITE_HUME_ENABLED" },
  { key: "perplexity", name: "Perplexity", desc: "Market intel", envKey: "VITE_PERPLEXITY_ENABLED" },
  { key: "resend", name: "Resend", desc: "Email delivery", envKey: "VITE_RESEND_ENABLED" },
  { key: "stripe", name: "Stripe", desc: "Billing", envKey: "VITE_STRIPE_ENABLED" },
];

function envPresent(key: string): boolean {
  try {
    return Boolean((import.meta as any).env?.[key]);
  } catch {
    return false;
  }
}

const STEPS = [
  { n: 1, label: "Org Setup", icon: Building2 },
  { n: 2, label: "Integrations", icon: Plug },
  { n: 3, label: "Team", icon: Users },
  { n: 4, label: "Launch", icon: Rocket },
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [brandColor, setBrandColor] = useState("#00d4ff");
  const [slug, setSlug] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [connected, setConnected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    INTEGRATIONS.forEach((i) => (init[i.key] = envPresent(i.envKey)));
    return init;
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("Sales Rep");
  const [launched, setLaunched] = useState(false);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="System"
        title={isPartner ? "Partner Onboarding" : "Onboarding"}
        subtitle={
          isPartner
            ? "Spin up a white-labeled sub-tenant on ATOM Sales OS in 90 seconds."
            : "Get your workspace live on ATOM Sales OS in four steps."
        }
        icon={<Rocket size={22} />}
        actions={
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "rgba(246,248,255,0.6)" }}>
            <input
              type="checkbox"
              checked={isPartner}
              onChange={(e) => setIsPartner(e.target.checked)}
              data-testid="onboarding-partner-toggle"
            />
            Partner / sub-tenant
          </label>
        }
      />

      {/* Stepper */}
      <div className="flex items-center justify-between mb-6 max-w-2xl">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: active ? SALES_OS.cyan : done ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${active ? SALES_OS.cyan : done ? "#34d399" : "rgba(255,255,255,0.12)"}`,
                    color: active ? "#04121a" : done ? "#34d399" : "rgba(246,248,255,0.5)",
                  }}
                >
                  {done ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className="text-[10px] font-mono uppercase" style={{ color: active ? SALES_OS.cyan : "rgba(246,248,255,0.45)" }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-2" style={{ background: done ? "#34d399" : "rgba(255,255,255,0.1)" }} />
              )}
            </div>
          );
        })}
      </div>

      <GlassCard glow className="p-6 max-w-2xl">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>Organization Setup</h3>
            <Input label="Organization name" value={orgName} onChange={setOrgName} placeholder="Acme Revenue Co." testid="onboarding-org-name" />
            <div>
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(0,212,255,0.3)", color: "rgba(246,248,255,0.4)" }}>
                  <Building2 size={20} />
                </div>
                <button className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(0,212,255,0.12)", color: SALES_OS.cyan, border: "1px solid rgba(0,212,255,0.3)" }}>
                  Upload logo
                </button>
              </div>
            </div>
            <div>
              <Label>Brand color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" data-testid="onboarding-brand-color" />
                <span className="text-sm font-mono" style={{ color: "#f6f8ff" }}>{brandColor}</span>
              </div>
            </div>
            <div>
              <Label>Subdomain slug</Label>
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,212,255,0.18)" }}>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="acme"
                  data-testid="onboarding-slug"
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
                  style={{ color: "#f6f8ff" }}
                />
                <span className="px-3 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(246,248,255,0.5)" }}>
                  .atom-sales-os.com
                </span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>Connect Integrations</h3>
            <p className="text-sm" style={{ color: "rgba(246,248,255,0.55)" }}>
              Toggle the systems ATOM should operate. Detected from your environment where available.
            </p>
            <div className="space-y-2">
              {INTEGRATIONS.map((it) => (
                <label
                  key={it.key}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>{it.name}</p>
                    <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.5)" }}>{it.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!connected[it.key]}
                    onChange={(e) => setConnected((c) => ({ ...c, [it.key]: e.target.checked }))}
                    data-testid={`onboarding-int-${it.key}`}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>Add Team Members</h3>
            <div className="flex gap-2">
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="teammate@company.com"
                data-testid="onboarding-member-email"
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", color: "#f6f8ff" }}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                data-testid="onboarding-member-role"
                className="px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", color: "#f6f8ff" }}
              >
                <option>Admin</option>
                <option>Sales Rep</option>
                <option>Partner</option>
              </select>
              <button
                onClick={() => {
                  if (!newEmail.trim()) return;
                  setMembers((m) => [...m, { email: newEmail.trim(), role: newRole }]);
                  setNewEmail("");
                }}
                data-testid="onboarding-member-add"
                className="px-4 rounded-xl text-sm font-semibold"
                style={{ background: SALES_OS.cyan, color: "#04121a" }}
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: "rgba(246,248,255,0.4)" }}>No team members yet</p>
              ) : (
                members.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.1)" }}>
                    <span className="text-sm" style={{ color: "#f6f8ff" }}>{m.email}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.18)", color: "#a78bfa" }}>{m.role}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>Launch Your First Campaign</h3>
            {launched ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(52,211,153,0.15)", border: "1px solid #34d399" }}>
                  <Check size={28} style={{ color: "#34d399" }} />
                </div>
                <p className="text-lg font-bold" style={{ color: "#f6f8ff" }}>
                  {isPartner ? "Sub-tenant live" : "Workspace live"} — ATOM is dialing.
                </p>
                <p className="text-sm mt-1" style={{ color: "rgba(246,248,255,0.55)" }}>
                  Your first campaign is now active on the {orgName || (isPartner ? "white-label" : "your")} workspace.
                </p>
              </div>
            ) : (
              <>
                <GlassCard className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} style={{ color: SALES_OS.cyan }} />
                    <span className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>Pre-filled: "First 100 Prospects"</span>
                  </div>
                  <p className="text-xs" style={{ color: "rgba(246,248,255,0.55)" }}>
                    Day 1 Email → Day 2 LinkedIn → Day 3 Call → Day 5 SMS. Targets auto-selected by ATOM from your highest-intent accounts.
                  </p>
                </GlassCard>
                <button
                  onClick={() => setLaunched(true)}
                  data-testid="onboarding-launch"
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(90deg, #7c3aed, #00d4ff)", color: "#04121a" }}
                >
                  <Rocket size={16} /> Activate Campaign
                </button>
              </>
            )}
          </div>
        )}

        {/* Nav */}
        {!(step === 4 && launched) && (
          <div className="flex items-center justify-between mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={back}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm disabled:opacity-30"
              style={{ color: "rgba(246,248,255,0.6)" }}
            >
              <ArrowLeft size={14} /> Back
            </button>
            {step < 4 && (
              <button
                onClick={next}
                data-testid="onboarding-next"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: SALES_OS.cyan, color: "#04121a" }}
              >
                Continue <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </GlassCard>
    </PageShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-mono uppercase tracking-wider mb-1.5" style={{ color: "rgba(246,248,255,0.5)" }}>
      {children}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testid?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", color: "#f6f8ff" }}
      />
    </div>
  );
}
