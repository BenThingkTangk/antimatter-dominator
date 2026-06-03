/**
 * Escalation adapters. Routes a support escalation to a human via:
 *   Plain  (PLAIN_API_KEY)   — customer-support ticketing (preferred)
 *   Linear (LINEAR_API_KEY)  — engineering issue tracker
 *   Slack  (SLACK_BOT_TOKEN) — real-time ping (always fired if configured)
 * Provider chosen by SUPPORT_ESCALATION_PROVIDER (plain|linear|auto). If no
 * provider is configured the escalation is still PERSISTED to Supabase
 * (provider='logged') so nothing is lost — humans can pick it up from the admin
 * dashboard. Clean adapter boundary: swap creds in later with zero code change.
 */
import { sbInsert } from "./supabase.js";
import type { SupportTier, RetrievedChunk, SupportTurn } from "./types.js";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SLACK_BOT_TOKEN = clean(process.env.SLACK_BOT_TOKEN);
const SLACK_SUPPORT_CHANNEL_ID = clean(process.env.SLACK_SUPPORT_CHANNEL_ID);
const PLAIN_API_KEY = clean(process.env.PLAIN_API_KEY);
const LINEAR_API_KEY = clean(process.env.LINEAR_API_KEY);
const LINEAR_TEAM_ID = clean(process.env.LINEAR_TEAM_ID);
const PROVIDER = clean(process.env.SUPPORT_ESCALATION_PROVIDER).toLowerCase() || "auto";

export type Severity = "low" | "normal" | "high" | "critical";

export interface EscalationRequest {
  conversationId?: string | null;
  sessionId?: string | null;
  tenantId?: string | null;
  tenantSlug?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userTier?: SupportTier;
  triggerReason: string;
  severity: Severity;
  confidence?: number;
  transcript: SupportTurn[];
  retrievedDocs: RetrievedChunk[];
  recommendedAction?: string;
}

export interface EscalationResult {
  escalated: boolean;
  provider: string;
  providerRef?: string;
  escalationId?: string;
}

function summarize(req: EscalationRequest): string {
  const lastUser = [...req.transcript].reverse().find((t) => t.role === "user");
  const lines = [
    `*ATOM Support escalation* (${req.severity.toUpperCase()})`,
    `Reason: ${req.triggerReason}`,
    `Tier: ${req.userTier || "public"}  Tenant: ${req.tenantSlug || "—"}  User: ${req.userEmail || "anon"}`,
    `Confidence: ${req.confidence != null ? req.confidence.toFixed(2) : "n/a"}`,
    `Question: ${lastUser?.content?.slice(0, 400) || "(none)"}`,
    req.recommendedAction ? `Recommended: ${req.recommendedAction}` : "",
    req.retrievedDocs.length
      ? `Sources: ${req.retrievedDocs.map((d) => d.sourceTitle).slice(0, 4).join(", ")}`
      : "Sources: none retrieved",
  ];
  return lines.filter(Boolean).join("\n");
}

async function pingSlack(req: EscalationRequest): Promise<string | undefined> {
  if (!SLACK_BOT_TOKEN || !SLACK_SUPPORT_CHANNEL_ID) return undefined;
  try {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: SLACK_SUPPORT_CHANNEL_ID, text: summarize(req) }),
      signal: AbortSignal.timeout(5000),
    });
    const d: any = await r.json().catch(() => ({}));
    return d?.ts ? `slack:${d.ts}` : undefined;
  } catch (e: any) {
    console.warn("[support escalation] slack failed:", e?.message);
    return undefined;
  }
}

