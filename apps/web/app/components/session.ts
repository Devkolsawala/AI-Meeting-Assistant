// Lightweight web session for the marketing/account pages.
//
// The desktop app owns the PKCE login; the browser uses Supabase GoTrue's
// implicit flow (no code_challenge), which returns tokens in the redirect URL
// hash. We persist those tokens in localStorage by hand so we never need
// @supabase/supabase-js (which would interfere with the desktop PKCE handoff).
// These are the user's own anon-scoped tokens — the same ones a Supabase SPA
// would hold client-side — never a service-role key or other secret.

const STORAGE_KEY = "meetcopilot.web-session";

export interface WebSession {
  accessToken: string;
  refreshToken: string | null;
  /** Unix epoch seconds when the access token expires, if known. */
  expiresAt: number | null;
}

/** Reads the stored session, or null if absent/corrupt. */
export function readSession(): WebSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WebSession>;
    if (typeof parsed.accessToken !== "string" || parsed.accessToken.length === 0) {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: WebSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Parses a Supabase implicit-flow redirect hash (e.g.
 * `#access_token=...&refresh_token=...&expires_at=...`) into a WebSession.
 * Returns null when the hash carries no access token.
 */
export function parseHashSession(hash: string): WebSession | null {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const expiresAtRaw = params.get("expires_at");
  const expiresAt = expiresAtRaw ? Number.parseInt(expiresAtRaw, 10) : null;
  return {
    accessToken,
    refreshToken: params.get("refresh_token"),
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
}
