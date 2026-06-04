import { createHash, randomBytes } from "node:crypto";

const base64url = (buf: Buffer): string => buf.toString("base64url");

/** Random URL-safe token used for the PKCE verifier and the CSRF state value. */
export function randomToken(byteLength = 32): string {
  return base64url(randomBytes(byteLength));
}

export interface PkcePair {
  /** Secret kept in the main process; exchanged for tokens after callback. */
  verifier: string;
  /** S256 hash of the verifier; sent to the browser / Supabase. */
  challenge: string;
}

/**
 * Creates a PKCE verifier + S256 challenge. A 32-byte verifier encodes to 43
 * base64url chars, within the RFC 7636 range (43-128).
 */
export function createPkcePair(): PkcePair {
  const verifier = randomToken(32);
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
