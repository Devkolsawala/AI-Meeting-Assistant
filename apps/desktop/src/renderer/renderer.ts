import type {
  InferContextLine,
  SpeechToTextAdapter,
  SttTranscriptEvent,
  UsageSnapshot,
} from "@meetcopilot/shared";
import { initAuthUi } from "./auth-ui.js";
import { createSttAdapter } from "./stt/factory.js";

const logEl = document.getElementById("log");
const labelEl = document.getElementById("app-label");
const recDotEl = document.getElementById("rec-dot");
const closeBtn = document.getElementById("close-btn");
const startCaptureBtn = document.getElementById("start-capture-btn");
const stopCaptureBtn = document.getElementById("stop-capture-btn");
const youStatusEl = document.getElementById("you-status");
const themStatusEl = document.getElementById("them-status");
const youDotEl = document.getElementById("you-dot");
const themDotEl = document.getElementById("them-dot");
const sttStatusEl = document.getElementById("stt-status");
const transcriptLinesEl = document.getElementById("transcript-lines");
const answerTextEl = document.getElementById("answer-text");
const askBtn = document.getElementById("ask-btn");
const upgradeBannerEl = document.getElementById("upgrade-banner");
const upgradeTextEl = document.getElementById("upgrade-text");
const upgradeBtn = document.getElementById("upgrade-btn");
const upgradeDismissBtn = document.getElementById("upgrade-dismiss");
const onboardingEl = document.getElementById("onboarding");
const obMicBtn = document.getElementById("ob-mic-btn");
const obMicDot = document.getElementById("ob-mic-dot");
const obMicMsg = document.getElementById("ob-mic-msg");
const obSysBtn = document.getElementById("ob-sys-btn");
const obSysDot = document.getElementById("ob-sys-dot");
const obSysMsg = document.getElementById("ob-sys-msg");
const obHelpBtn = document.getElementById("ob-help");
const obFinishBtn = document.getElementById("ob-finish");

const api = window.meetcopilot;
const audioRmsThreshold = 0.01;
const monitorIntervalMs = 250;
const maxTranscriptLines = 80;
const maxContextLines = 40;

/** Finalised transcript lines, labelled, sent to /infer when the user asks. */
const transcriptContext: InferContextLine[] = [];
let isAsking = false;

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
  // Title-bar status dot: pulsing green while a capture session is live, grey idle.
  if (recDotEl) recDotEl.dataset.state = capture !== null ? "recording" : "";
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
  // Presentational hook so CSS can colour "Them:" (indigo) vs "You:" (emerald).
  label.dataset.side = side;
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
  transcriptContext.length = 0;
}

function setAnswer(text: string, state: "" | "pending" | "error" = ""): void {
  if (!answerTextEl) return;
  answerTextEl.textContent = text;
  answerTextEl.dataset.state = state;
}

function appendAnswer(text: string): void {
  if (!answerTextEl) return;
  // The first delta replaces the "Thinking…" placeholder.
  if (answerTextEl.dataset.state) {
    answerTextEl.textContent = "";
    answerTextEl.dataset.state = "";
  }
  answerTextEl.textContent += text;
  answerTextEl.scrollTop = answerTextEl.scrollHeight;
}

function hideUpgrade(): void {
  if (upgradeBannerEl) upgradeBannerEl.hidden = true;
}

/** Shows the blocking "free limit reached" banner with the upgrade CTA. */
function showUpgrade(): void {
  if (!upgradeBannerEl) return;
  if (upgradeTextEl) {
    upgradeTextEl.textContent = "You've reached the free limit. Upgrade to keep using MeetCopilot.";
  }
  upgradeBannerEl.dataset.state = "limit";
  upgradeBannerEl.hidden = false;
}

