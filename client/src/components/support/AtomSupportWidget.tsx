import { useState, useEffect } from "react";
import { SupportLauncher } from "./SupportLauncher";
import { SupportChatPanel } from "./SupportChatPanel";

interface Props {
  /** "app" = logged-in product surface, "marketing" = public site. */
  surface?: "app" | "marketing";
  /** Whether the current viewer is authenticated (enables account-aware mode). */
  loggedIn?: boolean;
}

/**
 * ATOM Support — bottom-right floating widget. Works on both the marketing site
 * (logged-out) and inside the app (logged-in, account-aware). Keyboard
 * accessible (Esc closes, focus trapped to the panel composer) and mobile
 * responsive (panel clamps to viewport).
 */
export function AtomSupportWidget({ surface = "app", loggedIn = false }: Props) {
  const [open, setOpen] = useState(false);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className="fixed z-[60] flex flex-col items-end gap-3"
      style={{ right: "1.25rem", bottom: "1.25rem" }}
    >
      {open && (
        <div style={{ animation: "atom-support-rise 180ms ease-out" }}>
          <SupportChatPanel surface={surface} loggedIn={loggedIn} onClose={() => setOpen(false)} />
        </div>
      )}
      <SupportLauncher open={open} onClick={() => setOpen((o) => !o)} />
      <style>{`
        @keyframes atom-support-rise {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default AtomSupportWidget;
