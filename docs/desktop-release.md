# Releasing the desktop app + auto-update (Milestone 8)

The desktop app updates itself with **electron-updater**, pulling from the
**GitHub Releases** feed of `Devkolsawala/AI-Meeting-Assistant` (configured in
[apps/desktop/electron-builder.yml](../apps/desktop/electron-builder.yml) `publish`).
Each release publishes three artifacts that auto-update needs:

- `MeetCopilot-Setup.exe` — the signed NSIS installer (stable, version-less name).
- `MeetCopilot-Setup.exe.blockmap` — for differential downloads.
- `latest.yml` — the version manifest electron-updater polls.

The website's **Download for Windows** button serves the latest release directly:
`https://github.com/Devkolsawala/AI-Meeting-Assistant/releases/latest/download/MeetCopilot-Setup.exe`.

## Cut a release

1. **Bump the version** in `apps/desktop/package.json` (electron-updater only offers
   an update when the published version is greater than the installed one).
2. **Set signing env** (see [desktop-signing.md](desktop-signing.md)) — releases must
   be signed, or Windows blocks the auto-update signature check.
3. **Set the GitHub token** with `repo` scope so electron-builder can upload:
   ```powershell
   $env:GH_TOKEN = "<github personal access token>"
   ```
4. **Set the cache env** (this machine's cross-drive fix) and **publish**:
   ```powershell
   $env:ELECTRON_BUILDER_CACHE = "D:\eb-cache"; $env:TEMP = "D:\eb-tmp"; $env:TMP = "D:\eb-tmp"
   $env:Path = "$env:USERPROFILE\.pnpm-shim;$env:Path"
   pnpm --filter @meetcopilot/desktop release
   ```
   This builds, signs, and uploads the installer + `latest.yml` + blockmap to a
   GitHub Release (created as a draft by default — publish it when ready).

## Wire the website (one-time)

Set `INSTALLER_DOWNLOAD_URL` in Vercel to the latest-release URL above and redeploy
(the home page's button state is baked at build time). After that, every new release
is served automatically with no further website change.

## How updates reach users

- On launch (packaged builds only), the app checks `latest.yml`, downloads a newer
  version in the background, and installs it on the next quit
  (`autoInstallOnAppQuit`). Progress is written to `%APPDATA%\MeetCopilot\diagnostics.log`
  (`AUTO_UPDATE ...` lines). Unpackaged dev runs skip auto-update.

## Verify

1. Install release **N** (from the website button). Confirm it runs.
2. Bump the version, publish release **N+1**.
3. Relaunch the installed app; watch the diagnostics log show
   `AUTO_UPDATE available <N+1>` → `downloaded` → quit and reopen → it's on **N+1**.
4. Confirm the website button downloads the **signed** `MeetCopilot-Setup.exe` and it
   installs with no "Unknown Publisher" warning.
