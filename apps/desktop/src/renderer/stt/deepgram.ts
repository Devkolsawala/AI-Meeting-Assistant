import type {
  SpeakerChannel,
  SpeechToTextAdapter,
  SttTranscriptEvent,
  SttTranscriptHandler,
} from "@meetcopilot/shared";

const DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen";
const DEFAULT_TOKEN_ENDPOINT = "http://127.0.0.1:8787/stt-token";
const DEEPGRAM_MODEL = "nova-3";
const TARGET_SAMPLE_RATE = 16000;
const CHANNEL_COUNT = 2;
const FRAMES_PER_CHUNK = 320;
const OPEN_TIMEOUT_MS = 10000;
const KEEP_ALIVE_INTERVAL_MS = 3000;

interface DeepgramSttAdapterOptions {
  micStream: MediaStream;
  systemAudioStream: MediaStream;
  tokenEndpoint?: string;
  onLog?: (label: string, value: string) => void;
}

interface PcmWorkletMessage {
  type: "audio";
  buffer: ArrayBuffer;
  frames: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function readBoolean(record: JsonRecord, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getTranscript(payload: JsonRecord): string | null {
  const channel = payload.channel;
  if (!isRecord(channel)) return null;

  const alternatives = channel.alternatives;
  if (!Array.isArray(alternatives)) return null;

  const firstAlternative = alternatives[0];
  if (!isRecord(firstAlternative)) return null;

  const transcript = readString(firstAlternative, "transcript")?.trim();
  return transcript ? transcript : null;
}

function getSpeaker(payload: JsonRecord): SpeakerChannel | null {
  const channelIndex = payload.channel_index;
  if (!Array.isArray(channelIndex)) return null;

  const sourceChannel = channelIndex[0];
  if (sourceChannel === 0) return "you";
  if (sourceChannel === 1) return "them";
  return null;
}

function isPcmWorkletMessage(value: unknown): value is PcmWorkletMessage {
  return (
    isRecord(value) &&
    value.type === "audio" &&
    value.buffer instanceof ArrayBuffer &&
    typeof value.frames === "number"
  );
}

function disconnectNode(node: AudioNode | null): void {
  try {
    node?.disconnect();
  } catch {
    // Already disconnected.
  }
}

/** Deepgram Nova-3 streaming implementation for MeetCopilot's 2-channel STT contract. */
export class DeepgramSttAdapter implements SpeechToTextAdapter {
  private readonly partialHandlers = new Set<SttTranscriptHandler>();
  private readonly finalHandlers = new Set<SttTranscriptHandler>();

  private audioContext: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private systemSource: MediaStreamAudioSourceNode | null = null;
  private merger: ChannelMergerNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private socket: WebSocket | null = null;
  private keepAliveIntervalId: number | null = null;
  private isStarted = false;

  public constructor(private readonly options: DeepgramSttAdapterOptions) {}

  public async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    try {
      const accessToken = await this.fetchAccessToken();
      await this.openSocket(accessToken);
      await this.startAudioGraph();
      this.startKeepAlive();
      this.log(
        "Deepgram",
        `streaming ${DEEPGRAM_MODEL}, ${CHANNEL_COUNT} channels, ${TARGET_SAMPLE_RATE} Hz linear16`,
      );
    } catch (err: unknown) {
      await this.stop();
      throw err;
    }
  }

  public onPartial(handler: SttTranscriptHandler): () => void {
    this.partialHandlers.add(handler);
    return () => this.partialHandlers.delete(handler);
  }

  public onFinal(handler: SttTranscriptHandler): () => void {
    this.finalHandlers.add(handler);
    return () => this.finalHandlers.delete(handler);
  }

  public async stop(): Promise<void> {
    this.isStarted = false;

    if (this.keepAliveIntervalId !== null) {
      window.clearInterval(this.keepAliveIntervalId);
      this.keepAliveIntervalId = null;
    }

    const worklet = this.worklet;
    this.worklet = null;
    if (worklet) {
      worklet.port.onmessage = null;
      worklet.port.close();
      disconnectNode(worklet);
    }

    disconnectNode(this.silentGain);
    disconnectNode(this.merger);
    disconnectNode(this.micSource);
    disconnectNode(this.systemSource);
    this.silentGain = null;
    this.merger = null;
    this.micSource = null;
    this.systemSource = null;

    const audioContext = this.audioContext;
    this.audioContext = null;
    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close();
    }

    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      this.sendJson(socket, { type: "CloseStream" });
      socket.close(1000, "MeetCopilot stopped");
    } else if (socket && socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "MeetCopilot stopped");
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const endpoint = this.options.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT;
    this.log("Deepgram", `requesting short-lived token from ${endpoint}`);

    const res = await fetch(endpoint, { method: "POST" });
    if (!res.ok) {
      throw new Error(`Deepgram token request failed with HTTP ${res.status}`);
    }

    const payload: unknown = await res.json();
    if (!isRecord(payload)) {
      throw new Error("Deepgram token response was not an object");
    }

    const accessToken = readString(payload, "accessToken") ?? readString(payload, "access_token");
    if (!accessToken) {
      throw new Error("Deepgram token response did not include an access token");
    }

