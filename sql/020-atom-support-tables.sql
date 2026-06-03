-- ATOM Support v1 — customer-facing AI support agent tables
-- Run against Supabase SQL editor (or psql). All tables service-role only (RLS on).
--
-- Tables:
--   support_chunks        — RAG knowledge base: chunked docs + embeddings (pgvector)
--   support_conversations — one row per chat session
--   support_messages      — every user/assistant turn, with citations + confidence
--   support_feedback      — thumbs up/down per assistant answer (eval signal)
--   support_escalations   — escalation tickets routed to Slack/Plain/Linear
--   support_action_log    — audit trail for the 3 whitelisted autonomous actions
--
-- Multi-tenant: every row carries tenant_id (nullable for logged-out marketing
-- traffic, which lives under the synthetic "public" scope). Retrieval filters on
-- tenant_visibility so a tenant never sees another tenant's private docs.

-- Enable pgvector if available (no-op if already enabled).
create extension if not exists vector;

-- ────────────────────────────────────────────────────────────────────
-- support_chunks — RAG knowledge base
-- ────────────────────────────────────────────────────────────────────
-- BGE-M3 is 1024-dim. We store vector(1024); the ingest pipeline pads/asserts
-- dimension. content_type: doc | playbook | help | changelog | status | roadmap.
-- tenant_visibility: 'public' (all tenants + logged-out) or a tenant slug.
create table if not exists support_chunks (
  id                uuid primary key default gen_random_uuid(),
  source_title      text not null,
  source_url        text,                       -- public URL or repo path
  source_path       text,                       -- on-disk path when ingested from repo
  heading           text,                       -- nearest section heading
  chunk_index       integer not null default 0, -- ordinal within the source
  content           text not null,
  content_type      text not null default 'doc',
  tenant_visibility text not null default 'public',
  embedding         vector(1024),
  token_estimate    integer default 0,
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
);

create index if not exists support_chunks_visibility_idx
  on support_chunks(tenant_visibility, content_type);
create index if not exists support_chunks_source_idx
  on support_chunks(source_title);
-- pgvector ANN index (cosine). Safe to skip if vector ext unavailable.
do $$ begin
  execute 'create index if not exists support_chunks_embedding_idx
    on support_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100)';
exception when others then
  raise notice 'skipping ivfflat index: %', sqlerrm;
end $$;

alter table support_chunks enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- support_conversations
-- ────────────────────────────────────────────────────────────────────
create table if not exists support_conversations (
  id              uuid primary key default gen_random_uuid(),
  session_id      text not null,                -- stable per-browser id
  tenant_id       uuid references tenants(id) on delete set null,
  tenant_slug     text,                         -- denormalized for fast admin filtering
  user_id         uuid,                         -- tenant_users.id when logged in
  surface         text not null default 'app',  -- app | marketing
  user_tier       text default 'public',        -- starter | scale | partner | public
  last_confidence real,
  escalated       boolean default false,
  message_count   integer default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists support_conversations_session_idx
  on support_conversations(session_id);
create index if not exists support_conversations_tenant_idx
  on support_conversations(tenant_slug, created_at desc);

alter table support_conversations enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- support_messages
-- ────────────────────────────────────────────────────────────────────
create table if not exists support_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid references support_conversations(id) on delete cascade,
  session_id        text not null,
  tenant_slug       text,
  role              text not null,              -- user | assistant
  content           text not null,
  citations         jsonb default '[]'::jsonb,  -- [{title,url,heading,chunkId}]
  confidence        real,
  model             text,
  failure_category  text,                       -- set on negative feedback / no-source
  created_at        timestamptz default now()
);

create index if not exists support_messages_conv_idx
  on support_messages(conversation_id, created_at);
create index if not exists support_messages_tenant_idx
  on support_messages(tenant_slug, created_at desc);

alter table support_messages enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- support_feedback
-- ────────────────────────────────────────────────────────────────────
create table if not exists support_feedback (
  id                uuid primary key default gen_random_uuid(),
  message_id        uuid references support_messages(id) on delete cascade,
  conversation_id   uuid,
  session_id        text,
  tenant_slug       text,
  user_tier         text,
  verdict           text not null,              -- helpful | not_helpful
  reason            text,
  question          text,
  answer            text,
  citations         jsonb default '[]'::jsonb,
  confidence        real,
  escalated         boolean default false,
  model             text,
  failure_category  text,
  created_at        timestamptz default now()
);

create index if not exists support_feedback_verdict_idx
  on support_feedback(verdict, created_at desc);
create index if not exists support_feedback_tenant_idx
  on support_feedback(tenant_slug, created_at desc);

alter table support_feedback enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- support_escalations
-- ────────────────────────────────────────────────────────────────────
create table if not exists support_escalations (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid,
  session_id        text,
  tenant_id         uuid references tenants(id) on delete set null,
  tenant_slug       text,
  user_id           uuid,
  user_email        text,
  user_tier         text,
  trigger_reason    text not null,              -- low_confidence | hard_block | keyword | user_request | ...
  severity          text not null default 'normal', -- low | normal | high | critical
  confidence        real,
  transcript        jsonb default '[]'::jsonb,
  retrieved_docs    jsonb default '[]'::jsonb,
  recommended_action text,
  provider          text,                       -- slack | plain | linear | logged
  provider_ref      text,                       -- external ticket id / message ts
  status            text not null default 'open', -- open | acked | resolved
  created_at        timestamptz default now()
);

create index if not exists support_escalations_status_idx
  on support_escalations(status, created_at desc);
create index if not exists support_escalations_tenant_idx
  on support_escalations(tenant_slug, created_at desc);

alter table support_escalations enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- support_action_log — audit trail for whitelisted autonomous actions
-- ────────────────────────────────────────────────────────────────────
create table if not exists support_action_log (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,                  -- resend_verification | restart_campaign | regenerate_api_key
  tenant_id     uuid references tenants(id) on delete set null,
  tenant_slug   text,
  user_id       uuid,
  actor_email   text,
  resource      text,                           -- campaign:uuid | apikey:uuid | email:...
  result        text not null default 'ok',     -- ok | denied | error | escalated
  reason        text,
  payload       jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

create index if not exists support_action_log_tenant_idx
  on support_action_log(tenant_slug, created_at desc);
create index if not exists support_action_log_action_idx
  on support_action_log(action, created_at desc);

alter table support_action_log enable row level security;

-- ────────────────────────────────────────────────────────────────────
-- match_support_chunks — cosine similarity retrieval RPC (pgvector)
-- ────────────────────────────────────────────────────────────────────
-- Mirrors the match_chat_memory pattern already used by atom-chat. Returns the
-- top-N chunks visible to the caller's tenant (their slug OR 'public').
create or replace function match_support_chunks(
  query_embedding   vector(1024),
  match_count       int default 6,
  match_visibility  text default 'public',
  match_threshold   float default 0.30
)
returns table (
  id uuid,
  source_title text,
  source_url text,
  source_path text,
  heading text,
  content text,
  content_type text,
  updated_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    c.id, c.source_title, c.source_url, c.source_path, c.heading,
    c.content, c.content_type, c.updated_at,
    1 - (c.embedding <=> query_embedding) as similarity
  from support_chunks c
  where c.embedding is not null
    and (c.tenant_visibility = match_visibility or c.tenant_visibility = 'public')
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
