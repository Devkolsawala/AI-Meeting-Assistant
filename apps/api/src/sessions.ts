import type { Context } from "hono";
import { APP_NAME, type InferLane } from "@meetcopilot/shared";
import { AuthError, authDisabled } from "./auth.js";
import { getUsageSnapshot } from "./limits.js";
import { limitReachedResponse, requireUserId } from "./route-helpers.js";
import { captureEvent } from "./telemetry.js";
import { createUsageSession, endUsageSession } from "./usage.js";

function parseLane(value: unknown): InferLane {
  return value === "smart" ? "smart" : "fast";
}

/**
 * POST /session/start — gates on the user's plan, then opens a usage_sessions row.
 * Returns { sessionId, usage } when allowed, or a 402 limit_reached payload.
 */
export async function handleSessionStart(c: Context): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }

  const usage = await getUsageSnapshot(userId);
  if (usage.overLimit) {
    captureEvent("hit_cap", userId, { plan: usage.plan, endpoint: "session-start" });
    return limitReachedResponse(c, usage);
  }

  // AUTH_DISABLED — testing mode: return a mock session id without a Supabase write.
  if (authDisabled()) {
    return c.json({ sessionId: `mock-${Date.now()}`, usage });
  }

  const body = (await c.req.json().catch(() => ({}))) as { lane?: unknown };
  const sessionId = await createUsageSession({ userId, lane: parseLane(body.lane) });
  return c.json({ sessionId, usage });
}

/** POST /session/end — closes the session (idempotent; stt_seconds derived server-side). */
export async function handleSessionEnd(c: Context): Promise<Response> {
  let userId: string;
  try {
    userId = await requireUserId(c);
  } catch (err) {
    if (err instanceof AuthError) {
      return c.json({ error: err.message }, 401);
    }
    throw err;
  }

  const body = (await c.req.json().catch(() => ({}))) as { sessionId?: unknown };
  if (typeof body.sessionId !== "string" || body.sessionId.length === 0) {
    return c.json({ error: "Missing sessionId" }, 400);
  }

  // AUTH_DISABLED — testing mode: nothing was persisted, so closing is a no-op.
  if (authDisabled()) {
    return c.json({ ok: true });
  }

  try {
    await endUsageSession({ userId, sessionId: body.sessionId });
    return c.json({ ok: true });
  } catch (err) {
    // Metering must not surface as a hard client error; log and report a soft failure.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${APP_NAME}] /session/end metering error: ${message}`);
    return c.json({ ok: false }, 200);
  }
}
