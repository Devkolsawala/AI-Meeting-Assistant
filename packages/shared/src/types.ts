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
