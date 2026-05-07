# QA Analyzer Engine spec

## Purpose
A live reliability monitor that probes every ΔTOM surface, logs every result to Supabase, auto-creates incidents with suggested remediation when things break, and surfaces it all to the Nirmata HQ console.

## Schema (already applied)
- `qa_probes(id, component, endpoint, status, http_status, latency_ms, error, remediation, probed_at)` — one row per probe.
- `status_incidents` extended with `remediation`, `severity`, `component`, `detected_at`, `resolved_at`, `post_mortem`.

## Components to probe

| component           | endpoint                                                          | healthy criteria |
|---------------------|-------------------------------------------------------------------|------------------|
| `api:pitch`         | `POST /api/pitch/generate` with sample body                        | 200, <15s |
| `api:objection`     | `POST /api/objection/generate`                                     | 200, <15s |
| `api:market`        | `POST /api/market-intent/scan`                                     | 200, <25s |
| `api:warbook`       | `POST /api/warbook/research` with small company                    | 200, <40s |
| `api:prospects`     | `POST /api/prospects/scan`                                         | 200, <30s |
| `api:atom-chat`     | `POST /api/atom-chat` with `"ping"` message                        | 200, <10s |
| `api:atom-leadgen`  | `GET /api/atom-leadgen/chat-events?sessionId=_probe_`              | 200 or 404, <3s |
| `api:embeddings`    | `POST /api/embeddings` with `["ping"]`                              | 200, <5s |
| `api:tenant`        | `GET /api/tenant?host=atomdominator.com`                           | 200, <2s |
| `rag-service`       | `GET https://atom-rag.45-79-202-76.sslip.io/`                       | 200, <3s |
| `pinecone`          | `GET https://api.pinecone.io/indexes` with `Api-Key`                | 200, <3s |
| `supabase`          | `GET ${SUPABASE_URL}/rest/v1/tenants?limit=1`                       | 200, <2s |
| `hume-evi`          | `GET https://api.hume.ai/v0/evi/configs?page_size=1`                | 200, <3s |
| `twilio`            | `GET https://api.twilio.com/2010-04-01/Accounts/${SID}.json`        | 200, <3s |

## Endpoint: `POST /api/qa/probe`
- Auth: `x-admin-key` OR Vercel cron signature.
- Body: optional `{ components?: string[] }` to probe a subset; default is all.
- Runs every probe in parallel with a 30s hard timeout.
- For each result:
  - Insert `qa_probes` row.
  - If `status === "down"` AND no open `status_incidents` for that `component` exists → insert a new incident with `severity`, `component`, `remediation` from the runbook map, `detected_at=now()`.
  - If `status === "ok"` AND an open `status_incidents` exists → mark it `resolved_at=now()`.
  - If `SLACK_ALERT_WEBHOOK` env set → POST on status transitions (`ok → down`, `down → ok`).
- Returns `{ results: [...], incidentsOpened, incidentsResolved }`.

## Cron
Add to `vercel.json`:
```json
{ "path": "/api/qa/probe", "schedule": "*/10 * * * *" }
```
(Every 10 min — tight enough for real-time status, loose enough to respect Vercel limits.)

## Runbook remediation map (inline in the route)
```ts
const RUNBOOK: Record<string, { severity: string; remediation: string }> = {
  "api:pitch":       { severity: "major", remediation: "Check Perplexity/OpenAI key quotas. If 429, throttle via exponential backoff. If 500, inspect Vercel function logs for TypeError." },
  "api:atom-chat":   { severity: "major", remediation: "First check PERPLEXITY_API_KEY. If 401, rotate. If 500, check chat_memory table + embed provider chain." },
  "api:warbook":     { severity: "minor", remediation: "WarBook is heavy — Apollo or PDL may be rate-limited. Check apollo key credit in dashboard." },
  "rag-service":     { severity: "critical", remediation: "SSH root@45.79.202.76, `pm2 restart atom-rag`, check `/root/atom-rag/.env` has PERPLEXITY_API_KEY." },
  "pinecone":        { severity: "critical", remediation: "Pinecone console → check index atom-intelligence-pplx. If down, fallback to atom-intelligence (legacy 1536d)." },
  "supabase":        { severity: "critical", remediation: "Supabase dashboard → pausing auto-scaling may have tripped. Restart DB if in paused state." },
  "hume-evi":        { severity: "major", remediation: "Hume status page. Verify HUME_API_KEY + config UUIDs still valid." },
  "twilio":          { severity: "critical", remediation: "Twilio status page. Check phone number AOS if dial errors. Verify TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN." },
  // default for any api:*
};
```

## HQ console consumes
- `GET /api/qa/status` — rollup: per-component last 24h status, uptime %, average latency, last incident.
- `GET /api/qa/incidents?open=true` — live open incidents.
- `POST /api/qa/incidents/:id/resolve` — manual resolution with post-mortem.

## Alerting
- `SLACK_ALERT_WEBHOOK` env → incoming webhook URL. Send formatted block on incident open/close.
- `ALERT_EMAIL_TO` env → send via existing email path if configured.

## Monitoring costs
- LLM/voice cost meter: every API route that consumes paid tokens increments `module_usage.cost_cents` (best-effort). HQ rolls up per-tenant spend vs `tenants.token_budget_cents`.
- Cron `/api/cron/cost-ceiling` (hourly) — any tenant > 100% of budget → set `kill_switch=true`.
