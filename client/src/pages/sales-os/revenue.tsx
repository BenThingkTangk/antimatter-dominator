import { TrendingUp } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
  fmtCurrency,
} from "@/components/sales-os/SalesOsUI";
import { PROSPECTS, PIPELINE_TOTAL, FORECAST_TOTAL, VERTICAL_COLORS } from "@/data/warroom-seed";

export default function Revenue() {
  const byVertical = PROSPECTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.vertical] = (acc[p.vertical] || 0) + p.dealValue;
    return acc;
  }, {});
  const maxVert = Math.max(...Object.values(byVertical));
  const attainPct = Math.round((FORECAST_TOTAL / PIPELINE_TOTAL) * 100);

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 05"
        title="Revenue"
        subtitle="Pipeline value vs. forecast, ROI, and ATOM's contribution to closed revenue."
        icon={<TrendingUp size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Pipeline Value" value={fmtCurrency(PIPELINE_TOTAL)} delta="+18% MoM" />
        <StatTile label="Forecast" value={fmtCurrency(FORECAST_TOTAL)} delta={`${attainPct}% of pipeline`} accent={SALES_OS.violet} />
        <StatTile label="ATOM ROI" value="6.4x" delta="vs. SDR cost" accent="#34d399" />
        <StatTile label="Win Rate" value="31%" delta="+5pts" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard glow className="p-5">
          <p className="text-xs font-mono uppercase tracking-[0.2em] mb-5" style={{ color: SALES_OS.cyan }}>
            Pipeline vs. Forecast
          </p>
          <ArcGauge pct={attainPct} />
          <div className="flex items-center justify-around mt-4">
            <div className="text-center">
              <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.45)" }}>Pipeline</p>
              <p className="text-lg font-bold" style={{ color: SALES_OS.cyan }}>{fmtCurrency(PIPELINE_TOTAL)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.45)" }}>Forecast</p>
              <p className="text-lg font-bold" style={{ color: SALES_OS.violet }}>{fmtCurrency(FORECAST_TOTAL)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="text-xs font-mono uppercase tracking-[0.2em] mb-5" style={{ color: SALES_OS.cyan }}>
            Pipeline by Vertical · ROI bars
          </p>
          <div className="space-y-3">
            {Object.entries(byVertical)
              .sort((a, b) => b[1] - a[1])
              .map(([v, val]) => (
                <div key={v}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "rgba(246,248,255,0.7)" }}>{v}</span>
                    <span className="text-xs font-mono tabular-nums" style={{ color: "#f6f8ff" }}>{fmtCurrency(val)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(val / maxVert) * 100}%`,
                        background: `linear-gradient(90deg, ${VERTICAL_COLORS[v as keyof typeof VERTICAL_COLORS]}, #00d4ff)`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </GlassCard>
      </div>
    </PageShell>
  );
}

function ArcGauge({ pct }: { pct: number }) {
  const r = 80;
  const circ = Math.PI * r; // semicircle
  const dash = (pct / 100) * circ;
  return (
    <div className="flex justify-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        <defs>
          <linearGradient id="arcgrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#00d4ff" />
          </linearGradient>
        </defs>
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 20 110 A 90 90 0 0 1 200 110"
          fill="none"
          stroke="url(#arcgrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 283} 283`}
          style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.5))" }}
        />
        <text x="110" y="95" textAnchor="middle" fontSize="30" fontWeight="700" fill="#f6f8ff">
          {pct}%
        </text>
        <text x="110" y="115" textAnchor="middle" fontSize="10" fill="rgba(246,248,255,0.45)" fontFamily="monospace">
          ATTAINMENT
        </text>
      </svg>
    </div>
  );
}
