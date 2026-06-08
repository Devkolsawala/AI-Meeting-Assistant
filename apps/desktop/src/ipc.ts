import type {
  InferContextLine,
  SttProvider,
  TurnCompleteResponse,
  UsageSnapshot,
} from "@meetcopilot/shared";

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
  /** renderer -> main (invoke): start a usage-metering session for this meeting. */
  SessionStart: "mc:session:start",
  /** renderer -> main (invoke): end the current usage-metering session. */
  SessionEnd: "mc:session:end",
  /** renderer -> main (invoke): mint an authed, cap-gated Deepgram STT token. */
  SttToken: "mc:stt:token",
  /** renderer -> main (invoke): open the web pricing page to upgrade. */
  OpenUpgrade: "mc:open-upgrade",
  /** renderer -> main (send): report a renderer error for crash reporting. */
  TelemetryError: "mc:telemetry:error",
  /** renderer -> main (invoke): read whether first-run onboarding is complete. */
  OnboardingGetState: "mc:onboarding:get-state",
  /** renderer -> main (invoke): mark first-run onboarding complete. */
  OnboardingComplete: "mc:onboarding:complete",
  /** renderer -> main (send): open the audio troubleshooting page in the browser. */
  OpenTroubleshooting: "mc:open-troubleshooting",
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
  /** renderer -> main (invoke): classify whether a them-utterance is complete (turn gate). */
  TurnComplete: "mc:turn:complete",
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
  /** True when the call was blocked by the user's plan cap. */
  limitReached?: boolean;
}

/** Result of starting a usage-metering session. */
export interface SessionStartResult {
  /** True when a backend session was opened (metering is active). */
  ok: boolean;
  /** Present when ok is false (e.g. signed out or backend unreachable). */
  error?: string;
  /** True when capture was blocked by the user's plan cap. */
  limitReached?: boolean;
  /** Plan + usage snapshot, when the backend returned one (allowed or blocked). */
  usage?: UsageSnapshot;
}

/** First-run onboarding state. */
export interface OnboardingState {
  /** True once the user has completed (or skipped) the first-run setup. */
  completed: boolean;
}

/** Result of minting a Deepgram STT token (authed + cap-gated by the backend). */
export interface SttTokenResult {
  ok: boolean;
  accessToken?: string;
  expiresInSeconds?: number;
  /** True when blocked by the user's plan cap. */
  limitReached?: boolean;
  /** Present when ok is false. */
  error?: string;
}

/** The API surface exposed to the renderer via contextBridge as `window.meetcopilot`. */
export interface MeetCopilotApi {
  /** Human-readable app name. */
  readonly appName: string;
  /** Active speech-to-text provider, selected via the STT_PROVIDER env var. */
  readonly sttProvider: SttProvider;
  /** When true (TURN_DEBUG env), the turn detector + gate log every state/decision. */
  readonly turnDebug: boolean;
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
  /** Usage-metering session lifecycle for a meeting (authed backend calls). */
  session: {
    /** Open a metering session when capture starts. Best-effort; never throws. */
    start: () => Promise<SessionStartResult>;
    /** Close the current metering session when capture stops. Best-effort. */
    end: () => Promise<void>;
  };
  /** Speech-to-text token minting routed through main (keeps tokens out of renderer). */
  stt: {
    /** Mint an authed, cap-gated Deepgram token. */
    deepgramToken: () => Promise<SttTokenResult>;
  };
  /** Open the web pricing page in the system browser so the user can upgrade. */
  openUpgrade: () => void;
  /** Forward a renderer error to the main process for crash reporting. */
  reportError: (message: string) => void;
  /** First-run onboarding state, persisted by the main process. */
  onboarding: {
    /** Read whether onboarding has been completed. */
    getState: () => Promise<OnboardingState>;
    /** Mark onboarding complete so it does not show again. */
    complete: () => Promise<void>;
  };
  /** Open the audio troubleshooting page in the system browser. */
  openTroubleshooting: () => void;
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
  /** End-of-turn detection helpers backed by the main process (authed backend call). */
  turn: {
    /**
     * Layer 2 of the completeness gate: ask the backend whether `utterance` is a
     * complete question/request. Fails open (complete=true) on timeout/error so the
     * overlay never hangs waiting on this; the `source` field reports why. Called only
     * for the ambiguous middle.
     */
    complete: (utterance: string) => Promise<TurnCompleteResponse>;
  };
}
