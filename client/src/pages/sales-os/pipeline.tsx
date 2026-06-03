import { useState } from "react";
import { Crosshair, ChevronRight, Zap, ArrowUpRight, Target } from "lucide-react";
import {
  PageShell,
  ZoneHeader,
  GlassCard,
  StatTile,
  SALES_OS,
  fmtCurrency,
} from "@/components/sales-os/SalesOsUI";
import {
  PROSPECTS,
  STAGE_ORDER,
  PIPELINE_TOTAL,
  VERTICAL_COLORS,
  Prospect,
  DealStage,
} from "@/data/warroom-seed";

const STAGE_TINT: Record<DealStage, string> = {
  Discovery: "#64748b",
  Qualified: "#38bdf8",
  Demo: "#00d4ff",
  Proposal: "#7c3aed",
  Negotiation: "#f5c842",
  "Closed Won": "#34d399",
};

// Deterministic "next best action" + impact, derived from the seeded deal so it
// reads as ATOM's recommendation without any randomness.
function nextActionFor(p: Prospect): { action: string; impact: string } {
  if (p.sentimentScore < 0)
    return { action: "Send objection-handling brief", impact: "Recover +22 sentiment" };
  if (p.stage === "Negotiation")
    return { action: "Send mutual close plan", impact: `Pull in ${fmtCurrency(p.dealValue)}` };
  if (p.stage === "Proposal")
    return { action: "Book exec alignment call", impact: "Compress cycle 6 days" };
  if (p.intentScore >= 85)
    return { action: "Trigger AI discovery call", impact: "Strike while intent peaks" };
  return { action: "Send tailored case study", impact: "Lift intent +12" };
}

