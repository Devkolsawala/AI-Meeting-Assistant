import electron from "electron";
import { APP_NAME } from "@meetcopilot/shared";
import type { AuthLoginResult, AuthStatus } from "../ipc.js";
import { type AuthConfig, CALLBACK_HOST, CALLBACK_PATH, PROTOCOL, tryLoadAuthConfig } from "./config.js";
import { createPkcePair, randomToken } from "./pkce.js";
import { exchangeCodeForSession, refreshSession } from "./supabase-auth.js";
import { clearSession, loadSession, saveSession } from "./token-store.js";

/** Refresh the access token when it expires within this many seconds. */
const REFRESH_SKEW_SECONDS = 60;

const { shell } = electron;

interface PendingFlow {
  verifier: string;
  state: string;
}

/**
 * Owns the desktop side of the PKCE login: generates the verifier/challenge,
 * opens the browser to the web login page, and completes the flow when the
 * meetcopilot:// deep link returns with an auth code.
 */
export class AuthService {
  private readonly config: AuthConfig | null;
  private pending: PendingFlow | null = null;

  constructor(private readonly notify: (status: AuthStatus) => void) {
    this.config = tryLoadAuthConfig();
  }

  async getStatus(): Promise<AuthStatus> {
    const session = await loadSession();
    return { signedIn: session !== null, email: session?.email ?? null };
  }

  /**
   * Returns a non-expired access token, refreshing it if it is close to expiry.
   * Returns null when signed out or not configured. Falls back to the stored
   * token if a refresh attempt fails.
   */
  async getValidAccessToken(): Promise<string | null> {
    if (!this.config) {
      return null;
    }
    const session = await loadSession();
    if (!session) {
      return null;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (session.expiresAt - nowSeconds > REFRESH_SKEW_SECONDS) {
      return session.accessToken;
    }
    try {
      const refreshed = await refreshSession(this.config, session.refreshToken);
      await saveSession({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.expiresAt,
        tokenType: refreshed.tokenType,
        userId: refreshed.userId,
        email: refreshed.email,
      });
      return refreshed.accessToken;
    } catch {
      return session.accessToken;
    }
  }

  /** Generates a PKCE flow and opens the system browser to the web login page. */
  async beginLogin(): Promise<AuthLoginResult> {
    if (!this.config) {
      return {
        ok: false,
        error: "Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY (and WEB_URL).",
      };
    }
    const { verifier, challenge } = createPkcePair();
    const state = randomToken();
    this.pending = { verifier, state };

    const url = new URL(`${this.config.webUrl}/login`);
    url.searchParams.set("cc", challenge);
    url.searchParams.set("state", state);

    try {
      await shell.openExternal(url.toString());
      return { ok: true };
    } catch (err) {
      this.pending = null;
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Handles an incoming meetcopilot://auth/callback deep link: validates state,
   * exchanges the code for a session, and stores it. Returns the resulting status,
   * or null when the URL is not a (valid) auth callback.
   */
  async handleDeepLink(rawUrl: string): Promise<AuthStatus | null> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }
    if (
      parsed.protocol !== `${PROTOCOL}:` ||
      parsed.hostname !== CALLBACK_HOST ||
      parsed.pathname !== CALLBACK_PATH
    ) {
      return null;
    }
    if (!this.config) {
      return null;
    }

    const callbackError =
      parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
    if (callbackError) {
      console.error(`[${APP_NAME}] auth callback error: ${callbackError}`);
      this.pending = null;
      return null;
    }

    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");
    if (!code) {
      return null;
    }
    if (!this.pending || !state || state !== this.pending.state) {
      console.error(`[${APP_NAME}] auth callback rejected: missing or mismatched state.`);
      return null;
    }

    const { verifier } = this.pending;
    this.pending = null;

    const result = await exchangeCodeForSession(this.config, code, verifier);
    await saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      tokenType: result.tokenType,
      userId: result.userId,
      email: result.email,
    });
    const status: AuthStatus = { signedIn: true, email: result.email };
    this.notify(status);
    return status;
  }

  async logout(): Promise<AuthStatus> {
    await clearSession();
    const status: AuthStatus = { signedIn: false, email: null };
    this.notify(status);
    return status;
  }
}
