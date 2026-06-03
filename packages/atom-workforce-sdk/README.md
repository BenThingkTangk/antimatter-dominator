# @nirmata/atom-workforce-sdk

A **non-destructive** subset of the ATOM Ops toolset, safe to hand to autonomous
workforce agents. Every exported function is read-only or draft-only — there is
**no** path to deploys, merges, refunds, DNS writes, tenant suspends, password
resets, or sending email.

Destructive operations live exclusively behind the superadmin, confirmation-gated
ATOM Ops console (`/ops`) and the Telegram bridge. They are not importable here.

## Exports

| Function                     | Source tool | Does                                   |
| ---------------------------- | ----------- | -------------------------------------- |
| `listOpenPRs`                | github      | List open pull requests                |
| `postIssue`                  | github      | Open a new issue                       |
| `commentOnIssue`             | github      | Comment on an issue/PR                 |
| `lookupCustomer`             | stripe      | Look up a customer by email            |
| `getRowCounts`               | supabase    | Approximate table row counts           |
| `runRLSTestQuery`            | supabase    | Service-role RLS read test             |
| `readSentryErrors`           | sentry      | Recent unresolved Sentry issues        |
| `draftEmail`                 | email       | Build (NOT send) an email payload      |

All functions return the shared `OpsResult<T>` shape:

```ts
interface OpsResult<T> { ok: boolean; data: T; summary: string }
```

## Usage

```ts
import { listOpenPRs, draftEmail } from "@nirmata/atom-workforce-sdk";

const prs = await listOpenPRs({ limit: 10 });
if (prs.ok) console.log(prs.summary, prs.data);

const draft = await draftEmail({
  to: "founder@acme.com",
  subject: "Weekly digest",
  body: "…",
});
// draft.data is a payload for review — nothing was sent.
```

## Environment

These tools read credentials via the central `getEnv` helper. Provide only the
envs for the tools you use (see `ATOM_OPS_README.md` and `.env.example` at the
repo root): `GITHUB_TOKEN`, `ATOM_OPS_GITHUB_REPO`, `STRIPE_SECRET_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_AUTH_TOKEN`,
`ATOM_OPS_SENTRY_ORG`, `ATOM_OPS_SENTRY_PROJECT`, `ATOM_OPS_EMAIL_FROM`.

## Safety model

This package is the boundary that lets a less-trusted agent help with ops work
without the ability to cause harm. If you need a destructive capability, do not
add it here — add it to `lib/atom-ops/tools/*` (marked `@destructive`) so it
flows through the Plan → Confirm → Execute gate.
