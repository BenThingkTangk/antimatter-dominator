import { useState } from "react";
import { useLocation } from "wouter";
import { DtomLogo } from "@nirmata/atom-design-system/react";

const PLANS = [
  { key: "trial",      name: "Trial",      price: "$0",   period: "14 days",   desc: "Pick a paid plan with trial on the next page — cancel anytime", highlight: true },
  { key: "starter",    name: "Starter",    price: "$99",  period: "/seat/mo", desc: "Min 5 seats · 500 dials/mo · 14-day free trial" },
  { key: "growth",     name: "Growth",     price: "$199", period: "/seat/mo", desc: "Min 15 seats · 2,000 dials/mo · 14-day free trial" },
  { key: "advisory",   name: "Advisory",   price: "$499", period: "/seat/mo", desc: "Min 50 seats · 10,000 dials/mo · 14-day free trial" },
  { key: "enterprise", name: "Enterprise", price: "$999", period: "/seat/mo", desc: "Custom seats · Unlimited dials · Dedicated voice + telephony" },
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

      // Always send the new tenant to the in-app Billing page so they can
      // pick a plan, choose seats, and start a 14-day free trial — even if
      // they originally clicked "Trial" (which is just a label for the paid
      // plan + 14-day Stripe trial). They can also skip and start exploring.
      window.location.hash = "#/billing";
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
      style={{ background: "radial-gradient(120% 80% at 50% 32%, #14141c 0%, #08080c 58%, #020202 100%)" }}
    >
      <div className="w-full max-w-lg space-y-8">
        {/* Canonical ΔTOM wordmark per brand spec */}
        <div className="flex flex-col items-center gap-3">
          <div style={{ width: "min(280px, 70vw)", filter: "drop-shadow(0 0 22px rgba(0,200,200,0.35))" }}>
            <DtomLogo size="lg" showWordmark={true} showIcon={false} ariaLabel="ΔTOM" />
          </div>
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
