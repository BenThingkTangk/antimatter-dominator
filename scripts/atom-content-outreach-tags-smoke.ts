/**
 * Smoke test for the OUTREACH PROOF-LINKAGE TAG contract
 * (api/_lib/send-email.ts buildOutreachProofTags) and its round-trip through the
 * Resend delivery webhook's tag extraction (api/webhooks/resend.ts tagValue).
 *
 * This locks the contract that ties genuine outreach sends to attributed ATOM
 * Content `email_sent` proof:
 *   1. an outreach send (opt-in linkage) emits the EXACT Resend `{name,value}[]`
 *      tags the webhook extracts: prospect_id/campaign_id/account_id/
 *      tenant_id/user_id — values stringified, blanks/undefined dropped
 *   2. a transactional/lifecycle send (no linkage) emits NO proof tags — a
 *      delivered transactional email never becomes campaign proof
 *   3. the emitted tags, fed to the webhook's tagValue extraction, recover the
 *      same prospectId/campaignId/accountId/tenantId/userId PR #22 forwards
 *   4. partial linkage only emits the fields actually supplied (no fabrication)
 *
 * No DB, no network, no Resend key: it imports the pure tag builder and a faithful
 * copy of the webhook extractor. If these two drift, this test fails first.
 *
 * Run: `npx tsx scripts/atom-content-outreach-tags-smoke.ts`
 */
import { buildOutreachProofTags, type ResendTag } from "../api/_lib/send-email";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.error(`  FAIL ${msg}`); failures++; }
}

/**
 * Faithful copy of api/webhooks/resend.ts `tagValue` — the consumer side of the
 * contract. Kept in sync deliberately: if the webhook extraction changes, this
 * test should be updated in lockstep, which is the point of locking the contract.
 */
function tagValue(data: any, ...keys: string[]): string | undefined {
  const tags = data?.tags;
  let map: Record<string, string> = {};
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t.name === "string") map[t.name] = String(t.value ?? "");
    }
  } else if (tags && typeof tags === "object") {
    for (const [k, v] of Object.entries(tags)) map[k] = String(v ?? "");
  }
  for (const k of keys) {
    const v = map[k];
    if (v) return v;
  }
  return undefined;
}

function byName(tags: ResendTag[], name: string): string | undefined {
  return tags.find((t) => t.name === name)?.value;
}

function run() {
  // ── (1) outreach send emits the exact webhook-extracted tag names ───────────
  console.log("(1) outreach linkage → exact Resend {name,value}[] proof tags");
  {
    const tags = buildOutreachProofTags({
      prospectId: "p-1",
      campaignId: 42, // numbers are coerced to strings (Resend constraint)
      accountId: "acc-9",
      tenantId: "t-7",
      userId: "u-3",
    });
    assert(byName(tags, "prospect_id") === "p-1", "prospect_id tag present");
    assert(byName(tags, "campaign_id") === "42", "campaign_id stringified from number");
    assert(byName(tags, "account_id") === "acc-9", "account_id tag present");
    assert(byName(tags, "tenant_id") === "t-7", "tenant_id tag present");
    assert(byName(tags, "user_id") === "u-3", "user_id tag present");
    assert(tags.every((t) => typeof t.name === "string" && typeof t.value === "string"), "all tags are {string,string}");
    assert(tags.length === 5, `exactly the 5 linkage tags (got ${tags.length})`);
  }

  // ── (2) transactional send (no linkage) emits NO proof tags ─────────────────
  console.log("\n(2) transactional/lifecycle send → no proof-linkage tags");
  {
    assert(buildOutreachProofTags(undefined).length === 0, "undefined linkage → []");
    assert(buildOutreachProofTags({}).length === 0, "empty linkage → []");
    // blank / whitespace-only / null fields never fabricate a tag
    const tags = buildOutreachProofTags({ prospectId: "", campaignId: "   ", accountId: undefined });
    assert(tags.length === 0, `blank/whitespace/undefined → [] (got ${tags.length})`);
  }

  // ── (3) round-trip: emitted tags feed the webhook extractor PR #22 uses ──────
  console.log("\n(3) round-trip — emitted tags recover the same linkage in the Resend webhook");
  {
    const tags = buildOutreachProofTags({
      prospectId: "p-rt",
      campaignId: "c-rt",
      accountId: "a-rt",
      tenantId: "t-rt",
      userId: "u-rt",
    });
    // The webhook reads `data.tags` as `{name,value}[]` — exactly our shape.
    const data = { tags };
    assert(tagValue(data, "prospect_id", "prospectId") === "p-rt", "webhook recovers prospectId");
    assert(tagValue(data, "campaign_id", "campaignId") === "c-rt", "webhook recovers campaignId");
    assert(tagValue(data, "account_id", "accountId") === "a-rt", "webhook recovers accountId");
    assert(tagValue(data, "tenant_id", "tenantId") === "t-rt", "webhook recovers tenantId");
    assert(tagValue(data, "user_id", "userId") === "u-rt", "webhook recovers userId");
  }

  // ── (4) partial linkage → only the supplied fields, no fabrication ──────────
  console.log("\n(4) partial linkage — only supplied fields emitted (never fabricated)");
  {
    const tags = buildOutreachProofTags({ prospectId: "p-only", campaignId: "c-only" });
    assert(tags.length === 2, `only the 2 supplied tags (got ${tags.length})`);
    const data = { tags };
    assert(tagValue(data, "prospect_id") === "p-only", "supplied prospect_id recovered");
    assert(tagValue(data, "campaign_id") === "c-only", "supplied campaign_id recovered");
    assert(tagValue(data, "account_id") === undefined, "unsupplied account_id absent (not fabricated)");
    assert(tagValue(data, "tenant_id") === undefined, "unsupplied tenant_id absent");
    assert(tagValue(data, "user_id") === undefined, "unsupplied user_id absent");
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"}`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
