import { useState } from "react";
import { useSessionContext } from "@/auth/AuthGate";
import { X, ArrowRight } from "lucide-react";

const DISMISS_KEY_PREFIX = "atom_trial_banner_dismissed_";

export function TrialBanner() {
  const { tenant } = useSessionContext();

  const [dismissed, setDismissed] = useState(() => {
    if (!tenant?.id) return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY_PREFIX + tenant.id) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  // Hide for active subscriptions
  if (tenant?.subscription_status === "active") return null;

  // Hide if no trial end date
  if (!tenant?.trial_ends_at) return null;

  const trialEndsAt = new Date(tenant.trial_ends_at).getTime();
  const now = Date.now();
  const daysRemaining = Math.ceil((trialEndsAt - now) / 86_400_000);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY_PREFIX + tenant.id, "1");
    } catch {}
  };

  let text: string;
  let urgent = false;
  let expired = false;

  if (daysRemaining > 7) {
    text = `Welcome to ΔTOM — ${daysRemaining} days left in your trial.`;
  } else if (daysRemaining > 3) {
    text = `Your trial ends in ${daysRemaining} days — `;
  } else if (daysRemaining >= 1) {
    text = `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Lock in your seats → `;
    urgent = true;
  } else {
    text = "Your trial has ended — ";
    urgent = true;
    expired = true;
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 text-[13px] font-medium shrink-0"
      style={{
        minHeight: 32,
        background: urgent
          ? "color-mix(in oklab, var(--color-error, #ef4444) 10%, transparent)"
          : "color-mix(in oklab, var(--color-primary) 8%, transparent)",
        borderBottom: urgent
          ? "1px solid color-mix(in oklab, var(--color-error, #ef4444) 25%, transparent)"
          : "1px solid color-mix(in oklab, var(--color-primary) 15%, transparent)",
        color: urgent ? "var(--color-error, #ef4444)" : "var(--color-text-muted)",
      }}
    >
      <span>{text}</span>

      {(daysRemaining <= 7 || expired) && (
        <a
          href="/#/billing"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-bold transition-colors"
          style={{
            background: urgent ? "var(--color-error, #ef4444)" : "var(--color-primary)",
            color: "var(--color-text-inverse, #fff)",
          }}
        >
          {expired ? "Upgrade to continue dialing" : "Upgrade now"} <ArrowRight size={12} />
        </a>
      )}

      <button
        onClick={dismiss}
        className="ml-auto shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/[0.06] transition-colors"
        style={{ color: "var(--color-text-muted)" }}
        aria-label="Dismiss trial banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}