async function createPlainThread(req: EscalationRequest): Promise<string | undefined> {
  if (!PLAIN_API_KEY) return undefined;
  try {
    // Plain uses GraphQL; we create a thread with the transcript as the body.
    const body = {
      query: `mutation($input: CreateThreadInput!){ createThread(input:$input){ thread{ id } error{ message } } }`,
      variables: {
        input: {
          title: `ATOM Support: ${req.triggerReason}`,
          customerIdentifier: req.userEmail ? { emailAddress: req.userEmail } : undefined,
          components: [{ componentText: { text: summarize(req) } }],
        },
      },
    };
    const r = await fetch("https://core-api.uk.plain.com/graphql/v1", {
      method: "POST",
      headers: { Authorization: `Bearer ${PLAIN_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    const d: any = await r.json().catch(() => ({}));
    const id = d?.data?.createThread?.thread?.id;
    return id ? `plain:${id}` : undefined;
  } catch (e: any) {
    console.warn("[support escalation] plain failed:", e?.message);
    return undefined;
  }
}

async function createLinearIssue(req: EscalationRequest): Promise<string | undefined> {
  if (!LINEAR_API_KEY || !LINEAR_TEAM_ID) return undefined;
  try {
    const priority = req.severity === "critical" ? 1 : req.severity === "high" ? 2 : 3;
    const body = {
      query: `mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier } } }`,
      variables: {
        input: {
          teamId: LINEAR_TEAM_ID,
          title: `ATOM Support: ${req.triggerReason}`.slice(0, 250),
          description: summarize(req),
          priority,
        },
      },
    };
    const r = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: { Authorization: LINEAR_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    const d: any = await r.json().catch(() => ({}));
    const issue = d?.data?.issueCreate?.issue;
    return issue ? `linear:${issue.identifier || issue.id}` : undefined;
  } catch (e: any) {
    console.warn("[support escalation] linear failed:", e?.message);
    return undefined;
  }
}

export function escalationProviders(): { plain: boolean; linear: boolean; slack: boolean; provider: string } {
  return {
    plain: Boolean(PLAIN_API_KEY),
    linear: Boolean(LINEAR_API_KEY && LINEAR_TEAM_ID),
    slack: Boolean(SLACK_BOT_TOKEN && SLACK_SUPPORT_CHANNEL_ID),
    provider: PROVIDER,
  };
}

export async function escalate(req: EscalationRequest): Promise<EscalationResult> {
  // 1. Always fire Slack ping in parallel (real-time awareness).
  const slackPromise = pingSlack(req);

  // 2. Create a ticket in the preferred ticketing provider.
  let providerRef: string | undefined;
  let provider = "logged";
  const wantPlain = PROVIDER === "plain" || PROVIDER === "auto";
  const wantLinear = PROVIDER === "linear" || (PROVIDER === "auto" && !PLAIN_API_KEY);

  if (wantPlain && PLAIN_API_KEY) {
    providerRef = await createPlainThread(req);
    if (providerRef) provider = "plain";
  }
  if (!providerRef && wantLinear) {
    providerRef = await createLinearIssue(req);
    if (providerRef) provider = "linear";
  }

  const slackRef = await slackPromise;
  if (provider === "logged" && slackRef) provider = "slack";
  const ref = providerRef || slackRef;

  // 3. Always persist to Supabase so nothing is lost regardless of provider.
  const row = await sbInsert("support_escalations", {
    conversation_id: req.conversationId || null,
    session_id: req.sessionId || null,
    tenant_id: req.tenantId || null,
    tenant_slug: req.tenantSlug || null,
    user_id: req.userId || null,
    user_email: req.userEmail || null,
    user_tier: req.userTier || "public",
    trigger_reason: req.triggerReason,
    severity: req.severity,
    confidence: req.confidence ?? null,
    transcript: req.transcript,
    retrieved_docs: req.retrievedDocs.map((d) => ({
      title: d.sourceTitle, url: d.sourceUrl, heading: d.heading, similarity: d.similarity,
    })),
    recommended_action: req.recommendedAction || null,
    provider,
    provider_ref: ref || null,
    status: "open",
  });

  return { escalated: true, provider, providerRef: ref, escalationId: row?.id };
}
