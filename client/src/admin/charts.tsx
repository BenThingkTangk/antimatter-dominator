/**
 * Chart primitives for the ΔTOM admin layer.
 *
 * Cohesive look: dark glass surface, teal `#00e6d3` plasma, Cabinet Grotesk
 * display numerals, JetBrains Mono axis labels, soft glow on actively-rising
 * values. All charts render at the size of their container — no fixed widths.
 *
 * Built on Recharts (already in the project) so they pick up window resize
 * for free. Every chart accepts an `emptyState` so a brand-new tenant
 * doesn't see broken or zero charts \u2014 we render a precise dark glass
 * placeholder instead.
 */
import React from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

// ──────────────────────────────────────────────────────────────────────────
// Tokens
// ──────────────────────────────────────────────────────────────────────────
export const ATOM_TEAL    = "#00e6d3";
export const ATOM_TEAL_2  = "#00a7ff";
export const ATOM_PURPLE  = "#9b7bff";
export const ATOM_AMBER   = "#ffd166";
export const ATOM_CORAL   = "#ff7569";
export const ATOM_GREEN   = "#72f2a1";
export const ATOM_DANGER  = "#ff6b8b";
export const ATOM_GRID    = "rgba(255,255,255,0.06)";
export const ATOM_TEXT    = "#edf8f8";
export const ATOM_MUTED   = "#9ca8ad";
export const ATOM_FAINT   = "#5e6970";

const AXIS_TICK_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fill: ATOM_FAINT,
  letterSpacing: "0.06em",
};

// ──────────────────────────────────────────────────────────────────────────
// Shared tooltip
// ──────────────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(8,11,14,0.96)",
      border: "1px solid rgba(0,230,211,0.18)",
      borderRadius: 8,
      padding: "8px 12px",
      boxShadow: "0 12px 36px -8px rgba(0,0,0,0.7)",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      color: ATOM_TEXT,
    }}>
      {label !== undefined && (
        <div style={{ color: ATOM_MUTED, marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
          <span style={{ color: ATOM_TEXT }}>
            {valueFormatter ? valueFormatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────────────────
export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: number;        // positive = green, negative = coral
  deltaSuffix?: string;  // e.g. "%", "MoM"
  tone?: "default" | "warn" | "danger" | "success";
  spark?: number[];      // optional sparkline data points
  icon?: React.ComponentType<{ size?: number }>;
}

export function KpiCard({ label, value, sub, delta, deltaSuffix = "%", tone = "default", spark, icon: Icon }: KpiCardProps) {
  const toneColor = tone === "danger" ? ATOM_DANGER : tone === "warn" ? ATOM_AMBER : tone === "success" ? ATOM_GREEN : ATOM_TEAL;
  const deltaColor = delta === undefined ? undefined : delta >= 0 ? ATOM_GREEN : ATOM_DANGER;
  return (
    <div className="atom-kpi-card" style={{
      position: "relative",
      background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
      border: `1px solid ${tone === "default" ? "rgba(255,255,255,0.06)" : `${toneColor}33`}`,
      borderRadius: 16,
      padding: 18,
      overflow: "hidden",
      boxShadow: tone === "default" ? "none" : `0 0 36px -10px ${toneColor}44`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: ATOM_MUTED,
        }}>{label}</span>
        {Icon && <Icon size={14} />}
      </div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: 32,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: toneColor,
        textShadow: `0 0 24px ${toneColor}33`,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1.1,
      }}>{value}</div>
      <div style={{
        marginTop: 6,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 10,
      }}>
        <span style={{ fontSize: 12, color: ATOM_MUTED }}>{sub}</span>
        {delta !== undefined && (
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: deltaColor,
            fontWeight: 700,
          }}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}{deltaSuffix}
          </span>
        )}
      </div>
      {spark && spark.length > 1 && (
        <div style={{ position: "absolute", inset: "auto 0 0 0", height: 36, opacity: 0.5 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s+/g, "-")}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%"   stopColor={toneColor} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={toneColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="v" stroke={toneColor} strokeWidth={1.5} fill={`url(#spark-${label.replace(/\s+/g, "-")})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Card wrapper
// ──────────────────────────────────────────────────────────────────────────
export function ChartCard({ title, subtitle, action, children, height = 240 }:
  { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; height?: number }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,22,27,0.92), rgba(10,16,20,0.92))",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      padding: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: ATOM_MUTED,
            marginBottom: 4,
          }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: ATOM_TEXT }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// LineSpark — single-line trend
