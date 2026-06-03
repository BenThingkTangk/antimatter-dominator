/**
 * ATOM Ops orchestrator — DETERMINISTIC keyword routing only. ZERO LLM calls.
 *
 * Intent grammar:
 *   "<tool>.<action> key=value key2=value2 ..."   → routes to a tool action
 *   "/morning-brief"                              → morning brief macro
 *   "/release [pr=<n>] [tag=<vX.Y.Z>]"            → release macro
 *
 * Plan → Confirm → Execute:
 *   - Non-destructive actions execute immediately.
 *   - Destructive actions return a ConfirmationPlan (kind:"confirm"); the
 *     caller re-dispatches with context.confirmationId + confirmed:true to
 *     execute, or calls cancel() to discard (both write an audit entry).
 */
import { appendOpsAudit } from "./audit";
import { consumePlan, createPlan, getPlan } from "./confirm";
import { logger } from "./logger";
import { tools as akamai } from "./tools/akamai";
import { tools as cloudflare } from "./tools/cloudflare";
import { tools as email } from "./tools/email";
import { tools as github } from "./tools/github";
import { tools as sentryPosthog } from "./tools/sentry-posthog";
import { tools as stripe } from "./tools/stripe";
import { tools as supabaseOps } from "./tools/supabase-ops";
import { tools as twilio } from "./tools/twilio";
import { tools as vercel } from "./tools/vercel";
import {
  errMessage,
  fail,
  type DispatchResult,
  type OpsContext,
  type OpsResult,
  type ToolAction,
} from "./types";

const log = logger.child({ component: "orchestrator" });

/** tool name → { action → ToolAction }. Single source of truth for routing. */
export const REGISTRY: Record<string, Record<string, ToolAction>> = {
  github,
  vercel,
  supabase: supabaseOps,
  stripe,
  twilio,
  akamai,
  sentry: sentryPosthog,
  posthog: sentryPosthog,
  cloudflare,
  email,
};

export interface ParsedIntent {
  tool: string;
  action: string;
  params: Record<string, unknown>;
}

/**
 * Parse a "<tool>.<action> k=v k2=v2" intent. Values are coerced: true/false →
 * boolean, pure integers → number, everything else stays a string. Quoted
 * values ("a b c") preserve spaces.
 */
export function parseIntent(raw: string): ParsedIntent | null {
  const trimmed = raw.trim();
  const head = trimmed.match(/^([a-zA-Z]+)\.([a-zA-Z]+)/);
  if (!head) return null;
  const [, tool, action] = head;
  const rest = trimmed.slice(head[0].length).trim();
  const params: Record<string, unknown> = {};
  // key=value with optional double-quotes around the value.
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)=("([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    const key = m[1];
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    params[key] = coerce(value);
  }
  return { tool: tool.toLowerCase(), action, params };
}

