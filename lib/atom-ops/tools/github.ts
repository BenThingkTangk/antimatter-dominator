/**
 * GitHub tool — REST v3 via fetch (no SDK hard-dependency; @octokit/rest is
 * listed in package.json for callers who prefer it, but REST keeps the
 * serverless bundle small and avoids import-time failures).
 *
 * Env: GITHUB_TOKEN (PAT or app token), ATOM_OPS_GITHUB_REPO ("owner/repo").
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.github.com";
const log = logger.child({ tool: "github" });

interface RepoRef {
  owner: string;
  repo: string;
}

function resolveRepo(explicit?: string): RepoRef {
  const raw = explicit || getEnv("ATOM_OPS_GITHUB_REPO") || "";
  const [owner, repo] = raw.split("/");
  if (!owner || !repo) {
    throw new Error(
      "GitHub repo not set — pass repo:'owner/name' or set ATOM_OPS_GITHUB_REPO",
    );
  }
  return { owner, repo };
}

function headers(): Record<string, string> {
  const token = getEnv("GITHUB_TOKEN", true);
  return {
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "atom-ops",
  };
}

export interface PullRequestParams {
  repo?: string;
  title: string;
  head: string;
  base?: string;
  body?: string;
  draft?: boolean;
}

/** Create a pull request. */
export async function createPR(
  p: PullRequestParams,
): Promise<OpsResult<{ number: number; url: string }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const r = await httpJson<{ number: number; html_url: string }>(
      `${API}/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: headers(),
        body: {
          title: p.title,
          head: p.head,
          base: p.base || "main",
          body: p.body || "",
          draft: p.draft ?? false,
        },
      },
    );
    return ok(
      { number: r.body.number, url: r.body.html_url },
      `Opened PR #${r.body.number}: ${p.title}`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "createPR failed");
    return fail(`createPR failed: ${errMessage(e)}`);
  }
}

/** Comment on an issue or PR. */
export async function commentOnIssue(p: {
  repo?: string;
  issueNumber: number;
  body: string;
}): Promise<OpsResult<{ id: number; url: string }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const r = await httpJson<{ id: number; html_url: string }>(
      `${API}/repos/${owner}/${repo}/issues/${p.issueNumber}/comments`,
      { method: "POST", headers: headers(), body: { body: p.body } },
    );
    return ok(
      { id: r.body.id, url: r.body.html_url },
      `Commented on #${p.issueNumber}`,
    );
  } catch (e) {
    return fail(`commentOnIssue failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Merges a PR (mutates the default branch) once CI is green.
 * Polls check-runs on the PR head; merges only when all are successful.
 */
export async function mergePRAfterCI(p: {
  repo?: string;
  prNumber: number;
  mergeMethod?: "merge" | "squash" | "rebase";
  maxWaitMs?: number;
}): Promise<OpsResult<{ merged: boolean; sha?: string }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const pr = await httpJson<{ head: { sha: string }; mergeable_state: string }>(
      `${API}/repos/${owner}/${repo}/pulls/${p.prNumber}`,
      { headers: headers() },
    );
    const sha = pr.body.head.sha;
    const deadline = Date.now() + (p.maxWaitMs ?? 0);
    // One CI status read; if maxWaitMs given, poll a few times.
    let allGreen = false;
    do {
      const checks = await httpJson<{
        check_runs: Array<{ status: string; conclusion: string | null }>;
      }>(`${API}/repos/${owner}/${repo}/commits/${sha}/check-runs`, {
        headers: headers(),
      });
      const runs = checks.body.check_runs || [];
      allGreen =
        runs.length > 0 &&
        runs.every((c) => c.status === "completed" && c.conclusion === "success");
      if (allGreen || Date.now() >= deadline) break;
      await new Promise((r) => setTimeout(r, 5_000));
    } while (Date.now() < deadline);

    if (!allGreen) {
      return fail(`CI not green for PR #${p.prNumber}; refusing to merge`);
    }
    const merge = await httpJson<{ merged: boolean; sha: string }>(
      `${API}/repos/${owner}/${repo}/pulls/${p.prNumber}/merge`,
      {
        method: "PUT",
        headers: headers(),
        body: { merge_method: p.mergeMethod || "squash" },
      },
    );
    return ok(
      { merged: merge.body.merged, sha: merge.body.sha },
      `Merged PR #${p.prNumber} (${p.mergeMethod || "squash"})`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "mergePRAfterCI failed");
    return fail(`mergePRAfterCI failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Publishes a release (or draft). Draft by default to stay safe.
 */
export async function draftRelease(p: {
  repo?: string;
  tagName: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}): Promise<OpsResult<{ id: number; url: string }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const r = await httpJson<{ id: number; html_url: string }>(
      `${API}/repos/${owner}/${repo}/releases`,
      {
        method: "POST",
        headers: headers(),
        body: {
          tag_name: p.tagName,
          name: p.name || p.tagName,
          body: p.body || "",
          draft: p.draft ?? true,
          prerelease: p.prerelease ?? false,
        },
      },
    );
    return ok(
      { id: r.body.id, url: r.body.html_url },
      `${p.draft === false ? "Published" : "Drafted"} release ${p.tagName}`,
    );
  } catch (e) {
    return fail(`draftRelease failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Closes stale open issues (no update in `staleDays`).
 */
export async function closeStaleIssues(p: {
  repo?: string;
  staleDays?: number;
  limit?: number;
}): Promise<OpsResult<{ closed: number[] }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const staleDays = p.staleDays ?? 90;
    const limit = Math.min(p.limit ?? 25, 100);
    const cutoff = Date.now() - staleDays * 86_400_000;
    const list = await httpJson<
      Array<{ number: number; updated_at: string; pull_request?: unknown }>
    >(
      `${API}/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=asc&per_page=${limit}`,
      { headers: headers() },
    );
    const stale = (list.body || []).filter(
      (i) => !i.pull_request && new Date(i.updated_at).getTime() < cutoff,
    );
    const closed: number[] = [];
    for (const issue of stale) {
      await httpJson(`${API}/repos/${owner}/${repo}/issues/${issue.number}`, {
        method: "PATCH",
        headers: headers(),
        body: { state: "closed", state_reason: "not_planned" },
      });
      closed.push(issue.number);
    }
    return ok({ closed }, `Closed ${closed.length} stale issue(s)`);
  } catch (e) {
    return fail(`closeStaleIssues failed: ${errMessage(e)}`);
  }
}

