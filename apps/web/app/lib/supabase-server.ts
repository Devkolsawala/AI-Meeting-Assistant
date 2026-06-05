// Server-only Supabase helpers for the billing routes. User identity is verified
// against GoTrue; subscription writes use the service role (bypassing RLS) so the
// webhook is the sole authority over subscription status.

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url.replace(/\/+$/, "");
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return key;
}

export interface WebUser {
  id: string;
  email: string | null;
}

/** Verifies a user's Supabase access token and returns their id + email, or null. */
export async function verifyAccessToken(accessToken: string): Promise<WebUser | null> {
  const res = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: anonKey(), Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return null;
  }
  const user = (await res.json()) as { id?: string; email?: string | null };
  if (!user.id) {
    return null;
  }
  return { id: user.id, email: user.email ?? null };
}

export interface SubscriptionRow {
  provider: string | null;
  providerSubscriptionId: string | null;
}

/** Reads a user's subscription provider details (service role), or null if none. */
export async function readSubscription(userId: string): Promise<SubscriptionRow | null> {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/subscriptions?user_id=eq.${userId}&select=provider,provider_subscription_id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`subscription read failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{
    provider?: string | null;
    provider_subscription_id?: string | null;
  }>;
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    provider: row.provider ?? null,
    providerSubscriptionId: row.provider_subscription_id ?? null,
  };
}

/** Parameters for the idempotent process_subscription_event RPC. */
export interface SubscriptionEvent {
  eventId: string;
  eventType: string;
  payload: unknown;
  userId: string;
  status: string;
  plan: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  eventAt: string;
}

/**
 * Applies a subscription event via the atomic, idempotent, out-of-order-safe RPC.
 * Returns true when the event was applied, false when it was a duplicate.
 */
export async function processSubscriptionEvent(event: SubscriptionEvent): Promise<boolean> {
  const key = serviceRoleKey();
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/process_subscription_event`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_event_id: event.eventId,
      p_event_type: event.eventType,
      p_payload: event.payload,
      p_user_id: event.userId,
      p_status: event.status,
      p_plan: event.plan,
      p_provider: event.provider,
      p_provider_customer_id: event.providerCustomerId,
      p_provider_subscription_id: event.providerSubscriptionId,
      p_current_period_end: event.currentPeriodEnd,
      p_event_at: event.eventAt,
    }),
  });
  if (!res.ok) {
    throw new Error(`process_subscription_event failed (HTTP ${res.status}): ${await res.text()}`);
  }
  return (await res.json()) === true;
}
