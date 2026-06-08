import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/** Thrown when the Supabase access token is missing, invalid, or expired. */
export class AuthError extends Error {
  constructor(message = "Invalid or expired token") {
    super(message);
    this.name = "AuthError";
  }
}

// AUTH_DISABLED — testing mode. When AUTH_DISABLED=true the API skips JWT
// verification and plan gating, acting as a single mock user. Safe by default:
// it is OFF unless the env var is explicitly set. Set it in .env (local) or the
// host's env (e.g. Railway) to run the full pipeline without real sign-in.
/** True when auth + usage gating are bypassed for testing. */
export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}

/** Stable mock user id used for every request while AUTH_DISABLED is on. */
export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

/** The authenticated caller, extracted from a verified Supabase JWT. */
export interface AuthedUser {
  userId: string;
  email: string | null;
}

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;
let cachedJwks: { url: string; jwks: RemoteJwks } | null = null;

function getJwks(supabaseUrl: string): RemoteJwks {
  const url = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;
  if (cachedJwks?.url !== url) {
    cachedJwks = { url, jwks: createRemoteJWKSet(new URL(url)) };
  }
  return cachedJwks.jwks;
}

function toUser(payload: JWTPayload): AuthedUser {
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new AuthError("Token is missing a subject");
  }
  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

/**
 * Verifies a Supabase access token. Uses the symmetric JWT secret (HS256) when
 * SUPABASE_JWT_SECRET is set, otherwise verifies against the project's JWKS
 * (asymmetric signing keys). Never trusts an unverified token.
 */
export async function verifySupabaseJwt(token: string): Promise<AuthedUser> {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  try {
    if (secret) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      return toUser(payload);
    }
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    if (!supabaseUrl) {
      throw new Error("Set SUPABASE_JWT_SECRET or SUPABASE_URL to verify tokens.");
    }
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl));
    return toUser(payload);
  } catch (err) {
    if (err instanceof AuthError) {
      throw err;
    }
    throw new AuthError();
  }
}

/** Extracts a bearer token from an Authorization header, or throws AuthError. */
export function bearerToken(authorization: string | undefined): string {
  const prefix = "Bearer ";
  if (!authorization || !authorization.startsWith(prefix)) {
    throw new AuthError("Missing bearer token");
  }
  const token = authorization.slice(prefix.length).trim();
  if (!token) {
    throw new AuthError("Missing bearer token");
  }
  return token;
}
