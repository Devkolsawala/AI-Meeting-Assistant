// Lightweight, dependency-free telemetry over each provider's HTTP ingestion API.
// Every function is best-effort: it swallows its own errors so telemetry can never
// break the app, and callers pass config explicitly (the per-app wrappers read env
// and no-op when a provider is unconfigured). Works in Node and the browser (fetch
// + globalThis.crypto are available in both).

function uuid(): string {
  return crypto.randomUUID();
}

function base64(input: string): string {
  return btoa(input);
}

// ---------------------------------------------------------------------------
// Sentry — error/crash reporting via the envelope endpoint.
// ---------------------------------------------------------------------------

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
}

interface ParsedDsn {
  ingestUrl: string;
  publicKey: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !projectId) {
      return null;
    }
    return {
      ingestUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

/** Reports an error to Sentry. The platform tags the runtime (node | javascript). */
export async function sentryCaptureException(
  config: SentryConfig,
  error: unknown,
  options: { platform?: string; tags?: Record<string, string>; extra?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const parsed = parseDsn(config.dsn);
    if (!parsed) {
      return;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = uuid().replace(/-/g, "");
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: options.platform ?? "node",
      level: "error",
      environment: config.environment,
      release: config.release,
      tags: options.tags,
      exception: { values: [{ type: err.name || "Error", value: err.message || String(err) }] },
      extra: { stack: err.stack, ...options.extra },
    };
    const body = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");
    await fetch(`${parsed.ingestUrl}?sentry_key=${parsed.publicKey}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    });
  } catch {
    // Telemetry must never throw.
  }
}

// ---------------------------------------------------------------------------
// PostHog — product event capture.
// ---------------------------------------------------------------------------

export interface PosthogConfig {
  host: string;
  key: string;
}

/** Captures a product event in PostHog for the given distinct id. */
export async function posthogCapture(
  config: PosthogConfig,
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fetch(`${config.host.replace(/\/+$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.key,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Telemetry must never throw.
  }
}

// ---------------------------------------------------------------------------
// Langfuse — one trace + generation per LLM call (cost + latency).
// ---------------------------------------------------------------------------

export interface LangfuseConfig {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
}

export interface LangfuseGeneration {
  name: string;
  model: string;
  startTime: Date;
  endTime: Date;
  input?: unknown;
  output?: unknown;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/** Records one LLM generation (with usage + latency) as a Langfuse trace. */
export async function langfuseTraceGeneration(
  config: LangfuseConfig,
  gen: LangfuseGeneration,
): Promise<void> {
  try {
    const traceId = uuid();
    const generationId = uuid();
    const now = new Date().toISOString();
    const batch = [
      {
        id: uuid(),
        type: "trace-create",
        timestamp: now,
        body: {
          id: traceId,
          name: gen.name,
          userId: gen.userId,
          timestamp: gen.startTime.toISOString(),
          input: gen.input,
          output: gen.output,
        },
      },
      {
        id: uuid(),
        type: "generation-create",
        timestamp: now,
        body: {
          id: generationId,
          traceId,
          name: gen.name,
          model: gen.model,
          startTime: gen.startTime.toISOString(),
          endTime: gen.endTime.toISOString(),
          input: gen.input,
          output: gen.output,
          usage: {
            input: gen.inputTokens,
            output: gen.outputTokens,
            total: gen.inputTokens + gen.outputTokens,
            unit: "TOKENS",
          },
          metadata: { ...gen.metadata, estimatedCostUsd: gen.costUsd },
        },
      },
    ];
    await fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/public/ingestion`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${base64(`${config.publicKey}:${config.secretKey}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch }),
    });
  } catch {
    // Telemetry must never throw.
  }
}
