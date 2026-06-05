import type { App } from "electron";
import { autoUpdater } from "electron-updater";
import { captureError } from "./telemetry.js";

// Auto-update via electron-updater, pulling from the GitHub Releases feed configured
// in electron-builder.yml (publish + the generated app-update.yml). Publishing a new
// release makes installed apps download it and install on next quit. Disabled when
// unpackaged (dev), where there is no update feed.

/** Wires up background update checks. Safe to call once on app startup. */
export function initAutoUpdates(app: App, log: (message: string) => void): void {
  if (!app.isPackaged) {
    log("AUTO_UPDATE skipped (app not packaged)");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => log("AUTO_UPDATE checking for updates"));
  autoUpdater.on("update-available", (info) => log(`AUTO_UPDATE available: ${info.version}`));
  autoUpdater.on("update-not-available", () => log("AUTO_UPDATE up to date"));
  autoUpdater.on("download-progress", (p) =>
    log(`AUTO_UPDATE downloading ${Math.round(p.percent)}%`),
  );
  autoUpdater.on("update-downloaded", (info) =>
    log(`AUTO_UPDATE downloaded ${info.version} — will install on quit`),
  );
  autoUpdater.on("error", (err) => {
    log(`AUTO_UPDATE error: ${err instanceof Error ? err.message : String(err)}`);
    captureError(err, { source: "autoUpdater" });
  });

  // checkForUpdatesAndNotify downloads in the background and notifies on completion.
  void autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
    log(`AUTO_UPDATE check failed: ${err instanceof Error ? err.message : String(err)}`);
    captureError(err, { source: "autoUpdater.check" });
  });
}
