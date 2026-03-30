import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BRIDGE_URL = "https://45-79-202-76.sslip.io";

// ─── Types ────────────────────────────────────────────────────────────────────
type LeadStatus = "queued" | "research" | "live" | "done";
type CallStage = "idle" | "research" | "evaluation" | "warm_transfer";
type SidebarItem = "campaign" | "target" | "live" | "handoff" | "outcomes";

interface Lead {
  id: number;
  name: string;
  contact: string;
  title: string;
  phone: string;
  region: string;
  metrics: string;
  spend: string;
  stack: string;
  notes: string;
  status: LeadStatus;
}

interface TranscriptMessage {
  speaker: "ATOM" | "Prospect";
  text: string;
  ts: number;
}

interface CallState {
  isActive: boolean;
  isComplete: boolean;
  callSid: string | null;
  transcript: TranscriptMessage[];
  sentiment: number;
  buyerIntent: number;
  stage: CallStage;
  keySignals: string[];
  activeLeadId: number | null;
}

interface HandoffPacket {
  buyer: string;
  currentStack: string;
  keyPain: string;
  offerResonance: string;
  closeAction: string;
}

interface CampaignHealth {
  queuedLeads: number;
  qualifiedToday: number;
  meetingsBooked: number;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const INITIAL_LEADS: Lead[] = [
  {
    id: 1,
    name: "NovaCart",
    contact: "Jane Doe",
    title: "VP Engineering",
    phone: "+15551234567",
    region: "US",
    metrics: "3.2 TB/mo",
    spend: "$12k/mo",
    stack: "Cloudflare CDN + WAF",
    notes: "Likely renewal inside 9 months.",
    status: "queued",
  },
  {
    id: 2,
    name: "Streamly Media",
    contact: "Ravi Patel",
    title: "Director of Platform",
    phone: "+15559876543",
    region: "EU",
    metrics: "8.4 TB/mo",
    spend: "$26k/mo",
    stack: "Multi-CDN",
    notes: "Performance-sensitive workloads and global reach.",
    status: "research",
  },
  {
    id: 3,
    name: "FinEdge Bank",
    contact: "Sarah Müller",
    title: "CTO",
    phone: "+15554567890",
    region: "US",
    metrics: "5.1 TB/mo",
    spend: "$21k/mo",
    stack: "Akamai + internal",
    notes: "Security-first, compliance heavy.",
    status: "queued",
  },
  {
    id: 4,
    name: "Omnishop",
    contact: "Luis Hernandez",
    title: "Head of Infrastructure",
    phone: "+15557654321",
    region: "US",
    metrics: "2.7 TB/mo",
    spend: "$9k/mo",
    stack: "CloudFront",
    notes: "Cost optimization focus.",
    status: "queued",
  },
];

const SIM_TRANSCRIPT: TranscriptMessage[] = [
  {
    speaker: "ATOM",
    text: "Hi Jane, this is ATOM calling on behalf of Akamai. I wanted to quickly connect regarding NovaCart's current CDN arrangement with Cloudflare — do you have two minutes?",
    ts: 0,
  },
  {
    speaker: "Prospect",
    text: "Sure, I have a couple minutes. What's this about exactly?",
    ts: 2500,
  },
  {
    speaker: "ATOM",
    text: "Akamai can often match or beat current Cloudflare pricing, and in some cases buy out up to six months of remaining contract term, subject to approval. Given your renewal window in the next nine months, the timing seemed right.",
    ts: 5000,
  },
  {
    speaker: "Prospect",
    text: "Interesting. We're actually reviewing our CDN spend. Our Cloudflare costs have climbed this year.",
    ts: 8000,
  },
  {
    speaker: "ATOM",
    text: "That is helpful. Akamai can often match or beat current Cloudflare pricing, and in some cases buy out up to six months of remaining contract term, subject to approval.",
    ts: 10500,
  },
  {
    speaker: "Prospect",
    text: "If you can make the migration safe and the economics work, I would look at it before renewal.",
    ts: 13000,
  },
  {
    speaker: "ATOM",
    text: "Great. I am going to bring an Akamai specialist into the conversation so they can review pricing and next steps.",
    ts: 15000,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSentimentLabel(score: number): string {
  if (score >= 70) return "Purchase ready";
  if (score >= 50) return "Positive";
  if (score >= 30) return "Neutral";
  return "Resistant";
}

function getBuyerIntentLabel(score: number): string {
  if (score >= 70) return "Purchase ready";
  if (score >= 50) return "Evaluating";
  if (score >= 30) return "Curious";
  return "Cold";
}

function getGaugeColor(score: number): string {
  if (score >= 60) return "#14b8a6";
  if (score >= 30) return "#f59e0b";
  return "#ef4444";
}

function getStageInfo(stage: CallStage) {
  switch (stage) {
    case "research":
      return {
        label: "Research → evaluation",
        desc: "The prospect is validating migration risk, current Cloudflare spend, and whether the Akamai buyout offer is real.",
      };
    case "evaluation":
      return {
        label: "Evaluation → warm transfer",
        desc: "Prospect is validating offer economics and migration safety before agreeing to speak with a specialist.",
      };
    case "warm_transfer":
      return {
        label: "Warm transfer",
        desc: "ATOM is steering the call with offer framing and qualification prompts.",
      };
    default:
      return { label: "Idle", desc: "No active call." };
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: LeadStatus | "idle" | "live" | "complete" | "ready" | "waiting" | "healthy" }) {
  const colorMap: Record<string, string> = {
    queued: "#22c55e",
    research: "#f59e0b",
    live: "#3b82f6",
    done: "#6b7280",
    idle: "#6b7280",
    complete: "#3b82f6",
    ready: "#22c55e",
    waiting: "#f59e0b",
    healthy: "#22c55e",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        backgroundColor: colorMap[status] ?? "#6b7280",
        flexShrink: 0,
      }}
    />
  );
}

function GaugeBar({
  value,
  label,
  subLabel,
}: {
  value: number;
  label: string;
  subLabel: string;
}) {
  const color = getGaugeColor(value);
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#9ca3af",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1.1,
          marginBottom: 2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
        {subLabel}
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: "#2d2d2d",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            backgroundColor: color,
            borderRadius: 2,
            transition: "width 0.6s ease, background-color 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function FilterTag({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        border: "1px solid #374151",
        fontSize: 11,
        color: "#d1d5db",
        backgroundColor: "#1f2937",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function LeadCard({
  lead,
  onDial,
  isDialing,
}: {
  lead: Lead;
  onDial: (lead: Lead) => void;
  isDialing: boolean;
}) {
  const statusLabel: Record<LeadStatus, string> = {
    queued: "Queued",
    research: "Research",
    live: "Live",
    done: "Done",
  };

  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>
            {lead.name}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>
            {lead.contact} · {lead.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#9ca3af",
          }}
        >
          <StatusDot status={lead.status} />
          {statusLabel[lead.status]}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
        {lead.metrics} · {lead.region} · est. {lead.spend}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        {lead.stack} detected. {lead.notes}
      </div>
      <button
        onClick={() => onDial(lead)}
        disabled={isDialing}
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: "5px 14px",
          borderRadius: 6,
          border: "1px solid #14b8a6",
          backgroundColor: "transparent",
          color: "#14b8a6",
          cursor: isDialing ? "not-allowed" : "pointer",
          opacity: isDialing ? 0.5 : 1,
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) =>
          !isDialing &&
          ((e.currentTarget.style.backgroundColor = "#14b8a61a"))
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        {isDialing ? "Dialing…" : "Dial Twilio"}
      </button>
    </div>
  );
}

