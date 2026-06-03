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
--                    computed ATOMICALLY in a BEFORE INSERT trigger (pgcrypto +
--                    a per-table advisory transaction lock) so concurrent
--                    inserts cannot interleave and break the chain. The API
--                    layer (lib/atom-ops/audit.ts) NO LONGER computes the chain.
--   ops_macros     — named, reusable ops playbooks (e.g. morning-brief, release).
--
-- REQUIRED EXTENSION: pgcrypto (for digest()/SHA-256). Created below.
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
-- Extensions
-- ----------------------------------------------------------------------
-- pgcrypto provides digest() used for the audit SHA-256 hash chain.
-- gen_random_uuid() is provided by pgcrypto on modern Postgres / Supabase.
-- ────────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

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
  prior_hash    text,                            -- SHA-256 chain (set by ops_audit_chain trigger)
  entry_hash    text,                            -- SHA-256 chain (set by ops_audit_chain trigger)
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

-- ────────────────────────────────────────────────────────────────────
-- Tamper-evident hash chain — computed in-database, atomically.
-- ----------------------------------------------------------------------
-- WHY in the DB: the previous design read the latest entry_hash in the app,
-- computed the next hash, then inserted — a read→compute→insert race. Two
-- concurrent ATOM Ops requests (e.g. console + Telegram, or a cron + console)
-- could read the same prior_hash and fork the chain. Moving the chaining into a
-- BEFORE INSERT trigger guarded by a per-table advisory TRANSACTION lock makes
-- the read-of-tip + compute + insert a single serialized critical section. The
-- lock is released automatically at COMMIT/ROLLBACK (xact-scoped), so a crashed
-- transaction cannot wedge the chain.
--
-- Canonicalization: jsonb is unordered, so we recursively sort object keys to a
-- deterministic text form. The hashed payload mirrors the field set the app
-- used to hash, so external verifiers can recompute it.
-- ────────────────────────────────────────────────────────────────────

-- Deterministic, key-sorted JSON text for a jsonb value (recursive).
create or replace function public.ops_jsonb_canonical(v jsonb)
returns text
language sql
immutable
as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then 'null'
    when jsonb_typeof(v) = 'object' then
      '{' || coalesce(
        (select string_agg(
                  to_json(kv.key)::text || ':' || public.ops_jsonb_canonical(kv.value),
                  ',' order by kv.key)
         from jsonb_each(v) as kv(key, value)),
        '') || '}'
    when jsonb_typeof(v) = 'array' then
      '[' || coalesce(
        (select string_agg(public.ops_jsonb_canonical(elem), ','
                           order by ord)
         from jsonb_array_elements(v) with ordinality as a(elem, ord)),
        '') || ']'
    else v::text
  end;
$$;

comment on function public.ops_jsonb_canonical(jsonb) is
  'ATOM Ops: deterministic key-sorted JSON text used for audit hash canonicalization.';

create or replace function public.ops_audit_chain()
returns trigger
language plpgsql
as $$
declare
  v_prior text;
  v_canonical text;
begin
  -- Serialize all concurrent inserts to ops_audit_log within this txn. Any
  -- positive bigint key works; this one is arbitrary-but-stable for the table.
  perform pg_advisory_xact_lock(hashtext('ops_audit_log_chain'));

  -- Read the current tip of the chain (most recent committed row). Under the
  -- advisory lock this read + the subsequent insert are effectively serial.
  select entry_hash
    into v_prior
    from ops_audit_log
   order by created_at desc, id desc
   limit 1;

  v_prior := coalesce(v_prior, '');
  new.prior_hash := v_prior;

  v_canonical := json_build_object(
    'actor_email',    new.actor_email,
    'actor_role',     new.actor_role,
    'intent',         new.intent,
    'tool',           new.tool,
    'action',         new.action,
    'destructive',    new.destructive,
    'phase',          new.phase,
    'result',         new.result,
    'summary',        new.summary,
    'params',         public.ops_jsonb_canonical(coalesce(new.params, '{}'::jsonb)),
    'data',           public.ops_jsonb_canonical(new.data),
    'reason',         new.reason,
    'source',         new.source,
    'confirmation_id', new.confirmation_id,
    'prior_hash',     v_prior
  )::text;

  new.entry_hash := encode(digest(v_canonical, 'sha256'), 'hex');
  return new;
