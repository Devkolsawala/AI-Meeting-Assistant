/** Custom URL scheme the OS routes back to the desktop app after browser login. */
export const PROTOCOL = "meetcopilot";

/** Deep link the web callback page redirects to: meetcopilot://auth/callback */
export const CALLBACK_HOST = "auth";
export const CALLBACK_PATH = "/callback";

/** Public Supabase config plus the web app location. None of these are secrets. */
export interface AuthConfig {
  /** Supabase project URL, e.g. https://xyz.supabase.co (no trailing slash). */
  supabaseUrl: string;
  /** Supabase anon/publishable key (public, safe in the client). */
  anonKey: string;
  /** Base URL of the Next.js web app that hosts the login pages. */
  webUrl: string;
}

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

/**
 * Reads auth config from the environment. Returns null (rather than throwing) when
 * SUPABASE_URL / SUPABASE_ANON_KEY are absent, so the overlay still runs without
 * auth configured; login attempts then report a clear, actionable error.
 */
export function tryLoadAuthConfig(): AuthConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) {
    return null;
  }
  const webUrl = process.env.WEB_URL?.trim() || "http://localhost:3000";
  return {
    supabaseUrl: stripTrailingSlash(supabaseUrl),
    anonKey,
    webUrl: stripTrailingSlash(webUrl),
  };
}
