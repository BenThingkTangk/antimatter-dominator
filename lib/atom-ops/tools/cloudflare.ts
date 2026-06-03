/**
 * Cloudflare DNS tool — API v4 via fetch.
 * Env: CLOUDFLARE_API_TOKEN, ATOM_OPS_CLOUDFLARE_ZONE_ID.
 */
import { getEnv } from "../env";
import { httpJson } from "../http";
import { logger } from "../logger";
import { errMessage, fail, ok, type OpsResult, type ToolAction } from "../types";

const API = "https://api.cloudflare.com/client/v4";
const log = logger.child({ tool: "cloudflare" });

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${getEnv("CLOUDFLARE_API_TOKEN", true)}` };
}

function zone(explicit?: string): string {
  const z = explicit || getEnv("ATOM_OPS_CLOUDFLARE_ZONE_ID");
  if (!z) throw new Error("Set ATOM_OPS_CLOUDFLARE_ZONE_ID or pass zoneId");
  return z;
}

/** Read DNS records (non-destructive). */
export async function readDNSRecords(p: {
  zoneId?: string;
  type?: string;
  name?: string;
}): Promise<
  OpsResult<Array<{ id: string; type: string; name: string; content: string; proxied: boolean }>>
> {
  try {
    const q = new URLSearchParams();
    if (p.type) q.set("type", p.type);
    if (p.name) q.set("name", p.name);
    const r = await httpJson<{
      result: Array<{
        id: string;
        type: string;
        name: string;
        content: string;
        proxied: boolean;
      }>;
    }>(`${API}/zones/${zone(p.zoneId)}/dns_records?${q.toString()}`, {
      headers: headers(),
    });
    const records = (r.body.result || []).map((d) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      content: d.content,
      proxied: d.proxied,
    }));
    return ok(records, `${records.length} DNS record(s)`);
  } catch (e) {
    log.error({ err: errMessage(e) }, "readDNSRecords failed");
    return fail(`readDNSRecords failed: ${errMessage(e)}`);
  }
}

/**
 * @destructive Creates or updates a DNS record (changes live traffic routing).
 * Updates when recordId is provided, otherwise creates.
 */
export async function writeDNSRecord(p: {
  zoneId?: string;
  recordId?: string;
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}): Promise<OpsResult<{ id: string; name: string }>> {
  try {
    const body = {
      type: p.type,
      name: p.name,
      content: p.content,
      ttl: p.ttl ?? 1,
      proxied: p.proxied ?? false,
    };
    const url = p.recordId
      ? `${API}/zones/${zone(p.zoneId)}/dns_records/${p.recordId}`
      : `${API}/zones/${zone(p.zoneId)}/dns_records`;
    const r = await httpJson<{ result: { id: string; name: string } }>(url, {
      method: p.recordId ? "PUT" : "POST",
      headers: headers(),
      body,
    });
    return ok(
      { id: r.body.result.id, name: r.body.result.name },
      `${p.recordId ? "Updated" : "Created"} DNS ${p.type} ${p.name}`,
    );
  } catch (e) {
    return fail(`writeDNSRecord failed: ${errMessage(e)}`);
  }
}

export const tools: Record<string, ToolAction> = {
  readDNSRecords: {
    meta: { tool: "cloudflare", action: "readDNSRecords", destructive: false, description: "Read DNS records" },
    run: (p) => readDNSRecords(p as unknown as Parameters<typeof readDNSRecords>[0]),
  },
  writeDNSRecord: {
    meta: { tool: "cloudflare", action: "writeDNSRecord", destructive: true, description: "Write a DNS record" },
    run: (p) => writeDNSRecord(p as unknown as Parameters<typeof writeDNSRecord>[0]),
  },
};
