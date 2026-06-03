-- ATOM Researcher — account dossier persistence (schema-conformant tier)
-- Run this against the Supabase SQL editor (or `psql` connection).
--
-- Backs POST /api/atom/researcher/dossiers. Stores the full structured dossier
-- (matching atom_account_dossier_schema.json) as JSONB plus an optional markdown
-- render, and normalizes the key sources used into atom_dossier_sources.
--
-- Auth model mirrors the rest of the platform: tables are written ONLY by the
-- server using SUPABASE_SERVICE_ROLE_KEY, and tenant isolation is enforced in the
-- API layer via the tenant_slug column (same as atom_calls / atom_research_dossiers).
-- RLS is enabled with no permissive policies so the anon/auth client keys cannot
-- read or write these rows directly — only the service role (which bypasses RLS)
-- can. This matches compliance_blocks / compliance_audit_log in 010.

-- ────────────────────────────────────────────────────────────────────
-- atom_dossiers
-- ────────────────────────────────────────────────────────────────────
create table if not exists atom_dossiers (
  id                        uuid primary key default gen_random_uuid(),
  dossier_id                text unique not null,        -- app-generated id surfaced in metadata.dossier_id
  tenant_slug               text,
  account_id                uuid,
  contact_id                uuid,
  target_company            text not null,
  target_domain             text,
  target_contact_name       text,
  target_contact_title      text,
  solution_being_positioned text,
  call_type                 text,
  relationship_stage        text,
  primary_goal              text,
  confidence_score          text check (confidence_score in ('LOW', 'MEDIUM', 'HIGH')),
  deal_potential            text,
  model_used                text,
  dossier_json              jsonb not null,              -- full structured ATOM Account Dossier
  markdown_render           text,                        -- optional markdown brief for UI display
  created_by                uuid,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- account / contact lookup
create index if not exists idx_atom_dossiers_account on atom_dossiers (account_id);
create index if not exists idx_atom_dossiers_contact on atom_dossiers (contact_id);

-- target company / domain lookup (case-insensitive company match)
create index if not exists idx_atom_dossiers_company on atom_dossiers (lower(target_company));
create index if not exists idx_atom_dossiers_domain  on atom_dossiers (target_domain);

-- confidence score filtering
create index if not exists idx_atom_dossiers_confidence on atom_dossiers (confidence_score);

-- recency (per-tenant history feed)
create index if not exists idx_atom_dossiers_created     on atom_dossiers (created_at desc);
create index if not exists idx_atom_dossiers_tenant_at   on atom_dossiers (tenant_slug, created_at desc);

-- RLS: service role only (no direct client access)
alter table atom_dossiers enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- atom_dossier_sources
-- Normalized rows from source_notes_and_verification_gaps.key_sources_used
-- ────────────────────────────────────────────────────────────────────
create table if not exists atom_dossier_sources (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references atom_dossiers(id) on delete cascade,
  title        text not null,
  url          text not null,
  publisher    text,
  published_at text,
  accessed_at  timestamptz default now()
);

create index if not exists idx_atom_dossier_sources_dossier on atom_dossier_sources (dossier_id);

-- RLS: service role only (no direct client access)
alter table atom_dossier_sources enable row level security;
