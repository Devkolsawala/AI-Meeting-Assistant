import {
  posthogCapture,
  type SentryConfig,
  sentryCaptureException,
} from "@meetcopilot/shared";

// Env-gated telemetry for the desktop main process. The renderer forwards its
// errors here (the overlay's CSP blocks direct network egress), so all desktop
// crash reporting and analytics flow through one place. No-op without keys.

function sentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN_DESKTOP?.trim();
  return dsn ? { dsn, environment: process.env.NODE_ENV ?? "development", release: "desktop" } : null;
}

const POSTHOG_KEY = process.env.POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

/** Reports a desktop error to Sentry (no-op without SENTRY_DSN_DESKTOP). */
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
