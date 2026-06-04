import type { SpeechToTextAdapter, SttTranscriptEvent } from "@meetcopilot/shared";
import { createSttAdapter } from "./stt/factory.js";

const logEl = document.getElementById("log");
const labelEl = document.getElementById("app-label");
const closeBtn = document.getElementById("close-btn");
const startCaptureBtn = document.getElementById("start-capture-btn");
const stopCaptureBtn = document.getElementById("stop-capture-btn");
const youStatusEl = document.getElementById("you-status");
const themStatusEl = document.getElementById("them-status");
const youDotEl = document.getElementById("you-dot");
const themDotEl = document.getElementById("them-dot");
const sttStatusEl = document.getElementById("stt-status");
const transcriptLinesEl = document.getElementById("transcript-lines");

const api = window.meetcopilot;
const audioRmsThreshold = 0.01;
const monitorIntervalMs = 250;
const maxTranscriptLines = 80;

type CaptureSide = "You" | "Them";
type CaptureStatus = "idle" | "pending" | "active" | "error";
type SttStatus = "idle" | "pending" | "active" | "error";

interface AudioMonitor {
  stop: () => void;
}

interface CaptureState {
  micStream: MediaStream;
  displayStream: MediaStream;
  systemAudioStream: MediaStream;
  monitors: AudioMonitor[];
  sttAdapter: SpeechToTextAdapter;
  sttUnsubscribe: Array<() => void>;
}

let capture: CaptureState | null = null;
let isStartingCapture = false;
const partialTranscriptLines = new Map<CaptureSide, HTMLElement>();

