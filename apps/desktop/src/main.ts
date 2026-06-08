import electron from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_NAME,
  DEFAULT_PERSONA_KEY,
  type InferContextLine,
  type LimitReachedResponse,
  parseSttProvider,
  type UsageSnapshot,
} from "@meetcopilot/shared";
import { AuthService } from "./auth/auth-service.js";
import { PROTOCOL } from "./auth/config.js";
import { initAutoUpdates } from "./auto-update.js";
import { LimitReachedError, streamInfer } from "./infer/stream.js";
import { captureError, captureEvent } from "./telemetry.js";
import {
  type AuthStatus,
  IpcChannel,
  type InferRunResult,
  type OnboardingState,
  type SessionStartResult,
  type StatusEntry,
  type SttTokenResult,
} from "./ipc.js";

const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  session,
  desktopCapturer,
  webContents,
  Tray,
  Menu,
  nativeImage,
} = electron;

app.setName(APP_NAME);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the repo-root .env so SUPABASE_URL / SUPABASE_ANON_KEY / WEB_URL are
// available in dev. No-op if the file is absent (e.g. a packaged build).
try {
  process.loadEnvFile(path.resolve(__dirname, "..", "..", "..", ".env"));
} catch {
  // Fall back to the ambient environment.
}

/** The single overlay window. Kept at module scope so lifecycle handlers can reach it. */
let overlay: Electron.BrowserWindow | null = null;

/** The system tray icon. Kept at module scope so it is not garbage-collected. */
let tray: Electron.Tray | null = null;

/**
 * 16x16 indigo circle tray icon, embedded as a base64 PNG. Inlined rather than
 * shipped as an asset file so it survives the esbuild bundle without a separate
 * copy step (packaged builds bundle main.ts; loose assets are a known foot-gun).
 */
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAa0lEQVR4nGNgoDZwtjgl52xxqtPZ4tRlZ4tTv6D4MlRMjpDmFKiG/zgwSC4Fn2ZcGtFxCrpmOQI2Y3OJHLIBnSRohuFOZAMuk2HAZWQDSHE+3BtUNYBiL1AciJRFI8UJiSpJGc075GUmcgAA3yl0gDuVt5gAAAAASUVORK5CYII=";

/**
 * Creates the system tray icon with a Show Window / Quit context menu. The overlay
 * is frameless and skips the taskbar, so the tray is the user's reliable way back
 * to the window and out of the app.
 */
function createTray(): void {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  const menu = Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => {
        if (!overlay) {
          createWindow();
          return;
        }
        if (overlay.isMinimized()) overlay.restore();
        overlay.show();
        overlay.focus();
      },
    },
    { type: "separator" },
    { label: `Quit ${APP_NAME}`, click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  // Single-click the tray icon to bring the overlay forward (Windows convention).
  tray.on("click", () => {
    if (!overlay) {
      createWindow();
      return;
    }
    if (overlay.isMinimized()) overlay.restore();
    overlay.show();
    overlay.focus();
  });
}

/** Auth (PKCE + safeStorage). Pushes status changes to the overlay renderer. */
const authService = new AuthService((status: AuthStatus) => {
  overlay?.webContents.send(IpcChannel.AuthChanged, status);
});

// AUTH_DISABLED — testing mode, comment back in for production. Search the codebase
// for "AUTH_DISABLED" to re-enable authentication. Injects a mock signed-in user so
// the overlay behaves as a Pro account without a real Supabase login.
// Full mock identity used during testing:
//   { id: "test-user-001", email: "test@meetcopilot.dev", name: "Test User", plan: "pro" }
const MOCK_AUTH_STATUS: AuthStatus = { signedIn: true, email: "test@meetcopilot.dev" };

/**
 * Backend base URL for inference + STT token. Packaged builds have no .env, so the
 * default points at the deployed (Railway) backend; local dev overrides it via the
 * API_URL env var (repo-root .env), e.g. http://127.0.0.1:8787.
 */
const DEFAULT_API_URL = "https://meetcopilotapi-production.up.railway.app";
const API_BASE = (process.env.API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");

/** Web app base URL; the upgrade prompt opens its pricing section. */
const WEB_BASE = (process.env.WEB_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

/** The "ask" hotkey. Tells the overlay to send its context to /infer. */
const ASK_HOTKEY = "CommandOrControl+Enter";

// Crash reporting for the main process. The renderer forwards its own errors via
// IpcChannel.TelemetryError (registered below).
process.on("unhandledRejection", (reason) => captureError(reason, { kind: "unhandledRejection" }));
process.on("uncaughtException", (err) => captureError(err, { kind: "uncaughtException" }));

/** PostHog distinct id: the signed-in email, or "anonymous" when signed out. */
async function distinctId(): Promise<string> {
  try {
    return (await authService.getStatus()).email ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

/** Persisted one-time flags (e.g. first_session) under the app's userData dir. */
function readTelemetryFlags(): Record<string, boolean> {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "telemetry-state.json"), "utf8"));
  } catch {
    return {};
  }
}

