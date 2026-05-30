import { useState } from "react";
import { Brain } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
  fmtCurrency,
} from "@/components/sales-os/SalesOsUI";
import { PROSPECTS, VERTICAL_COLORS, Prospect } from "@/data/warroom-seed";

// 2D projection of the 3D buyer-intent space: X = company size, Y = urgency
// (intent), bubble size = likelihood, color = vertical. Mirrors the /xr scatter.
export default function BuyerIntel() {
  const [selected, setSelected] = useState<Prospect | null>(null);
  const maxSize = Math.max(...PROSPECTS.map((p) => p.companySize));

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 04"
        title="Buyer Intel"
        subtitle="ATOM's live intent map — urgency vs. company size, scored by likelihood."
        icon={<Brain size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Tracked Accounts" value={`${PROSPECTS.length}`} delta="real-time signals" />
        <StatTile label="Hot Signals" value="6" delta="funding + hiring" accent="#fb7185" />
        <StatTile label="Avg Likelihood" value="79%" delta="to engage" accent="#34d399" />
        <StatTile label="Verticals" value="10" delta="covered" accent={SALES_OS.violet} />
      </div>

      <GlassCard glow className="p-5">
        <p className="text-xs font-mono uppercase tracking-[0.2em] mb-4" style={{ color: SALES_OS.cyan }}>
          Intent Scatter · Urgency (Y) × Company Size (X)
        </p>
        <div
          className="relative rounded-xl"
          style={{ height: 360, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,212,255,0.12)" }}
        >
          {/* grid lines */}
          {[0, 25, 50, 75, 100].map((g) => (
            <div
              key={g}
              className="absolute left-0 right-0 h-px"
              style={{ bottom: `${g}%`, background: "rgba(255,255,255,0.05)" }}
            />
          ))}
          <span className="absolute left-2 top-2 text-[9px] font-mono" style={{ color: "rgba(246,248,255,0.4)" }}>
            ↑ Urgency
          </span>
          <span className="absolute right-2 bottom-2 text-[9px] font-mono" style={{ color: "rgba(246,248,255,0.4)" }}>
            Company size →
          </span>
          {PROSPECTS.map((p) => {
            const x = (p.companySize / maxSize) * 88 + 5;
            const y = p.intentScore * 0.86 + 5;
            const size = 14 + (p.dealValue / 310000) * 30;
            const color = VERTICAL_COLORS[p.vertical];
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                data-testid={`intel-dot-${p.id}`}
                className="absolute rounded-full transition-transform hover:scale-125"
                style={{
                  left: `${x}%`,
                  bottom: `${y}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, 50%)",
                  background: `${color}cc`,
                  border: `1.5px solid ${color}`,
                  boxShadow: `0 0 14px ${color}88`,
                }}
                title={p.company}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(VERTICAL_COLORS).map(([v, c]) => (
            <div key={v} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              <span className="text-[10px]" style={{ color: "rgba(246,248,255,0.55)" }}>{v}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(2,4,8,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelected(null)}
        >
          <GlassCard glow className="w-full max-w-md p-6" >
            <div onClick={(e) => e.stopPropagation()}>
              <span
                className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
                style={{ background: `${VERTICAL_COLORS[selected.vertical]}22`, color: VERTICAL_COLORS[selected.vertical] }}
              >
                {selected.vertical}
              </span>
              <h2 className="text-2xl font-bold mt-2" style={{ color: "#f6f8ff" }}>{selected.company}</h2>
              <p className="text-sm" style={{ color: "rgba(246,248,255,0.6)" }}>
                {selected.contact} · {selected.title}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <Field label="Deal Value" value={fmtCurrency(selected.dealValue)} />
                <Field label="Intent" value={`${selected.intentScore}/100`} />
                <Field label="Company Size" value={`${selected.companySize}`} />
                <Field label="Stage" value={selected.stage} />
              </div>
              <div className="mt-4 p-3 rounded-xl" style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)" }}>
                <p className="text-[10px] font-mono uppercase" style={{ color: SALES_OS.cyan }}>Signal</p>
                <p className="text-xs mt-0.5" style={{ color: "#f6f8ff" }}>{selected.fundingSignal}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: SALES_OS.cyan, color: "#04121a" }}
              >
                Close
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </PageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>{label}</p>
      <p className="font-semibold mt-0.5" style={{ color: "#f6f8ff" }}>{value}</p>
    </div>
  );
}
