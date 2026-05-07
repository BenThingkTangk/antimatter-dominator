# Auth + 14-day trial spec

## Schema (already applied)

`tenants` adds: `trial_ends_at`, `subscription_status`, `current_plan_price_cents`, `seats_purchased`, `seats_used`, `token_budget_cents`, `token_spent_cents`, `kill_switch`, `owner_email`.

`tenant_users` adds: `password_hash`, `password_changed_at`, `mfa_secret`, `last_session_token`.

`user_sessions(id, user_id, tenant_id, token, user_agent, ip, created_at, expires_at, revoked_at)` — server-side session table (token = opaque random base64url).

`plan_caps(plan, monthly_price_cents, seats_included, dials_per_month, llm_token_cents_per_month, features)` — already seeded with `trial / starter / growth / advisory / enterprise`.

## Endpoints to build (under `api/auth/`)

### `POST /api/auth/signup`
Body: `{ email, password, fullName, companyName?, plan? }`
Flow:
1. Validate email format, password ≥ 8 chars, all required fields.
2. Reject if `tenant_users.email` already exists across any tenant.
3. Generate slug from `companyName` or email-prefix + 4-char random suffix; ensure unique against `tenants.slug`.
4. Insert `tenants` row with `plan='trial'`, `trial_ends_at = now() + 14d`, `subscription_status='trialing'`, `owner_email=email`, primary/accent hex from default ΔTOM palette.
5. bcrypt hash password (10 rounds) → insert `tenant_users` with `role='admin'` (first user is the workspace admin), `accepted_at=now()`.
6. Generate session token (32-byte base64url) → insert `user_sessions`.
7. Set HTTP-only cookie `atom_session` (`SameSite=Lax`, `Secure`, `Path=/`, 7-day expiry).
8. Return `{ tenant: {slug,name,plan,trial_ends_at}, user: {id,email,role,fullName}, redirectTo: "/" }`.

### `POST /api/auth/login`
Body: `{ email, password }`
Flow:
1. Lookup `tenant_users.password_hash` by email.
2. bcrypt compare. If fail → 401 with constant-time delay.
3. Update `last_login_at`, generate fresh session token, write `user_sessions`, set cookie.
4. Return `{ tenant, user, redirectTo: "/" }`.

### `POST /api/auth/logout`
Reads cookie → marks `user_sessions.revoked_at`. Clears cookie.

### `GET /api/auth/me`
Reads cookie → joins `user_sessions` + `tenant_users` + `tenants`. Returns `{ user, tenant, role, isSuperAdmin }`.
- `isSuperAdmin = email IN env NIRMATA_HQ_EMAILS (comma-separated)`.

### Cookie helpers
- `atom_session` — opaque random token, looked up server-side.
- `Set-Cookie: atom_session=<token>; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`.

## Client side (under `client/src/auth/`)

### `useSession()` hook
Calls `/api/auth/me` once on mount, caches in React Query. Returns `{ user, tenant, role, isSuperAdmin, loading, refresh, logout }`.

### `<AuthGate>` wrapper
- If `loading` → null
- If no user → redirect to `/#/login` UNLESS the path starts with `/login`, `/signup`, `/invite/`, or has `?demo=1`.
- Provides session via context.

### `LoginPage` (`client/src/pages/login.tsx`)
- ΔTOM cinematic dark surface, atomic orbit, "Sign in to ΔTOM Sales Dominator".
- Email + password, "Sign in", "Forgot password" (placeholder).
- Bottom: "New here? Start a 14-day free trial →" link to /signup.

### `SignupPage` (`client/src/pages/signup.tsx`)
- Two-step form:
  1. Email, password (with strength meter), full name, company name.
  2. Plan selection cards: Trial (default, $0), Starter $99, Growth $299, Advisory $799, Enterprise $1,999. Highlight Trial as "auto-rolls to Starter on day 15 — cancel anytime".
- POST `/api/auth/signup`, on success redirect to `/`.

### `LandingPage` (`client/src/pages/landing.tsx`) at `/`
- Marketing hero: "ΔTOM routes live intent into action."
- 4 feature tiles linking to demo versions of Pitch / WarBook / Market / Lead Gen.
- Top right: "Sign in" / "Start free trial".

### Sidebar
- Role-aware (already partially implemented in AppLayout). Add `ATOM System Control` link below WarBook when `role === 'admin' || isSuperAdmin`.
- Add `Nirmata HQ` link at top when `isSuperAdmin`.

## Stripe
- `STRIPE_SECRET_KEY` env. If unset, gracefully degrade.
- New `POST /api/billing/checkout` → creates Checkout Session for plan, redirects to Stripe.
- New `POST /api/billing/portal` → creates Billing Portal session.
- New `POST /api/billing/webhook` → handles `customer.subscription.updated`, `invoice.payment_failed`, `customer.subscription.deleted`. Updates `tenants.subscription_status`.

## Trial rollover
- Cron `/api/cron/trial-rollover` (daily 09:00 UTC) — for every tenant where `trial_ends_at < now() AND subscription_status = 'trialing'`:
  - If `stripe_subscription_id` is set → no-op (Stripe handles billing).
  - Else → mark `subscription_status='past_due'`, `kill_switch=true` (read-only), email owner.

## Env vars to set
- `JWT_SECRET` — for session signing if we move off opaque tokens (keep both possible).
- `NIRMATA_HQ_EMAILS` — comma-separated emails granted super_admin access (default: `ben.oleary@thingktangk.com`).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optional — fully gracefully degrades).
