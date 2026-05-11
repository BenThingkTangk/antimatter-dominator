/**
 * Nirmata HQ \u00b7 Seat & Module Cost Analysis
 *
 * Super-admin only. Tenants never see this surface \u2014 it exposes our COGS
 * across every module and shows how much margin we have on each plan tier.
 *
 * The numbers are all derived from /shared/seat-cost-model.ts \u2014 there are NO
 * hard-coded dollar figures in this file. Update that model whenever prices
 * change and this page auto-rerenders.
 */
import { useMemo, useState } from "react";
import {
  Coins, Crown, Calculator, TrendingUp, Activity, AlertCircle, FileText, Layers,
} from "lucide-react";
import { useSessionContext } from "../auth/AuthGate";
import {
  ATOM_TEAL, ATOM_TEAL_2, ATOM_PURPLE, ATOM_AMBER, ATOM_GREEN, ATOM_DANGER, ATOM_MUTED, ATOM_FAINT,
} from "./charts";
import {
  SEAT_PROFILES, SPRINTS, MODULES, PLATFORM_OVERHEAD, PER_SEAT_FIXED, PROVIDER_PRICES,
  computeSeatCost, SEAT_COST_MODEL_UPDATED,
  type SeatProfile,
} from "@shared/seat-cost-model";

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Money formatters
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

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

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Plan tier seat prices we charge tenants \u2014 used for margin computation.
// Mirrors what's in api/billing/checkout.ts (per-seat sell prices in cents).
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

