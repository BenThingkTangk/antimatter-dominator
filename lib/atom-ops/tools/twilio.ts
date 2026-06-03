/**
 * Twilio tool — REST API via fetch (Basic auth with Account SID + auth token).
 * The `twilio` SDK is listed in package.json; REST keeps this import-safe.
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN.
 */
import { getEnv } from "../env";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.twilio.com/2010-04-01";
const log = logger.child({ tool: "twilio" });

function auth(): { sid: string; header: Record<string, string> } {
  const sid = getEnv("TWILIO_ACCOUNT_SID", true);
  const token = getEnv("TWILIO_AUTH_TOKEN", true);
  const basic = Buffer.from(`${sid}:${token}`).toString("base64");
  return { sid, header: { Authorization: `Basic ${basic}` } };
}

function form(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) usp.append(k, v);
  return usp.toString();
}

async function twilioGet<T>(path: string): Promise<T> {
  const { header } = auth();
  const res = await fetch(`${API}${path}`, { headers: header });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/** Check health of provisioned numbers (count + capabilities). Non-destructive. */
export async function checkNumberHealth(): Promise<
  OpsResult<{ total: number; voiceEnabled: number; smsEnabled: number }>
> {
  try {
    const { sid } = auth();
    const r = await twilioGet<{
      incoming_phone_numbers: Array<{
        capabilities: { voice: boolean; sms: boolean };
      }>;
    }>(`/Accounts/${sid}/IncomingPhoneNumbers.json?PageSize=1000`);
    const nums = r.incoming_phone_numbers || [];
    const voice = nums.filter((n) => n.capabilities?.voice).length;
    const sms = nums.filter((n) => n.capabilities?.sms).length;
    return ok(
      { total: nums.length, voiceEnabled: voice, smsEnabled: sms },
      `${nums.length} number(s): ${voice} voice, ${sms} sms`,
    );
  } catch (e) {
    log.error({ err: errMessage(e) }, "checkNumberHealth failed");
    return fail(`checkNumberHealth failed: ${errMessage(e)}`);
  }
}

/** Look up a call by SID (non-destructive). */
export async function lookupCallSID(p: {
  callSid: string;
}): Promise<
  OpsResult<{ sid: string; status: string; to: string; from: string; duration: string } | null>
> {
  try {
    const { sid } = auth();
    const r = await twilioGet<{
      sid: string;
      status: string;
      to: string;
      from: string;
      duration: string;
    }>(`/Accounts/${sid}/Calls/${encodeURIComponent(p.callSid)}.json`);
    return ok(
      { sid: r.sid, status: r.status, to: r.to, from: r.from, duration: r.duration },
      `Call ${r.sid}: ${r.status} (${r.duration}s)`,
    );
  } catch (e) {
    return fail(`lookupCallSID failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Replays an outbound call — places a NEW call to the original
 * recipient. Mutating + bills + dials a real person; always confirmation-gated.
 */
export async function replayOutboundCall(p: {
  callSid: string;
  twimlUrl?: string;
}): Promise<OpsResult<{ newCallSid: string }>> {
  try {
    const { sid, header } = auth();
    const original = await twilioGet<{ to: string; from: string }>(
      `/Accounts/${sid}/Calls/${encodeURIComponent(p.callSid)}.json`,
    );
    const twiml = p.twimlUrl || getEnv("ATOM_OPS_TWILIO_REPLAY_TWIML_URL");
    if (!twiml) {
      return fail("No TwiML URL — pass twimlUrl or set ATOM_OPS_TWILIO_REPLAY_TWIML_URL");
    }
    const res = await fetch(`${API}/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        ...header,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({ To: original.to, From: original.from, Url: twiml }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${text.slice(0, 300)}`);
    const created = JSON.parse(text) as { sid: string };
    return ok({ newCallSid: created.sid }, `Replayed call as ${created.sid}`);
  } catch (e) {
    return fail(`replayOutboundCall failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  checkNumberHealth: {
    meta: { tool: "twilio", action: "checkNumberHealth", destructive: false, description: "Check number health" },
    run: () => checkNumberHealth(),
  },
  lookupCallSID: {
    meta: { tool: "twilio", action: "lookupCallSID", destructive: false, description: "Look up a call by SID" },
    run: (p) => lookupCallSID(p as unknown as Parameters<typeof lookupCallSID>[0]),
  },
  replayOutboundCall: {
    meta: { tool: "twilio", action: "replayOutboundCall", destructive: true, description: "Replay an outbound call" },
    run: (p) => replayOutboundCall(p as unknown as Parameters<typeof replayOutboundCall>[0]),
  },
};
