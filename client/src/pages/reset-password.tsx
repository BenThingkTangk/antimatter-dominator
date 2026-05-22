import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { DtomLogo } from "@nirmata/atom-design-system/react";

export default function ResetPasswordPage() {
  const params = useParams<{ token?: string }>();
  const token = params?.token;

  return token ? <ConfirmForm token={token} /> : <RequestForm />;
}

// ── Request mode: enter email to receive reset link ──
function RequestForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        Reset your password
      </p>

      {success ? (
        <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
          <div className="text-sm text-center py-3 px-4 rounded-lg" style={{ color: "var(--color-primary)", background: "color-mix(in oklab, var(--color-primary) 10%, transparent)" }}>
            Check your email — if an account exists, we sent a reset link. It expires in 1 hour.
          </div>
          <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            <a href="/#/login" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
              ← Back to sign in
            </a>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
            {error && (
              <div className="text-sm text-center py-2 px-3 rounded-lg" style={{ color: "var(--color-error)", background: "color-mix(in oklab, var(--color-error) 10%, transparent)" }}>
                {error}
              </div>
            )}
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="atom-btn-primary w-full justify-center"
              style={{ padding: "var(--space-3) var(--space-5)" }}
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        Remember your password?{" "}
        <a href="/#/login" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
          Sign in →
        </a>
      </p>
    </Shell>
  );
}

// ── Confirm mode: enter new password using token from URL ──
function ConfirmForm({ token }: { token: string }) {
  const [, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setSuccess(true);
      // Redirect to login after 2s
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        Choose a new password
      </p>

      {success ? (
        <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
          <div className="text-sm text-center py-3 px-4 rounded-lg" style={{ color: "var(--color-primary)", background: "color-mix(in oklab, var(--color-primary) 10%, transparent)" }}>
            Password reset successful! Redirecting to sign in...
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
            {error && (
              <div className="text-sm text-center py-2 px-3 rounded-lg" style={{ color: "var(--color-error)", background: "color-mix(in oklab, var(--color-error) 10%, transparent)" }}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
                placeholder="Min 10 chars, 1 uppercase, 1 number"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="atom-btn-primary w-full justify-center"
              style={{ padding: "var(--space-3) var(--space-5)" }}
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        <a href="/#/login" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
          ← Back to sign in
        </a>
      </p>
    </Shell>
  );
}

// ── Shared layout shell ──
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div style={{ width: "min(280px, 70vw)", filter: "drop-shadow(0 0 22px rgba(0,200,200,0.35))" }}>
            <DtomLogo size="lg" showWordmark={true} showIcon={false} ariaLabel="ΔTOM" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
