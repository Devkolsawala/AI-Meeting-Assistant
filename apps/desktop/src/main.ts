import electron from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, parseSttProvider } from "@meetcopilot/shared";
import { IpcChannel, type StatusEntry } from "./ipc.js";

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

/** The single overlay window. Kept at module scope so lifecycle handlers can reach it. */
let overlay: Electron.BrowserWindow | null = null;

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
  });

  void overlay.loadFile(path.join(__dirname, "renderer", "index.html"));
}

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
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
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
