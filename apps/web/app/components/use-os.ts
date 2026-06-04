"use client";

import { useEffect, useState } from "react";

export type DetectedOS = "windows" | "other";

/**
 * Detects the visitor's OS on the client. Returns `null` until detection runs
 * (i.e. during SSR and the first client render), so callers can render a stable
 * default and avoid hydration mismatches.
 */
export function useOS(): DetectedOS | null {
  const [os, setOS] = useState<DetectedOS | null>(null);

  useEffect(() => {
    const uaData = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData;
    const platform = uaData?.platform ?? navigator.platform ?? "";
    const isWindows =
      /win/i.test(platform) || /windows/i.test(navigator.userAgent);
    setOS(isWindows ? "windows" : "other");
  }, []);

  return os;
}
