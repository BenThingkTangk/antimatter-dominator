import { Megaphone, Mail, Linkedin, Phone, MessageSquare, Rocket } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";

const SEQUENCE = [
  { day: "Day 1", channel: "Email", icon: Mail, color: "#f5c842" },
  { day: "Day 2", channel: "LinkedIn", icon: Linkedin, color: "#38bdf8" },
  { day: "Day 3", channel: "Call", icon: Phone, color: "#00d4ff" },
  { day: "Day 5", channel: "SMS", icon: MessageSquare, color: "#7c3aed" },
];

const CAMPAIGNS = [
  { name: "Q3 SaaS Expansion", vertical: "SaaS", contacts: 1240, sent: 982, open: 47, reply: 12, status: "Active" },
  { name: "Logistics Reactivation", vertical: "Logistics", contacts: 640, sent: 410, open: 39, reply: 8, status: "Active" },
  { name: "Healthcare ABM", vertical: "Healthcare", contacts: 320, sent: 188, open: 52, reply: 17, status: "Active" },
  { name: "Fintech Founders", vertical: "Fintech", contacts: 510, sent: 0, open: 0, reply: 0, status: "Scheduled" },
];

export default function Campaigns() {
  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 03"
        title="Campaigns"
        subtitle="Multichannel outbound orchestration — ATOM runs the cadence."
        icon={<Megaphone size={22} />}
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: SALES_OS.cyan, color: "#04121a" }}
          >
            <Rocket size={14} /> New Campaign
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Active Campaigns" value="3" delta="1 scheduled" />
        <StatTile label="Contacts Engaged" value="1,580" delta="+340 this week" accent={SALES_OS.violet} />
        <StatTile label="Avg Open Rate" value="46%" delta="above target" accent="#34d399" />
        <StatTile label="Replies" value="37" delta="ATOM-handled" />
      </div>

      <GlassCard className="p-5 mb-6">
        <p className="text-xs font-mono uppercase tracking-[0.2em] mb-4" style={{ color: SALES_OS.cyan }}>
          Standard Outbound Sequence
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {SEQUENCE.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.day} className="flex items-center gap-2 shrink-0">
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                  style={{ background: `${step.color}14`, border: `1px solid ${step.color}44` }}
                >
                  <Icon size={16} style={{ color: step.color }} />
                  <div>
                    <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.5)" }}>
                      {step.day}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>
                      {step.channel}
                    </p>
                  </div>
                </div>
                {i < SEQUENCE.length - 1 && (
                  <div className="w-6 h-px shrink-0" style={{ background: "rgba(0,212,255,0.3)" }} />
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.14)" }}>
              {["Campaign", "Vertical", "Contacts", "Sent", "Open %", "Reply %", "Status"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider font-medium"
                  style={{ color: "rgba(246,248,255,0.45)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAMPAIGNS.map((c) => (
              <tr key={c.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-4 py-3 font-semibold" style={{ color: "#f6f8ff" }}>{c.name}</td>
                <td className="px-4 py-3" style={{ color: "rgba(246,248,255,0.6)" }}>{c.vertical}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "rgba(246,248,255,0.7)" }}>{c.contacts}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "rgba(246,248,255,0.7)" }}>{c.sent}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: SALES_OS.cyan }}>{c.open}%</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: "#34d399" }}>{c.reply}%</td>
                <td className="px-4 py-3">
                  <span
                    className="text-[10px] font-mono uppercase px-2 py-1 rounded-full"
                    style={
                      c.status === "Active"
                        ? { background: "rgba(52,211,153,0.14)", color: "#34d399" }
                        : { background: "rgba(245,200,66,0.14)", color: "#f5c842" }
                    }
                  >
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </PageShell>
  );
}
