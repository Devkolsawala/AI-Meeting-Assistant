-- MeetCopilot — Phase 2 Milestone 2: usage aggregate for server-side plan gating.
--
-- ADDITIVE ONLY. Safe to run multiple times (CREATE OR REPLACE). Run after
-- 0002_usage_metering.sql in the Supabase SQL editor.
--
-- get_user_usage returns a user's lifetime metered totals (session count + total
-- STT seconds). The backend calls this with the service role to enforce the free
-- cap before issuing an STT token and before each /infer call. Aggregating in the
-- database keeps the check server-authoritative and cheap.

create or replace function public.get_user_usage(p_user_id uuid)
returns table (session_count bigint, stt_seconds_total numeric)
language sql
stable
as $$
  select
    count(*)::bigint                       as session_count,
    coalesce(sum(stt_seconds), 0)::numeric as stt_seconds_total
  from public.usage_sessions
  where user_id = p_user_id;
$$;
