/**
 * ATOM Ops console — superadmin command surface.
 *
 *  - Cmd/Ctrl+K command palette (grouped by tool, destructive ops flagged)
 *  - Visible intent input
 *  - Confirm modal with a 5-minute countdown for destructive ops
 *  - Output panel
 *  - Audit log table, auto-refreshing every 30s
 *  - Notification badge (polls the API badge state)
 *
 * Endpoints (this Vite+Vercel repo): /api/atom-ops/route
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const API = "/api/atom-ops/route";

interface ActionMeta {
  id: string;
  tool: string;
  action: string;
  destructive: boolean;
  description: string;
}

interface ConfirmPlan {
  confirmationId: string;
  summary: string;
  expiresAt: number;
  tool: string;
  action: string;
}

interface DispatchResponse {
  kind: "result" | "confirm" | "cancelled" | "error";
  result?: { ok: boolean; summary: string; data: unknown };
  plan?: ConfirmPlan;
  summary?: string;
}

interface AuditRow {
  id: string;
  created_at: string;
  actor_email: string;
  intent: string;
  phase: string;
  result: string;
  destructive: boolean;
  summary: string | null;
}

async function postIntent(body: Record<string, unknown>): Promise<DispatchResponse> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { kind: "error", summary: `${res.status}: ${t}` };
  }
  return (await res.json()) as DispatchResponse;
}

export default function AtomOpsConsole() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actions, setActions] = useState<ActionMeta[]>([]);
  const [intent, setIntent] = useState("");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<ConfirmPlan | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [badge, setBadge] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load palette actions once.
  useEffect(() => {
    fetch(`${API}?actions=1`)
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d: { actions?: ActionMeta[] }) => setActions(d.actions || []))
      .catch(() => setActions([]));
  }, []);

  const refreshAudit = useCallback(async () => {
    try {
      const r = await fetch(`${API}?audit=1&limit=50`);
      if (!r.ok) return;
      const d = (await r.json()) as { audit?: AuditRow[] };
      setAudit(d.audit || []);
    } catch {
      /* transient — ignore */
    }
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const r = await fetch(`${API}?badge=1`);
      if (!r.ok) return;
      const d = (await r.json()) as { badge?: { count: number } };
      setBadge(d.badge?.count ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  // Audit + badge auto-refresh every 30s.
  useEffect(() => {
    refreshAudit();
    refreshBadge();
    const i = setInterval(() => {
      refreshAudit();
      refreshBadge();
    }, 30_000);
    return () => clearInterval(i);
  }, [refreshAudit, refreshBadge]);

  // Cmd/Ctrl+K toggles the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Confirmation countdown.
  useEffect(() => {
    if (!plan) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.round((plan.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        setPlan(null);
        setOutput("Confirmation expired.");
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [plan]);

  const handleResponse = useCallback(
    (resp: DispatchResponse) => {
      if (resp.kind === "confirm" && resp.plan) {
        setPlan(resp.plan);
      } else if (resp.kind === "result" && resp.result) {
        setOutput(`${resp.result.ok ? "✅" : "⚠️"} ${resp.result.summary}\n\n${JSON.stringify(resp.result.data, null, 2)}`);
      } else if (resp.kind === "cancelled") {
        setOutput(`✖️ ${resp.summary ?? "Cancelled"}`);
      } else {
        setOutput(`⚠️ ${resp.summary ?? "Error"}`);
      }
      refreshAudit();
    },
    [refreshAudit],
  );

  const submit = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;
      setBusy(true);
      setOutput("Running…");
      try {
        handleResponse(await postIntent({ intent: value }));
      } finally {
        setBusy(false);
      }
    },
    [handleResponse],
  );

  const confirmPlan = useCallback(async () => {
    if (!plan) return;
    setBusy(true);
    setPlan(null);
    setOutput("Executing…");
    try {
      handleResponse(await postIntent({ confirmationId: plan.confirmationId, confirm: true }));
    } finally {
      setBusy(false);
    }
  }, [plan, handleResponse]);

  const cancelPlan = useCallback(async () => {
    if (!plan) return;
    const id = plan.confirmationId;
    setPlan(null);
    handleResponse(await postIntent({ confirmationId: id, cancel: true }));
  }, [plan, handleResponse]);

  const groups = useMemo(() => {
    const byTool: Record<string, ActionMeta[]> = {};
    for (const a of actions) (byTool[a.tool] ||= []).push(a);
    return byTool;
  }, [actions]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto", color: "var(--atom-fg, #e6f9f7)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>ATOM Ops</h1>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Superadmin Digital Worker</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            title="Notifications"
            style={{
              background: badge ? "#22e6d6" : "transparent",
              color: badge ? "#06231f" : "#22e6d6",
              border: "1px solid #22e6d6",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ● {badge}
          </span>
          <kbd style={{ fontSize: 11, opacity: 0.7 }}>⌘K</kbd>
        </span>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(intent);
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          aria-label="Ops intent"
          placeholder="github.listOpenPRs   |   /morning-brief   |   /release pr=12 tag=v1.2.0"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          disabled={busy}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #1f4d49",
            background: "#06231f",
            color: "inherit",
            fontFamily: "monospace",
          }}
        />
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "#22e6d6",
            color: "#06231f",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Run
        </button>
      </form>

      <section
        aria-label="Output"
        style={{
          minHeight: 90,
          padding: 16,
          borderRadius: 10,
          border: "1px solid #1f4d49",
          background: "#04181590",
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        {output || "Output will appear here."}
      </section>

      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Audit log</h2>
      <div style={{ overflowX: "auto", border: "1px solid #1f4d49", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", opacity: 0.7 }}>
              <th style={th}>Time</th>
              <th style={th}>Actor</th>
              <th style={th}>Intent</th>
              <th style={th}>Phase</th>
              <th style={th}>Result</th>
              <th style={th}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  No audit rows yet (or Supabase not configured).
                </td>
              </tr>
            )}
            {audit.map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #102f2c" }}>
                <td style={td}>{new Date(row.created_at).toLocaleTimeString()}</td>
                <td style={td}>{row.actor_email}</td>
                <td style={{ ...td, fontFamily: "monospace" }}>{row.intent}</td>
                <td style={td}>{row.phase}</td>
                <td style={{ ...td, color: row.result === "ok" ? "#22e6d6" : "#ff8a8a" }}>
                  {row.result}
                  {row.destructive ? " ⚡" : ""}
                </td>
                <td style={td}>{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Command palette */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <Command>
          <CommandInput placeholder="Search ops actions…" />
          <CommandList>
            <CommandEmpty>No actions found.</CommandEmpty>
            {Object.entries(groups).map(([tool, items]) => (
              <CommandGroup key={tool} heading={tool}>
                {items.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={a.id + " " + a.description}
                    onSelect={() => {
                      setPaletteOpen(false);
                      setIntent(a.id + " ");
                      if (a.id === "/morning-brief") submit(a.id);
                    }}
                  >
                    <span style={{ fontFamily: "monospace" }}>{a.id}</span>
                    {a.destructive && (
                      <span style={{ marginLeft: 8, color: "#ff8a8a", fontSize: 11 }}>⚡ destructive</span>
                    )}
                    <span style={{ marginLeft: "auto", opacity: 0.6, fontSize: 11 }}>{a.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>

      {/* Confirm modal */}
      {plan && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm destructive operation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 460,
              maxWidth: "90vw",
              background: "#06231f",
              border: "1px solid #22e6d6",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <h3 style={{ marginTop: 0, color: "#ff8a8a" }}>⚡ Confirm destructive op</h3>
            <p style={{ fontSize: 14 }}>{plan.summary}</p>
            <p style={{ fontSize: 12, opacity: 0.8 }}>
              Expires in <strong>{countdown}s</strong>
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={cancelPlan} style={btnGhost}>
                Cancel
              </button>
              <button onClick={confirmPlan} disabled={busy || countdown <= 0} style={btnDanger}>
                Confirm &amp; execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px" };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #1f4d49",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#ff5a5a",
  color: "#1a0606",
  fontWeight: 700,
  cursor: "pointer",
};
