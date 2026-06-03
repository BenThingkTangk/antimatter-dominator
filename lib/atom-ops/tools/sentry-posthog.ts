/**
 * Sentry + PostHog tool — both via REST.
 *
 * Env:
 *   SENTRY_AUTH_TOKEN, ATOM_OPS_SENTRY_ORG, ATOM_OPS_SENTRY_PROJECT
 *   POSTHOG_API_KEY (personal), ATOM_OPS_POSTHOG_PROJECT_ID, ATOM_OPS_POSTHOG_HOST
 *   ATOM_OPS_STATUSPAGE_API_KEY, ATOM_OPS_STATUSPAGE_PAGE_ID (optional, for incidents)
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const SENTRY_API = "https://sentry.io/api/0";
const log = logger.child({ tool: "sentry-posthog" });

function sentryHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getEnv("SENTRY_AUTH_TOKEN", true)}` };
}

/** Read recent unresolved Sentry issues (non-destructive). */
export async function readSentryErrors(p: {
  limit?: number;
}): Promise<
  OpsResult<Array<{ id: string; title: string; count: string; level: string }>>
> {
  try {
    const org = getEnv("ATOM_OPS_SENTRY_ORG", true);
    const project = getEnv("ATOM_OPS_SENTRY_PROJECT", true);
    const limit = Math.min(p.limit ?? 10, 100);
    const r = await httpJson<
      Array<{ id: string; title: string; count: string; level: string }>
    >(
      `${SENTRY_API}/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=24h&limit=${limit}`,
      { headers: sentryHeaders() },
    );
    const issues = (r.body || []).map((i) => ({
      id: i.id,
      title: i.title,
      count: i.count,
      level: i.level,
    }));
    return ok(issues, `${issues.length} unresolved Sentry issue(s) in 24h`);
  } catch (e) {
    log.error({ err: errMessage(e) }, "readSentryErrors failed");
    return fail(`readSentryErrors failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Acknowledges (resolves) a Sentry issue alert.
 */
export async function acknowledgeAlert(p: {
  issueId: string;
}): Promise<OpsResult<{ issueId: string; status: string }>> {
  try {
    const r = await httpJson<{ status: string }>(
      `${SENTRY_API}/issues/${encodeURIComponent(p.issueId)}/`,
      {
        method: "PUT",
        headers: sentryHeaders(),
        body: { status: "resolved" },
      },
    );
    return ok(
      { issueId: p.issueId, status: r.body.status },
      `Acknowledged Sentry issue ${p.issueId}`,
    );
  } catch (e) {
    return fail(`acknowledgeAlert failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Posts a public status-page incident (visible to customers).
 * Requires Statuspage.io credentials; no-ops with a clear message otherwise.
 */
export async function postStatusIncident(p: {
  name: string;
  status?: "investigating" | "identified" | "monitoring" | "resolved";
  body?: string;
}): Promise<OpsResult<{ id: string | null; posted: boolean }>> {
  try {
    const apiKey = getEnv("ATOM_OPS_STATUSPAGE_API_KEY");
    const pageId = getEnv("ATOM_OPS_STATUSPAGE_PAGE_ID");
    if (!apiKey || !pageId) {
      return ok(
        { id: null, posted: false },
        "Statuspage not configured — incident not posted (set ATOM_OPS_STATUSPAGE_*)",
      );
    }
    const r = await httpJson<{ id: string }>(
      `https://api.statuspage.io/v1/pages/${pageId}/incidents`,
      {
        method: "POST",
        headers: { Authorization: `OAuth ${apiKey}` },
        body: {
          incident: {
            name: p.name,
            status: p.status || "investigating",
            body: p.body || "",
          },
        },
      },
    );
    return ok({ id: r.body.id, posted: true }, `Posted incident ${r.body.id}`);
  } catch (e) {
    return fail(`postStatusIncident failed: ${errMessage(e)}`);
  }
}

/**
 * Read top user complaints from PostHog (e.g. a "complaint" or "feedback"
 * event), aggregated. Non-destructive.
 */
export async function getTopUserComplaints(p: {
  event?: string;
  days?: number;
}): Promise<OpsResult<{ total: number; event: string }>> {
  try {
    const host = getEnv("ATOM_OPS_POSTHOG_HOST") || "https://us.posthog.com";
    const projectId = getEnv("ATOM_OPS_POSTHOG_PROJECT_ID", true);
    const apiKey = getEnv("POSTHOG_API_KEY", true);
    const event = p.event || "feedback_submitted";
    const days = p.days ?? 7;
    const query = {
      query: {
        kind: "HogQLQuery",
        query: `select count() from events where event = {event} and timestamp > now() - interval {days} day`,
        values: { event, days },
      },
    };
    const r = await httpJson<{ results: Array<Array<number>> }>(
      `${host}/api/projects/${projectId}/query/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: query,
      },
    );
    const total = r.body.results?.[0]?.[0] ?? 0;
    return ok({ total, event }, `${total} '${event}' event(s) in ${days}d`);
  } catch (e) {
    return fail(`getTopUserComplaints failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  readSentryErrors: {
    meta: { tool: "sentry", action: "readSentryErrors", destructive: false, description: "Read Sentry errors" },
    run: (p) => readSentryErrors(p as unknown as Parameters<typeof readSentryErrors>[0]),
  },
  acknowledgeAlert: {
    meta: { tool: "sentry", action: "acknowledgeAlert", destructive: true, description: "Resolve a Sentry alert" },
    run: (p) => acknowledgeAlert(p as unknown as Parameters<typeof acknowledgeAlert>[0]),
  },
  postStatusIncident: {
    meta: { tool: "sentry", action: "postStatusIncident", destructive: true, description: "Post a status incident" },
    run: (p) => postStatusIncident(p as unknown as Parameters<typeof postStatusIncident>[0]),
  },
  getTopUserComplaints: {
    meta: { tool: "posthog", action: "getTopUserComplaints", destructive: false, description: "Top user complaints" },
    run: (p) => getTopUserComplaints(p as unknown as Parameters<typeof getTopUserComplaints>[0]),
  },
};
