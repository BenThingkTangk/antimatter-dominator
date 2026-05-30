import { useMemo, useState } from "react";
import { ShieldCheck, Download, Search, FileText, AlertTriangle } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
} from "@/components/sales-os/SalesOsUI";

type Tab = "consent" | "transcripts" | "disclosures" | "audit";

interface ConsentRow {
  contact: string;
  type: string;
  timestamp: string;
  method: string;
  status: "Granted" | "Revoked" | "Pending";
}

const CONSENT_LOG: ConsentRow[] = [
  { contact: "Dana Whitfield", type: "Call recording", timestamp: "2026-05-28 09:14", method: "Verbal (call)", status: "Granted" },
  { contact: "Carlos Reyna", type: "SMS outreach", timestamp: "2026-05-27 16:02", method: "Web form", status: "Granted" },
  { contact: "Priya Anand", type: "Email marketing", timestamp: "2026-05-26 11:48", method: "Double opt-in", status: "Granted" },
  { contact: "Marcus Lin", type: "Call recording", timestamp: "2026-05-25 14:31", method: "Verbal (call)", status: "Revoked" },
  { contact: "Elena Brooks", type: "SMS outreach", timestamp: "2026-05-24 10:09", method: "Web form", status: "Pending" },
  { contact: "Tom Okafor", type: "Email marketing", timestamp: "2026-05-23 08:55", method: "Double opt-in", status: "Granted" },
];

interface Transcript {
  contact: string;
  company: string;
  date: string;
  optOut: boolean;
  text: string;
}

const TRANSCRIPTS: Transcript[] = [
  { contact: "Dana Whitfield", company: "Northwind Cloud", date: "2026-05-28", optOut: false, text: "ATOM: Hi Dana, this is ATOM calling on behalf of Antimatter. This call may be recorded for quality. Dana: Sure, go ahead. ATOM: We help RevOps teams cut SDR cost by 60%..." },
  { contact: "Marcus Lin", company: "Vault Pay", date: "2026-05-25", optOut: true, text: "ATOM: Hi Marcus, this call may be recorded... Marcus: Actually, please remove me from your list. ATOM: Understood — I've logged your opt-out and you won't be contacted again." },
  { contact: "Priya Anand", company: "Cedarline Health", date: "2026-05-26", optOut: false, text: "ATOM: Hi Priya, may I have two minutes? Priya: Yes. ATOM: Cedarline just acquired three clinics — congratulations. We can help scale your patient outreach..." },
];

const DISCLOSURES = [
  { campaign: "Q3 SaaS Expansion", recording: 982, optOut: 980, dnc: 982, coverage: 99.8 },
  { campaign: "Logistics Reactivation", recording: 410, optOut: 408, dnc: 410, coverage: 99.5 },
  { campaign: "Healthcare ABM", recording: 188, optOut: 188, dnc: 188, coverage: 100 },
];

const AUDIT_TRAIL = [
  { time: "2026-05-28 09:14:22", action: "Call recording consent captured", actor: "ATOM Agent", tenant: "antimatter", user: "—" },
  { time: "2026-05-28 09:02:10", action: "DNC list synced (1,204 numbers)", actor: "System", tenant: "antimatter", user: "system@atom" },
  { time: "2026-05-25 14:31:55", action: "Opt-out honored — Marcus Lin", actor: "ATOM Agent", tenant: "antimatter", user: "—" },
  { time: "2026-05-24 18:20:03", action: "Campaign 'Fintech Founders' compliance review passed", actor: "Admin", tenant: "antimatter", user: "ben@antimatter.ai" },
  { time: "2026-05-23 08:55:41", action: "TCPA disclosure played before outbound", actor: "ATOM Agent", tenant: "antimatter", user: "—" },
];

