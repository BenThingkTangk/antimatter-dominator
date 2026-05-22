-- GA Prompt 10: Compliance Hardening — new Supabase tables
-- Run this against the Supabase SQL editor (or `psql` connection)
--
-- Tables:
--   compliance_blocks   — every pre-dial compliance block logged for audit
--   compliance_audit_log — GDPR forget actions, DNC scrubs, consent renewal alerts

-- ────────────────────────────────────────────────────────────────────
-- compliance_blocks
-- ────────────────────────────────────────────────────────────────────
create table if not exists compliance_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  prospect_id uuid,
  phone_e164 text,
  reason text not null,
  details jsonb,
  attempted_at timestamptz default now()
);

create index if not exists idx_compliance_blocks_tenant_at
  on compliance_blocks(tenant_id, attempted_at desc);

create index if not exists idx_compliance_blocks_phone
  on compliance_blocks(phone_e164);

-- RLS: service role only (no direct client access)
alter table compliance_blocks enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- compliance_audit_log
-- ────────────────────────────────────────────────────────────────────
create table if not exists compliance_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  action text not null,
  target_email text,
  target_phone text,
  target_prospect_id uuid,
  by_user_id uuid,
  details jsonb,
  completed_at timestamptz default now()
);

create index if not exists idx_compliance_audit_tenant_at
  on compliance_audit_log(tenant_id, completed_at desc);

create index if not exists idx_compliance_audit_action
  on compliance_audit_log(action);

-- RLS: service role only
alter table compliance_audit_log enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- Add last_dnc_scrub_at to atom_campaigns (for DNC cron tracking)
-- ────────────────────────────────────────────────────────────────────
alter table atom_campaigns
  add column if not exists last_dnc_scrub_at timestamptz;

-- ────────────────────────────────────────────────────────────────────
-- Add dnc_flagged to atom_campaign_accounts (DNC scrub result)
-- ────────────────────────────────────────────────────────────────────
alter table atom_campaign_accounts
  add column if not exists dnc_flagged boolean default false;

-- ────────────────────────────────────────────────────────────────────
-- Add daily_dial_cap to tenants (for daily cap enforcement)
-- ────────────────────────────────────────────────────────────────────
alter table tenants
  add column if not exists daily_dial_cap integer default 500;

-- ────────────────────────────────────────────────────────────────────
-- Supabase Storage bucket for compliance disclosure audio
-- ────────────────────────────────────────────────────────────────────
-- Run manually in Supabase dashboard:
--   Storage → New bucket → "compliance-disclosure" → Public → Create
-- Or via SQL:
insert into storage.buckets (id, name, public)
values ('compliance-disclosure', 'compliance-disclosure', true)
on conflict (id) do nothing;
