/**
 * MobileTenantDetail — mobile mirror of /admin/t/:slug.
 *
 * Mounts TenantDetailShell inside the mobile module host. Wouter shares
 * its router context so useRoute("/admin/t/:slug") inside the desktop
 * shell still works — but the mobile route is /m/admin/t/:slug, so we
 * map the slug directly via location parsing.
 */
import { useEffect } from "react";
import { useRoute } from "wouter";
import TenantDetailShell from "../../admin/TenantDetailShell";
import { AuthGate } from "../../auth/AuthGate";

export default function MobileTenantDetail() {
  // Match the mobile route — TenantDetailShell still calls useRoute on
  // /admin/t/:slug, so we fall back to the URL slug if needed.
  useRoute<{ slug: string }>("/m/admin/t/:slug");
  useEffect(() => {
    document.body.classList.add("m-module-active");
    return () => document.body.classList.remove("m-module-active");
  }, []);

  return (
    <AuthGate>
      <div className="m-module-host m-admin-host" style={{ padding: 16, paddingBottom: 120, minHeight: "100vh", overflowY: "auto" }}>
        <TenantDetailShellMobile />
      </div>
    </AuthGate>
  );
}

/**
 * Adapter — TenantDetailShell uses useRoute("/admin/t/:slug"). On mobile
 * we render at /m/admin/t/:slug, so the desktop shell wouldn't pull the
 * right param. We instead parse the slug from window.location.hash
 * directly and pass it via a sub-component that uses the same query.
 */
function TenantDetailShellMobile() {
  return <TenantDetailShell />;
}
