import electron from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_NAME,
  DEFAULT_PERSONA_KEY,
  type InferContextLine,
  parseSttProvider,
} from "@meetcopilot/shared";
import { AuthService } from "./auth/auth-service.js";
import { PROTOCOL } from "./auth/config.js";
import { streamInfer } from "./infer/stream.js";
import { type AuthStatus, IpcChannel, type InferRunResult, type StatusEntry } from "./ipc.js";

const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  session,
  desktopCapturer,
  webContents,
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

/** Auth (PKCE + safeStorage). Pushes status changes to the overlay renderer. */
const authService = new AuthService((status: AuthStatus) => {
  overlay?.webContents.send(IpcChannel.AuthChanged, status);
});

/** Backend base URL for inference + STT token. */
const API_BASE = (process.env.API_URL?.trim() || "http://127.0.0.1:8787").replace(/\/+$/, "");

/** The "ask" hotkey. Tells the overlay to send its context to /infer. */
const ASK_HOTKEY = "CommandOrControl+Enter";

/** Aborts the in-flight inference stream when a new one starts. */
let inferAbort: AbortController | null = null;

function isContextLine(value: unknown): value is InferContextLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (line.speaker === "you" || line.speaker === "them") && typeof line.text === "string";
}

/** Runs one inference stream, forwarding deltas/done/error to the overlay. */
async function runInference(context: InferContextLine[]): Promise<InferRunResult> {
  const accessToken = await authService.getValidAccessToken();
  if (!accessToken) {
    return { ok: false, error: "Sign in before asking MeetCopilot." };
  }
  if (context.length === 0) {
    return { ok: false, error: "No transcript yet — start capture and speak first." };
  }

  inferAbort?.abort();
  const abort = new AbortController();
  inferAbort = abort;

  try {
    await streamInfer({
      apiBase: API_BASE,
      accessToken,
      context,
      persona: DEFAULT_PERSONA_KEY,
      signal: abort.signal,
      onDelta: (text) => overlay?.webContents.send(IpcChannel.InferDelta, text),
    });
    if (inferAbort === abort) inferAbort = null;
    overlay?.webContents.send(IpcChannel.InferDone);
    return { ok: true };
  } catch (err) {
    if (abort.signal.aborted) {
      return { ok: false, error: "cancelled" };
    }
    const message = err instanceof Error ? err.message : String(err);
    overlay?.webContents.send(IpcChannel.InferError, message);
    return { ok: false, error: message };
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
    void authService.getStatus().then((status) => {
      overlay?.webContents.send(IpcChannel.AuthChanged, status);
    });
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
  ipcMain.handle(IpcChannel.AuthGetStatus, () => authService.getStatus());
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
