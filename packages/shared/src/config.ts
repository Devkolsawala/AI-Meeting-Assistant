/** Human-readable application name, shown in the overlay and logs. */
export const APP_NAME = "MeetCopilot";

/**
 * Names of the environment variables the server (apps/api) reads to talk to the
 * speech-to-text providers. These keys are server-side only and must never be
 * exposed to the desktop renderer.
 */
export const ENV_KEYS = ["DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY", "SARVAM_API_KEY"] as const;

/** Union of the supported server-side environment variable names. */
export type EnvKey = (typeof ENV_KEYS)[number];
