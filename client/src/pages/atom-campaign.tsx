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

interface CompiledPlan {
  targetSignal: string;
  offerHook: string;
  qualificationGate: string;
  regionScope: string;
  dailyDialCap: string;
}

interface ToastMsg {
  id: number;
  message: string;
  type: "error" | "info" | "success";
}

// ─── Sample Data ──────────────────────────────────────────────────────────────
const INITIAL_LEADS: Lead[] = [
  {
    id: 1,
    name: "NovaCart",
    contact: "Jane Doe",
    title: "VP Engineering",
    phone: "",
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
    phone: "",
    region: "EU",
    metrics: "8.4 TB/mo",
    spend: "$26k/mo",
    stack: "Multi-CDN",
    notes: "Performance-sensitive workloads and global reach.",
    status: "queued",
  },
  {
    id: 3,
    name: "FinEdge Bank",
    contact: "Sarah Müller",
    title: "CTO",
    phone: "",
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
    phone: "",
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

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s/g, "");
  return cleaned.length >= 7 && /^\+?[\d\-().]+$/.test(cleaned);
}

function parseCampaignBrief(brief: string, region: string, dailyLimit: string): CompiledPlan {
  // Extract key signals from the brief text
  const techMatch = brief.match(/(?:using|for)\s+([\w\s]+?CDN[\w\s]*?)(?:\s+and|\s+for|\.|,|$)/i);
  const offerMatch = brief.match(/offering[^.]*?(?:match[^.]*?(?:beat|price)[^.]*?|buy out[^.]*?)/i);
  const buyoutMatch = brief.match(/(\d+)\s*months?\s*(?:remaining|of)/i);

  const targetSignal = techMatch
    ? `${techMatch[1].trim()} customers with renewal inside 12 months`
    : "Prospects matching campaign technology criteria";

  const offerHook = buyoutMatch
    ? `Price match + buyout up to ${buyoutMatch[1]} months remaining contract`
    : offerMatch
    ? offerMatch[0].trim()
    : "Competitive offer — see campaign brief for details";

  return {
    targetSignal,
    offerHook,
    qualificationGate: "Buyer intent ≥ 70 before warm transfer",
    regionScope: region,
    dailyDialCap: `${dailyLimit} dials/day`,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: LeadStatus | "idle" | "live" | "complete" | "ready" | "waiting" | "healthy" | "active" }) {
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
    active: "#22c55e",
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
  onDelete,
  onPhoneChange,
  isDialing,
}: {
  lead: Lead;
  onDial: (lead: Lead) => void;
  onDelete: (id: number) => void;
  onPhoneChange: (id: number, phone: string) => void;
  isDialing: boolean;
}) {
  const statusLabel: Record<LeadStatus, string> = {
    queued: "Queued",
    research: "Research",
    live: "Live",
    done: "Done",
  };

  const phoneValid = isValidPhone(lead.phone);

  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 10,
        position: "relative",
      }}
    >
      {/* Delete button */}
      <button
        onClick={() => onDelete(lead.id)}
        title="Remove lead"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "1px solid #374151",
          backgroundColor: "transparent",
          color: "#6b7280",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#ef444420";
          e.currentTarget.style.color = "#ef4444";
          e.currentTarget.style.borderColor = "#ef4444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "#6b7280";
          e.currentTarget.style.borderColor = "#374151";
        }}
      >
        ×
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 4,
          paddingRight: 28,
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
            flexShrink: 0,
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

      {/* Phone number input */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="tel"
          value={lead.phone}
          onChange={(e) => onPhoneChange(lead.id, e.target.value)}
          placeholder="+1..."
          style={{
            width: "100%",
            backgroundColor: "#0f0f0f",
            border: `1px solid ${lead.phone && !phoneValid ? "#ef4444" : "#374151"}`,
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            color: "#e5e7eb",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {lead.phone && !phoneValid && (
          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>
            Enter a valid phone number
          </div>
        )}
      </div>

      <button
        onClick={() => onDial(lead)}
        disabled={isDialing || !phoneValid}
        title={!phoneValid ? "Enter phone number to dial" : ""}
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: "5px 14px",
          borderRadius: 6,
          border: "1px solid #14b8a6",
          backgroundColor: "transparent",
          color: !phoneValid ? "#4b5563" : "#14b8a6",
          borderColor: !phoneValid ? "#374151" : "#14b8a6",
          cursor: isDialing || !phoneValid ? "not-allowed" : "pointer",
          opacity: isDialing ? 0.5 : 1,
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!isDialing && phoneValid)
            (e.currentTarget.style.backgroundColor = "#14b8a61a");
        }}
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        {!phoneValid ? "Enter phone number" : isDialing ? "Dialing…" : "Dial Twilio"}
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

