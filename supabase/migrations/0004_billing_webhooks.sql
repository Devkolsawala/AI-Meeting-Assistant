-- MeetCopilot — Phase 2 Milestone 4: Razorpay billing webhook plumbing.
--
-- ADDITIVE ONLY. Safe to run multiple times. Run after 0003 in the Supabase SQL
-- editor.
--
-- Subscription status is written EXCLUSIVELY by the Razorpay webhook (apps/web),
-- which calls process_subscription_event() with the service role. The function is
-- idempotent (duplicate event ids are no-ops) and out-of-order safe (a stale event
-- can never overwrite a newer one), so retries and reordered deliveries can't
-- corrupt a subscription.

-- ============================================================================
-- webhook_events — every processed Razorpay event id, for idempotency.
-- ============================================================================
create table if not exists public.webhook_events (
  id          text primary key,            -- Razorpay's x-razorpay-event-id
  event_type  text,
  payload     jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
-- No policies: only the backend service role (which bypasses RLS) may read/write.

-- subscriptions: track the timestamp of the last applied event for ordering.
alter table public.subscriptions
  add column if not exists last_event_at timestamptz;

-- ============================================================================
-- process_subscription_event — atomic idempotent + out-of-order-safe upsert.
-- Returns true when the event was applied, false when it was a duplicate.
-- ============================================================================
create or replace function public.process_subscription_event(
  p_event_id                 text,
  p_event_type               text,
  p_payload                  jsonb,
  p_user_id                  uuid,
  p_status                   text,
  p_plan                     text,
  p_provider                 text,
  p_provider_customer_id     text,
  p_provider_subscription_id text,
  p_current_period_end       timestamptz,
  p_event_at                 timestamptz
) returns boolean
language plpgsql
as $$
begin
  -- Idempotency gate: the first writer of this event id wins. A duplicate raises
  -- unique_violation and the whole transaction rolls back (no double-write).
  insert into public.webhook_events (id, event_type, payload)
  values (p_event_id, p_event_type, p_payload);

  -- Upsert the single subscription row for this user. The WHERE on the update
  -- makes a stale (older) event a no-op, so out-of-order delivery is safe.
  insert into public.subscriptions as s
    (user_id, status, plan, provider, provider_customer_id,
     provider_subscription_id, current_period_end, last_event_at)
  values
    (p_user_id, p_status, p_plan, p_provider, p_provider_customer_id,
     p_provider_subscription_id, p_current_period_end, p_event_at)
  on conflict (user_id) do update set
    status                   = excluded.status,
    plan                     = excluded.plan,
    provider                 = excluded.provider,
    provider_customer_id     = coalesce(excluded.provider_customer_id, s.provider_customer_id),
    provider_subscription_id = coalesce(excluded.provider_subscription_id, s.provider_subscription_id),
    current_period_end       = excluded.current_period_end,
    last_event_at            = excluded.last_event_at
  where s.last_event_at is null or excluded.last_event_at >= s.last_event_at;

  return true;
exception
  when unique_violation then
    -- Event already processed; nothing is written.
    return false;
end;
$$;
