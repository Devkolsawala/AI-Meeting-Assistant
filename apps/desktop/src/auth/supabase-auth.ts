import type { AuthConfig } from "./config.js";

interface GoTrueUser {
  id: string;
  email: string | null;
}

interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: GoTrueUser;
}

/** Thrown when Supabase rejects the PKCE code exchange. */
export class AuthExchangeError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`Supabase token exchange failed (HTTP ${status})`);
    this.name = "AuthExchangeError";
  }
}

export interface ExchangeResult {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch seconds at which the access token expires. */
  expiresAt: number;
  tokenType: string;
  userId: string;
  email: string | null;
}

function mapTokenResponse(data: GoTrueTokenResponse): ExchangeResult {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    tokenType: data.token_type,
    userId: data.user.id,
    email: data.user.email,
  };
}

/**
 * Exchanges a Supabase auth `code` (from the deep-link callback) plus the locally
 * held PKCE verifier for a session. Uses the public anon key as `apikey`.
 */
export async function exchangeCodeForSession(
  config: AuthConfig,
  code: string,
  verifier: string,
): Promise<ExchangeResult> {
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  if (!res.ok) {
    throw new AuthExchangeError(res.status, await res.text());
  }
  return mapTokenResponse((await res.json()) as GoTrueTokenResponse);
}

/** Exchanges a refresh token for a fresh session (rotates the refresh token). */
export async function refreshSession(
  config: AuthConfig,
  refreshToken: string,
): Promise<ExchangeResult> {
  const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new AuthExchangeError(res.status, await res.text());
  }
  return mapTokenResponse((await res.json()) as GoTrueTokenResponse);
}
