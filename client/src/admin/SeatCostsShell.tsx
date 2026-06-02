/**
 * Nirmata HQ · Seat & Module Cost Analysis (v2)
 *
 * Super-admin only. Tenants never see this surface — it exposes our COGS
 * across every module + the competitive landscape + the recommended plan
 * structure.
 *
 * The numbers come from /shared/seat-cost-model.ts and the competitor
 * matrix at /atom_competitor_pricing.json (fetched on mount).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Coins, Crown, Calculator, TrendingUp, Activity, AlertCircle, FileText, Layers,
  Users, Mic, Mail, Brain, BookOpen, Star, Package, Sparkles, Building2, ExternalLink,
} from "lucide-react";
import { useSessionContext } from "../auth/AuthGate";
import {
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT,
} from "./charts";
import {
  SEAT_PROFILES, SPRINTS, MODULES, PLATFORM_OVERHEAD, PER_SEAT_FIXED, PROVIDER_PRICES,
  PLAN_TIERS, ADD_ONS, ANNUAL_DISCOUNT_PCT,
  computeSeatCost, SEAT_COST_MODEL_UPDATED,
  type SeatProfile, type ModuleGroup, type ModuleCostLine,
} from "@shared/seat-cost-model";

// ───────────────────────────────────────────────────────────────────
// Money formatters
// ───────────────────────────────────────────────────────────────────

const usd = (v: number) =>
  v >= 100 ? `$${v.toFixed(0)}` :
  v >= 10  ? `$${v.toFixed(2)}` :
  v >= 1   ? `$${v.toFixed(2)}` :
  v >= 0.01 ? `$${v.toFixed(3)}` :
  v > 0    ? `$${v.toFixed(4)}` : "$0";

const usdPrecise = (v: number) =>
  v >= 1 ? `$${v.toFixed(2)}` :
  v >= 0.01 ? `$${v.toFixed(3)}` :
  v > 0 ? `$${v.toFixed(4)}` : "$0";

// ───────────────────────────────────────────────────────────────────
// Module group labels
// ───────────────────────────────────────────────────────────────────

const GROUP_META: Record<ModuleGroup, { label: string; icon: any; color: string; description: string }> = {
  voice:        { label: "Voice",        icon: Mic,      color: ATOM_TEAL,    description: "Live AI calls — the dominant variable cost." },
  outreach:     { label: "Outreach",     icon: Mail,     color: ATOM_TEAL_2,  description: "Async multi-channel touches: email + SMS." },
  intelligence: { label: "Intelligence", icon: Brain,    color: ATOM_PURPLE,  description: "Research, signal discovery, deal-level reasoning." },
  content:      { label: "Content",      icon: Sparkles, color: ATOM_AMBER,   description: "LLM-generated text artifacts." },
  knowledge:    { label: "Knowledge",    icon: BookOpen, color: ATOM_GREEN,   description: "RAG-backed playbook & battle-card lookups." },
};

// Map module slug -> competitor JSON module key
const COMPETITOR_KEY_FOR_GROUP: Record<ModuleGroup, string[]> = {
  voice:        ["atom_dial", "atom_campaign_auto_dialer"],
  outreach:     ["atom_multi_channel_outreach"],
  intelligence: ["atom_prospect_engine", "atom_market_intent", "atom_war_room"],
  content:      ["atom_pitch", "atom_objection_handler"],
  knowledge:    ["atom_warbook"],
};

interface CompetitorEntry {
  vendor: string;
  plan: string;
  per_seat_per_month_usd?: number | null;
  per_minute_usd?: number | null;
  platform_fee_per_month_usd?: number | null;
  included: string;
  annual_billed?: boolean;
  note?: string;
  source: string;
}
interface CompetitorBlock {
  module: string;
  competitors: CompetitorEntry[];
}

const COMPETITOR_MODULE_LABEL: Record<string, string> = {
  atom_dial: "ATOM Dial",
  atom_campaign_auto_dialer: "ATOM Campaign · Auto-Dialer",
  atom_multi_channel_outreach: "Multi-Channel Outreach",
  atom_prospect_engine: "ATOM Prospect Engine",
  atom_market_intent: "ATOM Market Intent",
  atom_pitch: "ATOM Pitch",
  atom_objection_handler: "ATOM Objection Handler",
  atom_war_room: "ATOM War Room",
  atom_warbook: "ATOM WarBook",
  bundled_platforms: "Bundled Platform Competitors",
};

// ───────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────

export default function SeatCostsShell() {
  const { user, isSuperAdmin } = useSessionContext();
  const [profile, setProfile] = useState<SeatProfile>("medium");
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [competitorData, setCompetitorData] = useState<CompetitorBlock[]>([]);

  useEffect(() => {
    fetch("/atom_competitor_pricing.json")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setCompetitorData(Array.isArray(d) ? d : []))
      .catch(() => setCompetitorData([]));
  }, []);

  const result = useMemo(() => computeSeatCost(profile), [profile]);
  const lightResult  = useMemo(() => computeSeatCost("light"),  []);
  const mediumResult = useMemo(() => computeSeatCost("medium"), []);
  const heavyResult  = useMemo(() => computeSeatCost("heavy"),  []);

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: 28, borderRadius: 16,
          background: "linear-gradient(180deg, rgba(255,107,139,0.06), rgba(255,107,139,0.02))",
          border: "1px solid rgba(255,107,139,0.32)", textAlign: "center" }}>
          <Crown size={28} style={{ color: ATOM_AMBER, marginBottom: 12 }} />
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>
            Seat-cost analysis — restricted
          </div>
          <p style={{ color: ATOM_MUTED }}>
            This surface exposes our COGS, competitive matrix, and recommended pricing across every ATOM module and is
            visible only to ATOM super-admins. Your account ({user?.email || "anon"}) is not on the allow-list.
          </p>
        </div>
      </div>
    );
  }

  // Group modules
  const modulesByGroup = useMemo(() => {
    const grouped: Record<ModuleGroup, ModuleCostLine[]> = {
      voice: [], outreach: [], intelligence: [], content: [], knowledge: [],
    };
    for (const m of MODULES) grouped[m.group].push(m);
    return grouped;
  }, []);

  const competitorByKey = useMemo(() => {
    const map: Record<string, CompetitorBlock> = {};
    for (const b of competitorData) map[b.module] = b;
    return map;
  }, [competitorData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_AMBER, marginBottom: 6 }}>
            <Crown size={14} /> ATOM HQ · Internal COGS + Pricing
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)" }}>
            Seat Costs, Competitors &amp; Plan Structure
          </h1>
          <p style={{ color: ATOM_MUTED, marginTop: 6, fontSize: 14, maxWidth: 820 }}>
            What every seat costs us per month grouped by capability, what each competitor charges for the same job, and
            the recommended bundled plan structure. Updated{" "}
            <strong style={{ color: ATOM_TEAL }}>{SEAT_COST_MODEL_UPDATED}</strong>{" "}
            from <a href="/atom_seat_cost_research.md" target="_blank" style={{ color: ATOM_TEAL }}>stack pricing research</a> +{" "}
            <a href="/atom_competitor_pricing.md" target="_blank" style={{ color: ATOM_TEAL }}>competitor pricing matrix</a>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(SEAT_PROFILES) as SeatProfile[]).map((p) => (
            <button key={p} onClick={() => setProfile(p)} style={{
              padding: "8px 14px", borderRadius: 10,
              background: profile === p ? "rgba(105,106,172,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${profile === p ? "rgba(105,106,172,0.36)" : "rgba(255,255,255,0.08)"}`,
              color: profile === p ? ATOM_TEAL : ATOM_MUTED,
              fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
              cursor: "pointer",
            }}>{SEAT_PROFILES[p].label}</button>
          ))}
        </div>
      </header>

      {/* Top-line KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <KpiTile label="Total cost / seat / mo" value={usd(result.totalSeatCost)} sub={SEAT_PROFILES[profile].label} tone="amber" icon={Coins} />
        <KpiTile label="Fixed per seat" value={usd(result.perSeatFixedCost)} sub="Apollo + Hunter · paid regardless" tone="default" icon={Layers} />
        <KpiTile label="Variable per seat" value={usd(result.totalVariable)} sub="Usage-based across all modules" tone="default" icon={Activity} />
        <KpiTile label="Recording storage" value={usd(result.recordingStorageCost)} sub="90-day retention" tone="default" icon={FileText} />
        <KpiTile label="RAG (Pinecone)" value={usd(result.pineconeRagCost)} sub="Reads + writes + storage" tone="default" icon={Calculator} />
      </div>

      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(105,106,172,0.04)",
        border: "1px solid rgba(105,106,172,0.18)",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_TEAL, marginBottom: 6 }}>
          Current profile assumptions
        </div>
        <div style={{ color: "var(--color-text)", fontSize: 13 }}>
          {SEAT_PROFILES[profile].description}
        </div>
      </div>

      {/* ────── Module breakdown — grouped ─────────────────────────────────── */}
      {(Object.keys(GROUP_META) as ModuleGroup[]).map((g) => {
        const meta = GROUP_META[g];
        const mods = modulesByGroup[g];
        const Icon = meta.icon;
        const groupVariableTotal = result.variableByModule
          .filter(r => r.module.group === g)
          .reduce((s, r) => s + r.variableCost, 0);

        return (
          <Card key={g} title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon size={16} style={{ color: meta.color }} />
              <span>{meta.label}</span>
              <span style={{
                padding: "1px 8px", borderRadius: 999, fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                background: `${meta.color}1c`, color: meta.color, border: `1px solid ${meta.color}40`, marginLeft: 6,
              }}>{usd(groupVariableTotal)}/seat</span>
            </span>
          } subtitle={meta.description}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <Th>Module</Th>
                    <Th>Atomic unit</Th>
                    <Th align="right">$/unit</Th>
                    <Th align="right">Units/seat/mo</Th>
                    <Th align="right">$/seat/mo</Th>
                    <Th>Providers</Th>
                  </tr>
                </thead>
                <tbody>
                  {mods.map((m) => {
                    const r = result.variableByModule.find(x => x.module.slug === m.slug)!;
                    return (
                      <tr key={m.slug} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <Td>
                          <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{m.label}</div>
                          <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 2 }}>{m.description}</div>
                        </Td>
                        <Td>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>{m.unit}</div>
                          <div style={{ fontSize: 10, color: ATOM_MUTED, marginTop: 4, lineHeight: 1.45, maxWidth: 280 }}>
                            <strong style={{ color: ATOM_TEAL_2 }}>What counts:</strong> {m.unitExplainer}
                          </div>
                        </Td>
                        <Td align="right">
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>{usdPrecise(m.costPerAction)}</span>
                        </Td>
                        <Td align="right">
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>{r.unitsPerSeat.toLocaleString()}</span>
                        </Td>
                        <Td align="right">
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: r.variableCost > 5 ? ATOM_AMBER : "var(--color-text)" }}>{usd(r.variableCost)}</span>
                        </Td>
                        <Td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {m.providers.map((pr) => (
                              <span key={pr} style={{
                                padding: "1px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)",
                                letterSpacing: "0.08em", textTransform: "uppercase",
                                background: "rgba(255,255,255,0.04)", color: ATOM_FAINT, border: "1px solid rgba(255,255,255,0.06)",
                              }}>{pr}</span>
                            ))}
                          </div>
                          <div style={{ fontSize: 10, color: ATOM_MUTED, marginTop: 4, fontFamily: "var(--font-mono)" }}>{m.breakdown}</div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Competitor sub-section for this group */}
            {COMPETITOR_KEY_FOR_GROUP[g].length > 0 && (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_MUTED, marginBottom: 10 }}>
                  Top competitors in this category
                </div>
                {COMPETITOR_KEY_FOR_GROUP[g].map((key) => {
                  const block = competitorByKey[key];
                  if (!block || !block.competitors?.length) return null;
                  return (
                    <div key={key} style={{ marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: ATOM_TEAL_2, fontSize: 13, marginBottom: 6 }}>
                        vs · {COMPETITOR_MODULE_LABEL[key] || key}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                        {block.competitors.map((c, i) => (
                          <CompetitorChip key={i} c={c} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}

      {/* ────── Pinecone + Recording roll-up ─────────────────────────── */}
      <Card title="Shared platform variable costs" subtitle="Per-seat amortization of pooled infrastructure">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <RollupCard label="Pinecone RAG"           value={result.pineconeRagCost}
            note={`Reads $${PROVIDER_PRICES.pinecone_read_per_million}/M · Writes $${PROVIDER_PRICES.pinecone_write_per_million}/M · Storage $${PROVIDER_PRICES.pinecone_storage_per_gb_mo}/GB`} />
          <RollupCard label="Recording storage"      value={result.recordingStorageCost}
            note={`Twilio $${PROVIDER_PRICES.twilio_storage_per_min_mo}/min/mo · 90-day retention`} />
          <RollupCard label="Total variable / seat"  value={result.totalVariable} highlight
            note="Sum of all module variable + Pinecone + recording" />
        </div>
      </Card>

      {/* ────── Fixed per-seat ──────────────────────────────────────── */}
      <Card title="Fixed per-seat costs" subtitle="Paid regardless of usage — scales 1:1 with active seats">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {PER_SEAT_FIXED.map((f) => (
            <div key={f.label} style={{
              padding: 14, borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {f.label}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--color-text)", margin: "6px 0" }}>
                {usd(f.monthlyCost)}/mo
              </div>
              <div style={{ fontSize: 11, color: ATOM_MUTED }}>{f.note}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ────── Profile comparison ──────────────────────────────────── */}
      <Card title="Seat profile comparison" subtitle="Cost per seat at three usage tiers — click to switch the page profile">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[lightResult, mediumResult, heavyResult].map((r) => {
            const isActive = r.profile === profile;
            const tone = r.profile === "heavy" ? ATOM_DANGER : r.profile === "medium" ? ATOM_AMBER : ATOM_TEAL;
            return (
              <button key={r.profile} onClick={() => setProfile(r.profile)} style={{
                textAlign: "left", padding: 18, borderRadius: 14,
                background: isActive ? `${tone}14` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isActive ? `${tone}55` : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer", color: "var(--color-text)",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: tone, marginBottom: 4 }}>
                  {SEAT_PROFILES[r.profile].label}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, color: "var(--color-text)" }}>
                  {usd(r.totalSeatCost)}<span style={{ fontSize: 14, color: ATOM_MUTED, fontWeight: 600 }}>/mo</span>
                </div>
                <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 6 }}>
                  {usd(r.perSeatFixedCost)} fixed + {usd(r.totalVariable)} variable
                </div>
                <div style={{ fontSize: 10, color: ATOM_FAINT, marginTop: 10, fontFamily: "var(--font-mono)" }}>
                  {SEAT_PROFILES[r.profile].description}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ────── Recommended plan structure ──────────────────────────── */}
      <Card
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Star size={16} style={{ color: ATOM_AMBER }} />Recommended plan structure</span>}
        subtitle="6-tier ladder + 8 add-ons · gross margin computed against medium-seat COGS"
      >
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, gap: 8 }}>
          {(["monthly","annual"] as const).map((b) => (
            <button key={b} onClick={() => setBilling(b)} style={{
              padding: "6px 14px", borderRadius: 999,
              background: billing === b ? "rgba(105,106,172,0.16)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${billing === b ? "rgba(105,106,172,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: billing === b ? ATOM_TEAL : ATOM_MUTED,
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700,
              cursor: "pointer",
            }}>
              {b === "annual" ? `Annual · save ${ANNUAL_DISCOUNT_PCT}%` : "Monthly"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {PLAN_TIERS.map((t) => {
            const price = billing === "annual" ? t.annualPerSeat : t.monthlyPerSeat;
            const cogs = mediumResult.totalSeatCost;
            const margin = price > 0 ? price - cogs : 0;
            const pct = price > 0 ? (margin / price) * 100 : 0;
            return (
              <div key={t.id} style={{
                padding: 16, borderRadius: 14, position: "relative",
                background: t.highlight ? "linear-gradient(180deg, rgba(105,106,172,0.06), rgba(105,106,172,0.015))" : "rgba(255,255,255,0.02)",
                border: `1px solid ${t.highlight ? "rgba(105,106,172,0.4)" : "rgba(255,255,255,0.08)"}`,
              }}>
                {t.highlight && (
                  <span style={{
                    position: "absolute", top: -10, right: 14,
                    padding: "3px 10px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                    background: ATOM_TEAL, color: "#04080a",
                  }}>Anchor tier</span>
                )}
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, color: "var(--color-text)" }}>{t.label}</div>
                <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 2, minHeight: 30 }}>{t.positioning}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "12px 0 4px" }}>
                  {t.contactSales ? (
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: ATOM_AMBER }}>Contact sales</span>
                  ) : price === 0 ? (
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--color-text)" }}>Free</span>
                  ) : (
                    <>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, color: "var(--color-text)" }}>${price}</span>
                      <span style={{ color: ATOM_MUTED, fontSize: 12 }}>/seat/{billing === "annual" ? "mo (billed yearly)" : "mo"}</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: ATOM_FAINT, letterSpacing: "0.06em" }}>
                  Min {t.minSeats} seat{t.minSeats > 1 ? "s" : ""} · {t.freeTrialDays}-day trial
                </div>
                {price > 0 && (
                  <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 8,
                    background: margin > 0 ? "rgba(72,200,138,0.08)" : "rgba(255,107,139,0.08)",
                    border: `1px solid ${margin > 0 ? "rgba(72,200,138,0.3)" : "rgba(255,107,139,0.3)"}`,
                  }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Gross margin (med)</span>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: margin > 0 ? ATOM_GREEN : ATOM_DANGER }}>
                      {margin > 0 ? "+" : ""}{usd(margin)} <span style={{ fontSize: 11, color: ATOM_MUTED }}>· {pct.toFixed(0)}%</span>
                    </div>
                  </div>
                )}
                <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", fontSize: 12, color: "var(--color-text)" }}>
                  {t.includes.map((inc) => (
                    <li key={inc} style={{ padding: "3px 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ color: ATOM_TEAL, flexShrink: 0 }}>✓</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                  {t.excludes && t.excludes.map((exc) => (
                    <li key={exc} style={{ padding: "3px 0", display: "flex", gap: 6, alignItems: "flex-start", color: ATOM_FAINT }}>
                      <span style={{ color: ATOM_FAINT, flexShrink: 0 }}>—</span>
                      <span>{exc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ────── Add-ons ─────────────────────────────────────────────── */}
      <Card
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Package size={16} style={{ color: ATOM_PURPLE }} />Add-on products</span>}
        subtitle="Layered on any base plan to expand ACV without bloating the core tiers"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          {ADD_ONS.map((a) => {
            const catColor = a.category === "voice" ? ATOM_TEAL :
                             a.category === "intelligence" ? ATOM_PURPLE :
                             a.category === "compliance" ? ATOM_AMBER :
                             ATOM_TEAL_2;
            return (
              <div key={a.id} style={{
                padding: 14, borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13 }}>{a.label}</span>
                  <span style={{
                    padding: "1px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    background: `${catColor}1c`, color: catColor, border: `1px solid ${catColor}40`,
                  }}>{a.category}</span>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--color-text)", margin: "2px 0" }}>
                  ${a.monthlyPrice}<span style={{ fontSize: 12, color: ATOM_MUTED, fontWeight: 600 }}>/{a.unit}</span>
                </div>
                <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 4, lineHeight: 1.5 }}>{a.description}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ────── Bundled platform competitors ─────────────────────────── */}
      <Card
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Building2 size={16} style={{ color: ATOM_PURPLE }} />Bundled platform competitors</span>}
        subtitle="What HubSpot / Salesforce / Salesloft / Outreach / Apollo / Gong charge for a comparable full bundle"
      >
        {(() => {
          const block = competitorByKey["bundled_platforms"];
          if (!block || !block.competitors?.length) return <div style={{ color: ATOM_MUTED }}>Loading competitor matrix…</div>;
          const grouped: Record<string, CompetitorEntry[]> = {};
          for (const c of block.competitors) {
            (grouped[c.vendor] ||= []).push(c);
          }
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {Object.entries(grouped).map(([vendor, plans]) => (
                <div key={vendor} style={{
                  padding: 14, borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 8 }}>{vendor}</div>
                  {plans.map((p, i) => (
                    <div key={i} style={{ paddingBottom: 8, marginBottom: 8, borderBottom: i < plans.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 12, color: ATOM_TEAL_2, fontWeight: 700 }}>{p.plan}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>
                          {p.per_seat_per_month_usd != null ? `$${p.per_seat_per_month_usd}` : "Quote"}
                          <span style={{ fontSize: 10, color: ATOM_MUTED, marginLeft: 3 }}>/seat/mo</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: ATOM_MUTED, marginTop: 2 }}>{p.included}</div>
                      {p.note && <div style={{ fontSize: 10, color: ATOM_FAINT, marginTop: 4, fontStyle: "italic" }}>{p.note}</div>}
                      <a href={p.source} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: ATOM_TEAL, fontFamily: "var(--font-mono)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                        Source <ExternalLink size={9} />
                      </a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      {/* ────── Sprint timeline ─────────────────────────────────────── */}
      <Card title="Sprint cost evolution" subtitle="How seat cost grew through the product roadmap (medium-usage seat)">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SPRINTS.map((s, i) => {
            const runningTotal = SPRINTS.slice(0, i + 1).reduce((sum, sp) => sum + sp.costDelta.mediumSeatUsd, 0);
            const tone = s.status === "shipped" ? ATOM_TEAL : s.status === "in_progress" ? ATOM_AMBER : ATOM_FAINT;
            return (
              <div key={s.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, alignItems: "center",
                padding: 14, borderRadius: 12,
                background: s.status === "planned" ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${s.status === "planned" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center",
                  background: `${tone}1c`, color: tone,
                  fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18,
                }}>{i + 1}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{s.label}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      background: `${tone}1c`, color: tone, border: `1px solid ${tone}40`,
                    }}>{s.status.replace("_", " ")}</span>
                    {s.shippedOn && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT }}>{s.shippedOn}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: ATOM_MUTED }}>{s.description}</div>
                  <div style={{ fontSize: 10, color: ATOM_FAINT, marginTop: 4, fontFamily: "var(--font-mono)" }}>{s.costDelta.note}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>delta</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: s.costDelta.mediumSeatUsd >= 5 ? ATOM_AMBER : "var(--color-text)" }}>
                    +{usd(s.costDelta.mediumSeatUsd)}
                  </div>
                </div>
                <div style={{ textAlign: "right", paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>running</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: ATOM_TEAL }}>{usd(runningTotal)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ────── Platform overhead ───────────────────────────────────── */}
      <Card title="Platform overhead" subtitle="Account-level fees — amortized across the portfolio">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          {PLATFORM_OVERHEAD.map((o) => (
            <div key={o.label} style={{
              padding: 14, borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13 }}>{o.label}</span>
                <span style={{
                  padding: "1px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  background: o.amortizeBy === "tenant" ? `${ATOM_PURPLE}1c` : `${ATOM_TEAL_2}1c`,
                  color: o.amortizeBy === "tenant" ? ATOM_PURPLE : ATOM_TEAL_2,
                }}>{o.amortizeBy}</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--color-text)", margin: "2px 0" }}>
                {usd(o.monthlyCost)}/mo
              </div>
              <div style={{ fontSize: 11, color: ATOM_MUTED }}>{o.note}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Footer note */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(255,209,102,0.06)",
        border: "1px solid rgba(255,209,102,0.24)",
        display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <AlertCircle size={18} style={{ color: ATOM_AMBER, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 13, marginBottom: 4 }}>How to keep this current</div>
          <div style={{ fontSize: 12, color: ATOM_MUTED, lineHeight: 1.6 }}>
            All numbers come from <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>shared/seat-cost-model.ts</code>.
            Provider prices in <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>PROVIDER_PRICES</code>.
            Plan structure + add-ons in <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>PLAN_TIERS</code> and <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>ADD_ONS</code>.
            Competitor matrix served from <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>/atom_competitor_pricing.json</code>;
            rebuild it from <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>/atom_competitor_pricing.md</code> after each refresh.
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Small reusable pieces
// ───────────────────────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 18, borderRadius: 14,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>{title}</div>
        {subtitle && <div style={{ color: ATOM_MUTED, fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align as any, padding: "8px 12px",
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
      color: ATOM_MUTED, fontWeight: 700, whiteSpace: "nowrap",
    }}>{children}</th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ textAlign: align as any, padding: "10px 12px", verticalAlign: "top" }}>{children}</td>
  );
}

function KpiTile({ label, value, sub, tone = "default", icon: Icon }: {
  label: string; value: string; sub?: string;
  tone?: "default" | "amber" | "danger" | "success";
  icon?: any;
}) {
  const color = tone === "amber" ? ATOM_AMBER : tone === "danger" ? ATOM_DANGER : tone === "success" ? ATOM_GREEN : ATOM_TEAL;
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: `${color}08`,
      border: `1px solid ${color}28`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: ATOM_MUTED }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--color-text)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function RollupCard({ label, value, note, highlight }: { label: string; value: number; note: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: highlight ? "rgba(255,209,102,0.06)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? "rgba(255,209,102,0.32)" : "rgba(255,255,255,0.06)"}`,
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: ATOM_MUTED }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: highlight ? ATOM_AMBER : "var(--color-text)", margin: "4px 0" }}>
        {usd(value)}/mo
      </div>
      <div style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>{note}</div>
    </div>
  );
}

function CompetitorChip({ c }: { c: CompetitorEntry }) {
  const seatPrice = c.per_seat_per_month_usd;
  const minPrice = c.per_minute_usd;
  const platformFee = c.platform_fee_per_month_usd;
  const priceDisplay = seatPrice != null ? `$${seatPrice}/seat/mo`
    : minPrice != null && platformFee != null && platformFee > 0
      ? `$${minPrice}/min + $${platformFee}/mo`
    : minPrice != null
      ? `$${minPrice}/min`
    : "Quote only";
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 12 }}>{c.vendor}</span>
        <span style={{ fontSize: 10, color: ATOM_TEAL_2, fontFamily: "var(--font-mono)" }}>{c.plan}</span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, color: "var(--color-text)" }}>
        {priceDisplay}
      </div>
      <div style={{ fontSize: 10, color: ATOM_MUTED, marginTop: 3, lineHeight: 1.4 }}>{c.included}</div>
      {c.note && <div style={{ fontSize: 9, color: ATOM_FAINT, marginTop: 3, fontStyle: "italic" }}>{c.note}</div>}
      <a href={c.source} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: ATOM_TEAL, fontFamily: "var(--font-mono)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4 }}>
        Source <ExternalLink size={8} />
      </a>
    </div>
  );
}
