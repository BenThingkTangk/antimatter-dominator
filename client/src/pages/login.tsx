import { useState } from "react";
import { useLocation } from "wouter";
import { useSessionContext } from "../auth/AuthGate";
import { DtomLogo } from "@nirmata/atom-design-system/react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user } = useSessionContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (user) {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const next = params.get("next") || "/dashboard";
    navigate(next);
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      // Redirect
      const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
      const next = params.get("next") || "/dashboard";
      window.location.hash = `#${next}`;
      window.location.reload();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Canonical ΔTOM wordmark — brand-spec only, no orbital icon */}
        <div className="flex flex-col items-center gap-4">
          <div style={{ width: "min(280px, 70vw)", filter: "drop-shadow(0 0 22px rgba(0,200,200,0.35))" }}>
            <DtomLogo size="lg" showWordmark={true} showIcon={false} ariaLabel="ΔTOM" />
          </div>
          <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Sign in to Sales Dominator
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
            {error && (
              <div className="text-sm text-center py-2 px-3 rounded-lg" style={{ color: "var(--color-error)", background: "color-mix(in oklab, var(--color-error) 10%, transparent)" }}>
                {error}
              </div>
            )}
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
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="atom-btn-primary w-full justify-center"
              style={{ padding: "var(--space-3) var(--space-5)" }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <div className="text-center" style={{ marginTop: 8 }}>
              <a href="/#/reset-password" style={{ color: 'var(--color-text-muted)', fontSize: 13, textDecoration: 'none' }}>
                Forgot password?
              </a>
            </div>
          </div>
        </form>

        <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          New here?{" "}
          <a
            href="/#/signup"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-primary)" }}
          >
            Start a 14-day free trial →
          </a>
        </p>
      </div>
    </div>
  );
}
