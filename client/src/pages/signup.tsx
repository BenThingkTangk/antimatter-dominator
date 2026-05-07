import { useState } from "react";
import { useLocation } from "wouter";

const PLANS = [
  { key: "trial", name: "Trial", price: "$0", period: "14 days", desc: "Auto-rolls to Starter on day 15 — cancel anytime", highlight: true },
  { key: "starter", name: "Starter", price: "$99", period: "/mo", desc: "5 seats · 500 dials/mo" },
  { key: "growth", name: "Growth", price: "$299", period: "/mo", desc: "15 seats · 2,000 dials/mo" },
  { key: "advisory", name: "Advisory", price: "$799", period: "/mo", desc: "50 seats · 10,000 dials/mo" },
  { key: "enterprise", name: "Enterprise", price: "$1,999", period: "/mo", desc: "Unlimited seats · Unlimited dials" },
];

function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const colors = ["var(--color-error)", "var(--color-warning)", "var(--color-warning)", "var(--color-success)", "var(--color-success)"];
  const labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all"
            style={{ background: i < score ? colors[score - 1] : "var(--color-surface-3)" }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[Math.max(0, score - 1)], fontFamily: "var(--font-mono)" }}>
        {labels[Math.max(0, score - 1)]}
      </p>
    </div>
  );
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [plan, setPlan] = useState("trial");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, fullName, companyName, plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // If non-trial plan, redirect to Stripe checkout
      if (plan !== "trial" && data.redirectTo?.startsWith("/api/billing")) {
        const checkoutRes = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ plan }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.checkoutUrl) {
          window.location.href = checkoutData.checkoutUrl;
          return;
        }
      }

      // Default: redirect to app
      window.location.hash = "#/pitch";
      window.location.reload();
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--color-surface-2)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text)",
    fontFamily: "var(--font-body)",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #0c2024 0%, #05090c 58%, #03060a 100%)" }}
    >
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <svg
            className="atom-mark"
            style={{ width: 52, height: 52 }}
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
          <h1 className="atom-wordmark text-2xl" style={{ color: "var(--color-text)" }}>
            ΔT<span>O</span>M
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {step === 1 ? "Create your account" : "Choose your plan"}
          </p>
          {/* Step indicator */}
          <div className="flex gap-2">
            <div className="h-1 w-12 rounded-full" style={{ background: "var(--color-primary)" }} />
            <div className="h-1 w-12 rounded-full" style={{ background: step === 2 ? "var(--color-primary)" : "var(--color-surface-3)" }} />
          </div>
        </div>

        {error && (
          <div className="text-sm text-center py-2 px-3 rounded-lg" style={{ color: "var(--color-error)", background: "color-mix(in oklab, var(--color-error) 10%, transparent)" }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
              setStep(2);
            }}
            className="space-y-4"
          >
            <div className="atom-card-glass p-6 space-y-4" style={{ borderRadius: "var(--radius-2xl)" }}>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Full Name
                </label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="Jane Smith" autoComplete="name" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="jane@company.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Password
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="••••••••" autoComplete="new-password" />
                <PasswordStrength password={password} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Company Name
                </label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="Acme Corp (optional)" autoComplete="organization" />
              </div>
              <button type="submit" className="atom-btn-primary w-full justify-center">
                Continue →
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPlan(p.key)}
                  className="text-left p-4 rounded-xl transition-all"
                  style={{
                    background: plan === p.key ? "color-mix(in oklab, var(--color-primary) 8%, var(--color-surface))" : "var(--color-surface)",
                    border: plan === p.key ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    boxShadow: plan === p.key ? "0 0 20px var(--color-primary-glow)" : "none",
                  }}
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-bold text-sm" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>{p.name}</span>
                    <span>
                      <span className="text-lg font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-display)" }}>{p.price}</span>
                      <span className="text-xs ml-0.5" style={{ color: "var(--color-text-muted)" }}>{p.period}</span>
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{p.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="atom-btn-ghost flex-1 justify-center"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="atom-btn-primary flex-1 justify-center"
              >
                {loading ? "Creating..." : plan === "trial" ? "Start Free Trial" : "Continue to Payment"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Already have an account?{" "}
          <a href="/#/login" className="font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
