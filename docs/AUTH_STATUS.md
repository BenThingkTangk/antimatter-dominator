# Auth + 14-Day Trial — Implementation Status

**Date:** 2026-05-07
**Author:** Claude Agent

## Files Created

### Backend — Auth (`api/auth/`)
| File | Method | Description |
|------|--------|-------------|
| `api/auth/signup.ts` | POST | Creates tenant + admin user + session. Sets `atom_session` cookie. Validates email uniqueness across all tenants. bcrypt(10) password hashing. |
| `api/auth/login.ts` | POST | Email/password auth with constant-time delay on failure (250ms). Creates fresh session token. |
| `api/auth/logout.ts` | POST | Reads cookie, revokes session in DB, clears cookie. |
| `api/auth/me.ts` | GET | Cookie → user_sessions → tenant_users → tenants join. Returns `{ user, tenant, role, isSuperAdmin }`. |

### Backend — Billing (`api/billing/`)
| File | Method | Description |
|------|--------|-------------|
| `api/billing/checkout.ts` | POST | Creates Stripe Checkout Session for plan upgrade. Gracefully returns `null` if `STRIPE_SECRET_KEY` unset. |
| `api/billing/portal.ts` | POST | Creates Stripe Billing Portal session for current tenant. |
| `api/billing/webhook.ts` | POST | Handles `customer.subscription.updated`, `invoice.payment_failed`, `customer.subscription.deleted`. Raw body parsing for signature verification. |

### Backend — Cron (`api/cron/`)
| File | Schedule | Description |
|------|----------|-------------|
| `api/cron/trial-rollover.ts` | Daily 09:00 UTC | Finds expired trials without Stripe subscription → sets `subscription_status='past_due'`, `kill_switch=true`. |

### Frontend — Auth (`client/src/auth/`)
| File | Description |
|------|-------------|
| `client/src/auth/useSession.ts` | TanStack Query hook for `/api/auth/me`. Returns `{ user, tenant, role, isSuperAdmin, loading, demoMode, refresh, logout }`. |
| `client/src/auth/AuthGate.tsx` | Auth wrapper with ATOM atomic-orbit splash (max 1500ms). Redirects unauth users to `/login`. Provides `SessionContext`. Demo mode banner. |

### Frontend — Pages (`client/src/pages/`)
| File | Route | Description |
|------|-------|-------------|
| `client/src/pages/login.tsx` | `/login` | Cinematic dark surface. Atomic orbit + ATOM wordmark. Email/password form. Honors `?next=` query param. |
| `client/src/pages/signup.tsx` | `/signup` | Two-step form: (1) name/email/password/company, (2) plan selection cards (Trial/Starter/Growth/Advisory/Enterprise). Password strength meter. |
| `client/src/pages/landing.tsx` | `/` | Public marketing landing. Hero + 4 feature tiles + Sign In / Start Free Trial buttons. Redirects authenticated users to `/pitch`. |

### Frontend — Admin Tab Stubs (`client/src/admin/tabs/`)
| File | Description |
|------|-------------|
| `client/src/admin/tabs/Billing.tsx` | Stub to unblock build (auto-populated by linter with full MRR/ARR dashboard). |
| `client/src/admin/tabs/Integrations.tsx` | Placeholder stub. |
| `client/src/admin/tabs/ApiKeys.tsx` | Placeholder stub. |

## Files Modified

| File | Changes |
|------|---------|
| `client/src/App.tsx` | Added `/login`, `/signup` routes. Root `/` shows `LandingPage` for unauth, redirects to `/pitch` for auth. Wrapped module routes in `AuthGate`. `AuthenticatedRoutes` component. |
| `client/src/components/AppLayout.tsx` | Added user avatar+menu (Profile/Settings/Logout) in sidebar footer. "Sign in" link when no user. Dynamic nav: "Nirmata HQ" at top for `isSuperAdmin`, "ATOM System Control" below WarBook for `admin`/`isSuperAdmin`. |
| `vercel.json` | Added trial-rollover cron: `{ path: "/api/cron/trial-rollover", schedule: "0 9 * * *" }`. |

## Quality Verification

- **TypeScript:** `npx tsc --noEmit` — zero new errors in auth files. Pre-existing errors exist only in unrelated files (`AdminShell.tsx`, `QaPanel.tsx`, `Compliance.tsx`).
- **Vite Build:** `npx vite build` — succeeds.
- **Cookie spec:** `HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`.
- **bcrypt rounds:** 10.
- **Constant-time delay:** 250ms on login failure.
- **Session token:** 32-byte `crypto.randomBytes(32).toString("base64url")`.
- **All endpoints inline `sb()` helper** — no shared imports per HOLY_BIBLE.md lessons.

## Caveats

1. **Stripe checkout currently returns `null` URL** because `STRIPE_SECRET_KEY` env is unset on Vercel — set it in the Vercel dashboard to enable paid plan checkout.
2. **Stripe webhook signature verification** requires `STRIPE_WEBHOOK_SECRET` env to be set. Without it, webhook payloads are accepted without signature check (fine for dev, not production).
3. **Email sending on trial rollover** is noted in the spec but not implemented — only DB status updates are made. Add email integration separately.
4. **`NIRMATA_HQ_EMAILS`** defaults to `ben.oleary@thingktangk.com` when env is unset.
5. **Forgot password flow** is not yet implemented — the login page shows no "Forgot password" link (placeholder per spec).
6. **Demo mode** sets the `demoMode` flag in SessionContext and shows a banner; actual demo data seeding is a separate task.
7. **Admin tab stubs** (Billing, Integrations, ApiKeys) were created to unblock the build for `AdminShell.tsx` — these are not part of the auth spec but were needed to fix pre-existing import errors.

## Env Vars Required

| Variable | Required | Default |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — |
| `NIRMATA_HQ_EMAILS` | No | `ben.oleary@thingktangk.com` |
| `STRIPE_SECRET_KEY` | No | Gracefully degrades |
| `STRIPE_WEBHOOK_SECRET` | No | Skips signature check |
