/**
 * /dashboard — Tenant KPI Dashboard.
 * 6 metric families: Volume, Quality, Output, Efficiency, Health, Compliance.
 * Fetches live data from GET /api/dashboard/stats.
 */
import { useQuery } from "@tanstack/react-query";
import { useSessionContext } from "@/auth/AuthGate";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import {
  PhoneCall, TrendingUp, Award, DollarSign, HeartPulse, ShieldCheck,
  ArrowUpRight, ArrowDownRight, Users, Clock, Target, Gauge,
  BarChart3, Mail, AlertTriangle, CalendarCheck,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────
interface PerRep { userId: string; name: string; count: number }
interface SentimentPoint { date: string; score: number }

interface DashboardStats {
  volume: { today: number; thisWeek: number; thisMonth: number; perRep: PerRep[] };
  quality: { pickupRate: number; avgDuration: number; avgTruthScore: number; sentimentTrend: SentimentPoint[] };
  output: { meetingsBooked: number; pipelineDials: number };
  efficiency: { costPerDial: number; costPerMeeting: number };
  health: { campaignFatigue: number; channelSaturation: number; hardBounceRate: number; optOutRate: number };
  compliance: { tcpaFlagged: number; dncScrubLastAt: string | null; dncScrubNextDue: string | null };
}

// ─── Mini Sparkline ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = "var(--color-primary)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64;
  const h = 22;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── KPI Tile ───────────────────────────────────────────────────────────────────
function KpiTile({
  icon: Icon,
  label,
  value,
  subtitle,
  sparkData,
  sparkColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  sparkData?: number[];
  sparkColor?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-[var(--color-primary)] opacity-60" />
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">
            {label}
          </span>
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor} />
        )}
      </div>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: "var(--color-primary)" }}
      >
        {value}
      </span>
      {subtitle && (
        <span className="text-[11px] text-white/35">{subtitle}</span>
      )}
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
      <Icon size={14} className="text-[var(--color-primary)] opacity-50" />
      <h2 className="text-[11px] font-mono tracking-[0.18em] uppercase text-white/40">
        {title}
      </h2>
    </div>
  );
}

