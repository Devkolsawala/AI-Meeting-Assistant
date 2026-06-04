import type { SpeechToTextAdapter, SttProvider } from "@meetcopilot/shared";
import { DeepgramSttAdapter } from "./deepgram.js";
import { ElevenLabsSttAdapter } from "./elevenlabs.js";
import { SarvamSttAdapter } from "./sarvam.js";

/** Construction options common to every STT adapter. */
export interface SttAdapterOptions {
  micStream: MediaStream;
  systemAudioStream: MediaStream;
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
      return new DeepgramSttAdapter(options);
    default:
      return assertNever(provider);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported STT provider: ${String(value)}`);
}
