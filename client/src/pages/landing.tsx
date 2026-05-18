import { useSessionContext } from "../auth/AuthGate";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { TrendingUp, Brain, Shield, PhoneCall } from "lucide-react";
import { DtomLogo, DtomHero } from "@nirmata/dtom-brand-system";

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
      style={{ background: "radial-gradient(120% 80% at 50% 18%, #14141c 0%, #08080c 55%, #020202 100%)" }}
    >
      {/* Top nav — canonical ΔTOM lockup */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5">
        <DtomLogo href="/#/" size="md" spinning />
        <div className="flex items-center gap-3">
          <a href="/#/login" className="atom-btn-ghost" style={{ padding: "0.5rem 1.25rem", fontSize: "var(--text-sm)" }}>
            Sign In
          </a>
          <a href="/#/signup" className="atom-btn-primary" style={{ padding: "0.5rem 1.25rem", fontSize: "var(--text-sm)" }}>
            Start Free Trial
          </a>
        </div>
      </header>

      {/* Black-site aerospace hero — sourced from the canonical brand system */}
      <DtomHero
        eyebrow="v3.0 · Black-Site Aerospace Brand System"
        headline="ΔTOM routes live intent into action."
        body="Autonomous AI voice agents, real-time market intelligence, and objection-proof pitches — engineered like a classified weapons system, deployed like an Apple keynote."
        primaryCta={{ label: "Start 14-Day Free Trial", href: "/#/signup" }}
        secondaryCta={{ label: "Run Live Demo", href: "/#/pitch?demo=1" }}
      />

      {/* ATOM design-system wordmark band — uses Unicode Δ U+0394 and the
          canonical .atom-wordmark / .atom-wordmark__o classes from
          @nirmata/atom-design-system so the teal O is rendered by the
          design system itself, not hard-coded in this file. */}
      <section className="px-6 md:px-10 pt-4 pb-10 max-w-5xl mx-auto text-center">
        <span className="eyebrow" style={{ justifyContent: "center" }}>ATOM Design System · v1</span>
        <div style={{ marginTop: "var(--space-4)" }}>
          <span className="atom-wordmark" style={{ fontSize: "var(--text-2xl)" }}>
            <span>Δ</span>
            <span>T</span>
            <span className="atom-wordmark__o">O</span>
            <span>M</span>
          </span>
        </div>
        <p className="muted" style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
          Cinematic dark-first tokens, motion primitives, and component primitives shared across the ΔTOM suite.
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: "var(--space-4)" }}>
          <span className="tag tag--teal">Tokens</span>
          <span className="tag tag--claude">Components</span>
          <span className="tag tag--gpt">Motion</span>
          <span className="status-badge"><span aria-hidden>●</span> Live</span>
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
                className="atom-card arch-node group flex items-start gap-4 cursor-pointer"
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

      {/* Footer — domain literal preserved (AtomDominator.com) */}
      <footer className="text-center py-8 border-t" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-xs" style={{ color: "var(--color-text-faint)", fontFamily: "var(--font-mono)" }}>
          ΔTOM · AtomDominator.com · © 2026
        </p>
      </footer>
    </div>
  );
}
