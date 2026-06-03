-- ATOM Researcher Pro / Sonar — dossier persistence
-- Run this against the Supabase SQL editor (or `psql` connection).
--
-- Optional: the worker persists each generated dossier here when
-- SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured. The feature works
-- fully without it (the UI keeps a safe client-side / in-memory history), so
-- this table is for durable, cross-device dossier history only.

create table if not exists atom_research_dossiers (
  id            uuid primary key default gen_random_uuid(),
  research_id   text unique not null,           -- worker-generated id (atomr_…)
  tenant_slug   text,
  company       text not null,
  domain        text,
  contact_name  text,
  contact_title text,
  mode          text not null,                  -- fast_scan | pro_dossier | deep_research | vibranium_war_room
  confidence    int,                            -- 0–100
  source_count  int,
  model         text,
  dossier       jsonb not null,                 -- full structured Dossier object
  raw_markdown  text,                           -- original model output
  request       jsonb,                          -- the input brief
  created_at    timestamptz default now()
);

create index if not exists atom_research_dossiers_company_idx on atom_research_dossiers (company);
create index if not exists atom_research_dossiers_tenant_idx  on atom_research_dossiers (tenant_slug, created_at desc);
