import { TrendingUp, ArrowUpRight, Bot, Sparkles } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
  fmtCurrency,
} from "@/components/sales-os/SalesOsUI";
import { PROSPECTS, PIPELINE_TOTAL, FORECAST_TOTAL, VERTICAL_COLORS } from "@/data/warroom-seed";
import { useSalesOsDemo } from "@/lib/sales-os-demo";

// Seeded 8-week trajectory (committed forecast, $K) — deterministic, climbs.
const TRAJECTORY = [410, 438, 452, 489, 531, 560, 598, 642];

export default function Revenue() {
  const { demoActive, demoStep } = useSalesOsDemo();
  const byVertical = PROSPECTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.vertical] = (acc[p.vertical] || 0) + p.dealValue;
    return acc;
  }, {});
  const maxVert = Math.max(...Object.values(byVertical));
  const attainPct = Math.round((FORECAST_TOTAL / PIPELINE_TOTAL) * 100);

  // ATOM attribution — share of pipeline ATOM sourced / influenced.
  const atomInfluenced = Math.round(PIPELINE_TOTAL * 0.62);
  // When the investor demo reaches "forecast updated", bump the delta to show
  // the storyline closing the loop on revenue.
  const forecastDelta = demoActive && demoStep >= 5 ? 184000 : 132000;

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

      {/* Forecast delta + ATOM impact attribution */}
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <GlassCard glow className="p-5 relative overflow-hidden" data-testid="forecast-delta">
          <span
            className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full blur-3xl opacity-40"
            style={{ background: "#34d399" }}
          />
          <p className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: "rgba(246,248,255,0.45)" }}>
            Forecast Delta · this week
          </p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color: "#34d399" }}>
              +{fmtCurrency(forecastDelta)}
            </span>
            <span className="flex items-center gap-1 text-xs mb-1" style={{ color: "#34d399" }}>
              <ArrowUpRight size={13} /> committed
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: "rgba(246,248,255,0.5)" }}>
            {demoActive && demoStep >= 5
              ? "Northwind Cloud moved to commit — recalculated live."
              : "Two deals advanced to Negotiation this week."}
          </p>
        </GlassCard>

        <GlassCard className="p-5 md:col-span-2 relative overflow-hidden" data-testid="atom-impact">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.18)", color: "#c4b5fd" }}
            >
              <Bot size={16} />
            </div>
            <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "#c4b5fd" }}>
              ATOM Impact
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold" style={{ color: "#f6f8ff" }}>{fmtCurrency(atomInfluenced)}</p>
              <p className="text-[10px] font-mono uppercase mt-0.5" style={{ color: "rgba(246,248,255,0.45)" }}>
                Pipeline influenced
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: SALES_OS.cyan }}>62%</p>
              <p className="text-[10px] font-mono uppercase mt-0.5" style={{ color: "rgba(246,248,255,0.45)" }}>
                Of all pipeline
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#34d399" }}>3.1×</p>
              <p className="text-[10px] font-mono uppercase mt-0.5" style={{ color: "rgba(246,248,255,0.45)" }}>
                Faster to first meeting
              </p>
            </div>
          </div>
          <div className="h-1.5 mt-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: "62%", background: "linear-gradient(90deg,#7c3aed,#00d4ff)" }} />
          </div>
        </GlassCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
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

      {/* Quarter trajectory */}
      <GlassCard className="p-5" data-testid="revenue-trajectory">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} style={{ color: SALES_OS.cyan }} />
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: SALES_OS.cyan }}>
            Committed Forecast Trajectory · 8 weeks
          </p>
        </div>
        <TrajectoryChart points={TRAJECTORY} />
      </GlassCard>
    </PageShell>
  );
}

function TrajectoryChart({ points }: { points: number[] }) {
  const w = 720;
  const h = 140;
  const pad = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1][0]} ${h} L ${coords[0][0]} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 140 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="traj-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,212,255,0.35)" />
          <stop offset="100%" stopColor="rgba(0,212,255,0)" />
        </linearGradient>
        <linearGradient id="traj-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#traj-fill)" />
      <path d={line} fill="none" stroke="url(#traj-line)" strokeWidth="2.5" strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.4))" }} />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === coords.length - 1 ? 4 : 2.5}
          fill={i === coords.length - 1 ? "#00d4ff" : "#7c3aed"} />
      ))}
    </svg>
  );
}

function ArcGauge({ pct }: { pct: number }) {
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
