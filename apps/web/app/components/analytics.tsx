"use client";

import { useEffect } from "react";
import { captureErrorClient } from "../lib/telemetry-client";

// Registers browser-global error handlers so client-side crashes reach Sentry.
// Rendered once from the root layout; renders nothing.
export function Analytics() {
  useEffect(() => {
    const onError = (event: ErrorEvent) =>
      captureErrorClient(event.error ?? new Error(event.message));
    const onRejection = (event: PromiseRejectionEvent) =>
      captureErrorClient(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      );

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
