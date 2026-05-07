-- ═══════════════════════════════════════════════════════════════════════════
-- ΔTOM Platinum Admin Schema
-- Adds: consent_ledger, dnc_entries, audit_log, tenant_integrations,
--       tenant_invites, tenant_users_pw (for plain auth until WorkOS)
-- Idempotent — safe to re-run.
-- Project: tzwpjxyqdlgcvgownxno
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Consent ledger (append-only, SHA-256 chained) ──────────────────────────
-- Evidence hash = sha256(prospect_identifier + channel + prior_evidence_hash + captured_at_iso)
-- Each row's evidence_hash includes the previous row's hash, making the log
-- tamper-evident: rewriting one row invalidates every row after it.
create table if not exists consent_ledger (
  id                bigserial primary key,
  tenant_id         uuid references tenants(id) on delete cascade,
  prospect_identifier text not null,           -- phone:+15555550100 | email:... | user-id
  channel           text not null,             -- voice | sms | email
  consent_type      text not null,             -- PEWC | express_written | implied | revoked
  source            text not null,             -- web_form | inbound_call | sms_yes | manual_import
  evidence_url      text,                      -- screenshot, recording, form URL
  evidence_payload  jsonb default '{}'::jsonb, -- arbitrary supporting data
  captured_by       text,                      -- agent email or system
  captured_at       timestamptz default now(),
  expires_at        timestamptz,               -- nullable (PEWC has no automatic expiry)
  revoked_at        timestamptz,
  prior_hash        text,
  evidence_hash     text not null
);

create index if not exists consent_ledger_tenant_idx on consent_ledger(tenant_id, captured_at desc);
create index if not exists consent_ledger_prospect_idx on consent_ledger(tenant_id, prospect_identifier, captured_at desc);
create index if not exists consent_ledger_active_idx on consent_ledger(tenant_id, prospect_identifier) where revoked_at is null;

-- ─── DNC entries (tenant-scoped + global federal DNC cache) ─────────────────
create table if not exists dnc_entries (
  id              bigserial primary key,
  tenant_id       uuid references tenants(id) on delete cascade, -- null = global federal DNC cache
  identifier      text not null,          -- normalized E.164 phone or email
  identifier_type text not null default 'phone',  -- phone | email | domain
  source          text not null,          -- federal_dnc | state_dnc | internal | user_request | litigator
  state           text,                   -- US state code if state_dnc
  added_at        timestamptz default now(),
  removed_at      timestamptz,
  notes           text,
  unique (tenant_id, identifier_type, identifier)
);

create index if not exists dnc_identifier_idx on dnc_entries(identifier_type, identifier) where removed_at is null;
create index if not exists dnc_tenant_idx on dnc_entries(tenant_id) where removed_at is null;

-- ─── Audit log (every admin action, tamper-evident) ─────────────────────────
create table if not exists audit_log (
  id           bigserial primary key,
  tenant_id    uuid references tenants(id) on delete cascade,
  actor_email  text,
  actor_role   text,                    -- admin | manager | rep | system
  action       text not null,           -- dial_attempted | consent_captured | user_invited | …
  resource     text,                    -- phone:+1... | user:uuid | tenant:uuid
  result       text not null default 'ok',  -- ok | blocked | error
  reason       text,                    -- blocked-by-dnc | quiet-hours | insufficient-consent | …
  payload      jsonb default '{}'::jsonb,
  prior_hash   text,
  entry_hash   text not null,
  created_at   timestamptz default now()
);

create index if not exists audit_log_tenant_idx on audit_log(tenant_id, created_at desc);
create index if not exists audit_log_action_idx on audit_log(action, created_at desc);

-- ─── Tenant integrations (CRM OAuth tokens) ─────────────────────────────────
create table if not exists tenant_integrations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  provider          text not null,           -- salesforce | hubspot | pipedrive | slack | gmail | outlook
  status            text not null default 'disconnected',  -- connected | disconnected | error
  access_token      text,                    -- encrypted at rest ideally; for now store as-is (Supabase service role only)
  refresh_token     text,
  scopes            text[],
  instance_url      text,                    -- salesforce
  portal_id         text,                    -- hubspot
  expires_at        timestamptz,
  connected_by      text,                    -- admin email
  connected_at      timestamptz,
  last_synced_at    timestamptz,
  config            jsonb default '{}'::jsonb,
  unique (tenant_id, provider)
);

