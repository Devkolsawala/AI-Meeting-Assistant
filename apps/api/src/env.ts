import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));
// From apps/api/src (dev) or apps/api/dist (built) up to the repo root .env.
const envPath = resolve(moduleDir, "..", "..", "..", ".env");

/** Loads the repo-root .env into process.env. No-op if the file is absent. */
export function loadEnv(): void {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // No .env file found — fall back to the ambient environment.
  }
}

/** Thrown when a required secret is not configured. */
export class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(`Missing required environment variable: ${key}. Add it to .env (see .env.example).`);
    this.name = "MissingEnvError";
  }
}

/** Returns the value of a required environment variable, or throws MissingEnvError. */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new MissingEnvError(key);
  }
  return value;
}