/** Shows the non-blocking soft warning as usage approaches the cap. */
function showUsageWarning(usage: UsageSnapshot): void {
  if (!upgradeBannerEl) return;
  const parts: string[] = [];
  if (usage.limits.maxSessions !== null) {
    parts.push(`${usage.sessions}/${usage.limits.maxSessions} sessions`);
  }
  if (usage.limits.maxSttSeconds !== null) {
    parts.push(`${Math.round(usage.sttSeconds)}/${usage.limits.maxSttSeconds}s`);
  }
  if (upgradeTextEl) {
    const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    upgradeTextEl.textContent = `You're approaching the free limit${detail}.`;
  }
  upgradeBannerEl.dataset.state = "warn";
  upgradeBannerEl.hidden = false;
}

/** Mints a Deepgram token via the authed, cap-gated main process. */
async function getDeepgramToken(): Promise<{ accessToken: string; expiresInSeconds?: number }> {
  const result = await api.stt.deepgramToken();
  if (!result.ok || !result.accessToken) {
    throw new Error(result.limitReached ? "limit_reached" : (result.error ?? "STT token request failed"));
  }
  return { accessToken: result.accessToken, expiresInSeconds: result.expiresInSeconds };
}

/** Sets a step's status dot + optional message in the onboarding wizard. */
function setObStep(
  dot: HTMLElement | null,
  msgEl: HTMLElement | null,
  state: "active" | "error",
  message: string,
): void {
  if (dot) dot.dataset.state = state;
  if (msgEl) {
    msgEl.textContent = message;
    msgEl.dataset.state = state === "active" ? "ok" : "";
    msgEl.hidden = false;
  }
}

/** Requests microphone access; a success here means capture's mic will work. */
async function testMicPermission(): Promise<void> {
  const button = asButton(obMicBtn);
  if (button) button.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stopStreams([stream]);
    setObStep(obMicDot, obMicMsg, "active", "Microphone is ready.");
    if (button) button.textContent = "Microphone allowed";
  } catch (err) {
    setObStep(obMicDot, obMicMsg, "error", "Microphone blocked. Open Troubleshooting for steps.");
    appendLog("Onboarding", `microphone permission failed: ${getErrorMessage(err)}`);
    if (button) button.disabled = false;
  }
}

/** Requests system-audio (loopback) capture; verifies an audio track is present. */
async function testSystemAudioPermission(): Promise<void> {
  const button = asButton(obSysBtn);
  if (button) button.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const hasAudio = stream.getAudioTracks().length > 0;
    stopStreams([stream]);
    if (hasAudio) {
      setObStep(obSysDot, obSysMsg, "active", "System audio is working.");
      if (button) button.textContent = "System audio works";
    } else {
      setObStep(obSysDot, obSysMsg, "error", "No system audio detected. See Troubleshooting.");
      if (button) button.disabled = false;
    }
  } catch (err) {
    setObStep(obSysDot, obSysMsg, "error", "Couldn't capture system audio. See Troubleshooting.");
    appendLog("Onboarding", `system audio test failed: ${getErrorMessage(err)}`);
    if (button) button.disabled = false;
  }
}

/** Persists completion and hides the wizard. */
async function finishOnboarding(): Promise<void> {
  await api.onboarding.complete();
  if (onboardingEl) onboardingEl.hidden = true;
}

/** Shows the first-run wizard unless onboarding was already completed. */
async function maybeShowOnboarding(): Promise<void> {
  try {
    const state = await api.onboarding.getState();
    if (!state.completed && onboardingEl) {
      onboardingEl.hidden = false;
    }
  } catch (err) {
    appendLog("Onboarding", `state check failed: ${getErrorMessage(err)}`);
  }
}

