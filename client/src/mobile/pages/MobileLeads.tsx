/**
 * MobileLeads — swipeable card stack.
 *
 * Swipe left → dial that lead (navigates to /m/dial pre-filled via sessionStorage).
 * Swipe right → snooze (drops the card off the stack).
 * Tap → opens detail sheet.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Phone, Building2, DollarSign, Sparkles } from "lucide-react";
import { MobileShell } from "../MobileShell";

interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  phone: string;
  dealValueUsd: number;
  signalScore: number; // 0..100
  hot?: boolean;
}

const DEMO_LEADS: Lead[] = [
  { id: "l1", name: "Sasha Patel",   title: "VP Marketing",       company: "Vidzee",        phone: "+1 555 0142", dealValueUsd:  82000, signalScore: 92, hot: true },
  { id: "l2", name: "Carlos Gomez",  title: "Director of Sales",  company: "Akamai",        phone: "+1 555 0188", dealValueUsd: 240000, signalScore: 88, hot: true },
  { id: "l3", name: "Priya Shah",    title: "Head of RevOps",     company: "Five9",         phone: "+1 555 0177", dealValueUsd:  60000, signalScore: 81 },
  { id: "l4", name: "Owen Reilly",   title: "CMO",                company: "TierPoint",     phone: "+1 555 0123", dealValueUsd:  48000, signalScore: 74 },
  { id: "l5", name: "Mei Tanaka",    title: "Chief Medical Off.", company: "ClinixAI",      phone: "+1 555 0166", dealValueUsd: 150000, signalScore: 70 },
];

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export default function MobileLeads() {
  const [, navigate] = useLocation();
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [active, setActive] = useState(0);
  const [dx, setDx] = useState(0);
  const startXRef = useRef<number | null>(null);

  // Try to load real leads if endpoint exists; gracefully fall back to demo.
  useEffect(() => {
    fetch("/api/leads/queue")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.leads?.length) setLeads(d.leads as Lead[]);
      })
      .catch(() => { /* keep demo */ });
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startXRef.current == null) return;
    setDx(e.touches[0].clientX - startXRef.current);
  }
  function onTouchEnd() {
    const distance = dx;
    startXRef.current = null;
    if (Math.abs(distance) > 110) {
      const lead = leads[active];
      if (distance < 0 && lead) {
        // swipe-left → dial
        try {
          sessionStorage.setItem("m_dial_prefill", JSON.stringify({
            name: lead.name.split(" ")[0],
            phone: lead.phone,
            dealValue: String(lead.dealValueUsd),
          }));
        } catch {}
        navigate("/m/dial");
        setDx(0);
        return;
      }
      // swipe-right → snooze
      setLeads((prev) => prev.filter((_, i) => i !== active));
      setActive(0);
    }
    setDx(0);
  }

  const lead = leads[active];

  return (
    <MobileShell title="Leads">
      <div className="m-stack-lg">
        <div className="m-row-btw">
          <span className="m-eyebrow">Today's queue</span>
          <span className="m-mono m-text-muted" style={{ fontSize: 12 }}>{leads.length} pending</span>
        </div>

        {!lead && (
          <div className="m-card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <Sparkles size={28} style={{ color: "#00e6d3", marginBottom: 10 }} />
            <div className="m-card-title" style={{ fontSize: 20, marginBottom: 4 }}>Inbox zero</div>
            <div className="m-text-muted" style={{ fontSize: 14 }}>You worked through the queue. New intent signals will land here.</div>
          </div>
        )}

        {lead && (
          <div
            className="m-swipe-card m-card m-card-glow"
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 24}deg)`,
              opacity: 1 - Math.min(0.4, Math.abs(dx) / 400),
              minHeight: 260,
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="m-swipe-actions">
              <span className="m-swipe-left" style={{ opacity: dx < -20 ? 1 : 0.25 }}>← Dial</span>
              <span className="m-swipe-right" style={{ opacity: dx > 20 ? 1 : 0.25 }}>Snooze →</span>
            </div>

            <div className="m-row-btw">
              {lead.hot ? (
                <span className="m-pill m-pill-live"><span className="m-pill-dot" />Hot</span>
              ) : (
                <span className="m-pill">Warm</span>
              )}
              <span className="m-mono m-text-muted" style={{ fontSize: 12 }}>Score {lead.signalScore}</span>
            </div>

            <div style={{ marginTop: 18 }}>
              <div className="m-card-title">{lead.name}</div>
              <div className="m-text-muted" style={{ fontSize: 14, marginTop: 4 }}>{lead.title}</div>
            </div>

            <div className="m-divider" />

            <div className="m-grid-2" style={{ rowGap: 10 }}>
              <div>
                <div className="m-eyebrow">Company</div>
                <div className="m-row" style={{ gap: 6, marginTop: 4, fontSize: 14 }}>
                  <Building2 size={14} className="m-text-muted" />
                  {lead.company}
                </div>
              </div>
              <div>
                <div className="m-eyebrow">Deal</div>
                <div className="m-row" style={{ gap: 6, marginTop: 4, fontSize: 14 }}>
                  <DollarSign size={14} className="m-text-muted" />
                  {formatUsd(lead.dealValueUsd)}
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div className="m-eyebrow">Phone</div>
                <div className="m-row" style={{ gap: 6, marginTop: 4, fontSize: 14 }}>
                  <Phone size={14} className="m-text-muted" />
                  {lead.phone}
                </div>
              </div>
            </div>
          </div>
        )}

        {leads.length > 1 && lead && (
          <div className="m-row" style={{ justifyContent: "center", gap: 6 }}>
            {leads.map((_, i) => (
              <span key={i} style={{
                width: i === active ? 22 : 6, height: 6, borderRadius: 999,
                background: i === active ? "#00e6d3" : "rgba(255,255,255,0.18)",
                transition: "all 200ms ease",
              }} />
            ))}
          </div>
        )}

        <div className="m-card">
          <div className="m-card-eyebrow">Tip</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
            Swipe <span style={{ color: "#00e6d3" }}>left</span> to dial with ATOM. Swipe <span style={{ color: "#ff6b8b" }}>right</span> to snooze. Tap a card for details.
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
