import type { MeetCopilotApi } from "../ipc.js";

declare global {
  interface Window {
    /** API exposed by the preload bridge (see preload.ts / ipc.ts). */
    meetcopilot: MeetCopilotApi;
  }
}

export {};
