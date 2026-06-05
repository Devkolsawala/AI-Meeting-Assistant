import { posthogCapture, type SentryConfig, sentryCaptureException } from "@meetcopilot/shared";

// Server-side telemetry for the web app's route handlers (checkout, webhook,
// download, billing). Env-gated no-ops without keys.

function sentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN_WEB?.trim();
  return dsn ? { dsn, environment: process.env.NODE_ENV ?? "development", release: "web" } : null;
}

const POSTHOG_KEY = process.env.POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

/** Reports a server-side web error to Sentry (no-op without SENTRY_DSN_WEB). */
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