function toCSV(): string {
  const rows = [["contact", "consent_type", "timestamp", "method", "status"]];
  CONSENT_LOG.forEach((r) => rows.push([r.contact, r.type, r.timestamp, r.method, r.status]));
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV() {
  const blob = new Blob([toCSV()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atom-compliance-consent-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const STATUS_COLOR: Record<string, string> = {
  Granted: "#34d399",
  Revoked: "#fb7185",
  Pending: "#f5c842",
};

export default function ComplianceVault() {
  const [tab, setTab] = useState<Tab>("consent");
  const [query, setQuery] = useState("");

  const filteredTranscripts = useMemo(
    () =>
      TRANSCRIPTS.filter(
        (t) =>
          t.text.toLowerCase().includes(query.toLowerCase()) ||
          t.contact.toLowerCase().includes(query.toLowerCase()) ||
          t.company.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="System"
        title="Compliance Vault"
        subtitle="Consent, disclosures, transcripts, and a full audit trail — TCPA / GDPR / FCC ready."
        icon={<ShieldCheck size={22} />}
        actions={
          <button
            onClick={downloadCSV}
            data-testid="compliance-export-csv"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: SALES_OS.cyan, color: "#04121a" }}
          >
            <Download size={14} /> Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Consent Records" value={`${CONSENT_LOG.length}`} delta="logged" />
        <StatTile label="Opt-out Honored" value="100%" delta="0 violations" accent="#34d399" />
        <StatTile label="Disclosure Coverage" value="99.8%" delta="all campaigns" accent={SALES_OS.violet} />
        <StatTile label="Audit Events" value={`${AUDIT_TRAIL.length}`} delta="immutable" />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {([
          ["consent", "Consent Log"],
          ["transcripts", "Transcripts"],
          ["disclosures", "Disclosures"],
          ["audit", "Audit Trail"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            data-testid={`compliance-tab-${key}`}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={
              tab === key
                ? { background: "rgba(0,212,255,0.12)", color: SALES_OS.cyan, border: "1px solid rgba(0,212,255,0.3)" }
                : { color: "rgba(246,248,255,0.55)", border: "1px solid transparent" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "consent" && (
        <GlassCard className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.14)" }}>
                {["Contact", "Consent Type", "Timestamp", "Method", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(246,248,255,0.45)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONSENT_LOG.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#f6f8ff" }}>{r.contact}</td>
                  <td className="px-4 py-3" style={{ color: "rgba(246,248,255,0.65)" }}>{r.type}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "rgba(246,248,255,0.55)" }}>{r.timestamp}</td>
                  <td className="px-4 py-3" style={{ color: "rgba(246,248,255,0.65)" }}>{r.method}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-mono uppercase px-2 py-1 rounded-full" style={{ background: `${STATUS_COLOR[r.status]}22`, color: STATUS_COLOR[r.status] }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {tab === "transcripts" && (
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(246,248,255,0.4)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts…"
              data-testid="compliance-transcript-search"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.18)", color: "#f6f8ff" }}
            />
          </div>
          <div className="space-y-3">
            {filteredTranscripts.length === 0 ? (
              <GlassCard className="p-6 text-center text-sm" style={{ color: "rgba(246,248,255,0.4)" }}>
                No transcripts match "{query}"
              </GlassCard>
            ) : (
              filteredTranscripts.map((t, i) => (
                <GlassCard key={i} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} style={{ color: SALES_OS.cyan }} />
                      <span className="text-sm font-semibold" style={{ color: "#f6f8ff" }}>{t.contact} · {t.company}</span>
                      <span className="text-[11px] font-mono" style={{ color: "rgba(246,248,255,0.45)" }}>{t.date}</span>
                    </div>
                    {t.optOut && (
                      <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1 rounded-full" style={{ background: "rgba(251,113,133,0.15)", color: "#fb7185" }}>
                        <AlertTriangle size={11} /> Opt-out
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(246,248,255,0.6)" }}>{t.text}</p>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "disclosures" && (
        <GlassCard className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.14)" }}>
                {["Campaign", "Recording Disclosure", "Opt-out Offered", "DNC Checked", "Coverage"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(246,248,255,0.45)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISCLOSURES.map((d) => (
                <tr key={d.campaign} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#f6f8ff" }}>{d.campaign}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: "rgba(246,248,255,0.7)" }}>{d.recording}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: "rgba(246,248,255,0.7)" }}>{d.optOut}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: "rgba(246,248,255,0.7)" }}>{d.dnc}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: d.coverage === 100 ? "#34d399" : SALES_OS.cyan }}>{d.coverage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {tab === "audit" && (
        <GlassCard className="p-5">
          <div className="relative pl-6">
            <div className="absolute left-2 top-1 bottom-1 w-px" style={{ background: "rgba(0,212,255,0.25)" }} />
            {AUDIT_TRAIL.map((e, i) => (
              <div key={i} className="relative mb-5 last:mb-0">
                <span className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full" style={{ background: SALES_OS.cyan, boxShadow: `0 0 8px ${SALES_OS.cyan}` }} />
                <p className="text-sm font-medium" style={{ color: "#f6f8ff" }}>{e.action}</p>
                <p className="text-[11px] font-mono mt-0.5" style={{ color: "rgba(246,248,255,0.45)" }}>
                  {e.time} · {e.actor} · tenant: {e.tenant} · user: {e.user}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}
