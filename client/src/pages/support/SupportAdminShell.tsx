/**
 * ATOM Support admin/eval dashboard. Tab-based, hash-routed (#/admin/support?tab=).
 * Tabs: Overview / Conversations / Escalations / Feedback / Low-confidence /
 *       Knowledge gaps / Actions / Eval. Auth via shared X-Admin-Key.
 */
import { useEffect, useState } from "react";
import {
  BarChart3, MessageSquare, LifeBuoy, ThumbsDown, GaugeCircle,
  BookOpen, ListChecks, FlaskConical, KeyRound, RefreshCw, Database,
} from "lucide-react";
import {
  supportAdminGet, runEvalScenarios, ingestRepoDefaults, getSupportConfig,
  getAdminKey, setAdminKey,
} from "./supportAdminApi";

type TabId = "overview" | "conversations" | "escalations" | "feedback" | "low" | "gaps" | "actions" | "eval";

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "escalations", label: "Escalations", icon: LifeBuoy },
  { id: "feedback", label: "Feedback", icon: ThumbsDown },
  { id: "low", label: "Low-confidence", icon: GaugeCircle },
  { id: "gaps", label: "Knowledge gaps", icon: BookOpen },
  { id: "actions", label: "Action log", icon: ListChecks },
  { id: "eval", label: "Eval", icon: FlaskConical },
];

const card = {
  background: "var(--color-surface, #0b0e10)",
  border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
  borderRadius: "0.75rem",
};

export default function SupportAdminShell() {
  const [tab, setTab] = useState<TabId>(() => {
    const m = /tab=([a-z-]+)/.exec(window.location.hash);
    return (m?.[1] as TabId) || "overview";
  });
  const [keyInput, setKeyInput] = useState(getAdminKey());
  const hasKey = Boolean(getAdminKey());

  useEffect(() => {
    const base = window.location.hash.split("?")[0];
    window.location.hash = `${base}?tab=${tab}`;
  }, [tab]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto" style={{ color: "var(--color-text, #eef6f5)" }}>
      <div className="flex items-center gap-3 mb-1">
        <FlaskConical size={22} style={{ color: "var(--atom-primary, #22e6d6)" }} />
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
          ATOM Support — Command Center
        </h1>
      </div>
      <p className="text-xs mb-5" style={{ color: "var(--color-text-faint, #7b8a90)" }}>
        Review conversations, escalations, feedback, failed answers, and validate RAG before launch.
      </p>

      {!hasKey && (
        <div className="mb-5 p-4 flex items-center gap-3" style={{ ...card, borderColor: "var(--atom-coral, #ff7b6b)" }}>
          <KeyRound size={16} style={{ color: "var(--atom-coral, #ff7b6b)" }} />
          <input
            type="password"
            placeholder="Enter admin key (X-Admin-Key)"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--color-text, #eef6f5)" }}
          />
          <button
            onClick={() => { setAdminKey(keyInput); window.location.reload(); }}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ background: "var(--atom-primary, #22e6d6)", color: "var(--atom-text-inverse, #04100f)" }}
          >
            Save
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: active ? "color-mix(in oklab, var(--atom-primary, #22e6d6) 18%, transparent)" : "transparent",
                color: active ? "var(--atom-primary, #22e6d6)" : "var(--color-text-muted, #b5c1c5)",
                border: `1px solid ${active ? "color-mix(in oklab, var(--atom-primary, #22e6d6) 35%, transparent)" : "var(--color-border, rgba(255,255,255,0.08))"}`,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "conversations" && <TableTab view="conversations" columns={["session_id", "surface", "user_tier", "tenant_slug", "last_confidence", "escalated", "message_count", "updated_at"]} />}
      {tab === "escalations" && <TableTab view="escalations" columns={["trigger_reason", "severity", "user_tier", "tenant_slug", "provider", "status", "confidence", "created_at"]} />}
      {tab === "feedback" && <TableTab view="feedback" columns={["verdict", "failure_category", "user_tier", "tenant_slug", "confidence", "question", "created_at"]} />}
      {tab === "low" && <TableTab view="low-confidence" columns={["confidence", "failure_category", "tenant_slug", "content", "created_at"]} />}
      {tab === "gaps" && <TableTab view="knowledge-gaps" columns={["confidence", "failure_category", "content", "created_at"]} />}
      {tab === "actions" && <TableTab view="actions" columns={["action", "result", "actor_email", "tenant_slug", "resource", "reason", "created_at"]} />}
      {tab === "eval" && <EvalTab />}
    </div>
  );
}

