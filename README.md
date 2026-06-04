# MeetCopilot

A Windows desktop AI meeting assistant. It captures the meeting's system audio
("Them") and your microphone ("You") as two separate channels, transcribes both,
and shows streamed AI answers in a floating overlay that stays invisible during
screen share.

> **Status:** Phase 0 — a de-risking spike. We are proving the hardest pieces work
> before building product features. Done so far:
>
> - **Milestone 1** — toolchain + clean monorepo scaffold.
> - **Milestone 2** — stealth overlay window (frameless, transparent, always-on-top
>   at screen-saver level, taskbar-skipped, excluded from screen capture).
> - **Milestone 3** — local token server that mints short-lived STT provider tokens
>   (Deepgram + ElevenLabs) so API keys never reach the client.

## Tech

- **Desktop:** Electron + React + TypeScript (`apps/desktop`)
- **API:** Node + TypeScript token/inference server (`apps/api`)
- **Shared:** TypeScript types + config (`packages/shared`)
- **Monorepo:** pnpm workspaces + Turborepo

## Prerequisites

- **Node.js 24.16.0** (current Active LTS), pinned to this project via
  [Volta](https://volta.sh) — see the `"volta"` field in `package.json`. Volta
  auto-switches to Node 24 in this folder while leaving your global default
  untouched. `.nvmrc` documents the same version for fnm/nvm users.
- **pnpm 11.5.1** (`packageManager` field). Install once with `npm install -g pnpm@11.5.1`.

> Reproducible setup on a fresh machine:
> `winget install Volta.Volta`, then in this folder `volta pin node@24.16.0`,
> then `npm install -g pnpm@11.5.1`.

## Install

```powershell
pnpm install
```

## Common commands

Run from the repo root:

```powershell
pnpm build         # build every workspace (Turborepo)
pnpm typecheck     # type-check every workspace
pnpm lint          # ESLint across the workspace
pnpm format        # Prettier — write
pnpm format:check  # Prettier — verify only
```

## Run the overlay (Milestone 2)

```powershell
pnpm build                                   # compiles desktop main/preload/renderer
pnpm --filter @meetcopilot/desktop start     # launches the Electron overlay
```

What to verify:

- A small frameless, semi-transparent panel appears, always on top, with a draggable
  title bar (drag it by the title bar to move it).
- It does **not** show up in the Windows taskbar or Alt-Tab.
- Start a screen share / screen recording (Teams, Zoom, Meet, Xbox Game Bar, Snipping
  Tool video): the overlay is **invisible** in the captured video while still visible
  to you.
- Quit with the **x** button or **Ctrl+Shift+Q**.
- Startup diagnostics are also written to
  `%APPDATA%\MeetCopilot\diagnostics.log`.

## Run the token server (Milestone 3)

A tiny local server (`apps/api`) on `http://127.0.0.1:8787` that mints **short-lived**
tokens for the speech-to-text providers. The provider API keys are read from `.env`
**server-side only** — the desktop client only ever receives the temporary tokens.

```powershell
# 1. Put your keys in .env (copy from .env.example) — see "Environment" below.
pnpm build
pnpm --filter @meetcopilot/api start
```

Then, in a second terminal (or a browser):

```powershell
# Health — works without any keys:
curl http://127.0.0.1:8787/health
# -> {"ok":true,"service":"MeetCopilot token server","time":"..."}

# Deepgram short-lived JWT (needs DEEPGRAM_API_KEY in .env):
curl http://127.0.0.1:8787/token/deepgram
# -> {"provider":"deepgram","accessToken":"<jwt>","expiresInSeconds":30}

# ElevenLabs single-use token (needs ELEVENLABS_API_KEY in .env):
curl http://127.0.0.1:8787/token/elevenlabs
# -> {"provider":"elevenlabs","token":"<token>","expiresInSeconds":900}
```

If a key is missing you get a clear `500` with a message naming the variable; if a
provider rejects the request you get a `502`. Endpoints:

| Method | Path                | Returns                                             |
| ------ | ------------------- | --------------------------------------------------- |
| GET    | `/health`           | Liveness check (no key needed)                      |
| GET    | `/token/deepgram`   | `{ provider, accessToken, expiresInSeconds }` (30s) |
| GET    | `/token/elevenlabs` | `{ provider, token, expiresInSeconds }` (900s)      |

> Sarvam is added in Milestone 6. Change the port with the `PORT` env var.

## Environment

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**
These keys (`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `SARVAM_API_KEY`) are used
server-side only (`apps/api`); the desktop client only ever receives short-lived
tokens.

## Workspace layout

```
apps/
  desktop/   @meetcopilot/desktop  — Electron overlay app (built out in M2)
  api/       @meetcopilot/api       — local token/inference server (M3)
packages/
  shared/    @meetcopilot/shared    — shared TypeScript types + config
```
