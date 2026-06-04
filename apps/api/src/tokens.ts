import { requireEnv } from "./env.js";

const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
const ELEVENLABS_TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";

/** Thrown when an upstream provider rejects the token request. */
export class UpstreamError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`${provider} token request failed (HTTP ${status})`);
    this.name = "UpstreamError";
  }
}

export interface DeepgramToken {
  provider: "deepgram";
  /** Short-lived JWT the client sends to Deepgram's streaming API. */
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * Mints a short-lived Deepgram JWT (default 30s TTL) for client-side streaming.
 * Uses the project API key server-side; only the JWT is returned to the caller.
 */
export async function mintDeepgramToken(ttlSeconds = 30): Promise<DeepgramToken> {
  const apiKey = requireEnv("DEEPGRAM_API_KEY");
  const res = await fetch(DEEPGRAM_GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });
  if (!res.ok) {
    throw new UpstreamError("deepgram", res.status, await res.text());
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    provider: "deepgram",
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in,
  };
}

export interface ElevenLabsToken {
  provider: "elevenlabs";
  /** Single-use token the client passes as the `token` query param on the WS URL. */
  token: string;
  expiresInSeconds: number;
}

/**
 * Mints a single-use ElevenLabs Scribe realtime token (15-minute TTL).
 * Uses the API key server-side; only the single-use token is returned.
 */
export async function mintElevenLabsToken(): Promise<ElevenLabsToken> {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const res = await fetch(ELEVENLABS_TOKEN_URL, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    throw new UpstreamError("elevenlabs", res.status, await res.text());
  }
  const data = (await res.json()) as { token: string };
  return {
    provider: "elevenlabs",
    token: data.token,
    expiresInSeconds: 15 * 60,
  };
}
