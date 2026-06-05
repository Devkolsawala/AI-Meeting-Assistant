import {
  type LangfuseConfig,
  langfuseTraceGeneration,
  type LangfuseGeneration,
  posthogCapture,
  type SentryConfig,
  sentryCaptureException,
} from "@meetcopilot/shared";

// Env-gated telemetry for the backend. Each helper is a no-op when its provider is
// unconfigured, so the server runs identically with or without observability keys.

function sentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN_API?.trim();
  return dsn ? { dsn, environment: process.env.NODE_ENV ?? "development", release: "api" } : null;
}

const POSTHOG_KEY = process.env.POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

function langfuseConfig(): LangfuseConfig | null {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    return null;
  }
  return { publicKey, secretKey, baseUrl: process.env.LANGFUSE_BASEURL?.trim() || "https://cloud.langfuse.com" };
}

/** Reports a backend error to Sentry (no-op without SENTRY_DSN_API). */
export function captureError(error: unknown, extra?: Record<string, unknown>): void {
  const config = sentryConfig();
  if (config) {
    void sentryCaptureException(config, error, { platform: "node", extra });
  }
}

/** Captures a product event in PostHog (no-op without POSTHOG_KEY). */
export function captureEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  if (POSTHOG_KEY) {
    void posthogCapture({ host: POSTHOG_HOST, key: POSTHOG_KEY }, event, distinctId, properties);
  }
}

/** Records an LLM call in Langfuse (no-op without Langfuse keys). */
export function traceLlm(gen: LangfuseGeneration): void {
  const config = langfuseConfig();
  if (config) {
    void langfuseTraceGeneration(config, gen);
  }
}
