import electron from "electron";
import fs from "node:fs";
import path from "node:path";

const { app, safeStorage } = electron;

/** Session persisted to disk, encrypted with the OS keychain via safeStorage. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** Unix epoch seconds. */
  expiresAt: number;
  tokenType: string;
  userId: string;
  email: string | null;
}

const sessionFile = (): string => path.join(app.getPath("userData"), "auth.enc");

/**
 * Encrypts and writes the session. Throws if OS encryption is unavailable rather
 * than ever persisting tokens in plaintext.
 */
export async function saveSession(session: StoredSession): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS secure storage is unavailable; refusing to store tokens in plaintext.");
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(session));
  await fs.promises.writeFile(sessionFile(), encrypted);
}

/** Reads and decrypts the stored session, or null if none / unreadable. */
export async function loadSession(): Promise<StoredSession | null> {
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }
  let encrypted: Buffer;
  try {
    encrypted = await fs.promises.readFile(sessionFile());
  } catch {
    return null;
  }
  try {
    return JSON.parse(safeStorage.decryptString(encrypted)) as StoredSession;
  } catch {
    return null;
  }
}

/** Removes the stored session file (sign-out). */
export async function clearSession(): Promise<void> {
  await fs.promises.rm(sessionFile(), { force: true });
}
