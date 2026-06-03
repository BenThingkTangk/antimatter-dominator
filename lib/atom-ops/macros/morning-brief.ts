/**
 * Morning Brief macro — non-destructive daily snapshot.
 * Runs every data pull in PARALLEL, formats Markdown, and fires a notification
 * (Telegram + console badge). Zero destructive steps, zero confirmation needed.
 */
import { notify } from "../notify";
import { ok, type OpsContext, type OpsResult } from "../types";
import { listOpenPRs } from "../tools/github";
import { readSentryErrors } from "../tools/sentry-posthog";
import { lookupChurn, lookupMRR } from "../tools/stripe";
import { tailLogs } from "../tools/vercel";
import { checkNumberHealth } from "../tools/twilio";

export interface MorningBrief {
  markdown: string;
  generatedAt: string;
}

/** Resolve a settled result to a one-line status string. */
function line<T>(label: string, r: PromiseSettledResult<OpsResult<T>>): string {
  if (r.status === "rejected") return `- *${label}:* ⚠️ ${String(r.reason)}`;
  const v = r.value;
  return `- *${label}:* ${v.ok ? "" : "⚠️ "}${v.summary}`;
}

export async function runMorningBrief(context: OpsContext): Promise<OpsResult<MorningBrief>> {
  const [prs, sentry, mrr, churn, deploy, numbers] = await Promise.allSettled([
    listOpenPRs({ limit: 10 }),
    readSentryErrors({ limit: 5 }),
    lookupMRR(),
    lookupChurn(),
    tailLogs({}),
    checkNumberHealth(),
  ]);

  const generatedAt = new Date().toISOString();
  const markdown = [
    `*ATOM Ops — Morning Brief*`,
    `_${generatedAt}_`,
    `Requested by ${context.actorEmail}`,
    ``,
    line("Open PRs", prs),
    line("Sentry (24h)", sentry),
    line("MRR", mrr),
    line("Churn (30d)", churn),
    line("Latest deploy", deploy),
    line("Number health", numbers),
  ].join("\n");

  await notify(`Morning brief ready (${context.actorEmail})`);

  return ok({ markdown, generatedAt }, "Morning brief generated");
}