/** Create a new issue. */
export async function postIssue(p: {
  repo?: string;
  title: string;
  body?: string;
  labels?: string[];
}): Promise<OpsResult<{ number: number; url: string }>> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const r = await httpJson<{ number: number; html_url: string }>(
      `${API}/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: headers(),
        body: { title: p.title, body: p.body || "", labels: p.labels || [] },
      },
    );
    return ok(
      { number: r.body.number, url: r.body.html_url },
      `Opened issue #${r.body.number}: ${p.title}`,
    );
  } catch (e) {
    return fail(`postIssue failed: ${errMessage(e)}`);
  }
}

/** List open pull requests (non-destructive). */
export async function listOpenPRs(p: {
  repo?: string;
  limit?: number;
}): Promise<
  OpsResult<Array<{ number: number; title: string; author: string; url: string }>>
> {
  try {
    const { owner, repo } = resolveRepo(p.repo);
    const limit = Math.min(p.limit ?? 20, 100);
    const r = await httpJson<
      Array<{
        number: number;
        title: string;
        user: { login: string };
        html_url: string;
      }>
    >(`${API}/repos/${owner}/${repo}/pulls?state=open&per_page=${limit}`, {
      headers: headers(),
    });
    const prs = (r.body || []).map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || "unknown",
      url: pr.html_url,
    }));
    return ok(prs, `${prs.length} open PR(s)`);
  } catch (e) {
    return fail(`listOpenPRs failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  createPR: {
    meta: { tool: "github", action: "createPR", destructive: false, description: "Open a pull request" },
    run: (p) => createPR(p as unknown as PullRequestParams),
  },
  commentOnIssue: {
    meta: { tool: "github", action: "commentOnIssue", destructive: false, description: "Comment on an issue/PR" },
    run: (p) => commentOnIssue(p as unknown as Parameters<typeof commentOnIssue>[0]),
  },
  mergePRAfterCI: {
    meta: { tool: "github", action: "mergePRAfterCI", destructive: true, description: "Merge a PR once CI is green" },
    run: (p) => mergePRAfterCI(p as unknown as Parameters<typeof mergePRAfterCI>[0]),
  },
  draftRelease: {
    meta: { tool: "github", action: "draftRelease", destructive: true, description: "Draft/publish a release" },
    run: (p) => draftRelease(p as unknown as Parameters<typeof draftRelease>[0]),
  },
  closeStaleIssues: {
    meta: { tool: "github", action: "closeStaleIssues", destructive: true, description: "Close stale open issues" },
    run: (p) => closeStaleIssues(p as unknown as Parameters<typeof closeStaleIssues>[0]),
  },
  postIssue: {
    meta: { tool: "github", action: "postIssue", destructive: false, description: "Open a new issue" },
    run: (p) => postIssue(p as unknown as Parameters<typeof postIssue>[0]),
  },
  listOpenPRs: {
    meta: { tool: "github", action: "listOpenPRs", destructive: false, description: "List open pull requests" },
    run: (p) => listOpenPRs(p as unknown as Parameters<typeof listOpenPRs>[0]),
  },
};