function OverviewTab() {
  const [cards, setCards] = useState<Record<string, number> | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supportAdminGet("overview").then((d) => setCards(d.cards || null)).catch((e) => setErr(e.message));
    getSupportConfig().then((d) => setStatus(d?.status)).catch(() => {});
  }, []);

  const cells = [
    ["Conversations", cards?.conversations],
    ["Escalations", cards?.escalations],
    ["Open escalations", cards?.openEscalations],
    ["Negative feedback", cards?.negativeFeedback],
    ["Low-confidence", cards?.lowConfidence],
  ] as const;

  return (
    <div>
      {err && <ErrorBox msg={err} />}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {cells.map(([label, val]) => (
          <div key={label} className="p-4" style={card}>
            <div className="text-2xl font-bold" style={{ color: "var(--atom-primary, #22e6d6)" }}>
              {val ?? "—"}
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--color-text-faint, #7b8a90)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="p-4 mb-3" style={card}>
        <div className="flex items-center gap-2 mb-3">
          <Database size={14} style={{ color: "var(--atom-primary, #22e6d6)" }} />
          <span className="text-sm font-semibold">System status</span>
        </div>
        {status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs" style={{ fontFamily: "var(--font-mono, monospace)" }}>
            <StatusPill label="LLM" value={`${status.llm?.provider}${status.llm?.live ? "" : " (mock)"}`} live={status.llm?.live} />
            <StatusPill label="Embeddings" value={`${status.embeddings?.provider}`} live={status.embeddings?.live} />
            <StatusPill label="Vector store" value={status.vectorStore} live={status.vectorStore !== "none"} />
            <StatusPill label="Escalation" value={status.escalation?.provider} live={status.escalation?.plain || status.escalation?.linear || status.escalation?.slack} />
          </div>
        ) : <Muted>loading status…</Muted>}
      </div>

      <IngestPanel />
    </div>
  );
}

function StatusPill({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="px-3 py-2 rounded-md" style={{ background: "var(--color-surface-2, #11161a)" }}>
      <div style={{ color: "var(--color-text-faint, #7b8a90)" }}>{label}</div>
      <div style={{ color: live ? "var(--atom-primary, #22e6d6)" : "var(--color-text-muted, #b5c1c5)" }}>
        {live ? "● " : "○ "}{value}
      </div>
    </div>
  );
}

function IngestPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  return (
    <div className="p-4" style={card}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Knowledge base</div>
          <div className="text-[11px]" style={{ color: "var(--color-text-faint, #7b8a90)" }}>
            Ingest repo docs (WHITE-LABEL-PLAYBOOK, docs/, changelog) into the vector store.
          </div>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { setResult(await ingestRepoDefaults()); } catch (e: any) { setResult({ error: e.message }); }
            setBusy(false);
          }}
          className="text-xs inline-flex items-center gap-1.5 px-3 py-2 rounded-md disabled:opacity-50"
          style={{ background: "var(--atom-primary, #22e6d6)", color: "var(--atom-text-inverse, #04100f)" }}
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Ingest repo docs
        </button>
      </div>
      {result && (
        <pre className="mt-3 text-[11px] p-3 rounded-md overflow-auto" style={{ background: "var(--color-surface-2, #11161a)", color: "var(--color-text-muted, #b5c1c5)" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function TableTab({ view, columns }: { view: string; columns: string[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    supportAdminGet(view)
      .then((d) => setRows(d.rows || []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [view]);

  if (err) return <ErrorBox msg={err} />;
  if (loading) return <Muted>loading…</Muted>;
  if (!rows.length) return <Muted>No rows yet.</Muted>;

  return (
    <div className="overflow-auto" style={card}>
      <table className="w-full text-xs" style={{ fontFamily: "var(--font-mono, monospace)" }}>
        <thead>
          <tr style={{ color: "var(--color-text-faint, #7b8a90)" }}>
            {columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-normal border-b" style={{ borderColor: "var(--color-border, rgba(255,255,255,0.08))" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b" style={{ borderColor: "var(--color-divider, rgba(255,255,255,0.05))" }}>
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 align-top" style={{ color: "var(--color-text-muted, #b5c1c5)", maxWidth: 280 }}>
                  {format(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvalTab() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setData(await runEvalScenarios()); } catch (e: any) { setData({ error: e.message }); }
    setBusy(false);
  };
  useEffect(() => { run(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: "var(--color-text-faint, #7b8a90)" }}>
          Validates the policy / confidence / escalation / tone decision layers (offline, no LLM).
        </p>
        <button onClick={run} disabled={busy}
          className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md disabled:opacity-50"
          style={{ background: "var(--atom-primary, #22e6d6)", color: "var(--atom-text-inverse, #04100f)" }}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Re-run
        </button>
      </div>
      {data?.error && <ErrorBox msg={data.error} />}
      {data?.cases && (
        <>
          <div className="mb-3 text-sm">
            <span style={{ color: data.passed === data.total ? "var(--atom-primary, #22e6d6)" : "var(--atom-coral, #ff7b6b)" }}>
              {data.passed}/{data.total} passing
            </span>
          </div>
          <div className="space-y-1.5">
            {data.cases.map((c: any) => (
              <div key={c.id} className="flex items-start gap-3 p-3" style={card}>
                <span style={{ color: c.pass ? "var(--atom-primary, #22e6d6)" : "var(--atom-coral, #ff7b6b)" }}>
                  {c.pass ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <div className="text-sm">{c.label}</div>
                  <div className="text-[11px]" style={{ color: "var(--color-text-faint, #7b8a90)", fontFamily: "var(--font-mono, monospace)" }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function format(v: any): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-xs py-6 text-center" style={{ color: "var(--color-text-faint, #7b8a90)" }}>{children}</div>;
}
function ErrorBox({ msg }: { msg: string }) {
  return <div className="text-xs p-3 rounded-md mb-3" style={{ background: "color-mix(in oklab, var(--atom-coral, #ff7b6b) 12%, transparent)", color: "var(--atom-coral, #ff7b6b)" }}>{msg}</div>;
}