end;
$$;

comment on function public.ops_audit_chain() is
  'ATOM Ops: BEFORE INSERT trigger that atomically computes prior_hash + entry_hash under an advisory xact lock. Replaces the app-side read→compute→insert race.';

drop trigger if exists trg_ops_audit_chain on ops_audit_log;
create trigger trg_ops_audit_chain
  before insert on ops_audit_log
  for each row execute function public.ops_audit_chain();

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
-- ops_pending_confirmations (REQUIRED persistence for Plan→Confirm→Execute)
-- ----------------------------------------------------------------------
-- In production/serverless the orchestrator REQUIRES this table: a plan created
-- on one warm instance must be redeemable from another, so the pending op is
-- persisted here (not memory-only). A failed persist surfaces as an error
-- (see lib/atom-ops/confirm.ts). Rows expire after 5 minutes; a scheduled job
-- (or the cron route) may prune them. `source` + `session_id` bind a plan to the
-- identity that created it so only that actor/channel/session can redeem it.
-- ────────────────────────────────────────────────────────────────────
create table if not exists ops_pending_confirmations (
  confirmation_id text primary key,
  intent          text not null,
  tool            text not null,
  action          text not null,
  summary         text,
  params          jsonb not null default '{}'::jsonb,
  actor_email     text not null,
  source          text not null default 'console'   -- console | telegram | cron | api
                  check (source in ('console','telegram','cron','api')),
  session_id      text not null default '',          -- identity binding for redemption
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

-- Backfill columns for an already-applied migration (idempotent).
alter table ops_pending_confirmations
  add column if not exists source text not null default 'console';
alter table ops_pending_confirmations
  add column if not exists session_id text not null default '';

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
-- ops_rate_limits — DB-backed sliding-window rate limiting.
-- ----------------------------------------------------------------------
-- In-process counters do not hold across serverless instances, so the 60/min
-- cap was previously per-instance (a caller could exceed it by hitting multiple
-- warm lambdas). This fixed-window counter is shared across instances. The
-- function increments atomically (INSERT ... ON CONFLICT) and returns whether
-- the request is allowed plus the current count.
-- ────────────────────────────────────────────────────────────────────
create table if not exists ops_rate_limits (
  bucket_key   text not null,            -- e.g. session id or "telegram:<chat>"
  window_start timestamptz not null,     -- start of the fixed window
  count        integer not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists idx_ops_rate_limits_window
  on ops_rate_limits (window_start);

alter table ops_rate_limits enable row level security;
-- No authenticated/anon policies → only the service role (server) can touch it.

-- Atomically count one hit in the current fixed window and report allow/deny.
-- p_window_seconds defines the window length; p_max the cap within it.
create or replace function public.ops_rate_limit_hit(
  p_bucket_key text,
  p_max integer default 60,
  p_window_seconds integer default 60
)
returns table(allowed boolean, current_count integer)
language plpgsql
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- Floor now() to the start of the current fixed window.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into ops_rate_limits (bucket_key, window_start, count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = ops_rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup of stale windows (keep the table small).
  delete from ops_rate_limits
   where window_start < now() - (p_window_seconds * 5 || ' seconds')::interval;

  return query select (v_count <= p_max) as allowed, v_count as current_count;
end;
$$;

comment on function public.ops_rate_limit_hit(text, integer, integer) is
  'ATOM Ops: cross-instance fixed-window rate limit. Returns (allowed, current_count).';

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
