import type { InferLane } from "@meetcopilot/shared";
import { requireEnv } from "./env.js";

// Usage metering writer. Writes usage_sessions / usage_events using the Supabase
// service-role key, which bypasses Row Level Security — keeping metering
// server-authoritative (the client never writes these rows). We talk to PostgREST
// directly over fetch to avoid pulling in a Supabase client dependency.

/** Token usage reported by the model gateway for one inference call. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Per-model Bedrock pricing in USD per 1,000,000 tokens. Used only to estimate
 * cost for the usage meter; exact billing comes from AWS. Keyed by model id.
 * Unknown models fall back to DEFAULT_PRICE so cost is never silently zero.
 */
const MODEL_PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "amazon.nova-lite-v1:0": { input: 0.06, output: 0.24 },
  "amazon.nova-micro-v1:0": { input: 0.035, output: 0.14 },
  "amazon.nova-pro-v1:0": { input: 0.8, output: 3.2 },
  "anthropic.claude-3-5-sonnet-20240620-v1:0": { input: 3.0, output: 15.0 },
  "anthropic.claude-3-5-haiku-20241022-v1:0": { input: 0.8, output: 4.0 },
};
const DEFAULT_PRICE = { input: 3.0, output: 15.0 };

/** Estimates the USD cost of an inference call from its token counts. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = MODEL_PRICES_PER_MILLION[model] ?? DEFAULT_PRICE;
  const cost =
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output;
  // Keep six decimal places to match the cost_usd column precision.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Base URL for the project's PostgREST API (`/rest/v1`). */
export function restBase(): string {
  return `${requireEnv("SUPABASE_URL").replace(/\/+$/, "")}/rest/v1`;
}

/** Headers that authenticate a PostgREST/RPC call as the service role (bypasses RLS). */
export function serviceHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Thrown when a PostgREST/RPC write fails. Callers treat metering as best-effort. */
export class UsageWriteError extends Error {
  constructor(operation: string, status: number, detail: string) {
    super(`usage ${operation} failed (HTTP ${status}): ${detail}`);
    this.name = "UsageWriteError";
  }
}

/**
 * Opens a usage_sessions row for a meeting and returns its id. started_at defaults
 * to now() in the database; ended_at / stt_seconds are filled in by endUsageSession.
 */
export async function createUsageSession(params: {
  userId: string;
  lane: InferLane;
}): Promise<string> {
  const res = await fetch(`${restBase()}/usage_sessions`, {
    method: "POST",
    headers: serviceHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({ user_id: params.userId, model_lane: params.lane }),
  });
  if (!res.ok) {
    throw new UsageWriteError("session insert", res.status, await res.text());
  }
  const rows = (await res.json()) as Array<{ id?: string }>;
  const id = rows[0]?.id;
  if (typeof id !== "string") {
    throw new UsageWriteError("session insert", res.status, "no id in response");
  }
  return id;
}

/**
 * Closes a session via the end_usage_session RPC, which stamps ended_at and derives
 * stt_seconds from started_at in the database. Idempotent: a second call no-ops.
 */
export async function endUsageSession(params: {
  userId: string;
  sessionId: string;
}): Promise<void> {
  const res = await fetch(`${restBase()}/rpc/end_usage_session`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ p_session_id: params.sessionId, p_user_id: params.userId }),
  });
  if (!res.ok) {
    throw new UsageWriteError("session end", res.status, await res.text());
  }
}

/** Records one metered inference call as a usage_events row. */
export async function recordInferenceEvent(params: {
  userId: string;
  sessionId: string;
  model: string;
  usage: TokenUsage;
}): Promise<void> {
  const costUsd = estimateCostUsd(params.model, params.usage);
  const res = await fetch(`${restBase()}/usage_events`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      session_id: params.sessionId,
      user_id: params.userId,
      event_type: "infer",
      model: params.model,
      tokens_in: params.usage.inputTokens,
      tokens_out: params.usage.outputTokens,
      cost_usd: costUsd,
    }),
  });
  if (!res.ok) {
    throw new UsageWriteError("event insert", res.status, await res.text());
  }
}
