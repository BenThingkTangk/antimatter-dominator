-- ════════════════════════════════════════════════════════════════════
-- ATOM OPS — SUPERADMIN DIGITAL WORKER v1.0
-- Step 1: Supabase schema migration
-- ════════════════════════════════════════════════════════════════════
--
-- Apply against the Supabase SQL editor (or `psql` connection string).
-- This is NOT auto-applied by CI. See ATOM_OPS_README.md → "Apply the migration".
--
-- Tables:
--   ops_audit_log  — append-only record of every ATOM Ops action (plan/confirm/
--                    execute/cancel). Tamper-evident via SHA-256 hash chaining
--                    written by the API layer (lib/atom-ops/audit.ts).
--   ops_macros     — named, reusable ops playbooks (e.g. morning-brief, release).
--
-- SECURITY MODEL / ASSUMPTIONS
-- ----------------------------------------------------------------------
-- This repo authenticates via a custom `tenant_users` + `user_sessions` table
-- (see api/auth/*.ts), NOT Supabase Auth (auth.uid()). The server talks to
-- Supabase exclusively with the SERVICE ROLE key, which bypasses RLS. Therefore
-- the *effective* gate for ATOM Ops is enforced in the API/middleware layer
-- (superadmin-only, via NIRMATA_HQ_EMAILS allowlist + tenant_users.role).
--
-- RLS below is defense-in-depth: it locks both tables down so that ANON and
-- AUTHENTICATED Postgres roles get ZERO access. Only the service role (used by
-- the server) and the postgres owner can read/write. We additionally provide a
-- helper `public.is_superadmin()` so that if/when this project migrates to
-- Supabase Auth + a `profiles` table, the policies already express intent and
-- can be tightened to per-user checks by uncommenting the marked policies.
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- Helper: is_superadmin()
-- ----------------------------------------------------------------------
-- Best-effort superadmin check that works whether or not a `profiles` table
-- exists. Resolution order:
--   1. JWT app_metadata.role == 'superadmin' (Supabase Auth + custom claim)
--   2. profiles.role == 'superadmin' for auth.uid()  (if profiles table exists)
-- Returns false when neither is available (e.g. anon). The service role bypasses
-- RLS entirely so server writes are unaffected by this function returning false.
-- ────────────────────────────────────────────────────────────────────
create or replace function public.is_superadmin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_has_profiles boolean;
begin
  -- 1) JWT custom claim (app_metadata.role)
  begin
    v_role := coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
    );
  exception when others then
    v_role := null;
  end;
  if v_role = 'superadmin' then
    return true;
  end if;

  -- 2) profiles.role lookup (only if a profiles table is present)
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) into v_has_profiles;

  if v_has_profiles then
    begin
      execute
        'select role from public.profiles where id = auth.uid()'
        into v_role;
    exception when others then
      v_role := null;
    end;
    if v_role = 'superadmin' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

comment on function public.is_superadmin() is
  'ATOM Ops: returns true if the current Postgres/JWT identity is a superadmin. Server uses the service role (bypasses RLS); this is defense-in-depth for any future Supabase-Auth client path.';

-- ────────────────────────────────────────────────────────────────────
-- ops_audit_log
-- ────────────────────────────────────────────────────────────────────
create table if not exists ops_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_email   text not null,
  actor_role    text,
  intent        text not null,                 -- raw intent string, e.g. "github.createPR ..."
  tool          text,                          -- resolved tool, e.g. "github"
  action        text,                          -- resolved action, e.g. "createPR"
  destructive   boolean not null default false,
  phase         text not null default 'execute' -- plan | confirm | execute | cancel | error
                check (phase in ('plan','confirm','execute','cancel','error')),
  result        text not null default 'ok'      -- ok | blocked | error
                check (result in ('ok','blocked','error')),
  summary       text,
  params        jsonb default '{}'::jsonb,
  data          jsonb,                          -- tool result payload (may be redacted)
  reason        text,                           -- failure / cancel reason
  source        text default 'console'          -- console | telegram | cron | api
                check (source in ('console','telegram','cron','api')),
  confirmation_id text,                          -- ties plan → execute/cancel
  prior_hash    text,                            -- SHA-256 chain (written by audit.ts)
  entry_hash    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ops_audit_created
  on ops_audit_log (created_at desc);
create index if not exists idx_ops_audit_actor
  on ops_audit_log (actor_email, created_at desc);
create index if not exists idx_ops_audit_tool_action
  on ops_audit_log (tool, action);
create index if not exists idx_ops_audit_confirmation
  on ops_audit_log (confirmation_id);

-- RLS: deny all to anon/authenticated; service role bypasses RLS.
alter table ops_audit_log enable row level security;
-- Append-only intent: forbid UPDATE/DELETE even for roles that could otherwise
-- reach the table. (No permissive policy for update/delete is created.)

-- Defense-in-depth read policy for a future Supabase-Auth client path.
-- Safe no-op today because no client connects with a user JWT.
drop policy if exists ops_audit_superadmin_select on ops_audit_log;
create policy ops_audit_superadmin_select
  on ops_audit_log
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists ops_audit_superadmin_insert on ops_audit_log;
create policy ops_audit_superadmin_insert
  on ops_audit_log
  for insert
  to authenticated
  with check (public.is_superadmin());

-- ────────────────────────────────────────────────────────────────────
-- ops_macros
-- ────────────────────────────────────────────────────────────────────
create table if not exists ops_macros (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,           -- e.g. 'morning-brief', 'release'
  title         text not null,
  description   text,
  destructive   boolean not null default false, -- true if any step is destructive
  steps         jsonb not null default '[]'::jsonb, -- ordered list of intent strings
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_ops_macros_slug on ops_macros (slug);

alter table ops_macros enable row level security;

drop policy if exists ops_macros_superadmin_select on ops_macros;
create policy ops_macros_superadmin_select
  on ops_macros
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists ops_macros_superadmin_write on ops_macros;
create policy ops_macros_superadmin_write
  on ops_macros
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- keep updated_at fresh
create or replace function public.ops_macros_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ops_macros_touch on ops_macros;
create trigger trg_ops_macros_touch
  before update on ops_macros
  for each row execute function public.ops_macros_touch_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- ops_pending_confirmations (OPTIONAL persistence for Plan→Confirm→Execute)
-- ----------------------------------------------------------------------
-- The orchestrator keeps pending destructive ops in-memory and ALSO persists
-- here (best-effort) so a pending op survives a serverless cold start. Rows
-- expire after 5 minutes; a scheduled job (or the cron route) may prune them.
-- ────────────────────────────────────────────────────────────────────
create table if not exists ops_pending_confirmations (
  confirmation_id text primary key,
  intent          text not null,
  tool            text not null,
  action          text not null,
  summary         text,
  params          jsonb not null default '{}'::jsonb,
  actor_email     text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists idx_ops_pending_expires
  on ops_pending_confirmations (expires_at);

alter table ops_pending_confirmations enable row level security;

drop policy if exists ops_pending_superadmin_all on ops_pending_confirmations;
create policy ops_pending_superadmin_all
  on ops_pending_confirmations
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ────────────────────────────────────────────────────────────────────
-- Seed macros: morning-brief (non-destructive) + release (destructive)
-- ────────────────────────────────────────────────────────────────────
insert into ops_macros (slug, title, description, destructive, steps)
values
  (
    'morning-brief',
    'Morning Brief',
    'Non-destructive daily snapshot: open PRs, Sentry errors, MRR/churn, deploy + number health.',
    false,
    '[
      "github.listOpenPRs",
      "sentry.readSentryErrors",
      "stripe.lookupMRR",
      "stripe.lookupChurn",
      "vercel.tailLogs",
      "twilio.checkNumberHealth"
    ]'::jsonb
  ),
  (
    'release',
    'Release',
    'Ship pipeline: merge approved PR after CI, draft release notes, trigger deploy, promote preview to prod. DESTRUCTIVE — requires confirmation at each mutating step.',
    true,
    '[
      "github.mergePRAfterCI",
      "github.draftRelease",
      "vercel.triggerDeploy",
      "vercel.promotePreviewToProd"
    ]'::jsonb
  )
on conflict (slug) do update
  set title       = excluded.title,
      description = excluded.description,
      destructive = excluded.destructive,
      steps       = excluded.steps,
      updated_at  = now();

-- ════════════════════════════════════════════════════════════════════
-- End of ATOM Ops migration.
-- ════════════════════════════════════════════════════════════════════