const SELL_PRICE_BY_PLAN: Record<string, { perSeat: number; label: string }> = {
  starter:    { perSeat: 99,  label: "Starter \u00b7 $99/seat/mo"      },
  growth:     { perSeat: 199, label: "Growth \u00b7 $199/seat/mo"     },
  advisory:   { perSeat: 399, label: "Advisory \u00b7 $399/seat/mo"   },
  enterprise: { perSeat: 799, label: "Enterprise \u00b7 $799/seat/mo" },
};

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Main component
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export default function SeatCostsShell() {
  const { user, isSuperAdmin } = useSessionContext();
  const [profile, setProfile] = useState<SeatProfile>("medium");

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
            Seat-cost analysis \u2014 restricted
          </div>
          <p style={{ color: ATOM_MUTED }}>
            This surface exposes our COGS across every ATOM module and is visible only to
            Nirmata super-admins. Your account ({user?.email || "anon"}) is not on the allow-list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingBottom: 80 }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 18 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_AMBER, marginBottom: 6 }}>
            <Crown size={14} /> Nirmata HQ \u00b7 Internal COGS
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--color-text)" }}>
            Seat &amp; Module Costs
          </h1>
          <p style={{ color: ATOM_MUTED, marginTop: 6, fontSize: 14, maxWidth: 760 }}>
            What each user/seat costs us per month broken down by module, provider, and sprint.
            Numbers are list-price COGS at current usage profiles \u2014 not Stripe-billed revenue.
            Updated <strong style={{ color: ATOM_TEAL }}>{SEAT_COST_MODEL_UPDATED}</strong> from
            <a href="/atom_seat_cost_research.md" style={{ color: ATOM_TEAL, marginLeft: 4 }}>stack pricing research</a>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(SEAT_PROFILES) as SeatProfile[]).map((p) => (
            <button
              key={p}
              onClick={() => setProfile(p)}
              style={{
                padding: "8px 14px", borderRadius: 10,
                background: profile === p ? "rgba(0,230,211,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${profile === p ? "rgba(0,230,211,0.36)" : "rgba(255,255,255,0.08)"}`,
                color: profile === p ? ATOM_TEAL : ATOM_MUTED,
                fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {SEAT_PROFILES[p].label}
            </button>
          ))}
        </div>
      </header>

      {/* Top-line KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <KpiTile
          label="Total cost / seat / mo"
          value={usd(result.totalSeatCost)}
          sub={SEAT_PROFILES[profile].label}
          tone="amber"
          icon={Coins}
        />
        <KpiTile
          label="Fixed per seat"
          value={usd(result.perSeatFixedCost)}
          sub="Apollo + Hunter \u00b7 paid regardless"
          tone="default"
          icon={Layers}
        />
        <KpiTile
          label="Variable per seat"
          value={usd(result.totalVariable)}
          sub="Usage-based across all modules"
          tone="default"
          icon={Activity}
        />
        <KpiTile
          label="Recording storage"
          value={usd(result.recordingStorageCost)}
          sub="90-day retention, Twilio"
          tone="default"
          icon={FileText}
        />
        <KpiTile
          label="RAG (Pinecone)"
          value={usd(result.pineconeRagCost)}
          sub="Reads + writes + storage"
          tone="default"
          icon={Calculator}
        />
      </div>

      {/* Profile context line */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(0,230,211,0.04)",
        border: "1px solid rgba(0,230,211,0.18)",
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: ATOM_TEAL, marginBottom: 6 }}>
          Current profile assumptions
        </div>
        <div style={{ color: "var(--color-text)", fontSize: 13 }}>
          {SEAT_PROFILES[profile].description}
        </div>
      </div>

      {/* Module breakdown table */}
      <Card title="Per-module breakdown" subtitle="Marginal $ cost \u00d7 monthly volume = seat impact">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <Th>Module</Th>
                <Th>Atomic unit</Th>
                <Th align="right">$/unit</Th>
                <Th align="right">Units / seat</Th>
                <Th align="right">$/seat/mo</Th>
                <Th>Providers</Th>
              </tr>
            </thead>
            <tbody>
              {result.variableByModule.map(({ module, unitsPerSeat, variableCost }) => (
                <tr key={module.slug} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <Td>
                    <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{module.label}</div>
                    <div style={{ fontSize: 11, color: ATOM_MUTED, marginTop: 2 }}>{module.description}</div>
                  </Td>
                  <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>{module.unit}</span></Td>
                  <Td align="right">
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                      {usdPrecise(module.costPerAction)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
                      {unitsPerSeat.toLocaleString()}
                    </span>
                  </Td>
                  <Td align="right">
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: variableCost > 5 ? ATOM_AMBER : "var(--color-text)" }}>
                      {usd(variableCost)}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {module.providers.map((p) => (
                        <span key={p} style={{
                          padding: "1px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)",
                          letterSpacing: "0.08em", textTransform: "uppercase",
                          background: "rgba(255,255,255,0.04)", color: ATOM_FAINT, border: "1px solid rgba(255,255,255,0.06)",
                        }}>{p}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: ATOM_MUTED, marginTop: 4, fontFamily: "var(--font-mono)" }}>{module.breakdown}</div>
                  </Td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid rgba(0,230,211,0.24)" }}>
                <Td><div style={{ fontWeight: 700, color: ATOM_TEAL }}>Pinecone RAG (shared)</div></Td>
                <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>reads + writes + storage</span></Td>
                <Td align="right"><span style={{ color: ATOM_FAINT }}>\u2014</span></Td>
                <Td align="right"><span style={{ color: ATOM_FAINT }}>\u2014</span></Td>
                <Td align="right">
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>
                    {usd(result.pineconeRagCost)}
                  </span>
                </Td>
                <Td>
                  <div style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>
                    {result.variableByModule[0].module.slug ? `Reads $${PROVIDER_PRICES.pinecone_read_per_million}/M + Writes $${PROVIDER_PRICES.pinecone_write_per_million}/M + storage $${PROVIDER_PRICES.pinecone_storage_per_gb_mo}/GB` : ""}
                  </div>
                </Td>
              </tr>
              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <Td><div style={{ fontWeight: 700, color: ATOM_TEAL }}>Recording storage</div></Td>
                <Td><span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: ATOM_FAINT }}>min-stored \u00d7 months</span></Td>
                <Td align="right"><span style={{ color: ATOM_FAINT }}>{usdPrecise(PROVIDER_PRICES.twilio_storage_per_min_mo)}</span></Td>
                <Td align="right"><span style={{ color: ATOM_FAINT }}>~90d retention</span></Td>
                <Td align="right">
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>
                    {usd(result.recordingStorageCost)}
                  </span>
                </Td>
                <Td><span style={{ fontSize: 10, color: ATOM_MUTED, fontFamily: "var(--font-mono)" }}>Twilio recording storage \u00b7 retained 3 months</span></Td>
              </tr>
              <tr style={{ borderTop: "2px solid rgba(255,209,102,0.4)" }}>
                <Td><div style={{ fontWeight: 800, color: ATOM_AMBER, fontFamily: "var(--font-display)" }}>Total variable</div></Td>
                <Td></Td>
                <Td></Td>
                <Td></Td>
                <Td align="right">
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: ATOM_AMBER }}>
                    {usd(result.totalVariable)}
                  </span>
                </Td>
                <Td></Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fixed per-seat costs */}
      <Card title="Fixed per-seat costs" subtitle="Paid regardless of usage \u2014 scales 1:1 with active seats">
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

      {/* Light / Medium / Heavy comparison */}
      <Card title="Seat profile comparison" subtitle="Cost per seat at three usage tiers">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[lightResult, mediumResult, heavyResult].map((r) => {
            const isActive = r.profile === profile;
            const tone = r.profile === "heavy" ? ATOM_DANGER : r.profile === "medium" ? ATOM_AMBER : ATOM_TEAL;
            return (
              <button
                key={r.profile}
                onClick={() => setProfile(r.profile)}
                style={{
                  textAlign: "left", padding: 18, borderRadius: 14,
                  background: isActive ? `${tone}14` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? `${tone}55` : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer", color: "var(--color-text)",
                  transition: "transform 160ms cubic-bezier(0.16,1,0.3,1), border-color 160ms",
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

      {/* Margin matrix vs plan tiers */}
      <Card title="Gross margin matrix" subtitle="Seat cost vs current plan-tier sell prices (medium-usage seat)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <Th>Plan</Th>
                <Th align="right">Sell / seat / mo</Th>
                <Th align="right">Cost (light)</Th>
                <Th align="right">Cost (medium)</Th>
                <Th align="right">Cost (heavy)</Th>
                <Th align="right">Margin (medium)</Th>
                <Th>Verdict</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SELL_PRICE_BY_PLAN).map(([slug, { perSeat, label }]) => {
                const marginMed = perSeat - mediumResult.totalSeatCost;
                const marginHeavy = perSeat - heavyResult.totalSeatCost;
                const pctMed = (marginMed / perSeat) * 100;
                const verdict = marginHeavy < 0
                  ? { label: "Loss-leader on heavy use", color: ATOM_DANGER }
                  : pctMed < 30
                  ? { label: "Thin \u2014 raise price", color: ATOM_AMBER }
                  : pctMed < 60
                  ? { label: "Healthy", color: ATOM_GREEN }
                  : { label: "Premium margin", color: ATOM_TEAL };
                return (
                  <tr key={slug} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <Td><div style={{ fontWeight: 700, color: "var(--color-text)" }}>{label}</div></Td>
                    <Td align="right"><span style={{ fontFamily: "var(--font-mono)" }}>${perSeat}</span></Td>
                    <Td align="right"><span style={{ fontFamily: "var(--font-mono)", color: ATOM_FAINT }}>{usd(lightResult.totalSeatCost)}</span></Td>
                    <Td align="right"><span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>{usd(mediumResult.totalSeatCost)}</span></Td>
                    <Td align="right"><span style={{ fontFamily: "var(--font-mono)", color: marginHeavy < 0 ? ATOM_DANGER : ATOM_FAINT }}>{usd(heavyResult.totalSeatCost)}</span></Td>
                    <Td align="right">
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: marginMed > 0 ? ATOM_GREEN : ATOM_DANGER }}>
                        {marginMed > 0 ? "+" : ""}{usd(marginMed)}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_MUTED, marginLeft: 6 }}>{pctMed.toFixed(0)}%</span>
                    </Td>
                    <Td>
                      <span style={{
                        padding: "3px 10px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        background: `${verdict.color}1c`, color: verdict.color, border: `1px solid ${verdict.color}55`,
                      }}>{verdict.label}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sprint timeline */}
      <Card title="Sprint cost evolution" subtitle="How seat cost grew through the product roadmap (medium-usage seat)">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SPRINTS.map((s, i) => {
            // Running total up to and including this sprint.
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
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{s.label}</span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                      background: `${tone}1c`, color: tone, border: `1px solid ${tone}40`,
                    }}>{s.status.replace("_", " ")}</span>
                    {s.shippedOn && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: ATOM_FAINT }}>{s.shippedOn}</span>
                    )}
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
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: ATOM_TEAL }}>
                    {usd(runningTotal)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Platform overhead */}
      <Card title="Platform overhead" subtitle="Account-level fees \u2014 amortized across the portfolio">
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

      {/* Footer notice */}
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
            Edit <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>PROVIDER_PRICES</code> when a vendor changes list price.
            Edit <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>SEAT_PROFILES</code> when actual usage shifts.
            Append to <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>SPRINTS</code> on every shipped milestone.
            Append to <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>MODULES</code> when we ship a new ATOM surface.
            The full pricing research lives at <code style={{ color: ATOM_TEAL, fontFamily: "var(--font-mono)" }}>/atom_seat_cost_research.md</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Small reusable pieces
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
