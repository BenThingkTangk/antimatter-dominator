/** Tier-aware tone policy. Plan/tier shapes the assistant's voice. */
import type { SupportTier } from "./types";

/** Map a tenant plan (trial|growth|advisory|enterprise|...) to a support tier. */
export function planToTier(plan: string | null | undefined): SupportTier {
  const p = (plan || "").toLowerCase();
  if (!p) return "public";
  // ATOM plans: trial | growth | advisory | enterprise. Marketing/sellable tiers
  // are Starter / Scale / Partner. Map conservatively.
  if (p.includes("partner") || p.includes("enterprise") || p.includes("advisory")) return "partner";
  if (p.includes("scale") || p.includes("growth")) return "scale";
  if (p.includes("starter") || p.includes("trial") || p.includes("free")) return "starter";
  return "starter";
}

const DIRECTIVES: Record<SupportTier, string> = {
  starter:
    "TONE: Starter tier. Be warm, encouraging, and plain-spoken. Avoid jargon; explain concepts simply and reassure the user. Short sentences. A little friendly personality is welcome.",
  scale:
    "TONE: Scale tier. Be formal, concise, and operational. Enterprise-grade precision. No filler, no emoji. Lead with the actionable answer and the relevant metric or step.",
  partner:
    "TONE: Partner tier. Be executive and white-glove. Strategic, precise, and confident. Frame answers in terms of business outcomes and offer proactive next steps. Treat the user as a key account.",
  public:
    "TONE: Public/marketing visitor (logged out). Be welcoming and helpful, focus on what ATOM does and how to get started. Do not assume account access. Invite sign-up where natural.",
};

export function toneDirective(tier: SupportTier): string {
  return DIRECTIVES[tier] || DIRECTIVES.public;
}
