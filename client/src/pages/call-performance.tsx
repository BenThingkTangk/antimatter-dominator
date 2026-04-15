import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Timer,
  AlertTriangle,
  Flame,
  Clock,
  TrendingUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BridgeInfo {
  version: string;
  voiceId: string;
  humeConfig: string;
  sambanova: boolean;
  uptime: number;
  activeCalls: number;
}

interface Aggregates {
  totalCalls: number;
  prewarmHitRate: number;
  eviTurnLatency: { avg: number | null; p50: number | null; p95: number | null; count: number };
  sambaNovaLatency: { avg: number | null; p50: number | null; p95: number | null; count: number };
  humePrewarmConnect: { avg: number | null; p95: number | null };
  humeGreetingGenerate: { avg: number | null; p95: number | null };
  callDuration: { avg: number | null; total: number };
  totalErrors: number;
}

interface SambaNovaLatency {
  tool: string;
  ms: number;
  engine: string;
}

interface TranscriptionAccuracy {
  raw: string;
  corrected: string;
  score: number;
}

interface CallError {
  type: string;
  msg: string;
  ts: number;
}

interface CallPerf {
  callInitiatedAt: number;
  humePrewarmConnectMs: number | null;
  humePrewarmGreetingMs: number | null;
  prewarmHit: boolean;
  prewarmChunksBuffered: number;
  twilioStreamConnectedAt: number | null;
  firstGreetingAudioAt: number | null;
  greetingFlushMs: number | null;
  eviTurnLatencies: number[];
  sambaNovaLatencies: SambaNovaLatency[];
  transcriptionAccuracy: TranscriptionAccuracy[];
  errors: CallError[];
}

interface CallRecord {
  callSid: string;
  firstName: string;
  companyName: string;
  product: string;
  duration: number;
  turns: number;
  sentiment: number;
  buyerIntent: number;
  stage: string;
  perf: CallPerf;
  emotionReadings: number;
  recordedAt: string;
}