function appendLog(label: string, value: string): void {
  console.log(`[${api.appName}] ${label}: ${value}`);
  if (!logEl) return;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${label}: ${value}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function asButton(element: HTMLElement | null): HTMLButtonElement | null {
  return element instanceof HTMLButtonElement ? element : null;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function requireAudioTracks(label: CaptureSide, stream: MediaStream): MediaStreamTrack[] {
  const tracks = stream.getAudioTracks();
  if (tracks.length === 0) {
    throw new Error(`${label} stream has no audio tracks`);
  }
  return tracks;
}

function setCaptureControls(): void {
  const startButton = asButton(startCaptureBtn);
  const stopButton = asButton(stopCaptureBtn);
  if (startButton) startButton.disabled = isStartingCapture || capture !== null;
  if (stopButton) stopButton.disabled = capture === null;
}

function updateCaptureStatus(side: CaptureSide, status: CaptureStatus, text: string): void {
  const statusEl = side === "You" ? youStatusEl : themStatusEl;
  const dotEl = side === "You" ? youDotEl : themDotEl;
  if (statusEl) statusEl.textContent = `${side}: ${text}`;
  if (dotEl) dotEl.dataset.state = status;
}

function updateSttStatus(status: SttStatus, text: string): void {
  if (!sttStatusEl) return;
  sttStatusEl.textContent = `STT: ${text}`;
  sttStatusEl.dataset.state = status;
}

function logStreamReady(side: CaptureSide, stream: MediaStream): void {
  const tracks = requireAudioTracks(side, stream);
  const trackNames = tracks.map((track) => track.label || "default audio device").join(", ");
  appendLog(side, `stream live with ${tracks.length} ${plural(tracks.length, "audio track")}`);
  appendLog(side, `track source: ${trackNames}`);

  for (const track of tracks) {
    track.addEventListener("ended", () => {
      appendLog(side, "audio track ended");
      updateCaptureStatus(side, "idle", "ended");
    });
    track.addEventListener("mute", () => appendLog(side, "audio track muted"));
    track.addEventListener("unmute", () => appendLog(side, "audio track unmuted"));
  }
}

function calculateRms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

function createAudioMonitor(side: CaptureSide, stream: MediaStream): AudioMonitor {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  const samples = new Float32Array(analyser.fftSize);
  let hasDetectedAudio = false;
  let lastWaitingLogAt = Date.now();

  analyser.fftSize = 2048;
  source.connect(analyser);
  updateCaptureStatus(side, "pending", "listening");

  void audioContext.resume().catch((err: unknown) => {
    appendLog(side, `audio monitor failed to start: ${getErrorMessage(err)}`);
    updateCaptureStatus(side, "error", "monitor error");
  });

  const intervalId = window.setInterval(() => {
    const liveTracks = stream.getAudioTracks().filter((track) => track.readyState === "live");
    if (liveTracks.length === 0) {
      appendLog(side, "no live audio tracks remain");
      updateCaptureStatus(side, "idle", "stopped");
      window.clearInterval(intervalId);
      return;
    }

    analyser.getFloatTimeDomainData(samples);
    const rms = calculateRms(samples);
    if (rms >= audioRmsThreshold) {
      if (!hasDetectedAudio) {
        hasDetectedAudio = true;
        appendLog(side, `audio detected (rms=${rms.toFixed(4)})`);
        updateCaptureStatus(side, "active", "audio detected");
      }
      return;
    }

    const now = Date.now();
    if (!hasDetectedAudio && now - lastWaitingLogAt >= 5000) {
      appendLog(side, "stream live; waiting for audible signal");
      lastWaitingLogAt = now;
    }
  }, monitorIntervalMs);

  return {
    stop: () => {
      window.clearInterval(intervalId);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close().catch((err: unknown) => {
        appendLog(side, `audio monitor close failed: ${getErrorMessage(err)}`);
      });
    },
  };
}

function toCaptureSide(speaker: SttTranscriptEvent["speaker"]): CaptureSide {
  return speaker === "you" ? "You" : "Them";
}

function setTranscriptLineText(line: HTMLElement, side: CaptureSide, transcript: string): void {
  const label = document.createElement("span");
  label.className = "transcript-speaker";
  label.textContent = `${side}:`;

  const text = document.createElement("span");
  text.className = "transcript-text";
  text.textContent = transcript;

  line.replaceChildren(label, text);
}

function removePartialTranscriptLines(): void {
  for (const line of partialTranscriptLines.values()) {
    line.remove();
  }
  partialTranscriptLines.clear();
}

function clearTranscript(): void {
  partialTranscriptLines.clear();
  transcriptLinesEl?.replaceChildren();
}

function pruneTranscriptLines(): void {
  if (!transcriptLinesEl) return;

  while (transcriptLinesEl.children.length > maxTranscriptLines) {
    const removed = transcriptLinesEl.firstElementChild;
    removed?.remove();
    for (const [side, line] of partialTranscriptLines) {
      if (line === removed) {
        partialTranscriptLines.delete(side);
      }
    }
  }
}

function handleTranscript(event: SttTranscriptEvent): void {
  const transcript = event.transcript.trim();
  if (!transcript || !transcriptLinesEl) return;

  const side = toCaptureSide(event.speaker);
  console.log(`[${api.appName}] ${side}: ${transcript}`);

  if (event.isFinal) {
    const partialLine = partialTranscriptLines.get(side);
    if (partialLine) {
      partialLine.remove();
      partialTranscriptLines.delete(side);
    }

    const line = document.createElement("div");
    line.className = "transcript-line transcript-line-final";
    setTranscriptLineText(line, side, transcript);
    transcriptLinesEl.appendChild(line);
  } else {
    let line = partialTranscriptLines.get(side);
    if (!line) {
      line = document.createElement("div");
      line.className = "transcript-line transcript-line-partial";
      partialTranscriptLines.set(side, line);
      transcriptLinesEl.appendChild(line);
    }
    setTranscriptLineText(line, side, transcript);
  }

  pruneTranscriptLines();
  transcriptLinesEl.scrollTop = transcriptLinesEl.scrollHeight;
}

function stopStreams(streams: Array<MediaStream | null>): void {
  const tracks = new Set<MediaStreamTrack>();
  for (const stream of streams) {
    for (const track of stream?.getTracks() ?? []) {
      tracks.add(track);
    }
  }
  for (const track of tracks) {
    track.stop();
  }
}

async function startCapture(): Promise<void> {
  if (capture !== null || isStartingCapture) return;

  isStartingCapture = true;
  setCaptureControls();
  updateCaptureStatus("You", "pending", "starting");
  updateCaptureStatus("Them", "pending", "starting");

  let micStream: MediaStream | null = null;
  let displayStream: MediaStream | null = null;
  let systemAudioStream: MediaStream | null = null;
  let monitors: AudioMonitor[] = [];
  let sttAdapter: SpeechToTextAdapter | null = null;
  let sttUnsubscribe: Array<() => void> = [];

  try {
    clearTranscript();
    appendLog("Capture", "starting microphone and system loopback");
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    logStreamReady("You", micStream);

    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    systemAudioStream = new MediaStream(requireAudioTracks("Them", displayStream));
    logStreamReady("Them", systemAudioStream);

    monitors = [
      createAudioMonitor("You", micStream),
      createAudioMonitor("Them", systemAudioStream),
    ];

    const provider = api.sttProvider;
    appendLog("STT", `starting ${provider} live transcription`);
    updateSttStatus("pending", `connecting (${provider})`);
    sttAdapter = createSttAdapter(provider, {
      micStream,
      systemAudioStream,
      onLog: appendLog,
    });
    sttUnsubscribe = [sttAdapter.onPartial(handleTranscript), sttAdapter.onFinal(handleTranscript)];
    await sttAdapter.start();
    updateSttStatus("active", `${provider} live`);

    capture = { micStream, displayStream, systemAudioStream, monitors, sttAdapter, sttUnsubscribe };
    appendLog("Capture", `microphone, system loopback, and ${provider} STT are live`);
  } catch (err: unknown) {
    appendLog("Capture error", getErrorMessage(err));
    updateCaptureStatus("You", "error", "error");
    updateCaptureStatus("Them", "error", "error");
    updateSttStatus("error", "error");
    for (const unsubscribe of sttUnsubscribe) unsubscribe();
    await sttAdapter?.stop().catch((stopErr: unknown) => {
      appendLog("STT error", `failed to stop after error: ${getErrorMessage(stopErr)}`);
    });
    for (const monitor of monitors) monitor.stop();
    stopStreams([micStream, displayStream, systemAudioStream]);
  } finally {
    isStartingCapture = false;
    setCaptureControls();
  }
}

function stopCapture(): void {
  if (capture === null) return;

  const currentCapture = capture;
  capture = null;
  for (const unsubscribe of currentCapture.sttUnsubscribe) unsubscribe();
  void currentCapture.sttAdapter.stop().catch((err: unknown) => {
    appendLog("STT error", `failed to stop: ${getErrorMessage(err)}`);
  });
  for (const monitor of currentCapture.monitors) monitor.stop();
  stopStreams([
    currentCapture.micStream,
    currentCapture.displayStream,
    currentCapture.systemAudioStream,
  ]);
  updateCaptureStatus("You", "idle", "stopped");
  updateCaptureStatus("Them", "idle", "stopped");
  updateSttStatus("idle", "stopped");
  removePartialTranscriptLines();
  appendLog("Capture", "stopped microphone and system loopback");
  setCaptureControls();
}

if (labelEl) {
  labelEl.textContent = api.appName;
}

api.onLog((entry) => appendLog(entry.label, entry.value));
startCaptureBtn?.addEventListener("click", () => {
  void startCapture();
});
stopCaptureBtn?.addEventListener("click", () => stopCapture());
closeBtn?.addEventListener("click", () => {
  stopCapture();
  api.close();
});
window.addEventListener("beforeunload", () => stopCapture());

setCaptureControls();
updateCaptureStatus("You", "idle", "idle");
updateCaptureStatus("Them", "idle", "idle");
updateSttStatus("idle", `idle (${api.sttProvider})`);
appendLog("Overlay", `renderer ready — STT provider: ${api.sttProvider}`);
