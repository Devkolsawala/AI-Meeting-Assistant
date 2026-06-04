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
} as const;

/** A single labelled line shown in the overlay's status/log area. */
export interface StatusEntry {
  label: string;
  value: string;
}

/** The API surface exposed to the renderer via contextBridge as `window.meetcopilot`. */
export interface MeetCopilotApi {
  /** Human-readable app name. */
  readonly appName: string;
  /** Subscribe to status/log entries pushed from the main process. */
  onLog: (handler: (entry: StatusEntry) => void) => void;
  /** Ask the main process to quit the app. */
  close: () => void;
}
