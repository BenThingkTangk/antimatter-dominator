# ATOM OPS — Superadmin Digital Worker v1.0

A deterministic, superadmin-only operations cockpit for the antimatter-dominator
platform. Run platform actions by typing intents (`github.listOpenPRs`,
`/morning-brief`, `/release pr=12 tag=v1.2.0`) from a web console or Telegram.
Every mutating action follows **Plan → Confirm → Execute** and is written to a
tamper-evident audit log.

> **Stack note.** The original spec targets Next.js 14 App Router. This repo is a
> **Vite SPA + Express + Vercel serverless functions + Supabase (REST)** app, so
> paths were adapted while preserving the requested logic layout. See
> [Adaptation notes](#adaptation-notes).

---

## What was built

| Concern              | Location                                                        |
| -------------------- | --------------------------------------------------------------- |
| DB migration         | `sql/020-atom-ops-tables.sql`                                   |
| Orchestrator         | `lib/atom-ops/index.ts` (deterministic routing, zero LLM)       |
| Confirmations        | `lib/atom-ops/confirm.ts` (in-memory + optional Supabase, 5 min)|
| Audit log            | `lib/atom-ops/audit.ts` (SHA-256 hash chain)                    |
| Env helper           | `lib/atom-ops/env.ts` (`getEnv` — all env access)               |
| Logger               | `lib/atom-ops/logger.ts` (structured JSON, redacts secrets)     |
| Tools                | `lib/atom-ops/tools/*.ts`                                        |
| Macros               | `lib/atom-ops/macros/{morning-brief,release}.ts`                |
| Telegram bridge      | `lib/atom-ops/telegram-bridge.ts`                               |
| API: dispatch        | `api/atom-ops/route.ts`  → `POST /api/atom-ops/route`           |
| API: telegram        | `api/atom-ops/telegram.ts` → `POST /api/atom-ops/telegram`      |
| API: cron            | `api/atom-ops/cron.ts` → `GET /api/atom-ops/cron`               |
| Console UI           | `client/src/pages/atom-ops.tsx` (route `/ops`)                  |
| Workforce SDK        | `packages/atom-workforce-sdk/` (non-destructive subset)         |
| Cron schedule        | `vercel.json` (`/api/atom-ops/cron` @ `0 12 * * *`)             |
| Env template         | `.env.example`                                                  |

---

## Setup checklist

1. **Install deps** — `npm install` (adds `@octokit/rest`, `stripe`, `twilio`,
   `postmark`, `pino`, `nanoid` to `package.json`; the tools themselves call REST
   so they work even if a given SDK is absent).
2. **Apply the migration** — see [below](#apply-the-migration).
3. **Set env vars** — copy `.env.example` → `.env` (local) or set them in Vercel.
   Required for the gate: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NIRMATA_HQ_EMAILS`. Per-tool envs are only needed for the tools you use.
4. **Set `CRON_SECRET`** in Vercel so the cron route is protected.
5. **(Optional) Telegram** — create a bot, set `ATOM_OPS_TELEGRAM_*`, then
   [register the webhook](#telegram-setup).
6. **Deploy** — the cron is already declared in `vercel.json`.
7. **Open** `/ops` (hash route `#/ops`) as a superadmin.

---

## Apply the migration

This repo does **not** auto-apply Supabase migrations. Apply by hand:

```bash
# Option A — Supabase SQL editor: paste the contents of
#   sql/020-atom-ops-tables.sql  and run.

# Option B — psql against your Supabase connection string:
psql "$SUPABASE_DB_URL" -f sql/020-atom-ops-tables.sql
```

The migration creates `ops_audit_log`, `ops_macros`,
`ops_pending_confirmations`, the `public.is_superadmin()` helper, RLS policies,
and seeds the `morning-brief` and `release` macros.

`supabase.runApprovedMigration slug=atom-ops-tables` from the console will tell
you the file to apply (it refuses to run arbitrary SQL over HTTP by design).

---

## Security model

- **Superadmin only.** Resolved from the `atom_session` cookie →
  `user_sessions` → `tenant_users.email`, checked against `NIRMATA_HQ_EMAILS`.
  - API: returns **403 JSON** for non-superadmins (`lib/atom-ops/api-auth.ts`).
  - UI: `/ops` is wrapped in the repo's `SuperAdminOnly` guard, which bounces
    non-superadmins off the page.
- **Plan → Confirm → Execute.** Destructive actions never auto-run. The
  orchestrator returns a `ConfirmationPlan`; the operator confirms (console
  modal with countdown, or Telegram inline button) within **5 minutes**.
- **Append-only audit.** Every plan / execute / cancel / error writes to
  `ops_audit_log` with a SHA-256 chain (`entry_hash = sha256(prior_hash ||
  canonical_payload)`), plus a structured log line as a secondary record.
- **Secrets never logged.** The logger and audit writer redact token/secret/
  password/value keys.
- **Rate limit.** 60 requests / minute / session (and / Telegram chat).
- **Telegram double gate.** The webhook requires BOTH the secret-token header
  (constant-time compared) AND an allowlisted chat id.
- **Deterministic.** Routing is pure keyword matching — **zero LLM calls** in
  the hot path.
- **Least privilege for agents.** `@nirmata/atom-workforce-sdk` exports only
  non-destructive tools.

---

## Command examples

```text
github.listOpenPRs limit=10
github.createPR title="Fix login" head=fix/login base=main body="…"
github.postIssue title="Investigate 500s" labels=bug
stripe.lookupCustomer email=founder@acme.com
stripe.lookupMRR
supabase.getRowCounts tables=tenants,tenant_users
supabase.runRLSTestQuery table=ops_audit_log
sentry.readSentryErrors limit=5
cloudflare.readDNSRecords type=A

# Destructive — these return a confirmation first:
github.mergePRAfterCI prNumber=42
vercel.triggerDeploy target=production
stripe.issueRefund paymentIntentId=pi_123 reason=requested_by_customer
cloudflare.writeDNSRecord type=A name=app.example.com content=1.2.3.4

# Macros:
/morning-brief
/release pr=42 tag=v1.4.0
```

Confirm/cancel from the console modal, or via Telegram inline buttons.

---

## Telegram setup

1. Talk to **@BotFather**, create a bot, copy the token →
   `ATOM_OPS_TELEGRAM_BOT_TOKEN`.
2. Get your chat id (e.g. message **@userinfobot**) →
   `ATOM_OPS_TELEGRAM_ALLOWED_CHAT_ID`.
3. Generate a long random secret → `ATOM_OPS_TELEGRAM_SECRET_TOKEN`.
4. Register the webhook (the helper sets the secret token; it is **never** called
   automatically at import):

   ```bash
   curl -s "https://api.telegram.org/bot$ATOM_OPS_TELEGRAM_BOT_TOKEN/setWebhook" \
     -H 'content-type: application/json' \
     -d "{\"url\":\"$ATOM_OPS_PUBLIC_URL/api/atom-ops/telegram\",
          \"secret_token\":\"$ATOM_OPS_TELEGRAM_SECRET_TOKEN\",
          \"allowed_updates\":[\"message\",\"callback_query\"]}"
   ```

   Or from a one-off Node script:

   ```ts
   import { registerWebhook } from "./lib/atom-ops/telegram-bridge";
   await registerWebhook(process.env.ATOM_OPS_PUBLIC_URL!);
   ```

5. In the chat: `/start`, `/status`, `/morning-brief`, or any intent string.

---

## Vercel cron

`vercel.json` declares:

```json
{ "path": "/api/atom-ops/cron", "schedule": "0 12 * * *" }
```

Runs the morning brief daily at 12:00 UTC and fans it out via the notification
integration (Telegram + console badge). Protected by `CRON_SECRET`.

---

## Adaptation notes

- **No Next.js App Router.** Requested paths like `app/(superadmin)/ops/page.tsx`
  and `app/api/atom-ops/route.ts` were mapped to this repo's conventions:
  - UI → `client/src/pages/atom-ops.tsx`, routed at `/ops` in `client/src/App.tsx`.
  - API → `api/atom-ops/{route,telegram,cron}.ts` (Vercel file-based functions).
    The dispatch endpoint URL is `/api/atom-ops/route`.
- **No `middleware.ts`.** Vercel Edge Middleware requires Next.js; this is a Vite
  SPA. The gate is enforced (a) in every API route via `resolveSuperAdmin` (403
  JSON) and (b) on the client via `SuperAdminOnly`. The intent of
  `/ops/:path*` + `/api/atom-ops/:path*` superadmin-only is fully met.
- **Supabase via REST + service role**, matching `api/_lib/admin.ts`. RLS in the
  migration is defense-in-depth (the server bypasses it with the service role);
  `public.is_superadmin()` is ready for a future Supabase-Auth client path.
- **Tools use REST, not SDK imports.** Keeps serverless bundles small and avoids
  import-time failures; the SDKs are still listed in `package.json`.
