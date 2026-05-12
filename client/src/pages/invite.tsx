/**
 * /invite/:token — accept-invite landing page.
 *
 * Resolves the invite via GET /api/invite, lets the user set a password and
 * full name, then POSTs to accept. On success the server sets the
 * atom_session cookie and we navigate into the app.
 */
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, AlertTriangle, Sparkles, Check } from "lucide-react";

interface InviteData {
  email: string;
  role: string;
  tenant: { id: string; slug: string; name: string; plan: string | null; primary_hex: string | null };
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const token = params.token || "";

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setError("Missing invite token");
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(j?.error || "Invite invalid");
        } else {
          setInvite(j.invite);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load invite");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr("");
    if (password.length < 8) {
      setSubmitErr("Password must be at least 8 characters");
      return;
    }
    if (!fullName.trim()) {
      setSubmitErr("Full name required");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, fullName: fullName.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Could not accept invite");
      // Hard reload so AuthGate re-fetches /api/auth/me with the new cookie
      window.location.hash = j.redirectTo?.replace(/^#?\/?/, "/") || "/billing";
      window.location.reload();
    } catch (e: any) {
      setSubmitErr(e?.message || "Failed");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" /> Resolving your invite…
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div
          className="px-5 py-4 rounded-2xl flex items-start gap-3"
          style={{
            background: "rgba(255,107,139,0.08)",
            border: "1px solid rgba(255,107,139,0.32)",
            color: "#ff6b8b",
          }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-sm leading-relaxed">{error}</div>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="atom-btn-ghost mt-4 w-full justify-center"
        >
          Sign in instead
        </button>
      </Shell>
    );
  }

  if (!invite) return null;

  return (
    <Shell>
      <div
        className="px-6 py-7 rounded-2xl space-y-5"
        style={{
          background: "color-mix(in oklab, var(--color-primary) 5%, var(--color-surface))",
          border: "1px solid color-mix(in oklab, var(--color-primary) 22%, transparent)",
          boxShadow: "0 0 32px color-mix(in oklab, var(--color-primary) 14%, transparent)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
          <span
            className="text-[10px] uppercase tracking-[0.18em] font-mono"
            style={{ color: "var(--color-primary)" }}
          >
            Invite to {invite.tenant.name}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
            Welcome to ΔTOM
          </h1>
          <p className="text-sm text-white/55 mt-1">
            You've been invited to <strong className="text-white/85">{invite.tenant.name}</strong> as <strong className="text-white/85">{invite.role}</strong>. Set a password and we'll log you straight in.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <input
              value={invite.email}
              disabled
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.55)",
                fontFamily: "var(--font-mono)",
              }}
            />
          </Field>
          <Field label="Full name">
            <input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              autoComplete="name"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={fieldInputStyle}
            />
          </Field>
          <Field label="Set a password" hint="Minimum 8 characters">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl text-sm"
              style={fieldInputStyle}
            />
          </Field>

          {submitErr && (
            <div
              className="text-xs px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,107,139,0.08)", color: "#ff6b8b", border: "1px solid rgba(255,107,139,0.25)" }}
            >
              {submitErr}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="atom-btn-primary w-full justify-center"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", fontWeight: 700 }}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting up your account…</>
              : <><Check className="w-4 h-4" /> Accept & sign in</>}
          </button>
        </form>
      </div>

      <p className="text-xs text-white/35 text-center mt-4 font-mono">
        Already have an account?{" "}
        <a href="/#/login" className="text-white/55 hover:text-white" style={{ color: "var(--color-primary)" }}>
          Sign in
        </a>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            style={{
              width: 48, height: 48, borderRadius: 12,
              background: "var(--color-primary)",
              boxShadow: "0 0 28px color-mix(in oklab, var(--color-primary) 35%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#08080c", fontWeight: 800, fontSize: 22,
              fontFamily: "var(--font-display)",
            }}
          >Δ</div>
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.40)",
            }}
          >ΔTOM Sales Dominator</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-xs font-medium mb-1.5"
        style={{
          color: "rgba(255,255,255,0.40)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}
      >{label}</span>
      {children}
      {hint && (
        <span className="block text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.30)" }}>{hint}</span>
      )}
    </label>
  );
}

const fieldInputStyle: React.CSSProperties = {
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  outline: "none",
  fontFamily: "var(--font-body)",
};
