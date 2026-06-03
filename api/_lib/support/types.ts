/** Shared types for the ATOM Support module (server + adapters). */

export type SupportTier = "starter" | "scale" | "partner" | "public";
export type SupportSurface = "app" | "marketing";
export type ContentType = "doc" | "playbook" | "help" | "changelog" | "status" | "roadmap";

export interface Citation {
  title: string;
  url?: string;
  heading?: string;
  chunkId?: string;
}

export interface RetrievedChunk {
  id: string;
  sourceTitle: string;
  sourceUrl?: string;
  sourcePath?: string;
  heading?: string;
  content: string;
  contentType: string;
  updatedAt?: string;
  similarity: number;
}

export interface SupportTurn {
  role: "user" | "assistant";
  content: string;
}

/** Safely summarized tenant context — never raw DB rows. */
export interface TenantContextSummary {
  tenantId?: string;
  tenantSlug?: string;
  userId?: string;
  userEmail?: string;
  role?: string;
  plan?: string;
  tier: SupportTier;
  usageLevel?: "low" | "medium" | "high" | "unknown";
  recentCampaign?: {
    name?: string;
    status?: string;
    updatedAt?: string;
  } | null;
  recentErrors?: string[];
  billingStatus?: string; // safe routing-level only: active | past_due | trialing | canceled
}

export interface ConfidenceInput {
  topSimilarity: number;        // best retrieval score 0..1
  meanSimilarity: number;       // mean of retrieved scores
  chunkCount: number;           // how many chunks passed threshold
  topicRisk: number;            // 0 (safe) .. 1 (hard-block)
  tier: SupportTier;
  hasTenantDiagnostics: boolean;
}

export interface ConfidenceResult {
  score: number;                // 0..1 final confidence
  factors: Record<string, number>;
}