    const ttl =
      readNumber(payload, "expiresInSeconds") ?? readNumber(payload, "expires_in") ?? "unknown";
    this.log("Deepgram", `received short-lived token (ttl=${ttl}s)`);
    return accessToken;
  }

  private async openSocket(accessToken: string): Promise<void> {
    const socket = new WebSocket(this.buildListenUrl(), ["bearer", accessToken]);
    this.socket = socket;
    socket.binaryType = "arraybuffer";

    socket.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.handleSocketMessage(event.data);
    });
    socket.addEventListener("close", (event) => {
      this.log("Deepgram", `WebSocket closed code=${event.code} reason=${event.reason || "none"}`);
    });
    socket.addEventListener("error", () => {
      this.log("Deepgram error", "WebSocket error");
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error("Deepgram WebSocket open timed out"));
        }, OPEN_TIMEOUT_MS);

        const cleanup = (): void => {
          window.clearTimeout(timeoutId);
          socket.removeEventListener("open", handleOpen);
          socket.removeEventListener("error", handleError);
          socket.removeEventListener("close", handleClose);
        };
        const handleOpen = (): void => {
          cleanup();
          resolve();
        };
        const handleError = (): void => {
          cleanup();
          reject(new Error("Deepgram WebSocket failed to open"));
        };
        const handleClose = (): void => {
          cleanup();
          reject(new Error("Deepgram WebSocket closed before opening"));
        };

        socket.addEventListener("open", handleOpen);
        socket.addEventListener("error", handleError);
        socket.addEventListener("close", handleClose);
      });
    } catch (err: unknown) {
      if (this.socket === socket) this.socket = null;
      socket.close();
      throw err;
    }

    this.log("Deepgram", "WebSocket connected");
  }

  private async startAudioGraph(): Promise<void> {
    const audioContext = new AudioContext();
    this.audioContext = audioContext;

    await audioContext.audioWorklet.addModule(new URL("./pcm-worklet.js", import.meta.url));

    this.micSource = audioContext.createMediaStreamSource(this.options.micStream);
    this.systemSource = audioContext.createMediaStreamSource(this.options.systemAudioStream);
    this.merger = audioContext.createChannelMerger(CHANNEL_COUNT);
    this.worklet = new AudioWorkletNode(audioContext, "pcm-worklet", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: CHANNEL_COUNT,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
      outputChannelCount: [CHANNEL_COUNT],
      processorOptions: {
        channelCount: CHANNEL_COUNT,
        framesPerChunk: FRAMES_PER_CHUNK,
        targetSampleRate: TARGET_SAMPLE_RATE,
      },
    });
    this.silentGain = audioContext.createGain();
    this.silentGain.gain.value = 0;

    this.worklet.port.onmessage = (event: MessageEvent<unknown>) => {
      this.handleWorkletMessage(event.data);
    };
    this.worklet.port.onmessageerror = () => {
      this.log("Deepgram error", "AudioWorklet message error");
    };

    this.micSource.connect(this.merger, 0, 0);
    this.systemSource.connect(this.merger, 0, 1);
    this.merger.connect(this.worklet);
    this.worklet.connect(this.silentGain);
    this.silentGain.connect(audioContext.destination);

    await audioContext.resume();
  }

  private buildListenUrl(): string {
    const url = new URL(DEEPGRAM_LISTEN_URL);
    url.searchParams.set("model", DEEPGRAM_MODEL);
    url.searchParams.set("encoding", "linear16");
    url.searchParams.set("sample_rate", String(TARGET_SAMPLE_RATE));
    url.searchParams.set("channels", String(CHANNEL_COUNT));
    url.searchParams.set("multichannel", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("punctuate", "true");
    url.searchParams.set("smart_format", "true");
    return url.toString();
  }

  private startKeepAlive(): void {
    this.keepAliveIntervalId = window.setInterval(() => {
      const socket = this.socket;
      if (socket?.readyState === WebSocket.OPEN) {
        this.sendJson(socket, { type: "KeepAlive" });
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  private handleWorkletMessage(data: unknown): void {
    if (!isPcmWorkletMessage(data) || data.buffer.byteLength === 0) return;

    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(data.buffer);
    }
  }

  private handleSocketMessage(data: unknown): void {
    if (typeof data !== "string") return;

    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch (err: unknown) {
      this.log("Deepgram error", `invalid JSON message: ${getErrorMessage(err)}`);
      return;
    }
    if (!isRecord(payload)) return;

    const type = readString(payload, "type");
    if (type === "Metadata") {
      const requestId = readString(payload, "request_id") ?? "unknown";
      this.log("Deepgram", `metadata received request_id=${requestId}`);
      return;
    }
    if (type !== "Results") return;

    const transcript = getTranscript(payload);
    if (!transcript) return;

    const speaker = getSpeaker(payload);
    if (!speaker) {
      this.log("Deepgram error", "transcript result missing expected channel_index");
      return;
    }

    const isFinal = readBoolean(payload, "is_final") ?? false;
    const event: SttTranscriptEvent = {
      provider: "deepgram",
      speaker,
      transcript,
      isFinal,
      startSeconds: readNumber(payload, "start"),
      durationSeconds: readNumber(payload, "duration"),
    };

    this.emitTranscript(event);
  }

  private emitTranscript(event: SttTranscriptEvent): void {
    const handlers = event.isFinal ? this.finalHandlers : this.partialHandlers;
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err: unknown) {
        this.log("Deepgram handler error", getErrorMessage(err));
      }
    }
  }

  private sendJson(socket: WebSocket, payload: JsonRecord): void {
    try {
      socket.send(JSON.stringify(payload));
    } catch (err: unknown) {
      this.log("Deepgram error", `failed to send control message: ${getErrorMessage(err)}`);
    }
  }

  private log(label: string, value: string): void {
    this.options.onLog?.(label, value);
  }
}
