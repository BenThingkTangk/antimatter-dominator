/**
 * MobileSettings — voice/model preferences, tenant info, install prompt.
 *
 * Includes the "Open admin" link for tenant superusers and an Install
 * Home Screen prompt that uses the deferred beforeinstallprompt event.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Moon, Sun, Building2, Download, ExternalLink, Activity } from "lucide-react";
import { MobileShell } from "../MobileShell";
import { useTenant } from "../../lib/useTenant";

export default function MobileSettings() {
  const { tenant } = useTenant();
  const [dark, setDark] = useState(true);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [haptic, setHaptic] = useState<boolean>(() => {
    try { return localStorage.getItem("m_haptic") !== "0"; } catch { return true; }
  });

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    try { localStorage.setItem("m_haptic", haptic ? "1" : "0"); } catch {}
  }, [haptic]);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  return (
    <MobileShell title="Settings">
      <div className="m-stack-lg">
        {/* Tenant card */}
        <div className="m-card">
          <div className="m-card-eyebrow">Tenant</div>
          <div className="m-row" style={{ gap: 12, marginTop: 10 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(0,230,211,0.1)",
              display: "grid", placeItems: "center",
              color: "#00e6d3",
            }}>
              <Building2 size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{tenant?.name ?? "AntimatterAI"}</div>
              <div className="m-text-muted" style={{ fontSize: 13 }}>
                {(tenant?.plan ?? "standard").toUpperCase()} · slug: <span className="m-mono">{tenant?.slug ?? "antimatter"}</span>
              </div>
            </div>
          </div>
          <Link href="/m/admin" className="m-btn m-btn-ghost" style={{ marginTop: 14 }}>
            <Building2 size={16} /> Open tenant admin
          </Link>
        </div>

        {/* Appearance */}
        <div className="m-card">
          <div className="m-card-eyebrow">Appearance</div>
          <div className="m-row-btw" style={{ marginTop: 12 }}>
            <span className="m-row" style={{ gap: 10 }}>
              {dark ? <Moon size={18} className="m-text-muted" /> : <Sun size={18} className="m-text-muted" />}
              <span>Dark mode</span>
            </span>
            <button
              className="m-btn"
              style={{ width: 64, minHeight: 32, padding: 0, background: dark ? "#00e6d3" : "rgba(255,255,255,0.08)", color: dark ? "#041413" : "#9ca8ad", border: "none" }}
              onClick={() => setDark((v) => !v)}
              aria-pressed={dark}
            >
              {dark ? "ON" : "OFF"}
            </button>
          </div>
          <div className="m-row-btw" style={{ marginTop: 12 }}>
            <span className="m-row" style={{ gap: 10 }}>
              <Activity size={18} className="m-text-muted" />
              <span>Haptic feedback</span>
            </span>
            <button
              className="m-btn"
              style={{ width: 64, minHeight: 32, padding: 0, background: haptic ? "#00e6d3" : "rgba(255,255,255,0.08)", color: haptic ? "#041413" : "#9ca8ad", border: "none" }}
              onClick={() => setHaptic((v) => !v)}
            >
              {haptic ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Install prompt */}
        {installEvent && (
          <div className="m-card m-card-glow">
            <div className="m-card-eyebrow">Install ATOM</div>
            <div className="m-card-title" style={{ fontSize: 18, marginTop: 6 }}>Add to home screen</div>
            <div className="m-text-muted" style={{ fontSize: 13, marginTop: 6 }}>
              Launches without a browser bar. Faster and feels native.
            </div>
            <button className="m-btn m-btn-primary" style={{ marginTop: 12 }} onClick={install}>
              <Download size={16} /> Install
            </button>
          </div>
        )}

        {/* Stack info */}
        <div className="m-card">
          <div className="m-card-eyebrow">Stack</div>
          <div className="m-stack" style={{ marginTop: 12, fontSize: 14 }}>
            <div className="m-row-btw"><span className="m-text-muted">Voice</span><span className="m-mono">Hume EVI</span></div>
            <div className="m-row-btw"><span className="m-text-muted">LLM ensemble</span><span className="m-mono">Claude · GPT-5 · Sonar</span></div>
            <div className="m-row-btw"><span className="m-text-muted">Embeddings</span><span className="m-mono">pplx-embed-v1-0.6b</span></div>
            <div className="m-row-btw"><span className="m-text-muted">Vector store</span><span className="m-mono">Pinecone serverless</span></div>
          </div>
        </div>

        {/* Switch to desktop */}
        <a className="m-row" href="#/" style={{ justifyContent: "center", gap: 6, color: "#00a7ff", fontSize: 14, padding: 12 }}>
          <ExternalLink size={14} /> Switch to desktop view
        </a>
      </div>
    </MobileShell>
  );
}
