/**
 * The two audio sources MeetCopilot transcribes. "you" is the local microphone;
 * "them" is the captured meeting / system (loopback) audio.
 */
export type SpeakerChannel = "you" | "them";

/** A partial or final transcript emitted by a speech-to-text provider. */
export interface SttTranscriptEvent {
  /** Provider-specific adapter name. Deepgram is the Phase 0 implementation. */
  provider: string;
  /** Logical speaker channel for the transcript. */
  speaker: SpeakerChannel;
  /** Transcript text emitted by the provider. */
  transcript: string;
  /** True when the provider has finalized this transcript segment. */
  isFinal: boolean;
  /** Provider result start time in seconds when available. */
  startSeconds?: number;
  /** Provider result duration in seconds when available. */
  durationSeconds?: number;
}

/** Callback used by speech-to-text adapters for partial and final transcripts. */
export type SttTranscriptHandler = (event: SttTranscriptEvent) => void;

/** Model routing lane. Fast = Nova/Haiku; smart = Sonnet. Decided server-side. */
export type InferLane = "fast" | "smart";

/** One labelled line of meeting transcript sent to the backend for inference. */
export interface InferContextLine {
  /** Who spoke: "you" (local mic) or "them" (meeting audio). */
  speaker: SpeakerChannel;
  /** Transcript text for this line. */
  text: string;
}

/** Request body for POST /infer. Provider/model keys never appear here. */
export interface InferRequest {
  /** Labelled transcript context, oldest first. */
  context: InferContextLine[];
  /** Preferred lane. The server may override; defaults to "fast". */
  lane?: InferLane;
  /** Persona key to apply (injected server-side). Used from Milestone 6. */
  persona?: string;
  /** Usage-session id this call belongs to, so the server can meter the event. */
  sessionId?: string;
}

/**
 * SSE payloads streamed from POST /infer. Each `data:` line is JSON of this shape,
 * except the terminal message which is the literal `[DONE]`.
 */
export interface InferStreamDelta {
  /** Next chunk of generated answer text. */
  delta: string;
}

/** Plan caps for a user. `null` means unlimited (e.g. a paid plan). */
export interface UsageLimits {
  maxSessions: number | null;
  maxSttSeconds: number | null;
}

/**
 * Plan + usage snapshot the backend returns so the desktop can gate capture and
 * show usage meters / soft warnings. Computed server-side; never client-trusted.
 */
export interface UsageSnapshot {
  /** Plan name, e.g. "free" or a paid plan id. */
  plan: string;
  /** Metered sessions counted so far. */
  sessions: number;
  /** Total metered speech-to-text seconds so far. */
  sttSeconds: number;
  /** Caps that apply to this user's plan. */
  limits: UsageLimits;
  /** True when a cap is reached — further usage is blocked. */
  overLimit: boolean;
  /** True when usage has crossed the soft-warning threshold (e.g. 80%). */
  warn: boolean;
}

/** Machine-readable error code returned (HTTP 402) when a usage cap blocks a request. */
export const LIMIT_REACHED = "limit_reached" as const;

/** Body returned with HTTP 402 when a usage cap blocks the request. */
export interface LimitReachedResponse {
  error: typeof LIMIT_REACHED;
  usage: UsageSnapshot;
}

/** Minimal provider-agnostic speech-to-text adapter contract. */
export interface SpeechToTextAdapter {
  /** Start the provider connection and begin streaming audio. */
  start: () => Promise<void>;
  /** Subscribe to non-final transcript updates. Returns an unsubscribe function. */
  onPartial: (handler: SttTranscriptHandler) => () => void;
  /** Subscribe to final transcript segments. Returns an unsubscribe function. */
  onFinal: (handler: SttTranscriptHandler) => () => void;
  /** Stop audio processing and close the provider connection. */
  stop: () => Promise<void>;
}
