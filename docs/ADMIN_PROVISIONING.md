# Admin Login Provisioning

How to create admin logins for ATOM Sales OS **without sending email invitations**
and **without ever committing or printing plaintext passwords**.

## Auth model (context)

ATOM uses a custom Supabase-backed auth (no Supabase Auth, no WorkOS yet):

- Users live in the `tenant_users` table (`email`, `password_hash`, `role`, `tenant_id`, `accepted_at`).
- Login (`POST /api/auth/login`) looks up the user by email, `bcrypt.compare`s the
  password against `password_hash`, then issues an `atom_session` cookie.
- `role = 'admin'` grants tenant-level admin. Platform-wide ("super admin") view is
  granted to any email listed in the `NIRMATA_HQ_EMAILS` env var (`api/auth/me.ts`,
  `api/auth/login.ts`).

A login works as soon as the user row exists with a valid `password_hash` and
`accepted_at` set. **No invite/email step is required.**

## Provisioner

`scripts/provision-admins.mjs` (also `npm run provision:admins`) idempotently upserts
the three admin users into `tenant_users` with `role = 'admin'` and `accepted_at = now()`.

It:
- stores **bcrypt hashes only** (cost 12) — never plaintext;
- never prints passwords;
- sends **no email and triggers no invite flow**;
- reads passwords from **environment variables** or a **hidden interactive prompt**.

### Required Supabase credentials

The script uses the same service-role creds the API uses. Provide via env:

```bash
export SUPABASE_URL='https://tzwpjxyqdlgcvgownxno.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'   # secret — do not commit
```

(Or point `SUPABASE_KEYS_FILE` at a local `KEY=VALUE` file containing those two keys.)

### Password input (never on the command line in history)

Each admin's password is read from a per-email env var, or — if unset and running in a
TTY — prompted for with hidden input. The env var name is the upper-cased local-part of
the email:

| Email                          | Password env var          |
| ------------------------------ | ------------------------- |
| `ben@antimatterai.com`         | `ADMIN_PW_BEN`            |
| `josh.mellott@thingktangk.com` | `ADMIN_PW_JOSH_MELLOTT`   |
| `joel.bedard@thingktangk.com`  | `ADMIN_PW_JOEL_BEDARD`    |

### Run

Dry run (validates connectivity + tenant, performs no writes, reveals no secrets):

```bash
node scripts/provision-admins.mjs --dry-run
```

Provision via env vars (prefix with a space or use a secrets manager to keep them out
of shell history):

```bash
 ADMIN_PW_BEN='…' ADMIN_PW_JOSH_MELLOTT='…' ADMIN_PW_JOEL_BEDARD='…' \
   node scripts/provision-admins.mjs
```

Or run interactively and let it prompt (input hidden) for any password not in env:

```bash
node scripts/provision-admins.mjs
```

Target a different tenant with `--tenant=<slug>` (default `antimatter`).

### Granting platform-wide (cross-tenant) admin

To give these admins the super-admin platform view, add their emails to the
`NIRMATA_HQ_EMAILS` env var on the deployment (comma-separated), e.g.:

```
NIRMATA_HQ_EMAILS=ben.oleary@thingktangk.com,ben@antimatterai.com,josh.mellott@thingktangk.com,joel.bedard@thingktangk.com
```

Tenant-level admin (the `role = 'admin'` set by this script) works without this; the
env var only controls the cross-tenant platform view.

## Verifying a login

After provisioning, confirm without exposing the password by checking the row state:

```bash
curl -s "$SUPABASE_URL/rest/v1/tenant_users?email=eq.ben@antimatterai.com&select=email,role,accepted_at,password_hash" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

You should see `role: "admin"`, a non-null `accepted_at`, and a non-null `password_hash`
(a `$2a$`/`$2b$` bcrypt string). Then log in at the deployed URL via the normal login form.
