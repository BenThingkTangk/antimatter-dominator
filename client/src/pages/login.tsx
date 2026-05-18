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
        {/* Canonical ΔTOM full lockup — orbital icon + wordmark per brand spec */}
        <div className="flex flex-col items-center gap-4">
          <div
            role="img"
            aria-label="ΔTOM"
            style={{
              width: "min(380px, 80vw)",
              color: "var(--color-text, #f0f0f0)",
              filter: "drop-shadow(0 0 22px rgba(0,200,200,0.35))",
            }}
          >
            <svg viewBox="0 0 1100 240" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }}>
              <defs>
                <radialGradient id="login-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="35%" stopColor="#bff3f3" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#00c8c8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="login-shell" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0a1a1c" stopOpacity="1" />
                  <stop offset="70%" stopColor="#06181a" stopOpacity="1" />
                  <stop offset="100%" stopColor="#04121a" stopOpacity="1" />
                </radialGradient>
              </defs>
              <g transform="translate(20 20)">
                <g fill="none" stroke="var(--color-primary, #3fb5b5)" strokeWidth="5" strokeLinecap="round">
                  <ellipse cx="100" cy="100" rx="82" ry="32" />
                  <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(60 100 100)" />
                  <ellipse cx="100" cy="100" rx="82" ry="32" transform="rotate(120 100 100)" />
                </g>
                <circle cx="100" cy="100" r="26" fill="url(#login-shell)" />
                <circle cx="100" cy="100" r="18" fill="url(#login-core)" />
                <circle cx="100" cy="100" r="5" fill="#ffffff" />
              </g>
              <g transform="translate(290 20)" fill="none" strokeLinecap="square" strokeLinejoin="miter">
                <polygon points="100,170 10,170 55,30" stroke="currentColor" strokeWidth="18" />
                <line x1="150" y1="35" x2="310" y2="35" stroke="currentColor" strokeWidth="18" />
                <line x1="230" y1="35" x2="230" y2="170" stroke="currentColor" strokeWidth="18" />
                <circle cx="430" cy="102" r="70" stroke="var(--color-primary, #3fb5b5)" strokeWidth="18" />
                <polyline points="540,170 540,35 615,150 690,35 690,170" stroke="currentColor" strokeWidth="18" />
              </g>
            </svg>
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