async function runAsk(): Promise<void> {
  if (isAsking) return;
  isAsking = true;
  const button = asButton(askBtn);
  if (button) button.disabled = true;
  setAnswer("Thinking…", "pending");

  const result = await api.infer.run(transcriptContext.slice(-maxContextLines));
  if (!result.ok) {
    if (result.limitReached) {
      setAnswer("You've reached the free limit. Upgrade to keep getting answers.", "error");
      showUpgrade();
    } else if (result.error && result.error !== "cancelled") {
      setAnswer(result.error, "error");
    }
  }

  isAsking = false;
  if (button) button.disabled = false;
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

    transcriptContext.push({ speaker: event.speaker, text: transcript });
    if (transcriptContext.length > maxContextLines) {
      transcriptContext.splice(0, transcriptContext.length - maxContextLines);
    }
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
      getDeepgramToken,
      onLog: appendLog,
    });
    sttUnsubscribe = [sttAdapter.onPartial(handleTranscript), sttAdapter.onFinal(handleTranscript)];
    await sttAdapter.start();
    updateSttStatus("active", `${provider} live`);

    capture = { micStream, displayStream, systemAudioStream, monitors, sttAdapter, sttUnsubscribe };
    appendLog("Capture", `microphone, system loopback, and ${provider} STT are live`);

    // Open a usage-metering session for this meeting. The free cap is enforced
    // server-side: a blocked user is torn down and shown the upgrade prompt.
    const session = await api.session.start();
    if (session.ok) {
      appendLog("Usage", "metering session started");
      hideUpgrade();
      if (session.usage?.warn) {
        showUsageWarning(session.usage);
      }
    } else if (session.limitReached) {
      appendLog("Usage", "free limit reached");
      showUpgrade();
      stopCapture();
      return;
    } else if (session.error) {
      appendLog("Usage", `metering off: ${session.error}`);
    }
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    appendLog("Capture error", message);
    updateCaptureStatus("You", "error", "error");
    updateCaptureStatus("Them", "error", "error");
    updateSttStatus("error", message === "limit_reached" ? "limit reached" : "error");
    for (const unsubscribe of sttUnsubscribe) unsubscribe();
    await sttAdapter?.stop().catch((stopErr: unknown) => {
      appendLog("STT error", `failed to stop after error: ${getErrorMessage(stopErr)}`);
    });
    for (const monitor of monitors) monitor.stop();
    stopStreams([micStream, displayStream, systemAudioStream]);
    if (message === "limit_reached") {
      showUpgrade();
    }
  } finally {
    isStartingCapture = false;
    setCaptureControls();
  }
}

function stopCapture(): void {
  if (capture === null) return;

  const currentCapture = capture;
  capture = null;
  // Close the usage-metering session; the server derives total STT seconds from it.
  void api.session.end();
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
initAuthUi(appendLog);

api.infer.onDelta((text) => appendAnswer(text));
api.infer.onError((error) => setAnswer(error, "error"));
api.infer.onHotkey(() => void runAsk());
askBtn?.addEventListener("click", () => void runAsk());
startCaptureBtn?.addEventListener("click", () => {
  void startCapture();
});
stopCaptureBtn?.addEventListener("click", () => stopCapture());
upgradeBtn?.addEventListener("click", () => api.openUpgrade());
upgradeDismissBtn?.addEventListener("click", () => hideUpgrade());
obMicBtn?.addEventListener("click", () => void testMicPermission());
obSysBtn?.addEventListener("click", () => void testSystemAudioPermission());
obHelpBtn?.addEventListener("click", () => api.openTroubleshooting());
obFinishBtn?.addEventListener("click", () => void finishOnboarding());
closeBtn?.addEventListener("click", () => {
  stopCapture();
  api.close();
});
// AUTH_DISABLED — testing-mode banner dismiss. Remove with the banner before release.
document.getElementById("testing-dismiss")?.addEventListener("click", () => {
  const banner = document.getElementById("testing-banner");
  if (banner) banner.hidden = true;
});
window.addEventListener("beforeunload", () => stopCapture());

// Forward renderer crashes to the main process for Sentry reporting (the overlay's
// CSP blocks direct network egress, so main owns telemetry).
window.addEventListener("error", (event) => api.reportError(event.message || "renderer error"));
window.addEventListener("unhandledrejection", (event) =>
  api.reportError(`unhandledrejection: ${String(event.reason)}`),
);

setCaptureControls();
updateCaptureStatus("You", "idle", "idle");
updateCaptureStatus("Them", "idle", "idle");
updateSttStatus("idle", `idle (${api.sttProvider})`);
appendLog("Overlay", `renderer ready — STT provider: ${api.sttProvider}`);
void maybeShowOnboarding();
