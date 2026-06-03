/**
 * Email tool — Postmark REST. draftEmail is non-destructive (returns a payload
 * for review); sendEmail actually dispatches and is destructive.
 *
 * Env: POSTMARK_SERVER_TOKEN, ATOM_OPS_EMAIL_FROM.
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.postmarkapp.com";
const log = logger.child({ tool: "email" });

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  from: string;
}

/** Build (but do not send) an email payload for review. Non-destructive. */
export async function draftEmail(p: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<OpsResult<EmailDraft>> {
  const from = p.from || getEnv("ATOM_OPS_EMAIL_FROM") || "ops@example.com";
  const draft: EmailDraft = {
    to: p.to,
    subject: p.subject,
    body: p.body,
    from,
  };
  return ok(draft, `Drafted email to ${p.to}: "${p.subject}"`);
}

/**
 * @destructive Sends an email via Postmark (leaves the building, visible to a
 * real recipient).
 */
export async function sendEmail(p: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  html?: string;
}): Promise<OpsResult<{ messageId: string }>> {
  try {
    const token = getEnv("POSTMARK_SERVER_TOKEN", true);
    const from = p.from || getEnv("ATOM_OPS_EMAIL_FROM", true);
    const r = await httpJson<{ MessageID: string }>(`${API}/email`, {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": token,
        Accept: "application/json",
      },
      body: {
        From: from,
        To: p.to,
        Subject: p.subject,
        TextBody: p.body,
        ...(p.html ? { HtmlBody: p.html } : {}),
        MessageStream: "outbound",
      },
    });
    return ok({ messageId: r.body.MessageID }, `Sent email to ${p.to}`);
  } catch (e) {
    log.error({ err: errMessage(e) }, "sendEmail failed");
    return fail(`sendEmail failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  draftEmail: {
    meta: { tool: "email", action: "draftEmail", destructive: false, description: "Draft an email" },
    run: (p) => draftEmail(p as unknown as Parameters<typeof draftEmail>[0]),
  },
  sendEmail: {
    meta: { tool: "email", action: "sendEmail", destructive: true, description: "Send an email" },
    run: (p) => sendEmail(p as unknown as Parameters<typeof sendEmail>[0]),
  },
};
