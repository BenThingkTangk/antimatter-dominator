/**
 * Vercel tool — REST API v6/v9/v13 via fetch.
 * Env: VERCEL_TOKEN, ATOM_OPS_VERCEL_PROJECT_ID, ATOM_OPS_VERCEL_TEAM_ID (opt).
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.vercel.com";
const log = logger.child({ tool: "vercel" });

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${getEnv("VERCEL_TOKEN", true)}` };
}

function teamQuery(): string {
  const team = getEnv("ATOM_OPS_VERCEL_TEAM_ID");
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

function projectId(explicit?: string): string {
  const id = explicit || getEnv("ATOM_OPS_VERCEL_PROJECT_ID");
  if (!id) throw new Error("Set ATOM_OPS_VERCEL_PROJECT_ID or pass project");
  return id;
}

/**
 * @destructive Triggers a new production deployment from a git ref.
 */
export async function triggerDeploy(p: {
  project?: string;
  gitRef?: string;
  target?: "production" | "preview";
}): Promise<OpsResult<{ id: string; url: string; state: string }>> {
  try {
    const id = projectId(p.project);
    const r = await httpJson<{ id: string; url: string; readyState: string }>(
      `${API}/v13/deployments${teamQuery()}`,
      {
        method: "POST",
        headers: headers(),
        body: {
          name: id,
          project: id,
          target: p.target || "production",
          gitSource: p.gitRef
            ? { type: "github", ref: p.gitRef }
            : undefined,
        },
      },
    );
    return ok(
      { id: r.body.id, url: r.body.url, state: r.body.readyState },
      `Triggered ${p.target || "production"} deploy ${r.body.id}`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "triggerDeploy failed");
    return fail(`triggerDeploy failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Promotes a preview deployment to production (aliases prod domain).
 */
export async function promotePreviewToProd(p: {
  deploymentId: string;
}): Promise<OpsResult<{ promoted: boolean }>> {
  try {
    const r = await httpJson<{ uid?: string }>(
      `${API}/v10/projects/${projectId()}/promote/${encodeURIComponent(p.deploymentId)}${teamQuery()}`,
      { method: "POST", headers: headers() },
    );
    return ok(
      { promoted: true },
      `Promoted ${p.deploymentId} to production${r.body?.uid ? ` (${r.body.uid})` : ""}`,
    );
  } catch (e) {
    return fail(`promotePreviewToProd failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Rolls production back to a prior deployment.
 */
export async function rollback(p: {
  deploymentId: string;
}): Promise<OpsResult<{ rolledBackTo: string }>> {
  try {
    await httpJson(
      `${API}/v9/projects/${projectId()}/rollback/${encodeURIComponent(p.deploymentId)}${teamQuery()}`,
      { method: "POST", headers: headers() },
    );
    return ok(
      { rolledBackTo: p.deploymentId },
      `Rolled production back to ${p.deploymentId}`,
    );
  } catch (e) {
    return fail(`rollback failed: ${errMessage(e)}`);
  }
}

/** Read project env var names (values returned decrypted only if token allows). */
export async function getEnvVars(p: {
  project?: string;
}): Promise<OpsResult<Array<{ key: string; target: string[]; type: string }>>> {
  try {
    const r = await httpJson<{
      envs: Array<{ key: string; target: string[]; type: string }>;
    }>(`${API}/v9/projects/${projectId(p.project)}/env${teamQuery()}`, {
      headers: headers(),
    });
    const envs = (r.body.envs || []).map((e) => ({
      key: e.key,
      target: e.target,
      type: e.type,
    }));
    return ok(envs, `${envs.length} env var(s)`);
  } catch (e) {
    return fail(`getEnvVars failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Creates/updates a project env var (changes runtime config).
 */
export async function setEnvVar(p: {
  project?: string;
  key: string;
  value: string;
  target?: Array<"production" | "preview" | "development">;
  type?: "encrypted" | "plain";
}): Promise<OpsResult<{ key: string }>> {
  try {
    await httpJson(
      `${API}/v10/projects/${projectId(p.project)}/env${teamQuery()}`,
      {
        method: "POST",
        headers: headers(),
        body: {
          key: p.key,
          value: p.value,
          type: p.type || "encrypted",
          target: p.target || ["production", "preview", "development"],
        },
      },
    );
    // Never log the value.
    return ok({ key: p.key }, `Set env var ${p.key}`);
  } catch (e) {
    return fail(`setEnvVar failed: ${errMessage(e)}`);
  }
}

/** Tail recent deployment events/logs (non-destructive). */
export async function tailLogs(p: {
  deploymentId?: string;
  limit?: number;
}): Promise<OpsResult<{ latestState: string; deploymentId: string }>> {
  try {
    let deploymentId = p.deploymentId;
    if (!deploymentId) {
      const list = await httpJson<{
        deployments: Array<{ uid: string; readyState: string }>;
      }>(
        `${API}/v6/deployments${teamQuery() ? teamQuery() + "&" : "?"}projectId=${projectId()}&limit=1`,
        { headers: headers() },
      );
      const latest = list.body.deployments?.[0];
      if (!latest) return fail("No deployments found");
      return ok(
        { latestState: latest.readyState, deploymentId: latest.uid },
        `Latest deploy ${latest.uid}: ${latest.readyState}`,
      );
    }
    const d = await httpJson<{ readyState: string }>(
      `${API}/v13/deployments/${encodeURIComponent(deploymentId)}${teamQuery()}`,
      { headers: headers() },
    );
    return ok(
      { latestState: d.body.readyState, deploymentId },
      `Deploy ${deploymentId}: ${d.body.readyState}`,
    );
  } catch (e) {
    return fail(`tailLogs failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  triggerDeploy: {
    meta: { tool: "vercel", action: "triggerDeploy", destructive: true, description: "Trigger a deployment" },
    run: (p) => triggerDeploy(p as unknown as Parameters<typeof triggerDeploy>[0]),
  },
  promotePreviewToProd: {
    meta: { tool: "vercel", action: "promotePreviewToProd", destructive: true, description: "Promote preview to production" },
    run: (p) => promotePreviewToProd(p as unknown as Parameters<typeof promotePreviewToProd>[0]),
  },
  rollback: {
    meta: { tool: "vercel", action: "rollback", destructive: true, description: "Roll production back" },
    run: (p) => rollback(p as unknown as Parameters<typeof rollback>[0]),
  },
  getEnvVars: {
    meta: { tool: "vercel", action: "getEnvVars", destructive: false, description: "List env var names" },
    run: (p) => getEnvVars(p as unknown as Parameters<typeof getEnvVars>[0]),
  },
  setEnvVar: {
    meta: { tool: "vercel", action: "setEnvVar", destructive: true, description: "Set an env var" },
    run: (p) => setEnvVar(p as unknown as Parameters<typeof setEnvVar>[0]),
  },
  tailLogs: {
    meta: { tool: "vercel", action: "tailLogs", destructive: false, description: "Tail latest deploy state" },
    run: (p) => tailLogs(p as unknown as Parameters<typeof tailLogs>[0]),
  },
};
