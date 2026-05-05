-- ═══════════════════════════════════════════════════════════════════════════
-- ATOM Tenants Schema — apply to Supabase
-- Project: tzwpjxyqdlgcvgownxno
-- URL:     https://supabase.com/dashboard/project/tzwpjxyqdlgcvgownxno/sql
--
-- Click "+ New query", paste this whole file, click "Run".
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tenants (multi-tenant white-label)
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  primary_hex text default '#ef4444',
  accent_hex  text default '#06b6d4',
  plan text not null default 'trial',          -- trial | growth | advisory | enterprise
  admin_email text,
  -- Optional per-tenant overrides
  hume_config_id text,                          -- override default Hume config
  twilio_subaccount_sid text,                   -- per-tenant Twilio subaccount
  twilio_phone_number text,                     -- their own outbound number (optional)
  stripe_customer_id text unique,
  stripe_subscription_id text,
  -- Brand customization (extra)
  custom_domain text,                           -- alternative to {slug}.atomdominator.com
  hero_tagline text,
  -- Lifecycle
  created_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists tenants_slug_idx on tenants(slug) where deleted_at is null;
create index if not exists tenants_domain_idx on tenants(custom_domain) where deleted_at is null;

-- Tenant users (RBAC)
create table if not exists tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'rep',             -- admin | manager | rep | viewer
  invited_by uuid,
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  last_login_at timestamptz,
  deleted_at timestamptz,
  unique (tenant_id, email)
);

create index if not exists tenant_users_tenant_idx on tenant_users(tenant_id) where deleted_at is null;

-- Per-tenant call records (replaces the global atom_calls usage pattern)
-- This lets us enforce row-level isolation when WorkOS auth lands.
create table if not exists tenant_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references tenant_users(id),
  call_sid text not null,
  hume_session_id text,
  to_number text not null,
  from_number text,
  contact_name text,
  company_name text,
  product_name text,
  status text,
  duration_s int,
  final_sentiment numeric,                       -- -100..100
  final_intent numeric,                          -- 0..100
  final_stage int,                               -- 1..4
  recording_url text,
  transcript_url text,
  buying_signals text[] default '{}',
  outcome text,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create index if not exists tenant_calls_tenant_idx on tenant_calls(tenant_id, started_at desc);
create index if not exists tenant_calls_sid_idx on tenant_calls(call_sid);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table tenants       enable row level security;
alter table tenant_users  enable row level security;
alter table tenant_calls  enable row level security;

-- Public READ for tenants (so the marketing page / GET /api/tenant works)
drop policy if exists tenants_public_read on tenants;
create policy tenants_public_read on tenants for select using (deleted_at is null);

-- Tenant users: only members of the same tenant can see each other
drop policy if exists tenant_users_same_tenant on tenant_users;
create policy tenant_users_same_tenant on tenant_users
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- Tenant calls: only members of the same tenant
drop policy if exists tenant_calls_same_tenant on tenant_calls;
create policy tenant_calls_same_tenant on tenant_calls
  for all using (tenant_id::text = (auth.jwt() ->> 'tenant_id'));

-- ─── Seed default tenants ────────────────────────────────────────────────────
insert into tenants (slug, name, primary_hex, accent_hex, plan, hero_tagline)
values
  ('antimatter',   'AntimatterAI',     '#ef4444', '#06b6d4', 'enterprise', 'AI-powered outbound that closes.'),
  ('deady',        'The Deady Group',  '#0ea5e9', '#a78bfa', 'enterprise', 'Outbound advisory at scale.'),
  ('intelisys',    'Intelisys',        '#10b981', '#fbbf24', 'enterprise', 'Channel partner intelligence.')
on conflict (slug) do nothing;

-- ─── Done ────────────────────────────────────────────────────────────────────
select 'tenants' as t, count(*) from tenants
union all select 'tenant_users', count(*) from tenant_users
union all select 'tenant_calls', count(*) from tenant_calls;
