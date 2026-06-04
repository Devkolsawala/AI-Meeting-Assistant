import type { InferContextLine, SttProvider } from "@meetcopilot/shared";

/**
 * IPC contract shared between the Electron main process, the preload bridge, and
 * the renderer. Keeping channel names and payload shapes in one place keeps the
 * three sides in sync.
 */
export const IpcChannel = {
  /** main -> renderer: a status/log entry to display in the overlay. */
  Log: "mc:log",
  /** renderer -> main: user asked to quit the app. */
  Close: "mc:close",
  /** renderer -> main (invoke): start the browser sign-in flow. */
  AuthLogin: "mc:auth:login",
  /** renderer -> main (invoke): sign out and clear stored tokens. */
  AuthLogout: "mc:auth:logout",
  /** renderer -> main (invoke): read the current auth status. */
  AuthGetStatus: "mc:auth:get-status",
  /** main -> renderer: auth status changed (login completed / signed out). */
  AuthChanged: "mc:auth:changed",
  /** renderer -> main (invoke): run inference on the given labelled context. */
  InferRun: "mc:infer:run",
  /** main -> renderer: a streamed answer text delta. */
  InferDelta: "mc:infer:delta",
  /** main -> renderer: the current answer stream finished. */
  InferDone: "mc:infer:done",
  /** main -> renderer: the answer stream failed. */
  InferError: "mc:infer:error",
  /** main -> renderer: the global "ask" hotkey was pressed. */
  InferHotkey: "mc:infer:hotkey",
} as const;

/** A single labelled line shown in the overlay's status/log area. */
export interface StatusEntry {
  label: string;
  value: string;
}

/** Current authentication state surfaced to the renderer. */
export interface AuthStatus {
  signedIn: boolean;
  email: string | null;
}

/** Result of asking the main process to start the sign-in flow. */
export interface AuthLoginResult {
  /** True when the system browser was opened to complete sign-in. */
  ok: boolean;
  /** Present when ok is false. */
  error?: string;
}

/** Result of an inference run (the answer itself streams via InferDelta events). */
export interface InferRunResult {
  ok: boolean;
  /** Present when ok is false. */
  error?: string;
}

/** The API surface exposed to the renderer via contextBridge as `window.meetcopilot`. */
export interface MeetCopilotApi {
  /** Human-readable app name. */
  readonly appName: string;
  /** Active speech-to-text provider, selected via the STT_PROVIDER env var. */
  readonly sttProvider: SttProvider;
  /** Subscribe to status/log entries pushed from the main process. */
  onLog: (handler: (entry: StatusEntry) => void) => void;
  /** Ask the main process to quit the app. */
  close: () => void;
  /** Authentication actions backed by the main process (PKCE + safeStorage). */
  auth: {
    /** Open the system browser to sign in. Completion arrives via onChanged. */
    login: () => Promise<AuthLoginResult>;
    /** Sign out and clear stored tokens. */
    logout: () => Promise<AuthStatus>;
    /** Read the current auth status. */
    getStatus: () => Promise<AuthStatus>;
    /** Subscribe to auth status changes pushed from the main process. */
    onChanged: (handler: (status: AuthStatus) => void) => void;
  };
  /** Streaming inference backed by the main process (authed backend call). */
  infer: {
    /** Run inference on the labelled context. Answer streams via onDelta. */
    run: (context: InferContextLine[]) => Promise<InferRunResult>;
    /** Subscribe to streamed answer text deltas. */
    onDelta: (handler: (text: string) => void) => void;
    /** Subscribe to the end-of-answer signal. */
    onDone: (handler: () => void) => void;
    /** Subscribe to inference errors. */
    onError: (handler: (error: string) => void) => void;
    /** Subscribe to the global "ask" hotkey being pressed. */
    onHotkey: (handler: () => void) => void;
  };
}
