/**
 * Release macro — ship pipeline. DESTRUCTIVE and confirmation-aware.
 *
 * Deterministic, no LLM. Steps (each destructive):
 *   1. github.mergePRAfterCI   (merge the approved PR once CI is green)
 *   2. github.draftRelease     (draft release notes for the tag)
 *   3. vercel.triggerDeploy    (kick a production deploy)
 *   4. vercel.promotePreviewToProd (optional — only if a deploymentId surfaces)
 *
 * First call (unconfirmed) returns a single ConfirmationPlan covering the whole
 * pipeline. On confirmation, steps run sequentially and stop at the first
 * failure. Each underlying tool also marks itself @destructive; the macro is
 * the coarse gate so the operator confirms once for the whole ship.
 */
import { appendOpsAudit } from "../audit";
import { createPlan } from "../confirm";
import { notify } from "../notify";
import { draftRelease, mergePRAfterCI } from "../tools/github";
import { promotePreviewToProd, triggerDeploy } from "../tools/vercel";
import {
  type DispatchResult,
  type OpsContext,
  type OpsResult,
} from "../types";

export interface ReleaseArgs {
  pr?: number;
  tag?: string;
  gitRef?: string;
}

export interface ReleaseReport {
  steps: Array<{ step: string; ok: boolean; summary: string }>;
  ok: boolean;
}

/**
 * Dispatch the release macro. Returns a confirm plan when unconfirmed; runs the
 * pipeline when context.confirmed && context.confirmationId match a /release
 * plan (the orchestrator re-dispatches through OpsOrchestrator.execute, which
 * for macros calls runReleasePipeline below).
 */
export async function runRelease(
  args: ReleaseArgs,
  context: OpsContext,
): Promise<DispatchResult> {
  if (!context.confirmed) {
    const tagPart = args.tag ? ` tag=${args.tag}` : "";
    const prPart = args.pr ? ` pr=${args.pr}` : "";
    const plan = await createPlan({
      intent: `/release${prPart}${tagPart}`,
      tool: "macro",
      action: "release",
      summary:
        `Ship pipeline: merge${args.pr ? ` PR #${args.pr}` : " approved PR"} after CI` +
        (args.tag ? `, draft release ${args.tag}` : "") +
        `, trigger prod deploy, promote to prod. ALL STEPS DESTRUCTIVE.`,
      params: { pr: args.pr, tag: args.tag, gitRef: args.gitRef },
      actorEmail: context.actorEmail,
      source: context.source,
      sessionId: context.sessionId,
    });
    await appendOpsAudit({
      actorEmail: context.actorEmail,
      actorRole: context.actorRole,
      intent: plan.intent,
      tool: "macro",
      action: "release",
      destructive: true,
      phase: "plan",
      result: "ok",
      summary: plan.summary,
      params: plan.params,
      source: context.source,
      confirmationId: plan.confirmationId,
    });
    return { kind: "confirm", plan };
  }

  const result = await runReleasePipeline(args, context);
  return { kind: "result", result };
}

/** Execute the pipeline sequentially. Called only after confirmation. */
export async function runReleasePipeline(
  args: ReleaseArgs,
  context: OpsContext,
): Promise<OpsResult<ReleaseReport>> {
  const steps: ReleaseReport["steps"] = [];
  const record = (step: string, r: OpsResult) => {
    steps.push({ step, ok: r.ok, summary: r.summary });
    return r.ok;
  };

  // 1. Merge PR after CI (only if a PR number was provided).
  if (args.pr !== undefined) {
    const merge = await mergePRAfterCI({ prNumber: args.pr, maxWaitMs: 0 });
    if (!record("github.mergePRAfterCI", merge)) {
      return finalize(steps, false, context);
    }
  }

  // 2. Draft release notes (if a tag was provided).
  if (args.tag) {
    const rel = await draftRelease({ tagName: args.tag, draft: true });
    if (!record("github.draftRelease", rel)) {
      return finalize(steps, false, context);
    }
  }

  // 3. Trigger production deploy.
  const deploy = await triggerDeploy({ gitRef: args.gitRef, target: "production" });
  const deployOk = record("vercel.triggerDeploy", deploy);
  if (!deployOk) return finalize(steps, false, context);

  // 4. Promote the produced deployment to prod, if we got an id back.
  const deployData = deploy.data as { id?: string } | null;
  if (deployData?.id) {
    const promote = await promotePreviewToProd({ deploymentId: deployData.id });
    record("vercel.promotePreviewToProd", promote);
  }

  const allOk = steps.every((s) => s.ok);
  return finalize(steps, allOk, context);
}

async function finalize(
  steps: ReleaseReport["steps"],
  allOk: boolean,
  context: OpsContext,
): Promise<OpsResult<ReleaseReport>> {
  const summary = `Release ${allOk ? "completed" : "stopped early"}: ${steps
    .map((s) => `${s.step}=${s.ok ? "ok" : "fail"}`)
    .join(", ")}`;
  await appendOpsAudit({
    actorEmail: context.actorEmail,
    actorRole: context.actorRole,
    intent: "/release",
    tool: "macro",
    action: "release",
    destructive: true,
    phase: "execute",
    result: allOk ? "ok" : "error",
    summary,
    data: { steps },
    source: context.source,
  });
  await notify(`Release ${allOk ? "completed ✅" : "stopped ⚠️"} (${context.actorEmail})`);
  return { ok: allOk, data: { steps, ok: allOk }, summary };
}
