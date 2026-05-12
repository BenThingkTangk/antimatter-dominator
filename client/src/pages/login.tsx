import { useState } from "react";
import { useLocation } from "wouter";
import { useSessionContext } from "../auth/AuthGate";

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
    const next = params.get("next") || "/pitch";
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
      const next = params.get("next") || "/pitch";
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
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <svg
            className="atom-mark"
            style={{ width: 64, height: 64 }}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle className="atom-atmosphere" cx="32" cy="32" r="30" />
            <g className="atom-orbits">
              <ellipse className="atom-orbit atom-orbit-a" cx="32" cy="32" rx="12" ry="29" />
              <ellipse className="atom-orbit atom-orbit-b" cx="32" cy="32" rx="29" ry="12" />
              <ellipse className="atom-orbit atom-orbit-c" cx="32" cy="32" rx="23" ry="10" transform="rotate(45 32 32)" />
            </g>
            <circle className="atom-nucleus" cx="32" cy="32" r="4.25" />
            <circle className="atom-electron atom-electron-a" cx="32" cy="3" r="2.6" />
            <circle className="atom-electron atom-electron-b" cx="61" cy="32" r="2.4" />
            <circle className="atom-electron atom-electron-c" cx="15.5" cy="48.5" r="2.2" />
          </svg>
          <h1 className="atom-wordmark text-3xl" style={{ color: "var(--color-text)" }}>
            ΔT<span>O</span>M
          </h1>
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
