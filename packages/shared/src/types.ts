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
}

/**
 * SSE payloads streamed from POST /infer. Each `data:` line is JSON of this shape,
 * except the terminal message which is the literal `[DONE]`.
 */
export interface InferStreamDelta {
  /** Next chunk of generated answer text. */
  delta: string;
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
