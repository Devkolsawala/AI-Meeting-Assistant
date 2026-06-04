-- MeetCopilot — Milestone 2: initial schema + Row Level Security.
--
-- ADDITIVE ONLY. Safe to run multiple times (uses IF NOT EXISTS / DROP POLICY IF
-- EXISTS). Run this in the Supabase SQL editor.
--
-- Access model:
--   * users      — each user reads/writes only their own profile row.
--   * personas   — anyone reads built-in personas or their own; users manage only
--                  their own (non-built-in) personas.
--   * subscriptions, usage_sessions, usage_events — users may only SELECT their own
--     rows. There are no client write policies, so billing and usage metering are
--     written exclusively by the backend using the service-role key (which bypasses
--     RLS). This keeps metering/billing server-authoritative.

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- Shared helper: keep updated_at current on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- users (application profile; id mirrors auth.users.id)
-- ============================================================================
create table if not exists public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================================
-- personas (built-in personas have user_id = null and is_built_in = true)
-- ============================================================================
create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  key            text,
  name           text not null,
  description    text,
  system_prompt  text not null,
  notes_template text,
  is_built_in    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Built-in personas are identified by a stable, unique key.
create unique index if not exists personas_builtin_key_uniq
  on public.personas (key) where is_built_in;
create index if not exists personas_user_id_idx on public.personas (user_id);

drop trigger if exists personas_set_updated_at on public.personas;
create trigger personas_set_updated_at
  before update on public.personas
  for each row execute function public.set_updated_at();

alter table public.personas enable row level security;

drop policy if exists personas_select_visible on public.personas;
create policy personas_select_visible on public.personas
  for select using (is_built_in or auth.uid() = user_id);

drop policy if exists personas_insert_own on public.personas;
create policy personas_insert_own on public.personas
  for insert with check (auth.uid() = user_id and is_built_in = false);

drop policy if exists personas_update_own on public.personas;
create policy personas_update_own on public.personas
  for update using (auth.uid() = user_id and is_built_in = false)
  with check (auth.uid() = user_id and is_built_in = false);

drop policy if exists personas_delete_own on public.personas;
create policy personas_delete_own on public.personas
  for delete using (auth.uid() = user_id and is_built_in = false);

-- ============================================================================
-- subscriptions (one per user; written by the backend service role only)
-- ============================================================================
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users (id) on delete cascade,
  status                   text not null default 'inactive'
                             check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  plan                     text not null default 'free',
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Read-only for the owner. No client write policies => writes require service role.
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- usage_sessions (one row per metered meeting; written by the backend only)
-- ============================================================================
create table if not exists public.usage_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null,
  model_lane text,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists usage_sessions_user_started_idx
  on public.usage_sessions (user_id, started_at desc);

alter table public.usage_sessions enable row level security;

drop policy if exists usage_sessions_select_own on public.usage_sessions;
create policy usage_sessions_select_own on public.usage_sessions
  for select using (auth.uid() = user_id);

-- ============================================================================
-- usage_events (granular metering; written by the backend only)
-- ============================================================================
create table if not exists public.usage_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.usage_sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  event_type  text not null,
  model       text,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  stt_seconds numeric(10, 2) not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists usage_events_session_idx on public.usage_events (session_id);
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.usage_events enable row level security;

drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own on public.usage_events
  for select using (auth.uid() = user_id);