// ──────────────────────────────────────────────────────────────────────────
export function LineSpark({ data, xKey = "x", yKey = "y", color = ATOM_TEAL }:
  { data: any[]; xKey?: string; yKey?: string; color?: string }) {
  if (!data?.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={ATOM_GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: ATOM_GRID }} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// AreaStack — multi-series stacked area
// ──────────────────────────────────────────────────────────────────────────
export function AreaStack({ data, xKey = "x", series, valueFormatter }:
  { data: any[]; xKey?: string; series: { key: string; label: string; color: string }[]; valueFormatter?: (v: any) => string }) {
  if (!data?.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <defs>
          {series.map((s) => (
            <linearGradient id={`area-${s.key}`} key={s.key} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={ATOM_GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} cursor={{ stroke: ATOM_GRID }} />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: ATOM_MUTED }}
        />
        {series.map((s) => (
          <Area key={s.key} type="monotone" stackId="a" name={s.label} dataKey={s.key} stroke={s.color}
            strokeWidth={1.5} fill={`url(#area-${s.key})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// BarStack — vertical bar chart with optional stack
// ──────────────────────────────────────────────────────────────────────────
export function BarStack({ data, xKey = "x", series, layout = "vertical" }:
  { data: any[]; xKey?: string; series: { key: string; label: string; color: string }[]; layout?: "vertical" | "horizontal" }) {
  if (!data?.length) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={layout === "horizontal" ? "vertical" : "horizontal"} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid stroke={ATOM_GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} width={36} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,230,211,0.04)" }} />
        <Legend
          iconSize={8}
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: ATOM_MUTED }}
        />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={series.length > 1 ? "a" : undefined}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DonutMix — single donut chart
// ──────────────────────────────────────────────────────────────────────────
export function DonutMix({ data, valueKey = "value", nameKey = "name" }:
  { data: any[]; valueKey?: string; nameKey?: string }) {
  if (!data?.length) return <EmptyState />;
  const palette = [ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_CORAL, ATOM_GREEN];
  const total = data.reduce((a, d) => a + (d[valueKey] || 0), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip content={<ChartTooltip />} />
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
        </Pie>
        <Legend
          iconSize={8}
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", color: ATOM_MUTED }}
        />
        {/* Center total */}
        <text x="50%" y="46%" textAnchor="middle" style={{
          fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, fill: ATOM_TEAL,
          letterSpacing: "-0.02em",
        }}>
          {total}
        </text>
        <text x="50%" y="56%" textAnchor="middle" style={{
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em",
          fill: ATOM_MUTED, textTransform: "uppercase",
        }}>
          Total
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// HeatmapGrid — hour x day-of-week activity heatmap
// ──────────────────────────────────────────────────────────────────────────
export function HeatmapGrid({ data, hours = 24, days = 7, max }:
  { data: number[][]; hours?: number; days?: number; max?: number }) {
  // data is [day][hour] = count
  const flat = data.flat();
  const m = max ?? Math.max(1, ...flat);
  const dayLabels = ["S","M","T","W","T","F","S"];
  return (
    <div style={{ display: "flex", gap: 6, height: "100%", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, justifyContent: "space-around" }}>
        {dayLabels.slice(0, days).map((d, i) => (
          <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: ATOM_FAINT, width: 12, textAlign: "center" }}>{d}</span>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${hours}, 1fr)`, gap: 2, height: "100%" }}>
        {data.flatMap((row, day) => row.map((v, hour) => {
          const t = v / m;
          const alpha = 0.05 + t * 0.95;
          return (
            <div key={`${day}-${hour}`} title={`Day ${day} ${hour}:00 — ${v}`} style={{
              background: `rgba(0,230,211,${alpha})`,
              borderRadius: 2,
              transition: "background 200ms",
            }} />
          );
        }))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// HashChainAudit — compact verifier badge
// ──────────────────────────────────────────────────────────────────────────
export function HashChainAudit({ verified, count }: { verified: boolean; count: number }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      border: `1px solid ${verified ? "rgba(114,242,161,0.32)" : "rgba(255,107,139,0.32)"}`,
      background: verified ? "rgba(114,242,161,0.08)" : "rgba(255,107,139,0.08)",
      color: verified ? ATOM_GREEN : ATOM_DANGER,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: 700,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999,
        background: verified ? ATOM_GREEN : ATOM_DANGER,
        boxShadow: `0 0 10px ${verified ? ATOM_GREEN : ATOM_DANGER}`,
      }} />
      Hash chain {verified ? "VERIFIED" : "TAMPERED"} · {count} entries
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────────
export function EmptyState({ message = "No data yet" }: { message?: string }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "grid", placeItems: "center",
      color: ATOM_FAINT,
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      border: "1px dashed rgba(255,255,255,0.06)",
      borderRadius: 12,
    }}>
      {message}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Power-user leaderboard row
// ──────────────────────────────────────────────────────────────────────────
export interface LeaderboardRowProps {
  rank: number;
  name: string;
  email: string;
  score: number;       // 0..100
  dials: number;
  conversion?: number; // 0..1
  tier: "top" | "mid" | "bottom";
}
export function LeaderboardRow({ rank, name, email, score, dials, conversion, tier }: LeaderboardRowProps) {
  const tierColor = tier === "top" ? ATOM_GREEN : tier === "mid" ? ATOM_AMBER : ATOM_DANGER;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr auto auto auto",
      gap: 12,
      alignItems: "center",
      padding: "10px 14px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        display: "grid", placeItems: "center",
        background: `${tierColor}1a`, border: `1px solid ${tierColor}33`,
        color: tierColor,
        fontFamily: "var(--font-mono)",
        fontSize: 11, fontWeight: 700,
      }}>{rank}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: ATOM_TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>{email}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Dials</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: ATOM_TEXT, fontVariantNumeric: "tabular-nums" }}>{dials}</div>
      </div>
      {conversion !== undefined && (
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Conv</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: ATOM_TEXT, fontVariantNumeric: "tabular-nums" }}>{(conversion * 100).toFixed(0)}%</div>
        </div>
      )}
      <div style={{
        width: 56, height: 56, position: "relative",
      }}>
        <svg viewBox="0 0 56 56" style={{ width: 56, height: 56, transform: "rotate(-90deg)" }}>
          <circle cx={28} cy={28} r={22} stroke="rgba(255,255,255,0.08)" strokeWidth={4} fill="none" />
          <circle cx={28} cy={28} r={22}
            stroke={tierColor}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 22}
            strokeDashoffset={2 * Math.PI * 22 * (1 - Math.max(0, Math.min(100, score)) / 100)}
            style={{ filter: `drop-shadow(0 0 6px ${tierColor}88)` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: tierColor,
          fontVariantNumeric: "tabular-nums",
        }}>{Math.round(score)}</div>
      </div>
    </div>
  );
}
