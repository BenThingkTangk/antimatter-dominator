/**
 * Akamai / Linode (GPU compute) tool — Linode API v4 via fetch.
 * Linode is an Akamai company; GPU nodes are Linode instances.
 *
 * Env: LINODE_API_TOKEN.
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.linode.com/v4";
const log = logger.child({ tool: "akamai" });

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${getEnv("LINODE_API_TOKEN", true)}` };
}

/**
 * @destructive Reboots a GPU node (interrupts running workloads).
 */
export async function restartGPUNode(p: {
  linodeId: number;
}): Promise<OpsResult<{ linodeId: number; rebooting: boolean }>> {
  try {
    await httpJson(`${API}/linode/instances/${p.linodeId}/reboot`, {
      method: "POST",
      headers: headers(),
      body: {},
    });
    return ok(
      { linodeId: p.linodeId, rebooting: true },
      `Reboot requested for node ${p.linodeId}`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "restartGPUNode failed");
    return fail(`restartGPUNode failed: ${errMessage(e)}`);
  }
}

/** Check node utilization (CPU stats). Non-destructive. */
export async function checkUtilization(p: {
  linodeId: number;
}): Promise<OpsResult<{ linodeId: number; status: string; cpuPoints: number }>> {
  try {
    const info = await httpJson<{ status: string }>(
      `${API}/linode/instances/${p.linodeId}`,
      { headers: headers() },
    );
    const stats = await httpJson<{ data: { cpu: number[][] } }>(
      `${API}/linode/instances/${p.linodeId}/stats`,
      { headers: headers(), throwOnError: false },
    );
    const cpuPoints = stats.body?.data?.cpu?.length ?? 0;
    return ok(
      { linodeId: p.linodeId, status: info.body.status, cpuPoints },
      `Node ${p.linodeId}: ${info.body.status}, ${cpuPoints} cpu samples`,
    );
  } catch (e) {
    return fail(`checkUtilization failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Resizes a node to a new plan type (reboots + bills differently).
 */
export async function scaleNode(p: {
  linodeId: number;
  type: string;
}): Promise<OpsResult<{ linodeId: number; type: string }>> {
  try {
    await httpJson(`${API}/linode/instances/${p.linodeId}/resize`, {
      method: "POST",
      headers: headers(),
      body: { type: p.type },
    });
    return ok(
      { linodeId: p.linodeId, type: p.type },
      `Resizing node ${p.linodeId} → ${p.type}`,
    );
  } catch (e) {
    return fail(`scaleNode failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  restartGPUNode: {
    meta: { tool: "akamai", action: "restartGPUNode", destructive: true, description: "Reboot a GPU node" },
    run: (p) => restartGPUNode(p as unknown as Parameters<typeof restartGPUNode>[0]),
  },
  checkUtilization: {
    meta: { tool: "akamai", action: "checkUtilization", destructive: false, description: "Check node utilization" },
    run: (p) => checkUtilization(p as unknown as Parameters<typeof checkUtilization>[0]),
  },
  scaleNode: {
    meta: { tool: "akamai", action: "scaleNode", destructive: true, description: "Resize a node" },
    run: (p) => scaleNode(p as unknown as Parameters<typeof scaleNode>[0]),
  },
};
