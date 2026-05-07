# Platinum Admin Sprint v2 — Status

This document captures the state of the admin layer after the Platinum sprint.
It complements `AUTH_STATUS.md` and `QA_STATUS.md`.

## Surfaces shipped

### Desktop
| Route | Component | Audience | Notes |
|-------|-----------|----------|-------|
| `/admin` | `admin/AdminShell.tsx` | admin / super_admin | Tab router (Overview, System Control = QaPanel, TCPA Compliance, Team, Tenants, Billing, Integrations, API Keys) |
| `/admin/hq` | `admin/HqShell.tsx` | super_admin only | Cross-tenant overlord console — portfolio MRR/ARR, MRR by plan, churn risk, incidents, OKR targets, tenant grid |
| `/admin/t/:slug` | `admin/TenantDetailShell.tsx` | admin / super_admin | Per-tenant deep view — dial trend, module mix, leaderboard, heatmap, members, integrations |

### Mobile mirrors
| Route | Component | Notes |
|-------|-----------|-------|
| `/m/admin` | `mobile/pages/MobileAdmin.tsx` | Pre-existing tenant admin |
| `/m/admin/hq` | `mobile/pages/MobileHQ.tsx` | Wraps `HqShell` in `.m-module-host` + `AuthGate` |
| `/m/admin/t/:slug` | `mobile/pages/MobileTenantDetail.tsx` | Wraps `TenantDetailShell` in `.m-module-host` + `AuthGate` |

`HqShell` and `TenantDetailShell` are mobile-aware: they read the current
location and rewrite their internal navigate() targets to `/m/admin/t/:slug`
when running inside the mobile shell, so the back-arrow + drill-in buttons
all stay inside the mobile experience.

## Sidebar wiring (AppLayout.tsx)
- `/admin/hq` → "Nirmata HQ" link, top of sidebar, **only** when `session.isSuperAdmin`
- `/admin` → "ATOM System Control" link, below WarBook, when `session.role === "admin"` OR `session.isSuperAdmin`

## API surface — `/api/admin/data`

Single Vercel function. Auth: `X-Admin-Key` matching `ADMIN_API_KEY`.

### GET views
| view | Returns |
|------|---------|
| `compliance` | KPIs, hourly allowed/blocked trend, block reasons donut, recent blocks, consents, DNC, hash-chain integrity |
| `leaderboard` | Power-user rows for one tenant (30d module_usage rollup) |
| `tenants-overview` | Tenant health table, MRR stack by plan, plan mix, growth bar |
| `tenants-list` | Lightweight list for tenant pickers |
| `billing-overview` | MRR/ARR series, plan ladder, recent invoices |
| `integrations` | Integrations rows for one tenant |
| `apikeys` | Provider configured/usage status (env probe + qa_probes rollup) |
| `hq` | Cross-tenant: KPIs (MRR/ARR/tenants/dials), MRR series by plan, 7d×24h heatmap, churn risk, OKRs, open incidents, tenant grid |
| `tenant-detail` | KPIs, daily dial trend, module mix, 7d×24h heatmap, leaderboard, users, integrations |

### POST views
| view | Action |
|------|--------|
| `dnc-add` | Inserts a DNC entry for the given tenant |
| `integrations-disconnect` | Marks an integration disconnected |
| `tenant-killswitch` | Toggles `tenants.kill_switch` |
| `target-update` | Updates a `company_targets` row's current_value/target_value/label/note |

## Demo data

`scripts/seed-demo-data.mjs`:
- 30-day backfill of `module_usage`, `predial_checks`, `tenant_calls`, `tenant_integrations`
- Realistic Gaussian distributions for call durations, sentiment, intent
- Idempotent guard: skips tenants with >50 module_usage rows unless `--force`
- Run via `node scripts/seed-demo-data.mjs [--force] [--tenant=slug]`

Already executed against production Supabase for all three seeded tenants
(`antimatter`, `deady`, `intelisys`). Status_incidents seeding is a known
no-op due to a NOT NULL column mismatch — left as is, the QA cron will
populate real incidents over time.

## Build

`npx vite build` passes. Bundle size: ~1.22 MB main chunk (~329 KB gzipped).
Recharts is the largest dependency; future work could code-split per tab.

## Open items (not in this sprint)
- Stripe billing live wiring (env vars not set in production)
- Demo-mode read-only fallback for trial-expired tenants (auth scaffolding ready)
- Code splitting to bring main chunk under 500 KB
