# ΔTOM rule packs

Versioned, deterministic scoring rules for the campaigns app. These are the
**single source of truth** for the live scorer (`api/campaigns/[id]/score-public.ts`)
and the enrichment pipeline (`api/campaigns/[id]/enrich.ts`).

## Files

- `registry.json` — slug → file map. The DB row in `atom_scoring_templates` is
  just a pointer; the math lives here so it gets diffs, PR review, and rollback.
- `healthcare-segmentation-hipaa.v1.json` — Akamai Guardicore healthcare play.
  Engine: `healthcare-hipaa-v1`. Public 0-70 + ATOM 0-30.
- `cloud-ai-infrastructure.v1.json` — Akamai+Linode cloud/AI-infra play.
  Engine: `cloud-ai-infra-v1`. Formula `4L + 4S + 4G + 3E + 3M + 2T`, max 100.

## How a rule pack is used

```
campaigns table (Supabase)
  └─ scoring_template_slug = "cloud-ai-infrastructure-v1"
       │
       ▼
api/_rules/registry.json
  └─ slug → file: "cloud-ai-infrastructure.v1.json"
       │
       ▼
api/campaigns/[id]/score-public.ts
  └─ static import → bundled into the serverless function at build time
       │
       ▼
scoreRow(row, pack)
  └─ dispatches by pack.engine
```

## To add a new template

1. Drop a new JSON file in this folder with a new `slug`, a new `version`, and
   a new `engine` (or reuse an existing engine).
2. If you reuse an engine, no code changes. If you add a new engine, extend the
   switch in `api/campaigns/[id]/score-public.ts:scoreRow()` and the prompt
   pickers in `api/campaigns/[id]/enrich.ts`.
3. Add the file to `registry.json`.
4. Seed a row in `atom_scoring_templates` with the same slug so the dropdown
   picks it up.
5. Update `api/campaigns/[id]/score-public.ts` and `enrich.ts` to import the
   new JSON file (static import — Vercel will bundle it).

## To tune weights without a code deploy

You currently can't — these are static imports compiled into the Vercel
function bundle. Tuning a weight = a one-line JSON edit + a commit + a Vercel
deploy (~30s). That's intentional — every score is reproducible from a git
SHA + rules_version, and rollback is a `git revert`.

A future variant could fetch JSON at runtime from a CDN; we chose not to so
the scorer has no external dependency and zero cold-start latency.

## Schema invariants

Every rule pack must declare:

- `slug` — unique, matches the DB row
- `version` — semver-ish string written into `atom_campaign_accounts.rules_version`
- `engine` — string the scorer switches on (`healthcare-hipaa-v1`, `cloud-ai-infra-v1`)
- `max_score` — should be 100 unless we change the tier UI
- `weights` — engine-specific object
- `tiers` — `{ T1: { min, action }, T2: ..., T3: ..., T4: ... }`

Engine-specific extras:

- `healthcare-hipaa-v1` also requires `sub_vertical_profile`, `revenue_factors`,
  `akafit_multipliers`, `wallet_multipliers`, `high_value_lists`.
- `cloud-ai-infra-v1` also requires `sub_vertical_profile` and `evidence_schema`.

## Sister files (offline mirrors)

These produce the standalone XLSX/PDF deliverables and must stay in lockstep
with the healthcare pack:

- `/home/user/workspace/akamai-scoring/score-public.py` — public 0-70 logic
- `/home/user/workspace/akamai-scoring/build-xlsx.py` — XLSX recompute
- `/home/user/workspace/antimatter-dominator/server/scoring/engine.ts` — local
  dev (Express) scorer; not used in production but useful for `npm run dev`.

If you change healthcare weights, update all three plus this JSON.
