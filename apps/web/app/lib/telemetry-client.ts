import { posthogCapture, sentryCaptureException } from "@meetcopilot/shared";

// Browser-side telemetry for the web app. Reads NEXT_PUBLIC_ env values (these are
// inlined into the client bundle and are non-secret). No-op without keys.

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB?.trim();
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

/** Reports a client-side error to Sentry (no-op without the public DSN). */
export function captureErrorClient(error: unknown, extra?: Record<string, unknown>): void {
  if (SENTRY_DSN) {
    void sentryCaptureException(
      { dsn: SENTRY_DSN, release: "web-client" },
      error,
      { platform: "javascript", extra },
    );
  }
}

/** Captures a product event from the browser in PostHog (no-op without the key). */
export function captureEventClient(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): void {
  if (POSTHOG_KEY) {
    void posthogCapture({ host: POSTHOG_HOST, key: POSTHOG_KEY }, event, distinctId, properties);
  }
}
