/**
 * /billing — Tenant-facing pricing & plan management page.
 *
 * One page handles: (1) the upgrade flow with seat selector + 14-day trial,
 * (2) the post-checkout success/cancel banner, and (3) "Manage billing"
 * for tenants who already have a Stripe customer (opens Stripe Billing Portal
 * to update card, change seats, or cancel).
 *
 * Backed by:
 *   GET  /api/billing/me        → tenant + live subscription + catalog
 *   POST /api/billing/checkout  → returns Stripe Checkout Session URL
 *   POST /api/billing/portal    → returns Stripe Billing Portal URL
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, ExternalLink, Minus, Plus, Sparkles, AlertTriangle } from "lucide-react";

interface CatalogItem {
  plan: string;
  label: string;
  perSeatCents: number;
  annualPerSeatCents: number;
  minSeats: number;
  freeTrialDays: number;
  positioning: string;
  includes: string[];
  excludes: string[];
  highlight: boolean;
  priceId: string;
  caps: Record<string, number>;
}

interface UsageEntry { used: number; cap: number; }

interface BillingMe {
  authenticated: boolean;
  tenant?: {
    id: string;
    slug: string;
    name: string;
    owner_email: string | null;
    plan: string | null;
    seats: number;
    subscription_status: string | null;
    trial_ends_at: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    kill_switch: boolean;
  };
  liveSubscription?: {
    status: string;
    seats: number;
    unitAmountCents: number | null;
    currency: string;
    interval: string;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  catalog: CatalogItem[];
  usage: Record<string, UsageEntry>;
  stripeConfigured: boolean;
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const map: Record<string, { fg: string; bg: string; border: string }> = {
    active:    { fg: "var(--color-success)", bg: "color-mix(in oklab, var(--color-success) 10%, transparent)", border: "color-mix(in oklab, var(--color-success) 32%, transparent)" },
    trialing:  { fg: "var(--color-primary-2)", bg: "color-mix(in oklab, var(--color-primary-2) 10%, transparent)", border: "color-mix(in oklab, var(--color-primary-2) 32%, transparent)" },
    past_due:  { fg: "var(--color-warning)", bg: "color-mix(in oklab, var(--color-warning) 10%, transparent)", border: "color-mix(in oklab, var(--color-warning) 32%, transparent)" },
    canceled:  { fg: "#ff6b8b", bg: "rgba(255,107,139,0.10)", border: "rgba(255,107,139,0.32)" },
    unpaid:    { fg: "#ff6b8b", bg: "rgba(255,107,139,0.10)", border: "rgba(255,107,139,0.32)" },
  };
  const tone = map[status] || { fg: "var(--color-text-muted)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" };
  return (
    <span style={{
      padding: "3px 12px", borderRadius: 999,
      background: tone.bg, color: tone.fg,
      border: `1px solid ${tone.border}`,
      fontFamily: "var(--font-mono)", fontSize: 10,
      letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
    }}>{status.replace("_", " ")}</span>
  );
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<BillingMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [selectedPlan, setSelectedPlan] = useState<string>("growth");
  const [seats, setSeats] = useState<number>(5);
  const [withTrial, setWithTrial] = useState<boolean>(true);
  const [busy, setBusy] = useState<"" | "checkout" | "portal">("");

  // Read ?checkout=success|cancel banner once
  const checkoutParam = (() => {
    const m = window.location.hash.match(/[?&]checkout=([^&]+)/);
    return m ? m[1] : "";
  })();

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/billing/me", { credentials: "include" });
      if (!r.ok) throw new Error(`${r.status}`);
      const j: BillingMe = await r.json();
      setData(j);
      // If tenant already has a plan, preselect it
      if (j.tenant?.plan && j.catalog.some((c) => c.plan === j.tenant?.plan)) {
        setSelectedPlan(j.tenant.plan);
      }
      if (j.liveSubscription?.seats) setSeats(j.liveSubscription.seats);
    } catch (e: any) {
      setError(e?.message || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (checkoutParam === "success") {
      toast({ title: "Subscription started", description: "Stripe will sync your seat count and trial in a moment." });
      // Poll once after a short delay so Stripe webhook can land
      setTimeout(refresh, 3000);
    } else if (checkoutParam === "cancel") {
      toast({ title: "Checkout canceled", description: "No charges were made.", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutParam]);

  const catalog = data?.catalog || [];
  const current = useMemo(() => catalog.find((c) => c.plan === selectedPlan) || catalog[1] || null, [catalog, selectedPlan]);
  const minSeats = current?.minSeats || 1;

  useEffect(() => {
    if (current && seats < minSeats) setSeats(minSeats);
  }, [current, minSeats, seats]);

  const monthlyTotal = current ? current.perSeatCents * seats : 0;

  async function startCheckout() {
    if (!data?.authenticated) {
      toast({ title: "Sign in first", description: "Please log in to subscribe.", variant: "destructive" });
      navigate("/login");
      return;
    }
    setBusy("checkout");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: selectedPlan, seats, withTrial }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Checkout failed");
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return;
      }
      toast({
        title: "Stripe not configured yet",
        description: j.message || "Add STRIPE_SECRET_KEY to enable checkout.",
        variant: "destructive",
      });
    } catch (e: any) {
      toast({ title: "Checkout error", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Portal failed");
      if (j.portalUrl) {
        window.location.href = j.portalUrl;
        return;
      }
      toast({ title: "Billing portal unavailable", description: j.message || "Stripe not configured.", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Portal error", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading billing…
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto" style={{ fontFamily: "var(--font-body)" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>Billing & Plan</h1>
        <p className="text-sm text-white/45 mt-1">
          Pick a plan, choose seats, and start your 14-day free trial. You won't be charged until day 15 — cancel anytime from the Stripe billing portal.
        </p>
      </div>

      {!data?.stripeConfigured && (
        <div
          className="mb-5 px-4 py-3 rounded-xl flex items-start gap-3"
          style={{
            background: "color-mix(in oklab, var(--color-warning) 8%, transparent)",
            border: "1px solid color-mix(in oklab, var(--color-warning) 30%, transparent)",
            color: "var(--color-warning)",
          }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            Stripe secret key is not configured yet. Pricing displays correctly, but checkout will return an error until <code className="font-mono">STRIPE_SECRET_KEY</code> is set in Vercel.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl text-xs" style={{ background: "rgba(255,107,139,0.08)", color: "#ff6b8b", border: "1px solid rgba(255,107,139,0.25)" }}>
          {error}
        </div>
      )}

      {/* Current subscription summary */}
      {data?.authenticated && data.tenant && (
        <div
          className="mb-6 px-5 py-4 rounded-2xl flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: "color-mix(in oklab, var(--color-primary) 4%, var(--color-surface))",
            border: "1px solid color-mix(in oklab, var(--color-primary) 18%, transparent)",
          }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-mono mb-1">Current plan</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold text-white capitalize" style={{ fontFamily: "var(--font-display)" }}>
                {data.tenant.plan || "trial"}
              </span>
              <StatusBadge status={data.tenant.subscription_status} />
              {data.liveSubscription?.seats && (
                <span className="text-xs text-white/55 font-mono">· {data.liveSubscription.seats} seat{data.liveSubscription.seats === 1 ? "" : "s"}</span>
              )}
              {data.liveSubscription?.unitAmountCents != null && (
                <span className="text-xs text-white/55 font-mono">· {formatMoney(data.liveSubscription.unitAmountCents)} / seat / {data.liveSubscription.interval}</span>
              )}
            </div>
            {data.liveSubscription?.trialEnd && new Date(data.liveSubscription.trialEnd) > new Date() && (
              <div className="text-[11px] text-white/40 font-mono mt-1">
                Trial ends {new Date(data.liveSubscription.trialEnd).toLocaleDateString()}
              </div>
            )}
            {data.liveSubscription?.currentPeriodEnd && (!data.liveSubscription?.trialEnd || new Date(data.liveSubscription.trialEnd) <= new Date()) && (
              <div className="text-[11px] text-white/40 font-mono mt-1">
                Next invoice {new Date(data.liveSubscription.currentPeriodEnd).toLocaleDateString()}
                {data.liveSubscription.cancelAtPeriodEnd && " · canceling at period end"}
              </div>
            )}
          </div>

          {data.tenant.stripe_customer_id && (
            <button
              onClick={openPortal}
              disabled={busy !== ""}
              className="atom-btn-ghost"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {busy === "portal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Manage billing
            </button>
          )}
        </div>
      )}

      {/* Entitlement usage — progress bars */}
      {data?.authenticated && data.usage && Object.keys(data.usage).length > 0 && (
        <div
          className="mb-6 px-5 py-4 rounded-2xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-mono mb-3">Usage this period</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {Object.entries(data.usage).map(([key, val]) => {
              const pct = val.cap > 0 ? Math.min(100, Math.round((val.used / val.cap) * 100)) : 0;
              const isUnlimited = val.cap < 0;
              const barColor = isUnlimited
                ? "var(--color-primary)"
                : pct >= 90
                  ? "#ff6b8b"
                  : pct >= 70
                    ? "var(--color-warning)"
                    : "var(--color-primary)";
              const LABELS: Record<string, string> = {
                voice: "Dial Minutes",
                campaign_voice: "Campaign Minutes",
                sms: "SMS",
                email: "Emails",
                pitch: "Pitches",
                objection: "Objections",
                warbook: "WarBook Queries",
                warroom: "War Room Analyses",
                leadgen: "Prospect Enrichments",
                signal: "Signal Queries",
              };
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] text-white/60 font-medium">{LABELS[key] || key}</span>
                    <span className="text-[10px] font-mono text-white/40">
                      {isUnlimited ? `${val.used} / unlimited` : `${val.used} / ${val.cap}`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: isUnlimited ? "5%" : `${pct}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {catalog.map((c) => {
          const selected = selectedPlan === c.plan;
          const isCurrent = data?.tenant?.plan === c.plan;
          return (
            <button
              key={c.plan}
              onClick={() => setSelectedPlan(c.plan)}
              className="text-left p-5 rounded-2xl transition-all"
              style={{
                background: selected
                  ? "color-mix(in oklab, var(--color-primary) 8%, var(--color-surface))"
                  : "var(--color-surface)",
                border: selected
                  ? "1.5px solid color-mix(in oklab, var(--color-primary) 60%, transparent)"
                  : "1px solid var(--color-border)",
                boxShadow: selected
                  ? "0 0 24px color-mix(in oklab, var(--color-primary) 18%, transparent)"
                  : "none",
                cursor: "pointer",
              }}
            >
              <div className="flex items-baseline justify-between mb-2 gap-2">
                <span className="text-base font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  {c.label}
                </span>
                {isCurrent && (
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 9,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "var(--color-primary)",
                    padding: "2px 8px", borderRadius: 999,
                    background: "color-mix(in oklab, var(--color-primary) 10%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--color-primary) 32%, transparent)",
                  }}>current</span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-2xl font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-display)" }}>
                  {formatMoney(c.perSeatCents)}
                </span>
                <span className="text-xs text-white/45 ml-1.5">/ seat / month</span>
              </div>
              <div className="text-[11px] text-white/45 font-mono mb-1 leading-relaxed">
                {c.minSeats > 0 ? `Min ${c.minSeats} seats` : "Custom seat count"}
              </div>
              {c.positioning && (
                <p className="text-[11px] text-white/50 mb-3 leading-relaxed">{c.positioning}</p>
              )}
              <ul className="space-y-1.5">
                {c.includes.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-white/65">
                    <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Configure + checkout */}
      {current && (
        <div
          className="mt-6 p-5 rounded-2xl"
          style={{
            background: "color-mix(in oklab, var(--color-primary) 3%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="grid gap-5" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-mono mb-2">Seats</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSeats(Math.max(minSeats, seats - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "white" }}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={minSeats}
                  max={500}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(minSeats, Math.min(500, Number(e.target.value) || minSeats)))}
                  className="w-20 text-center px-3 py-2 rounded-lg text-sm font-bold"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", color: "white", fontFamily: "var(--font-display)" }}
                />
                <button
                  onClick={() => setSeats(Math.min(500, seats + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "white" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-white/40 font-mono ml-2">
                  Min {minSeats} · max 500
                </span>
              </div>
              <label
                className="flex items-center gap-2 mt-4 cursor-pointer text-xs text-white/65"
                style={{ userSelect: "none" }}
              >
                <input
                  type="checkbox"
                  checked={withTrial}
                  onChange={(e) => setWithTrial(e.target.checked)}
                  style={{ accentColor: "var(--color-primary)" }}
                />
                <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-primary)" }} />
                Start with a {current?.freeTrialDays || 14}-day free trial (no charge until day {(current?.freeTrialDays || 14) + 1})
              </label>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-mono mb-2">Monthly total</div>
              <div className="text-3xl font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-display)" }}>
                {formatMoney(monthlyTotal)}
              </div>
              <div className="text-xs text-white/45 mt-1 font-mono">
                {seats} × {formatMoney(current.perSeatCents)} / seat
              </div>
              <button
                onClick={startCheckout}
                disabled={busy !== ""}
                className="atom-btn-primary mt-4"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", fontWeight: 700 }}
              >
                {busy === "checkout"
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                  : withTrial
                    ? <><Sparkles className="w-4 h-4" /> Start 14-day free trial</>
                    : <><Check className="w-4 h-4" /> Subscribe now</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-[11px] text-white/30 font-mono leading-relaxed text-center">
        All prices in USD · Stripe handles billing, taxes, invoices, and PCI-compliant card storage.
        You can change plan, seats, or cancel anytime from the billing portal.
      </div>
    </div>
  );
}
