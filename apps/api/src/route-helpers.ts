import type { Context } from "hono";
import { LIMIT_REACHED, type UsageSnapshot } from "@meetcopilot/shared";
import { authDisabled, bearerToken, MOCK_USER_ID, verifySupabaseJwt } from "./auth.js";

// Small shared helpers for authenticated, usage-gated routes so /session, /infer,
// and /stt-token apply auth and plan limits the same way.

/** Verifies the caller's Supabase JWT and returns their user id, or throws AuthError. */
export async function requireUserId(c: Context): Promise<string> {
  // AUTH_DISABLED — testing mode: skip JWT verification and act as the mock user.
  if (authDisabled()) {
    return MOCK_USER_ID;
  }
  const token = bearerToken(c.req.header("Authorization"));
  return (await verifySupabaseJwt(token)).userId;
}

/** Builds the standard HTTP 402 limit_reached response carrying the usage snapshot. */
export function limitReachedResponse(c: Context, usage: UsageSnapshot): Response {
  return c.json({ error: LIMIT_REACHED, usage }, 402);
}