/** Emits a product event the first time `flag` is seen, then remembers it. */
async function trackFirst(flag: string, event: string, properties?: Record<string, unknown>): Promise<void> {
  const flags = readTelemetryFlags();
  if (flags[flag]) {
    return;
  }
  flags[flag] = true;
  try {
    fs.writeFileSync(path.join(app.getPath("userData"), "telemetry-state.json"), JSON.stringify(flags));
  } catch {
    // Best-effort; re-emitting once more on failure is harmless.
  }
  captureEvent(event, await distinctId(), properties);
}

/** Aborts the in-flight inference stream when a new one starts. */
let inferAbort: AbortController | null = null;

/** The current usage-metering session id (set on capture start, cleared on stop). */
let currentSessionId: string | null = null;

/**
 * Opens a usage-metering session for the meeting. Best-effort: if the user is
 * signed out or the backend is unreachable, capture still proceeds unmetered.
 */
async function startUsageSession(): Promise<SessionStartResult> {
  const accessToken = await authService.getValidAccessToken();
  // AUTH_DISABLED — testing mode: skip the sign-in requirement so capture can start
  // without a login. Re-enable for production.
  /*
  if (!accessToken) {
    return { ok: false, error: "Sign in to start a session." };
  }
  */
  try {
    const res = await fetch(`${API_BASE}/session/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 402) {
      const body = (await res.json().catch(() => null)) as LimitReachedResponse | null;
      return { ok: false, limitReached: true, usage: body?.usage };
    }
    if (!res.ok) {
      return { ok: false, error: `Session start failed (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { sessionId?: string; usage?: UsageSnapshot };
    if (!data.sessionId) {
      return { ok: false, error: "Session start returned no id." };
    }
    currentSessionId = data.sessionId;
    void trackFirst("firstSession", "first_session");
    return { ok: true, usage: data.usage };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mints a Deepgram STT token via the authed, cap-gated backend. Routed through main
 * so the Supabase access token never reaches the renderer.
 */
async function mintSttToken(): Promise<SttTokenResult> {
  const accessToken = await authService.getValidAccessToken();
  // AUTH_DISABLED — testing mode: skip the sign-in requirement. Re-enable for production.
  /*
  if (!accessToken) {
    return { ok: false, error: "Sign in to start transcription." };
  }
  */
  try {
    const res = await fetch(`${API_BASE}/stt-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
    if (res.status === 402) {
      return { ok: false, limitReached: true };
    }
    if (!res.ok) {
      return { ok: false, error: `STT token request failed (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { accessToken?: string; expiresInSeconds?: number };
    if (!data.accessToken) {
      return { ok: false, error: "STT token response had no token." };
    }
    return { ok: true, accessToken: data.accessToken, expiresInSeconds: data.expiresInSeconds };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Closes the current usage-metering session, if any. Best-effort. */
async function endUsageSession(): Promise<void> {
  const sessionId = currentSessionId;
  currentSessionId = null;
  if (!sessionId) {
    return;
  }
  const accessToken = await authService.getValidAccessToken();
  if (!accessToken) {
    return;
  }
  try {
    await fetch(`${API_BASE}/session/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  } catch (err) {
    diag(`SESSION end failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function isContextLine(value: unknown): value is InferContextLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (line.speaker === "you" || line.speaker === "them") && typeof line.text === "string";
}

/** Runs one inference stream, forwarding deltas/done/error to the overlay. */
async function runInference(context: InferContextLine[]): Promise<InferRunResult> {
  const accessToken = await authService.getValidAccessToken();
  // AUTH_DISABLED — testing mode: skip the sign-in requirement. Re-enable for production.
  /*
  if (!accessToken) {
    return { ok: false, error: "Sign in before asking MeetCopilot." };
  }
  */
  if (context.length === 0) {
    return { ok: false, error: "No transcript yet — start capture and speak first." };
  }

  inferAbort?.abort();
  const abort = new AbortController();
  inferAbort = abort;

  try {
    await streamInfer({
      apiBase: API_BASE,
      // AUTH_DISABLED — testing mode: with the sign-in gate off there may be no token.
      // Coerce to "" to satisfy the type; re-enabling auth restores a real token.
      accessToken: accessToken ?? "",
      context,
      persona: DEFAULT_PERSONA_KEY,
      sessionId: currentSessionId ?? undefined,
      signal: abort.signal,
      onDelta: (text) => overlay?.webContents.send(IpcChannel.InferDelta, text),
    });
    if (inferAbort === abort) inferAbort = null;
    overlay?.webContents.send(IpcChannel.InferDone);
    void trackFirst("firstAnswer", "first_answer");
    return { ok: true };
  } catch (err) {
    if (abort.signal.aborted) {
      return { ok: false, error: "cancelled" };
    }
    if (err instanceof LimitReachedError) {
      return { ok: false, limitReached: true, error: "limit_reached" };
    }
    const message = err instanceof Error ? err.message : String(err);
    overlay?.webContents.send(IpcChannel.InferError, message);
    return { ok: false, error: message };
  }
}

/** Path to the persisted first-run onboarding state. */
function onboardingPath(): string {
  return path.join(app.getPath("userData"), "onboarding.json");
}

/** Reads onboarding state; defaults to not-completed (so first run shows the wizard). */
function readOnboarding(): OnboardingState {
  try {
    const parsed = JSON.parse(fs.readFileSync(onboardingPath(), "utf8")) as Partial<OnboardingState>;
    return { completed: parsed.completed === true };
  } catch {
    return { completed: false };
  }
}

/** Marks onboarding complete so the wizard does not show on future launches. */
function completeOnboarding(): void {
  try {
    fs.writeFileSync(onboardingPath(), JSON.stringify({ completed: true }));
  } catch (err) {
    diag(`ONBOARDING save failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Finds a meetcopilot:// deep link among process/relaunch arguments (Windows). */
function findDeepLink(argv: readonly string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
}

/** Routes a deep link to the auth service, logging any failure. */
function routeDeepLink(url: string): void {
  void authService.handleDeepLink(url).catch((err: unknown) => {
    diag(`AUTH callback failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}

/**
 * Diagnostics log. The overlay is frameless and has no visible console, so we
 * also append startup diagnostics to a file under the app's userData dir.
 */
function diag(message: string): void {
  console.log(`[${APP_NAME}] ${message}`);
  try {
    const file = path.join(app.getPath("userData"), "diagnostics.log");
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Best-effort logging only.
  }
}

function isOverlayWebContents(contents: Electron.WebContents | null | undefined): boolean {
  return overlay !== null && contents?.id === overlay.webContents.id;
}

function isOverlayFrame(frame: Electron.WebFrameMain | null): boolean {
  if (frame === null) return false;
  return isOverlayWebContents(webContents.fromFrame(frame));
}

function configureCaptureSession(): void {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler((contents, permission) => {
    return permission === "media" && isOverlayWebContents(contents);
  });

  defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    const allowed =
      isOverlayWebContents(contents) &&
      (permission === "media" || permission === "display-capture");
    diag(`PERMISSION_REQUEST ${permission} ${allowed ? "granted" : "denied"}`);
    callback(allowed);
  });

  defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (!isOverlayFrame(request.frame)) {
      diag(`DISPLAY_MEDIA denied origin=${request.securityOrigin}`);
      callback({});
      return;
    }

    desktopCapturer
      .getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      })
      .then((sources) => {
        const source = sources[0];
        if (!source) {
          diag("DISPLAY_MEDIA failed: no screen sources available");
          callback({});
          return;
        }

        diag(
          `DISPLAY_MEDIA granting source="${source.name}" audio=${
            request.audioRequested ? "loopback" : "none"
          } video=${request.videoRequested ? "screen" : "not-requested"}`,
        );
        callback({
          video: source,
          ...(request.audioRequested ? { audio: "loopback" as const } : {}),
        });
      })
      .catch((err: unknown) => {
        diag(`DISPLAY_MEDIA failed: ${err instanceof Error ? err.message : String(err)}`);
        callback({});
      });
  });
}

/** Diagnostics shown in the overlay (and logged to stdout) to prove M2 behaviour. */
function buildStatusEntries(): StatusEntry[] {
  const display = screen.getPrimaryDisplay();
  return [
    { label: "App", value: `${APP_NAME} — stealth overlay spike` },
    { label: "STT provider", value: parseSttProvider(process.env.STT_PROVIDER) },
    { label: "Electron", value: process.versions.electron ?? "unknown" },
    { label: "Chromium", value: process.versions.chrome ?? "unknown" },
    { label: "Node", value: process.versions.node ?? "unknown" },
    { label: "Platform", value: `${process.platform} ${process.arch}` },
    { label: "Frame", value: "frameless + transparent" },
    { label: "Content protection", value: "ENABLED (excluded from screen capture)" },
    { label: "Always-on-top", value: "screen-saver level" },
    { label: "Taskbar", value: "skipped" },
    {
      label: "Primary display",
      value: `${display.size.width}x${display.size.height} @ ${display.scaleFactor}x`,
    },
    { label: "Quit", value: "click x or press Ctrl+Shift+Q" },
  ];
}

function createWindow(): void {
  overlay = new BrowserWindow({
    width: 440,
    height: 500,
    minWidth: 320,
    minHeight: 360,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Raise above normal always-on-top windows (screen-saver level) and hide from capture.
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setContentProtection(true);
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlay.once("ready-to-show", () => overlay?.show());

  overlay.webContents.on("did-finish-load", () => {
    for (const entry of buildStatusEntries()) {
      diag(`${entry.label}: ${entry.value}`);
      overlay?.webContents.send(IpcChannel.Log, entry);
    }
    diag("WINDOW_READY content-protection=ON");
    // AUTH_DISABLED — testing mode: push the mock signed-in status to the overlay.
    overlay?.webContents.send(IpcChannel.AuthChanged, MOCK_AUTH_STATUS);
    /*
    void authService.getStatus().then((status) => {
      overlay?.webContents.send(IpcChannel.AuthChanged, status);
    });
    */
  });

  void overlay.loadFile(path.join(__dirname, "renderer", "index.html"));
}

// Register meetcopilot:// so the OS routes the login callback back to this app.
if (process.defaultApp) {
  // Unpackaged (electron .): point the scheme at this Electron binary + app path.
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// A single instance owns the overlay and the protocol callback. A second launch
// (e.g. the browser opening meetcopilot://...) forwards its args here and exits.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = findDeepLink(argv);
    if (deepLink) routeDeepLink(deepLink);
    if (overlay) {
      if (overlay.isMinimized()) overlay.restore();
      overlay.focus();
    }
  });

  // macOS delivers deep links via open-url instead of argv.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    routeDeepLink(url);
  });

  ipcMain.handle(IpcChannel.AuthLogin, () => authService.beginLogin());
  ipcMain.handle(IpcChannel.AuthLogout, () => authService.logout());
  // AUTH_DISABLED — testing mode: report the mock signed-in user to the renderer.
  ipcMain.handle(IpcChannel.AuthGetStatus, () => MOCK_AUTH_STATUS);
  // ipcMain.handle(IpcChannel.AuthGetStatus, () => authService.getStatus());
  ipcMain.handle(IpcChannel.SessionStart, () => startUsageSession());
  ipcMain.handle(IpcChannel.SessionEnd, () => endUsageSession());
  ipcMain.handle(IpcChannel.SttToken, () => mintSttToken());
  ipcMain.on(IpcChannel.TelemetryError, (_event, message: unknown) => {
    captureError(new Error(typeof message === "string" ? message : JSON.stringify(message)), {
      source: "renderer",
    });
  });
  ipcMain.on(IpcChannel.OpenUpgrade, () => {
    void electron.shell.openExternal(`${WEB_BASE}/#pricing`).catch((err: unknown) => {
      diag(`OPEN_UPGRADE failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
  ipcMain.handle(IpcChannel.OnboardingGetState, () => readOnboarding());
  ipcMain.handle(IpcChannel.OnboardingComplete, () => completeOnboarding());
  ipcMain.on(IpcChannel.OpenTroubleshooting, () => {
    void electron.shell.openExternal(`${WEB_BASE}/help/windows-audio`).catch((err: unknown) => {
      diag(`OPEN_TROUBLESHOOTING failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  });
  ipcMain.handle(IpcChannel.InferRun, (_event, context: unknown) => {
    const lines = Array.isArray(context) ? context.filter(isContextLine) : [];
    return runInference(lines);
  });

  app
    .whenReady()
    .then(() => {
      try {
        fs.writeFileSync(path.join(app.getPath("userData"), "diagnostics.log"), "");
      } catch {
        // Best-effort only.
      }
      diag("app ready, creating overlay");
      configureCaptureSession();
      createWindow();
      createTray();
      initAutoUpdates(app, diag);
      globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
      globalShortcut.register(ASK_HOTKEY, () => {
        overlay?.webContents.send(IpcChannel.InferHotkey);
      });
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
      // Windows cold start via protocol: the deep link is in this process's argv.
      const initialDeepLink = findDeepLink(process.argv);
      if (initialDeepLink) routeDeepLink(initialDeepLink);
    })
    .catch((err: unknown) => {
      console.error(`[${APP_NAME}] failed to start:`, err);
      app.quit();
    });

  ipcMain.on(IpcChannel.Close, () => app.quit());

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("will-quit", () => globalShortcut.unregisterAll());
}