function TranscriptLine({ msg }: { msg: TranscriptMessage }) {
  const isAtom = msg.speaker === "ATOM";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        backgroundColor: isAtom ? "#1f2937" : "#111827",
        border: `1px solid ${isAtom ? "#374151" : "#1f2937"}`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: isAtom ? "#14b8a6" : "#9ca3af",
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {msg.speaker}
      </div>
      <div style={{ fontSize: 13, color: "#e5e7eb", lineHeight: 1.55 }}>
        {msg.text}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AtomLeadGen() {
  const [activeSidebarItem, setActiveSidebarItem] =
    useState<SidebarItem>("campaign");
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isComplete: false,
    callSid: null,
    transcript: [],
    sentiment: 65,
    buyerIntent: 73,
    stage: "research",
    keySignals: [],
    activeLeadId: null,
  });
  const [handoffPacket, setHandoffPacket] = useState<HandoffPacket | null>(
    null
  );
  const [campaignHealth] = useState<CampaignHealth>({
    queuedLeads: 4,
    qualifiedToday: 2,
    meetingsBooked: 2,
  });
  const [isDialing, setIsDialing] = useState(false);
  const [campaignRequest, setCampaignRequest] = useState(
    "ATOM find customers using Cloudflare for CDN and then call them offering them Akamai CDN in which Akamai will match and beat Cloudflare's price and Akamai will also buy out up to 6 months remaining of the customer's Cloudflare CDN contract."
  );
  const [targetRegion, setTargetRegion] = useState("US + EU");
  const [dailyDialLimit, setDailyDialLimit] = useState("30");
  const [simRunning, setSimRunning] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [callState.transcript]);

  // WebSocket connection for real calls
  const connectWs = useCallback((callSid: string) => {
    const wsUrl = `wss://${BRIDGE_URL.replace(/^https?:\/\//, "")}/events/${callSid}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
          setCallState((prev) => ({
            ...prev,
            transcript: [
              ...prev.transcript,
              { speaker: data.speaker, text: data.text, ts: Date.now() },
            ],
          }));
        } else if (data.type === "metrics") {
          setCallState((prev) => ({
            ...prev,
            sentiment: data.sentiment ?? prev.sentiment,
            buyerIntent: data.buyerIntent ?? prev.buyerIntent,
            stage: data.stage ?? prev.stage,
            keySignals: data.keySignals ?? prev.keySignals,
          }));
        } else if (data.type === "call_ended") {
          setCallState((prev) => ({
            ...prev,
            isActive: false,
            isComplete: true,
          }));
          setHandoffPacket({
            buyer: "VP Engineering at NovaCart",
            currentStack: "Cloudflare CDN",
            keyPain: "Rising spend and moderate support satisfaction",
            offerResonance: "Price match plus 6-month buyout de-risked the switch",
            closeAction:
              "Bring enterprise rep in now to confirm migration plan and pricing approval path.",
          });
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      wsRef.current = null;
    };
  }, []);

  // Dial a lead via bridge
  const handleDial = useCallback(
    async (lead: Lead) => {
      setIsDialing(true);
      try {
        const res = await fetch(`${BRIDGE_URL}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.phone,
            contactName: lead.contact,
            companyName: lead.name,
            productSlug: "akamai-cdn",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const sid = data.callSid ?? `sim-${Date.now()}`;
          setCallState((prev) => ({
            ...prev,
            isActive: true,
            isComplete: false,
            callSid: sid,
            transcript: [],
            sentiment: 45,
            buyerIntent: 30,
            stage: "research",
            keySignals: [],
            activeLeadId: lead.id,
          }));
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id ? { ...l, status: "live" } : l
            )
          );
          setActiveSidebarItem("live");
          connectWs(sid);
        }
      } catch (_) {
        // Bridge unreachable — silently ignore for demo
      } finally {
        setIsDialing(false);
      }
    },
    [connectWs]
  );

  // Simulate a live call
  const handleSimulate = useCallback(() => {
    if (simRunning) return;
    setSimRunning(true);

    // Clear previous timers
    simTimersRef.current.forEach(clearTimeout);
    simTimersRef.current = [];

    setCallState({
      isActive: true,
      isComplete: false,
      callSid: `sim-${Date.now()}`,
      transcript: [],
      sentiment: 45,
      buyerIntent: 30,
      stage: "research",
      keySignals: [],
      activeLeadId: 1,
    });
    setHandoffPacket(null);
    setActiveSidebarItem("live");

    // Add transcript lines with staggered delays
    SIM_TRANSCRIPT.forEach((msg, i) => {
      const t = setTimeout(
        () => {
          setCallState((prev) => ({
            ...prev,
            transcript: [...prev.transcript, { ...msg, ts: Date.now() }],
          }));
        },
        1500 + msg.ts
      );
      simTimersRef.current.push(t);
    });

    // Animate sentiment: 45 → 76
    const sentimentSteps = [45, 52, 58, 63, 68, 72, 76];
    sentimentSteps.forEach((val, i) => {
      const t = setTimeout(
        () => setCallState((prev) => ({ ...prev, sentiment: val })),
        2000 + i * 1800
      );
      simTimersRef.current.push(t);
    });

    // Animate buyer intent: 30 → 86
    const intentSteps = [30, 42, 54, 64, 72, 80, 86];
    intentSteps.forEach((val, i) => {
      const t = setTimeout(
        () => setCallState((prev) => ({ ...prev, buyerIntent: val })),
        2000 + i * 1800
      );
      simTimersRef.current.push(t);
    });

    // Stage transitions
    const t1 = setTimeout(
      () =>
        setCallState((prev) => ({ ...prev, stage: "evaluation" })),
      5500
    );
    const t2 = setTimeout(
      () =>
        setCallState((prev) => ({ ...prev, stage: "warm_transfer" })),
      11000
    );
    simTimersRef.current.push(t1, t2);

    // Complete call after 17s
    const tEnd = setTimeout(() => {
      setCallState((prev) => ({
        ...prev,
        isActive: false,
        isComplete: true,
        sentiment: 76,
        buyerIntent: 86,
        stage: "warm_transfer",
      }));
      setHandoffPacket({
        buyer: "VP Engineering at NovaCart",
        currentStack: "Cloudflare CDN",
        keyPain: "Rising spend and moderate support satisfaction",
        offerResonance:
          "Price match plus 6-month buyout de-risked the switch",
        closeAction:
          "Bring enterprise rep in now to confirm migration plan and pricing approval path.",
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === 1 ? { ...l, status: "done" } : l))
      );
      setSimRunning(false);
    }, 17000);
    simTimersRef.current.push(tEnd);
  }, [simRunning]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      simTimersRef.current.forEach(clearTimeout);
      wsRef.current?.close();
    };
  }, []);

  // ── Sidebar nav config
  const sidebarItems: {
    key: SidebarItem;
    label: string;
    tag: string;
  }[] = [
    { key: "campaign", label: "Campaign studio", tag: "Plan" },
    { key: "target", label: "Target queue", tag: "Prospects" },
    { key: "live", label: "Live call board", tag: "Realtime" },
    { key: "handoff", label: "Rep handoff", tag: "Close" },
    { key: "outcomes", label: "Outcomes", tag: "History" },
  ];

  const callStatusLabel = callState.isComplete
    ? "Call complete"
    : callState.isActive
    ? "Live"
    : "Idle";

  const callStatusColor = callState.isComplete
    ? "#3b82f6"
    : callState.isActive
    ? "#ef4444"
    : "#6b7280";

  const stageInfo = getStageInfo(callState.stage);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: "calc(100vh - 0px)",
        backgroundColor: "#0f0f0f",
        color: "#fff",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      {/* ── Inner Sidebar ─────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 220,
          minWidth: 220,
          backgroundColor: "#111",
          borderRight: "1px solid #1f2937",
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: "0 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#14b8a620",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Atom SVG */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#14b8a6"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="1" fill="#14b8a6" />
                <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9C11.18 3.77 5.85 1.7 3.8 3.8c-2.04 2.04-.02 7.37 4.5 11.91C12.83 20.24 18.16 22.27 20.2 20.2z" />
                <path d="M15.7 15.7c4.52-4.54 6.56-9.87 4.5-11.91-2.04-2.04-7.37-.02-11.91 4.5-4.52 4.54-6.56 9.87-4.5 11.91 2.04 2.04 7.37.02 11.91-4.5z" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.04em",
                }}
              >
                ATOM ENGINE
              </div>
              <div
                style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}
              >
                Voice campaign sandbox
              </div>
            </div>
          </div>
        </div>

        {/* Workspace label */}
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#4b5563",
            padding: "0 16px 8px",
            fontWeight: 600,
          }}
        >
          Workspace
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1 }}>
          {sidebarItems.map((item) => {
            const isActive = activeSidebarItem === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSidebarItem(item.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 16px",
                  backgroundColor: isActive ? "#14b8a615" : "transparent",
                  border: "none",
                  borderLeft: isActive
                    ? "2px solid #14b8a6"
                    : "2px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    e.currentTarget.style.backgroundColor = "#1f2937";
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isActive ? "#14b8a6" : "#d1d5db",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#4b5563",
                    fontWeight: 500,
                  }}
                >
                  {item.tag}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Campaign Health */}
        <div
          style={{
            margin: "16px 12px 0",
            borderTop: "1px solid #1f2937",
            paddingTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "#4b5563",
              marginBottom: 12,
              fontWeight: 600,
              paddingLeft: 4,
            }}
          >
            Campaign Health
          </div>

          {/* Queued Leads */}
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 4,
              }}
            >
              Queued Leads
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
                marginBottom: 3,
              }}
            >
              {campaignHealth.queuedLeads}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>
              Cloudflare CDN detected
            </div>
          </div>

          {/* Qualified Today */}
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 4,
              }}
            >
              Qualified Today
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
                marginBottom: 3,
              }}
            >
              {campaignHealth.qualifiedToday}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>
              Intent above threshold
            </div>
          </div>

          {/* Meetings Booked */}
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #1f2937",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#6b7280",
                marginBottom: 4,
              }}
            >
              Meetings Booked
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
                marginBottom: 3,
              }}
            >
              {campaignHealth.meetingsBooked}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>
              Warm transfer or callback
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid #1f2937",
            backgroundColor: "#0f0f0f",
            flexShrink: 0,
          }}
        >
          {/* Title */}
          <div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              ATOM{" "}
              <span style={{ color: "#14b8a6" }}>lead gen</span> engine
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              Design a campaign, simulate sourcing ZoomInfo-style targets,
              monitor buyer intent, and prep a human rep handoff in one
              static app.
            </p>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            {/* Demo mode badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #166534",
                backgroundColor: "#14532d22",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: "#86efac", fontWeight: 500 }}>
                Demo mode active
              </span>
            </div>

            {/* Theme toggle icon */}
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #374151",
                backgroundColor: "#1f2937",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </button>

            {/* Load sample */}
            <button
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "1px solid #374151",
                backgroundColor: "#1f2937",
                color: "#d1d5db",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Load sample
            </button>

            {/* Run test cycle */}
            <button
              onClick={handleSimulate}
              disabled={simRunning}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                backgroundColor: simRunning ? "#0f766e" : "#14b8a6",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: simRunning ? "not-allowed" : "pointer",
                transition: "background-color 0.15s",
              }}
            >
              {simRunning ? "Running…" : "Run test cycle"}
            </button>
          </div>
        </div>

        {/* Content grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {/* ── Left Panel (~45%) ──────────────────────────────────────────── */}
          <div style={{ flex: "0 0 44%", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Campaign Studio Card */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #1f2937",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px 0",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    Campaign studio
                  </h2>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Paste the campaign ask exactly how your team thinks about
                    it. The app compiles it into offer logic, qualification
                    rules, and rep handoff triggers.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: "#22c55e",
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  <StatusDot status="ready" />
                  Ready to compile
                </div>
              </div>

              <div style={{ padding: "16px 20px 20px" }}>
                {/* Campaign Request */}
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#6b7280",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Campaign Request
                  </div>
                  <textarea
                    value={campaignRequest}
                    onChange={(e) => setCampaignRequest(e.target.value)}
                    rows={6}
                    style={{
                      width: "100%",
                      backgroundColor: "#111",
                      border: "1px solid #374151",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 13,
                      color: "#e5e7eb",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      lineHeight: 1.6,
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>
                    This static app compiles the request locally for testing.
                    Later you can replace this with a backend parser or OpenAI
                    function call.
                  </div>
                </div>

                {/* Region + Dial limit */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#6b7280",
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Target Region
                    </div>
                    <select
                      value={targetRegion}
                      onChange={(e) => setTargetRegion(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: "#111",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        padding: "9px 12px",
                        fontSize: 13,
                        color: "#e5e7eb",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="US">US</option>
                      <option value="EU">EU</option>
                      <option value="US + EU">US + EU</option>
                      <option value="Global">Global</option>
                    </select>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#6b7280",
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Daily Dial Limit
                    </div>
                    <input
                      type="number"
                      value={dailyDialLimit}
                      onChange={(e) => setDailyDialLimit(e.target.value)}
                      style={{
                        width: "100%",
                        backgroundColor: "#111",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        padding: "9px 12px",
                        fontSize: 13,
                        color: "#e5e7eb",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Filter Tags */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  <FilterTag label="Tech filter · Cloudflare CDN" />
                  <FilterTag label="Offer · match or beat" />
                  <FilterTag label="Buyout cap · 6 months" />
                  <FilterTag label="Handoff · buyer intent 70+" />
                </div>

                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 14 }}>
                  Use this as a Vercel-ready front end while your backend APIs
                  are still being wired.
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "1px solid #374151",
                      backgroundColor: "transparent",
                      color: "#d1d5db",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Compile plan
                  </button>
                  <button
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      backgroundColor: "#14b8a6",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Launch queue
                  </button>
                </div>
              </div>
            </div>

            {/* Target Queue Card */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #1f2937",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px 0",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    Target queue
                  </h2>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    These are simulated outbound targets that match the
                    campaign. In production this panel would be fed by ZoomInfo,
                    Apollo, Clay, or your own enrichment pipeline.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    color: "#22c55e",
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  <StatusDot status="healthy" />
                  Queue healthy
                </div>
              </div>

              <div style={{ padding: "16px 20px 20px" }}>
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDial={handleDial}
                    isDialing={isDialing}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel (~55%) ─────────────────────────────────────────── */}
          <div style={{ flex: "0 0 54%", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Live Call Board Card */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #1f2937",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px 0",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    Live call board
                  </h2>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Preview the kind of speech-to-speech scoring and call
                    progression your actual voice stack would emit in real time.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                  className={callState.isActive ? "pulse-dot" : ""}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: callStatusColor,
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: callStatusColor === "#6b7280" ? "#9ca3af" : callStatusColor }}>
                    {callStatusLabel}
                  </span>
                </div>
              </div>

              <div style={{ padding: "16px 20px 20px" }}>
                {/* Gauges */}
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    backgroundColor: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: "16px 20px",
                    marginBottom: 14,
                  }}
                >
                  <GaugeBar
                    value={callState.sentiment}
                    label="Sentiment"
                    subLabel={getSentimentLabel(callState.sentiment)}
                  />
                  <div
                    style={{
                      width: 1,
                      backgroundColor: "#1f2937",
                      flexShrink: 0,
                    }}
                  />
                  <GaugeBar
                    value={callState.buyerIntent}
                    label="Buyer Intent"
                    subLabel={getBuyerIntentLabel(callState.buyerIntent)}
                  />
                </div>

                {/* Call Stage */}
                {callState.stage !== "idle" && (
                  <div
                    style={{
                      backgroundColor: "#111",
                      border: "1px solid #374151",
                      borderRadius: 10,
                      padding: "14px 16px",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#fff",
                        marginBottom: 5,
                      }}
                    >
                      {stageInfo.label}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
                      {stageInfo.desc}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div
                  style={{
                    backgroundColor: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 14,
                    maxHeight: 340,
                    overflowY: "auto",
                  }}
                  ref={transcriptRef}
                >
                  {callState.transcript.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        textAlign: "center",
                        padding: "24px 0",
                      }}
                    >
                      {callState.isComplete
                        ? "Call ended."
                        : "Click simulate live call to step through a qualification conversation."}
                    </div>
                  ) : (
                    callState.transcript.map((msg, i) => (
                      <TranscriptLine key={i} msg={msg} />
                    ))
                  )}
                </div>

                {/* CTA row */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={handleSimulate}
                    disabled={simRunning}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      backgroundColor: simRunning ? "#0f766e" : "#14b8a6",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: simRunning ? "not-allowed" : "pointer",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {simRunning ? "Simulating…" : "Simulate live call"}
                  </button>
                  <div style={{ fontSize: 11, color: "#4b5563" }}>
                    {callState.isComplete
                      ? "Simulation complete — handoff packet ready below."
                      : "Click simulate to step through a qualification and rep handoff."}
                  </div>
                </div>

                {/* System note */}
                {!callState.isActive && !callState.isComplete && (
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>
                      System
                    </span>{" "}
                    · Click simulate live call to step through qualification and
                    rep handoff.
                  </div>
                )}
              </div>
            </div>

            {/* Rep Handoff Packet Card */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #1f2937",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "16px 20px 0",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                    }}
                  >
                    Rep handoff packet
                  </h2>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    Everything a closer needs when ATOM finds a real opportunity
                    and passes it to a human.
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11,
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: handoffPacket ? "#f59e0b" : "#6b7280",
                      display: "inline-block",
                    }}
                  />
                  <span style={{ color: handoffPacket ? "#f59e0b" : "#6b7280" }}>
                    {handoffPacket ? "Rep brief ready" : "Waiting for qualified lead"}
                  </span>
                </div>
              </div>

              <div style={{ padding: "16px 20px 20px" }}>
                {/* Qualified Handoff Summary */}
                {handoffPacket ? (
                  <div
                    style={{
                      backgroundColor: "#111",
                      border: "1px solid #1f2937",
                      borderRadius: 10,
                      padding: "16px",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        Qualified handoff summary
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11,
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            backgroundColor: "#f59e0b",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ color: "#f59e0b" }}>Hot lead</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { key: "Buyer", val: handoffPacket.buyer },
                        { key: "Current stack", val: handoffPacket.currentStack },
                        { key: "Key pain", val: handoffPacket.keyPain },
                        { key: "Offer resonance", val: handoffPacket.offerResonance },
                        { key: "Close action", val: handoffPacket.closeAction },
                      ].map(({ key, val }) => (
                        <div key={key} style={{ fontSize: 13, lineHeight: 1.5 }}>
                          <span
                            style={{ color: "#9ca3af", fontWeight: 600 }}
                          >
                            {key}:{" "}
                          </span>
                          <span style={{ color: "#e5e7eb" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: "#111",
                      border: "1px solid #1f2937",
                      borderRadius: 10,
                      padding: "28px 16px",
                      marginBottom: 14,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#4b5563" }}>
                      Run a simulation or complete a call to populate the
                      handoff packet.
                    </div>
                  </div>
                )}

                {/* Compiled campaign plan */}
                <div
                  style={{
                    backgroundColor: "#111",
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      borderBottom: "1px solid #1f2937",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#fff",
                      }}
                    >
                      Compiled campaign plan
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          backgroundColor: "#22c55e",
                          display: "inline-block",
                        }}
                      />
                      <span style={{ color: "#22c55e" }}>Ready</span>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        fontSize: 13,
                      }}
                    >
                      {[
                        {
                          key: "Target signal",
                          val: "Cloudflare CDN customers with renewal inside 12 months",
                        },
                        {
                          key: "Offer hook",
                          val: "Price match + buyout up to 6 months remaining contract",
                        },
                        {
                          key: "Qualification gate",
                          val: "Buyer intent ≥ 70 before warm transfer",
                        },
                        {
                          key: "Region scope",
                          val: targetRegion,
                        },
                        {
                          key: "Daily dial cap",
                          val: `${dailyDialLimit} dials/day`,
                        },
                      ].map(({ key, val }) => (
                        <div key={key} style={{ lineHeight: 1.5 }}>
                          <span style={{ color: "#9ca3af", fontWeight: 600 }}>
                            {key}:{" "}
                          </span>
                          <span style={{ color: "#e5e7eb" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