// ─── Per-Rep Table ──────────────────────────────────────────────────────────────
function RepTable({ reps }: { reps: PerRep[] }) {
  if (!reps.length) {
    return (
      <div className="text-[12px] text-white/25 py-3 px-4">No per-rep data yet</div>
    );
  }
  const maxCount = Math.max(...reps.map((r) => r.count), 1);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Users size={13} className="text-[var(--color-primary)] opacity-60" />
        <span className="text-[10px] font-mono tracking-widest uppercase text-white/30">
          Dials per rep — this month
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        {reps.slice(0, 10).map((rep) => (
          <div key={rep.userId} className="flex items-center gap-3 px-4 py-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: "color-mix(in oklab, var(--color-primary) 15%, transparent)",
                color: "var(--color-primary)",
              }}
            >
              {rep.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] text-white/70 font-medium min-w-0 truncate flex-1">
              {rep.name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(rep.count / maxCount) * 100}%`,
                    background: "var(--color-primary)",
                  }}
                />
              </div>
              <span className="text-[12px] font-mono tabular-nums text-white/50 w-8 text-right">
                {rep.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton shimmer className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} shimmer className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} shimmer className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function fmtCents(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useSessionContext();

  const { data, isLoading, isError, refetch } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/stats", { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000, // auto-refresh every 30s
    staleTime: 15_000,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const { volume, quality, output, efficiency, health, compliance } = data;

  // Sparkline data from sentiment trend
  const sentimentSpark = quality.sentimentTrend.map((p) => p.score);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--color-text)", fontFamily: "var(--font-display)", letterSpacing: "-0.3px" }}
        >
          {user?.fullName ? `Welcome back, ${user.fullName.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-[12px] text-white/35 font-mono uppercase tracking-widest mt-1">
          Tenant KPI Dashboard · Live
        </p>
      </div>

      {/* ── VOLUME ────────────────────────────────────────────── */}
      <SectionHeader icon={PhoneCall} title="Volume" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile icon={PhoneCall} label="Dials Today" value={volume.today} />
        <KpiTile icon={TrendingUp} label="This Week" value={volume.thisWeek} />
        <KpiTile icon={BarChart3} label="This Month" value={volume.thisMonth} />
      </div>

      {/* Per-rep table */}
      <div className="mt-3">
        <RepTable reps={volume.perRep} />
      </div>

      {/* ── QUALITY ───────────────────────────────────────────── */}
      <SectionHeader icon={Gauge} title="Quality" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          icon={Target}
          label="Pickup Rate"
          value={`${quality.pickupRate}%`}
          subtitle="Last 7 days"
        />
        <KpiTile
          icon={Clock}
          label="Avg Duration"
          value={fmtDuration(quality.avgDuration)}
          subtitle="Completed calls this month"
        />
        <KpiTile
          icon={Gauge}
          label="Truth Score"
          value={`${(quality.avgTruthScore * 100).toFixed(0)}%`}
          subtitle="Avg this month"
          sparkData={sentimentSpark}
          sparkColor="#1dd1a1"
        />
      </div>

      {/* ── OUTPUT ────────────────────────────────────────────── */}
      <SectionHeader icon={Award} title="Output" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          icon={CalendarCheck}
          label="Meetings Booked"
          value={output.meetingsBooked}
          subtitle="This month"
        />
        <KpiTile
          icon={TrendingUp}
          label="Pipeline Dials"
          value={output.pipelineDials}
          subtitle="Interested + follow-up + booked"
        />
      </div>

      {/* ── EFFICIENCY ────────────────────────────────────────── */}
      <SectionHeader icon={DollarSign} title="Efficiency" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          icon={DollarSign}
          label="Cost Per Dial"
          value={fmtCents(efficiency.costPerDial)}
        />
        <KpiTile
          icon={DollarSign}
          label="Cost Per Meeting"
          value={fmtCents(efficiency.costPerMeeting)}
        />
      </div>

      {/* ── HEALTH ────────────────────────────────────────────── */}
      <SectionHeader icon={HeartPulse} title="Health" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          icon={HeartPulse}
          label="Campaign Fatigue"
          value={`${health.campaignFatigue}/100`}
          subtitle={health.campaignFatigue > 60 ? "Consider cooling down" : "Healthy"}
        />
        <KpiTile
          icon={ArrowUpRight}
          label="Channel Saturation"
          value={`${health.channelSaturation}%`}
        />
        <KpiTile
          icon={Mail}
          label="Hard Bounce Rate"
          value={`${health.hardBounceRate}%`}
          subtitle={health.hardBounceRate > 5 ? "⚠ Above threshold" : "Within tolerance"}
        />
        <KpiTile
          icon={ArrowDownRight}
          label="Opt-Out Rate"
          value={`${health.optOutRate}%`}
        />
      </div>

      {/* ── COMPLIANCE ────────────────────────────────────────── */}
      <SectionHeader icon={ShieldCheck} title="Compliance" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiTile
          icon={AlertTriangle}
          label="TCPA Flagged"
          value={compliance.tcpaFlagged}
          subtitle="Last 30 days"
        />
        <KpiTile
          icon={ShieldCheck}
          label="DNC Last Scrub"
          value={fmtDate(compliance.dncScrubLastAt)}
        />
        <KpiTile
          icon={CalendarCheck}
          label="Next Scrub Due"
          value={fmtDate(compliance.dncScrubNextDue)}
          subtitle={
            compliance.dncScrubNextDue && new Date(compliance.dncScrubNextDue) < new Date()
              ? "⚠ Overdue"
              : undefined
          }
        />
      </div>
    </div>
  );
}
