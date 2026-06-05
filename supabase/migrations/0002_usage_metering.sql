-- MeetCopilot — Phase 2 Milestone 1: usage metering columns + helper RPC.
--
-- ADDITIVE ONLY. Safe to run multiple times (uses IF NOT EXISTS / CREATE OR
-- REPLACE). Run this in the Supabase SQL editor after 0001_init_schema.sql.
--
-- What this adds:
--   * usage_sessions.stt_seconds — total speech-to-text seconds for the session,
--     measured server-side as (ended_at - started_at). Written by end_usage_session.
--   * usage_events.cost_usd — estimated cost of the metered event (e.g. an /infer
--     call), computed server-side from token counts. Written by the backend.
--   * end_usage_session(...) — closes an open session atomically and idempotently,
--     so the STT-seconds total can never be tampered with by the client.

-- usage_sessions: server-measured total STT seconds for the meeting.
alter table public.usage_sessions
  add column if not exists stt_seconds numeric(10, 2) not null default 0;

-- usage_events: estimated cost in USD for the event.
alter table public.usage_events
  add column if not exists cost_usd numeric(12, 6) not null default 0;

-- Closes a session: stamps ended_at and derives stt_seconds from the stored
-- started_at, entirely in the database. The `ended_at is null` guard makes a
-- repeated call a no-op (idempotent), and the user_id guard scopes the close to
-- the session's owner. The backend calls this with the service role.
create or replace function public.end_usage_session(p_session_id uuid, p_user_id uuid)
returns void
language sql
as $$
  update public.usage_sessions
     set ended_at    = now(),
         stt_seconds = round(extract(epoch from (now() - started_at))::numeric, 2)
   where id = p_session_id
     and user_id = p_user_id
     and ended_at is null;
$$;
