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
> - **Milestone 4** - dual audio capture in the desktop overlay: microphone
>   ("You") plus Windows system loopback audio ("Them").
> - **Milestone 5** - Deepgram Nova-3 live transcription from a merged 2-channel
>   Web Audio stream, with short-lived auth from the local token server.
> - **Milestone 6** - ElevenLabs (Scribe v2 Realtime) and Sarvam (saaras:v3) behind
>   the same STT adapter, switchable with one `STT_PROVIDER` env var for A/B testing.

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

## Run audio capture (Milestone 4)

The desktop overlay now captures two separate live audio streams:

- `You` - microphone audio from `navigator.mediaDevices.getUserMedia({ audio: true })`.
- `Them` - Windows system loopback audio granted by Electron's
  `setDisplayMediaRequestHandler` with `audio: "loopback"`.

```powershell
pnpm build
pnpm --filter @meetcopilot/desktop start
```

What to verify:

- Click **Start capture** in the overlay.
- The log shows both `You` and `Them` streams are live with audio tracks.
- Speak into the microphone and play meeting/system audio. The overlay and renderer
  console log `You: audio detected (...)` and `Them: audio detected (...)` once each
  side has a non-silent signal.
- Click **Stop** and verify both status rows switch to stopped.

If a stream is live but silent, the overlay keeps logging that it is waiting for an
audible signal. System loopback capture is Windows-only in Electron.

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

| Method | Path                | Returns                                              |
| ------ | ------------------- | ---------------------------------------------------- |
| GET    | `/health`           | Liveness check (no key needed)                       |
| GET    | `/token/deepgram`   | `{ provider, accessToken, expiresInSeconds }` (30s)  |
| GET    | `/token/elevenlabs` | `{ provider, token, expiresInSeconds }` (900s)       |
| WS     | `/stt/sarvam`       | WebSocket proxy to Sarvam (injects `SARVAM_API_KEY`) |

> Sarvam has no short-lived token endpoint and authenticates with an
> `Api-Subscription-Key` header that browser WebSockets cannot set. The server
> therefore exposes a WebSocket **proxy** at `/stt/sarvam` that injects the key
> server-side and relays frames to `wss://api.sarvam.ai`; the key never reaches the
> renderer. Change the port with the `PORT` env var.

## Run live transcription (Milestone 5)

Milestone 5 adds Deepgram streaming speech-to-text in the desktop renderer without
exposing the Deepgram API key. The renderer fetches a short-lived JWT from
`GET /token/deepgram`, then connects directly to Deepgram's WebSocket API.

```powershell
# Terminal 1: start the local token server. Requires DEEPGRAM_API_KEY in .env.
pnpm build
pnpm --filter @meetcopilot/api start

# Terminal 2: start the overlay.
pnpm --filter @meetcopilot/desktop start
```

What to verify:

- Click **Start capture** in the overlay.
- The log shows a Deepgram token request, WebSocket connection, and
  `nova-3, 2 channels, 16000 Hz linear16` streaming.
- Speak into the microphone and play system audio. The transcript panel and
  renderer console show live text labeled `You:` for channel 0 and `Them:` for
  channel 1.
- Click **Stop** and verify capture, AudioWorklet streaming, and the WebSocket
  close cleanly.

Implementation notes:

- The microphone stream is channel 0 and the Windows loopback stream is channel 1.
- The renderer uses a `ChannelMergerNode` plus an `AudioWorklet`; the worklet
  downsamples to 16 kHz, converts Float32 audio to Int16 `linear16`, and sends
  interleaved stereo PCM frames to Deepgram.
- Deepgram is configured with `model=nova-3`, `multichannel=true`, `channels=2`,
  `sample_rate=16000`, `encoding=linear16`, and `interim_results=true`.

## Switch STT providers (Milestone 6)

Milestone 6 adds **ElevenLabs** (`scribe_v2_realtime`) and **Sarvam** (`saaras:v3`,
`mode=transcribe`) behind the same `SpeechToTextAdapter` contract used by Deepgram.
Pick the active provider with the `STT_PROVIDER` environment variable
(`deepgram` | `elevenlabs` | `sarvam`; defaults to `deepgram`).

```powershell
# Terminal 1: token server + Sarvam proxy. Needs the relevant key(s) in .env.
pnpm build
pnpm --filter @meetcopilot/api start

# Terminal 2: start the overlay with the provider you want to test.
$env:STT_PROVIDER = "elevenlabs"   # or "sarvam" or "deepgram"
pnpm --filter @meetcopilot/desktop start
```

What to verify:

- The overlay's STT status and startup log show the selected provider.
- Click **Start capture**, then speak into the mic and play system audio. The
  transcript panel shows live text labeled `You:` (mic) and `Them:` (loopback).
- Click **Stop** and confirm both connections and audio graphs close cleanly.

Implementation notes:

- Deepgram streams both channels over **one** multichannel WebSocket. ElevenLabs and
  Sarvam transcribe a single source per connection, so each runs **two** mono
  connections (mic + loopback) labeled by connection.
- All three share one mono/stereo `pcm-worklet` and the `createSttAdapter` factory.
- ElevenLabs connects directly with a single-use token (one minted per connection).
  Sarvam connects through the local `/stt/sarvam` WebSocket proxy. No provider key
  ever reaches the renderer.

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