function Toast({ toasts, onRemove }: { toasts: ToastMsg[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1000,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: t.type === "error" ? "#1f0a0a" : t.type === "success" ? "#0a1f0a" : "#0a0f1f",
            border: `1px solid ${t.type === "error" ? "#ef444440" : t.type === "success" ? "#22c55e40" : "#3b82f640"}`,
            color: t.type === "error" ? "#fca5a5" : t.type === "success" ? "#86efac" : "#93c5fd",
            fontSize: 13,
            maxWidth: 340,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: 16,
              opacity: 0.6,
              padding: 0,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
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
    sentiment: 45,
    buyerIntent: 30,
    stage: "idle",
    keySignals: [],
    activeLeadId: null,
  });
  const [handoffPacket, setHandoffPacket] = useState<HandoffPacket | null>(null);
  const [isDialing, setIsDialing] = useState(false);
  const [campaignActive, setCampaignActive] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState<{ current: number; total: number } | null>(null);
  const [campaignRequest, setCampaignRequest] = useState(
    "ATOM find customers using Cloudflare for CDN and then call them offering them Akamai CDN in which Akamai will match and beat Cloudflare's price and Akamai will also buy out up to 6 months remaining of the customer's Cloudflare CDN contract."
  );
  const [targetRegion, setTargetRegion] = useState("US + EU");
  const [dailyDialLimit, setDailyDialLimit] = useState("30");
  const [simRunning, setSimRunning] = useState(false);
  const [compiledPlan, setCompiledPlan] = useState<CompiledPlan>({
    targetSignal: "Cloudflare CDN customers with renewal inside 12 months",
    offerHook: "Price match + buyout up to 6 months remaining contract",
    qualificationGate: "Buyer intent ≥ 70 before warm transfer",
    regionScope: "US + EU",
    dailyDialCap: "30 dials/day",
  });
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [meetingsBooked, setMeetingsBooked] = useState(0);

  // Add Lead form state
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    contact: "",
    title: "",
    phone: "",
    region: "US",
    notes: "",
  });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextLeadIdRef = useRef(5);
  const toastIdRef = useRef(0);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [callState.transcript]);

  // Dynamic campaign health stats
  const queuedLeads = leads.filter((l) => l.status === "queued").length;

  const addToast = useCallback((message: string, type: ToastMsg["type"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // WebSocket connection for real calls
  const connectWs = useCallback((callSid: string, lead: Lead) => {
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
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id ? { ...l, status: "done" } : l
            )
          );
          setHandoffPacket({
            buyer: `${lead.title} at ${lead.name}`,
            currentStack: lead.stack,
            keyPain: lead.notes,
            offerResonance: "Price match plus 6-month buyout de-risked the switch",
            closeAction:
              "Bring enterprise rep in now to confirm migration plan and pricing approval path.",
          });
          if (data.stage === "warm_transfer") {
            setQualifiedCount((c) => c + 1);
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = () => {
      addToast("WebSocket connection lost.", "error");
    };
  }, [addToast]);

  // Dial a lead via bridge
  const handleDial = useCallback(
    async (lead: Lead) => {
      if (!isValidPhone(lead.phone)) {
        addToast("Enter a valid phone number before dialing.", "error");
        return;
      }
      setIsDialing(true);
      try {
        const res = await fetch(`${BRIDGE_URL}/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.phone,
            contactName: lead.contact,
            companyName: lead.name,
            productSlug: "antimatter-ai",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const sid = data.callSid ?? `live-${Date.now()}`;
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
          connectWs(sid, lead);
        } else {
          const text = await res.text().catch(() => "");
          addToast(`Dial failed: ${res.status}${text ? ` — ${text}` : ""}`, "error");
        }
      } catch (_) {
        addToast("Bridge is unreachable. Check your connection and try again.", "error");
      } finally {
        setIsDialing(false);
      }
    },
    [connectWs, addToast]
  );

  // Delete a lead
  const handleDeleteLead = useCallback((id: number) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Update phone number on a lead
  const handlePhoneChange = useCallback((id: number, phone: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, phone } : l))
    );
  }, []);

  // Add a new lead
  const handleAddLead = useCallback(() => {
    if (!newLead.name.trim() || !newLead.phone.trim()) {
      addToast("Company name and phone number are required.", "error");
      return;
    }
    if (!isValidPhone(newLead.phone)) {
      addToast("Enter a valid phone number (e.g. +15551234567).", "error");
      return;
    }
    const lead: Lead = {
      id: nextLeadIdRef.current++,
      name: newLead.name.trim(),
      contact: newLead.contact.trim() || "Unknown",
      title: newLead.title.trim() || "Contact",
      phone: newLead.phone.trim(),
      region: newLead.region,
      metrics: "",
      spend: "",
      stack: "",
      notes: newLead.notes.trim(),
      status: "queued",
    };
    setLeads((prev) => [...prev, lead]);
    setNewLead({ name: "", contact: "", title: "", phone: "", region: "US", notes: "" });
    setShowAddLead(false);
    addToast(`${lead.name} added to queue.`, "success");
  }, [newLead, addToast]);

  // Compile plan from brief
  const handleCompilePlan = useCallback(() => {
    const plan = parseCampaignBrief(campaignRequest, targetRegion, dailyDialLimit);
    setCompiledPlan(plan);
    addToast("Campaign plan compiled.", "success");
  }, [campaignRequest, targetRegion, dailyDialLimit, addToast]);

  // Launch queue (set campaign active)
  const handleLaunchQueue = useCallback(() => {
    setCampaignActive(true);
    addToast("Campaign activated. Use 'Launch Campaign' to start dialing.", "info");
  }, [addToast]);

  // Launch Campaign — dial all queued leads with valid phone numbers sequentially
  const handleLaunchCampaign = useCallback(async () => {
    const dialable = leads.filter(
      (l) => l.status === "queued" && isValidPhone(l.phone)
    );
    if (dialable.length === 0) {
      addToast(
        "No queued leads with valid phone numbers. Add phone numbers to your leads first.",
        "error"
      );
      return;
    }
    setCampaignActive(true);
    for (let i = 0; i < dialable.length; i++) {
      const lead = dialable[i];
      setCampaignProgress({ current: i + 1, total: dialable.length });
      await handleDial(lead);
      // Small pause between calls
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    setCampaignProgress(null);
    addToast(`Campaign complete. Dialed ${dialable.length} leads.`, "success");
  }, [leads, handleDial, addToast]);

  // Simulate a live call
  const handleSimulate = useCallback(() => {
    if (simRunning) return;
    setSimRunning(true);

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

    SIM_TRANSCRIPT.forEach((msg, _i) => {
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

    const sentimentSteps = [45, 52, 58, 63, 68, 72, 76];
    sentimentSteps.forEach((val, i) => {
      const t = setTimeout(
        () => setCallState((prev) => ({ ...prev, sentiment: val })),
        2000 + i * 1800
      );
      simTimersRef.current.push(t);
    });

    const intentSteps = [30, 42, 54, 64, 72, 80, 86];
    intentSteps.forEach((val, i) => {
      const t = setTimeout(
        () => setCallState((prev) => ({ ...prev, buyerIntent: val })),
        2000 + i * 1800
      );
      simTimersRef.current.push(t);
    });

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
      setQualifiedCount((c) => c + 1);
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#111",
    border: "1px solid #374151",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "#e5e7eb",
    outline: "none",
    boxSizing: "border-box",
  };

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
      {/* Toast notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />

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
                Voice campaign platform
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
              {queuedLeads}
            </div>
            <div style={{ fontSize: 10, color: "#6b7280" }}>
              Ready to dial
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
              {qualifiedCount}
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
              {meetingsBooked}
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
              Design a campaign, manage outbound targets, monitor buyer intent, and prep rep handoffs in real time.
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
            {/* Campaign status badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 6,
                border: `1px solid ${campaignActive ? "#166534" : "#374151"}`,
                backgroundColor: campaignActive ? "#14532d22" : "#1f293722",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: campaignActive ? "#22c55e" : "#6b7280",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: campaignActive ? "#86efac" : "#9ca3af", fontWeight: 500 }}>
                Campaign: {campaignActive ? "Active" : "Idle"}
              </span>
            </div>

            {/* Campaign progress indicator */}
            {campaignProgress && (
              <div
                style={{
                  fontSize: 12,
                  color: "#14b8a6",
                  fontWeight: 500,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid #14b8a640",
                  backgroundColor: "#14b8a610",
                }}
              >
                Calling {campaignProgress.current} of {campaignProgress.total}…
              </div>
            )}

            {/* Add Lead button */}
            <button
              onClick={() => {
                setActiveSidebarItem("target");
                setShowAddLead(true);
              }}
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
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#374151")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1f2937")}
            >
              + Add Lead
            </button>

            {/* Launch Campaign */}
            <button
              onClick={handleLaunchCampaign}
              disabled={isDialing || simRunning}
              style={{
                padding: "7px 16px",
                borderRadius: 8,
                border: "none",
                backgroundColor: isDialing || simRunning ? "#0f766e" : "#14b8a6",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: isDialing || simRunning ? "not-allowed" : "pointer",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!isDialing && !simRunning)
                  e.currentTarget.style.backgroundColor = "#0d9488";
              }}
              onMouseLeave={(e) => {
                if (!isDialing && !simRunning)
                  e.currentTarget.style.backgroundColor = "#14b8a6";
              }}
            >
              {isDialing ? "Dialing…" : "Launch Campaign"}
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
                    Define your campaign strategy. ATOM will use this context when calling prospects.
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
                {/* Campaign Brief */}
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
                    Campaign Brief
                  </div>
                  <textarea
                    value={campaignRequest}
                    onChange={(e) => setCampaignRequest(e.target.value)}
                    rows={6}
                    placeholder="Describe your campaign: target audience, offer, qualification criteria, and desired outcome…"
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

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleCompilePlan}
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1f2937")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Compile plan
                  </button>
                  <button
                    onClick={handleLaunchQueue}
                    style={{
                      padding: "8px 18px",
                      borderRadius: 8,
                      border: "none",
                      backgroundColor: campaignActive ? "#0f766e" : "#14b8a6",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!campaignActive) e.currentTarget.style.backgroundColor = "#0d9488";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = campaignActive ? "#0f766e" : "#14b8a6";
                    }}
                  >
                    {campaignActive ? "Queue active" : "Launch queue"}
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
                    Outbound targets for this campaign. Add leads manually or import from your enrichment pipeline.
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
                {leads.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "24px 0",
                      fontSize: 13,
                      color: "#4b5563",
                    }}
                  >
                    No leads in queue. Add a lead below to get started.
                  </div>
                )}
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDial={handleDial}
                    onDelete={handleDeleteLead}
                    onPhoneChange={handlePhoneChange}
                    isDialing={isDialing}
                  />
                ))}

                {/* Add Lead toggle */}
                <button
                  onClick={() => setShowAddLead((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    padding: "10px 0",
                    background: "none",
                    border: "none",
                    borderTop: "1px solid #1f2937",
                    color: "#9ca3af",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    marginTop: 4,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#14b8a6")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>
                    {showAddLead ? "−" : "+"}
                  </span>
                  Add Lead
                </button>

                {/* Add Lead form */}
                {showAddLead && (
                  <div
                    style={{
                      backgroundColor: "#111",
                      border: "1px solid #374151",
                      borderRadius: 10,
                      padding: "16px",
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#d1d5db",
                        marginBottom: 2,
                      }}
                    >
                      New Lead
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Company Name <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newLead.name}
                          onChange={(e) => setNewLead((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Acme Corp"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Contact Name
                        </label>
                        <input
                          type="text"
                          value={newLead.contact}
                          onChange={(e) => setNewLead((p) => ({ ...p, contact: e.target.value }))}
                          placeholder="Jane Smith"
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={newLead.title}
                          onChange={(e) => setNewLead((p) => ({ ...p, title: e.target.value }))}
                          placeholder="VP Engineering"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Phone <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="tel"
                          value={newLead.phone}
                          onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+1..."
                          style={{
                            ...inputStyle,
                            borderColor: newLead.phone && !isValidPhone(newLead.phone) ? "#ef4444" : "#374151",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Region
                        </label>
                        <select
                          value={newLead.region}
                          onChange={(e) => setNewLead((p) => ({ ...p, region: e.target.value }))}
                          style={{ ...inputStyle, cursor: "pointer" }}
                        >
                          <option value="US">US</option>
                          <option value="EU">EU</option>
                          <option value="APAC">APAC</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>
                          Notes
                        </label>
                        <textarea
                          value={newLead.notes}
                          onChange={(e) => setNewLead((p) => ({ ...p, notes: e.target.value }))}
                          placeholder="Any relevant context…"
                          rows={2}
                          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                      <button
                        onClick={handleAddLead}
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
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0d9488")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#14b8a6")}
                      >
                        Add to Queue
                      </button>
                      <button
                        onClick={() => setShowAddLead(false)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "1px solid #374151",
                          backgroundColor: "transparent",
                          color: "#9ca3af",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1f2937")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
                    Real-time speech scoring and call progression from your active voice stack.
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
                        : callState.isActive
                        ? "Call in progress — transcript will appear here."
                        : "Waiting for active call…"}
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
                      border: "1px solid #374151",
                      backgroundColor: simRunning ? "#1f2937" : "transparent",
                      color: simRunning ? "#9ca3af" : "#d1d5db",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: simRunning ? "not-allowed" : "pointer",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!simRunning) e.currentTarget.style.backgroundColor = "#1f2937";
                    }}
                    onMouseLeave={(e) => {
                      if (!simRunning) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {simRunning ? "Simulating…" : "Test Call (Simulation)"}
                  </button>
                  <div style={{ fontSize: 11, color: "#4b5563" }}>
                    {callState.isComplete
                      ? "Call complete — handoff packet ready below."
                      : callState.isActive
                      ? "Live call in progress."
                      : "Use 'Dial Twilio' on a lead card to initiate a real call."}
                  </div>
                </div>
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
                      Complete a call to populate the handoff packet.
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
                          val: compiledPlan.targetSignal,
                        },
                        {
                          key: "Offer hook",
                          val: compiledPlan.offerHook,
                        },
                        {
                          key: "Qualification gate",
                          val: compiledPlan.qualificationGate,
                        },
                        {
                          key: "Region scope",
                          val: compiledPlan.regionScope,
                        },
                        {
                          key: "Daily dial cap",
                          val: compiledPlan.dailyDialCap,
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