function DealCard({ p, onClick }: { p: Prospect; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      data-testid={`deal-card-${p.id}`}
      className="w-full text-left rounded-xl p-3 transition-all hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(0,212,255,0.14)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate" style={{ color: "#f6f8ff" }}>
          {p.company}
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ color: SALES_OS.cyan }}>
          {fmtCurrency(p.dealValue)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: `${VERTICAL_COLORS[p.vertical]}22`, color: VERTICAL_COLORS[p.vertical] }}
        >
          {p.vertical}
        </span>
        <span className="text-[10px]" style={{ color: "rgba(246,248,255,0.5)" }}>
          {p.contact}
        </span>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono uppercase" style={{ color: "rgba(246,248,255,0.4)" }}>
            AI score
          </span>
          <span className="text-[10px] font-mono" style={{ color: SALES_OS.cyan }}>
            {p.intentScore}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${p.intentScore}%`,
              background: "linear-gradient(90deg, #7c3aed, #00d4ff)",
            }}
          />
        </div>
      </div>
    </button>
  );
}

// ── AI Priority Lane — the deals ATOM is actively driving, ranked by intent ──
function PriorityCard({ p, rank, onClick }: { p: Prospect; rank: number; onClick: () => void }) {
  const { action, impact } = nextActionFor(p);
  return (
    <button
      onClick={onClick}
      data-testid={`priority-card-${p.id}`}
      className="group relative text-left rounded-xl p-4 transition-all hover:-translate-y-1 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(124,58,237,0.32)",
        boxShadow: "0 0 28px rgba(124,58,237,0.08)",
      }}
    >
      <span
        className="pointer-events-none absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity"
        style={{ background: VERTICAL_COLORS[p.vertical] }}
      />
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(124,58,237,0.18)", color: "#c4b5fd" }}
        >
          Priority {rank}
        </span>
        <span className="flex items-center gap-1 text-xs font-mono" style={{ color: "#34d399" }}>
          <Zap size={11} /> {p.intentScore} intent
        </span>
      </div>
      <p className="mt-2.5 text-base font-bold" style={{ color: "#f6f8ff" }}>
        {p.company}
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.55)" }}>
        {p.contact} · {p.title}
      </p>
      <div
        className="mt-3 p-2.5 rounded-lg"
        style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)" }}
      >
        <div className="flex items-center gap-1.5">
          <Target size={11} style={{ color: SALES_OS.cyan }} />
          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: SALES_OS.cyan }}>
            ATOM next move
          </span>
        </div>
        <p className="text-xs font-semibold mt-1" style={{ color: "#f6f8ff" }}>
          {action}
        </p>
        <p className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: "#34d399" }}>
          <ArrowUpRight size={10} /> {impact}
        </p>
      </div>
    </button>
  );
}

export default function PipelineCommand() {
  const [selected, setSelected] = useState<Prospect | null>(null);
  const won = PROSPECTS.filter((p) => p.stage === "Closed Won").length;
  const avg = Math.round(PROSPECTS.reduce((s, p) => s + p.intentScore, 0) / PROSPECTS.length);
  const priority = [...PROSPECTS].sort((a, b) => b.intentScore - a.intentScore).slice(0, 3);
  const stageMax = Math.max(
    ...STAGE_ORDER.map((s) => PROSPECTS.filter((p) => p.stage === s).reduce((t, p) => t + p.dealValue, 0)),
  );

  return (
    <PageShell>
      <ZoneHeader
        eyebrow="Zone 01"
        title="Pipeline Command"
        subtitle="Every live deal ATOM is working, ranked by buying intent."
        icon={<Crosshair size={22} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Pipeline Value" value={fmtCurrency(PIPELINE_TOTAL)} delta="+18% MoM" />
        <StatTile label="Open Deals" value={`${PROSPECTS.length - won}`} delta="ATOM-sourced" accent={SALES_OS.violet} />
        <StatTile label="Avg AI Score" value={`${avg}`} delta="High intent" />
        <StatTile label="Closed Won" value={`${won}`} delta="this quarter" accent="#34d399" />
      </div>

      {/* AI Priority Lane */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} style={{ color: SALES_OS.violet }} />
          <p className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: "#c4b5fd" }}>
            AI Priority Lane
          </p>
          <span className="text-[11px]" style={{ color: "rgba(246,248,255,0.4)" }}>
            ATOM is driving these now
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {priority.map((p, i) => (
            <PriorityCard key={p.id} p={p} rank={i + 1} onClick={() => setSelected(p)} />
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {STAGE_ORDER.map((stage) => {
          const deals = PROSPECTS.filter((p) => p.stage === stage);
          const stageVal = deals.reduce((t, p) => t + p.dealValue, 0);
          return (
            <GlassCard key={stage} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: STAGE_TINT[stage] }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#f6f8ff" }}>
                    {stage}
                  </span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: "rgba(246,248,255,0.45)" }}>
                  {deals.length}
                </span>
              </div>
              {/* stage health bar */}
              <div className="mb-3">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: stageMax ? `${(stageVal / stageMax) * 100}%` : "0%",
                      background: STAGE_TINT[stage],
                    }}
                  />
                </div>
                <p className="text-[9px] font-mono mt-1" style={{ color: "rgba(246,248,255,0.4)" }}>
                  {fmtCurrency(stageVal)} in stage
                </p>
              </div>
              <div className="space-y-2">
                {deals.length === 0 ? (
                  <p className="text-[11px] py-4 text-center" style={{ color: "rgba(246,248,255,0.3)" }}>
                    No deals
                  </p>
                ) : (
                  deals.map((p) => <DealCard key={p.id} p={p} onClick={() => setSelected(p)} />)
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(2,4,8,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setSelected(null)}
        >
          <GlassCard glow className="w-full max-w-lg p-6" >
            <div onClick={(e) => e.stopPropagation()}>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: SALES_OS.cyan }}>
                Prospect Profile
              </p>
              <h2 className="text-2xl font-bold mt-1" style={{ color: "#f6f8ff" }}>
                {selected.company}
              </h2>
              <p className="text-sm" style={{ color: "rgba(246,248,255,0.6)" }}>
                {selected.contact} · {selected.title}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <Field label="Deal Value" value={fmtCurrency(selected.dealValue)} />
                <Field label="Stage" value={selected.stage} />
                <Field label="Vertical" value={selected.vertical} />
                <Field label="Company Size" value={`${selected.companySize} employees`} />
                <Field label="Intent Score" value={`${selected.intentScore}/100`} />
                <Field label="Sentiment" value={`${selected.sentimentScore > 0 ? "+" : ""}${selected.sentimentScore}`} />
              </div>
              <div
                className="mt-4 p-3 rounded-xl flex items-center gap-2"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                <ChevronRight size={14} style={{ color: SALES_OS.violet }} />
                <span className="text-xs" style={{ color: "#f6f8ff" }}>
                  {selected.fundingSignal}
                </span>
              </div>
              {/* Guided next-best action */}
              <div
                className="mt-3 p-3 rounded-xl"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.28)" }}
              >
                <div className="flex items-center gap-1.5">
                  <Target size={12} style={{ color: SALES_OS.cyan }} />
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: SALES_OS.cyan }}>
                    ATOM recommended next move
                  </span>
                </div>
                <p className="text-sm font-semibold mt-1" style={{ color: "#f6f8ff" }}>
                  {nextActionFor(selected).action}
                </p>
                <p className="flex items-center gap-1 text-[11px] mt-0.5" style={{ color: "#34d399" }}>
                  <ArrowUpRight size={11} /> {nextActionFor(selected).impact}
                </p>
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
      <p className="text-[10px] font-mono uppercase tracking-wide" style={{ color: "rgba(246,248,255,0.4)" }}>
        {label}
      </p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: "#f6f8ff" }}>
        {value}
      </p>
    </div>
  );
}
