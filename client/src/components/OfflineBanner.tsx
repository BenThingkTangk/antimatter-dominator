/**
 * OfflineBanner — thin sticky banner when navigator.onLine === false.
 * Only renders in the mobile shell (gated by caller).
 */
import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        fontSize: 12,
        fontFamily: "var(--font-mono, monospace)",
        color: "#ff6b8b",
        background: "rgba(255, 107, 139, 0.08)",
        borderBottom: "1px solid rgba(255, 107, 139, 0.25)",
      }}
    >
      <WifiOff size={14} />
      <span>You're offline — showing your last synced pipeline. Reconnect to dial.</span>
    </div>
  );
}
