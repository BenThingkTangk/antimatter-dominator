/**
 * MobileVibranium — mobile mirror of /admin/vibranium-ga for super_admins on the go.
 *
 * Reuses the desktop VibraniumShell inside the .m-module-host CSS scope so we get
 * proper mobile padding + scroll behaviour without duplicating the chart logic.
 */
import { useEffect } from "react";
import VibraniumShell from "../../admin/VibraniumShell";
import { AuthGate } from "../../auth/AuthGate";

export default function MobileVibranium() {
  useEffect(() => {
    document.body.classList.add("m-module-active");
    return () => document.body.classList.remove("m-module-active");
  }, []);

  return (
    <AuthGate>
      <div
        className="m-module-host m-admin-host"
        style={{ padding: 16, paddingBottom: 120, minHeight: "100vh", overflowY: "auto" }}
      >
        <VibraniumShell />
      </div>
    </AuthGate>
  );
}