function coerce(v: string): unknown {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function resolveAction(tool: string, action: string): ToolAction | null {
  const group = REGISTRY[tool];
  if (!group) return null;
  return group[action] || null;
}

export class OpsOrchestrator {
  /**
   * Dispatch an intent. Returns a discriminated DispatchResult so callers can
   * render a result, a confirmation prompt, a cancellation, or an error.
   */
  static async dispatch(intent: string, context: OpsContext): Promise<DispatchResult> {
    const raw = intent.trim();

    // Macros (deterministic slash commands).
    if (raw === "/morning-brief" || raw.startsWith("/morning-brief ")) {
      const { runMorningBrief } = await import("./macros/morning-brief");
      const result = await runMorningBrief(context);
      await appendOpsAudit({
        actorEmail: context.actorEmail,
        actorRole: context.actorRole,
        intent: "/morning-brief",
        tool: "macro",
        action: "morning-brief",
        destructive: false,
        phase: "execute",
        result: result.ok ? "ok" : "error",
        summary: result.summary,
        source: context.source,
      });
      return { kind: "result", result };
    }

    if (raw === "/release" || raw.startsWith("/release ")) {
      const { runRelease } = await import("./macros/release");
      const parsed = parseReleaseArgs(raw);
      return runRelease(parsed, context);
    }

    // Confirmation redemption / cancellation handled by caller via execute()/cancel().
    if (context.confirmationId && context.confirmed) {
      return OpsOrchestrator.execute(context.confirmationId, context);
    }

    const parsed = parseIntent(raw);
    if (!parsed) {
      return {
        kind: "error",
        summary:
          "Unrecognized intent. Use '<tool>.<action> key=value', /morning-brief, or /release.",
      };
    }

    const toolAction = resolveAction(parsed.tool, parsed.action);
    if (!toolAction) {
      return {
        kind: "error",
        summary: `Unknown tool/action '${parsed.tool}.${parsed.action}'.`,
      };
    }

    // Destructive → return a plan; do NOT execute.
    if (toolAction.meta.destructive) {
      const plan = await createPlan({
        intent: raw,
        tool: parsed.tool,
        action: parsed.action,
        summary: `Will run ${toolAction.meta.description.toLowerCase()} (${parsed.tool}.${parsed.action})`,
        params: parsed.params,
        actorEmail: context.actorEmail,
      });
      await appendOpsAudit({
        actorEmail: context.actorEmail,
        actorRole: context.actorRole,
        intent: raw,
        tool: parsed.tool,
        action: parsed.action,
        destructive: true,
        phase: "plan",
        result: "ok",
        summary: plan.summary,
        params: parsed.params,
        source: context.source,
        confirmationId: plan.confirmationId,
      });
      return { kind: "confirm", plan };
    }

    // Non-destructive → execute now.
    const result = await safeRun(toolAction, parsed.params);
    await appendOpsAudit({
      actorEmail: context.actorEmail,
      actorRole: context.actorRole,
      intent: raw,
      tool: parsed.tool,
      action: parsed.action,
      destructive: false,
      phase: "execute",
      result: result.ok ? "ok" : "error",
      summary: result.summary,
      params: parsed.params,
      data: result.data,
      source: context.source,
    });
    return { kind: "result", result };
  }

  /** Redeem a confirmation and execute the underlying destructive action. */
  static async execute(confirmationId: string, context: OpsContext): Promise<DispatchResult> {
    const plan = await consumePlan(confirmationId);
    if (!plan) {
      return {
        kind: "error",
        summary: "Confirmation expired or not found (pending ops live 5 minutes).",
      };
    }

    // Macro confirmations (e.g. /release) route to their pipeline, not a tool.
    if (plan.tool === "macro" && plan.action === "release") {
      const { runReleasePipeline } = await import("./macros/release");
      const result = await runReleasePipeline(
        {
          pr: typeof plan.params.pr === "number" ? plan.params.pr : undefined,
          tag: typeof plan.params.tag === "string" ? plan.params.tag : undefined,
          gitRef: typeof plan.params.gitRef === "string" ? plan.params.gitRef : undefined,
        },
        context,
      );
      return { kind: "result", result };
    }

    const toolAction = resolveAction(plan.tool, plan.action);
    if (!toolAction) {
      return { kind: "error", summary: `Action ${plan.tool}.${plan.action} no longer available.` };
    }
    const result = await safeRun(toolAction, plan.params);
    await appendOpsAudit({
      actorEmail: context.actorEmail,
      actorRole: context.actorRole,
      intent: plan.intent,
      tool: plan.tool,
      action: plan.action,
      destructive: true,
      phase: "execute",
      result: result.ok ? "ok" : "error",
      summary: result.summary,
      params: plan.params,
      data: result.data,
      source: context.source,
      confirmationId,
    });
    return { kind: "result", result };
  }

  /** Cancel a pending destructive op — writes an audit entry, runs nothing. */
  static async cancel(confirmationId: string, context: OpsContext): Promise<DispatchResult> {
    const plan = await getPlan(confirmationId);
    await consumePlan(confirmationId);
    await appendOpsAudit({
      actorEmail: context.actorEmail,
      actorRole: context.actorRole,
      intent: plan?.intent || `cancel ${confirmationId}`,
      tool: plan?.tool,
      action: plan?.action,
      destructive: true,
      phase: "cancel",
      result: "blocked",
      summary: `Cancelled ${plan ? `${plan.tool}.${plan.action}` : confirmationId}`,
      source: context.source,
      confirmationId,
    });
    return {
      kind: "cancelled",
      confirmationId,
      summary: `Cancelled ${plan ? `${plan.tool}.${plan.action}` : "operation"}.`,
    };
  }
}

/** Run a tool action, converting thrown errors into a typed failure result. */
export async function safeRun(
  toolAction: ToolAction,
  params: Record<string, unknown>,
): Promise<OpsResult> {
  try {
    return await toolAction.run(params);
  } catch (e) {
    log.error({ err: errMessage(e), action: toolAction.meta.action }, "tool threw");
    return fail(`${toolAction.meta.tool}.${toolAction.meta.action} threw: ${errMessage(e)}`);
  }
}

function parseReleaseArgs(raw: string): { pr?: number; tag?: string } {
  const parsed = parseIntent(raw.replace(/^\//, "release.run "));
  const params = parsed?.params || {};
  const pr = typeof params.pr === "number" ? params.pr : undefined;
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  return { pr, tag };
}

/** List every available action's metadata — used by the UI command palette. */
export function listActions(): Array<{
  id: string;
  tool: string;
  action: string;
  destructive: boolean;
  description: string;
}> {
  const out: Array<{
    id: string;
    tool: string;
    action: string;
    destructive: boolean;
    description: string;
  }> = [];
  const seen = new Set<string>();
  for (const [, group] of Object.entries(REGISTRY)) {
    if (!group) continue;
    for (const [, ta] of Object.entries(group)) {
      const id = `${ta.meta.tool}.${ta.meta.action}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        tool: ta.meta.tool,
        action: ta.meta.action,
        destructive: ta.meta.destructive,
        description: ta.meta.description,
      });
    }
  }
  out.push(
    { id: "/morning-brief", tool: "macro", action: "morning-brief", destructive: false, description: "Daily non-destructive snapshot" },
    { id: "/release", tool: "macro", action: "release", destructive: true, description: "Ship pipeline (confirmation-gated)" },
  );
  return out;
}

export * from "./types";
