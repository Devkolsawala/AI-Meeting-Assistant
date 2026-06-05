import type { SpeechToTextAdapter, SttProvider } from "@meetcopilot/shared";
import { type DeepgramTokenGrant, DeepgramSttAdapter } from "./deepgram.js";
import { ElevenLabsSttAdapter } from "./elevenlabs.js";
import { SarvamSttAdapter } from "./sarvam.js";

/** Construction options common to every STT adapter. */
export interface SttAdapterOptions {
  micStream: MediaStream;
  systemAudioStream: MediaStream;
  /** Supplies a Deepgram token (routed through the authed, cap-gated main process). */
  getDeepgramToken?: () => Promise<DeepgramTokenGrant>;
  onLog?: (label: string, value: string) => void;
}

/** Builds the STT adapter for the selected provider behind one shared contract. */
export function createSttAdapter(
  provider: SttProvider,
  options: SttAdapterOptions,
): SpeechToTextAdapter {
  switch (provider) {
    case "elevenlabs":
      return new ElevenLabsSttAdapter(options);
    case "sarvam":
      return new SarvamSttAdapter(options);
    case "deepgram":
      return new DeepgramSttAdapter({ ...options, getToken: options.getDeepgramToken });
    default:
      return assertNever(provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported STT provider: ${String(value)}`);
}
