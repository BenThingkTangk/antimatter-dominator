# QA Analyzer Engine — Build Status

**Date:** 2026-05-07
**Status:** Complete — ready for integration

## Files Created

### Backend (`api/qa/`)
| File | Purpose |
|------|---------|
| `api/qa/probe.ts` | POST /api/qa/probe — probes all 14 components in parallel (30s timeout), inserts qa_probes rows, auto-opens/resolves status_incidents, Slack alerts on transitions |
| `api/qa/status.ts` | GET /api/qa/status — 24h rollup per component (uptime %, avg latency, last probe, hourly histogram for charts) |
| `api/qa/incidents.ts` | GET /api/qa/incidents?open=true — list incidents; POST to resolve with optional post-mortem |

### Frontend (`client/src/admin/`)
| File | Purpose |
|------|---------|
| `client/src/admin/QaPanel.tsx` | Full QA dashboard: KPI cards, 3-column component status grid, open incidents with remediation + resolve button, AreaStack probe histogram, DonutMix status breakdown |

### Stubs (pre-existing AdminShell gap, not part of QA spec)
| File | Purpose |
|------|---------|
| `client/src/admin/tabs/Billing.tsx` | Empty stub so AdminShell builds |
| `client/src/admin/tabs/Integrations.tsx` | Empty stub so AdminShell builds |
| `client/src/admin/tabs/ApiKeys.tsx` | Empty stub so AdminShell builds |

## Files Modified

| File | Change |
|------|--------|
| `vercel.json` | Added `{ "path": "/api/qa/probe", "schedule": "*/10 * * * *" }` to crons array |
| `client/src/admin/AdminShell.tsx` | Added QA Analyzer tab (HeartPulse icon), lazy-loads QaPanel |
| `client/src/App.tsx` | Added `/admin` route pointing to AdminShell |

## Env Vars Required

| Variable | Purpose | Required? |
|----------|---------|-----------|
| `SUPABASE_URL` | Supabase REST endpoint | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `ADMIN_API_KEY` | Auth for probe/incidents endpoints | Yes (or CRON_SECRET) |
| `CRON_SECRET` | Vercel cron auth (`Authorization: Bearer`) | Recommended |
| `SLACK_ALERT_WEBHOOK` | Incoming webhook for incident open/close alerts | Optional |
| `PINECONE_API_KEY` | Pinecone index probe | Optional (probe skips auth if unset) |
| `HUME_API_KEY` | Hume EVI config probe | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio account probe | Optional |
| `TWILIO_AUTH_TOKEN` | Twilio auth for probe | Optional |

## Supabase Schema (must already exist per spec)

- `qa_probes(id, component, endpoint, status, http_status, latency_ms, error, remediation, probed_at)`
- `status_incidents` with columns: `id, component, severity, remediation, detected_at, resolved_at, post_mortem`

## Caveats

1. **Probe self-references:** The probe hits the app's own API endpoints (e.g., `/api/pitch/generate`). On first deploy the probe may report failures if those endpoints require auth tokens not passed via X-Admin-Key. The probe passes X-Admin-Key to self-hosted endpoints.
2. **External service probes:** Pinecone, Hume, Twilio probes will return "down" if their respective API keys are not set in the Vercel environment. This is expected and documented in the runbook remediation text.
3. **Slack alerts:** Best-effort — if `SLACK_ALERT_WEBHOOK` is unset, alert calls are silently skipped (no crash).
4. **AdminShell stubs:** Created empty Billing/Integrations/ApiKeys tab stubs to fix a pre-existing build failure in AdminShell.tsx. These are not part of the QA engine.
5. **Cron schedule:** Every 10 minutes (`*/10 * * * *`). Vercel free tier allows 1 cron invocation/day; Pro tier required for 10-min intervals.
