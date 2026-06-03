# ATOM Sales OS — Launch Hardening Runbook

Operational checklist for taking ATOM Sales OS / Sales Dominator to a paid MVP
and (separately, later) to live autonomous outbound dialing. Maintained across
the P0 hardening sprints.

> **Two gates, not one.** "Paid MVP launch" and "live autonomous dialing" are
> separate go/no-go decisions. You can ship the paid product with dialing kept
> in manual/demo mode. Do **not** flip on broad autonomous dialing until the
> Live-Dialing checklist below is fully green.

---

## 1. Required environment variables

### Core (must be set for any production deploy)
| Var | Purpose | Failure mode if missing |
| --- | --- | --- |
| `SUPABASE_URL` | Primary datastore | Auth, sessions, billing all fail |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access | Same as above |
| `STRIPE_SECRET_KEY` | Billing / checkout | Signup + billing fail |
| `STRIPE_WEBHOOK_SECRET` | **Verifies Stripe webhooks.** Webhook handler fails **closed** in production if unset (sprint 1). | Subscription state never updates → entitlement drift |
| `CRON_SECRET` | Authenticates Vercel cron jobs. Required in production (sprint 1). | Cron endpoints reject all calls / are exploitable |
| `ADMIN_API_KEY` | Server-to-server auth for compliance + QA probes. | **Dial gate fails closed** (no dials) and admin endpoints reject |

### Compliance / dialing (required before LIVE dialing)
| Var | Purpose | Default behavior |
| --- | --- | --- |
| `ADMIN_API_KEY` | Used by `/api/atom-leadgen/call` to call the pre-dial gate. | Missing → every dial blocked |
| `ATOM_DIAL_FALLBACK_MODE` | `block` (default) or `manual_review`. Controls behavior when the compliance service errors/times out. **Never auto-allows.** | `block` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (or `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET`) | Outbound telephony | Dial returns 500 (no call) |
| `TWILIO_PHONE_NUMBER` | Caller ID | Dial returns 500 |
| `HUME_API_KEY`, `HUME_CONFIG_ID` | Voice agent | Dial returns 500 |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | FCC AI-disclosure clip (optional; falls back to in-prompt disclosure) | Disclosure played via Hume prompt instead |

> ⚠️ **There is no real third-party DNC/consent vendor integration yet.** The
> pre-dial gate (`/api/compliance/pre-dial-check`) evaluates consent/DNC against
> **our own Supabase tables** (`consent_ledger`, `dnc_entries`, `predial_checks`).
> Those tables must be populated with real consent + scrubbed DNC data before
> live dialing is lawful. Until then, keep dialing in demo/manual mode. The gate
> will correctly **block** any number with no consent on file.

### Rate-limit store (recommended for production)
| Var | Purpose | Default behavior |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Distributed rate-limit counter | If unset, falls back to **per-lambda in-memory** limiting (best-effort only) |
| `UPSTASH_REDIS_REST_TOKEN` | Auth for Upstash REST | Same |

> The in-memory fallback throttles a single warm Vercel instance but does **not**
> share state across concurrent instances. Configure Upstash for a hard
> distributed limit. See the TODO in `api/_lib/rate-limit.ts`.

### Optional / enrichment
`APOLLO_API_KEY`, `PERPLEXITY_API_KEY`, `OPENAI_API_KEY`, `PINECONE_API_KEY`,
`HUME_CONFIG_GPT5`, `GPT5_MIN_DEAL_VALUE`, `RAG_URL`, `NIRMATA_HQ_EMAILS`.

---

## 2. Database migrations / backfill

Run in Supabase SQL editor (idempotent unless noted):

1. `sql/010-compliance-tables.sql` — `compliance_blocks`, `compliance_audit_log`,
   `consent_ledger`, `dnc_entries`, `predial_checks`. **Required** — the dial
   gate writes blocked/queued dials to `compliance_blocks`.
2. `sql/011-campaign-tenant-scope.sql` — adds `atom_campaigns.tenant_id`.
   - **Backfill required:** pre-existing campaigns have `tenant_id = NULL` and
     are invisible to the now tenant-scoped endpoints (`/api/campaigns/*`,
     `/api/campaigns/[id]/launch-dials`). Backfill:
     ```sql
     update atom_campaigns set tenant_id = '<tenant-uuid>' where tenant_id is null;
     ```
   - Consider `alter table atom_campaigns alter column tenant_id set not null;`
     once backfilled.
3. Ensure `usage_events` exists (used by entitlements). If absent, entitlement
   checks fail **open** for metered caps (documented in `api/_rules/entitlements.ts`).