interface PerfMetrics {
  bridge: BridgeInfo;
  calls: CallRecord[];
  aggregates: Aggregates;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatRelativeTime(isoTs: string): string {
  const now = Date.now();
  const then = new Date(isoTs).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function avgLatency(latencies: number[]): number | null {
  if (!latencies || latencies.length === 0) return null;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

function fmtMs(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${Math.round(val)}ms`;
}

function fmtSec(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `${Math.round(val)}s`;
}

// Color helpers

function latencyColor(ms: number | null): string {
  if (ms === null) return "text-muted-foreground";
  if (ms < 500) return "text-emerald-400";
  if (ms < 1000) return "text-amber-400";
  return "text-rose-400";
}

function prewarmColor(rate: number): string {
  if (rate > 80) return "text-emerald-400";
  if (rate > 50) return "text-amber-400";
  return "text-rose-400";
}

function sentimentColor(val: number): string {
  if (val >= 70) return "text-emerald-400";
  if (val >= 40) return "text-amber-400";
  return "text-rose-400";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  valueClass = "",
  suffix = "",
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  valueClass?: string;
  suffix?: string;
}) {
  return (
    <Card className="border-border/50">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${valueClass}`}>
              {value}
              {suffix && <span className="text-base font-semibold ml-0.5">{suffix}</span>}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500/15 text-violet-400 shrink-0 ml-3">
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function LatencyBar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string;
  value: number | null;
  max: number;
  colorClass: string;
}) {
  const pct = value !== null && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-semibold ${colorClass}`}>{fmtMs(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CallPerformance() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<PerfMetrics>({
    queryKey: ["/perf/metrics"],
    queryFn: async () => {
      const res = await fetch("https://45-79-202-76.sslip.io/perf/metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const bridge = data?.bridge;
  const agg = data?.aggregates;
  const calls = data?.calls ?? [];

  // Latency bar max values
  const eviMax = Math.max(
    agg?.eviTurnLatency?.p95 ?? 0,
    agg?.eviTurnLatency?.avg ?? 0,
    agg?.eviTurnLatency?.p50 ?? 0,
    1000
  );
  const snMax = Math.max(
    agg?.sambaNovaLatency?.p95 ?? 0,
    agg?.sambaNovaLatency?.avg ?? 0,
    agg?.sambaNovaLatency?.p50 ?? 0,
    1000
  );

  return (
    <div className="space-y-6" data-testid="perf-dashboard">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-500/15">
            <Activity className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ATOM Call Performance</h1>
            <p className="text-sm text-muted-foreground">Live bridge monitoring</p>
          </div>
          {bridge && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-violet-500/15 text-violet-400 border-violet-500/30 font-mono text-xs">
                v{bridge.version}
              </Badge>
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 inline-block animate-pulse" />
                Up {formatUptime(bridge.uptime)}
              </Badge>
              {bridge.sambanova && (
                <Badge variant="secondary" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  SambaNova
                </Badge>
              )}
              {bridge.activeCalls > 0 && (
                <Badge variant="secondary" className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-xs">
                  <Phone className="w-3 h-3 mr-1" />
                  {bridge.activeCalls} live
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
        >
          {isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* ─── Error State ─── */}
      {isError && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <div className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-rose-400">Failed to reach bridge</p>
              <p className="text-xs text-muted-foreground mt-0.5">Check that the bridge at 45-79-202-76.sslip.io is reachable</p>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Top Stats Row ─── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <div className="p-5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : agg ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="Total Calls"
            value={agg.totalCalls}
            icon={Phone}
          />
          <StatCard
            title="Pre-warm Hit"
            value={`${Math.round(agg.prewarmHitRate)}`}
            suffix="%"
            icon={Flame}
            valueClass={prewarmColor(agg.prewarmHitRate)}
          />
          <StatCard
            title="EVI Latency"
            value={agg.eviTurnLatency.avg !== null ? `${Math.round(agg.eviTurnLatency.avg)}` : "—"}
            suffix={agg.eviTurnLatency.avg !== null ? "ms" : ""}
            icon={Timer}
            valueClass={latencyColor(agg.eviTurnLatency.avg)}
          />
          <StatCard
            title="SambaNova"
            value={agg.sambaNovaLatency.avg !== null ? `${Math.round(agg.sambaNovaLatency.avg)}` : "—"}
            suffix={agg.sambaNovaLatency.avg !== null ? "ms" : ""}
            icon={Zap}
            valueClass={latencyColor(agg.sambaNovaLatency.avg)}
          />
          <StatCard
            title="Avg Duration"
            value={agg.callDuration.avg !== null ? `${Math.round(agg.callDuration.avg)}` : "—"}
            suffix={agg.callDuration.avg !== null ? "s" : ""}
            icon={Clock}
          />
          <StatCard
            title="Total Errors"
            value={agg.totalErrors}
            icon={AlertTriangle}
            valueClass={agg.totalErrors > 0 ? "text-rose-400" : "text-emerald-400"}
          />
        </div>
      ) : null}

      {/* ─── Latency Distribution ─── */}
      {(isLoading || agg) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* EVI Response Latency */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Timer className="w-4 h-4 text-violet-400" />
                EVI Response Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : agg ? (
                <>
                  <LatencyBar
                    label="Avg"
                    value={agg.eviTurnLatency.avg}
                    max={eviMax}
                    colorClass={latencyColor(agg.eviTurnLatency.avg)}
                  />
                  <LatencyBar
                    label="P50"
                    value={agg.eviTurnLatency.p50}
                    max={eviMax}
                    colorClass="text-violet-400"
                  />
                  <LatencyBar
                    label="P95"
                    value={agg.eviTurnLatency.p95}
                    max={eviMax}
                    colorClass="text-amber-400"
                  />
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                    Measured across <span className="text-foreground font-medium">{agg.eviTurnLatency.count}</span> conversation turns
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* SambaNova Tool Latency */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                SambaNova Tool Latency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-3 w-14" />
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : agg ? (
                agg.sambaNovaLatency.count > 0 ? (
                  <>
                    <LatencyBar
                      label="Avg"
                      value={agg.sambaNovaLatency.avg}
                      max={snMax}
                      colorClass={latencyColor(agg.sambaNovaLatency.avg)}
                    />
                    <LatencyBar
                      label="P50"
                      value={agg.sambaNovaLatency.p50}
                      max={snMax}
                      colorClass="text-amber-400"
                    />
                    <LatencyBar
                      label="P95"
                      value={agg.sambaNovaLatency.p95}
                      max={snMax}
                      colorClass="text-rose-400"
                    />
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                      Measured across <span className="text-foreground font-medium">{agg.sambaNovaLatency.count}</span> tool calls
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No tool calls recorded yet</p>
                )
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Pre-warm Analytics ─── */}
      {(isLoading || agg) && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Pre-warm Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : agg ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Hit Rate */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Hit Rate</p>
                  <p className={`text-2xl font-bold ${prewarmColor(agg.prewarmHitRate)}`}>
                    {Math.round(agg.prewarmHitRate)}%
                  </p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        agg.prewarmHitRate > 80
                          ? "bg-emerald-400"
                          : agg.prewarmHitRate > 50
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                      style={{ width: `${Math.min(100, agg.prewarmHitRate)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">cache hit ratio</p>
                </div>

                {/* Connect Time */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Connect Time</p>
                  <p className="text-2xl font-bold text-violet-400">{fmtMs(agg.humePrewarmConnect.avg)}</p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-400 transition-all duration-500"
                      style={{
                        width: agg.humePrewarmConnect.avg
                          ? `${Math.min(100, (agg.humePrewarmConnect.avg / 2000) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    P95: <span className="text-foreground">{fmtMs(agg.humePrewarmConnect.p95)}</span>
                  </p>
                </div>

                {/* Greeting Generate */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Greeting Generate</p>
                  <p className="text-2xl font-bold text-cyan-400">{fmtMs(agg.humeGreetingGenerate.avg)}</p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                      style={{
                        width: agg.humeGreetingGenerate.avg
                          ? `${Math.min(100, (agg.humeGreetingGenerate.avg / 2000) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    P95: <span className="text-foreground">{fmtMs(agg.humeGreetingGenerate.p95)}</span>
                  </p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ─── Call History Table ─── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            Call History
            {calls.length > 0 && (
              <Badge variant="secondary" className="bg-violet-500/15 text-violet-400 border-violet-500/30 ml-1">
                {calls.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          ) : calls.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Phone className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No calls recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Time</th>
                    <th className="text-left text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Contact / Company</th>
                    <th className="text-right text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Duration</th>
                    <th className="text-right text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Turns</th>
                    <th className="text-center text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Pre-warm</th>
                    <th className="text-right text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">EVI Latency</th>
                    <th className="text-right text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">SambaNova</th>
                    <th className="text-right text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Sentiment</th>
                    <th className="text-center text-muted-foreground font-medium px-4 py-3 whitespace-nowrap">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const eviAvg = avgLatency(call.perf.eviTurnLatencies);
                    const snCount = call.perf.sambaNovaLatencies?.length ?? 0;
                    const errorCount = call.perf.errors?.length ?? 0;
                    return (
                      <tr
                        key={call.callSid}
                        className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        {/* Time */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono">
                          {formatRelativeTime(call.recordedAt)}
                        </td>

                        {/* Contact / Company */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-foreground">{call.firstName}</div>
                          <div className="text-muted-foreground truncate max-w-[140px]">{call.companyName}</div>
                        </td>

                        {/* Duration */}
                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                          {call.duration}s
                        </td>

                        {/* Turns */}
                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-muted-foreground">
                          {call.turns}
                        </td>

                        {/* Pre-warm */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {call.perf.prewarmHit ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 inline" />
                          )}
                        </td>

                        {/* EVI Latency */}
                        <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${latencyColor(eviAvg)}`}>
                          {fmtMs(eviAvg)}
                        </td>

                        {/* SambaNova */}
                        <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-muted-foreground">
                          {snCount > 0 ? (
                            <span className="text-amber-400">{snCount} calls</span>
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* Sentiment */}
                        <td className={`px-4 py-3 text-right font-mono whitespace-nowrap font-semibold ${sentimentColor(call.sentiment)}`}>
                          {call.sentiment}
                        </td>

                        {/* Errors */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {errorCount > 0 ? (
                            <Badge variant="secondary" className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] px-1.5">
                              {errorCount}
                            </Badge>
                          ) : (
                            <span className="text-emerald-400 font-semibold">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
