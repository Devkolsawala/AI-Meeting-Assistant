import type { UsageLimits, UsageSnapshot } from "@meetcopilot/shared";
import { authDisabled } from "./auth.js";
import { restBase, serviceHeaders } from "./usage.js";

// Server-side plan gating. Reads the user's plan (subscriptions) and lifetime
// metered usage (usage_sessions) with the service role, then decides whether a new
// STT session or /infer call is allowed. The client is never trusted for this.

function intEnv(key: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[key] ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function floatEnv(key: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[key] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Free-tier caps (config values). A user is blocked at EITHER cap. */
const FREE_MAX_SESSIONS = intEnv("FREE_MAX_SESSIONS", 2);
const FREE_MAX_STT_SECONDS = intEnv("FREE_MAX_STT_SECONDS", 180);
/** Fraction of a cap at which the desktop shows a soft "approaching limit" warning. */
const WARN_RATIO = floatEnv("USAGE_WARN_RATIO", 0.8);

interface PlanInfo {
  plan: string;
  /** True when the subscription is in a paying/active state (caps are raised). */
  active: boolean;
}

/** Reads the user's subscription row; defaults to the free, inactive plan. */
async function readPlan(userId: string): Promise<PlanInfo> {
  const url = `${restBase()}/subscriptions?user_id=eq.${userId}&select=plan,status&limit=1`;
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) {
    throw new Error(`subscriptions read failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ plan?: string; status?: string }>;
  const row = rows[0];
  const plan = row?.plan ?? "free";
  const status = row?.status ?? "inactive";
  const active = (status === "active" || status === "trialing") && plan !== "free";
  return { plan, active };
}

/** Reads the user's lifetime metered totals via the get_user_usage RPC. */
async function readUsage(userId: string): Promise<{ sessions: number; sttSeconds: number }> {
  const res = await fetch(`${restBase()}/rpc/get_user_usage`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!res.ok) {
    throw new Error(`usage read failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ session_count?: number; stt_seconds_total?: number }>;
  const row = rows[0];
  return {
    sessions: Number(row?.session_count ?? 0),
    sttSeconds: Number(row?.stt_seconds_total ?? 0),
  };
}

/** Paid/active plans are unlimited for now; M4 refines per-plan caps. */
function limitsForPlan(active: boolean): UsageLimits {
  if (active) {
    return { maxSessions: null, maxSttSeconds: null };
  }
  return { maxSessions: FREE_MAX_SESSIONS, maxSttSeconds: FREE_MAX_STT_SECONDS };
}

function isOverLimit(usage: { sessions: number; sttSeconds: number }, limits: UsageLimits): boolean {
  if (limits.maxSessions !== null && usage.sessions >= limits.maxSessions) {
    return true;
  }
  return limits.maxSttSeconds !== null && usage.sttSeconds >= limits.maxSttSeconds;
}

function isWarning(usage: { sessions: number; sttSeconds: number }, limits: UsageLimits): boolean {
  if (limits.maxSessions !== null && usage.sessions >= limits.maxSessions * WARN_RATIO) {
    return true;
  }
  return limits.maxSttSeconds !== null && usage.sttSeconds >= limits.maxSttSeconds * WARN_RATIO;
}

/**
 * Computes the user's plan + usage snapshot used to gate STT sessions and /infer.
 * `overLimit` blocks further usage; `warn` is the soft 80% threshold.
 */
export async function getUsageSnapshot(userId: string): Promise<UsageSnapshot> {
  // AUTH_DISABLED — testing mode: report unlimited usage (no Supabase reads, never
  // over cap) so /infer and /stt-token work without a configured plan/subscription.
  if (authDisabled()) {
    return {
      plan: "pro",
      sessions: 0,
      sttSeconds: 0,
      limits: { maxSessions: null, maxSttSeconds: null },
      overLimit: false,
      warn: false,
    };
  }
  const [plan, usage] = await Promise.all([readPlan(userId), readUsage(userId)]);
  const limits = limitsForPlan(plan.active);
  const overLimit = isOverLimit(usage, limits);
  return {
    plan: plan.plan,
    sessions: usage.sessions,
    sttSeconds: usage.sttSeconds,
    limits,
    overLimit,
    warn: !overLimit && isWarning(usage, limits),
  };
}