Before live dialing, also populate:
- `consent_ledger` with real PEWC / express-written consent per prospect phone.
- `dnc_entries` with federal + state + internal + litigator DNC data.

---

## 3. What changed in Sprint 2 (this PR)

- **Fail-closed dial gate** (`api/_lib/dial-gate.ts`, wired into
  `api/atom-leadgen/call.ts`). A real outbound call is placed **only** on an
  explicit `allowed: true` from the compliance check. Missing tenant, missing
  admin key, vendor timeout/error, malformed response, or an explicit block all
  prevent the dial and are logged to `compliance_blocks`. Replaces the previous
  fail-**open** behavior.
- **Rate limiting** (`api/_lib/rate-limit.ts`) applied to: auth login/signup/
  reset/reset-confirm, dial, AI pitch/objection/market-intent, prospect
  scan/enrich, atom-chat, embeddings, rag, targets generate-package, launch-dials.
- **Auth sweep**: added session (or admin-key) auth + tenant scoping to
  previously-public cost endpoints: `prospects/scan`, `prospects/enrich`,
  `atom-chat`, `embeddings`, `rag` (delete requires admin key),
  `targets/generate-package`, and `campaigns/[id]/launch-dials` (now tenant-scoped
  and using the correct `atom_campaigns` table).
- **Typecheck backlog** reduced 82 → 68 (added `target: ES2020` and a minimal
  `bcryptjs` ambient type; both backend-relevant).
- **Smoke tests**: `npm run smoke` (dial-gate fail-closed + rate-limit). Wired
  into CI as a hard gate.

---

## 4. Go / no-go checklists

### Paid MVP launch
- [ ] All Core env vars set in production.
- [ ] `STRIPE_WEBHOOK_SECRET` + `CRON_SECRET` set (handlers fail closed without them).
- [ ] Migrations 010 + 011 applied; `atom_campaigns.tenant_id` backfilled.
- [ ] `usage_events` table exists (entitlement caps enforce).
- [ ] `UPSTASH_REDIS_*` set (or accept best-effort in-memory limiting).
- [ ] `npm run build` green; `npm run smoke` green.
- [ ] Dialing kept in **demo/manual** mode (do not enable autonomous batch dials).

### Live autonomous dialing (separate, later gate)
- [ ] Real DNC + consent data loaded into `dnc_entries` / `consent_ledger`, OR a
      real third-party DNC/consent vendor integrated behind `pre-dial-check`.
- [ ] `ADMIN_API_KEY` set; confirm `npm run smoke:dial-gate` passes in the
      deployed environment.
- [ ] `ATOM_DIAL_FALLBACK_MODE` decision made (`block` recommended for launch).
- [ ] Quiet-hours, state caps, and attempt caps reviewed with counsel.
- [ ] FCC AI-disclosure verified to play in first 5s of every call.
- [ ] Distributed rate limiting (Upstash) live — in-memory is not sufficient for
      a hard dialing cap.
- [ ] Monitoring/alerting on `compliance_blocks.infraError = true` (vendor down).

---

## 5. Known remaining blockers / risks

- **No real compliance vendor** — gate trusts our own Supabase consent/DNC data.
  Lawful live dialing requires that data to be real and current.
- **In-memory rate-limit fallback** is per-instance; not a hard boundary without Upstash.
- **Typecheck still ~68 errors** (mostly lucide-react icon `size` prop typing in
  admin UI). Non-blocking; `check` stays `continue-on-error` in CI.
- **`launch-dials` is count-only** — it does not place calls. Any future batch
  orchestrator MUST route every number through `/api/atom-leadgen/call` (and thus
  the fail-closed gate).
- **npm audit**: 23 advisories remain (12 moderate, 11 high) as of this sprint.
  No safe non-breaking fix was applied — `npm audit fix` (non-force) resolves
  **zero** of them while adding ~173 transitive/optional packages, and every real
  fix requires a `--force` major bump. Breakdown:
  - **Transitive, need major bumps (deferred):** `axios` (via twilio etc.),
    `ajv`/`path-to-regexp`/`undici` (via `@vercel/node`), `ws`+`uuid` (via
    `hume`/`@humeai/voice-react`), `vite` (dev-only), `brace-expansion`,
    `drizzle-orm`. None reachable from a safe semver-compatible upgrade.
  - **No fix available:** `xlsx` (SheetJS prototype-pollution + ReDoS). Used for
    spreadsheet import/export. Mitigation: only parse trusted/admin-uploaded
    files; consider migrating off SheetJS or pinning a patched fork before
    exposing import to untrusted users.
  Recommendation: schedule a dedicated dependency-upgrade PR (with build + smoke
  re-run) rather than bundle major bumps into this launch-safety PR.
