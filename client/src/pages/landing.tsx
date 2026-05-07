import { useSessionContext } from "../auth/AuthGate";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { TrendingUp, Brain, Shield, PhoneCall } from "lucide-react";

const features = [
  { icon: TrendingUp, title: "AI Pitch Generator", desc: "RAG-powered objection-proof scripts in seconds", href: "/pitch?demo=1" },
  { icon: Brain, title: "WarBook Intelligence", desc: "Deep company research with competitive analysis", href: "/company-intelligence?demo=1" },
  { icon: Shield, title: "Market Intent Scanner", desc: "Real-time buying signals across your ICP", href: "/market?demo=1" },
  { icon: PhoneCall, title: "Autonomous Lead Gen", desc: "AI voice agents that book meetings 24/7", href: "/atom-leadgen?demo=1" },
];

export default function LandingPage() {
  const { user } = useSessionContext();
  const [, navigate] = useLocation();

  // If authenticated, redirect to pitch (the main app)
  useEffect(() => {
    if (user) navigate("/pitch");
  }, [user, navigate]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "radial-gradient(120% 80% at 50% 18%, #0c2024 0%, #05090c 55%, #03060a 100%)" }}
    >
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <svg
            className="atom-mark"
            style={{ width: 32, height: 32 }}
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
          <span className="atom-wordmark text-lg" style={{ color: "var(--color-text)" }}>
            ΔT<span>O</span>M
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#/login" className="atom-btn-ghost" style={{ padding: "0.5rem 1.25rem", fontSize: "var(--text-sm)" }}>
            Sign In
          </a>
          <a href="/#/signup" className="atom-btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "var(--text-sm)" }}>
            Start Free Trial
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-20 md:pt-28 md:pb-28">
        <p className="atom-eyebrow mb-4">AI-Powered Sales Intelligence</p>
        <h1
          className="atom-hero-title mx-auto"
          style={{ maxWidth: "800px" }}
        >
          ΔTOM routes live intent<br />into action.
        </h1>
        <p
          className="mt-6 text-lg mx-auto"
          style={{ color: "var(--color-text-muted)", maxWidth: "560px", fontFamily: "var(--font-body)" }}
        >
          Autonomous AI voice agents, real-time market intelligence, and objection-proof pitches — all in one platform.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <a href="/#/signup" className="atom-btn-primary" style={{ fontSize: "var(--text-base)" }}>
            Start 14-Day Free Trial
          </a>
          <a href="/#/pitch?demo=1" className="atom-btn-ghost" style={{ fontSize: "var(--text-base)" }}>
            Try Demo
          </a>
        </div>
      </section>

      {/* Feature tiles */}
      <section className="px-6 md:px-10 pb-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <a
                key={f.title}
                href={`/#${f.href}`}
                className="atom-card group flex items-start gap-4 cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "color-mix(in oklab, var(--color-primary) 12%, transparent)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: "var(--color-text)", fontFamily: "var(--font-display)" }}>
                    {f.title}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {f.desc}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
          ΔTOM · Nirmata Holdings · © 2026
        </p>
      </footer>
    </div>
  );
}
