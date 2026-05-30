import { Handshake, ExternalLink } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
  fmtCurrency,
} from "@/components/sales-os/SalesOsUI";

const PARTNERS = [
  { name: "Vertex Growth Agency", tier: "Platinum", tenants: 14, mrr: 42000, status: "Active" },
  { name: "Cascade Revenue Partners", tier: "Gold", tenants: 8, mrr: 21000, status: "Active" },
  { name: "Northgate Consulting", tier: "Gold", tenants: 6, mrr: 15500, status: "Active" },
  { name: "Bluewave Outbound", tier: "Silver", tenants: 3, mrr: 6800, status: "Onboarding" },
];

const TIER_COLOR: Record<string, string> = {
  Platinum: "#00d4ff",
  Gold: "#f5c842",
  Silver: "#94a3b8",
};

export default function Partners() {
  const totalMrr = PARTNERS.reduce((s, p) => s + p.mrr, 0);
  const totalTenants = PARTNERS.reduce((s, p) => s + p.tenants, 0);

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="System"
        title="Partners"
        subtitle="White-label resellers and sub-tenant agencies running on ATOM Sales OS."
        icon={<Handshake size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Active Partners" value={`${PARTNERS.length}`} delta="3 active" />
        <StatTile label="Sub-tenants" value={`${totalTenants}`} delta="white-labeled" accent={SALES_OS.violet} />
        <StatTile label="Partner MRR" value={fmtCurrency(totalMrr)} delta="+12% MoM" accent="#34d399" />
        <StatTile label="Avg Tenants/Partner" value={`${Math.round(totalTenants / PARTNERS.length)}`} delta="growing" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {PARTNERS.map((p) => (
          <GlassCard key={p.name} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold" style={{ color: "#f6f8ff" }}>{p.name}</h3>
                <span
                  className="inline-block mt-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: `${TIER_COLOR[p.tier]}22`, color: TIER_COLOR[p.tier] }}
                >
                  {p.tier} Partner
                </span>
              </div>
              <ExternalLink size={16} style={{ color: "rgba(246,248,255,0.4)" }} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>Tenants</p>
                <p className="text-lg font-bold" style={{ color: "#f6f8ff" }}>{p.tenants}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>MRR</p>
                <p className="text-lg font-bold" style={{ color: SALES_OS.cyan }}>{fmtCurrency(p.mrr)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>Status</p>
                <p className="text-sm font-semibold mt-1" style={{ color: p.status === "Active" ? "#34d399" : "#f5c842" }}>
                  {p.status}
                </p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </PageShell>
  );
}