create index if not exists tenant_integrations_tenant_idx on tenant_integrations(tenant_id);

-- ─── Tenant invites ─────────────────────────────────────────────────────────
create table if not exists tenant_invites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  email         text not null,
  role          text not null default 'rep',       -- admin | manager | rep | viewer
  token         text not null unique,              -- opaque invite token (URL-safe)
  invited_by    text,
  invited_at    timestamptz default now(),
  expires_at    timestamptz default (now() + interval '14 days'),
  accepted_at   timestamptz,
  revoked_at    timestamptz
);

create index if not exists tenant_invites_token_idx on tenant_invites(token) where accepted_at is null and revoked_at is null;
create index if not exists tenant_invites_tenant_idx on tenant_invites(tenant_id) where accepted_at is null and revoked_at is null;

-- ─── Plain-auth credentials for tenant_users (pre-WorkOS) ───────────────────
-- Added as a sibling column on tenant_users so login can verify bcrypt hash.
alter table tenant_users
  add column if not exists password_hash text,
  add column if not exists password_changed_at timestamptz,
  add column if not exists mfa_secret text,  -- TOTP base32
  add column if not exists last_session_token text;

-- ─── Pre-dial check log (separate from audit_log for high-volume compliance data) ─
create table if not exists predial_checks (
  id              bigserial primary key,
  tenant_id       uuid references tenants(id) on delete cascade,
  phone           text not null,
  prospect_id     text,
  allowed         boolean not null,
  block_reasons   text[] default '{}',
  checks          jsonb default '{}'::jsonb,   -- full 10-point result object
  actor_email     text,
  checked_at      timestamptz default now()
);
create index if not exists predial_checks_tenant_idx on predial_checks(tenant_id, checked_at desc);
create index if not exists predial_checks_phone_idx on predial_checks(tenant_id, phone, checked_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table consent_ledger      enable row level security;
alter table dnc_entries         enable row level security;
alter table audit_log           enable row level security;
alter table tenant_integrations enable row level security;
alter table tenant_invites      enable row level security;
alter table predial_checks      enable row level security;

-- Service role bypasses RLS; admin-key API routes run as service role.
-- These policies apply when tenant users eventually authenticate with JWTs.
drop policy if exists consent_ledger_same_tenant on consent_ledger;
create policy consent_ledger_same_tenant on consent_ledger
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

drop policy if exists dnc_same_tenant_or_global on dnc_entries;
create policy dnc_same_tenant_or_global on dnc_entries
  for all using (tenant_id is null or tenant_id::text = (auth.jwt() ->> 'tenant_id'));

drop policy if exists audit_log_same_tenant on audit_log;
create policy audit_log_same_tenant on audit_log
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

drop policy if exists integrations_same_tenant on tenant_integrations;
create policy integrations_same_tenant on tenant_integrations
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

drop policy if exists invites_same_tenant on tenant_invites;
create policy invites_same_tenant on tenant_invites
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

drop policy if exists predial_same_tenant on predial_checks;
create policy predial_same_tenant on predial_checks
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- ─── Helpful views ─────────────────────────────────────────────────────────
create or replace view tenant_compliance_stats as
select
  t.id as tenant_id,
  t.slug,
  t.name,
  (select count(*) from consent_ledger cl where cl.tenant_id = t.id and cl.revoked_at is null) as active_consents,
  (select count(*) from consent_ledger cl where cl.tenant_id = t.id and cl.revoked_at is not null) as revoked_consents,
  (select count(*) from dnc_entries d where d.tenant_id = t.id and d.removed_at is null) as dnc_internal,
  (select count(*) from predial_checks p where p.tenant_id = t.id and p.allowed and p.checked_at > now() - interval '24 hours') as allowed_24h,
  (select count(*) from predial_checks p where p.tenant_id = t.id and not p.allowed and p.checked_at > now() - interval '24 hours') as blocked_24h
from tenants t
where t.deleted_at is null;

-- ─── Verification query ─────────────────────────────────────────────────────
select 'consent_ledger' as t, count(*) from consent_ledger
union all select 'dnc_entries', count(*) from dnc_entries
union all select 'audit_log', count(*) from audit_log
union all select 'tenant_integrations', count(*) from tenant_integrations
union all select 'tenant_invites', count(*) from tenant_invites
union all select 'predial_checks', count(*) from predial_checks;
